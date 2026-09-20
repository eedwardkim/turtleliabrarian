import type { RunRequest, SandboxNotebook, SaveData } from '../contracts';
import { puzzles } from './catalog';

export const bundledDatasets = Object.keys(import.meta.glob('../../engine/data/*.csv', { eager: true, query: '?raw', import: 'default' }))
  .map(path => path.split('/').at(-1)!).sort();

export const defaultSandbox: SandboxNotebook = { dataset: '', code: 'from datascience import *\nimport numpy as np\n\n' };

export function sandboxUnlocked(save: Pick<SaveData, 'completed' | 'settings'>): boolean {
  return save.settings.openStacks || puzzles.every(puzzle => save.completed.includes(puzzle.id));
}

export function isSandboxDataset(dataset: string): boolean {
  return dataset === '' || puzzles.some(puzzle => puzzle.id === dataset) || bundledDatasets.some(file => `csv:${file}` === dataset);
}

export function sandboxRequest(notebook: SandboxNotebook, files: Record<string, string>): RunRequest {
  if (!isSandboxDataset(notebook.dataset)) throw new Error('Choose a dataset from the library.');
  const puzzle = puzzles.find(puzzle => puzzle.id === notebook.dataset);
  return {
    code: notebook.code,
    files: { ...files },
    inputCode: puzzle?.inputCode ?? (notebook.dataset ? `shelf = Table.read_table(${JSON.stringify(notebook.dataset.slice(4))})` : ''),
    inputs: puzzle?.visibleInputs,
    seed: puzzle?.visibleSeed ?? 0,
    instrument: true,
    budgetMs: 5000,
  };
}
