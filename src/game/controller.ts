import { create } from 'zustand';
import type {
  CheckDiff, Puzzle, QueueEntry, RunRequest, RunResult, Settings, TraceEvent, Value, WindowLayout,
} from '../contracts';
import { getTutorial, tutorialsFor } from '../../content/tutorials';
import { puzzles, getPuzzle } from './catalog';
import { check } from './checker';
import { canEnterPuzzle, completePuzzle, enterWing, offlineSeconds, orderTrips, ORDER_SECONDS, purchaseItem } from './economy';
import { buildQueue, requestFor } from './queue';
import { advanceReplay, currentLine, eventDuration, replayProgress } from './replay';
import {
  exportJSON, freshSave, importJSON, readLayout, readSettings, saves, validFilename,
  type GameSave, type PuzzleProgress, type SaveService,
} from './saves';

export interface GameRuntime {
  init(onProgress?: (progress: number, message: string) => void): Promise<void>;
  run(request: RunRequest): Promise<RunResult>;
  stop(): void;
  dispose(): void;
}

type Screen = 'title' | 'intro' | 'game' | 'credits';

export interface GameState {
  screen: Screen;
  loading: number;
  loadingMessage: string;
  ready: boolean;
  save: GameSave;
  puzzle: Puzzle;
  activeFile: string;
  code: string;
  inputs: Record<string, Value>;
  result: RunResult | null;
  expected: Value;
  queue: QueueEntry[];
  diff: CheckDiff | null;
  busy: boolean;
  backgroundBusy: boolean;
  status: string;
  hintLevel: number;
  traceIndex: number;
  replayPaused: boolean;
  replayElapsed: number;
  currentLine: number | null;
  event: TraceEvent | null;
  progress: number;
  activeSlot: number;
  activeTutorial: string | null;
  tutorialQueue: string[];
  activityPaused: boolean;
  captureMode: boolean;
  setActivityPaused(paused: boolean): void;
  setCaptureMode(enabled: boolean): void;
  initialize(): Promise<void>;
  newGame(name: string): void;
  setScreen(screen: Screen): void;
  setCode(code: string): void;
  setActiveFile(name: string): void;
  addFile(name: string): void;
  run(): Promise<void>;
  serveQueue(): Promise<void>;
  stop(): void;
  gotoPuzzle(id: string): void;
  nextPuzzle(): void;
  hint(): void;
  setSettings(partial: Partial<Settings>): void;
  setLayout(id: string, layout: WindowLayout): void;
  setReplay(index: number): void;
  setReplayPaused(paused: boolean): void;
  setSpeed(speed: number): void;
  loadSlot(slot: number): Promise<void>;
  saveSlot(slot: number): Promise<void>;
  exportSave(): string;
  importSave(json: string): Promise<void>;
  reset(): void;
  fileStandingOrder(): void;
  stepClock(seconds: number): void;
  markTutorial(id: string): void;
  purchase(id: string): void;
  autoSolve(): Promise<void>;
  playNaive(): Promise<void>;
  refreshExpected(): Promise<void>;
  replayQueue(index: number): Promise<void>;
  replayStandingOrder(puzzleId: string): Promise<void>;
  setOrderPaused(puzzleId: string, paused: boolean): void;
  scratch(code: string): Promise<RunResult | null>;
  tickReplay(milliseconds: number): void;
  stepReplay(): void;
  skipReplay(): void;
  replay(): void;
  triggerTutorial(trigger: string): void;
  replayTutorial(id: string): void;
  dismissTutorial(): void;
  waitForIdle(): Promise<void>;
  disposeGame(): void;
}

function progressFor(save: GameSave, puzzle: Puzzle): PuzzleProgress {
  return save.progress[puzzle.id] ?? { code: puzzle.starter, attempts: 0, hints: 0 };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The request could not finish. Please try again.';
}

export function createGame(runtime: GameRuntime, persistence: SaveService = saves) {
  let epoch = 0;
  let lifecycle = 0;
  let timer: ReturnType<typeof setInterval> | undefined;
  let initializing: Promise<void> | undefined;
  let backgroundSeconds = 0;
  const references = new Map<string, RunResult>();

  return create<GameState>((set, get) => {
    const persist = (save: GameSave): void => {
      const next = { ...save, lastSavedAt: Date.now() };
      set({ save: next });
      void persistence.save(get().activeSlot, next).catch((error: unknown) => {
        set({ status: `Autosave could not write: ${errorMessage(error)} Export a copy before leaving.` });
      });
    };
    const tutorial = (trigger: string): void => {
      const state = get();
      const pending = tutorialsFor(trigger, state.save.seenTutorials)
        .map((entry) => entry.id).filter((id) => !state.tutorialQueue.includes(id) && state.activeTutorial !== id);
      const queue = [...state.tutorialQueue, ...pending];
      set({ activeTutorial: state.activeTutorial ?? queue.shift() ?? null, tutorialQueue: queue });
    };
    const replayFields = (result: RunResult, index = 0, paused = false) => ({
      result, traceIndex: index, replayElapsed: 0, replayPaused: paused || !result.trace.length,
      currentLine: result.trace[index]?.line ?? null, event: result.trace[index] ?? null, progress: 0,
    });
    const stop = (): void => {
      epoch++;
      runtime.stop();
      set((state) => ({
        busy: false, backgroundBusy: false, replayPaused: true, status: 'Stopped. Your code and inputs are safe.',
        queue: state.queue.map((entry) => entry.status === 'running' ? { ...entry, status: 'waiting' } : entry),
      }));
    };
    const begin = (status: string): number => {
      if (get().busy || get().backgroundBusy) stop();
      epoch++;
      set({ busy: true, status, replayPaused: true });
      return epoch;
    };
    const reference = async (puzzle: Puzzle, seed: number, inputs?: Record<string, Value>): Promise<RunResult> => {
      const key = JSON.stringify([puzzle.id, seed, inputs]);
      const cached = references.get(key);
      if (cached) return cached;
      const result = await runtime.run(requestFor(puzzle, puzzle.reference, seed, {}, inputs));
      if (result.error) throw new Error(`Request preview failed: ${result.error.friendly || result.error.message}`);
      if (references.size >= 100) references.delete(references.keys().next().value ?? '');
      references.set(key, result);
      return result;
    };
    const display = (result: RunResult, expected: Value): CheckDiff => {
      const diff = check(result.delivered, expected, get().puzzle.checker);
      if (result.error) { diff.pass = false; diff.message = result.error.friendly || result.error.message; }
      set({ ...replayFields(result), expected, inputs: result.inputs, diff, status: diff.message });
      tutorial('output');
      tutorial('run');
      tutorial(result.error ? 'loud' : diff.pass ? 'run-pass' : 'silent');
      return diff;
    };
    const installSave = (save: GameSave): void => {
      const puzzle = getPuzzle(save.puzzleId);
      backgroundSeconds = 0;
      set({
        save, puzzle, code: save.files[save.activeFile], activeFile: save.activeFile,
        hintLevel: progressFor(save, puzzle).hints, result: null, expected: null, inputs: {},
        queue: [], diff: null, traceIndex: 0, replayElapsed: 0, replayPaused: true,
        currentLine: null, event: null, progress: 0, activeTutorial: null, tutorialQueue: [],
      });
    };
    const rewardPatrons = (puzzle: Puzzle, count: number): void => {
      const save = get().save;
      persist({ ...save, resources: {
        ...save.resources, ink: save.resources.ink + count * puzzle.standingOrder.ink,
        oil: save.resources.oil + count * puzzle.standingOrder.oil, served: save.resources.served + count,
      } });
    };
    const runOrders = async (): Promise<void> => {
      if (!get().ready || get().busy || get().backgroundBusy || !get().save.standingOrders.some((order) => !order.paused)) return;
      const trips = orderTrips(backgroundSeconds, get().save.hatchlings);
      if (!trips) return;
      backgroundSeconds -= trips * ORDER_SECONDS / (1 + get().save.hatchlings);
      const ticket = ++epoch;
      set({ backgroundBusy: true });
      try {
        for (const order of [...get().save.standingOrders]) {
          if (order.paused) continue;
          const puzzle = getPuzzle(order.puzzleId);
          const count = Math.min(5, trips);
          let failed = false;
          for (let sample = 0; sample < count; sample++) {
            if (ticket !== epoch) return;
            const seed = (Math.floor(get().save.lastSavedAt / 1000) + sample + order.earned * 31 + puzzle.visibleSeed) >>> 0;
            const expected = await reference(puzzle, seed);
            if (ticket !== epoch) return;
            const result = await runtime.run(requestFor(puzzle, order.code, seed, get().save.orderFiles[order.puzzleId] ?? {}, expected.inputs));
            if (ticket !== epoch) return;
            const diff = check(result.delivered, expected.delivered, puzzle.checker);
            if (result.error) { diff.pass = false; diff.message = result.error.friendly || result.error.message; }
            if (result.error || !diff.pass) {
              const failure: QueueEntry = { name: 'Standing-order shelf', seed, inputs: result.inputs, status: 'failed', result, diff };
              persist({ ...get().save, standingOrders: get().save.standingOrders.map((entry) =>
                entry.puzzleId === order.puzzleId ? { ...entry, paused: true, failure } : entry) });
              set({ status: 'A standing order paused. Its failed shelf is ready to inspect.' });
              failed = true;
              break;
            }
          }
          if (!failed && ticket === epoch) {
            const save = get().save;
            persist({ ...save,
              resources: { ...save.resources,
                ink: save.resources.ink + trips * puzzle.standingOrder.ink,
                oil: save.resources.oil + trips * puzzle.standingOrder.oil, served: save.resources.served + trips },
              standingOrders: save.standingOrders.map((entry) => entry.puzzleId === order.puzzleId ?
                { ...entry, earned: entry.earned + trips * puzzle.standingOrder.ink } : entry),
            });
          }
        }
      } catch (error) {
        if (ticket === epoch) set({ status: `Standing orders paused for now: ${errorMessage(error)}` });
      } finally {
        if (ticket === epoch) set({ backgroundBusy: false });
      }
    };
    const initial = freshSave();
    return {
      screen: 'title', loading: 0, loadingMessage: 'Warming the reading lamp…', ready: false,
      save: initial, puzzle: puzzles[0], activeFile: 'main.py', code: initial.files['main.py'],
      inputs: {}, result: null, expected: null, queue: [], diff: null, busy: false, backgroundBusy: false,
      status: 'Welcome to the Returns Desk.', hintLevel: 0, traceIndex: 0, replayPaused: true,
      replayElapsed: 0, currentLine: null, event: null, progress: 0, activeSlot: 0,
      activeTutorial: null, tutorialQueue: [], activityPaused: false, captureMode: false,
      setActivityPaused(activityPaused) { set({ activityPaused }); },
      setCaptureMode(captureMode) { set({ captureMode }); },
      initialize() {
        if (initializing) return initializing;
        const generation = lifecycle;
        initializing = (async () => {
          let elapsed = 0;
          let notice = '';
          const loadTicket = epoch;
          try {
            const slot = await persistence.activeSlot();
            const loaded = await persistence.load(slot);
            if (generation !== lifecycle) return;
            if (loaded && loadTicket === epoch) {
              elapsed = offlineSeconds(loaded.save.lastSavedAt, Date.now());
              installSave(loaded.save);
              set({ activeSlot: slot });
              if (loaded.recovered) notice = 'A damaged save was recovered from the last good snapshot.';
            }
          } catch (error) { notice = errorMessage(error); }
          try {
            await runtime.init((loading, loadingMessage) => set({ loading: Math.max(0, Math.min(1, loading)), loadingMessage }));
            if (generation !== lifecycle) return;
            set({ ready: true, loading: 1, loadingMessage: 'The reading lamp is ready.' });
            await get().refreshExpected();
            if (generation !== lifecycle) return;
            if (notice) set({ status: notice });
            if (elapsed) get().stepClock(elapsed);
            let lastTick = Date.now();
            timer = setInterval(() => {
              const now = Date.now();
              const milliseconds = Math.max(0, now - lastTick);
              lastTick = now;
              if (!get().captureMode && get().screen === 'game' && !get().activityPaused && (typeof document === 'undefined' || !document.hidden)) {
                get().tickReplay(milliseconds);
                get().stepClock(milliseconds / 1000);
              }
            }, 100);
          } catch (error) {
            set({ ready: false, status: errorMessage(error), loadingMessage: 'The reading lamp could not start. Try loading again.' });
            initializing = undefined;
            throw error;
          }
        })();
        return initializing;
      },
      newGame(name) {
        stop();
        installSave({ ...freshSave(name), started: true });
        persist(get().save);
        set({ screen: 'intro', status: 'Mrs. Quill has left you the keys.' });
        tutorial('new-game');
        if (get().ready) void get().refreshExpected();
      },
      setScreen(screen) { set({ screen }); },
      setCode(code) {
        if (code.length > 100_000) { set({ status: 'This script exceeds the 100,000 character limit.' }); return; }
        const { save, puzzle, activeFile } = get();
        const progress = progressFor(save, puzzle);
        set({ code });
        persist({ ...save, files: { ...save.files, [activeFile]: code }, progress: {
          ...save.progress, [puzzle.id]: { ...progress, code: activeFile === 'main.py' ? code : progress.code },
        } });
      },
      setActiveFile(name) {
        if (!Object.hasOwn(get().save.files, name)) { set({ status: 'That script is not in this save.' }); return; }
        set({ activeFile: name, code: get().save.files[name] });
        persist({ ...get().save, activeFile: name });
      },
      addFile(name) {
        const save = get().save;
        const capacity = save.ownedItems.includes('script-slot') ? 8 : 2;
        if (!validFilename(name)) { set({ status: 'Use a Python module name such as helper.py, without a folder or library name.' }); return; }
        if (Object.hasOwn(save.files, name)) { get().setActiveFile(name); return; }
        if (Object.keys(save.files).length >= capacity) { set({ status: 'The writing desks are full. Another desk in the shop adds six script slots.' }); return; }
        persist({ ...save, activeFile: name, files: { ...save.files, [name]: '' } });
        set({ activeFile: name, code: '' });
        tutorial('add-file');
      },
      async refreshExpected() {
        if (!get().ready) return;
        const ticket = begin('Reading the request…');
        const puzzle = get().puzzle;
        try {
          const expected = await reference(puzzle, puzzle.visibleSeed, puzzle.visibleInputs);
          if (ticket !== epoch) return;
          set({ expected: expected.delivered, inputs: expected.inputs, status: 'The visible shelf is ready.' });
          tutorial('preview');
        } catch (error) { if (ticket === epoch) set({ status: errorMessage(error) }); }
        finally { if (ticket === epoch) { set({ busy: false }); void runOrders(); } }
      },
      async run() {
        if (!get().ready) { set({ status: 'Wait for the reading lamp to finish warming.' }); return; }
        const ticket = begin('Shelby is reading your script…');
        const { puzzle, code, save } = get();
        try {
          const expected = await reference(puzzle, puzzle.visibleSeed, puzzle.visibleInputs);
          if (ticket !== epoch) return;
          const result = await runtime.run(requestFor(puzzle, code, puzzle.visibleSeed, { ...save.files }, expected.inputs, save.settings.openStacks));
          if (ticket !== epoch) return;
          display(result, expected.delivered);
        } catch (error) { if (ticket === epoch) set({ status: errorMessage(error) }); }
        finally { if (ticket === epoch) { set({ busy: false }); void runOrders(); } }
      },
      async serveQueue() {
        if (!get().ready) { set({ status: 'Wait for the reading lamp to finish warming.' }); return; }
        const ticket = begin('The queue is taking its places…');
        const { puzzle, code, save } = get();
        const progress = progressFor(save, puzzle);
        persist({ ...save, progress: { ...save.progress, [puzzle.id]: { ...progress, attempts: progress.attempts + 1 } } });
        const queue = buildQueue(puzzle, puzzle.visibleSeed + progress.attempts);
        set({ queue });
        tutorial('run-pass');
        try {
          for (let index = 0; index < queue.length; index++) {
            if (ticket !== epoch) return;
            const entry = queue[index];
            set({ queue: get().queue.map((item, i) => i === index ? { ...item, status: 'running' } : item) });
            const expected = await reference(puzzle, entry.seed, entry.inputs);
            if (ticket !== epoch) return;
            const result = await runtime.run(requestFor(puzzle, code, entry.seed, { ...save.files }, expected.inputs, save.settings.openStacks));
            if (ticket !== epoch) return;
            const diff = display(result, expected.delivered);
            set({ queue: get().queue.map((item, i) => i === index ?
              { ...item, inputs: result.inputs, result, diff, status: diff.pass ? 'passed' : 'failed' } : item) });
            if (diff.pass) rewardPatrons(puzzle, 1);
            for (const hazard of puzzle.hazards) if (entry.name === hazard) tutorial(hazard);
          }
          if (get().queue.every((entry) => entry.status === 'passed')) {
            const current = get().save;
            const completed = completePuzzle(current, puzzle, progress.attempts === 0 && get().hintLevel === 0);
            persist({ ...current, ...completed, progress: {
              ...current.progress, [puzzle.id]: { ...progressFor(current, puzzle), solvedCode: code, solvedFiles: { ...save.files } },
            } });
            set({ status: 'Every patron is satisfied. The request is complete.' });
            tutorial('complete');
          } else {
            set({ status: 'Some patrons need another try. Select a failed shelf to inspect it.' });
          }
        } catch (error) {
          if (ticket === epoch) {
            set({ status: errorMessage(error), queue: get().queue.map((entry) => entry.status === 'running' ? { ...entry, status: 'waiting' } : entry) });
          }
        } finally { if (ticket === epoch) { set({ busy: false }); void runOrders(); } }
      },
      stop,
      gotoPuzzle(id) {
        let puzzle: Puzzle;
        try { puzzle = getPuzzle(id); } catch (error) { set({ status: errorMessage(error) }); return; }
        if (!canEnterPuzzle(get().save, puzzle) && !get().save.settings.openStacks) {
          set({ status: 'Complete the previous request to open this one.' }); return;
        }
        let save: GameSave;
        try { save = { ...get().save, ...enterWing(get().save, puzzle.chapter) }; }
        catch (error) { set({ status: errorMessage(error) }); return; }
        const chapterChanged = puzzle.chapter !== get().puzzle.chapter;
        stop();
        const code = progressFor(save, puzzle).code;
        installSave({ ...save, puzzleId: id, files: { ...save.files, 'main.py': code }, activeFile: 'main.py' });
        persist(get().save);
        set({ screen: 'game' });
        if (chapterChanged) tutorial('chapter');
        for (const hazard of puzzle.hazards) tutorial(hazard);
        if (get().ready) void get().refreshExpected();
      },
      nextPuzzle() {
        const next = puzzles[puzzles.findIndex((entry) => entry.id === get().puzzle.id) + 1];
        if (next) get().gotoPuzzle(next.id);
        else set({ status: 'The Returns Desk and first Stacks lessons are complete.' });
      },
      hint() {
        const { puzzle, save } = get();
        const level = Math.min(3, get().hintLevel + 1);
        set({ hintLevel: level, status: puzzle.hints[level - 1] });
        persist({ ...save, progress: { ...save.progress, [puzzle.id]: { ...progressFor(save, puzzle), hints: level } } });
        tutorial('hint');
      },
      setSettings(partial) {
        try { persist({ ...get().save, settings: readSettings({ ...get().save.settings, ...partial }) }); tutorial('settings'); }
        catch (error) { set({ status: errorMessage(error) }); }
      },
      setLayout(id, layout) {
        try { persist({ ...get().save, layouts: { ...get().save.layouts, [id]: readLayout(layout) } }); }
        catch (error) { set({ status: errorMessage(error) }); }
      },
      setReplay(index) {
        const result = get().result;
        if (!result || !Number.isFinite(index)) return;
        const next = Math.max(0, Math.min(result.trace.length - 1, Math.floor(index)));
        set({ ...replayFields(result, next, true), progress: result.trace.length ? next / result.trace.length : 0 });
      },
      setReplayPaused(replayPaused) { set({ replayPaused }); },
      setSpeed(speed) {
        if (!Number.isFinite(speed)) return;
        const maximum = get().save.ownedItems.includes('replay-speed') ? 8 : 2;
        get().setSettings({ replaySpeed: Math.min(maximum, Math.max(0.25, speed)) });
      },
      async loadSlot(slot) {
        stop();
        const ticket = epoch;
        try {
          const loaded = await persistence.load(slot);
          if (ticket !== epoch) return;
          if (!loaded) throw new Error('That slot is empty. Save here to start its ledger.');
          await persistence.select(slot);
          if (ticket !== epoch) return;
          const elapsed = offlineSeconds(loaded.save.lastSavedAt, Date.now());
          installSave(loaded.save);
          set({ activeSlot: slot, screen: 'game' });
          await get().refreshExpected();
          get().stepClock(elapsed);
          set({ status: loaded.recovered ? 'Recovered the last good snapshot from this slot.' : 'Save loaded.' });
          tutorial('save');
        } catch (error) { set({ status: errorMessage(error) }); throw error; }
      },
      async saveSlot(slot) {
        try {
          if (!Number.isInteger(slot) || slot < 0 || slot > 2) throw new Error('Choose save slot 1, 2, or 3.');
          const save = { ...get().save, lastSavedAt: Date.now() };
          set({ activeSlot: slot, save });
          await persistence.save(slot, save);
          set({ status: 'Saved locally.' });
          tutorial('save');
        } catch (error) { set({ status: errorMessage(error) }); throw error; }
      },
      exportSave() { tutorial('save'); return exportJSON(get().save); },
      async importSave(json) {
        try {
          const save = { ...importJSON(json), lastSavedAt: Date.now() };
          stop();
          await persistence.save(get().activeSlot, save);
          installSave(save);
          set({ screen: 'game', status: 'Save imported.' });
          await get().refreshExpected();
          tutorial('save');
        } catch (error) { set({ status: errorMessage(error) }); throw error; }
      },
      reset() {
        stop();
        installSave(freshSave());
        persist(get().save);
        set({ screen: 'title' });
        if (get().ready) void get().refreshExpected();
      },
      fileStandingOrder() {
        const { save, puzzle } = get();
        const { solvedCode, solvedFiles } = progressFor(save, puzzle);
        if (!save.completed.includes(puzzle.id) || solvedCode === undefined || !puzzle.standingOrder.eligible) {
          set({ status: 'Pass this request’s full queue before filing an order.' }); return;
        }
        const existing = save.standingOrders.find((order) => order.puzzleId === puzzle.id);
        const capacity = save.ownedItems.includes('standing-slot') ? 2 : 1;
        if (!existing && save.standingOrders.length >= capacity) { set({ status: 'The order pegs are full. A second peg is available in the shop.' }); return; }
        const order = { puzzleId: puzzle.id, code: solvedCode, earned: existing?.earned ?? 0, paused: false };
        persist({ ...save, orderFiles: { ...save.orderFiles, [puzzle.id]: solvedFiles ?? save.orderFiles[puzzle.id] ?? { 'main.py': solvedCode } }, standingOrders: existing ?
          save.standingOrders.map((entry) => entry.puzzleId === puzzle.id ? order : entry) : [...save.standingOrders, order] });
        set({ status: 'The checked script is filed as a standing order.' });
        tutorial('complete');
      },
      stepClock(seconds) {
        if (!Number.isFinite(seconds) || seconds <= 0 || !get().save.standingOrders.some((order) => !order.paused)) return;
        backgroundSeconds = Math.min(28800, backgroundSeconds + seconds);
        void runOrders();
      },
      markTutorial(id) {
        if (!getTutorial(id)) return;
        const save = get().save;
        if (!save.seenTutorials.includes(id)) persist({ ...save, seenTutorials: [...save.seenTutorials, id] });
        const queue = get().tutorialQueue.filter((entry) => entry !== id);
        set({ activeTutorial: get().activeTutorial === id ? queue.shift() ?? null : get().activeTutorial, tutorialQueue: queue });
      },
      purchase(id) {
        try {
          persist({ ...get().save, ...purchaseItem(get().save, id) });
          set({ status: 'The ledger is updated.' });
          tutorial(id === 'hatchling' ? 'hatch' : 'complete');
        } catch (error) { set({ status: errorMessage(error) }); }
      },
      async autoSolve() { get().setCode(get().puzzle.reference); await get().run(); },
      async playNaive() {
        const naive = get().puzzle.naive[0];
        if (naive) { get().setCode(naive.code); await get().run(); }
      },
      async replayQueue(index) {
        const entry = get().queue[index];
        if (!entry?.result) return;
        const ticket = begin('Inspecting this patron’s shelf…');
        try {
          const expected = await reference(get().puzzle, entry.seed, entry.inputs);
          if (ticket === epoch && entry.result) { display(entry.result, expected.delivered); set({ replayPaused: false }); }
        } catch (error) { if (ticket === epoch) set({ status: errorMessage(error) }); }
        finally { if (ticket === epoch) set({ busy: false }); }
      },
      async replayStandingOrder(puzzleId) {
        const failure = get().save.standingOrders.find((order) => order.puzzleId === puzzleId)?.failure;
        if (!failure?.result) return;
        get().gotoPuzzle(puzzleId);
        const ticket = begin('Inspecting the paused order…');
        try {
          const expected = await reference(getPuzzle(puzzleId), failure.seed, failure.inputs);
          if (ticket === epoch) { set({ queue: [failure] }); display(failure.result!, expected.delivered); }
        } catch (error) { if (ticket === epoch) set({ status: errorMessage(error) }); }
        finally { if (ticket === epoch) set({ busy: false }); }
      },
      setOrderPaused(puzzleId, paused) {
        persist({ ...get().save, standingOrders: get().save.standingOrders.map((order) => order.puzzleId === puzzleId ? { ...order, paused } : order) });
      },
      async scratch(code) {
        if (!get().ready) return null;
        const ticket = begin('Trying a note on the blotting paper…');
        const state = get();
        try {
          const expected = await reference(state.puzzle, state.puzzle.visibleSeed, state.puzzle.visibleInputs);
          if (ticket !== epoch) return null;
          const result = await runtime.run(requestFor(state.puzzle, code, state.puzzle.visibleSeed, state.save.files, expected.inputs, state.save.settings.openStacks));
          if (ticket !== epoch) return null;
          set({ status: result.error?.friendly ?? 'Scratch work finished. Your script is unchanged.' });
          tutorial('scratch');
          return result;
        } catch (error) { if (ticket === epoch) set({ status: errorMessage(error) }); return null; }
        finally { if (ticket === epoch) { set({ busy: false }); void runOrders(); } }
      },
      tickReplay(milliseconds) {
        const state = get();
        const trace = state.result?.trace ?? [];
        const next = advanceReplay(state, trace, milliseconds, state.save.settings.replaySpeed);
        if (next === state) return;
        set({ ...next, currentLine: currentLine(next, trace), event: trace[next.traceIndex] ?? null, progress: replayProgress(next, trace) });
      },
      stepReplay() { get().setReplay(get().traceIndex + 1); },
      skipReplay() {
        const trace = get().result?.trace ?? [];
        if (!trace.length) return;
        get().setReplay(trace.length - 1);
        set({ replayElapsed: eventDuration(trace[trace.length - 1]), progress: 1 });
      },
      replay() { get().setReplay(0); set({ replayPaused: false }); },
      triggerTutorial: tutorial,
      replayTutorial(id) { if (getTutorial(id)) set({ activeTutorial: id }); },
      dismissTutorial() { const id = get().activeTutorial; if (id) get().markTutorial(id); },
      waitForIdle() {
        if (!get().busy && !get().backgroundBusy) return Promise.resolve();
        return new Promise<void>((resolve) => {
          const interval = setInterval(() => {
            if (!get().busy && !get().backgroundBusy) { clearInterval(interval); resolve(); }
          }, 10);
        });
      },
      disposeGame() {
        lifecycle++;
        stop();
        if (timer) clearInterval(timer);
        timer = undefined;
        initializing = undefined;
        runtime.dispose();
        set({ ready: false });
      },
    };
  });
}
