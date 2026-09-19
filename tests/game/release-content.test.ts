import { describe, expect, it } from 'vitest';
import { tutorials, tutorialsFor, getTutorial } from '../../content/tutorials/index';
import { almanac } from '../../content/almanac/index';
import { puzzles } from '../../src/game/catalog';

const uiTriggers = [
  'new-game', 'output', 'preview', 'run', 'run-pass', 'loud', 'silent', 'complete', 'hint', 'scratch',
  'add-file', 'chapter', 'save', 'settings', 'shop', 'hatch', 'archive', 'capstone', 'chart', 'offline',
];

describe('release tutorial coverage', () => {
  it('fires every tutorial exactly once from a trigger the controller raises', () => {
    const hazardTriggers = [...new Set(tutorials.map((entry) => entry.trigger))].filter((trigger) => !uiTriggers.includes(trigger));
    const seen: string[] = [];
    for (const trigger of [...uiTriggers, ...hazardTriggers]) {
      seen.push(...tutorialsFor(trigger, seen).map((entry) => entry.id));
      expect(tutorialsFor(trigger, seen)).toEqual([]);
    }
    expect(new Set(seen)).toEqual(new Set(tutorials.map((entry) => entry.id)));
    expect(new Set(tutorials.map((entry) => entry.id)).size).toBe(tutorials.length);
  });
  it('keeps every tutorial replayable, targeted and written', () => {
    for (const entry of tutorials) {
      expect(getTutorial(entry.id)).toBe(entry);
      expect(entry.target.length).toBeGreaterThan(0);
      expect(entry.steps.length).toBeGreaterThan(0);
      expect(entry.steps.every((step) => step.length > 20)).toBe(true);
    }
  });
  it('raises every tutorial from a trigger the shipped campaign actually reaches', () => {
    const raised = new Set(uiTriggers);
    for (const puzzle of puzzles) for (const topic of [...puzzle.concepts, ...puzzle.hazards]) raised.add(topic);
    for (const entry of tutorials) expect(raised).toContain(entry.trigger);
  });
  it('ships the full campaign in curriculum order', () => {
    expect(puzzles).toHaveLength(77);
    expect(new Set(puzzles.map((puzzle) => puzzle.id)).size).toBe(77);
    const kinds = ['show', 'vary', 'break'] as const;
    for (let chapter = 1; chapter <= 12; chapter++) {
      const shelves = puzzles.filter((puzzle) => puzzle.chapter === chapter && puzzle.kind !== 'capstone');
      for (const kind of kinds) expect(shelves.filter((puzzle) => puzzle.kind === kind)).toHaveLength(2);
    }
    expect(puzzles.filter((puzzle) => puzzle.chapter === 0)).toHaveLength(4);
    expect(puzzles.filter((puzzle) => puzzle.kind === 'capstone')).toHaveLength(1);
    const rank = (index: number): [number, number] => [
      puzzles[index].kind === 'capstone' ? Number.MAX_SAFE_INTEGER : puzzles[index].chapter,
      ['show', 'vary', 'break', 'capstone'].indexOf(puzzles[index].kind),
    ];
    for (let index = 1; index < puzzles.length; index++) {
      const [chapter, kind] = rank(index - 1);
      const [nextChapter, nextKind] = rank(index);
      expect(chapter < nextChapter || (chapter === nextChapter && kind <= nextKind)).toBe(true);
    }
  });
  it('documents every API the curriculum teaches or requires', () => {
    const ids = new Set(almanac.map((entry) => entry.id));
    for (const puzzle of puzzles) {
      for (const api of [...puzzle.learnedApi, ...puzzle.requiredApi, ...puzzle.unlocks]) expect(ids).toContain(api);
    }
    expect(almanac.every((entry) => entry.signature && entry.explanation && entry.example && entry.output && entry.pitfalls.length)).toBe(true);
  });
});
