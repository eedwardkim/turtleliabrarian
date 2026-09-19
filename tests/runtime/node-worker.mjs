import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parentPort, workerData } from 'node:worker_threads';
import { numpyPackages, sha256 } from '../../scripts/prepare-runtime.mjs';
import { isEngineManifest } from '../../src/runtime/assets.ts';
import { executeRequest, initializeEngine, installEngineFile, normalizePythonNone } from '../../src/runtime/bridge.ts';
import { isRunRequest } from '../../src/runtime/protocol.ts';

assert(parentPort);
const { root, engine } = workerData;
assert.equal(typeof root, 'string');
const directory = join(root, 'public/pyodide');

try {
  const lock = JSON.parse(await readFile(join(directory, 'pyodide-lock.json'), 'utf8'));
  for (const entry of numpyPackages(lock)) {
    assert.equal(sha256(await readFile(join(directory, entry.file_name))), entry.sha256, 'Wheel integrity');
  }
  for (const file of ['pyodide.mjs', 'pyodide.asm.mjs', 'pyodide.asm.wasm', 'python_stdlib.zip', 'pyodide-lock.json']) {
    assert.equal(sha256(await readFile(join(directory, file))),
      sha256(await readFile(join(root, 'node_modules/pyodide', file))), `Local ${file} matches npm distribution`);
  }
  const { loadPyodide, version } = await import(pathToFileURL(join(directory, 'pyodide.mjs')).href);
  assert.equal(version, '314.0.7');
  const python = await loadPyodide({ indexURL: directory, packageCacheDir: directory });
  await python.loadPackage('numpy', { checkIntegrity: true, messageCallback: () => {} });
  const versions = JSON.parse(python.runPython(`
import sys, json, numpy as np
json.dumps({"python": sys.version.split()[0], "numpy": np.__version__})
`));
  assert.deepEqual(versions, { python: '3.14.2', numpy: '2.4.6' });

  if (engine) {
    const manifest = JSON.parse(await readFile(join(root, 'public/engine/manifest.json'), 'utf8'));
    assert(isEngineManifest(manifest), 'Valid engine manifest');
    assert(manifest.files.some((file) => file.path === 'shelf_runtime.py'), 'Real shelf_runtime.py required');
    for (const file of manifest.files) {
      const bytes = await readFile(join(root, 'public/engine', file.path));
      assert.equal(bytes.byteLength, file.size);
      assert.equal(sha256(bytes), file.sha256);
      installEngineFile(python, file, bytes);
    }
    initializeEngine(python);
  }

  parentPort.on('message', (message) => {
    try {
      if (message.type === 'smoke') {
        python.runPython(`
assert np.arange(1, 5).tolist() == [1, 2, 3, 4]
assert float(np.mean([2, 4, 6])) == 4.0
np.random.seed(27)
first = np.random.choice(50, 8).tolist()
np.random.seed(27)
assert first == np.random.choice(50, 8).tolist()
`);
        const proxy = python.runPython("{'value': None, 'rows': [[None, 42]], 'nested': {'none': None}}");
        assert(proxy instanceof python.ffi.PyProxy);
        try {
          assert.deepEqual(normalizePythonNone(proxy.toJs({
            dict_converter: Object.fromEntries, create_pyproxies: false,
          })), { value: null, rows: [[null, 42]], nested: { none: null } });
        } finally {
          proxy.destroy();
        }
        assert.throws(() => proxy.toString(), /destroyed/);
        parentPort.postMessage({ type: 'result', id: message.id, result: versions });
      } else if (message.type === 'run') {
        assert(engine, 'Engine execution was requested without loading an engine');
        assert(isRunRequest(message.request), 'Valid RunRequest');
        const result = executeRequest(python, message.request);
        parentPort.postMessage({ type: 'result', id: message.id, result });
      } else if (message.type === 'python') {
        assert.equal(typeof message.code, 'string');
        const value = python.runPython(message.code);
        try {
          assert(value === undefined || value === null || ['number', 'string', 'boolean'].includes(typeof value));
          parentPort.postMessage({ type: 'result', id: message.id, result: value ?? null });
        } finally {
          if (value instanceof python.ffi.PyProxy) value.destroy();
        }
      } else {
        throw new Error('Unknown embedding test request');
      }
    } catch (error) {
      parentPort.postMessage({ type: 'error', id: message.id, message: String(error) });
    }
  });
  parentPort.postMessage({ type: 'ready', versions });
} catch (error) {
  parentPort.postMessage({ type: 'failed', message: String(error) });
}
