import assert from 'node:assert/strict';
import { chapterPuzzles } from './capture-lib.mjs';
import {
  bootstrap, captureUrl, closeDialog, dismissTutorials, editor, nextRequest, openTool,
  playRequest, run, serveQueue, setCode, startNewGame, typeReference,
} from './capture-steps.mjs';

const TOOL = {
  shop: 'Shop & unlocks', orders: 'Standing orders', atlas: 'Atlas of wings', almanac: 'Almanac',
  settings: 'Settings', scratch: 'Scratch console', windows: 'Windows & layout', menu: 'Pause menu',
};
const CHAPTER_NAMES = [
  'The Returns Desk', 'Tables', 'Selecting and sorting', 'Grouping', 'Joins and pivots',
  'Charts', 'Sampling', 'Chance', 'Simulation', 'Confidence', 'Testing', 'Association', 'Prediction',
  'The Archive capstones',
];

function chapterTitle(chapter) {
  return CHAPTER_NAMES[chapter] ?? `Chapter ${chapter}`;
}

/** Opens a wing the way a player does: finish the previous request, then pay its stars. */
async function openWing(recorder, chapter, puzzles) {
  const { page } = recorder;
  const list = chapterPuzzles(puzzles, chapter);
  const first = list[0];
  const previous = puzzles[puzzles.indexOf(first) - 1];
  assert(previous, `Chapter ${chapter} must follow another chapter.`);

  await recorder.hold(`Developer navigation opens ${previous.title}; everything after this is played.`, 2);
  await page.evaluate(id => window.__SHELF__.gotoPuzzle(id), previous.id);
  await recorder.settle();
  await dismissTutorials(recorder);
  await playRequest(recorder, previous, {});

  await page.evaluate(value => window.__SHELF__.lockWingsFrom(value), chapter);
  await page.evaluate(() => window.__SHELF__.setResource('stars', 40));
  await recorder.settle(0.3);
  const before = await recorder.state();
  assert(!before.ownedItems.includes(`wing-${chapter}`), `Wing ${chapter} must still be closed before the tour opens it.`);
  await recorder.hold('Gold Stars are topped up by a developer control; the wing still charges its real price.', 2);

  await openTool(recorder, TOOL.atlas);
  await recorder.hold(`The Atlas shows ${chapterTitle(chapter)} still locked behind its star price.`, 3);
  await recorder.shot('window', `atlas-locked-${chapter}`, 'Atlas with the next wing locked');
  recorder.record('windows', 'atlas');
  await closeDialog(recorder);

  await recorder.click('Next request');
  await recorder.settle();
  await dismissTutorials(recorder);
  const after = await recorder.state();
  assert(after.ownedItems.includes(`wing-${chapter}`), `Wing ${chapter} must be opened by the game, not by the tour.`);
  const spent = before.resources.stars - after.resources.stars;
  assert(spent > 0, `Wing ${chapter} must cost Gold Stars.`);
  recorder.record('wings', { id: `wing-${chapter}`, starsSpent: spent });
  await recorder.hold(`${chapterTitle(chapter)} opens for ${spent} Gold Stars.`, 3);
  await recorder.shot('window', `wing-${chapter}`, `Wing ${chapter} opened for ${spent} stars`);
  assert.equal(after.puzzle.id, first.id, 'Opening a wing must land on its first request.');
}

async function playChapter(recorder, chapter, puzzles) {
  const list = chapterPuzzles(puzzles, chapter);
  const firstShow = list.find(puzzle => puzzle.kind === 'show') ?? list[0];
  const firstBreak = list.find(puzzle => puzzle.kind === 'break' && puzzle.naive?.length);
  const standing = list.find(puzzle => puzzle.standingOrder?.eligible);
  for (const [index, puzzle] of list.entries()) {
    if (index > 0) {
      const state = await nextRequest(recorder);
      assert.equal(state.puzzle.id, puzzle.id, `The tour must walk into ${puzzle.id} with Next request.`);
    }
    await playRequest(recorder, puzzle, {
      typed: puzzle.id === firstShow?.id,
      naive: puzzle.id === firstBreak?.id,
      standingOrder: puzzle.id === standing?.id,
    });
  }
}

function chapterRequirement(chapter, puzzles) {
  const list = chapterPuzzles(puzzles, chapter);
  return {
    chapters: [chapter],
    puzzles: list.map(puzzle => puzzle.id),
    kinds: [...new Set(list.map(puzzle => puzzle.kind))],
    minTutorials: 1,
    minWings: 1,
    minFailures: list.some(puzzle => puzzle.kind === 'break' && puzzle.naive?.length) ? 1 : 0,
    minStandingOrders: list.some(puzzle => puzzle.standingOrder?.eligible) ? 1 : 0,
    windows: ['atlas', 'queue', 'output'],
    screenshots: { puzzle: list.length, tutorial: 1, window: 2 },
  };
}

function chapterTour(chapter, id) {
  return {
    id,
    title: `${id} — ${chapterTitle(chapter)}`,
    description: `Wing unlock, new tutorials, a typed Show request, a naive Break failing through its own queue, the repair, a served queue and a filed standing order for chapter ${chapter}.`,
    chapter,
    expectedMinutes: 9,
    requirement: puzzles => chapterRequirement(chapter, puzzles),
    async run(context) {
      const { recorder, puzzles } = context;
      await recorder.hold(`${chapterTitle(chapter)} — chapter ${chapter} of Shelf Life.`, 3);
      await openWing(recorder, chapter, puzzles);
      await playChapter(recorder, chapter, puzzles);
      await recorder.hold(`Chapter ${chapter} is shelved.`, 3);
    },
  };
}

const prologue = {
  id: 'V00',
  title: 'V00 — The first ten minutes',
  description: 'Title, intro, opening tutorials and the first two prologue requests typed, run and served. Unchanged from the accepted V00 capture.',
  expectedMinutes: 6,
  requirement: puzzles => ({
    chapters: [0],
    puzzles: ['p0-01-stamp', 'p0-02-shares'].filter(id => puzzles.some(puzzle => puzzle.id === id)),
    minTutorials: 1,
    windows: ['queue', 'output'],
    screenshots: { puzzle: 2, tutorial: 1 },
  }),
  async run({ recorder, puzzles }) {
    await recorder.hold('Shelf Life — a library carried by Atlas, a sky turtle.', 4);
    await startNewGame(recorder);
    await dismissTutorials(recorder);
    for (const id of ['p0-01-stamp', 'p0-02-shares']) {
      const puzzle = puzzles.find(entry => entry.id === id);
      assert(puzzle, `The prologue request ${id} is missing from content/puzzles.`);
      await recorder.hold(puzzle.title);
      await recorder.shot('puzzle', puzzle.id, puzzle.title);
      const state = await recorder.state();
      assert.equal(state.puzzle.id, id, 'The tour must progress through the normal request controls.');
      await typeReference(recorder, puzzle.reference, 1);
      await recorder.hold('Real Python. The inputs change for every patron.', 2);
      await run(recorder);
      await recorder.hold('The exact answer appears in Output; Shelby delivers it in the world.', 5);
      assert.equal((await recorder.state()).pass, true);
      recorder.record('windows', 'output');
      const queue = await serveQueue(recorder);
      assert(queue.length > 0 && queue.every(entry => entry.status === 'passed'));
      await recorder.hold('A whole queue tests the solution on different shelves.', 4);
      recorder.record('windows', 'queue');
      recorder.record('puzzles', { id: puzzle.id, kind: puzzle.kind, chapter: puzzle.chapter, patrons: queue.length });
      recorder.record('chapters', puzzle.chapter);
      await recorder.click('Close window: The waiting line');
      if (id === 'p0-01-stamp') await nextRequest(recorder);
    }
    await recorder.hold('Two requests solved. A whole floating library still to discover.', 4);
  },
};

const capstones = {
  ...chapterTour(13, 'V13'),
  title: 'V13 — Capstones, credits and Open Stacks',
  description: 'The Archive capstones played end to end, then the credits page and Open Stacks in the Atlas.',
  expectedMinutes: 11,
  requirement: puzzles => ({
    ...chapterRequirement(13, puzzles),
    windows: ['atlas', 'queue', 'output', 'credits', 'settings'],
    screenshots: { puzzle: chapterPuzzles(puzzles, 13).length, tutorial: 1, window: 4 },
  }),
  async run(context) {
    const { recorder, puzzles } = context;
    await recorder.hold('The Archive — capstone requests, the credits and Open Stacks.', 3);
    await openWing(recorder, 13, puzzles);
    await playChapter(recorder, 13, puzzles);

    await openTool(recorder, TOOL.settings);
    await recorder.page.getByLabel('Open Stacks').check();
    await recorder.settle(0.3);
    assert.equal((await recorder.state()).openStacks, true, 'Open Stacks must be switched on through Settings.');
    await recorder.hold('Open Stacks hands over the full Python API; the requests stay the same.', 3);
    await recorder.shot('window', 'settings-open-stacks', 'Open Stacks enabled');
    recorder.record('windows', 'settings');
    await closeDialog(recorder);

    await openTool(recorder, TOOL.atlas);
    await recorder.hold('With Open Stacks on, every wing and request in the Atlas is reachable.', 3);
    await recorder.shot('window', 'atlas-open-stacks', 'Atlas with Open Stacks');
    recorder.record('windows', 'atlas');
    await closeDialog(recorder);

    await openTool(recorder, TOOL.menu);
    await recorder.click('Return to title');
    await recorder.settle(0.5);
    await recorder.click('Credits');
    await recorder.settle(0.5);
    assert.equal((await recorder.state()).screen, 'credits', 'The credits page must open from the title screen.');
    await recorder.hold('Credits: original writing, original art, original puzzles.', 5);
    await recorder.shot('window', 'credits', 'Credits page');
    recorder.record('windows', 'credits');
  },
};

const systems = {
  id: 'V14',
  title: 'V14 — Systems: resources, shop, hats, Atlas, orders, idle time, hatchlings, Almanac, hints, saves, settings',
  description: 'Every supporting system exercised through its own UI on a really solved request.',
  expectedMinutes: 8,
  requirement: () => ({
    minStandingOrders: 1,
    minTutorials: 1,
    windows: ['almanac', 'shop', 'orders', 'atlas', 'saves', 'settings', 'hints', 'output', 'queue'],
    screenshots: { window: 8, puzzle: 1, tutorial: 1 },
  }),
  async run({ recorder, puzzles }) {
    const { page } = recorder;
    const puzzle = chapterPuzzles(puzzles, 1).find(entry => entry.standingOrder?.eligible) ?? chapterPuzzles(puzzles, 1)[0];
    await recorder.hold('The systems around the desk: ink, stars, eggs, hats, wings and orders.', 3);
    await page.evaluate(id => window.__SHELF__.gotoPuzzle(id), puzzle.id);
    await recorder.settle();
    await dismissTutorials(recorder);

    await openTool(recorder, TOOL.almanac);
    await recorder.hold('The Almanac collects every tool the librarian has met.', 3);
    await recorder.shot('window', 'almanac', 'Almanac');
    recorder.record('windows', 'almanac');
    await closeDialog(recorder);

    for (let level = 0; level < 3; level++) {
      const hint = page.getByRole('button', { name: 'A small hint', exact: true });
      if (!await hint.count()) break;
      await hint.click({ force: true });
      await page.clock.runFor(34);
    }
    await recorder.hold('Three hints per request, opened only when they are wanted.', 3);
    await recorder.shot('window', 'hints', 'Hints opened');
    recorder.record('windows', 'hints');

    await playRequest(recorder, puzzle, { standingOrder: true });

    await page.evaluate(() => window.__SHELF__.setResource('ink', 200));
    await page.evaluate(() => window.__SHELF__.setResource('eggs', 2));
    await recorder.settle(0.3);
    await recorder.hold('A developer control tops up ink and eggs so the shop can be shown in one sitting.', 2);
    await openTool(recorder, TOOL.shop);
    const before = await recorder.state();
    for (let purchase = 0; purchase < 8; purchase++) {
      const buy = page.getByRole('button', { name: 'Purchase', exact: true });
      if (!await buy.count()) break;
      await buy.first().click({ force: true });
      await page.clock.runFor(34);
      await recorder.settle(0.2);
    }
    const wear = page.getByRole('button', { name: 'Wear this', exact: true });
    assert(await wear.count(), 'A purchased hat must offer to be worn.');
    await wear.first().click({ force: true });
    await recorder.settle(0.3);
    const shopped = await recorder.state();
    assert(shopped.ownedItems.length > before.ownedItems.length, 'The shop must sell through the real economy.');
    assert(shopped.hat, 'A hat must be worn through the shop.');
    assert(shopped.hatchlings > before.hatchlings, 'A hatchling must hatch from a real egg.');
    await recorder.hold(`Shop, hats and hatchlings: ${shopped.hat} is on, ${shopped.hatchlings} hatchling helping.`, 3);
    await recorder.shot('window', 'shop', 'Shop with purchases and a worn hat');
    recorder.record('windows', 'shop');
    await closeDialog(recorder);
    await recorder.hold('The hat and the hatchling appear on the desk in the scene.', 3);
    await recorder.shot('window', 'scene-hat-hatchling', 'Hat and hatchling in the scene');

    await openTool(recorder, TOOL.atlas);
    await recorder.hold('The Atlas of wings tracks every wing, its price and its requests.', 3);
    await recorder.shot('window', 'atlas', 'Atlas of wings');
    recorder.record('windows', 'atlas');
    await closeDialog(recorder);

    await page.evaluate(() => window.__SHELF__.stepClock(4 * 3600));
    await recorder.settle(1);
    await page.evaluate(() => window.__SHELF__.stepClock(8 * 3600));
    await recorder.settle(1);
    const idle = await recorder.state();
    assert(idle.orders.some(order => order.earned > 0), 'Idle time must pay the filed standing order.');
    await openTool(recorder, TOOL.orders);
    await recorder.hold('Time warp: the filed order keeps working, capped at eight hours away from the desk.', 4);
    await recorder.shot('window', 'orders', 'Standing orders after idle time');
    recorder.record('windows', 'orders');
    await closeDialog(recorder);

    await openTool(recorder, TOOL.menu);
    await recorder.click('Save & load');
    await recorder.click('Save here');
    await recorder.click('Replace this bookmark');
    await recorder.settle(0.5);
    await recorder.hold('Three local bookmarks, plus an export you can carry away.', 3);
    await recorder.shot('window', 'saves', 'Save slots');
    recorder.record('windows', 'saves');
    await closeDialog(recorder);
    await recorder.click('Back to the library');
    await recorder.settle(0.3);

    await openTool(recorder, TOOL.settings);
    await page.getByLabel('Colorblind-safe patterns').check();
    await recorder.settle(0.3);
    assert.equal((await recorder.state()).settings.colorblind, true, 'Colorblind-safe patterns must be switched on.');
    await recorder.hold('Colorblind-safe patterns, interface scale, motion and pace all live in Settings.', 4);
    await recorder.shot('window', 'settings', 'Settings with colorblind patterns on');
    recorder.record('windows', 'settings');
    await closeDialog(recorder);
    await recorder.hold('Charts and queue markers redraw with patterns as well as colour.', 3);
  },
};

const devtools = {
  id: 'V15',
  title: 'V15 — Developer tools',
  description: 'The developer panel: searchable actions, request and tutorial jumps, fixture and trace inspectors, resource and time controls, camera presets, wireframe, grid, renderer statistics and the deep links.',
  expectedMinutes: 6,
  requirement: () => ({
    minTutorials: 0,
    windows: ['devtools', 'devtools-fixtures', 'devtools-trace', 'devtools-scene', 'deep-link'],
    screenshots: { window: 5, puzzle: 1 },
  }),
  async run({ recorder, puzzles, href }) {
    const { page } = recorder;
    const puzzle = chapterPuzzles(puzzles, 1).find(entry => entry.naive?.length) ?? puzzles[0];
    await recorder.hold('Developer tools, opened with the backquote key.', 3);
    await page.evaluate(id => window.__SHELF__.gotoPuzzle(id), puzzle.id);
    await recorder.settle();
    await dismissTutorials(recorder);
    await recorder.shot('puzzle', puzzle.id, puzzle.title);
    recorder.record('puzzles', { id: puzzle.id, kind: puzzle.kind, chapter: puzzle.chapter, patrons: 0 });
    recorder.record('chapters', puzzle.chapter);

    await page.keyboard.press('Backquote');
    await recorder.settle(0.5);
    const panel = page.locator('.dev-panel');
    assert(await panel.count(), 'Backquote must open the developer panel.');
    await recorder.hold('Every developer action is searchable; nothing here is hidden from the tour.', 3);
    await recorder.shot('window', 'devtools', 'Developer panel');
    recorder.record('windows', 'devtools');

    await panel.getByLabel('Find an action').fill('naive');
    await recorder.settle(0.3);
    await recorder.hold('Searching the action list narrows it to the naive-solution demo.', 2);
    await panel.getByRole('button', { name: 'Play the naive solution', exact: true }).click({ force: true });
    await recorder.settle(1);
    await recorder.hold('The naive script runs for real; the panel reports the outcome.', 3);

    await panel.getByLabel('Replay speed').fill('4');
    await panel.getByLabel('Time warp (hours)').fill('2');
    await panel.getByRole('button', { name: 'Advance idle orders', exact: true }).click({ force: true });
    await panel.getByLabel('Amount').fill('120');
    await panel.getByRole('button', { name: 'Set', exact: true }).click({ force: true });
    await recorder.settle(1);
    const resourced = await recorder.state();
    assert.equal(resourced.resources.ink, 120, 'The resource control must write through the real save.');
    await recorder.hold('Resource and time controls write through the same save the game uses.', 3);

    for (const preset of ['returns', 'stacks', 'overview', 'top', 'default']) {
      await panel.getByRole('button', { name: preset, exact: true }).click({ force: true });
      await recorder.hold(`Camera preset: ${preset}.`, 1);
    }
    await panel.getByRole('button', { name: 'Wireframe', exact: true }).click({ force: true });
    await panel.getByRole('button', { name: 'Grid', exact: true }).click({ force: true });
    await recorder.settle(0.5);
    await recorder.hold('Wireframe, grid and the renderer statistics for budget checks.', 3);
    await recorder.shot('window', 'devtools-scene', 'Wireframe, grid and renderer statistics');
    recorder.record('windows', 'devtools-scene');
    await panel.getByRole('button', { name: 'Wireframe', exact: true }).click({ force: true });
    await panel.getByRole('button', { name: 'Grid', exact: true }).click({ force: true });

    await panel.getByText('Fixtures and solutions').click({ force: true });
    await recorder.settle(0.3);
    await recorder.hold('The fixture inspector shows the shelves, the reference and the naive scripts.', 3);
    await recorder.shot('window', 'devtools-fixtures', 'Fixture inspector');
    recorder.record('windows', 'devtools-fixtures');
    await panel.getByText('Fixtures and solutions').click({ force: true });
    await panel.getByText('Trace inspector').click({ force: true });
    await recorder.settle(0.3);
    await recorder.hold('The trace inspector shows the event the replay is drawing.', 3);
    await recorder.shot('window', 'devtools-trace', 'Trace inspector');
    recorder.record('windows', 'devtools-trace');

    const deep = captureUrl(href, { puzzle: puzzle.id, speed: '4' });
    await page.goto(deep.href);
    await page.waitForFunction(() => Boolean(window.__SHELF__));
    await recorder.installCaption();
    await recorder.settle(1);
    const linked = await recorder.state();
    assert.equal(linked.puzzle.id, puzzle.id, 'The deep link must open the requested request.');
    assert.equal(linked.settings.replaySpeed, 4, 'The deep link must apply the replay speed.');
    await recorder.hold(`Deep link: ?dev=1&capture=1&puzzle=${puzzle.id}&speed=4 opens the request at speed.`, 4);
    await recorder.shot('window', 'deep-link', 'Deep link opened');
    recorder.record('windows', 'deep-link');
  },
};

const speedrun = {
  id: 'V16',
  title: 'V16 — All 77 requests',
  description: 'Every request in the campaign solved with real Python and its real queue, inside an eight minute budget.',
  expectedMinutes: 8,
  requirement: puzzles => ({
    chapters: [...new Set(puzzles.map(puzzle => puzzle.chapter))],
    puzzles: puzzles.map(puzzle => puzzle.id),
    kinds: ['show', 'vary', 'break', 'capstone'],
    windows: ['output', 'queue'],
    screenshots: { puzzle: puzzles.length },
    maxDurationSeconds: 480,
  }),
  async run({ recorder, puzzles }) {
    const { page } = recorder;
    await recorder.hold(`Speedrun: all ${puzzles.length} requests, real Python, real queues.`, 3);
    for (const puzzle of puzzles) {
      await page.evaluate(id => window.__SHELF__.gotoPuzzle(id), puzzle.id);
      await recorder.settle(0.1);
      await dismissTutorials(recorder, 0.1);
      await setCode(recorder, puzzle.reference);
      await recorder.click('Run', editor(recorder));
      await recorder.settle(0.1);
      await dismissTutorials(recorder, 0.1);
      const queue = await serveQueue(recorder);
      assert(queue.length > 0 && queue.every(entry => entry.status === 'passed'), `${puzzle.id}: every queue patron must pass.`);
      await recorder.hold(`${puzzle.id} — ${puzzle.title}: ${queue.length} patrons served.`, 0.5);
      await recorder.shot('puzzle', puzzle.id, puzzle.title);
      recorder.record('puzzles', { id: puzzle.id, kind: puzzle.kind, chapter: puzzle.chapter, patrons: queue.length });
      recorder.record('chapters', puzzle.chapter);
      recorder.record('windows', 'output');
      recorder.record('windows', 'queue');
    }
    const state = await recorder.state();
    const missing = puzzles.filter(puzzle => !state.completed.includes(puzzle.id));
    assert.equal(missing.length, 0, `Requests left unfinished: ${missing.map(puzzle => puzzle.id).join(', ')}`);
    await recorder.hold(`All ${puzzles.length} requests answered.`, 4);
  },
};

export const tours = [
  prologue,
  ...Array.from({ length: 12 }, (_, index) => chapterTour(index + 1, `V${String(index + 1).padStart(2, '0')}`)),
  capstones,
  systems,
  devtools,
  speedrun,
];

export function tourById(id) {
  const tour = tours.find(entry => entry.id === id.toUpperCase());
  if (!tour) throw new Error(`Unknown tour: ${id}. Known tours: ${tours.map(entry => entry.id).join(', ')}`);
  return tour;
}

export { bootstrap, captureUrl };
