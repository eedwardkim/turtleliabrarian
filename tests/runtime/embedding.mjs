import { Worker } from 'node:worker_threads';
import { URL } from 'node:url';
import { HARD_TIMEOUT_MS, WARMUP_TIMEOUT_MS } from '../../src/runtime/protocol.ts';

export class NodeEmbedding {
  constructor(root, engine) {
    this.worker = new Worker(new URL('./node-worker.mjs', import.meta.url), { workerData: { root, engine } });
    this.pending = new Map();
    this.nextId = 1;
    this.closed = false;
    this.ready = new Promise((resolve, reject) => {
      this.resolveReady = resolve;
      this.rejectReady = reject;
    });
    this.ready.catch(() => {});
    this.warmupTimer = setTimeout(() => this.fail(new Error('Node Python warmup timed out')), WARMUP_TIMEOUT_MS);
    this.worker.on('message', (message) => {
      if (message.type === 'ready') {
        clearTimeout(this.warmupTimer);
        this.resolveReady(message.versions);
      } else if (message.type === 'failed') {
        this.fail(new Error(message.message));
      } else {
        const job = this.pending.get(message.id);
        if (!job) return;
        clearTimeout(job.timer);
        this.pending.delete(message.id);
        if (message.type === 'result') job.resolve(message.result);
        else job.reject(new Error(message.message));
      }
    });
    this.worker.on('error', (error) => this.fail(error));
    this.worker.on('exit', (code) => {
      if (!this.closed) this.fail(new Error(`Node Python worker exited (${code})`));
    });
  }

  async request(message) {
    await this.ready;
    if (this.closed) throw new Error('Node Python worker is closed');
    if (this.pending.size) throw new Error('Embedding tests must send requests sequentially');
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.fail(new Error(`Node Python execution exceeded ${HARD_TIMEOUT_MS}ms`));
      }, HARD_TIMEOUT_MS);
      this.pending.set(id, { resolve, reject, timer });
      try {
        this.worker.postMessage({ ...message, id });
      } catch (error) {
        this.fail(error);
      }
    });
  }

  fail(error) {
    if (this.closed) return;
    this.closed = true;
    clearTimeout(this.warmupTimer);
    this.rejectReady(error);
    for (const job of this.pending.values()) {
      clearTimeout(job.timer);
      job.reject(error);
    }
    this.pending.clear();
    void this.worker.terminate();
  }

  async dispose() {
    this.fail(new Error('Node Python embedding disposed'));
    await this.worker.terminate();
  }
}
