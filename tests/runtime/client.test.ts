import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RunRequest, RunResult } from '../../src/contracts.ts';
import { PythonRuntime } from '../../src/runtime/client.ts';
import type { RuntimeWorker } from '../../src/runtime/client.ts';
import type { WorkerReply, WorkerRequest } from '../../src/runtime/protocol.ts';

class Transport implements RuntimeWorker {
  onmessage: RuntimeWorker['onmessage'] = null;
  onerror: RuntimeWorker['onerror'] = null;
  onmessageerror: RuntimeWorker['onmessageerror'] = null;
  sent: WorkerRequest[] = [];
  terminated = false;
  throwOnRun = false;

  postMessage(message: WorkerRequest): void {
    if (this.throwOnRun && message.type === 'run') throw new Error('Transport failed');
    this.sent.push(message);
  }

  terminate(): void { this.terminated = true; }
  reply(message: WorkerReply): void { this.onmessage?.(new MessageEvent('message', { data: message })); }
  ready(): void { this.reply({ type: 'ready' }); }
  get runs(): Extract<WorkerRequest, { type: 'run' }>[] {
    return this.sent.filter((message) => message.type === 'run');
  }
}

const result: RunResult = {
  stdout: '', value: 42, delivered: null, error: null, trace: [], elapsedMs: 12, inputs: {},
};

describe('Python worker transport lifecycle (no engine execution)', () => {
  let workers: Transport[];
  let runtime: PythonRuntime;
  let constructionFails: boolean;

  beforeEach(() => {
    vi.useFakeTimers();
    workers = [];
    constructionFails = false;
    runtime = new PythonRuntime({
      createWorker: () => {
        if (constructionFails) throw new Error('Worker creation denied');
        const worker = new Transport();
        workers.push(worker);
        return worker;
      },
      baseUrl: () => 'https://shelf.example/game/',
    });
  });

  afterEach(() => {
    runtime.dispose();
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });

  async function ready(): Promise<void> {
    const initialized = runtime.init();
    workers[0].ready();
    workers[1].ready();
    await initialized;
  }

  async function flush(): Promise<void> {
    await vi.advanceTimersByTimeAsync(0);
  }

  it('initializes one active and one standby, with shared monotonic progress', async () => {
    const progress: number[] = [];
    const first = runtime.init((value) => progress.push(value));
    const second = runtime.init(() => { throw new Error('Broken UI listener'); });
    expect(workers).toHaveLength(2);
    expect(workers[0].sent[0]).toEqual({ type: 'init', baseUrl: 'https://shelf.example/game/' });
    workers[0].reply({ type: 'progress', progress: 0.6, message: 'Python' });
    workers[0].reply({ type: 'progress', progress: 0.1, message: 'Old progress' });
    let initialized = false;
    void first.then(() => { initialized = true; });
    workers[0].ready();
    await flush();
    expect(initialized).toBe(false);
    workers[1].ready();
    await Promise.all([first, second]);
    expect(progress.at(-1)).toBe(1);
    expect(progress).toEqual([...progress].sort((a, b) => a - b));
    expect(vi.getTimerCount()).toBe(0);
  });

  it('serializes requests, snapshots inputs, and ignores mismatched and duplicate replies', async () => {
    await ready();
    const request: RunRequest = { code: '21 * 2', files: { 'helper.py': 'n = 1' } };
    const first = runtime.run(request);
    request.code = 'changed';
    const second = runtime.run({ code: '43' });
    await flush();
    expect(workers[0].runs).toHaveLength(1);
    expect(workers[0].runs[0].request.code).toBe('21 * 2');
    const id = workers[0].runs[0].id;
    workers[0].reply({ type: 'result', id: id + 1, result });
    await flush();
    expect(workers[0].runs).toHaveLength(1);
    workers[0].reply({ type: 'result', id, result });
    expect(await first).toEqual(result);
    await flush();
    expect(workers[0].runs).toHaveLength(2);
    workers[0].reply({ type: 'result', id, result });
    workers[0].reply({ type: 'result', id: workers[0].runs[1].id, result: { ...result, value: 43 } });
    expect((await second).value).toBe(43);
  });

  it('Stop cancels the active and queued jobs and immediately uses the warm standby', async () => {
    await ready();
    const first = runtime.run({ code: 'while True: pass' });
    const queued = runtime.run({ code: 'never dispatched' });
    await flush();
    const staleHandler = workers[0].onmessage;
    runtime.stop();
    expect((await first).error?.type).toBe('StoppedError');
    expect((await queued).error?.type).toBe('StoppedError');
    expect(workers[0].terminated).toBe(true);
    expect(workers).toHaveLength(3);
    const next = runtime.run({ code: '42' });
    await flush();
    expect(workers[1].runs).toHaveLength(1);
    staleHandler?.(new MessageEvent('message', { data: { type: 'result', id: 3, result } }));
    workers[1].reply({ type: 'result', id: workers[1].runs[0].id, result });
    expect(await next).toEqual(result);
  });

  it('hard-kills exactly at 8s and lets an already queued request use standby', async () => {
    await ready();
    const first = runtime.run({ code: 'while True: pass', budgetMs: 5000 });
    const next = runtime.run({ code: '42' });
    await flush();
    await vi.advanceTimersByTimeAsync(7999);
    expect(workers[0].terminated).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    const timeout = await first;
    expect(timeout.error?.type).toBe('TimeoutError');
    expect(timeout.error?.friendly).toContain('walking in circles');
    expect(timeout.elapsedMs).toBe(8000);
    expect(workers[0].terminated).toBe(true);
    expect(workers[1].runs).toHaveLength(1);
    workers[1].reply({ type: 'result', id: workers[1].runs[0].id, result });
    expect(await next).toEqual(result);
  });

  it('does not count cold loading or a warming replacement toward execution timeout', async () => {
    const run = runtime.run({ code: '42' });
    await vi.advanceTimersByTimeAsync(30_000);
    expect(workers[0].runs).toHaveLength(0);
    workers[0].ready();
    workers[1].ready();
    await flush();
    await vi.advanceTimersByTimeAsync(7999);
    workers[0].reply({ type: 'result', id: workers[0].runs[0].id, result });
    expect(await run).toEqual(result);
    const stopped = runtime.run({ code: 'loop' });
    await flush();
    runtime.stop();
    await stopped;
    const stoppedAgain = runtime.run({ code: 'loop' });
    await flush();
    runtime.stop();
    await stoppedAgain;
    const warming = runtime.run({ code: '42' });
    await vi.advanceTimersByTimeAsync(9000);
    expect(workers[2].terminated).toBe(false);
    expect(workers[2].runs).toHaveLength(0);
    workers[2].ready();
    await flush();
    workers[2].reply({ type: 'result', id: workers[2].runs[0].id, result });
    expect(await warming).toEqual(result);
  });

  it('settles runs on initialization failure and allows a later retry', async () => {
    const failed = runtime.run({ code: '42' });
    workers[0].reply({ type: 'failed', message: 'Missing engine manifest' });
    expect((await failed).error?.message).toContain('Missing engine manifest');
    expect(workers.slice(0, 2).every((worker) => worker.terminated)).toBe(true);
    const retried = runtime.run({ code: '42' });
    workers[2].ready();
    workers[3].ready();
    await flush();
    workers[2].reply({ type: 'result', id: workers[2].runs[0].id, result });
    expect(await retried).toEqual(result);
  });

  it('has a distinct bounded warmup deadline', async () => {
    const failed = runtime.run({ code: '42' });
    await vi.advanceTimersByTimeAsync(120_000);
    expect((await failed).error?.type).toBe('RuntimeInitError');
    expect(workers.every((worker) => worker.terminated)).toBe(true);
  });

  it('starts a retry at zero without reporting progress from a failed warmup', async () => {
    const first = runtime.init();
    const rejected = expect(first).rejects.toThrow('Unavailable');
    workers[0].reply({ type: 'progress', progress: 0.8, message: 'Loading' });
    workers[1].reply({ type: 'failed', message: 'Unavailable' });
    await rejected;
    const progress: number[] = [];
    const retried = runtime.init((value) => progress.push(value));
    workers[2].ready();
    workers[3].ready();
    await retried;
    expect(progress[0]).toBe(0);
    expect(progress.at(-1)).toBe(1);
    expect(progress).toEqual([...progress].sort((a, b) => a - b));
  });

  it('handles synchronous worker construction errors without leaking promises', async () => {
    constructionFails = true;
    expect((await runtime.run({ code: '42' })).error?.message).toContain('Worker creation denied');
    constructionFails = false;
    await ready();
  });

  it('handles postMessage failures and resumes on the spare', async () => {
    await ready();
    workers[0].throwOnRun = true;
    expect((await runtime.run({ code: '42' })).error?.type).toBe('WorkerError');
    expect(workers[0].terminated).toBe(true);
    const next = runtime.run({ code: '42' });
    await flush();
    workers[1].reply({ type: 'result', id: workers[1].runs[0].id, result });
    expect(await next).toEqual(result);
  });

  it('does not let an old completed job timer kill a later job', async () => {
    await ready();
    const first = runtime.run({ code: '42' });
    await vi.advanceTimersByTimeAsync(7000);
    workers[0].reply({ type: 'result', id: workers[0].runs[0].id, result });
    await first;
    const second = runtime.run({ code: '42' });
    await vi.advanceTimersByTimeAsync(1500);
    expect(workers[0].terminated).toBe(false);
    workers[0].reply({ type: 'result', id: workers[0].runs[1].id, result });
    expect(await second).toEqual(result);
  });

  it('settles active and queued jobs on worker errors', async () => {
    await ready();
    const first = runtime.run({ code: '42' });
    await flush();
    workers[0].onerror?.(Object.assign(new Event('error'), {
      message: 'WASM crashed', filename: 'worker.js', lineno: 1, colno: 1, error: new Error('WASM crashed'),
    }));
    expect((await first).error?.message).toBe('WASM crashed');
    expect(workers[0].terminated).toBe(true);
  });

  it('rejects malformed results and unreadable messages', async () => {
    await ready();
    const first = runtime.run({ code: '42' });
    await flush();
    workers[0].onmessage?.(new MessageEvent('message', { data: { type: 'result', id: 1, result: {} } }));
    expect((await first).error?.type).toBe('WorkerError');
    const second = runtime.run({ code: '42' });
    await flush();
    workers[1].onmessageerror?.(new MessageEvent('messageerror'));
    expect((await second).error?.type).toBe('WorkerError');
  });

  it('survives failure of a background standby without unhandled rejection', async () => {
    await ready();
    const first = runtime.run({ code: 'loop' });
    await flush();
    runtime.stop();
    await first;
    workers[2].reply({ type: 'failed', message: 'Not enough memory for spare' });
    const second = runtime.run({ code: 'loop' });
    await flush();
    runtime.stop();
    await second;
    expect(workers).toHaveLength(5);
    workers[3].ready();
    const next = runtime.run({ code: '42' });
    await flush();
    workers[3].reply({ type: 'result', id: workers[3].runs[0].id, result });
    expect(await next).toEqual(result);
  });

  it('Stop during warmup cancels jobs without cancelling initialization', async () => {
    const first = runtime.run({ code: '42' });
    runtime.stop();
    expect((await first).error?.type).toBe('StoppedError');
    workers[0].ready();
    workers[1].ready();
    await flush();
    expect(workers[0].runs).toHaveLength(0);
  });

  it('dispose settles initialization and queued jobs and forbids resurrection', async () => {
    const init = runtime.init();
    const rejected = expect(init).rejects.toThrow('disposed');
    const run = runtime.run({ code: '42' });
    runtime.dispose();
    await rejected;
    expect((await run).error?.type).toBe('RuntimeDisposedError');
    expect(workers.every((worker) => worker.terminated)).toBe(true);
    expect((await runtime.run({ code: '43' })).error?.type).toBe('RuntimeDisposedError');
    await expect(runtime.init()).rejects.toThrow('disposed');
    runtime.dispose();
    runtime.stop();
    expect(workers).toHaveLength(2);
  });

  it('dispose settles an executing request and its queue', async () => {
    await ready();
    const first = runtime.run({ code: 'loop' });
    const second = runtime.run({ code: '42' });
    await flush();
    runtime.dispose();
    for (const promise of [first, second]) {
      expect((await promise).error?.type).toBe('RuntimeDisposedError');
    }
  });
});
