import { spawnSync } from 'node:child_process';
import { accessSync, constants, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';

const candidates = [process.env.BLENDER_BIN, 'blender',
  '/Applications/Blender.app/Contents/MacOS/Blender',
  `${homedir()}/tools/Blender.app/Contents/MacOS/Blender`].filter(Boolean);
const blender = candidates.find((candidate) => {
  if (candidate === 'blender') return spawnSync(candidate, ['--version']).status === 0;
  try { accessSync(candidate, constants.X_OK); return true; } catch { return false; }
});
if (!blender) throw new Error('Install official Blender 4.5 LTS or set BLENDER_BIN.');
mkdirSync('public/models', { recursive: true });
mkdirSync('assets/previews', { recursive: true });
const result = spawnSync(blender, ['-b', '--factory-startup', '-P',
  resolve(process.argv.includes('--scene-preview') ? 'blender/scene_preview.py' : 'blender/build.py'),
  '--', ...process.argv.slice(2)], { stdio: 'inherit' });
process.exit(result.status ?? 1);
