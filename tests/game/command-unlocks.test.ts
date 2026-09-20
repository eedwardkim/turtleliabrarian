import { describe, expect, it } from 'vitest';
import { createGame } from '../../src/game/controller';
import { getPuzzle, puzzles } from '../../src/game/catalog';
import { commandTutorialId, explainedCommands, pendingCommands } from '../../src/game/commands';
import { createSaveService, exportJSON, freshSave, importJSON, type Snapshot } from '../../src/game/saves';

function rangeSave() {
  return {
    ...freshSave(), started: true, puzzleId: 'ch1-show-2',
    completed: [...puzzles.filter(puzzle => puzzle.chapter === 0).map(puzzle => puzzle.id), 'ch1-show-1'],
    seenTutorials: ['almanac', commandTutorialId('make_array'), commandTutorialId('array-math')],
  };
}

describe('command explanations and booklet unlocks', () => {
  it('preserves the quiet lessons without granting their obsolete bulk unlock lists', () => {
    const save = rangeSave();
    for (const puzzle of puzzles.filter(puzzle => puzzle.lesson)) {
      expect(pendingCommands(puzzle, save)).toEqual([]);
    }
    expect(explainedCommands(save)).toEqual(['deliver', 'str', 'make_array', 'array-math']);
    expect(explainedCommands(save)).not.toContain('round');
    expect(explainedCommands(save)).not.toContain('comparisons');
  });

  it('requires the range explanation even after an older Almanac tour or completed range request', () => {
    const save = rangeSave();
    save.completed.push('ch1-show-2');
    save.settings.openStacks = true;
    expect(pendingCommands(getPuzzle(save.puzzleId), save).map(entry => entry.id)).toEqual(['np.arange']);
    expect(explainedCommands(save)).not.toContain('np.arange');
  });

  it('does not queue unseen commands from earlier requests', () => {
    const save = rangeSave();
    save.seenTutorials = [];
    expect(pendingCommands(getPuzzle(save.puzzleId), save).map(entry => entry.id)).toEqual(['np.arange']);
    expect(pendingCommands(getPuzzle('ch1-show-1'), save).map(entry => entry.id)).toEqual(['make_array', 'array-math']);
  });

  it('persists only acknowledged explanations, including the comparison, across export/import and slots', async () => {
    const snapshots = new Map<number, Snapshot>();
    const persistence = createSaveService({
      read: async slot => snapshots.get(slot), write: async (slot, snapshot) => { snapshots.set(slot, snapshot); },
      readActiveSlot: async () => 0, writeActiveSlot: async () => undefined,
    });
    const store = createGame({
      init: async () => undefined, run: async () => { throw new Error('No Python execution expected'); },
      stop: () => {}, dispose: () => {},
    }, persistence);
    const save = rangeSave();
    save.seenTutorials = ['almanac'];
    await store.getState().importSave(exportJSON(save));
    store.getState().acknowledgeCommand('join');
    expect(store.getState().save.seenTutorials).toEqual(['almanac']);
    store.getState().acknowledgeCommand('np.arange');
    const acknowledged = importJSON(store.getState().exportSave());
    expect(explainedCommands(acknowledged)).toEqual(['deliver', 'str', 'make_array', 'np.arange']);
    expect(pendingCommands(getPuzzle(save.puzzleId), acknowledged)).toEqual([]);
    expect(store.getState().activeTutorial).toBeNull();
    expect(store.getState().tutorialQueue).toEqual([]);
    await store.getState().saveSlot(1);
    await store.getState().loadSlot(0);
    store.getState().newGame('New learner');
    expect(explainedCommands(store.getState().save)).toEqual([]);
    await store.getState().loadSlot(1);
    expect(explainedCommands(store.getState().save)).toContain('np.arange');
    expect(pendingCommands(getPuzzle(save.puzzleId), store.getState().save)).toEqual([]);
    expect(store.getState().save.files).toEqual(save.files);
    store.getState().disposeGame();
  });
});
