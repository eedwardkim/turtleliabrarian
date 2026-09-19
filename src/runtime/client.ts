import type { RunRequest, RunResult } from '../contracts.ts';
import { runtimeBaseUrl } from './assets.ts';
import {
  errorMessage, failureResult, HARD_TIMEOUT_MS, isRunRequest, isWorkerReply, WARMUP_TIMEOUT_MS,
} from './protocol.ts';
import type { WorkerRequest } from './protocol.ts';

type Progress = (progress: number, message: string) => void;
type Timer = ReturnType<typeof setTimeout>;

export interface RuntimeWorker {
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  onerror: ((event: ErrorEvent) => unknown) | null;
  onmessageerror: ((event: MessageEvent<unknown>) => void) | null;
  postMessage(message: WorkerRequest): void;
  terminate(): void;
}

export interface RuntimeOptions {
  createWorker: () => RuntimeWorker;
  baseUrl: () => string;
  now?: () => number;
  warmupTimeoutMs?: number;
}

interface Slot {
  worker: RuntimeWorker;
  ready: Promise<void>;
  resolve: () => void;
  reject: (error: Error) => void;
  state: 'warming' | 'ready' | 'closed';
  progress: number;
  timer: Timer | null;
}

interface Job {
  id: number;
  request: RunRequest;
  resolve: (result: RunResult) => void;
}

interface Running {
  job: Job;
  slot: Slot;
  started: number;
  timer: Timer;
  done: () => void;
}

export class PythonRuntime {
  private readonly options: RuntimeOptions;
  private readonly now: () => number;
  private active: Slot | null = null;
  private standby: Slot | null = null;
  private initialization: Promise<void> | null = null;
  private readonly progressListeners = new Set<Progress>();
  private progress = 0;
  private progressMessage = 'Preparing the library…';
  private queue: Job[] = [];
  private current: Running | null = null;
  private nextId = 1;
  private draining = false;
  private disposed = false;

  constructor(options: RuntimeOptions) {
    this.options = options;
    this.now = options.now ?? (() => performance.now());
  }

  async init(onProgress?: Progress): Promise<void> {
    if (this.disposed) throw new Error('The Python runtime has been disposed.');
    if (!this.initialization) {
      this.progress = 0;
      this.progressMessage = 'Preparing the library…';
    }
    if (onProgress) {
      this.progressListeners.add(onProgress);
      this.notify(onProgress);
    }
    try {
      if (!this.initialization) {
        this.initialization = this.warmPair();
      }
      await this.initialization;
    } finally {
      if (onProgress) this.progressListeners.delete(onProgress);
    }
  }

  run(request: RunRequest): Promise<RunResult> {
    if (this.disposed) {
      return Promise.resolve(failureResult(request, 'RuntimeDisposedError',
        'The Python runtime has been disposed.', 'Reload the library to run Python again.'));
    }
    let snapshot: RunRequest;
    try {
      snapshot = structuredClone(request);
      if (!isRunRequest(snapshot)) throw new Error('The Python run request has invalid fields.');
    } catch (error: unknown) {
      return Promise.resolve(failureResult({ code: '' }, 'RuntimeRequestError',
        errorMessage(error), 'This request could not be sent to Python. Please try Run again.'));
    }
    return new Promise((resolve) => {
      this.queue.push({ id: this.nextId++, request: snapshot, resolve });
      void this.drain();
    });
  }

  stop(): void {
    if (this.disposed) return;
    this.cancelQueue('StoppedError', 'Run stopped.', 'Shelby put the books down. Edit your code and try again.');
    if (this.current) {
      const running = this.current;
      this.close(running.slot, new Error('Run stopped.'));
      this.finish(failureResult(running.job.request, 'StoppedError', 'Run stopped.',
        'Shelby put the books down. Edit your code and try again.', this.now() - running.started));
      this.rotate();
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.cancelQueue('RuntimeDisposedError', 'The Python runtime has been disposed.',
      'Reload the library to run Python again.');
    if (this.current) {
      this.finish(failureResult(this.current.job.request, 'RuntimeDisposedError',
        'The Python runtime has been disposed.', 'Reload the library to run Python again.',
        this.now() - this.current.started));
    }
    if (this.active) this.close(this.active, new Error('The Python runtime has been disposed.'));
    if (this.standby) this.close(this.standby, new Error('The Python runtime has been disposed.'));
    this.active = null;
    this.standby = null;
    this.progressListeners.clear();
  }

  private async warmPair(): Promise<void> {
    try {
      this.active = this.spawn();
      this.standby = this.spawn();
      await Promise.all([this.active.ready, this.standby.ready]);
      if (this.disposed) throw new Error('The Python runtime has been disposed.');
      this.report(1, 'Python is ready. Shelby is at the desk.');
    } catch (error: unknown) {
      if (this.active) this.close(this.active, new Error(errorMessage(error)));
      if (this.standby) this.close(this.standby, new Error(errorMessage(error)));
      this.active = null;
      this.standby = null;
      // Reset on a microtask so synchronous worker construction failures can also be retried.
      queueMicrotask(() => { this.initialization = null; });
      throw new Error(`Python could not warm up: ${errorMessage(error)}`, { cause: error });
    }
  }

  private spawn(): Slot {
    const worker = this.options.createWorker();
    let resolveReady: () => void = () => {};
    let rejectReady: (error: Error) => void = () => {};
    const ready = new Promise<void>((resolve, reject) => {
      resolveReady = resolve;
      rejectReady = reject;
    });
    const slot: Slot = {
      worker, ready, resolve: resolveReady, reject: rejectReady,
      state: 'warming', progress: 0, timer: null,
    };
    // Standby failures may happen before a caller needs that worker.
    void ready.catch(() => {});
    worker.onmessage = (event) => {
      if (slot.state === 'closed' || this.disposed) return;
      const message: unknown = event.data;
      if (!isWorkerReply(message)) {
        this.fail(slot, 'Python sent an invalid response.');
        return;
      }
      if (message.type === 'progress' && slot.state === 'warming') {
        slot.progress = Math.max(slot.progress, message.progress);
        this.reportWarmup(message.message);
      } else if (message.type === 'ready' && slot.state === 'warming') {
        if (slot.timer !== null) clearTimeout(slot.timer);
        slot.timer = null;
        slot.state = 'ready';
        slot.progress = 1;
        slot.resolve();
        this.reportWarmup('Preparing a spare Python desk…');
      } else if (message.type === 'failed') {
        this.fail(slot, message.message);
      } else if (message.type === 'result' && this.current?.slot === slot &&
          this.current.job.id === message.id) {
        this.finish(message.result);
      }
    };
    worker.onerror = (event) => {
      event.preventDefault();
      this.fail(slot, event.message || 'The Python worker stopped unexpectedly.');
    };
    worker.onmessageerror = () => this.fail(slot, 'The Python worker response could not be read.');
    slot.timer = setTimeout(() => {
      this.fail(slot, 'Python loading took too long. Check your connection and reload the library.');
    }, this.options.warmupTimeoutMs ?? WARMUP_TIMEOUT_MS);
    try {
      worker.postMessage({ type: 'init', baseUrl: this.options.baseUrl() });
    } catch (error: unknown) {
      this.fail(slot, errorMessage(error));
    }
    return slot;
  }

  private close(slot: Slot, error: Error): void {
    if (slot.state === 'closed') return;
    if (slot.timer !== null) clearTimeout(slot.timer);
    slot.timer = null;
    slot.state = 'closed';
    slot.reject(error);
    slot.worker.onmessage = null;
    slot.worker.onerror = null;
    slot.worker.onmessageerror = null;
    slot.worker.terminate();
  }

  private fail(slot: Slot, message: string): void {
    if (slot.state === 'closed') return;
    this.close(slot, new Error(message));
    if (this.current?.slot === slot) {
      this.finish(failureResult(this.current.job.request, 'WorkerError', message,
        'Shelby lost the Python desk. A fresh one is ready; try your code again.',
        this.now() - this.current.started));
      this.rotate();
    }
  }

  private rotate(): void {
    this.active = this.standby?.state !== 'closed' ? this.standby : null;
    this.standby = null;
    if (this.disposed) return;
    try {
      this.active ??= this.spawn();
      this.standby = this.spawn();
    } catch {
      // A failed replacement is retried when the next request needs a worker.
    }
  }

  private async drain(): Promise<void> {
    if (this.draining || this.disposed) return;
    this.draining = true;
    try {
      await this.init();
      while (!this.disposed && this.queue.length > 0) {
        if (!this.active || this.active.state === 'closed') this.rotate();
        const slot = this.active;
        if (!slot) throw new Error('The browser could not start a Python worker.');
        await slot.ready;
        if (this.disposed || this.queue.length === 0) break;
        if (slot !== this.active || slot.state !== 'ready') continue;
        const job = this.queue.shift();
        if (!job) break;
        await new Promise<void>((done) => {
          const timer = setTimeout(() => {
            if (this.current?.job !== job) return;
            this.close(slot, new Error('Python exceeded the hard time limit.'));
            this.finish(failureResult(job.request, 'TimeoutError',
              `Execution exceeded the ${HARD_TIMEOUT_MS / 1000}-second hard time limit.`,
              'Shelby is walking in circles. Check your loop and try a smaller task.',
              this.now() - (this.current?.started ?? this.now())));
            this.rotate();
          }, HARD_TIMEOUT_MS);
          this.current = { job, slot, started: this.now(), timer, done };
          try {
            slot.worker.postMessage({ type: 'run', id: job.id, request: job.request });
          } catch (error: unknown) {
            this.fail(slot, errorMessage(error));
          }
        });
      }
    } catch (error: unknown) {
      this.cancelQueue('RuntimeInitError', errorMessage(error),
        'Python could not open. Check your connection, then try Run again.');
    } finally {
      this.draining = false;
      if (!this.disposed && this.queue.length > 0) void this.drain();
    }
  }

  private finish(result: RunResult): void {
    const running = this.current;
    if (!running) return;
    clearTimeout(running.timer);
    this.current = null;
    running.job.resolve(result);
    running.done();
  }

  private cancelQueue(type: string, message: string, friendly: string): void {
    const jobs = this.queue;
    this.queue = [];
    for (const job of jobs) job.resolve(failureResult(job.request, type, message, friendly));
  }

  private reportWarmup(message: string): void {
    if (this.progress === 1) return;
    this.report(((this.active?.progress ?? 0) + (this.standby?.progress ?? 0)) / 2, message);
  }

  private report(progress: number, message: string): void {
    this.progress = Math.max(this.progress, progress);
    this.progressMessage = message;
    for (const listener of this.progressListeners) this.notify(listener);
  }

  private notify(listener: Progress): void {
    try {
      listener(this.progress, this.progressMessage);
    } catch {
      // A UI progress callback must not strand Python requests.
    }
  }
}

export const runtime = new PythonRuntime({
  createWorker: () => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module', name: 'shelf-python' }),
  baseUrl: () => runtimeBaseUrl(import.meta.env.BASE_URL, document.baseURI),
});
