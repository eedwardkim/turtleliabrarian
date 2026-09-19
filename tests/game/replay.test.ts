import { describe, expect, it } from 'vitest';
import type { TraceEvent } from '../../src/contracts';
import { advanceReplay, currentLine, eventDuration, replayProgress } from '../../src/game/replay';

const trace: TraceEvent[] = [
  { version: 1, seq: 0, type: 'bind', line: 1, inputs: [], output: 'a', payload: {} },
  { version: 1, seq: 1, type: 'array_math', line: 2, inputs: ['a'], output: 'b', payload: {} },
  { version: 1, seq: 2, type: 'deliver', line: 3, inputs: ['b'], output: null, payload: {} },
];
const start = { traceIndex: 0, replayPaused: false, replayElapsed: 0 };

describe('trace progression', () => {
  it('advances event and player line at the same boundary', () => {
    const next = advanceReplay(start, trace, 200, 1);
    expect(next.traceIndex).toBe(1);
    expect(next.replayElapsed).toBe(20);
    expect(currentLine(next, trace)).toBe(2);
    expect(replayProgress(next, trace)).toBeGreaterThan(1 / 3);
  });
  it('honors pause and speed, then ends exactly at one', () => {
    const paused = { ...start, replayPaused: true };
    expect(advanceReplay(paused, trace, 900, 1)).toBe(paused);
    expect(advanceReplay(start, trace, 50, 4).traceIndex).toBe(1);
    const end = advanceReplay(start, trace, 100_000, 8);
    expect(end.traceIndex).toBe(2);
    expect(end.replayPaused).toBe(true);
    expect(replayProgress(end, trace)).toBe(1);
  });
  it('handles empty traces and accelerates later loop iterations', () => {
    expect(advanceReplay(start, [], 50, 1)).toBe(start);
    expect(currentLine(start, [])).toBeNull();
    expect(replayProgress(start, [])).toBe(0);
    expect(eventDuration({ ...trace[0], type: 'loop_iteration', payload: { iteration: 6 } })).toBeLessThan(
      eventDuration({ ...trace[0], type: 'loop_iteration', payload: { iteration: 2 } }));
  });
});
