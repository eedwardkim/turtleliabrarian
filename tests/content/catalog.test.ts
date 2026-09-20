import { describe, expect, it } from 'vitest';
import { puzzles } from '../../src/game/catalog';
import { buildQueue } from '../../src/game/queue';
import { almanac, visibleAlmanac } from '../../content/almanac';
import { tutorials, tutorialsFor } from '../../content/tutorials';
import { parsePuzzle } from '../../src/game/validation';

describe('authored campaign content', () => {
  it('contains the exact progression and individual validated metadata', () => {
    expect(puzzles).toHaveLength(79);
    expect(puzzles.filter((puzzle) => puzzle.chapter === 0)).toHaveLength(5);
    for (const kind of ['show', 'vary', 'break']) expect(puzzles.filter((puzzle) => puzzle.chapter === 1 && puzzle.kind === kind)).toHaveLength(kind === 'show' ? 3 : 2);
    expect(puzzles.filter((puzzle) => puzzle.chapter === 2 && puzzle.kind === 'show')).toHaveLength(2);
    expect(new Set(puzzles.map((puzzle) => puzzle.id)).size).toBe(79);
    const learned = new Set<string>();
    for (const puzzle of puzzles) {
      expect(parsePuzzle(puzzle)).toBe(puzzle);
      puzzle.learnedApi.forEach((api) => learned.add(api));
      expect(puzzle.requiredApi.every((api) => learned.has(api))).toBe(true);
      expect(puzzle.hints).toHaveLength(3);
      expect(puzzle.hints.every((hint) => puzzle.lesson || !hint.includes(puzzle.reference))).toBe(true);
      expect(puzzle.starter).not.toBe(puzzle.reference);
      expect(puzzle.fixtures.every((fixture) => fixture.predicate.length > 5)).toBe(true);
      expect(puzzle.naive.every((naive) => puzzle.fixtures.some((fixture) => fixture.name === naive.hazard))).toBe(true);
    }
  });
  it('includes the specified prologue and array counterexamples', () => {
    const hazards = puzzles.flatMap((puzzle) => puzzle.hazards);
    expect(hazards).toEqual(expect.arrayContaining(['lands_on_last', 'short_tray', 'length_mismatch', 'mixed_strings']));
  });
  it('mixes every curated shelf with deterministic seeded shelves', () => {
    for (const puzzle of puzzles) {
      const first = buildQueue(puzzle, 811);
      expect(first).toEqual(buildQueue(puzzle, 811));
      expect(first).not.toEqual(buildQueue(puzzle, 812));
      expect(first).toHaveLength(puzzle.queueSize);
      expect(first.some((entry) => !entry.inputs)).toBe(true);
      for (const fixture of puzzle.fixtures) expect(first.find((entry) => entry.name === fixture.name)?.inputs).toEqual(fixture.inputs);
    }
  });
  it('documents each taught API and every unlocked entry', () => {
    const ids = almanac.map((entry) => entry.id);
    for (const puzzle of puzzles) {
      for (const api of puzzle.learnedApi) expect(ids).toContain(api);
      for (const unlock of puzzle.unlocks) expect(ids).toContain(unlock);
    }
    expect(almanac.every((entry) => entry.signature && entry.explanation && entry.example && entry.output && entry.pitfalls.length)).toBe(true);
    expect(visibleAlmanac(['make_array'], [])[0].pitfalls).toEqual([]);
    expect(visibleAlmanac(['make_array'], ['ch1-break-2'])[0].pitfalls.length).toBeGreaterThan(0);
  });
  it('gives every tutorial a reachable trigger and first-time filtering', () => {
    const campaignTriggers = [
      'new-game', 'output', 'preview', 'run', 'run-pass', 'loud', 'silent', 'complete', 'hint', 'scratch',
      'add-file', 'chapter', 'save', 'settings', 'shop', 'hatch', 'archive', 'capstone', 'chart', 'offline',
      ...puzzles.flatMap((puzzle) => [...puzzle.hazards, ...puzzle.concepts]),
    ];
    const seen: string[] = [];
    for (const trigger of campaignTriggers) {
      const fired = tutorialsFor(trigger, seen);
      seen.push(...fired.map((entry) => entry.id));
      expect(tutorialsFor(trigger, seen)).toEqual([]);
    }
    expect(new Set(seen)).toEqual(new Set(tutorials.map((entry) => entry.id)));
    expect(tutorials.every((entry) => entry.steps.length > 0 && entry.target)).toBe(true);
  });
});
