import type { Puzzle } from '../../src/contracts';

export type DemoAction = 'goto' | 'next';
export type DemoWait = { kind: 'code'; accepted: string[] } | { kind: 'run-pass' } | { kind: 'serve-pass' };

export interface DemoStep {
  title: string;
  body: string;
  target: string;
  action?: DemoAction;
  puzzleId?: string;
  waitFor?: DemoWait;
  line?: string;
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

export function firstLine(code: string): string {
  return code.split('\n')[0];
}

export function demoAnswer(puzzle: Puzzle): string {
  const line = firstLine(puzzle.reference);
  return line.slice(line.indexOf('=') + 1).trim();
}

export function acceptedAnswers(puzzle: Puzzle): string[] {
  const answer = demoAnswer(puzzle);
  const match = answer.match(/^(\w+)\s*([*+])\s*(\w+)$/);
  if (!match) return [answer];
  const swapped = `${match[3]} ${match[2]} ${match[1]}`;
  return [answer, swapped];
}

export function codeSatisfies(code: string, accepted: string[]): boolean {
  const compact = code.replace(/\s/g, '');
  return !compact.includes('___') && accepted.some(answer => compact.includes(answer.replace(/\s/g, '')));
}

export function demoSteps(puzzles: readonly Puzzle[]): DemoStep[] {
  const steps: DemoStep[] = [{
    title: 'Welcome to the reading room',
    body: 'Patrons bring requests, and you answer them with a line or two of Python. Let’s do the first two together: you type, I’ll point.',
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
        body: `Your task: ${puzzle.objective} Under “Already in Python” you’ll see ${describeInputs(puzzle)}. Those names already hold those values, so you never type the numbers yourself.`,
        target: 'request',
      },
      {
        title: 'Fill in the blank',
        body: `In the script window, click on ___ and replace it with ${demoAnswer(puzzle)}, so the line reads “${firstLine(puzzle.reference)}”. The last line, deliver(…), hands the result to ${puzzle.patron}.`,
        target: 'editor', waitFor: { kind: 'code', accepted: acceptedAnswers(puzzle) }, line: firstLine(puzzle.reference), puzzleId: puzzle.id,
      },
      {
        title: 'Run it',
        body: 'Press Run (the play button in the script window, or Cmd/Ctrl + Enter). Then look at Output: “Delivered to the patron” should show the number below.',
        target: 'output', waitFor: { kind: 'run-pass' }, line: firstLine(puzzle.reference), puzzleId: puzzle.id, showsAnswer: true,
      },
      {
        title: 'Serve the queue',
        body: `Now press Serve Queue. ${puzzle.queueSize} patrons bring different values; your script runs for each one and must pass them all.`,
        target: 'queue', waitFor: { kind: 'serve-pass' }, puzzleId: puzzle.id,
      },
      {
        title: 'Request complete',
        body: 'Every patron is satisfied: you earned Ink and a Gold Star. The next slip is already on the desk.',
        target: 'resources',
      },
    );
  });
  steps.push({
    title: 'Your turn at the desk',
    body: 'From here the requests are yours. Stuck? “A small hint” on the slip says what to compute, then which Python tool, then the line with one blank. You can replay this walkthrough from Help.',
    target: 'request', action: 'next',
  });
  return steps;
}
