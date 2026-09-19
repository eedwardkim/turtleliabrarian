import { describe, expect, it } from 'vitest';
import type { TraceEvent } from '../../src/contracts';
import { frameForWorld, initialState, reduceEvent, replayTrace } from '../../src/scene/director';

const array = { kind: 'array' as const, id: 'source', values: [1, 2] };
function event(type: string, seq: number, payload: TraceEvent['payload'], output: string | null = null): TraceEvent {
  return { version: 1, seq, type, line: 4, inputs: [], output, payload };
}

describe('scoped runtime replay', () => {
  it('keeps global bindings when a local shadow is created and removed', () => {
    const input = initialState({ values: array });
    const bound = reduceEvent(input, event('bind', 1, {
      name: 'values', scope: '<player>:helper:1', value: { ...array, id: 'local', values: [3] },
    }, 'local'));
    expect(bound.objects.source).toMatchObject({ visible: true, names: ['values'] });
    expect(bound.objects.local).toMatchObject({ visible: true, names: ['values'] });
    const removed = reduceEvent(bound, event('unbind', 2, {
      name: 'values', scope: '<player>:helper:1', objectId: 'local',
    }));
    expect(removed.bindings).toEqual({ values: 'source' });
    expect(removed.objects.local).toMatchObject({ visible: false, names: [] });
    expect(removed.objects.source).toMatchObject({ visible: true, names: ['values'] });
    expect(bound.objects.local.visible).toBe(true);
    expect(input.objects.source.names).toEqual(['values']);
  });

  it('retains an alias shared across recursive frames until the last scope returns', () => {
    const scope = '<player>:visit:';
    const trace = [
      event('bind', 1, { name: 'values', scope: `${scope}1`, value: array }, 'source'),
      event('bind', 2, { name: 'values', scope: `${scope}2`, value: array }, 'source'),
      event('unbind', 3, { name: 'values', scope: `${scope}2`, objectId: 'source' }),
    ];
    const partial = replayTrace(trace);
    expect(partial.objects.source).toMatchObject({ visible: true, names: ['values'] });
    const final = reduceEvent(partial, event('unbind', 4, { name: 'values', scope: `${scope}1` }));
    expect(final.objects.source).toMatchObject({ visible: false, names: [] });
    expect(final.bindings).toEqual({});
    expect(final.bindingNames).toEqual({});
  });

  it('uses invocation counts and starts new trips after a previously summarized loop', () => {
    const loop = (type: string, seq: number, invocationId: number, count: number) =>
      event(type, seq, { loopId: 'helper.py:4:0', invocationId, scope: 'helper.py:visit:1', count });
    const trace = [
      loop('loop_start', 0, 1, 0),
      loop('loop_iteration', 1, 1, 1),
      loop('loop_end', 2, 1, 8000),
      loop('loop_start', 3, 2, 0),
      loop('loop_iteration', 4, 2, 1),
    ];
    const result = { stdout: '', value: null, delivered: null, error: null, trace, elapsedMs: 1, inputs: {} };
    const frame = (index: number) => frameForWorld({ result, event: trace[index], feedback: 'running',
      inputs: {}, progress: 0.5, reducedMotion: false });
    expect(frame(2).loops).toEqual({ trips: 5, summarized: 7995 });
    expect(frame(3).animation.motion).toBe('trip');
    expect(frame(3).loops).toEqual({ trips: 0, summarized: 0 });
    expect(frame(4).loops).toEqual({ trips: 1, summarized: 0 });
    expect(Object.values(frame(4).state.loops)).toEqual([8000, 1]);
  });
});
