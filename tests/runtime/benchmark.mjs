import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { NodeEmbedding } from './embedding.mjs';
import { projectRoot } from '../../scripts/prepare-runtime.mjs';

const rows = 200_000;
const repeats = 5;
const operations = [
  ['where', "left.where('key', are.above(99999))", 100000],
  ['sort', "left.sort('key')", rows],
  ['group', "left.group('category')", 200],
  ['join', "left.join('key', right, 'key')", rows],
];
const setup = `
from time import perf_counter
keys = np.random.permutation(${rows})
left = Table().with_columns('key', keys, 'category', keys % 200, 'value', keys * 2)
right = Table().with_columns('key', keys[::-1], 'other', keys[::-1] * 3)
`;
const embedding = new NodeEmbedding(projectRoot, true);
const results = [];
try {
  for (const instrument of [false, true]) {
    for (const [operation, expression, expectedRows] of operations) {
      const samples = [];
      for (let repeat = 0; repeat < repeats; repeat += 1) {
        const result = await embedding.request({
          type: 'run',
          request: {
            instrument, seed: 42,
            code: `${setup}
started = perf_counter()
answer = ${expression}
elapsed = perf_counter() - started
assert answer.num_rows == ${expectedRows}
elapsed`,
          },
        });
        assert.equal(result.error, null, `${operation}: ${JSON.stringify(result.error)}`);
        assert.equal(typeof result.value, 'number');
        samples.push(result.value);
      }
      const sorted = [...samples].sort((a, b) => a - b);
      results.push({
        operation, instrument, rows, samples,
        medianSeconds: sorted[Math.floor(repeats / 2)],
        maxSeconds: sorted.at(-1),
      });
      console.log(JSON.stringify(results.at(-1)));
    }
  }
} finally {
  await embedding.dispose();
}
await mkdir(join(projectRoot, 'artifacts'), { recursive: true });
await writeFile(join(projectRoot, 'artifacts/m2-benchmark.json'), JSON.stringify({
  runtime: 'Pyodide 314.0.7 / Python 3.14.2 / NumPy 2.4.6',
  setupExcluded: true, thresholdSeconds: 1, results,
}, null, 2));
for (const result of results) {
  assert(result.maxSeconds < 1,
    `${result.operation} instrument=${result.instrument}: ${result.maxSeconds}s >= 1s`);
}
console.log('PASS 200k-row Pyodide benchmark: every measured operation <1s, with and without tracing.');
