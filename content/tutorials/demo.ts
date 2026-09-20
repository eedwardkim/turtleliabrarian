import type { Puzzle } from '../../src/contracts';

export type DemoAction = 'goto' | 'next';
export type DemoWait = { kind: 'code'; accepted: string[] } | { kind: 'run-pass' };

export interface DemoStep {
  title: string;
  body: string;
  target: string;
  action?: DemoAction;
  puzzleId?: string;
  waitFor?: DemoWait;
  line?: string;
  /** Grey suggestion offered in place of a `___` blank in the editor. */
  ghost?: string;
  /** Green payoff line shown once the step's wait is satisfied. */
  done?: string;
}

/** The request the guided demo plays through. */
export const DEMO_PUZZLE_IDS: readonly string[] = ['p0-01-stamp'];

/** Popup tutorials whose lesson the demo already teaches; they are marked seen when it ends. */
export const DEMO_COVERED_TUTORIALS: readonly string[] = ['request', 'run', 'output'];

function scalar(value: unknown): string {
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) return String(value);
  return '…';
}

/** `days = 3, rate = 2` for the shelf the player sees. */
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

/** The text that belongs in the starter's `___` blank, read off the reference line. */
export function blankAnswer(starter: string, reference: string): string | null {
  const line = starter.split('\n').find((candidate) => candidate.includes('___'));
  if (!line) return null;
  const blank = line.indexOf('___');
  const prefix = line.slice(0, blank);
  const suffix = line.slice(blank + 3);
  const match = reference.split('\n').find((candidate) =>
    candidate.startsWith(prefix) && candidate.endsWith(suffix) && candidate.length > prefix.length + suffix.length);
  return match ? match.slice(prefix.length, match.length - suffix.length) : null;
}

export function demoSteps(puzzles: readonly Puzzle[]): DemoStep[] {
  const puzzle = puzzles[0];
  const puzzleId = puzzle?.id;
  const ghost = puzzle ? blankAnswer(puzzle.starter, puzzle.reference) ?? '3' : '3';
  return [
    {
      title: 'Welcome',
      body: 'Shelby only does what your Python says. The grey text is the answer. Press Tab to accept it.',
      target: 'editor', waitFor: { kind: 'code', accepted: [ghost] }, ghost, puzzleId,
      done: 'The blank is filled.',
    },
    {
      title: 'Run it',
      body: 'Press Run. Watch Shelby carry the answer to the desk.',
      target: 'run', waitFor: { kind: 'run-pass' }, puzzleId,
      done: 'Shelby delivered 3. That was your Python running.',
    },
    {
      title: 'That is the whole game',
      body: 'Read the slip, fill the blank, press Run. Press Next request when you are ready.',
      target: 'request',
    },
  ];
}
