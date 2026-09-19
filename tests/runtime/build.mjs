import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { build } from 'vite';
import { projectRoot } from '../../scripts/prepare-runtime.mjs';

for (const [name, base] of [['root', '/'], ['subpath', '/shelf/'], ['relative', './']]) {
  const outDir = join(projectRoot, 'artifacts/runtime-build', name);
  await build({
    root: projectRoot,
    configFile: false,
    base,
    build: {
      outDir,
      emptyOutDir: true,
      copyPublicDir: false,
      lib: { entry: join(projectRoot, 'src/runtime/client.ts'), formats: ['es'], fileName: 'client' },
    },
  });
  const workers = (await readdir(join(outDir, 'assets'))).filter((file) => /^worker-.*\.js$/.test(file));
  assert.equal(workers.length, 1, 'Dedicated worker must be emitted');
  const worker = await readFile(join(outDir, 'assets', workers[0]), 'utf8');
  assert(worker.includes('pyodide.mjs'), 'Worker must import the self-hosted Pyodide module');
  assert(!worker.includes('cdn.jsdelivr.net'), 'Worker must not embed a runtime CDN URL');
  const client = await readFile(join(outDir, 'client.js'), 'utf8');
  assert(client.includes('new Worker'), 'The client must create a dedicated worker');
  assert(!client.includes('http://') && !client.includes('https://'), 'No hardcoded asset origins');
  console.log(`PASS Vite runtime worker build at base ${base}`);
}
