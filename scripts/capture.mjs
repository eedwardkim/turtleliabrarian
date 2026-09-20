import { chromium } from '@playwright/test';
import { outputRoot, parseArgs, USAGE } from './capture-cli.mjs';
import { assertCoverage } from './capture-coverage.mjs';
import { loadPuzzles, Recorder } from './capture-lib.mjs';
import { bootstrap, captureUrl, openPage } from './capture-steps.mjs';
import { tourById, tours } from './capture-tours.mjs';

if (process.argv.includes('--help')) {
  console.log(USAGE);
  process.exit(0);
}

const options = parseArgs(process.argv.slice(2), process.env, tours.map(tour => tour.id));
const puzzles = await loadPuzzles();

if (options.list) {
  for (const tour of tours) {
    const requirement = tour.requirement(puzzles);
    console.log(`${tour.id}  ~${tour.expectedMinutes} min  ${tour.description}`);
    console.log(`      requests: ${(requirement.puzzles ?? []).length}, chapters: ${(requirement.chapters ?? []).join(', ') || 'n/a'}`);
  }
  process.exit(0);
}

const browser = await chromium.launch();
const captured = [];
try {
  for (const id of options.tours) {
    const tour = tourById(id);
    const page = await openPage(browser);
    const root = outputRoot(options, tour.id);
    const href = captureUrl(options.url).href;
    const recorder = new Recorder({ page, tour, root, fps: options.fps, smoke: options.smoke, url: href });
    try {
      await bootstrap(recorder, href);
      await tour.run({ recorder, page, puzzles, href, smoke: options.smoke });
      const manifest = await recorder.encode();
      assertCoverage(manifest, tour.requirement(puzzles));
      captured.push(manifest);
      console.log(`${tour.id}: ${manifest.frames} frames, ${manifest.durationSeconds}s, ${(manifest.bytes / 1e6).toFixed(1)} MB -> ${root}/${tour.id}.mp4`);
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
}
console.log(`Captured ${captured.length} tour(s): ${captured.map(manifest => manifest.tour).join(', ')}`);
