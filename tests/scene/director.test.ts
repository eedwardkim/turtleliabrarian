import { describe, expect, it } from 'vitest';
import type { Json, TableValue, TraceEvent, WorldProps } from '../../src/contracts';
import { ANIMATIONS, animatedBookPosition, animationFor, arrayPosition, BOOK_LIMIT, bookPosition, booksFor,
  clampProgress, eventType, frameForWorld, initialState, INPUT_CART, loopPresentation,
  OUTPUT_CART, parseValue, reduceEvent, replayTrace, SIEVE, STAMP, valueCount } from '../../src/scene/director';

const table = (id: string, rows: number[][]): TableValue => ({ kind: 'table', id, labels: ['pages'], rows, totalRows: rows.length });
const snapshot = (id: string, rows: number[][]): Json => ({ kind: 'table', id, labels: ['pages'], rows, totalRows: rows.length });
const event = (type: string, overrides: Partial<TraceEvent> = {}): TraceEvent => ({
  version: 1, seq: 0, type, line: 1, inputs: ['source'], output: 'result', payload: {}, ...overrides,
});
const props = (overrides: Partial<WorldProps> = {}): WorldProps => ({
  inputs: { books: table('source', [[10], [5], [20]]) }, result: null, event: null,
  progress: 0, feedback: 'idle', diff: null, chapter: 1, reducedMotion: false,
  colorblind: false, hat: '', hatchlings: 0, ...overrides,
});

describe('event vocabulary', () => {
  const expected = {
    table: 'create', read_table: 'create', with_column: 'stamp', with_columns: 'stamp',
    column: 'tray', make_array: 'tray', array: 'tray', array_math: 'stamp', array_op: 'stamp',
    numpy: 'stamp', arange: 'tray', append: 'marble', item: 'inspect', sum: 'stamp',
    mean: 'stamp', std: 'stamp', count_nonzero: 'stamp', select: 'tray', drop: 'tray',
    relabeled: 'name', where: 'sieve', sort: 'reshuffle', take: 'reshuffle', exclude: 'sieve',
    bind: 'name', unbind: 'fade', deliver: 'deliver', error: 'flip', loop_start: 'trip',
    loop_iter: 'trip', loop_iteration: 'trip', loop_end: 'summary', apply: 'stamp',
    group: 'bins', pivot: 'drawers', join: 'thread', sample: 'sample', barh: 'chart',
    hist: 'chart', scatter: 'chart', plot: 'chart', chart: 'chart', sample_proportions: 'sample',
    percentile: 'stamp', minimize: 'stamp',
    row: 'inspect', rows: 'inspect', labels: 'inspect', num_rows: 'inspect',
    num_columns: 'inspect', show: 'inspect', expression: 'stamp',
  };
  it('requires an explicit expectation for every supported event', () => {
    expect(Object.keys(ANIMATIONS).sort()).toEqual(Object.keys(expected).sort());
  });
  it.each(Object.entries(expected))('%s uses %s', (type, motion) => {
    expect(animationFor(event(type)).motion).toBe(motion);
    expect(animationFor(event(type)).duration).toBeGreaterThan(0);
  });
  it('normalizes documented namespace forms and falls back safely', () => {
    expect(eventType(event('Table.where'))).toBe('where');
    expect(animationFor(event('np.mean')).motion).toBe('stamp');
    expect(animationFor(event('numpy', { payload: { operation: 'np.append' } })).motion).toBe('marble');
    expect(animationFor(event('future_event')).motion).toBe('inspect');
  });
});

describe('deterministic snapshot replay', () => {
  const source = table('source', [[10], [5], [20]]);
  const inputs = { books: source };
  const trace: TraceEvent[] = [
    event('where', { seq: 1, payload: { value: snapshot('result', [[10], [20]]), kept_indices: [0, 2] } }),
    event('bind', { seq: 2, inputs: ['result'], output: null, payload: { name: 'selected' } }),
    event('sort', { seq: 3, inputs: ['result'], output: 'sorted', payload: { value: snapshot('sorted', [[20], [10]]), permutation: [1, 0] } }),
    event('bind', { seq: 4, inputs: ['sorted'], output: null, payload: { name: 'selected' } }),
    event('deliver', { seq: 5, inputs: ['sorted'], output: null }),
  ];
  it('matches concrete final snapshots, names and delivered values', () => {
    const state = replayTrace(trace, inputs);
    expect(state.delivered).toEqual(table('sorted', [[20], [10]]));
    expect(state.objects.sorted.value).toEqual(state.delivered);
    expect(state.bindings).toEqual({ books: 'source', selected: 'sorted' });
    expect(state.objects.result.visible).toBe(false);
    expect(state.objects.sorted.names).toEqual(['selected']);
  });
  it('equals incremental playback without mutating trace or inputs', () => {
    const before = JSON.stringify({ trace, inputs });
    const state = trace.reduce(reduceEvent, initialState(inputs));
    expect(replayTrace(trace, inputs)).toEqual(state);
    expect(JSON.stringify({ trace, inputs })).toBe(before);
    expect(replayTrace(trace, inputs)).toEqual(replayTrace(trace, inputs));
  });
  it('supports aliases and fades only after the last name is removed', () => {
    let state = initialState(inputs);
    state = reduceEvent(state, event('bind', { inputs: ['source'], output: null, payload: { name: 'alias' } }));
    state = reduceEvent(state, event('unbind', { output: null, payload: { name: 'books' } }));
    expect(state.objects.source).toMatchObject({ visible: true, names: ['alias'] });
    state = reduceEvent(state, event('unbind', { output: null, payload: { name: 'alias' } }));
    expect(state.objects.source.visible).toBe(false);
    expect(state.bindings).toEqual({});
  });
  it('retains error source location and scalar deliveries including false and zero', () => {
    for (const value of [false, 0, '', null]) {
      const state = replayTrace([event('deliver', { output: null, payload: { value } }),
        event('error', { line: 8, output: null, payload: { message: 'bad label' } })], inputs);
      expect(state.delivered).toBe(value);
      expect(state.error).toEqual({ line: 8, message: 'bad label' });
    }
  });
  it('isolates copied arrays and rejects malformed snapshots', () => {
    const value: Json = { kind: 'array', values: [1, 2] };
    const parsed = parseValue(value);
    expect(parsed).toEqual(value);
    expect(parsed).not.toBe(value);
    expect(parseValue({ kind: 'array', values: [{}] })).toBeUndefined();
    expect(parseValue({ kind: 'table', labels: [2], rows: [] })).toBeUndefined();
  });
  it('seeks only as far as the current event and supports standalone events', () => {
    const result = { stdout: '', value: null, delivered: table('sorted', [[20], [10]]),
      error: null, trace, elapsedMs: 1, inputs };
    const frame = frameForWorld(props({ result, event: trace[0], progress: 0.5, feedback: 'running' }));
    expect(frame.state.lastSeq).toBe(1);
    expect(frame.output?.value).toEqual(table('result', [[10], [20]]));
    expect(frameForWorld(props({ event: trace[0] })).output?.value).toEqual(frame.output?.value);
    expect(frameForWorld(props({ result, feedback: 'running' })).state.lastOutput).toBeNull();
    expect(frameForWorld(props({ result, feedback: 'success' })).output?.value).toEqual(result.delivered);
  });
});

describe('LOD, paths, counts and timeline', () => {
  it('caps geometry while preserving the full table count', () => {
    const value = { ...table('large', Array.from({ length: 100 }, (_, i) => [i])), totalRows: 10000 };
    expect(booksFor(value)).toHaveLength(BOOK_LIMIT);
    expect(booksFor(value, 100000)).toHaveLength(BOOK_LIMIT);
    expect(booksFor(value, -1)).toHaveLength(0);
    expect(valueCount(value)).toBe(10000);
    expect(valueCount({ kind: 'array', values: [0, false, null] })).toBe(3);
    expect(valueCount(0)).toBe(1);
  });
  it('keeps slots and thickness within cart bounds', () => {
    for (const index of [-100, ...Array.from({ length: 100 }, (_, i) => i), NaN, Infinity]) {
      const [x, y, z] = bookPosition(index, OUTPUT_CART);
      expect(x).toBeGreaterThanOrEqual(OUTPUT_CART[0] - 0.5);
      expect(x).toBeLessThanOrEqual(OUTPUT_CART[0] + 0.5);
      expect(y).toBeGreaterThan(OUTPUT_CART[1]);
      expect(y).toBeLessThan(OUTPUT_CART[1] + 0.7);
      expect(Math.abs(z - OUTPUT_CART[2])).toBeLessThan(0.2);
    }
    for (const book of booksFor(table('thick', [[1e30], [-1e30], [0]]))) {
      expect(book.thickness).toBeGreaterThanOrEqual(0.72);
      expect(book.thickness).toBeLessThanOrEqual(1.47);
    }
  });
  it('routes copied filtered books through the sieve without moving the input', () => {
    const filter = event('where', { payload: { kept_indices: [2] } });
    expect(animatedBookPosition(filter, 0, 0)).toEqual(bookPosition(2, INPUT_CART));
    expect(animatedBookPosition(filter, 0, 0.5)).toEqual(SIEVE);
    expect(animatedBookPosition(filter, 0, 1)).toEqual(bookPosition(0, OUTPUT_CART));
    expect(animatedBookPosition(event('sort'), 0, 0.5)).not.toEqual(SIEVE);
  });
  it('finishes immediately in reduced motion and clamps malformed progress', () => {
    for (const type of Object.keys(ANIMATIONS)) {
      expect(animatedBookPosition(event(type), 0, 0.2, true))
        .toEqual(animatedBookPosition(event(type), 0, 1));
    }
    expect(clampProgress(Infinity)).toBe(0);
    expect(clampProgress(-1)).toBe(0);
    expect(clampProgress(3)).toBe(1);
    expect(frameForWorld(props({ reducedMotion: true })).progress).toBe(1);
  });
  it('fully presents five trips, then summarizes exactly the remainder', () => {
    expect(loopPresentation(3)).toEqual({ trips: 3, summarized: 0 });
    expect(loopPresentation(100)).toEqual({ trips: 5, summarized: 95 });
    const trace = Array.from({ length: 7 }, (_, i) => event('loop_iter', {
      seq: i, output: null, payload: { loop_id: 'each' },
    }));
    const result = { stdout: '', value: null, delivered: null, error: null, trace, elapsedMs: 1, inputs: {} };
    expect(frameForWorld(props({ result, event: trace[4] })).animation.motion).toBe('trip');
    const frame = frameForWorld(props({ result, event: trace[6] }));
    expect(frame.animation.motion).toBe('summary');
    expect(frame.loops).toEqual({ trips: 5, summarized: 2 });
  });
  it('routes array values through the stamp into bounded indexed trays', () => {
    for (const index of [0, 1, 7, 8, 39, 100, NaN]) {
      const destination = arrayPosition(index);
      expect(destination.every(Number.isFinite)).toBe(true);
      expect(destination[0]).toBeGreaterThan(OUTPUT_CART[0] - 0.5);
      expect(destination[0]).toBeLessThan(OUTPUT_CART[0] + 0.5);
      expect(Math.abs(destination[2] - OUTPUT_CART[2])).toBeLessThan(0.3);
      expect(animatedBookPosition(event('array_math'), index, 0.5, false, destination)).toEqual(STAMP);
      expect(animatedBookPosition(event('array_math'), index, 1, false, destination)).toEqual(destination);
    }
  });
  it('gives distinct stations and trajectories to later operation families', () => {
    const points = ['sieve', 'stamp', 'bins', 'drawers', 'thread', 'sample', 'chart'].map((motion) => {
      const type = Object.entries(ANIMATIONS).find(([, spec]) => spec.motion === motion)?.[0];
      if (!type) throw new Error(`No ${motion} event`);
      return animatedBookPosition(event(type), 3, 0.5).join(',');
    });
    expect(new Set(points).size).toBe(points.length);
  });
});
