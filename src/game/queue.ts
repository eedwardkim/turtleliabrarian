import type { Puzzle, QueueEntry, RunRequest } from '../contracts';

export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildQueue(puzzle: Puzzle, seed = puzzle.visibleSeed): QueueEntry[] {
  if (puzzle.fixtures.length >= puzzle.queueSize) throw new Error('Queue must leave room for seeded shelves');
  const random = seededRandom(seed);
  const queue: QueueEntry[] = puzzle.fixtures.map((fixture) => ({
    name: fixture.name, inputs: structuredClone(fixture.inputs), seed: Math.floor(random() * 0x7fffffff), status: 'waiting',
  }));
  while (queue.length < puzzle.queueSize) {
    queue.push({ name: `Fresh shelf ${queue.length - puzzle.fixtures.length + 1}`, seed: Math.floor(random() * 0x7fffffff), status: 'waiting' });
  }
  for (let index = queue.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [queue[index], queue[other]] = [queue[other], queue[index]];
  }
  return queue;
}

export function requestFor(puzzle: Puzzle, code: string, seed: number, files: Record<string, string>, inputs?: QueueEntry['inputs'], openStacks = false): RunRequest {
  return {
    code, files, inputCode: puzzle.inputCode, inputs, seed,
    allowedApi: openStacks ? undefined : puzzle.learnedApi,
    instrument: true, budgetMs: 5000,
  };
}
