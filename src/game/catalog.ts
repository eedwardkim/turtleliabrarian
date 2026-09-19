import type { Puzzle } from '../contracts';
import stamp from '../../content/puzzles/p0-01-stamp.json';
import shares from '../../content/puzzles/p0-02-shares.json';
import badge from '../../content/puzzles/p0-03-badge.json';
import budget from '../../content/puzzles/p0-04-budget.json';
import arrays from '../../content/puzzles/ch1-show-1.json';
import range from '../../content/puzzles/ch1-show-2.json';
import index from '../../content/puzzles/ch1-vary-1.json';
import mean from '../../content/puzzles/ch1-vary-2.json';
import mismatch from '../../content/puzzles/ch1-break-1.json';
import strings from '../../content/puzzles/ch1-break-2.json';
import select from '../../content/puzzles/ch2-show-1.json';
import where from '../../content/puzzles/ch2-show-2.json';
import { parsePuzzle } from './validation';

export const puzzles: Puzzle[] = [
  stamp, shares, badge, budget, arrays, range, index, mean, mismatch, strings, select, where,
].map(parsePuzzle);

export function getPuzzle(id: string): Puzzle {
  const puzzle = puzzles.find((entry) => entry.id === id);
  if (!puzzle) throw new Error(`Unknown request: ${id}`);
  return puzzle;
}
