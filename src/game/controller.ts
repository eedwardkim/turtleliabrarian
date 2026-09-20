import { create } from 'zustand';
import type {
  CheckDiff, Puzzle, QueueEntry, RunRequest, RunResult, SandboxNotebook, Settings, TraceEvent, Value, WindowLayout,
} from '../contracts';
import { getTutorial, tutorialsFor } from '../../content/tutorials';
import { puzzles, getPuzzle } from './catalog';
import { automaticTutorial } from './guidance';
import { commandTutorialId, pendingCommands } from './commands';
import { check } from './checker';
import {
  ARCHIVE_CHAPTER, canEnterPuzzle, completePuzzle, enterWing, equipHat, firstTryBonus, inkFor, maxReplaySpeed, offlineSeconds,
  OFFLINE_CAP_SECONDS, orderCapacity, orderTrips, purchaseItem, scriptCapacity, shareTrips, spendOil, tripSeconds, wingUnlocked,
} from './economy';
import { buildQueue, requestFor } from './queue';
import { advanceReplay, currentLine, eventDuration, replayProgress } from './replay';
import { isSandboxDataset, sandboxRequest, sandboxUnlocked } from './sandbox';
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
  showMove(): void;
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
  acknowledgeCommand(id: string): void;
  purchase(id: string): void;
  equipHat(id: string): void;
  autoSolve(): Promise<void>;
  playNaive(): Promise<void>;
  refreshExpected(): Promise<void>;
  replayQueue(index: number): Promise<void>;
  replayStandingOrder(puzzleId: string): Promise<void>;
  setOrderPaused(puzzleId: string, paused: boolean): void;
  scratch(code: string): Promise<RunResult | null>;
  setSandbox(notebook: Partial<SandboxNotebook>): void;
  runSandbox(code?: string): Promise<RunResult | null>;
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

const CHART_API = new Set(['hist', 'barh', 'scatter', 'plot']);

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

  return create<GameState>((set, get, store) => {
    const persist = (save: GameSave): void => {
      const next = { ...save, lastSavedAt: Date.now() };
      set({ save: next });
      void persistence.save(get().activeSlot, next).catch((error: unknown) => {
        set({ status: `Autosave could not write: ${errorMessage(error)} Export a copy before leaving.` });
      });
    };
    const tutorial = (trigger: string): void => {
      const state = get();
      if (state.activeTutorial) return;
      const id = automaticTutorial(trigger, state.puzzle, state.save.seenTutorials);
      if (id === 'replay' && !state.result?.trace.length) return;
      if (id) set({ activeTutorial: id, tutorialQueue: [] });
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
    const finish = (puzzle: Puzzle, code: string, files: Record<string, string>, status: string): void => {
      const save = get().save;
      const completed = completePuzzle(save, puzzle, firstTryBonus(save, progressFor(save, puzzle).attempts, get().hintLevel));
      persist({ ...save, ...completed, progress: {
        ...save.progress, [puzzle.id]: { ...progressFor(save, puzzle), solvedCode: code, solvedFiles: { ...files } },
      } });
      set({ status });
      tutorial('complete');
    };
    const display = (result: RunResult, expected: Value): CheckDiff => {
      const diff = check(result.delivered, expected, get().puzzle.checker);
      if (result.error) { diff.pass = false; diff.message = result.error.friendly || result.error.message; }
      set({ ...replayFields(result), expected, inputs: result.inputs, diff, status: diff.message });
      if (!diff.pass && get().hintLevel === 0 && get().puzzle.chapter <= 1) get().hint();
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
        ...save.resources, ink: save.resources.ink + inkFor(save, puzzle.standingOrder.ink, count),
        oil: save.resources.oil + count * puzzle.standingOrder.oil, served: save.resources.served + count,
      } });
    };
    const runOrders = async (): Promise<void> => {
      if (!get().ready || get().busy || get().backgroundBusy || !get().save.standingOrders.some((order) => !order.paused)) return;
      const trips = orderTrips(backgroundSeconds, get().save.hatchlings, get().save.hat);
      if (!trips) return;
      backgroundSeconds -= tripSeconds(trips, get().save.hatchlings, get().save.hat);
      const ticket = ++epoch;
      set({ backgroundBusy: true });
      try {
        const active = get().save.standingOrders.filter((order) => !order.paused);
        const shares = shareTrips(trips, active.length);
        for (const [index, order] of active.entries()) {
          const earnedTrips = shares[index];
          if (!earnedTrips) continue;
          const puzzle = getPuzzle(order.puzzleId);
          const count = Math.min(5, earnedTrips);
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
                ink: save.resources.ink + inkFor(save, puzzle.standingOrder.ink, earnedTrips),
                oil: save.resources.oil + earnedTrips * puzzle.standingOrder.oil, served: save.resources.served + earnedTrips },
              standingOrders: save.standingOrders.map((entry) => entry.puzzleId === order.puzzleId ?
                { ...entry, earned: entry.earned + earnedTrips * puzzle.standingOrder.ink } : entry),
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
        const capacity = scriptCapacity(save);
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
          const diff = display(result, expected.delivered);
          if (puzzle.lesson && diff.pass && !get().save.completed.includes(puzzle.id)) {
            const progress = progressFor(get().save, puzzle);
            persist({ ...get().save, progress: { ...get().save.progress, [puzzle.id]: { ...progress, attempts: progress.attempts + 1 } } });
            finish(puzzle, code, get().save.files, 'Delivered. Shelby stamped it: request complete.');
          }
        } catch (error) { if (ticket === epoch) set({ status: errorMessage(error) }); }
        finally { if (ticket === epoch) { set({ busy: false }); void runOrders(); } }
      },
      async serveQueue() {
        if (!get().ready) { set({ status: 'Wait for the reading lamp to finish warming.' }); return; }
        const ticket = begin('The queue is taking its places…');
        const { puzzle, code, save } = get();
        const progress = progressFor(save, puzzle);
        const { save: charged, lent } = spendOil(save, puzzle);
        persist({ ...charged, progress: { ...charged.progress, [puzzle.id]: { ...progress, attempts: progress.attempts + 1 } } });
        if (lent) set({ status: 'The archive lends you lamp oil for this sampling trip.' });
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
            finish(puzzle, code, save.files, 'Every patron is satisfied. The request is complete.');
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
        const current = get().save;
        try {
          save = current.settings.openStacks && !wingUnlocked(current, puzzle.chapter)
            ? { ...current, ownedItems: puzzle.chapter > 0 ? [...current.ownedItems, `wing-${puzzle.chapter}`] : current.ownedItems }
            : { ...current, ...enterWing(current, puzzle.chapter) };
        } catch (error) { set({ status: errorMessage(error) }); return; }
        const chapterChanged = puzzle.chapter !== get().puzzle.chapter;
        stop();
        const code = progressFor(save, puzzle).code;
        installSave({ ...save, puzzleId: id, files: { ...save.files, 'main.py': code }, activeFile: 'main.py' });
        persist(get().save);
        set({ screen: 'game' });
        tutorial('puzzle');
        if (chapterChanged) tutorial('chapter');
        if (puzzle.chapter >= ARCHIVE_CHAPTER) tutorial('archive');
        if (puzzle.kind === 'capstone') tutorial('capstone');
        if (puzzle.requiredApi.some((api) => CHART_API.has(api))) tutorial('chart');
        for (const topic of [...puzzle.concepts, ...puzzle.hazards]) tutorial(topic);
        if (get().ready) void get().refreshExpected();
      },
      nextPuzzle() {
        const next = puzzles[puzzles.findIndex((entry) => entry.id === get().puzzle.id) + 1];
        if (next) { get().gotoPuzzle(next.id); return; }
        set({ status: 'Every request in the library is answered. The Grand Reopening is yours to enjoy.' });
        if (puzzles.every((entry) => get().save.completed.includes(entry.id))) set({ screen: 'credits' });
      },
      hint() {
        const { puzzle, save } = get();
        const level = Math.min(3, get().hintLevel + 1);
        set({ hintLevel: level, status: puzzle.hints[level - 1] });
        persist({ ...save, progress: { ...save.progress, [puzzle.id]: { ...progressFor(save, puzzle), hints: level } } });
        tutorial('hint');
      },
      showMove() {
        const { puzzle, save } = get();
        set({ hintLevel: 3, status: 'The next line is on the slip.' });
        persist({ ...save, progress: { ...save.progress, [puzzle.id]: { ...progressFor(save, puzzle), hints: 3 } } });
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
        const maximum = maxReplaySpeed(get().save);
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
          if (elapsed > 60) tutorial('offline');
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
        const capacity = orderCapacity(save);
        if (!existing && save.standingOrders.length >= capacity) { set({ status: 'The order pegs are full. Another peg is available in the shop.' }); return; }
        const order = { puzzleId: puzzle.id, code: solvedCode, earned: existing?.earned ?? 0, paused: false };
        persist({ ...save, orderFiles: { ...save.orderFiles, [puzzle.id]: solvedFiles ?? save.orderFiles[puzzle.id] ?? { 'main.py': solvedCode } }, standingOrders: existing ?
          save.standingOrders.map((entry) => entry.puzzleId === puzzle.id ? order : entry) : [...save.standingOrders, order] });
        set({ status: 'The checked script is filed as a standing order.' });
        tutorial('complete');
      },
      stepClock(seconds) {
        if (!Number.isFinite(seconds) || seconds <= 0 || !get().save.standingOrders.some((order) => !order.paused)) return;
        backgroundSeconds = Math.min(OFFLINE_CAP_SECONDS, backgroundSeconds + seconds);
        void runOrders();
      },
      markTutorial(id) {
        if (!getTutorial(id)) return;
        const save = get().save;
        if (!save.seenTutorials.includes(id)) persist({ ...save, seenTutorials: [...save.seenTutorials, id] });
        set({ activeTutorial: get().activeTutorial === id ? null : get().activeTutorial, tutorialQueue: [] });
      },
      acknowledgeCommand(id) {
        const { puzzle, save } = get();
        const entry = pendingCommands(puzzle, save)[0];
        if (!entry || entry.id !== id) return;
        const commands = [entry.id, ...(entry.comparison ? [entry.comparison.id] : [])];
        persist({ ...save, seenTutorials: [...new Set([...save.seenTutorials, 'almanac', ...commands.map(commandTutorialId)])] });
        set({ activeTutorial: null, tutorialQueue: [] });
      },
      purchase(id) {
        try {
          persist({ ...get().save, ...purchaseItem(get().save, id) });
          set({ status: 'The ledger is updated.' });
          tutorial(id === 'hatchling' ? 'hatch' : 'shop');
        } catch (error) { set({ status: errorMessage(error) }); }
      },
      equipHat(id) {
        try {
          const next = equipHat(get().save, id);
          persist({ ...get().save, ...next });
          set({ status: next.hat ? 'Shelby tries on the new hat.' : 'Shelby hangs the hat back on its peg.' });
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
      setSandbox(partial) {
        const save = get().save;
        if (!sandboxUnlocked(save)) return;
        const sandbox = { ...save.sandbox, ...partial };
        if (sandbox.code.length > 100_000 || !isSandboxDataset(sandbox.dataset)) {
          set({ status: 'Choose a library dataset and keep the notebook under 100,000 characters.' });
          return;
        }
        persist({ ...save, sandbox });
      },
      async runSandbox(code) {
        if (!get().ready || get().busy || !sandboxUnlocked(get().save)) return null;
        const ticket = begin('Exploring Open Stacks…');
        const { save } = get();
        try {
          const result = await runtime.run(sandboxRequest({ ...save.sandbox, code: code ?? save.sandbox.code }, save.files));
          if (ticket !== epoch) return null;
          set({ ...replayFields(result), inputs: result.inputs, diff: null, status: result.error?.friendly ?? 'Notebook finished. There are no grades in Open Stacks.' });
          return result;
        } catch (error) {
          if (ticket === epoch) set({ status: errorMessage(error) });
          return null;
        } finally {
          if (ticket === epoch) { set({ busy: false }); void runOrders(); }
        }
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
      triggerTutorial(trigger) {
        const state = get();
        if (state.puzzle.lesson || state.activeTutorial) return;
        const entry = tutorialsFor(trigger, state.save.seenTutorials)[0];
        if (entry) set({ activeTutorial: entry.id, tutorialQueue: [] });
      },
      replayTutorial(id) { if (getTutorial(id)) set({ activeTutorial: id, tutorialQueue: [] }); },
      dismissTutorial() { const id = get().activeTutorial; if (id) get().markTutorial(id); },
      waitForIdle() {
        if (!get().busy && !get().backgroundBusy) return Promise.resolve();
        return new Promise<void>((resolve) => {
          const unsubscribe = store.subscribe((state) => {
            if (!state.busy && !state.backgroundBusy) { unsubscribe(); resolve(); }
          });
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
