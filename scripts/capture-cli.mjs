import { resolve } from 'node:path';

export const USAGE = `Usage: node scripts/capture.mjs [options]

  --tour V00,V03   capture the named tours (default: V00, or $CAPTURE_TOUR)
  --all            capture every tour, V00 through V16
  --smoke          one frame per caption; every assertion still runs
  --fps 30         frame rate, 30 by default and 24 accepted
  --output DIR     artifact root, one directory per tour (default: artifacts)
  --url URL        the running dev server (default: http://localhost:5173)
  --list           print the tours and their coverage, capture nothing
`;

function values(argv, flag) {
  const found = [];
  for (let index = 0; index < argv.length; index++) {
    if (argv[index] !== flag) continue;
    const value = argv[index + 1];
    if (value === undefined || value.startsWith('--')) throw new Error(`${flag} needs a value.`);
    found.push(value);
  }
  return found;
}

export function parseArgs(argv = [], env = {}, knownIds = []) {
  const all = argv.includes('--all');
  const requested = [...values(argv, '--tour'), ...(argv.includes('--tour') ? [] : [env.CAPTURE_TOUR ?? ''])]
    .flatMap(value => value.split(','))
    .map(value => value.trim().toUpperCase())
    .filter(Boolean);
  const selected = all ? [...knownIds] : (requested.length ? requested : ['V00']);
  const unknown = selected.filter(id => knownIds.length && !knownIds.includes(id));
  if (unknown.length) throw new Error(`Unknown tour: ${unknown.join(', ')}. Known tours: ${knownIds.join(', ')}`);
  const fps = Number(values(argv, '--fps').at(-1) ?? env.CAPTURE_FPS ?? 30);
  if (![24, 30].includes(fps)) throw new Error('Capture at 24 or 30 frames per second.');
  return {
    tours: [...new Set(selected)],
    smoke: argv.includes('--smoke'),
    list: argv.includes('--list'),
    fps,
    output: values(argv, '--output').at(-1) ?? env.CAPTURE_OUTPUT_ROOT ?? 'artifacts',
    singleOutput: values(argv, '--output').length ? undefined : env.CAPTURE_OUTPUT,
    url: values(argv, '--url').at(-1) ?? env.CAPTURE_URL ?? 'http://localhost:5173',
  };
}

/** One directory per tour, except the legacy single-tour `CAPTURE_OUTPUT` override. */
export function outputRoot(options, tourId) {
  if (options.singleOutput && options.tours.length === 1) return resolve(options.singleOutput);
  return resolve(options.output, tourId);
}
