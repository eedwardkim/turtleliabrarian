import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/** Every capture installs the same browser clock so frames and seeds repeat exactly. */
export const EPOCH = new Date('2026-01-01T00:00:00Z');
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
export const VIEWPORT = { width: 1920, height: 1080 };
const KIND_ORDER = { show: 0, vary: 1, break: 2, capstone: 3 };

export function holdFrames(seconds, fps, smoke) {
  if (smoke) return 1;
  return Math.max(1, Math.round(seconds * fps));
}

export function videoSeconds(frames, fps) {
  return frames / fps;
}

export function ffmpegArgs({ pattern, count, fps, output }) {
  return [
    '-y', '-framerate', String(fps), '-i', pattern,
    '-frames:v', String(count), '-c:v', 'libx264', '-preset', 'medium', '-crf', '24',
    '-pix_fmt', 'yuv420p', '-an', '-movflags', '+faststart', output,
  ];
}

function sequence(id) {
  const digits = id.match(/\d+/g);
  return digits ? Number(digits[digits.length - 1]) : 0;
}

/** Mirrors `src/game/catalog.ts` so a tour walks requests in the order the game does. */
export function shelfOrder(left, right) {
  const key = puzzle => [puzzle.kind === 'capstone' ? Number.MAX_SAFE_INTEGER : puzzle.chapter, KIND_ORDER[puzzle.kind] ?? 9, sequence(puzzle.id)];
  const a = key(left);
  const b = key(right);
  for (let index = 0; index < a.length; index++) if (a[index] !== b[index]) return a[index] - b[index];
  return left.id.localeCompare(right.id);
}

export async function loadPuzzles(directory = 'content/puzzles') {
  const files = (await readdir(directory)).filter(name => name.endsWith('.json')).sort();
  const puzzles = await Promise.all(files.map(async name => JSON.parse(await readFile(resolve(directory, name), 'utf8'))));
  return puzzles.sort(shelfOrder);
}

export function chapterPuzzles(puzzles, chapter) {
  return puzzles.filter(puzzle => puzzle.chapter === chapter);
}

/**
 * Drives one recording: it owns the frame counter, the burned caption overlay,
 * the screenshot index and the coverage the tour claims. Nothing here inspects
 * React internals; every reading comes from `window.__SHELF__` or the rendered page.
 */
export class Recorder {
  constructor({ page, tour, root, fps = 30, smoke = false, url = '' }) {
    this.page = page;
    this.tour = tour;
    this.root = resolve(root);
    this.frameDirectory = resolve(this.root, 'frames');
    this.shotDirectory = resolve(this.root, 'screenshots');
    this.fps = fps;
    this.smoke = smoke;
    this.url = url;
    this.index = 0;
    this.captions = [];
    this.screenshots = [];
    this.coverage = { chapters: [], puzzles: [], tutorials: [], windows: [], failures: [], wings: [], standingOrders: [] };
  }

  async prepare() {
    await mkdir(this.frameDirectory, { recursive: true });
    await mkdir(this.shotDirectory, { recursive: true });
  }

  /** Freezes wall clock time; `frame()` is the only thing that moves the simulation. */
  async installClock() {
    await this.page.clock.install({ time: EPOCH });
    await this.page.clock.pauseAt(new Date(EPOCH.getTime() + 1000));
  }

  async installCaption() {
    await this.page.evaluate(() => {
      if (document.getElementById('capture-caption')) return;
      const caption = document.createElement('div');
      caption.id = 'capture-caption';
      caption.setAttribute('aria-hidden', 'true');
      Object.assign(caption.style, {
        position: 'fixed', bottom: '12px', left: '25%', width: '50%', textAlign: 'center',
        padding: '12px 20px', color: '#FBF8F1', background: '#2A2522',
        borderRadius: '6px', font: '20px "IBM Plex Sans", sans-serif',
        zIndex: '100000', pointerEvents: 'none',
      });
      document.body.append(caption);
    });
  }

  async frame() {
    await this.page.evaluate(seconds => window.__SHELF__.stepClock(seconds), 1 / this.fps);
    await this.page.clock.runFor(Math.round(1000 / this.fps) + 1);
    await this.page.screenshot({
      path: resolve(this.frameDirectory, `${String(this.index++).padStart(6, '0')}.png`),
      fullPage: true, animations: 'disabled',
    });
  }

  async hold(caption, seconds = 3) {
    this.captions.push({ frame: this.index, caption });
    await this.page.locator('#capture-caption').evaluate((element, value) => { element.textContent = value; }, caption);
    for (let count = 0; count < holdFrames(seconds, this.fps, this.smoke); count++) await this.frame();
    console.log(`${this.tour.id} ${this.index} frames: ${caption}`);
  }

  /** Waits for real Python and checker work, then captures settled animation frames. */
  async settle(seconds = 0.5) {
    await this.page.evaluate(() => window.__SHELF__.waitForIdle());
    for (let count = 0; count < holdFrames(seconds, this.fps, this.smoke); count++) await this.frame();
  }

  async click(name, scope = this.page) {
    await scope.getByRole('button', { name, exact: true }).click({ force: true });
    await this.page.clock.runFor(Math.round(1000 / this.fps) + 1);
  }

  async state() {
    return this.page.evaluate(() => {
      const game = window.__SHELF__.getState();
      return {
        screen: game.screen, puzzle: { id: game.puzzle.id, chapter: game.puzzle.chapter, kind: game.puzzle.kind, title: game.puzzle.title },
        pass: game.diff?.pass ?? null, busy: game.busy, status: game.status,
        queue: game.queue.map(entry => ({ name: entry.name, status: entry.status })),
        completed: game.save.completed, ownedItems: game.save.ownedItems,
        resources: game.save.resources, standingOrders: game.save.standingOrders.map(order => order.puzzleId),
        orders: game.save.standingOrders.map(order => ({ id: order.puzzleId, earned: order.earned, paused: order.paused })),
        settings: game.save.settings, openStacks: game.save.settings.openStacks,
        hat: game.save.hat, hatchlings: game.save.hatchlings,
      };
    });
  }

  async shot(category, id, caption = '') {
    const file = `${category}-${id}`.replace(/[^\w.-]+/g, '-');
    await this.page.screenshot({ path: resolve(this.shotDirectory, `${file}.png`), fullPage: true, animations: 'disabled' });
    this.screenshots.push({ category, id, frame: this.index, file: `screenshots/${file}.png`, caption });
    return file;
  }

  record(kind, value) {
    const list = this.coverage[kind];
    assert(list, `Unknown coverage kind: ${kind}`);
    const key = JSON.stringify(typeof value === 'object' ? value.id ?? value : value);
    if (!list.some(entry => JSON.stringify(typeof entry === 'object' ? entry.id ?? entry : entry) === key)) list.push(value);
  }

  manifest() {
    return {
      tour: this.tour.id,
      title: this.tour.title,
      fps: this.fps,
      frames: this.index,
      durationSeconds: Number(videoSeconds(this.index, this.fps).toFixed(3)),
      smoke: this.smoke,
      clock: EPOCH.toISOString(),
      url: this.url,
      video: `${this.tour.id}.mp4`,
      captions: this.captions,
      screenshots: this.screenshots,
      coverage: this.coverage,
    };
  }

  /** Writes the deterministic manifest, encodes silent H.264 and enforces the size budget. */
  async encode() {
    const manifest = this.manifest();
    await writeFile(resolve(this.root, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    await writeFile(resolve(this.root, 'captions.json'), `${JSON.stringify({ fps: this.fps, frames: this.index, captions: this.captions }, null, 2)}\n`);
    const output = resolve(this.root, `${this.tour.id}.mp4`);
    const result = spawnSync('ffmpeg', ffmpegArgs({
      pattern: resolve(this.frameDirectory, '%06d.png'), count: this.index, fps: this.fps, output,
    }), { stdio: 'inherit' });
    assert.equal(result.status, 0, 'ffmpeg must encode the captured UI and scene frames.');
    const bytes = (await stat(output)).size;
    assert(bytes < MAX_VIDEO_BYTES, `${this.tour.id} exceeds 50 MB.`);
    return { ...manifest, bytes };
  }
}
