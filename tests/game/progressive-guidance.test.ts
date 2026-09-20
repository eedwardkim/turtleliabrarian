import { describe, expect, it } from 'vitest';
import { getPuzzle, puzzles } from '../../src/game/catalog';
import { automaticTutorial, canReveal } from '../../src/game/guidance';
import { createGame } from '../../src/game/controller';
import { createSaveService } from '../../src/game/saves';

describe('tools arrive with a reason to use them', () => {
  const lessonIds = puzzles.filter(puzzle => puzzle.lesson).map(puzzle => puzzle.id);
  it('keeps lessons quiet even for a returning player with advanced progress', () => {
    for (const id of lessonIds) {
      for (const tool of ['queue', 'almanac', 'scratch', 'replay', 'scripts'] as const) {
        expect(canReveal(getPuzzle(id), puzzles.map(puzzle => puzzle.id), tool)).toBe(false);
      }
      expect(automaticTutorial('run-pass', getPuzzle(id), [])).toBeNull();
    }
  });
  it('does not dump every tool on the first array puzzle', () => {
    for (const tool of ['queue', 'almanac', 'scratch', 'replay', 'scripts'] as const) {
      expect(canReveal(getPuzzle('ch1-show-1'), lessonIds, tool)).toBe(false);
    }
    expect(automaticTutorial('puzzle', getPuzzle('ch1-show-1'), [])).toBeNull();
    expect(automaticTutorial('run-pass', getPuzzle('ch1-show-1'), [])).toBe('queue');
    expect(automaticTutorial('complete', getPuzzle('ch1-show-1'), [])).toBeNull();
  });
  it('introduces reference examples with ranges and scratch with table transformations', () => {
    expect(automaticTutorial('puzzle', getPuzzle('ch1-show-2'), ['queue'])).toBe('almanac');
    expect(automaticTutorial('puzzle', getPuzzle('ch2-show-2'), ['queue', 'almanac'])).toBe('scratch');
    expect(automaticTutorial('puzzle', getPuzzle('ch2-show-2'), ['queue', 'almanac', 'scratch'])).toBeNull();
  });
  it('retains introduced tools when a later puzzle needs fewer APIs', () => {
    expect(canReveal(getPuzzle('ch1-show-1'), ['ch1-show-2'], 'almanac')).toBe(true);
    expect(canReveal(getPuzzle('ch2-show-1'), ['ch2-show-2'], 'scratch')).toBe(true);
  });
  it('never builds a backlog from completion, hints, settings or topic triggers', () => {
    const persistence = createSaveService({
      read: async () => undefined, write: async () => undefined,
      readActiveSlot: async () => undefined, writeActiveSlot: async () => undefined,
    });
    const store = createGame({
      init: async () => undefined, run: async () => { throw new Error('Not run'); }, stop: () => {}, dispose: () => {},
    }, persistence);
    store.getState().setSettings({ openStacks: true });
    store.getState().gotoPuzzle('ch1-show-2');
    expect(store.getState().activeTutorial).toBe('almanac');
    store.getState().showMove();
    store.getState().setSettings({ editorFontSize: 18 });
    store.getState().triggerTutorial('complete');
    expect(store.getState().tutorialQueue).toEqual([]);
    store.getState().dismissTutorial();
    expect(store.getState().activeTutorial).toBeNull();
    store.getState().gotoPuzzle('ch1-show-2');
    expect(store.getState().activeTutorial).toBeNull();
    store.getState().disposeGame();
  });
});
