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
  it('documents every API the curriculum teaches or requires', () => {
    const ids = new Set(almanac.map((entry) => entry.id));
    for (const puzzle of puzzles) {
      for (const api of [...puzzle.learnedApi, ...puzzle.requiredApi, ...puzzle.unlocks]) expect(ids).toContain(api);
    }
    expect(almanac.every((entry) => entry.signature && entry.explanation && entry.example && entry.output && entry.pitfalls.length)).toBe(true);
  });
});
