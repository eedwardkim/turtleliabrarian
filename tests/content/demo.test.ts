import { describe, expect, it } from 'vitest';
import { DEMO_PUZZLE_IDS, demoSteps } from '../../content/tutorials/demo';
import { authoredPuzzles, shelvedRequestIds, withoutShelved } from '../../src/game/catalog';

describe('guided demo', () => {
  const demoPuzzles = DEMO_PUZZLE_IDS.map((id) => authoredPuzzles.find((puzzle) => puzzle.id === id)!);

  it('walks through two deterministic prologue requests that are never shelved', () => {
    expect(demoPuzzles.every(Boolean)).toBe(true);
    expect(demoPuzzles.every((puzzle) => puzzle.chapter === 0 && !puzzle.stochastic)).toBe(true);
    expect(DEMO_PUZZLE_IDS.some((id) => shelvedRequestIds.has(id))).toBe(false);
  });

  it('runs and serves each request in order', () => {
    const steps = demoSteps(demoPuzzles);
    const actions = steps.filter((step) => step.action).map((step) => `${step.action}:${step.puzzleId ?? ''}`);
    expect(actions).toEqual([
      'goto:p0-01-stamp', 'solve:p0-01-stamp', 'run:p0-01-stamp', 'serve:p0-01-stamp',
      'goto:p0-02-shares', 'solve:p0-02-shares', 'run:p0-02-shares', 'serve:p0-02-shares',
      'next:',
    ]);
    expect(steps.find((step) => step.action === 'solve')?.code).toBe(demoPuzzles[0].reference);
  });
});

describe('shelved requests', () => {
  it('keeps the eleven uncalibrated stochastic requests authored but off the shelves', () => {
    expect([...shelvedRequestIds].sort()).toEqual([
      'capstone-4', 'ch6-break-1', 'ch6-vary-1', 'ch6-vary-2', 'ch7-break-1', 'ch7-show-2', 'ch7-vary-1',
      'ch8-break-1', 'ch8-break-2', 'ch8-show-2', 'ch8-vary-1',
    ]);
    expect(authoredPuzzles).toHaveLength(77);
    expect(withoutShelved(authoredPuzzles)).toHaveLength(66);
    expect(withoutShelved(authoredPuzzles).every((puzzle) => !shelvedRequestIds.has(puzzle.id))).toBe(true);
  });
});
