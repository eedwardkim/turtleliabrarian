import type { Puzzle } from '../../src/contracts';

export type DemoAction = 'goto' | 'next';
export type DemoWait = { kind: 'code'; accepted: string[] } | { kind: 'run-pass' } | { kind: 'serve-pass' }
  | { kind: 'scratch-pass'; accepted: string[] };

export interface DemoStep {
  title: string;
  body: string;
  target: string;
  action?: DemoAction;
  puzzleId?: string;
  waitFor?: DemoWait;
  line?: string;
  /** Grey suggestion offered in place of a `___` blank in the editor or scratch pad. */
  ghost?: string;
  /** Code loaded into the scratch pad when this step opens; `key` identifies the preset. */
  scratch?: { key: string; code: string };
  /** Show the slip's inputs and the answer they produce beneath the step. */
  showsAnswer?: boolean;
}

/** The request the guided demo plays through. */
export const DEMO_PUZZLE_IDS: readonly string[] = ['p0-01-stamp'];

/** Popup tutorials whose lesson the demo already teaches; they are marked seen when it ends. */
export const DEMO_COVERED_TUTORIALS: readonly string[] = ['request', 'run', 'output', 'queue', 'resources', 'scratch'];

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

/** The full code a step asks the player to type, with blanks filled by the ghost. */
export function filledLine(step: DemoStep): string | null {
  if (step.line) return step.line;
  if (step.scratch && step.ghost) return step.scratch.code.replace('___', step.ghost);
  return null;
}

const SHELF = "Table().with_columns('title', make_array('Moss Almanac', 'Cloud Atlas', 'Fern Letters'), 'pages', make_array(80, 120, 64))";

export function demoSteps(puzzles: readonly Puzzle[]): DemoStep[] {
  const puzzle = puzzles[0];
  if (!puzzle) return [];
  return [
    {
      title: 'Welcome to the desk',
      body: 'Shelby the librarian does whatever your Python says. This tour is one request, then a trip to the Stacks. Nothing here can break.',
      target: 'request',
    },
    {
      title: 'A slip arrives',
      body: `${puzzle.patron}’s slip is on the request window. Two numbers are already in Python for you: ${describeInputs(puzzle)}. Your job is one line of code.`,
      target: 'request', action: 'goto', puzzleId: puzzle.id,
    },
    {
      title: 'Fill in the blank',
      body: `In the script window the grey text is the answer. Press Tab (or click it) to accept it, or type ${demoAnswer(puzzle)} yourself.`,
      target: 'editor', waitFor: { kind: 'code', accepted: acceptedAnswers(puzzle) },
      ghost: demoAnswer(puzzle), line: firstLine(puzzle.reference), puzzleId: puzzle.id,
    },
    {
      title: 'Run it and watch',
      body: 'Press Run (▶ or Cmd/Ctrl+Enter). Watch the room: Shelby walks to the fee stamp to work out the numbers, then carries the fee to the patron. Output shows the same number.',
      target: 'output', waitFor: { kind: 'run-pass' }, line: firstLine(puzzle.reference), puzzleId: puzzle.id, showsAnswer: true,
    },
    {
      title: 'Serve the queue',
      body: `${puzzle.queueSize} patrons, same script, different numbers. Press Serve queue and Shelby runs your line for each of them.`,
      target: 'queue', waitFor: { kind: 'serve-pass' }, puzzleId: puzzle.id,
    },
    {
      title: 'Off to the Stacks',
      body: 'Requests aren’t the only thing code does. The blotting paper is a terminal: any Python you run there happens right away, and Shelby acts it out. The grey text is ready — press Tab to accept, then Run.',
      target: 'scratch', scratch: { key: 'shelf', code: 'shelf = ___\nshelf' }, ghost: SHELF,
      waitFor: { kind: 'scratch-pass', accepted: ['with_columns'] }, puzzleId: puzzle.id,
    },
    {
      title: 'Sort the shelf',
      body: 'Shelby wheeled a cart to the Stacks and stamped three books. Now order them: accept the grey text and Run — watch the books reshuffle.',
      target: 'scratch', scratch: { key: 'sort', code: `shelf = ${SHELF}\nby_pages = shelf.sort(___)\nby_pages` }, ghost: "'pages'",
      waitFor: { kind: 'scratch-pass', accepted: ['sort('] }, puzzleId: puzzle.id,
    },
    {
      title: 'Keep only the thin ones',
      body: 'One more: where() sifts a table. Accept, Run, and watch the sieve keep the books under 100 pages.',
      target: 'scratch', scratch: { key: 'thin', code: `shelf = ${SHELF}\nthin = shelf.where('pages', ___)\nthin` }, ghost: 'are.below(100)',
      waitFor: { kind: 'scratch-pass', accepted: ['are.below(100)'] }, puzzleId: puzzle.id,
    },
    {
      title: 'Your turn',
      body: 'That’s the whole game: read a slip, write Python, Run, watch Shelby. The next slip is waiting.',
      target: 'request', action: 'next',
    },
  ];
}
