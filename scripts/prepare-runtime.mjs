import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const PYODIDE_VERSION = '314.0.7';
export const NUMPY_VERSION = '2.4.6';
export const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

export function numpyPackages(lock) {
  const found = new Map();
  const visit = (name) => {
    if (found.has(name)) return;
    const entry = lock.packages[name];
    if (!entry || !/^[\w.+-]+$/.test(entry.file_name) || !/^[a-f0-9]{64}$/.test(entry.sha256)) {
      throw new Error(`Invalid locked package: ${name}`);
    }
    found.set(name, entry);
    for (const dependency of entry.depends) visit(dependency);
  };
  visit('numpy');
  return [...found.values()];
}

async function isCorrect(path, digest) {
  try {
    return sha256(await readFile(path)) === digest;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

export async function cacheWheel(entry, target, download = fetch) {
  if (await isCorrect(target, entry.sha256)) return 'cached';
  const url = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/${entry.file_name}`;
  const response = await download(url, { signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error(`Could not download ${entry.name}: HTTP ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (sha256(bytes) !== entry.sha256) {
    throw new Error(`SHA256 mismatch for ${entry.file_name}; refusing to install`);
  }
  const temporary = `${target}.${process.pid}.download`;
  try {
    await writeFile(temporary, bytes);
    await rename(temporary, target);
  } finally {
    await rm(temporary, { force: true });
  }
  return 'downloaded';
}

async function walk(directory, prefix = '') {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
    if (entry.name.startsWith('.') || entry.name === '__pycache__') continue;
    const relative = prefix + entry.name;
    if (entry.isDirectory()) files.push(...await walk(join(directory, entry.name), `${relative}/`));
    else if (entry.isFile()) files.push(relative);
    else throw new Error(`Runtime sources must be regular files: ${join(directory, entry.name)}`);
  }
  return files;
}

export async function prepareEngine(root = projectRoot) {
  const sources = new Map();
  const engine = join(root, 'engine');
  for (const path of await walk(engine)) {
    if (path.endsWith('.py')) sources.set(path, { source: join(engine, path), kind: 'python' });
    else if (path.startsWith('data/') && /\.(csv|tsv|json|txt)$/i.test(path)) {
      sources.set(path, { source: join(engine, path), kind: 'dataset' });
    }
  }
  for (const directory of ['datasets', 'content/datasets', 'engine/datasets']) {
    for (const path of await walk(join(root, directory))) {
      if (!/\.(csv|tsv|json|txt)$/i.test(path)) continue;
      const target = `datasets/${path}`;
      const source = join(root, directory, path);
      const previous = sources.get(target);
      if (previous && sha256(await readFile(previous.source)) !== sha256(await readFile(source))) {
        throw new Error(`Conflicting bundled dataset: ${target}`);
      }
      sources.set(target, { source, kind: 'dataset' });
    }
  }
  const destination = join(root, 'public/engine');
  await mkdir(destination, { recursive: true });
  const files = [];
  for (const [path, { source, kind }] of [...sources].sort(([a], [b]) => a.localeCompare(b, 'en'))) {
    const bytes = await readFile(source);
    await mkdir(dirname(join(destination, path)), { recursive: true });
    await writeFile(join(destination, path), bytes);
    files.push({ path, kind, sha256: sha256(bytes), size: bytes.byteLength });
  }
  const kept = new Set(files.map((file) => file.path));
  for (const path of await walk(destination)) {
    if (path !== 'manifest.json' && !kept.has(path)) await rm(join(destination, path));
  }
  const manifest = { version: 1, files };
  await writeFile(join(destination, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

export async function prepareRuntime({ root = projectRoot, log = console.log } = {}) {
  const source = join(root, 'node_modules/pyodide');
  const distribution = JSON.parse(await readFile(join(source, 'package.json'), 'utf8'));
  const lock = JSON.parse(await readFile(join(source, 'pyodide-lock.json'), 'utf8'));
  if (distribution.version !== PYODIDE_VERSION || lock.info.python !== '3.14.2' ||
      lock.packages.numpy.version !== NUMPY_VERSION) {
    throw new Error('Pyodide/Python/NumPy pins changed; review runtime compatibility before preparing');
  }
  const destination = join(root, 'public/pyodide');
  await mkdir(destination, { recursive: true });
  for (const entry of await readdir(source, { withFileTypes: true })) {
    if (entry.isFile()) await copyFile(join(source, entry.name), join(destination, entry.name));
  }
  for (const entry of numpyPackages(lock)) {
    const status = await cacheWheel(entry, join(destination, entry.file_name));
    log(`${entry.name} ${entry.version}: ${status}, SHA256 verified`);
  }
  const manifest = await prepareEngine(root);
  log(`Pyodide ${PYODIDE_VERSION}, Python ${lock.info.python}; ${manifest.files.length} engine/data files`);
  if (!manifest.files.some((entry) => entry.path === 'shelf_runtime.py')) {
    log('Engine not present: embedding smoke is available; engine integration must wait for shelf_runtime.py.');
  }
  return manifest;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await prepareRuntime();
}
