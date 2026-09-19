import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.error || result.status !== 0) {
    throw new Error(`${command} failed. Install Node 24 and uv, then retry make setup.`, { cause: result.error });
  }
}

if (Number(process.versions.node.split('.')[0]) !== 24) throw new Error('Use Node 24.');
run('npm', [process.argv.includes('--incremental') ? 'install' : 'ci']);
run('uv', ['python', 'install', '3.14.2']);
if (!existsSync('.venv')) run('uv', ['venv', '--python', '3.14.2', '.venv']);
run('uv', ['pip', 'sync', '--python', '.venv/bin/python', '--require-hashes', 'engine-requirements.txt']);
run('npm', ['run', 'prepare:runtime']);
run('npx', ['playwright', 'install', 'chromium', 'firefox']);
