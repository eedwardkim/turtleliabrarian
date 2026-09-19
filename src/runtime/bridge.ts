import type { PyodideAPI } from 'pyodide';
import type { RunRequest, RunResult } from '../contracts.ts';
import type { EngineFile } from './assets.ts';
import { isAssetPath } from './assets.ts';
import { isRecord, isRunResult } from './protocol.ts';

export function normalizePythonNone(value: unknown): unknown {
  if (value === undefined) return null;
  if (Array.isArray(value)) return value.map(normalizePythonNone);
  if (isRecord(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizePythonNone(item)]));
  }
  return value;
}

export function installEngineFile(pyodide: PyodideAPI, file: Pick<EngineFile, 'path'>, bytes: Uint8Array): void {
  if (!isAssetPath(file.path)) throw new Error(`Invalid engine path: ${file.path}`);
  const path = `/engine/${file.path}`;
  pyodide.FS.mkdirTree(path.slice(0, path.lastIndexOf('/')));
  pyodide.FS.writeFile(path, bytes);
}

export function initializeEngine(pyodide: PyodideAPI): void {
  pyodide.runPython(`
import os
import sys
if "/engine" not in sys.path:
    sys.path.insert(0, "/engine")
os.chdir("/engine")
from shelf_runtime import run
if not callable(run):
    raise TypeError("shelf_runtime.run must be callable")
`);
}

export function executeRequest(pyodide: PyodideAPI, request: RunRequest): RunResult {
  const globals: unknown = pyodide.toPy({ request_json: JSON.stringify(request) });
  if (!(globals instanceof pyodide.ffi.PyProxy)) throw new Error('Could not create Python request namespace.');
  let output: unknown;
  try {
    output = pyodide.runPython(`
import json
from shelf_runtime import run
run(json.loads(request_json))
`, { globals, filename: '<shelf-worker>' });
    if (!(output instanceof pyodide.ffi.PyProxy)) {
      throw new Error('shelf_runtime.run must return a dictionary matching RunResult.');
    }
    const result = normalizePythonNone(output.toJs({ dict_converter: Object.fromEntries, create_pyproxies: false }));
    if (!isRunResult(result)) throw new Error('The Python engine returned an invalid RunResult.');
    return result;
  } finally {
    if (output instanceof pyodide.ffi.PyProxy) output.destroy();
    globals.destroy();
  }
}
