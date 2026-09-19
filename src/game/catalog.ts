import type { Puzzle } from '../contracts';
import { parsePuzzle } from './validation';

const modules = import.meta.glob<unknown>('../../content/puzzles/*.json', { eager: true, import: 'default' });

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

export const puzzles: Puzzle[] = discover();

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
