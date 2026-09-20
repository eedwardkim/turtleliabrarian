import { describe, expect, it } from 'vitest';
import { DEMO_PUZZLE_IDS, acceptedAnswers, codeSatisfies, demoSteps, describeInputs, filledLine } from '../../content/tutorials/demo';
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

  it('keeps the guided demo interactive and waits for each player action', () => {
    const steps = demoSteps(demoPuzzles);
    expect(steps).toHaveLength(9);
    expect(steps.filter((step) => step.action).map((step) => `${step.action}:${step.puzzleId ?? ''}`)).toEqual([
      'goto:p0-01-stamp', 'next:',
    ]);
    expect(steps[2].waitFor).toEqual({ kind: 'code', accepted: acceptedAnswers(demoPuzzles[0]) });
    expect(steps[2].ghost).toBe('days * rate');
    expect(steps[2].line).toBe('fee = days * rate');
    expect(steps[3].waitFor).toEqual({ kind: 'run-pass' });
    expect(steps[4].waitFor).toEqual({ kind: 'serve-pass' });
    expect(steps[5].waitFor).toEqual({ kind: 'scratch-pass', accepted: ['with_columns'] });
    expect(steps[6].waitFor).toEqual({ kind: 'scratch-pass', accepted: ['sort('] });
    expect(steps[7].waitFor).toEqual({ kind: 'scratch-pass', accepted: ['are.below(100)'] });
    expect(acceptedAnswers(demoPuzzles[0])).toEqual(['days * rate', 'rate * days']);
    expect(codeSatisfies('fee = days*rate\ndeliver(fee)', acceptedAnswers(demoPuzzles[0]))).toBe(true);
    expect(codeSatisfies('fee = ___', acceptedAnswers(demoPuzzles[0]))).toBe(false);
    expect(codeSatisfies("shelf = Table().with_columns('a', make_array(1))", ['with_columns'])).toBe(true);
  });

  it('carries a ghost and a preset through the scratch steps', () => {
    const steps = demoSteps(demoPuzzles);
    for (const index of [5, 6, 7]) {
      expect(steps[index].target).toBe('scratch');
      expect(steps[index].ghost).toBeTruthy();
      expect(steps[index].scratch?.code).toContain('___');
      expect(filledLine(steps[index])).toBe(steps[index].scratch!.code.replace('___', steps[index].ghost!));
      expect(filledLine(steps[index])).not.toContain('___');
    }
    expect(steps[5].scratch?.key).toBe('shelf');
    expect(steps[6].scratch?.key).toBe('sort');
    expect(steps[7].scratch?.key).toBe('thin');
    expect(steps[6].ghost).toBe("'pages'");
    expect(steps[7].ghost).toBe('are.below(100)');
    expect(filledLine(steps[6])).toContain("by_pages = shelf.sort('pages')");
    expect(filledLine(steps[7])).toContain("thin = shelf.where('pages', are.below(100))");
    expect(filledLine(steps[2])).toBe('fee = days * rate');
    expect(filledLine(steps[0])).toBeNull();
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
