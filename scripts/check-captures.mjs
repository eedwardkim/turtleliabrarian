/**
 * Capture artifact gate. `make verify` fails while any V00-V16 media is missing, truncated or
 * short of its declared coverage, so an unrecorded release cannot pass as a recorded one.
 *
 *   node scripts/check-captures.mjs [--root artifacts] [--tour V00,V13] [--pending-ok]
 *
 * --pending-ok reports the missing tours without failing, for milestone runs where the media
 * pass has not started yet. Damaged or incomplete artifacts still fail under that flag.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { coverageGaps } from './capture-coverage.mjs';
import { loadPuzzles } from './capture-lib.mjs';
import { tours } from './capture-tours.mjs';

const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

function flag(argv, name, fallback) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : fallback;
}

/** One row per tour: PENDING when nothing was captured, FAIL with the reasons when it is wrong. */
export function inspectCaptures(tours_, puzzles, root) {
  return tours_.map(tour => {
    const directory = resolve(root, tour.id);
    const manifestPath = resolve(directory, 'manifest.json');
    if (!existsSync(manifestPath)) return { tour: tour.id, result: 'PENDING', detail: `no ${tour.id}/manifest.json under ${root}` };

    let manifest;
    try {
      manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    } catch (error) {
      return { tour: tour.id, result: 'FAIL', detail: `manifest.json is unreadable: ${error.message}` };
    }

    const problems = [];
    if (manifest.tour !== tour.id) problems.push(`manifest names tour ${manifest.tour}`);
    if (manifest.smoke) problems.push('captured with --smoke, which records one frame per caption');
    const video = resolve(directory, manifest.video ?? `${tour.id}.mp4`);
    if (!existsSync(video)) problems.push(`missing video ${manifest.video ?? `${tour.id}.mp4`}`);
    else {
      const bytes = statSync(video).size;
      if (!bytes) problems.push('the video file is empty');
      if (bytes >= MAX_VIDEO_BYTES) problems.push(`the video is ${(bytes / 1e6).toFixed(1)} MB, over the 50 MB budget`);
    }
    for (const shot of manifest.screenshots ?? []) {
      if (!existsSync(resolve(directory, shot.file ?? ''))) problems.push(`missing screenshot ${shot.file ?? shot.id}`);
    }
    problems.push(...coverageGaps(manifest, tour.requirement(puzzles)));
    return problems.length
      ? { tour: tour.id, result: 'FAIL', detail: problems.join('; ') }
      : { tour: tour.id, result: 'PASS', detail: `${manifest.frames} frames, ${manifest.durationSeconds}s` };
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2);
  const root = flag(argv, '--root', 'artifacts');
  const selected = flag(argv, '--tour', '')
    .split(',').map(value => value.trim().toUpperCase()).filter(Boolean);
  const chosen = selected.length ? tours.filter(tour => selected.includes(tour.id)) : tours;
  const unknown = selected.filter(id => !tours.some(tour => tour.id === id));
  if (unknown.length) {
    console.error(`Unknown tour: ${unknown.join(', ')}`);
    process.exit(2);
  }

  const rows = inspectCaptures(chosen, await loadPuzzles(), root);
  console.table(rows);
  const failed = rows.filter(row => row.result === 'FAIL');
  const pending = rows.filter(row => row.result === 'PENDING');
  for (const row of [...failed, ...pending]) console.error(`${row.result} ${row.tour}: ${row.detail}`);
  const blocking = failed.length || (pending.length && !argv.includes('--pending-ok'));
  console.log(blocking
    ? `Capture coverage incomplete: ${failed.length} failing, ${pending.length} never recorded.`
    : `Capture coverage: ${rows.length - pending.length}/${rows.length} tours recorded.`);
  process.exit(blocking ? 1 : 0);
}
