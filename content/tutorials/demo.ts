import type { Puzzle } from '../../src/contracts';

export type DemoAction = 'goto' | 'solve' | 'run' | 'serve' | 'next';

export interface DemoStep {
  title: string;
  body: string;
  target: string;
  /** Performed when the step opens; the tour waits for the library to settle before moving on. */
  action?: DemoAction;
  puzzleId?: string;
  code?: string;
  /** Show the slip's inputs and the answer they produce beneath the step. */
  showsAnswer?: boolean;
}

/** The requests the guided demo plays through, in order. */
export const DEMO_PUZZLE_IDS: readonly string[] = ['p0-01-stamp', 'p0-02-shares'];

/** Popup tutorials whose lesson the demo already teaches; they are marked seen when it ends. */
export const DEMO_COVERED_TUTORIALS: readonly string[] = ['request', 'run', 'output', 'queue', 'resources'];

function scalar(value: unknown): string {
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) return String(value);
  return '…';
}

/** `days = 2, rate = 2` for the shelf the player sees. */
export function describeInputs(puzzle: Puzzle): string {
  return Object.entries(puzzle.visibleInputs ?? {})
    .map(([name, value]) => `${name} = ${scalar(value)}`)
    .join(', ');
}

function firstLine(code: string): string {
  return code.split('\n')[0];
}

export function demoSteps(puzzles: readonly Puzzle[]): DemoStep[] {
  const steps: DemoStep[] = [{
    title: 'Welcome to the reading room',
    body: 'Patrons bring requests, Shelby answers them in Python, and the library acts the answer out. Watch her handle two before you take the desk.',
    target: 'request',
  }];
  puzzles.forEach((puzzle, index) => {
    steps.push(
      {
        title: index === 0 ? 'A patron arrives' : 'Another slip on the desk',
        body: `${puzzle.patron}: “${puzzle.request}”`,
        target: 'request', action: 'goto', puzzleId: puzzle.id,
      },
      {
        title: 'Read the slip',
        body: `${puzzle.objective} Look under “Already in Python”: this shelf gives Shelby ${describeInputs(puzzle)}. Those names already hold those numbers, so she never types the numbers herself.`,
        target: 'request',
      },
      {
        title: 'Shelby writes the script',
        body: `Two lines. “${firstLine(puzzle.reference)}” combines the slip’s names and gives the result a name of its own. “deliver(…)” hands that result to ${puzzle.patron}.`,
        target: 'editor', action: 'solve', puzzleId: puzzle.id, code: puzzle.reference, showsAnswer: true,
      },
      {
        title: 'Run it',
        body: 'Run tries the script on this shelf. Watch Shelby carry the books, then check the receipt in Output: the delivered value should be the number below.',
        target: 'output', action: 'run', puzzleId: puzzle.id, showsAnswer: true,
      },
      {
        title: 'Serve the queue',
        body: `Serve Queue runs the same script for ${puzzle.queueSize} patrons with different shelves. Every one must pass, and a failed patron keeps its shelf for inspection.`,
        target: 'queue', action: 'serve', puzzleId: puzzle.id,
      },
      {
        title: 'Request complete',
        body: 'Every patron is satisfied. Served patrons earn Ink, a finished request earns Gold Stars, and the next slip is already on the desk.',
        target: 'resources',
      },
    );
  });
  steps.push({
    title: 'Your turn at the desk',
    body: 'From here the requests are yours. Hints grow from a nudge to a skeleton, the Almanac keeps every learned tool, and this demo can be replayed from Help.',
    target: 'request', action: 'next',
  });
  return steps;
}
