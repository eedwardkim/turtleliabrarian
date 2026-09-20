import { openDB, type DBSchema } from 'idb';
import type { QueueEntry, RunResult, SandboxNotebook, SaveData, Settings, StandingOrder, TraceEvent, WindowLayout } from '../contracts';
import { getPuzzle, puzzles } from './catalog';
import { defaultSandbox, isSandboxDataset } from './sandbox';
import { finite, inputsAreValid, record, strings, valueIsValid } from './validation';

export interface PuzzleProgress {
  code: string;
  hints: number;
  attempts: number;
  solvedCode?: string;
  solvedFiles?: Record<string, string>;
}

export interface GameSave extends SaveData {
  sandbox: SandboxNotebook;
  activeFile: string;
  progress: Record<string, PuzzleProgress>;
  orderFiles: Record<string, Record<string, string>>;
}

export const defaultSettings: Settings = {
  muted: false, ambience: true, masterVolume: 0.7, musicVolume: 0.35, sfxVolume: 0.65, replaySpeed: 1,
  reducedMotion: false, uiScale: 1, editorFontSize: 14, colorblind: false, openStacks: false,
};

export function freshSave(name = 'Shelby', now = Date.now()): GameSave {
  return {
    version: 1, started: false, name: name.trim().slice(0, 40) || 'Shelby', puzzleId: puzzles[0].id, completed: [],
    files: { 'main.py': puzzles[0].starter }, activeFile: 'main.py', progress: {}, orderFiles: {},
    resources: { ink: 0, stars: 0, oil: 0, eggs: 0, served: 0 }, settings: { ...defaultSettings },
    layouts: {}, seenTutorials: [], standingOrders: [], lastSavedAt: now, ownedItems: [], hat: '', hatchlings: 0, sandbox: { ...defaultSandbox },
  };
}

export function validFilename(name: string): boolean {
  return /^[A-Za-z_][A-Za-z_0-9]*\.py$/.test(name) &&
    !['datascience.py', 'numpy.py', 'random.py', 'sys.py', 'builtins.py', 'shelf_runtime.py', '__init__.py'].includes(name);
}

function readFiles(value: unknown): Record<string, string> {
  if (!record(value) || !Object.keys(value).length || Object.keys(value).length > 32) throw new Error('Save needs between one and 32 script files.');
  const entries = Object.entries(value).map(([name, source]): [string, string] => {
    if (!validFilename(name) || typeof source !== 'string' || source.length > 100_000) throw new Error('Invalid Python file in save.');
    return [name, source];
  });
  return Object.fromEntries(entries);
}

function numberIn(value: unknown, low: number, high: number, label: string): number {
  if (!finite(value) || value < low || value > high) throw new Error(`Invalid ${label} in save.`);
  return value;
}

function integerIn(value: unknown, low: number, high: number, label: string): number {
  const result = numberIn(value, low, high, label);
  if (!Number.isInteger(result)) throw new Error(`Invalid ${label} in save.`);
  return result;
}

function boolean(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new Error('Invalid switch in save.');
  return value;
}

function readSandbox(value: unknown): SandboxNotebook {
  if (value === undefined) return { ...defaultSandbox };
  if (!record(value) || typeof value.code !== 'string' || value.code.length > 100_000 ||
    typeof value.dataset !== 'string' || !isSandboxDataset(value.dataset)) throw new Error('Invalid Sandbox notebook in save.');
  return { code: value.code, dataset: value.dataset };
}

export function readSettings(value: unknown): Settings {
  if (!record(value)) throw new Error('Invalid settings in save.');
  return {
    muted: value.muted === undefined ? defaultSettings.muted : boolean(value.muted),
    ambience: value.ambience === undefined ? defaultSettings.ambience : boolean(value.ambience),
    masterVolume: numberIn(value.masterVolume, 0, 1, 'volume'), musicVolume: numberIn(value.musicVolume, 0, 1, 'volume'),
    sfxVolume: numberIn(value.sfxVolume, 0, 1, 'volume'), replaySpeed: numberIn(value.replaySpeed, 0.25, 50, 'replay speed'),
    reducedMotion: boolean(value.reducedMotion), colorblind: boolean(value.colorblind), openStacks: boolean(value.openStacks),
    uiScale: numberIn(value.uiScale, 0.5, 2, 'UI scale'), editorFontSize: numberIn(value.editorFontSize, 10, 32, 'font size'),
  };
}

export function readLayout(value: unknown): WindowLayout {
  if (!record(value)) throw new Error('Invalid window layout.');
  return {
    x: numberIn(value.x, -10000, 10000, 'window position'), y: numberIn(value.y, -10000, 10000, 'window position'),
    width: numberIn(value.width, 100, 10000, 'window width'), height: numberIn(value.height, 60, 10000, 'window height'),
    z: numberIn(value.z, 0, 1e9, 'window order'), minimized: boolean(value.minimized), closed: boolean(value.closed),
  };
}

function jsonSafe(value: unknown, depth = 0): boolean {
  if (depth > 24) return false;
  if (value === null || typeof value === 'string' || typeof value === 'boolean' || finite(value)) return true;
  if (Array.isArray(value)) return value.every((item: unknown) => jsonSafe(item, depth + 1));
  return record(value) && Object.values(value).every((item) => jsonSafe(item, depth + 1));
}

function isTrace(value: unknown): value is TraceEvent {
  return record(value) && value.version === 1 && Number.isInteger(value.seq) && typeof value.type === 'string' &&
    Number.isInteger(value.line) && strings(value.inputs) && (value.output === null || typeof value.output === 'string') &&
    record(value.payload) && jsonSafe(value.payload);
}

function isResult(value: unknown): value is RunResult {
  return record(value) && typeof value.stdout === 'string' && valueIsValid(value.value) && valueIsValid(value.delivered) &&
    finite(value.elapsedMs) && value.elapsedMs >= 0 && inputsAreValid(value.inputs) &&
    Array.isArray(value.trace) && value.trace.every(isTrace) &&
    (value.error === null || (record(value.error) && typeof value.error.type === 'string' &&
      typeof value.error.message === 'string' && typeof value.error.friendly === 'string' && Number.isInteger(value.error.line)));
}

function readFailure(value: unknown): QueueEntry {
  if (!record(value) || typeof value.name !== 'string' || !finite(value.seed) || value.status !== 'failed' ||
    !inputsAreValid(value.inputs) || !isResult(value.result)) throw new Error('Invalid standing-order failure.');
  return { name: value.name, seed: value.seed, status: 'failed', inputs: value.inputs, result: value.result };
}

function readOrder(value: unknown): StandingOrder {
  if (!record(value) || typeof value.puzzleId !== 'string' || typeof value.code !== 'string' || value.code.length > 100_000) {
    throw new Error('Invalid standing order.');
  }
  getPuzzle(value.puzzleId);
  return {
    puzzleId: value.puzzleId, code: value.code,
    earned: numberIn(value.earned, 0, Number.MAX_SAFE_INTEGER, 'earnings'), paused: boolean(value.paused),
    ...(value.failure === undefined ? {} : { failure: readFailure(value.failure) }),
  };
}

function readProgress(value: unknown): Record<string, PuzzleProgress> {
  if (value === undefined) return {};
  if (!record(value)) throw new Error('Invalid request progress.');
  return Object.fromEntries(Object.entries(value).map(([id, item]): [string, PuzzleProgress] => {
    getPuzzle(id);
    if (!record(item) || typeof item.code !== 'string' || item.code.length > 100_000 ||
      (item.solvedCode !== undefined && (typeof item.solvedCode !== 'string' || item.solvedCode.length > 100_000))) {
      throw new Error('Invalid saved request code.');
    }
    return [id, { code: item.code, hints: integerIn(item.hints, 0, 3, 'hint level'),
      attempts: integerIn(item.attempts, 0, Number.MAX_SAFE_INTEGER, 'queue attempts'),
      ...(item.solvedCode === undefined ? {} : { solvedCode: item.solvedCode }),
      ...(item.solvedFiles === undefined ? {} : { solvedFiles: readFiles(item.solvedFiles) }) }];
  }));
}

export function migrateSave(input: unknown): unknown {
  if (!record(input)) return input;
  const defaults = freshSave();
  let value = input;
  if (value.version === 0) {
    value = {
      ...defaults, ...value, version: 1,
      files: value.files ?? { 'main.py': value.code ?? defaults.files['main.py'] },
    };
  }
  if (value.version !== 1) return value;
  return {
    ...value,
    settings: record(value.settings) ? { ...defaults.settings, ...value.settings } : defaults.settings,
    resources: record(value.resources) ? { ...defaults.resources, ...value.resources } : defaults.resources,
    ownedItems: value.ownedItems ?? defaults.ownedItems,
    standingOrders: value.standingOrders ?? defaults.standingOrders,
    orderFiles: value.orderFiles ?? defaults.orderFiles,
    seenTutorials: value.seenTutorials ?? defaults.seenTutorials,
    layouts: value.layouts ?? defaults.layouts,
    hat: value.hat ?? defaults.hat,
    hatchlings: value.hatchlings ?? defaults.hatchlings,
  };
}

export function parseSave(input: unknown): GameSave {
  const value = migrateSave(input);
  if (!record(value) || value.version !== 1) throw new Error('This save format is not supported.');
  if (typeof value.name !== 'string' || !value.name.trim() || value.name.length > 40 || typeof value.puzzleId !== 'string') throw new Error('Invalid librarian or request.');
  getPuzzle(value.puzzleId);
  if (!strings(value.completed) || new Set(value.completed).size !== value.completed.length ||
    !strings(value.seenTutorials) || !strings(value.ownedItems)) throw new Error('Invalid progress lists.');
  value.completed.forEach(getPuzzle);
  if (!record(value.resources) || !record(value.layouts) || !Array.isArray(value.standingOrders) ||
    value.standingOrders.length > 3 || typeof value.hat !== 'string') throw new Error('Invalid save ledger.');
  const files = readFiles(value.files);
  const activeFile = value.activeFile ?? Object.keys(files)[0];
  if (typeof activeFile !== 'string' || !Object.hasOwn(files, activeFile)) throw new Error('Active file is missing.');
  const orderFiles = value.orderFiles ?? {};
  if (!record(orderFiles)) throw new Error('Invalid standing-order files.');
  const standingOrders = value.standingOrders.map(readOrder);
  if (new Set(standingOrders.map((order) => order.puzzleId)).size !== standingOrders.length ||
    standingOrders.some((order) => !value.completed || !strings(value.completed) || !value.completed.includes(order.puzzleId))) {
    throw new Error('Standing orders must be unique completed requests.');
  }
  return {
    version: 1, started: value.started === undefined ? true : boolean(value.started),
    name: value.name, puzzleId: value.puzzleId, completed: value.completed, files, activeFile, sandbox: readSandbox(value.sandbox),
    progress: readProgress(value.progress),
    orderFiles: Object.fromEntries(Object.entries(orderFiles).map(([id, entries]) => { getPuzzle(id); return [id, readFiles(entries)]; })),
    resources: {
      ink: numberIn(value.resources.ink, 0, Number.MAX_SAFE_INTEGER, 'Ink'),
      stars: numberIn(value.resources.stars, 0, Number.MAX_SAFE_INTEGER, 'Stars'),
      oil: numberIn(value.resources.oil, 0, Number.MAX_SAFE_INTEGER, 'Oil'),
      eggs: numberIn(value.resources.eggs, 0, Number.MAX_SAFE_INTEGER, 'Eggs'),
      served: integerIn(value.resources.served, 0, Number.MAX_SAFE_INTEGER, 'patrons served'),
    },
    settings: readSettings(value.settings),
    layouts: Object.fromEntries(Object.entries(value.layouts).map(([id, layout]) => [id, readLayout(layout)])),
    seenTutorials: value.seenTutorials, standingOrders,
    lastSavedAt: numberIn(value.lastSavedAt, 0, Number.MAX_SAFE_INTEGER, 'save timestamp'),
    ownedItems: value.ownedItems, hat: value.hat, hatchlings: integerIn(value.hatchlings, 0, 4, 'hatchlings'),
  };
}

export function importJSON(json: string): GameSave {
  if (json.length > 2_000_000) throw new Error('Save files must be smaller than two megabytes.');
  const value: unknown = JSON.parse(json);
  return parseSave(value);
}

export function exportJSON(save: SaveData): string {
  const json = JSON.stringify(parseSave(save), null, 2);
  if (json.length > 2_000_000) throw new Error('Save files must be smaller than two megabytes.');
  return json;
}

export interface Snapshot {
  current: string;
  lastGood: string | null;
}

export interface SaveBackend {
  read(slot: number): Promise<Snapshot | undefined>;
  write(slot: number, snapshot: Snapshot): Promise<void>;
  readActiveSlot(): Promise<number | undefined>;
  writeActiveSlot(slot: number): Promise<void>;
}

interface ShelfDatabase extends DBSchema {
  slots: { key: number; value: Snapshot };
  preferences: { key: 'activeSlot'; value: number };
}

function browserBackend(): SaveBackend {
  const database = () => openDB<ShelfDatabase>('shelf-life', 2, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('slots')) db.createObjectStore('slots');
      if (!db.objectStoreNames.contains('preferences')) db.createObjectStore('preferences');
    },
  });
  return {
    async read(slot) {
      const db = await database();
      try { return await db.get('slots', slot); } finally { db.close(); }
    },
    async write(slot, snapshot) {
      const db = await database();
      try { await db.put('slots', snapshot, slot); } finally { db.close(); }
    },
    async readActiveSlot() {
      const db = await database();
      try { return await db.get('preferences', 'activeSlot'); } finally { db.close(); }
    },
    async writeActiveSlot(slot) {
      const db = await database();
      try { await db.put('preferences', slot, 'activeSlot'); } finally { db.close(); }
    },
  };
}

export function recoverSnapshot(snapshot: Snapshot): { save: GameSave; recovered: boolean } {
  try { return { save: importJSON(snapshot.current), recovered: false }; }
  catch {
    if (snapshot.lastGood) return { save: importJSON(snapshot.lastGood), recovered: true };
    throw new Error('This slot is damaged and has no valid backup. Import an exported save or choose another slot.');
  }
}

function checkSlot(slot: number): void {
  if (!Number.isInteger(slot) || slot < 0 || slot > 2) throw new Error('Choose save slot 1, 2, or 3.');
}

export function createSaveService(backend: SaveBackend = browserBackend()) {
  let pending: Promise<void> = Promise.resolve();
  return {
    async activeSlot(): Promise<number> {
      await pending;
      const slot = await backend.readActiveSlot() ?? 0;
      checkSlot(slot);
      return slot;
    },
    async select(slot: number): Promise<void> {
      checkSlot(slot);
      const operation = pending.then(() => backend.writeActiveSlot(slot));
      pending = operation.catch(() => undefined);
      return operation;
    },
    async load(slot: number) {
      checkSlot(slot);
      await pending;
      const snapshot = await backend.read(slot);
      return snapshot ? recoverSnapshot(snapshot) : null;
    },
    async save(slot: number, save: SaveData): Promise<void> {
      checkSlot(slot);
      const current = exportJSON(save);
      const operation = pending.then(async () => {
        const previous = await backend.read(slot);
        let lastGood = current;
        if (previous) {
          try { lastGood = exportJSON(recoverSnapshot(previous).save); } catch { /* The new validated snapshot repairs an unusable slot. */ }
        }
        await backend.write(slot, { current, lastGood });
        await backend.writeActiveSlot(slot);
      });
      pending = operation.catch(() => undefined);
      return operation;
    },
    flush(): Promise<void> { return pending; },
  };
}

export type SaveService = ReturnType<typeof createSaveService>;
export const saves = createSaveService();
