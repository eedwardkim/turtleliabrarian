import { describe, expect, it } from 'vitest';
import type { TraceEvent } from '../../src/contracts';
import { BOOK_LIMIT, booksFor, copyValue, frameForWorld, parseValue, valueCount } from '../../src/scene/director';

describe('bounded terminal snapshots', () => {
  const shown = Array.from({ length: BOOK_LIMIT }, (_, index) => index);
  const value = { kind: 'array' as const, values: shown };
  const delivery: TraceEvent = {
    version: 1, seq: 1999, type: 'deliver', line: 9, inputs: [], output: 'answer',
    payload: { value, totalValues: 250 },
  };
  const summary: TraceEvent = {
    version: 1, seq: 2000, type: 'trace_summary', line: 9, inputs: [], output: null,
    payload: { omittedCount: 4000, omittedEvents: { loop_iteration: 3000, numpy: 1000 } },
  };

  it('keeps the full delivery count after the summary without rendering more books', () => {
    const frame = frameForWorld({
      result: {
        delivered: { kind: 'array', values: Array.from({ length: 250 }, (_, index) => index) },
        trace: [delivery, summary], stdout: '', value: null, error: null, elapsedMs: 1, inputs: {},
      },
      event: summary, progress: 1, feedback: 'success', inputs: {}, reducedMotion: false,
    });
    expect(valueCount(frame.delivered)).toBe(250);
    expect(valueCount(frame.output?.value)).toBe(250);
    expect(booksFor(frame.delivered)).toHaveLength(BOOK_LIMIT);
    expect(frame.delivered).toEqual({ ...value, totalValues: 250 });
    expect(value).not.toHaveProperty('totalValues');
  });

  it('preserves count metadata through parsing and copying', () => {
    const parsed = parseValue({ ...value, totalValues: 250 });
    expect(parsed).toBeDefined();
    expect(valueCount(copyValue(parsed!))).toBe(250);
  });

  it.each([-1, 1, 39.5, Infinity, '250', null])('rejects invalid count %s', totalValues => {
    expect(valueCount(parseValue({ ...value, totalValues }))).toBe(BOOK_LIMIT);
  });
});
