import type { Puzzle } from '../contracts';
import calibration from '../../content/calibration/stochastic-tolerances.json';
import { parsePuzzle } from './validation';

const modules = import.meta.glob<unknown>('../../content/puzzles/*.json', { eager: true, import: 'default' });

/**
 * Stochastic requests whose Monte Carlo spread means an independently seeded
 * correct answer can be rejected. They stay authored and validated, but are kept
 * off the shelves in the shipped game until their grading is calibrated; the
 * test catalog still sees the full release so the content gates keep counting.
 */
export const shelvedRequestIds: ReadonlySet<string> = new Set(
  calibration.results.filter((result) => !result.independentAcceptanceAttainable).map((result) => result.id),
);

export const shelvingEnabled = import.meta.env.MODE !== 'test' && import.meta.env.VITE_SHELVE_UNCALIBRATED !== 'false';

export function withoutShelved(all: Puzzle[]): Puzzle[] {
  return all.filter((puzzle) => !shelvedRequestIds.has(puzzle.id));
}

const kindOrder: Record<Puzzle['kind'], number> = { show: 0, vary: 1, break: 2, capstone: 3 };

function sequence(id: string): number {
  const digits = id.match(/\d+/g);
  return digits ? Number(digits[digits.length - 1]) : 0;
}

function shelfOrder(puzzle: Puzzle): [number, number, number] {
  return [puzzle.kind === 'capstone' ? Number.MAX_SAFE_INTEGER : puzzle.chapter, kindOrder[puzzle.kind], sequence(puzzle.id)];
}

function byShelfOrder(left: Puzzle, right: Puzzle): number {
  const a = shelfOrder(left);
  const b = shelfOrder(right);
  for (let index = 0; index < a.length; index++) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return left.id.localeCompare(right.id);
}

function discover(): Puzzle[] {
  const found = Object.keys(modules).sort().map((path) => parsePuzzle(modules[path]));
  if (!found.length) throw new Error('No request files were found in content/puzzles.');
  const seen = new Set<string>();
  for (const puzzle of found) {
    if (seen.has(puzzle.id)) throw new Error(`Duplicate request id: ${puzzle.id}`);
    seen.add(puzzle.id);
  }
  return found.sort(byShelfOrder);
}

export const authoredPuzzles: Puzzle[] = discover();

export const puzzles: Puzzle[] = shelvingEnabled ? withoutShelved(authoredPuzzles) : authoredPuzzles;

export function getPuzzle(id: string): Puzzle {
  const puzzle = puzzles.find((entry) => entry.id === id);
  if (!puzzle) throw new Error(`Unknown request: ${id}`);
  return puzzle;
}

export function chapters(): number[] {
  return [...new Set(puzzles.map((puzzle) => puzzle.chapter))].sort((a, b) => a - b);
}

export function chapterPuzzles(chapter: number): Puzzle[] {
  return puzzles.filter((puzzle) => puzzle.chapter === chapter);
}
