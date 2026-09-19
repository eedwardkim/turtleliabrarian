import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import {
  fetchEngineFile, fetchEngineManifest, isEngineManifest, runtimeBaseUrl,
} from '../../src/runtime/assets.ts';
import { normalizePythonNone } from '../../src/runtime/bridge.ts';
import { isRunRequest, isRunResult } from '../../src/runtime/protocol.ts';

afterEach(() => vi.unstubAllGlobals());

describe('runtime assets and wire boundary', () => {
  it.each([
    ['/', 'https://shelf.example/game/', 'https://shelf.example/'],
    ['/shelf/', 'https://shelf.example/shelf/?dev=1', 'https://shelf.example/shelf/'],
    ['./', 'https://shelf.example/shelf/index.html', 'https://shelf.example/shelf/'],
  ])('resolves local Vite base %s from %s', (base, page, expected) => {
    expect(runtimeBaseUrl(base, page)).toBe(expected);
  });

  it('rejects a CDN asset base', () => {
    expect(() => runtimeBaseUrl('https://cdn.example/', 'https://shelf.example/')).toThrow('self-hosted');
  });

  it.each(['../secret.py', '/absolute.py', 'data//x.csv', 'https://bad/x.py', 'a/./x.py', 'a%2fb.py'])(
    'rejects manifest traversal or unsafe path %s', (path) => {
      expect(isEngineManifest({
        version: 1, files: [{ path, kind: 'python', size: 1, sha256: 'a'.repeat(64) }],
      })).toBe(false);
    },
  );

  it('requires a real engine entry point and gives setup errors for missing assets', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ version: 1, files: [] }))));
    await expect(fetchEngineManifest('https://shelf.example/game/')).rejects.toThrow('engine is missing');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 404 })));
    await expect(fetchEngineManifest('https://shelf.example/game/')).rejects.toThrow('prepare:runtime');
  });

  it('checks exact engine bytes and digest before installing', async () => {
    const source = 'def run(request):\n    return request\n';
    const bytes = new TextEncoder().encode(source);
    const file = {
      path: 'shelf_runtime.py', kind: 'python' as const, size: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    };
    const fetcher = vi.fn().mockImplementation(async () => new Response(source));
    vi.stubGlobal('fetch', fetcher);
    expect(await fetchEngineFile('https://shelf.example/shelf/', file)).toEqual(bytes);
    expect(String(fetcher.mock.calls[0][0])).toBe('https://shelf.example/shelf/engine/shelf_runtime.py');
    await expect(fetchEngineFile('https://shelf.example/', { ...file, sha256: '0'.repeat(64) }))
      .rejects.toThrow('integrity');
    await expect(fetchEngineFile('https://shelf.example/', { ...file, size: 1 })).rejects.toThrow('integrity');
  });

  it('preserves None as JSON null in tables, trace payloads, and errors', () => {
    expect(normalizePythonNone({
      value: undefined, error: undefined, rows: [[undefined, 2]], trace: [{ payload: { x: undefined } }],
    })).toEqual({ value: null, error: null, rows: [[null, 2]], trace: [{ payload: { x: null } }] });
  });

  it('validates complete engine results and rejects nonfinite values or missing fields', () => {
    const result = {
      stdout: '', value: { kind: 'table', labels: ['a'], rows: [[null]], totalRows: 1 },
      delivered: null, error: null, trace: [], elapsedMs: 0, inputs: {},
    };
    expect(isRunResult(result)).toBe(true);
    expect(isRunResult({ ...result, value: NaN })).toBe(false);
    expect(isRunResult({ ...result, inputs: undefined })).toBe(false);
    expect(isRunResult({ ...result, error: { message: 'oops' } })).toBe(false);
    expect(isRunRequest({ code: '42', inputs: { a: null }, files: { 'helper.py': 'x = 1' } })).toBe(true);
    expect(isRunRequest({ code: '42', budgetMs: -1 })).toBe(false);
  });
});
