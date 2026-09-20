import assert from 'node:assert/strict';
import { VIEWPORT } from './capture-lib.mjs';

/** Every interaction below is a real UI event or a documented `window.__SHELF__` call. */

export function captureUrl(base, params = {}) {
  const url = new URL(base);
  url.searchParams.set('dev', '1');
  url.searchParams.set('capture', '1');
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
  return url;
}

export async function openPage(browser) {
  return browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });
}

export async function bootstrap(recorder, href) {
  const { page } = recorder;
  await recorder.prepare();
  await page.goto(href);
  await page.getByRole('button', { name: 'New game', exact: true }).waitFor({ timeout: 120_000 });
  await page.evaluate(() => document.fonts.ready);
  await recorder.installClock();
  await recorder.installCaption();
}

/** Title screen, the four story beats and the naming card, all through their buttons. */
export async function startNewGame(recorder, name = 'Shelby') {
  const { page } = recorder;
  await recorder.click('New game');
  for (let beat = 0; beat < 4; beat++) {
    await recorder.hold(await page.locator('.story-card h2').innerText(), 3);
    await recorder.click('Turn the page');
  }
  await page.getByLabel('Your librarian’s name', { exact: true }).fill(name);
  await recorder.hold(`Mrs. Quill hands the library to ${name}.`);
  await recorder.click('Open the library');
  await recorder.settle();
}

/** Walks the guided demo the game opens for a new library, waiting for each played step to finish. */
export async function walkDemo(recorder, seconds = 3) {
  const { page } = recorder;
  const dialog = page.locator('.demo-dialog');
  assert(await dialog.count(), 'A new library must open the guided demo.');
  for (let step = 0; step < 40; step++) {
    if (!await dialog.count()) return;
    await recorder.settle(0.2);
    const title = await dialog.locator('h2').innerText();
    await recorder.hold(title, seconds);
    await recorder.shot('tutorial', `demo-${step + 1}`, title);
    recorder.record('tutorials', `demo-${step + 1}`);
    await dialog.getByRole('button', { name: /^(Understood|Back to work)$/ }).click({ force: true });
    await page.clock.runFor(34);
  }
  throw new Error('The guided demo did not finish.');
}

/** Walks whatever tutorials the game queued, recording each one it actually showed. */
export async function dismissTutorials(recorder, seconds = 2) {
  const { page } = recorder;
  for (let step = 0; step < 120; step++) {
    const dialog = page.locator('.tutorial-dialog');
    if (!await dialog.count()) return;
    const id = await page.evaluate(() => window.__SHELF__.getTutorials().find(entry => entry.active)?.id ?? '');
    const title = await dialog.locator('h2').innerText();
    await recorder.hold(title, seconds);
    if (id) {
      recorder.record('tutorials', id);
      await recorder.shot('tutorial', id, title);
    }
    await dialog.getByRole('button', { name: /^(Understood|Back to work)$/ }).click({ force: true });
    await page.clock.runFor(34);
  }
  throw new Error('Tutorial registry did not settle.');
}

export function editor(recorder) {
  return recorder.page.locator('[data-window="editor"]');
}

/** Types a script character by character into the real CodeMirror editor. */
export async function typeReference(recorder, code, everyNthFrame = 3) {
  const { page } = recorder;
  await editor(recorder).locator('.cm-content').focus();
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await page.keyboard.press('Backspace');
  let typed = 0;
  for (const character of code) {
    await page.keyboard.insertText(character);
    if (typed++ % everyNthFrame === 0) await recorder.frame();
  }
  await recorder.frame();
}

export async function setCode(recorder, code) {
  await recorder.page.evaluate(value => window.__SHELF__.setCode(value), code);
  await recorder.frame();
}

export async function run(recorder) {
  await recorder.click('Run', editor(recorder));
  await recorder.settle();
  await dismissTutorials(recorder);
}

export async function serveQueue(recorder) {
  await recorder.click('Serve queue', editor(recorder));
  await recorder.settle();
  await dismissTutorials(recorder);
  return (await recorder.state()).queue;
}

export async function openTool(recorder, label) {
  await dismissTutorials(recorder);
  await recorder.page.getByRole('button', { name: label, exact: true }).click({ force: true });
  await recorder.page.clock.runFor(34);
}

export async function closeDialog(recorder) {
  await recorder.click('Close');
}

/**
 * Plays one request the way a patron sees it: a naive break attempt fails through
 * its real queue, the repair runs the real checker, and every passing queue is the
 * game's own verdict rather than the tour's.
 */
export async function playRequest(recorder, puzzle, { typed = false, naive = false, standingOrder = false } = {}) {
  await recorder.hold(`${puzzle.title} — ${puzzle.patron}`, 3);
  await recorder.shot('puzzle', puzzle.id, puzzle.title);
  const current = await recorder.state();
  assert.equal(current.puzzle.id, puzzle.id, `The tour must reach ${puzzle.id} through the normal request controls.`);

  if (naive && puzzle.naive?.length) {
    await recorder.hold('A tempting shortcut: the naive script that only fits the visible shelf.', 2);
    await setCode(recorder, puzzle.naive[0].code);
    await run(recorder);
    const failedQueue = await serveQueue(recorder);
    const failures = failedQueue.filter(entry => entry.status === 'failed');
    assert(failures.length > 0, `${puzzle.id}: the naive script must fail through its own queue.`);
    await recorder.hold(`${failures.length} of ${failedQueue.length} patrons came back. The shortcut does not generalise.`, 3);
    recorder.record('failures', { id: puzzle.id, failed: failures.length, total: failedQueue.length });
    await recorder.shot('failure', puzzle.id, `${failures.length} of ${failedQueue.length} patrons failed`);
    await recorder.recordWindow('queue');
  }

  if (typed) {
    await recorder.hold('The corrected script, typed into the editor.', 2);
    await typeReference(recorder, puzzle.reference);
  } else {
    await setCode(recorder, puzzle.reference);
  }
  await run(recorder);
  const afterRun = await recorder.state();
  assert.equal(afterRun.pass, true, `${puzzle.id}: the delivered value must satisfy the real checker.`);
  await recorder.hold('Real Python, real checker: the visible shelf is answered.', 2);
  await recorder.recordWindow('output');

  const queue = await serveQueue(recorder);
  assert(queue.length > 0 && queue.every(entry => entry.status === 'passed'), `${puzzle.id}: every queue patron must pass.`);
  await recorder.hold(`All ${queue.length} patrons served.`, 2);
  await recorder.recordWindow('queue');

  const completed = await recorder.state();
  assert(completed.completed.includes(puzzle.id), `${puzzle.id}: the game must mark the request complete.`);
  recorder.record('puzzles', { id: puzzle.id, kind: puzzle.kind, chapter: puzzle.chapter, patrons: queue.length });
  recorder.record('chapters', puzzle.chapter);
  await recorder.click('Close window: The waiting line');

  if (standingOrder && puzzle.standingOrder?.eligible && !completed.standingOrders.includes(puzzle.id)) {
    await recorder.click('File a standing order');
    await recorder.settle(0.3);
    await dismissTutorials(recorder);
    const filed = await recorder.state();
    assert(filed.standingOrders.includes(puzzle.id), `${puzzle.id}: the standing order must be filed by the game.`);
    recorder.record('standingOrders', puzzle.id);
    await recorder.hold('The checked script is filed as a standing order and keeps earning.', 2);
    await recorder.shot('window', `standing-order-${puzzle.id}`, 'Standing order filed');
    await recorder.recordWindow('request');
  }
}

/** Moves to the next request with the completed slip's own button. */
export async function nextRequest(recorder) {
  await recorder.click('Next request');
  await recorder.settle();
  await dismissTutorials(recorder);
  return recorder.state();
}
