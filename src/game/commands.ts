import { almanac } from '../../content/almanac';
import type { Puzzle, SaveData } from '../contracts';
import { puzzles } from './catalog';

export function commandTutorialId(id: string): string {
  return `command:${id}`;
}

export function explainedCommands(save: SaveData): string[] {
  const lessons = puzzles.filter(puzzle => puzzle.lesson && save.completed.includes(puzzle.id));
  return almanac.filter(entry =>
    save.seenTutorials.includes(commandTutorialId(entry.id))
    || lessons.some(lesson => lesson.reference.includes(`${entry.id}(`)),
  ).map(entry => entry.id);
}

export function pendingCommands(puzzle: Puzzle, save: SaveData) {
  if (puzzle.lesson) return [];
  const explained = explainedCommands(save);
  return [...new Set([...puzzle.requiredApi, ...puzzle.unlocks])]
    .flatMap(id => almanac.filter(entry => entry.id === id && !explained.includes(id)));
}
