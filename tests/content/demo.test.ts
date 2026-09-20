import { describe, expect, it } from 'vitest';
import { DEMO_PUZZLE_IDS, applyMove, blankAnswer, codeSatisfies, demoSteps, describeInputs, nextMove } from '../../content/tutorials/demo';
import { authoredPuzzles, shelvedRequestIds, withoutShelved } from '../../src/game/catalog';

describe('guided demo', () => {
  const demoPuzzles = DEMO_PUZZLE_IDS.map((id) => authoredPuzzles.find((puzzle) => puzzle.id === id)!);

  it('describes visible inputs without exposing compound values', () => {
    expect(describeInputs({ ...demoPuzzles[0], visibleInputs: { days: 2, rate: 2 } })).toBe('days = 2, rate = 2');
    expect(describeInputs({ ...demoPuzzles[0], visibleInputs: { prefix: 'Fern-' } })).toBe('prefix = "Fern-"');
    expect(describeInputs({ ...demoPuzzles[0], visibleInputs: undefined })).toBe('');
    expect(describeInputs({ ...demoPuzzles[0], visibleInputs: { shelf: { kind: 'table', labels: ['title'], rows: [['Book']], totalRows: 1 } } })).toBe('shelf = …');
  });

  it('walks through one deterministic prologue request that is never shelved', () => {
    expect(DEMO_PUZZLE_IDS).toEqual(['p0-01-stamp']);
    expect(demoPuzzles.every(Boolean)).toBe(true);
    expect(demoPuzzles.every((puzzle) => puzzle.chapter === 0 && !puzzle.stochastic)).toBe(true);
    expect(DEMO_PUZZLE_IDS.some((id) => shelvedRequestIds.has(id))).toBe(false);
  });

  it('is three steps: accept the ghost, run, done', () => {
    const steps = demoSteps(demoPuzzles);
    expect(steps).toHaveLength(3);
    expect(steps[0].waitFor).toEqual({ kind: 'code', accepted: ['3'] });
    expect(steps[0].ghost).toBe('3');
    expect(steps[0].target).toBe('editor');
    expect(steps[0].done).toBe('The blank is filled.');
    expect(steps[1].waitFor).toEqual({ kind: 'run-pass' });
    expect(steps[1].line).toBe('deliver(3)');
    expect(steps[1].done).toBe('Shelby delivered 3. That was your Python running.');
    expect(steps[2].waitFor).toBeUndefined();
    expect(steps[2].done).toBeUndefined();
    expect(steps[2].target).toBe('request');
    expect(codeSatisfies('deliver(3)', ['3'])).toBe(true);
    expect(codeSatisfies('deliver(___)', ['3'])).toBe(false);
  });
});

describe('blankAnswer', () => {
  it('reads the ghost off a single-line reference', () => {
    expect(blankAnswer('deliver(___)', 'deliver(3)')).toBe('3');
  });
  it('matches the line by prefix and suffix in multi-line code', () => {
    expect(blankAnswer('badge = prefix + ___\ndeliver(badge)', 'badge = prefix + str(number)\ndeliver(badge)')).toBe('str(number)');
    expect(blankAnswer('share = ___\ndeliver(share)', 'share = weight / readers\ndeliver(share)')).toBe('weight / readers');
  });
  it('returns null when no reference line fits the blank', () => {
    expect(blankAnswer('deliver(___)', 'fee = days * rate')).toBeNull();
    expect(blankAnswer('deliver(x)', 'deliver(3)')).toBeNull();
  });
});

describe('nextMove', () => {
  const reference = 'fees = days * 2\ndeliver(fees)';
  it('finds the first reference line missing from the code', () => {
    expect(nextMove('deliver(days)', reference)).toEqual({ index: 0, line: 'fees = days * 2' });
    expect(nextMove(applyMove(reference, 0), reference)).toEqual({ index: 1, line: 'deliver(fees)' });
    expect(nextMove(applyMove(reference, 1), reference)).toBeNull();
  });
  it('solves a lesson blank in one move', () => {
    expect(nextMove('deliver(___)', 'deliver(3)')).toEqual({ index: 0, line: 'deliver(3)' });
  });
  it('matches on trimmed lines and skips blanks and comments', () => {
    expect(nextMove('  deliver(3)', 'deliver(3)')).toBeNull();
    expect(nextMove('', '# note\n\ndeliver(3)')).toEqual({ index: 2, line: 'deliver(3)' });
  });
});

describe('shelved requests', () => {
  it('keeps the eleven uncalibrated stochastic requests authored but off the shelves', () => {
    expect([...shelvedRequestIds].sort()).toEqual([
      'capstone-4', 'ch6-break-1', 'ch6-vary-1', 'ch6-vary-2', 'ch7-break-1', 'ch7-show-2', 'ch7-vary-1',
      'ch8-break-1', 'ch8-break-2', 'ch8-show-2', 'ch8-vary-1',
    ]);
    expect(authoredPuzzles).toHaveLength(79);
    expect(withoutShelved(authoredPuzzles)).toHaveLength(68);
    expect(withoutShelved(authoredPuzzles).every((puzzle) => !shelvedRequestIds.has(puzzle.id))).toBe(true);
  });
});
