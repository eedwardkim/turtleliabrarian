import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { parentPort, workerData } from 'node:worker_threads';
import { join } from 'node:path';

const { root, executable, shared } = workerData;
const state = new Int32Array(shared, 0, 2);
const bytes = new Uint8Array(shared, 8);
const environment = { ...process.env };
delete environment.PYTHONPATH;
const oracle = spawn(executable, ['-I', join(root, 'tests/engine/oracle.py')], {
  cwd: root, env: environment, stdio: ['pipe', 'pipe', 'inherit'],
});

function respond(text, status) {
  const encoded = new TextEncoder().encode(text);
  if (encoded.length > bytes.length) {
    respond('Oracle response exceeded test transport capacity', -1);
    return;
  }
  bytes.set(encoded);
  Atomics.store(state, 1, encoded.length);
  Atomics.store(state, 0, status);
  Atomics.notify(state, 0);
}

createInterface({ input: oracle.stdout }).on('line', line => respond(line, 1));
oracle.on('error', error => respond(String(error), -1));
oracle.on('exit', code => respond(`Oracle process exited (${code})`, -1));
parentPort.on('message', message => {
  if (message === null) {
    oracle.stdin.end();
    parentPort.close();
  } else {
    oracle.stdin.write(message);
  }
});
