import { describe, expect, it } from 'vitest';
import { puzzles } from '../../src/game/catalog';
import { bundledDatasets, defaultSandbox, isSandboxDataset, sandboxRequest, sandboxUnlocked } from '../../src/game/sandbox';
import { exportJSON, freshSave, importJSON, parseSave } from '../../src/game/saves';

describe('Open Stacks notebook', () => {
  it('unlocks after the whole campaign or an explicit Open Stacks setting', () => {
    const save = freshSave();
    expect(sandboxUnlocked(save)).toBe(false);
    save.completed = puzzles.filter(puzzle => puzzle.kind === 'capstone').map(puzzle => puzzle.id);
    expect(sandboxUnlocked(save)).toBe(false);
    save.completed = puzzles.map(puzzle => puzzle.id);
    expect(sandboxUnlocked(save)).toBe(true);
    save.completed = [];
    save.settings.openStacks = true;
    expect(sandboxUnlocked(save)).toBe(true);
  });
  it('exposes all campaign shelves and bundled files without a teaching API limit', () => {
    expect(bundledDatasets).toEqual(['ch5-loans.csv', 'ch5-members.csv', 'shelf.csv']);
    for (const puzzle of puzzles) {
      const request = sandboxRequest({ dataset: puzzle.id, code: 'print(1)' }, {});
      expect(request).toMatchObject({ code: 'print(1)', inputCode: puzzle.inputCode, seed: puzzle.visibleSeed, instrument: true });
      expect(request.allowedApi).toBeUndefined();
      expect(request.inputs).toEqual(puzzle.visibleInputs);
    }
    expect(sandboxRequest({ dataset: 'csv:shelf.csv', code: 'shelf.show()' }, {})).toMatchObject({ inputCode: 'shelf = Table.read_table("shelf.csv")' });
    expect(isSandboxDataset('csv:../secrets.csv')).toBe(false);
    expect(() => sandboxRequest({ dataset: 'missing', code: '' }, {})).toThrow('Choose a dataset');
  });
  it('persists a separate notebook and migrates old saves without changing campaign files', () => {
    const save = freshSave();
    const files = { ...save.files };
    save.sandbox = { dataset: 'capstone-4', code: 'deliver(shelf)' };
    const imported = importJSON(exportJSON(save));
    expect(imported.sandbox).toEqual(save.sandbox);
    expect(imported.files).toEqual(files);
    const { sandbox: _sandbox, ...legacy } = save;
    expect(_sandbox.dataset).toBe('capstone-4');
    expect(parseSave(legacy).sandbox).toEqual(defaultSandbox);
    expect(() => parseSave({ ...save, sandbox: { code: '', dataset: 'csv:../../unknown.csv' } })).toThrow('Invalid Sandbox');
    expect(() => parseSave({ ...save, sandbox: { code: 'x'.repeat(100_001), dataset: '' } })).toThrow('Invalid Sandbox');
  });
});
