import { afterEach, describe, expect, it, vi } from 'vitest';
import { Recorder } from '../../scripts/capture-lib.mjs';

vi.mock('node:timers/promises', () => ({
  setTimeout: (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds)),
}));

afterEach(() => vi.useRealTimers());

describe('capture recorder liveness and evidence', () => {
  it('lets page-side hard deadlines fire while waiting for a worker', async () => {
    vi.useFakeTimers();
    let clock = 0;
    const page = {
      evaluate: vi.fn(async () => clock < 8000),
      clock: { runFor: vi.fn(async (milliseconds: number) => { clock += milliseconds; }) },
    };
    const recorder = new Recorder({ page, tour: { id: 'V00' }, root: '.', smoke: true });
    const frame = vi.spyOn(recorder, 'frame').mockResolvedValue(undefined);
    const settled = recorder.settle();
    await vi.advanceTimersByTimeAsync(8100);
    await settled;
    expect(clock).toBeGreaterThanOrEqual(8000);
    expect(clock).toBeLessThan(8100);
    expect(frame).toHaveBeenCalledOnce();
  });

  it('rejects window coverage when the named surface is absent or hidden', async () => {
    const recorder = new Recorder({ page: {}, tour: { id: 'V00' }, root: '.' });
    await expect(recorder.recordWindow('queue', { isVisible: async () => false })).rejects.toThrow('must be visible');
    expect(recorder.coverage.windows).toEqual([]);
    await recorder.recordWindow('queue', { isVisible: async () => true });
    expect(recorder.coverage.windows).toEqual(['queue']);
  });
});
