import { describe, expect, it } from 'vitest';
import type { TraceEvent } from '../../src/contracts';
import { BIN_LIMIT, DRAWER_LIMIT, POINT_LIMIT, THREAD_LIMIT } from '../../src/scene/director';
import { binPosition, chartPosition, chartSpan, drawerPosition, LOST_FOUND, PRESS, SPOOL,
  stagedBookPosition, stagingFor, TRAPDOOR, type Staging } from '../../src/scene/staging';

const event = (type: string, payload: Record<string, unknown>, seq = 1): TraceEvent => ({
  version: 1, seq, type, line: 1, inputs: ['t1'], output: 'r1',
  payload: payload as TraceEvent['payload'],
});

const groupEvent = event('Table.group', {
  labels: ['year'], bucketCount: 3,
  buckets: [
    { key: [1990], indices: [0, 3] },
    { key: [1991], indices: [1] },
    { key: [1992], indices: [2, 4, 5] },
  ],
});
const pivotEvent = event('Table.pivot', {
  columnLabel: 'genre', rowLabels: ['year'],
  rowKeys: [[1990, 1991]], columnKeys: ['fiction', 'poetry'],
  cells: [{ row: 0, column: 0, indices: [0, 1] }, { row: 1, column: 1, indices: [2] }],
});
const joinEvent = event('Table.join', {
  leftIndices: [0, 0, 2], rightIndices: [5, 6, 7], matchedPairCount: 3,
  unmatchedLeftIndices: [1], unmatchedRightIndices: [8, 9],
});
const sampleEvent = event('Table.sample', { indices: [2, 2, 4], withReplacement: true });
const histEvent = event('Table.hist', {
  x: [0, 10, 20], y: [3, 7, 1], labels: ['0-10', '10-20', '20-30'],
  axes: { x: 'price', y: 'Count' },
});

describe('operation staging reads the real trace payload', () => {
  it('turns group buckets into labelled bins and a per-row bin assignment', () => {
    const staging = stagingFor(groupEvent);
    expect(staging.kind).toBe('bins');
    if (staging.kind !== 'bins') throw new Error('unreachable');
    expect(staging.bins).toEqual([
      { key: '1990', count: 2 }, { key: '1991', count: 1 }, { key: '1992', count: 3 },
    ]);
    expect(staging.total).toBe(3);
    // rows 0 and 3 share the first bin; row 2 lands in the third.
    expect(staging.assignment[0]).toBe(0);
    expect(staging.assignment[3]).toBe(0);
    expect(staging.assignment[2]).toBe(2);
    expect(staging.label).toContain('by year');
  });

  it('keeps empty pivot combinations visible as zero-count drawers', () => {
    const staging = stagingFor(pivotEvent);
    expect(staging.kind).toBe('drawers');
    if (staging.kind !== 'drawers') throw new Error('unreachable');
    expect(staging.drawers).toEqual([
      { row: '1990', column: 'fiction', count: 2 },
      { row: '1990', column: 'poetry', count: 0 },
      { row: '1991', column: 'fiction', count: 0 },
      { row: '1991', column: 'poetry', count: 1 },
    ]);
    expect(staging.rows).toBe(2);
    expect(staging.columns).toBe(2);
  });

  it('counts copied and unmatched rows for a join', () => {
    const staging = stagingFor(joinEvent);
    if (staging.kind !== 'join') throw new Error('expected join staging');
    expect(staging.matched).toBe(3);
    expect(staging.copies).toBe(1);
    expect(staging.unmatched).toBe(3);
    expect(staging.threads).toEqual([
      { left: 0, right: 5, duplicate: false },
      { left: 0, right: 6, duplicate: true },
      { left: 2, right: 7, duplicate: false },
    ]);
  });

  it('reports duplicate draws only when sampling with replacement', () => {
    const withReplacement = stagingFor(sampleEvent);
    if (withReplacement.kind !== 'sample') throw new Error('expected sample staging');
    expect(withReplacement.withReplacement).toBe(true);
    expect(withReplacement.duplicates).toBe(1);
    const without = stagingFor(event('Table.sample', { indices: [1, 4], withReplacement: false }));
    if (without.kind !== 'sample') throw new Error('expected sample staging');
    expect(without.withReplacement).toBe(false);
    expect(without.duplicates).toBe(0);
    expect(without.label).toContain('without replacement');
  });

  it('reads chart series, axes and bar heights', () => {
    const staging = stagingFor(histEvent);
    if (staging.kind !== 'chart') throw new Error('expected chart staging');
    expect(staging.chart).toBe('hist');
    expect(staging.axes).toEqual({ x: 'price', y: 'Count' });
    expect(staging.points.map((point) => point.y)).toEqual([3, 7, 1]);
    expect(staging.points[1].label).toBe('10-20');
    const span = chartSpan(staging.points);
    expect(span).toBe(7);
    const tallest = chartPosition(1, 7, span)[1];
    const shortest = chartPosition(2, 1, span)[1];
    expect(tallest).toBeGreaterThan(shortest);
  });

  it('places bookends at the requested percentiles', () => {
    const staging = stagingFor(event('percentile', { percent: 75, value: 42, populationSize: 12 }));
    if (staging.kind !== 'bookends') throw new Error('expected bookends staging');
    expect(staging.marks).toEqual([{ percent: 75, value: 42 }]);
    expect(staging.populationSize).toBe(12);
  });

  it('shows optimizer progress instead of a generic stamp', () => {
    const staging = stagingFor(event('minimize', {
      objective: 0.125, iterations: 9, evaluations: 44, success: true,
    }));
    if (staging.kind !== 'fit') throw new Error('expected fit staging');
    expect(staging).toMatchObject({ objective: 0.125, iterations: 9, evaluations: 44, success: true });
    expect(staging.label).toContain('9 steps');
  });

  it('reads sample_proportions counts and probabilities', () => {
    const staging = stagingFor(event('sample_proportions', {
      sampleSize: 100, counts: [40, 60], probabilities: [0.5, 0.5],
    }));
    if (staging.kind !== 'proportions') throw new Error('expected proportions staging');
    expect(staging.counts).toEqual([40, 60]);
    expect(staging.probabilities).toEqual([0.5, 0.5]);
  });

  it('falls back to an idle stage for events without a set piece', () => {
    expect(stagingFor(null).kind).toBe('idle');
    expect(stagingFor(event('num_rows', {})).kind).toBe('idle');
    expect(stagedBookPosition(stagingFor(null), 0, 0.5, [0, 0, 0], [1, 1, 1])).toBeNull();
  });

  it('bounds every payload-derived collection', () => {
    const buckets = Array.from({ length: 400 }, (_, index) => ({ key: [index], indices: [index] }));
    const bins = stagingFor(event('Table.group', { buckets, bucketCount: buckets.length }));
    if (bins.kind !== 'bins') throw new Error('expected bins staging');
    expect(bins.bins.length).toBe(BIN_LIMIT);
    expect(bins.total).toBe(400);
    expect(Math.max(...bins.assignment)).toBeLessThan(BIN_LIMIT);

    const wide = stagingFor(event('Table.pivot', {
      rowKeys: [Array.from({ length: 50 }, (_, index) => index)],
      columnKeys: Array.from({ length: 50 }, (_, index) => `c${index}`), cells: [],
    }));
    if (wide.kind !== 'drawers') throw new Error('expected drawers staging');
    expect(wide.drawers.length).toBe(DRAWER_LIMIT);

    const many = stagingFor(event('Table.join', {
      leftIndices: Array.from({ length: 200 }, (_, index) => index),
      rightIndices: Array.from({ length: 200 }, (_, index) => index),
      matchedPairCount: 200, unmatchedLeftIndices: [], unmatchedRightIndices: [],
    }));
    if (many.kind !== 'join') throw new Error('expected join staging');
    expect(many.threads.length).toBe(THREAD_LIMIT);

    const long = stagingFor(event('Table.plot', {
      x: Array.from({ length: 900 }, (_, index) => index),
      y: Array.from({ length: 900 }, (_, index) => index), axes: {},
    }));
    if (long.kind !== 'chart') throw new Error('expected chart staging');
    expect(long.points.length).toBe(POINT_LIMIT);
  });

  it('ignores malformed payloads instead of throwing', () => {
    for (const payload of [{}, { buckets: 'nope' }, { cells: [{ row: 'x' }] },
      { leftIndices: [-1, 1.5] }, { x: ['a'], y: [null] }, { percent: 'half' }]) {
      for (const type of ['Table.group', 'Table.pivot', 'Table.join', 'Table.barh', 'percentile']) {
        expect(() => stagingFor(event(type, payload))).not.toThrow();
      }
    }
  });

  it('never mutates the event payload it reads', () => {
    const snapshot = JSON.stringify(groupEvent);
    stagingFor(groupEvent);
    stagedBookPosition(stagingFor(groupEvent), 3, 0.4, [0, 2, 0], [1, 2, 1]);
    expect(JSON.stringify(groupEvent)).toBe(snapshot);
  });
});

describe('staged book paths are distinct per operation family', () => {
  const from: [number, number, number] = [-0.82, 2.54, 0.5];
  const to: [number, number, number] = [0.93, 2.54, 0.5];
  const stagings: Staging[] = [groupEvent, pivotEvent, joinEvent, sampleEvent, histEvent,
    event('percentile', { percent: 50, value: 3 }),
    event('minimize', { objective: 1, iterations: 2, evaluations: 3, success: false }),
  ].map((entry) => stagingFor(entry));

  it('moves through its own station rather than a shared cart sweep', () => {
    const ends = stagings.map((staging) => stagedBookPosition(staging, 0, 0.5, from, to, false, 7));
    expect(ends.every((position) => position !== null)).toBe(true);
    const keys = new Set(ends.map((position) => position?.map((axis) => axis.toFixed(2)).join()));
    expect(keys.size).toBe(stagings.length);
  });

  it('sends grouped books to their own bucket bin', () => {
    const first = stagedBookPosition(stagings[0], 0, 1, from, to);
    const third = stagedBookPosition(stagings[0], 2, 1, from, to);
    expect(first?.[0]).toBeCloseTo(binPosition(0)[0], 5);
    expect(third?.[0]).toBeCloseTo(binPosition(2)[0], 5);
  });

  it('files pivoted books into the drawer for their row and column', () => {
    expect(stagedBookPosition(stagings[1], 0, 1, from, to)).toEqual(drawerPosition(0));
    expect(stagedBookPosition(stagings[1], 2, 1, from, to)).toEqual(drawerPosition(3));
  });

  it('routes join rows past the spool, the press or Lost & Found', () => {
    const matched = stagedBookPosition(stagings[2], 0, 0.5, from, to);
    const copied = stagedBookPosition(stagings[2], 0, 0.5, from, to);
    const dropped = stagedBookPosition(stagings[2], 7, 0.5, from, to);
    expect(matched?.[0]).toBeCloseTo(SPOOL[0], 5);
    expect(copied?.[2]).toBeCloseTo(SPOOL[2], 5);
    expect(dropped?.[0]).toBeCloseTo(LOST_FOUND[0], 5);
    const duplicate = stagedBookPosition(stagingFor(event('Table.join', {
      leftIndices: [4, 4], rightIndices: [1, 2], matchedPairCount: 2,
      unmatchedLeftIndices: [], unmatchedRightIndices: [],
    })), 4, 0.5, from, to);
    expect(duplicate?.[0]).toBeCloseTo(SPOOL[0], 5);
    expect(PRESS[0]).not.toBeCloseTo(SPOOL[0], 5);
  });

  it('lifts sampled books out of the archive trapdoor', () => {
    const start = stagedBookPosition(stagings[3], 0, 0, from, to);
    expect(start?.[0]).toBeCloseTo(TRAPDOOR[0], 5);
    expect(start?.[1]).toBeLessThan(TRAPDOOR[1]);
  });

  it('stacks chart bars in series order and hides rows without a bar', () => {
    const bar = stagedBookPosition(stagings[4], 1, 1, from, to, false, 7);
    expect(bar).toEqual(chartPosition(1, 7, 7));
    expect(stagedBookPosition(stagings[4], 9, 1, from, to, false, 7)).toBeNull();
  });

  it('completes instantly under reduced motion and is deterministic', () => {
    for (const staging of stagings) {
      const reduced = stagedBookPosition(staging, 1, 0, from, to, true, 7);
      const finished = stagedBookPosition(staging, 1, 1, from, to, false, 7);
      expect(reduced).toEqual(finished);
      expect(stagedBookPosition(staging, 1, 0.37, from, to, false, 7))
        .toEqual(stagedBookPosition(staging, 1, 0.37, from, to, false, 7));
    }
  });

  it('keeps every staged book inside the library volume', () => {
    for (const staging of stagings) {
      for (let index = 0; index < 12; index += 1) {
        for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
          const position = stagedBookPosition(staging, index, progress, from, to, false, 7);
          if (!position) continue;
          expect(Math.abs(position[0])).toBeLessThan(3);
          expect(position[1]).toBeGreaterThan(1.4);
          expect(position[1]).toBeLessThan(4);
          expect(Math.abs(position[2])).toBeLessThan(3);
        }
      }
    }
  });
});
