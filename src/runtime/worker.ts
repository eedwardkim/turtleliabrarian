import type { PyodideAPI } from 'pyodide';
import { fetchEngineFile, fetchEngineManifest } from './assets.ts';
import { executeRequest, initializeEngine, installEngineFile } from './bridge.ts';
import { errorMessage, failureResult, isWorkerRequest } from './protocol.ts';
import type { WorkerReply } from './protocol.ts';

const send = (message: WorkerReply): void => postMessage(message);
let python: PyodideAPI | null = null;
let warming: Promise<void> | null = null;

async function warm(baseUrl: string): Promise<void> {
  send({ type: 'progress', progress: 0.05, message: 'Opening the Python library…' });
  const manifest = await fetchEngineManifest(baseUrl);
  const indexURL = new URL('pyodide/', baseUrl).href;
  const moduleUrl = new URL('pyodide.mjs', indexURL).href;
  const module: typeof import('pyodide') = await import(/* @vite-ignore */ moduleUrl);
  if (module.version !== '314.0.7') throw new Error('The served Pyodide version does not match the game.');
  send({ type: 'progress', progress: 0.15, message: 'Warming Python 3.14…' });
  const loaded = await module.loadPyodide({
    indexURL,
    lockFileURL: new URL('pyodide-lock.json', indexURL).href,
    packageBaseUrl: indexURL,
    stdin: () => null,
  });
  send({ type: 'progress', progress: 0.55, message: 'Stacking NumPy arrays…' });
  await loaded.loadPackage('numpy', { checkIntegrity: true });
  const numpyVersion: unknown = loaded.runPython('import numpy; numpy.__version__');
  if (numpyVersion !== '2.4.6') throw new Error('The served NumPy version does not match the game.');
  send({ type: 'progress', progress: 0.75, message: 'Shelving Python books and datasets…' });
  for (let index = 0; index < manifest.files.length; index += 1) {
    const file = manifest.files[index];
    installEngineFile(loaded, file, await fetchEngineFile(baseUrl, file));
    send({
      type: 'progress',
      progress: 0.75 + (0.2 * (index + 1)) / manifest.files.length,
      message: 'Shelving Python books and datasets…',
    });
  }
  initializeEngine(loaded);
  python = loaded;
  send({ type: 'ready' });
}

onmessage = (event: MessageEvent<unknown>): void => {
  if (!isWorkerRequest(event.data)) {
    send({ type: 'failed', message: 'The Python worker received an invalid request.' });
    return;
  }
  const message = event.data;
  if (message.type === 'init') {
    if (!warming) {
      warming = warm(message.baseUrl).catch((error: unknown) => {
        send({ type: 'failed', message: errorMessage(error) });
      });
    }
    return;
  }
  const start = performance.now();
  try {
    if (!python) throw new Error('Python is still warming up. Please try Run again.');
    const result = executeRequest(python, message.request);
    send({ type: 'result', id: message.id, result });
  } catch (error: unknown) {
    send({
      type: 'result', id: message.id,
      result: failureResult(message.request, 'RuntimeError', errorMessage(error),
        'Shelby could not run Python. Please try again; if this continues, reload the library.',
        performance.now() - start),
    });
  }
};
