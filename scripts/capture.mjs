import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

const fps = 30;
const smoke = process.argv.includes('--smoke');
const root = resolve(process.env.CAPTURE_OUTPUT ?? 'artifacts/V00');
const frames = resolve(root, 'frames');
await mkdir(frames, { recursive: true });
const url = new URL(process.env.CAPTURE_URL ?? 'http://localhost:5173');
url.searchParams.set('dev', '1');
url.searchParams.set('capture', '1');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
let index = 0;
const captions = [];

async function frame() {
  await page.evaluate(seconds => window.__SHELF__.stepClock(seconds), 1 / fps);
  await page.clock.runFor(34);
  await page.screenshot({
    path: resolve(frames, `${String(index++).padStart(6, '0')}.png`),
    fullPage: true, animations: 'disabled',
  });
}

async function hold(caption, seconds = 3) {
  captions.push({ frame: index, caption });
  await page.locator('#capture-caption').evaluate((element, value) => { element.textContent = value; }, caption);
  for (let count = 0; count < (smoke ? 1 : Math.round(seconds * fps)); count++) await frame();
  console.log(`${index} frames: ${caption}`);
}

async function click(name, scope = page) {
  await scope.getByRole('button', { name, exact: true }).click({ force: true });
  await page.clock.runFor(34);
}

async function tutorials() {
  for (let step = 0; step < 60; step++) {
    const dialog = page.locator('.tutorial-dialog');
    if (!await dialog.count()) return;
    await hold(await dialog.locator('h2').innerText(), 2);
    await dialog.getByRole('button', { name: /^(Understood|Back to work)$/ }).click({ force: true });
    await page.clock.runFor(34);
  }
  throw new Error('Tutorial registry did not settle.');
}

try {
  await page.goto(url.href);
  await page.getByRole('button', { name: 'New game', exact: true }).waitFor({ timeout: 120_000 });
  await page.evaluate(() => document.fonts.ready);
  const epoch = new Date('2026-01-01T00:00:00Z');
  await page.clock.install({ time: epoch });
  await page.clock.pauseAt(new Date(epoch.getTime() + 1000));
  await page.evaluate(() => {
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
  await hold('Shelf Life — a library carried by Atlas, a sky turtle.', 4);
  await click('New game');
  for (let beat = 0; beat < 4; beat++) {
    await hold(await page.locator('.story-card h2').innerText(), 3);
    await click('Turn the page');
  }
  await page.getByLabel('Your librarian’s name', { exact: true }).fill('Shelby');
  await hold('Mrs. Quill hands the library to Shelby.');
  await click('Open the library');
  await page.evaluate(() => window.__SHELF__.waitForIdle());
  await tutorials();

  for (const id of ['p0-01-stamp', 'p0-02-shares']) {
    const puzzle = JSON.parse(await readFile(resolve('content/puzzles', `${id}.json`), 'utf8'));
    const active = await page.evaluate(() => window.__SHELF__.getState().puzzle.id);
    assert.equal(active, id, 'The tour must progress through the normal request controls.');
    await hold(puzzle.title);
    const editor = page.locator('[data-window="editor"]');
    await editor.locator('.cm-content').focus();
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
    await page.keyboard.press('Backspace');
    for (const character of puzzle.reference) {
      await page.keyboard.insertText(character);
      await frame();
    }
    await hold('Real Python. The inputs change for every patron.', 2);
    await click('Run', editor);
    await page.evaluate(() => window.__SHELF__.waitForIdle());
    await tutorials();
    await hold('The exact answer appears in Output; Shelby delivers it in the world.', 5);
    assert.equal(await page.evaluate(() => window.__SHELF__.getState().diff?.pass), true);
    await click('Serve queue', editor);
    await page.evaluate(() => window.__SHELF__.waitForIdle());
    await tutorials();
    assert(await page.evaluate(() => window.__SHELF__.getState().queue.every(entry => entry.status === 'passed')));
    await hold('A whole queue tests the solution on different shelves.', 4);
    await click('Close window: The waiting line');
    if (id === 'p0-01-stamp') {
      await click('Next request');
      await page.evaluate(() => window.__SHELF__.waitForIdle());
      await tutorials();
    }
  }
  await hold('Two requests solved. A whole floating library still to discover.', 4);
  await writeFile(resolve(root, 'captions.json'), JSON.stringify({ fps, frames: index, captions }, null, 2));
  const result = spawnSync('ffmpeg', [
    '-y', '-framerate', String(fps), '-i', resolve(frames, '%06d.png'),
    '-frames:v', String(index), '-c:v', 'libx264', '-preset', 'medium', '-crf', '24',
    '-pix_fmt', 'yuv420p', '-an', '-movflags', '+faststart', resolve(root, 'V00.mp4'),
  ], { stdio: 'inherit' });
  assert.equal(result.status, 0, 'ffmpeg must encode the captured UI and scene frames.');
  assert((await stat(resolve(root, 'V00.mp4'))).size < 50 * 1024 * 1024, 'V00 exceeds 50 MB.');
  console.log(`Captured ${index} deterministic frames to ${root}/V00.mp4`);
} finally {
  await browser.close();
}
