import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { cacheWheel, numpyPackages, prepareEngine, sha256 } from '../../scripts/prepare-runtime.mjs';

let root: string;

beforeEach(async () => {
  await mkdir(resolve('artifacts'), { recursive: true });
  root = await mkdtemp(resolve('artifacts/runtime-'));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('self-hosted runtime preparation', () => {
  it('resolves the locked NumPy dependency closure once and rejects unsafe lock entries', () => {
    const dependency = { name: 'dep', file_name: 'dep.whl', sha256: 'a'.repeat(64), depends: [] };
    const numpy = { name: 'numpy', file_name: 'numpy.whl', sha256: 'b'.repeat(64), depends: ['dep', 'dep'] };
    expect(numpyPackages({ packages: { numpy, dep: dependency } })).toEqual([numpy, dependency]);
    expect(() => numpyPackages({ packages: { numpy: { ...numpy, file_name: '../bad' } } })).toThrow('Invalid');
  });

  it('caches only verified wheels and refuses corrupted downloads', async () => {
    const bytes = new TextEncoder().encode('wheel fixture');
    const entry = { name: 'numpy', file_name: 'numpy.whl', sha256: sha256(bytes) };
    const target = join(root, 'numpy.whl');
    const download = vi.fn().mockImplementation(async () => new Response(bytes));
    expect(await cacheWheel(entry, target, download)).toBe('downloaded');
    expect(await cacheWheel(entry, target, download)).toBe('cached');
    expect(download).toHaveBeenCalledTimes(1);
    expect(String(download.mock.calls[0][0])).toBe('https://cdn.jsdelivr.net/pyodide/v314.0.7/full/numpy.whl');
    await writeFile(target, 'corrupt local file');
    expect(await cacheWheel(entry, target, download)).toBe('downloaded');
    await writeFile(target, 'keep me');
    const invalid = vi.fn().mockResolvedValue(new Response('incorrect release bytes'));
    await expect(cacheWheel(entry, target, invalid)).rejects.toThrow('SHA256 mismatch');
    expect(await readFile(target, 'utf8')).toBe('keep me');
  });

  it('fails clearly on download HTTP errors', async () => {
    const entry = { name: 'numpy', file_name: 'numpy.whl', sha256: 'a'.repeat(64) };
    await expect(cacheWheel(entry, join(root, 'wheel'), async () => new Response('', { status: 503 })))
      .rejects.toThrow('HTTP 503');
  });

  it('reruns after engine merges and removes stale generated files', async () => {
    expect((await prepareEngine(root)).files).toEqual([]);
    await mkdir(join(root, 'engine/datascience'), { recursive: true });
    await mkdir(join(root, 'content/datasets'), { recursive: true });
    await writeFile(join(root, 'engine/shelf_runtime.py'), 'def run(request):\n    return request\n');
    await writeFile(join(root, 'engine/datascience/__init__.py'), 'x = 1\n');
    await writeFile(join(root, 'content/datasets/books.csv'), 'title,pages\nClouds,12\n');
    const manifest = await prepareEngine(root);
    expect(manifest.files.map((file: { path: string }) => file.path)).toEqual([
      'datascience/__init__.py', 'datasets/books.csv', 'shelf_runtime.py',
    ]);
    expect(await prepareEngine(root)).toEqual(manifest);
    await rm(join(root, 'engine/datascience/__init__.py'));
    await prepareEngine(root);
    await expect(readFile(join(root, 'public/engine/datascience/__init__.py'))).rejects.toThrow('ENOENT');
    expect(await readFile(join(root, 'public/engine/datasets/books.csv'), 'utf8')).toContain('Clouds');
  });

  it('rejects conflicting dataset paths and symlinks escaping source roots', async () => {
    await mkdir(join(root, 'datasets'));
    await mkdir(join(root, 'content/datasets'), { recursive: true });
    await writeFile(join(root, 'datasets/books.csv'), 'first');
    await writeFile(join(root, 'content/datasets/books.csv'), 'second');
    await expect(prepareEngine(root)).rejects.toThrow('Conflicting');
    await rm(join(root, 'content/datasets/books.csv'));
    await symlink(join(root, 'datasets/books.csv'), join(root, 'content/datasets/linked.csv'));
    await expect(prepareEngine(root)).rejects.toThrow('regular files');
  });
});
