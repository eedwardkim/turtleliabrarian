import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { NodeEmbedding } from './embedding.mjs';
import { engineCases } from './engine-cases.mjs';
import { projectRoot } from '../../scripts/prepare-runtime.mjs';
import { isRunRequest, isRunResult } from '../../src/runtime/protocol.ts';

function comparable(result) {
  const deterministic = { ...result };
  delete deterministic.elapsedMs;
  return deterministic;
}

function semantics(result) {
  const value = comparable(result);
  delete value.trace;
  return value;
}

function validate(test, result, instrument) {
  assert(isRunResult(result), `${test.name}: RunResult schema`);
  for (const [key, expected] of Object.entries(test.expected ?? {})) {
    assert.deepEqual(result[key], expected, `${test.name}: ${key}`);
  }
  for (const [key, expected] of Object.entries(test.expectedError ?? {})) {
    assert.equal(result.error?.[key], expected, `${test.name}: error.${key}`);
  }
  if (!instrument) assert.deepEqual(result.trace, []);
  else {
    assert(result.trace.length <= 2001, `${test.name}: bounded event count`);
    for (const [index, event] of result.trace.entries()) {
      assert.equal(event.seq, index);
      assert.equal(event.version, 1);
      assert(JSON.stringify(event.payload).length < 200_000, `${test.name}: bounded payload`);
    }
    for (const type of test.events ?? []) {
      assert(result.trace.some(event => event.type === type), `${test.name}: missing ${type} event`);
    }
  }
}

function runCPython(executable, cases) {
  return new Promise((resolveResult, reject) => {
    const command = /[/\\]/.test(executable) ? resolve(executable) : executable;
    const child = execFile(command, [join(projectRoot, 'tests/runtime/cpython-runner.py')], {
      timeout: 120_000, maxBuffer: 64 * 1024 * 1024,
      cwd: join(projectRoot, 'engine'),
      env: { ...process.env, PYTHONPATH: join(projectRoot, 'engine') },
    }, (error, stdout, stderr) => {
      if (error) reject(new Error(`CPython parity process failed: ${stderr}`, { cause: error }));
      else {
        try { resolveResult(JSON.parse(stdout)); } catch (error) { reject(error); }
      }
    });
    child.stdin.on('error', reject);
    child.stdin.end(JSON.stringify(cases.map((test) => test.request)));
  });
}

function options(args) {
  const result = { engine: false, smokeOnly: false, kill: false, cases: null, python: null };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--smoke') result.smokeOnly = true;
    else if (argument === '--engine') result.engine = true;
    else if (argument === '--kill') result.kill = true;
    else if (argument === '--cases' || argument === '--python') {
      const value = args[++index];
      if (!value || value.startsWith('--')) throw new Error(`${argument} requires a value`);
      result[argument.slice(2)] = value;
      result.engine = true;
    } else throw new Error(`Unknown argument: ${argument}`);
  }
  if (result.smokeOnly && result.engine) throw new Error('--smoke cannot be combined with engine/parity arguments');
  if (result.cases && !result.python) throw new Error('--cases requires --python for actual cross-runtime parity');
  return result;
}

export async function main(args) {
  const config = options(args);
  const manifest = JSON.parse(await readFile(join(projectRoot, 'public/engine/manifest.json'), 'utf8'));
  const hasEngine = manifest.files.some((file) => file.path === 'shelf_runtime.py');
  if (config.engine && !hasEngine) throw new Error('Engine is missing. Merge engine, then npm run prepare:runtime.');
  const useEngine = !config.smokeOnly && hasEngine;
  const embedding = new NodeEmbedding(projectRoot, useEngine);
  try {
    const versions = await embedding.request({ type: 'smoke' });
    console.log(`PASS actual self-hosted Pyodide 314.0.7 / Python ${versions.python} / NumPy ${versions.numpy}`);
    console.log('PASS NumPy math, seeded random, nested None conversion, PyProxy cleanup; all core/wheel hashes verified');
    if (!useEngine) {
      console.log('Engine contract/parity NOT RUN: embedding smoke is not engine parity.');
    } else {
      const results = new Map();
      for (const test of engineCases) {
        const result = await embedding.request({ type: 'run', request: test.request });
        assert(isRunResult(result), `${test.name}: RunResult schema`);
        for (const [key, expected] of Object.entries(test.expected ?? {})) {
          assert.deepEqual(result[key], expected, `${test.name}: ${key}`);
        }
        if (test.expectedError) {
          for (const [key, expected] of Object.entries(test.expectedError)) {
            assert.equal(result.error?.[key], expected, `${test.name}: error.${key}`);
          }
        }
        if (test.expectedTable) {
          assert.equal(result.error, null, `${test.name}: ${result.error?.message}`);
          assert.equal(result.delivered?.kind, 'table');
          for (const [key, expected] of Object.entries(test.expectedTable)) {
            assert.deepEqual(result.delivered[key], expected, `${test.name}: delivered.${key}`);
          }
        }
        if (test.sameAs) assert.deepEqual(comparable(result), comparable(results.get(test.sameAs)), test.name);
        results.set(test.name, result);
        console.log(`PASS engine contract: ${test.name}`);
      }
      if (config.python) {
        const cases = config.cases
          ? JSON.parse(await readFile(resolve(config.cases), 'utf8'))
          : engineCases.filter((test) => !test.timingDependent);
        assert(Array.isArray(cases) && cases.length > 0, 'Parity cases must be a nonempty JSON array');
        for (const test of cases) {
          assert(typeof test.name === 'string' && isRunRequest(test.request), 'Cases require name and valid request');
        }
        const expanded = cases.flatMap(test => [false, true].map(instrument => ({
          ...test, name: `${test.name} / instrument=${instrument}`,
          request: { ...test.request, instrument },
        })));
        const cpython = await runCPython(config.python, expanded);
        assert.equal(cpython.versions.python, '3.14.2');
        assert.equal(cpython.versions.numpy, '2.4.6', 'CPython must use the same NumPy as Pyodide');
        assert.equal(cpython.results.length, expanded.length);
        let uninstrumented;
        for (let index = 0; index < expanded.length; index += 1) {
          const test = expanded[index];
          const actual = await embedding.request({ type: 'run', request: test.request });
          validate(test, actual, test.request.instrument);
          validate(test, cpython.results[index], test.request.instrument);
          assert.deepEqual(comparable(actual), comparable(cpython.results[index]), test.name);
          if (test.request.instrument) {
            assert.deepEqual(semantics(actual), semantics(uninstrumented), `${test.name}: instrumentation parity`);
            const repeated = await embedding.request({ type: 'run', request: test.request });
            assert.deepEqual(comparable(actual), comparable(repeated), `${test.name}: repeat determinism`);
          } else uninstrumented = actual;
          console.log(`PASS CPython/Pyodide parity: ${test.name}`);
        }
        console.log(`PASS ${expanded.length} cross-runtime cases with on/off and repeat parity (CPython ${cpython.versions.python})`);
      } else {
        console.log('CPython parity NOT RUN: supply --python /path/to/pinned/python.');
      }
    }
    if (config.kill) {
      await assert.rejects(embedding.request({ type: 'python', code: 'while True:\n    pass' }), /exceeded 8000ms/);
      console.log('PASS real infinite Python loop terminated at the 8-second Node embedding deadline');
    }
  } finally {
    await embedding.dispose();
  }
}
