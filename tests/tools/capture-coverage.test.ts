import { describe, expect, it } from 'vitest';
import { assertCoverage, coverageGaps } from '../../scripts/capture-coverage.mjs';

function manifest(overrides: Record<string, unknown> = {}) {
  return {
    tour: 'V03', frames: 900, durationSeconds: 30,
    captions: [{ frame: 0, caption: 'Chapter 3' }],
    screenshots: [
      { category: 'puzzle', id: 'ch3-show-1' },
      { category: 'tutorial', id: 'group' },
      { category: 'failure', id: 'ch3-break-1' },
      { category: 'window', id: 'atlas' },
    ],
    coverage: {
      chapters: [3],
      puzzles: [{ id: 'ch3-show-1', kind: 'show' }],
      tutorials: ['group'],
      windows: ['atlas'],
      failures: [{ id: 'ch3-break-1', failed: 2, total: 7 }],
      wings: [{ id: 'wing-3', starsSpent: 6 }],
      standingOrders: ['ch3-show-1'],
    },
    ...overrides,
  };
}

const requirement = {
  chapters: [3], puzzles: ['ch3-show-1'], kinds: ['show'], minTutorials: 1, minWings: 1,
  minFailures: 1, minStandingOrders: 1, windows: ['atlas'], screenshots: { puzzle: 1, tutorial: 1 },
};

describe('capture coverage', () => {
  it('passes a manifest that really covers the tour', () => {
    expect(coverageGaps(manifest(), requirement)).toEqual([]);
    expect(assertCoverage(manifest(), requirement).tour).toBe('V03');
  });

  it('fails a skipped chapter, request, tutorial, wing, failure or standing order', () => {
    const empty = { chapters: [], puzzles: [], tutorials: [], windows: [], failures: [], wings: [], standingOrders: [] };
    const gaps = coverageGaps(manifest({ coverage: empty, screenshots: [] }), requirement);
    expect(gaps).toEqual(expect.arrayContaining([
      expect.stringContaining('chapters never reached: 3'),
      expect.stringContaining('requests never solved through the real queue: ch3-show-1'),
      expect.stringContaining('no show request was played'),
      expect.stringContaining('tutorials were shown'),
      expect.stringContaining('windows or dialogs never opened: atlas'),
      expect.stringContaining('recorded queue failures'),
      expect.stringContaining('wings opened'),
      expect.stringContaining('standing orders filed'),
      expect.stringContaining('puzzle screenshots'),
    ]));
  });

  it('fails when a covered request, tutorial or failure has no screenshot', () => {
    const gaps = coverageGaps(manifest({
      screenshots: [{ category: 'puzzle', id: 'ch3-show-1' }, { category: 'tutorial', id: 'group' }, { category: 'window', id: 'atlas' }],
    }), requirement);
    expect(gaps).toContain('no screenshot for failure ch3-break-1');
  });

  it('fails an empty capture and an over-long speedrun', () => {
    expect(coverageGaps(manifest({ frames: 0, captions: [] }), {})).toEqual([
      'no captions were burned into the frames', 'no frames were captured',
    ]);
    expect(coverageGaps(manifest({ durationSeconds: 540 }), { maxDurationSeconds: 480 }))
      .toContain('the video runs 540s, longer than the 480s budget');
  });

  it('names the tour when it throws', () => {
    expect(() => assertCoverage(manifest({ coverage: { chapters: [] } }), requirement)).toThrow(/^V03 coverage is incomplete/);
  });
});
