import type { Puzzle } from '../contracts';
import { puzzles } from './catalog';

export type Tool = 'queue' | 'almanac' | 'scratch' | 'replay' | 'scripts';

function needsTool(puzzle: Puzzle, tool: Tool): boolean {
  if (puzzle.lesson) return false;
  switch (tool) {
    case 'queue': return true;
    case 'almanac': return puzzle.requiredApi.some(api => api !== 'deliver');
    case 'scratch': return puzzle.requiredApi.some(api => ['where', 'sort', 'group', 'pivot', 'join', 'sample'].includes(api));
    case 'replay': return puzzle.kind === 'break';
    case 'scripts': return puzzle.concepts.includes('functions') || puzzle.kind === 'capstone';
  }
}

export function canReveal(puzzle: Puzzle, completed: string[], tool: Tool): boolean {
  if (puzzle.lesson) return false;
  return (tool !== 'queue' && needsTool(puzzle, tool))
    || puzzles.some(previous => completed.includes(previous.id) && needsTool(previous, tool));
}

export function automaticTutorial(trigger: string, puzzle: Puzzle, seen: string[]): string | null {
  if (puzzle.lesson) return null;
  let id: string | null = null;
  if (trigger === 'run-pass') id = 'queue';
  if (trigger === 'run' && needsTool(puzzle, 'replay')) id = 'replay';
  if (trigger === 'puzzle') {
    if (needsTool(puzzle, 'almanac') && !seen.includes('almanac')) id = 'almanac';
    else if (needsTool(puzzle, 'scratch')) id = 'scratch';
  }
  return id && !seen.includes(id) ? id : null;
}
