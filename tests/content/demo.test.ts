import { describe, expect, it } from 'vitest';
import { DEMO_PUZZLE_IDS, acceptedAnswers, codeSatisfies, demoSteps, describeInputs } from '../../content/tutorials/demo';
import { authoredPuzzles, shelvedRequestIds, withoutShelved } from '../../src/game/catalog';

describe('guided demo', () => {
  const demoPuzzles = DEMO_PUZZLE_IDS.map((id) => authoredPuzzles.find((puzzle) => puzzle.id === id)!);

  it('describes visible inputs without exposing compound values', () => {
    expect(describeInputs({ ...demoPuzzles[0], visibleInputs: { days: 2, rate: 2 } })).toBe('days = 2, rate = 2');
    expect(describeInputs({ ...demoPuzzles[0], visibleInputs: { prefix: 'Fern-' } })).toBe('prefix = "Fern-"');
    expect(describeInputs({ ...demoPuzzles[0], visibleInputs: undefined })).toBe('');
    expect(describeInputs({ ...demoPuzzles[0], visibleInputs: { shelf: { kind: 'table', labels: ['title'], rows: [['Book']], totalRows: 1 } } })).toBe('shelf = …');
  });

  it('walks through two deterministic prologue requests that are never shelved', () => {
    expect(demoPuzzles.every(Boolean)).toBe(true);
    expect(demoPuzzles.every((puzzle) => puzzle.chapter === 0 && !puzzle.stochastic)).toBe(true);
    expect(DEMO_PUZZLE_IDS.some((id) => shelvedRequestIds.has(id))).toBe(false);
  });

  it('keeps the guided demo interactive and waits for each player action', () => {
    const steps = demoSteps(demoPuzzles);
    expect(steps).toHaveLength(14);
    expect(steps.filter((step) => step.action).map((step) => `${step.action}:${step.puzzleId ?? ''}`)).toEqual([
      'goto:p0-01-stamp', 'goto:p0-02-shares', 'next:',
    ]);
    expect(steps[3].waitFor).toEqual({ kind: 'code', accepted: acceptedAnswers(demoPuzzles[0]) });
    expect(steps[4].waitFor).toEqual({ kind: 'run-pass' });
    expect(steps[5].waitFor).toEqual({ kind: 'serve-pass' });
    expect(steps[9].waitFor).toEqual({ kind: 'code', accepted: acceptedAnswers(demoPuzzles[1]) });
    expect(steps[10].waitFor).toEqual({ kind: 'run-pass' });
    expect(steps[11].waitFor).toEqual({ kind: 'serve-pass' });
    expect(acceptedAnswers(demoPuzzles[0])).toEqual(['days * rate', 'rate * days']);
    expect(acceptedAnswers(demoPuzzles[1])).toEqual(['weight / readers']);
    expect(codeSatisfies('fee = days*rate\ndeliver(fee)', acceptedAnswers(demoPuzzles[0]))).toBe(true);
    expect(codeSatisfies('fee = ___', acceptedAnswers(demoPuzzles[0]))).toBe(false);
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
