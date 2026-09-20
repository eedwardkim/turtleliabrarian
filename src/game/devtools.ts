import { puzzles } from './catalog';
import { useGame } from './store';
import { tutorials } from '../../content/tutorials';
import type { Resources, Settings } from '../contracts';

/** Read-only catalogue rows the capture tours use to plan and assert coverage. */
export interface PuzzleSummary {
  id: string;
  chapter: number;
  kind: string;
  title: string;
  standingOrder: boolean;
  completed: boolean;
}

export interface TutorialSummary {
  id: string;
  title: string;
  trigger: string;
  seen: boolean;
  active: boolean;
}

export const devEnabled = new URLSearchParams(location.search).get('dev') === '1';
let solving = false;

export async function unlockAll(): Promise<void> {
  const game = useGame.getState();
  const save = { ...game.save, started: true, ownedItems: [...new Set([...game.save.ownedItems, ...puzzles.map(puzzle => `wing-${puzzle.chapter}`)])],
    settings: { ...game.save.settings, openStacks: true } };
  await game.importSave(JSON.stringify(save));
}

/**
 * The counterpart of `unlockAll`: it closes every wing from `chapter` onwards and
 * turns Open Stacks off, so a capture can walk the real economy path — completing
 * the previous request and paying the wing's Gold Stars — instead of arriving on a
 * developer grant. It removes grants only; completions and results are untouched.
 */
export async function lockWingsFrom(chapter: number): Promise<void> {
  if (!Number.isInteger(chapter) || chapter < 1) throw new Error('Wings are locked from chapter 1 onwards.');
  const game = useGame.getState();
  const closed = new Set(puzzles.filter(puzzle => puzzle.chapter >= chapter).map(puzzle => `wing-${puzzle.chapter}`));
  await game.importSave(JSON.stringify({
    ...game.save,
    ownedItems: game.save.ownedItems.filter(item => !closed.has(item)),
    settings: { ...game.save.settings, openStacks: false },
  }));
}

export async function gotoPuzzle(id: string): Promise<void> {
  await unlockAll();
  useGame.getState().gotoPuzzle(id);
  await useGame.getState().waitForIdle();
}

export async function typeCode(code: string): Promise<void> {
  const game = useGame.getState();
  game.setActiveFile('main.py');
  game.setCode('');
  for (let end = 0; end < code.length; end += 4) {
    game.setCode(code.slice(0, end + 4));
    await new Promise(resolve => setTimeout(resolve, 18));
  }
}

export async function solve(ids = [useGame.getState().puzzle.id]): Promise<void> {
  if (solving) return;
  solving = true;
  try {
    for (const id of ids) {
      await gotoPuzzle(id);
      await typeCode(useGame.getState().puzzle.reference);
      await useGame.getState().run();
      await useGame.getState().serveQueue();
      if (useGame.getState().queue.some(entry => entry.status !== 'passed')) break;
    }
  } finally { solving = false; }
}

export async function setResource(resource: keyof Resources, value: number): Promise<void> {
  if (!Number.isFinite(value) || value < 0) throw new Error('Resources must be finite and non-negative.');
  const game = useGame.getState();
  await game.importSave(JSON.stringify({ ...game.save, resources: { ...game.save.resources, [resource]: value } }));
}

export function listPuzzles(): PuzzleSummary[] {
  const completed = useGame.getState().save.completed;
  return puzzles.map(puzzle => ({
    id: puzzle.id, chapter: puzzle.chapter, kind: puzzle.kind, title: puzzle.title,
    standingOrder: puzzle.standingOrder.eligible, completed: completed.includes(puzzle.id),
  }));
}

export function listTutorials(): TutorialSummary[] {
  const { save, activeTutorial } = useGame.getState();
  return tutorials.map(tutorial => ({
    id: tutorial.id, title: tutorial.title, trigger: tutorial.trigger,
    seen: save.seenTutorials.includes(tutorial.id), active: activeTutorial === tutorial.id,
  }));
}

export const shelfApi = {
  getState: useGame.getState,
  gotoPuzzle,
  getPuzzles: listPuzzles,
  getTutorials: listTutorials,
  setResource,
  unlockAll,
  lockWingsFrom,
  setSettings: (partial: Partial<Settings>) => useGame.getState().setSettings(partial),
  playNaive: () => useGame.getState().playNaive(),
  setCode: (code: string) => useGame.getState().setCode(code),
  run: () => useGame.getState().run(),
  serveQueue: () => useGame.getState().serveQueue(),
  waitForIdle: () => useGame.getState().waitForIdle(),
  getTrace: () => useGame.getState().result?.trace ?? [],
  setSpeed: (replaySpeed: number) => useGame.getState().setSettings({ replaySpeed }),
  setCaptureMode: (enabled: boolean) => useGame.getState().setCaptureMode(enabled),
  startTour: async (name: string) => {
    if (name === 'full-campaign') return solve(puzzles.map(puzzle => puzzle.id));
    if (name === 'first-10-minutes') return solve(puzzles.filter(puzzle => puzzle.chapter < 2).map(puzzle => puzzle.id));
    const chapter = /^chapter-(\d+)$/.exec(name);
    if (!chapter) throw new Error(`Unknown tour: ${name}`);
    return solve(puzzles.filter(puzzle => puzzle.chapter === Number(chapter[1])).map(puzzle => puzzle.id));
  },
  stepClock: (seconds: number) => {
    useGame.getState().stepClock(seconds);
    useGame.getState().tickReplay(seconds * 1000);
  },
};

declare global {
  interface Window { __SHELF__?: typeof shelfApi }
}

export async function initializeDevtools(): Promise<void> {
  if (!devEnabled) return;
  window.__SHELF__ = shelfApi;
  const query = new URLSearchParams(location.search);
  shelfApi.setCaptureMode(query.get('capture') === '1');
  await useGame.getState().initialize();
  const puzzle = query.get('puzzle');
  if (puzzle && puzzles.some(entry => entry.id === puzzle)) await gotoPuzzle(puzzle);
  const speed = Number(query.get('speed'));
  if (speed >= 0.25 && speed <= 50) shelfApi.setSpeed(speed);
  if (query.get('autosolve') === '1') await solve();
  const tour = query.get('tour');
  if (tour) await shelfApi.startTour(tour);
}
