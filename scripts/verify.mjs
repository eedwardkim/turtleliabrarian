import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const milestone = process.argv.find(argument => /^--milestone=m[12]$/.test(argument));
const checks = [
  ['Runtime assets', 'npm', ['run', 'prepare:runtime']],
  ['TypeScript', 'npm', ['run', 'typecheck']],
  ['ESLint', 'npm', ['run', 'lint']],
  ['Ruff', '.venv/bin/ruff', ['check', 'engine', 'tests/engine', 'scripts/validate-content.py', 'tests/content/validator_test.py']],
  ['Ruff formatting', '.venv/bin/ruff', ['format', '--check', 'engine', 'tests/engine']],
  ['Python engine and oracle', '.venv/bin/pytest', ['tests/engine', '-q', '--tb=short']],
  ['Content validator tests', '.venv/bin/python', ['-m', 'unittest', 'discover', '-s', 'tests/content', '-p', '*_test.py']],
  ['TypeScript tests', 'npm', ['test']],
  ['Puzzle fixtures and 500 seeds', '.venv/bin/python', ['scripts/validate-content.py', '--engine', 'engine']],
  ['CPython / Pyodide parity', 'node', ['scripts/test-pyodide.mjs', '--engine', '--cases', 'tests/engine/cases.json', '--python', resolve('.venv/bin/python'), '--kill']],
  ['Same Python engine suite under Pyodide', 'node', ['tests/runtime/engine-suite.mjs']],
  ['200k-row Pyodide performance', 'node', ['tests/runtime/benchmark.mjs']],
  ['Models', 'node', ['scripts/validate-models.mjs']],
  ['Production build', 'npm', ['run', 'build']],
];
const results = [];
for (const [name, command, args] of checks) {
  console.log(`\n=== ${name} ===`);
  const start = performance.now();
  const result = spawnSync(command, args, { stdio: 'inherit', env: { ...process.env, PYTHONPATH: resolve('engine') } });
  results.push({ check: name, result: result.status === 0 ? 'PASS' : 'FAIL', seconds: ((performance.now() - start) / 1000).toFixed(1) });
}
if (!milestone) {
  const count = readdirSync('content/puzzles').filter(name => name.endsWith('.json')).length;
  results.push({ check: `Release campaign: ${count}/77 puzzles`, result: count === 77 ? 'PASS' : 'FAIL', seconds: '0' });
}
console.table(results);
console.log(milestone ? `${milestone.slice(12).toUpperCase()} automated checks only; independent review and browser/visual acceptance are separate.` : 'Release acceptance also requires recorded browser, visual, deployment and clean-clone evidence.');
process.exitCode = results.some(result => result.result === 'FAIL') ? 1 : 0;
