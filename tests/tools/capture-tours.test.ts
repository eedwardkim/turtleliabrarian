import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { puzzles as catalogue } from '../../src/game/catalog';
import { chapterPuzzles, ffmpegArgs, holdFrames, loadPuzzles, videoSeconds } from '../../scripts/capture-lib.mjs';
import { tourById, tours } from '../../scripts/capture-tours.mjs';

const puzzles = await loadPuzzles();

describe('capture tour registry', () => {
  it('covers V00 through V16 once each', () => {
    expect(tours.map(tour => tour.id)).toEqual(Array.from({ length: 17 }, (_, index) => `V${String(index).padStart(2, '0')}`));
    expect(tourById('v09').id).toBe('V09');
    expect(() => tourById('V17')).toThrow(/Unknown tour/);
  });

  it('gives every tour a description, a runnable body and a coverage requirement', () => {
    for (const tour of tours) {
      expect(tour.description.length).toBeGreaterThan(20);
      expect(typeof tour.run).toBe('function');
      expect(tour.expectedMinutes).toBeGreaterThan(0);
      expect(tour.requirement(puzzles)).toBeTypeOf('object');
    }
  });

  it('requires every request of its chapter for V01 through V13', () => {
    for (let chapter = 1; chapter <= 13; chapter++) {
      const tour = tourById(`V${String(chapter).padStart(2, '0')}`);
      const requirement = tour.requirement(puzzles);
      const chapterIds = chapterPuzzles(puzzles, chapter).map(puzzle => puzzle.id);
      expect(chapterIds.length).toBeGreaterThan(0);
      expect(requirement.puzzles).toEqual(chapterIds);
      expect(requirement.chapters).toEqual([chapter]);
      expect(requirement.minWings).toBe(1);
      expect(requirement.screenshots.puzzle).toBe(chapterIds.length);
    }
  });

  it('asks the chapter tours for a naive failure and a filed standing order wherever the content allows one', () => {
    for (let chapter = 1; chapter <= 13; chapter++) {
      const list = chapterPuzzles(puzzles, chapter);
      const requirement = tourById(`V${String(chapter).padStart(2, '0')}`).requirement(puzzles);
      expect(requirement.minFailures).toBe(list.some(puzzle => puzzle.kind === 'break' && puzzle.naive?.length) ? 1 : 0);
      expect(requirement.minStandingOrders).toBe(list.some(puzzle => puzzle.standingOrder?.eligible) ? 1 : 0);
    }
  });

  it('holds V13 to the capstones, credits and Open Stacks, and V16 to all 77 requests in eight minutes', () => {
    const capstones = tourById('V13').requirement(puzzles);
    expect(capstones.windows).toEqual(expect.arrayContaining(['credits', 'settings', 'atlas']));
    const speedrun = tourById('V16').requirement(puzzles);
    expect(speedrun.puzzles).toHaveLength(77);
    expect(speedrun.kinds).toEqual(['show', 'vary', 'break', 'capstone']);
    expect(speedrun.maxDurationSeconds).toBe(480);
    expect(videoSeconds(480 * 30, 30)).toBe(480);
  });

  it('asks V14 and V15 for the systems and developer surfaces', () => {
    expect(tourById('V14').requirement(puzzles).windows).toEqual(expect.arrayContaining([
      'almanac', 'shop', 'orders', 'atlas', 'saves', 'settings', 'hints',
    ]));
    expect(tourById('V15').requirement(puzzles).windows).toEqual(expect.arrayContaining([
      'devtools', 'devtools-fixtures', 'devtools-trace', 'devtools-scene', 'deep-link',
    ]));
  });
});

describe('capture primitives', () => {
  it('reads requests in the order the game shelves them', async () => {
    expect(puzzles.map(puzzle => puzzle.id)).toEqual(catalogue.map(puzzle => puzzle.id));
    expect((await readdir('content/puzzles')).filter(name => name.endsWith('.json'))).toHaveLength(77);
  });

  it('holds captions for whole seconds and collapses them in smoke mode', () => {
    expect(holdFrames(3, 30, false)).toBe(90);
    expect(holdFrames(0.5, 24, false)).toBe(12);
    expect(holdFrames(0.01, 30, false)).toBe(1);
    expect(holdFrames(4, 30, true)).toBe(1);
  });

  it('encodes silent, faststart H.264 at the captured frame rate', () => {
    const args = ffmpegArgs({ pattern: 'frames/%06d.png', count: 120, fps: 24, output: 'V05.mp4' });
    expect(args.join(' ')).toContain('-framerate 24 -i frames/%06d.png -frames:v 120');
    expect(args).toEqual(expect.arrayContaining(['-c:v', 'libx264', '-crf', '24', '-pix_fmt', 'yuv420p', '-an', '-movflags', '+faststart']));
    expect(args.at(-1)).toBe('V05.mp4');
  });
});

describe('public test API contract', () => {
  it('only calls window.__SHELF__ members that src/game/devtools.ts exports', async () => {
    const source = await readFile('src/game/devtools.ts', 'utf8');
    const block = source.slice(source.indexOf('export const shelfApi = {'));
    const exposed = new Set([...block.slice(0, block.indexOf('\n};')).matchAll(/^ {2}(\w+)[:,]/gm)].map(match => match[1]));
    expect(exposed.size).toBeGreaterThan(10);
    const files = (await readdir('scripts')).filter(name => name.startsWith('capture'));
    const used = new Set<string>();
    for (const name of files) {
      const script = await readFile(resolve('scripts', name), 'utf8');
      for (const match of script.matchAll(/window\.__SHELF__\.(\w+)/g)) used.add(match[1]);
    }
    expect(used.size).toBeGreaterThan(5);
    expect([...used].filter(name => !exposed.has(name))).toEqual([]);
  });

  it('keeps the controls the tours depend on', async () => {
    const source = await readFile('src/game/devtools.ts', 'utf8');
    for (const name of ['gotoPuzzle', 'lockWingsFrom', 'setResource', 'setSettings', 'getPuzzles', 'getTutorials', 'stepClock', 'waitForIdle']) {
      expect(source).toContain(name);
    }
  });
});
