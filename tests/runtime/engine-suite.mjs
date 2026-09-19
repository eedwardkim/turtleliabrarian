import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Worker } from 'node:worker_threads';
import { projectRoot } from '../../scripts/prepare-runtime.mjs';

const executable = resolve('.venv/bin/python');
const site = execFileSync(executable, ['-c', 'import sysconfig; print(sysconfig.get_path("purelib"))'], {
  encoding: 'utf8',
}).trim();
const directory = join(projectRoot, 'public/pyodide');
const { loadPyodide, version } = await import(pathToFileURL(join(directory, 'pyodide.mjs')).href);
assert.equal(version, '314.0.7');
const python = await loadPyodide({ indexURL: directory, packageCacheDir: directory });
await python.loadPackage('numpy', { checkIntegrity: true });
python.FS.mkdirTree(projectRoot);
python.FS.mount(python.FS.filesystems.NODEFS, { root: projectRoot }, projectRoot);
python.FS.mkdirTree('/test-deps');

const packages = ['py', 'pytest', '_pytest', '_hypothesis_pytestplugin',
  '_hypothesis_globals', '_hypothesis_ftz_detector', 'hypothesis',
  'sortedcontainers', 'iniconfig', 'packaging', 'pluggy', 'pygments'];
for (const entry of await readdir(site, { withFileTypes: true })) {
  if (!packages.some(name => entry.name === name || entry.name === `${name}.py`
    || entry.name.startsWith(`${name}-`))) continue;
  const target = `/test-deps/${entry.name}`;
  if (entry.isDirectory()) {
    python.FS.mkdirTree(target);
    python.FS.mount(python.FS.filesystems.NODEFS, { root: join(site, entry.name) }, target);
  } else {
    python.FS.writeFile(target, await readFile(join(site, entry.name)));
  }
}

const shared = new SharedArrayBuffer(8 * 1024 * 1024);
const state = new Int32Array(shared, 0, 2);
const oracle = new Worker(new URL('./oracle-host.mjs', import.meta.url), {
  workerData: { root: projectRoot, executable, shared },
});
python.registerJsModule('shelf_test_bridge', {
  oracle(request) {
    Atomics.store(state, 0, 0);
    oracle.postMessage(request);
    if (Atomics.wait(state, 0, 0, 120_000) === 'timed-out') throw new Error('Oracle bridge timed out');
    const text = new TextDecoder().decode(new Uint8Array(shared, 8, Atomics.load(state, 1)));
    if (Atomics.load(state, 0) !== 1) throw new Error(text);
    return text;
  },
});
try {
  python.globals.set('project_root', projectRoot);
  python.globals.set('pytest_args', JSON.stringify(process.argv.slice(2)));
  const status = python.runPython(`
import os, sys, json, tempfile
import numpy as np
assert sys.version.split()[0] == "3.14.2"
assert np.__version__ == "2.4.6"
sys.path[:0] = [project_root + "/engine", project_root + "/tests/engine", "/test-deps"]
os.chdir(project_root)
tempfile.tempdir = project_root + "/artifacts/python-tmp"
os.makedirs(tempfile.tempdir, exist_ok=True)
os.environ["PYTEST_DISABLE_PLUGIN_AUTOLOAD"] = "1"
import pytest
int(pytest.main(["tests/engine", "-q", "--tb=short", "-p", "_hypothesis_pytestplugin",
                *json.loads(pytest_args)]))
`);
  assert.equal(status, 0, 'The complete engine suite must pass under actual Pyodide');
} catch (error) {
  console.error(String(error));
  process.exitCode = 1;
} finally {
  oracle.postMessage(null);
  await new Promise(resolveExit => oracle.on('exit', resolveExit));
}
