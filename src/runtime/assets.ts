import { isRecord } from './protocol.ts';

export interface EngineFile {
  path: string;
  kind: 'python' | 'dataset';
  size: number;
  sha256: string;
}

export interface EngineManifest {
  version: 1;
  files: EngineFile[];
}

export function isAssetPath(path: string): boolean {
  return path.split('/').every((segment) => /^[\w.-]+$/.test(segment) && segment !== '.' && segment !== '..');
}

export function isEngineManifest(value: unknown): value is EngineManifest {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.files)) return false;
  const paths = new Set<string>();
  return value.files.every((file: unknown) => {
    if (!isRecord(file) || typeof file.path !== 'string' || !isAssetPath(file.path) ||
        paths.has(file.path) || (file.kind !== 'python' && file.kind !== 'dataset') ||
        typeof file.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(file.sha256) ||
        typeof file.size !== 'number' || !Number.isSafeInteger(file.size) || file.size < 0) return false;
    paths.add(file.path);
    return true;
  });
}

export function runtimeBaseUrl(base: string, pageUrl: string): string {
  const url = new URL(base, pageUrl);
  if (url.origin !== new URL(pageUrl).origin) throw new Error('Python runtime assets must be self-hosted.');
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  url.search = '';
  url.hash = '';
  return url.href;
}

export async function fetchEngineManifest(baseUrl: string): Promise<EngineManifest> {
  const response = await fetch(new URL('engine/manifest.json', baseUrl));
  if (!response.ok) throw new Error(`Engine manifest could not load (HTTP ${response.status}). Run npm run prepare:runtime.`);
  const manifest: unknown = await response.json();
  if (!isEngineManifest(manifest)) throw new Error('Engine manifest is invalid. Run npm run prepare:runtime again.');
  if (!manifest.files.some((file) => file.path === 'shelf_runtime.py' && file.kind === 'python')) {
    throw new Error('The Python engine is missing. Prepare runtime assets after engine integration.');
  }
  return manifest;
}

export async function fetchEngineFile(baseUrl: string, file: EngineFile): Promise<Uint8Array> {
  const response = await fetch(new URL(`engine/${file.path}`, baseUrl));
  if (!response.ok) throw new Error(`Could not load ${file.path} (HTTP ${response.status}).`);
  const bytes = await response.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  if (bytes.byteLength !== file.size || hash !== file.sha256) {
    throw new Error(`Engine file ${file.path} failed its integrity check. Refresh the game after rebuilding assets.`);
  }
  return new Uint8Array(bytes);
}
