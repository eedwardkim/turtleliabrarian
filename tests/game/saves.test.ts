import { describe, expect, it } from 'vitest';
import { createSaveService, exportJSON, freshSave, importJSON, parseSave, recoverSnapshot, type SaveBackend, type Snapshot } from '../../src/game/saves';

export function memoryBackend() {
  const slots = new Map<number, Snapshot>();
  let activeSlot: number | undefined;
  const backend: SaveBackend = {
    read: async (slot) => slots.get(slot),
    write: async (slot, snapshot) => { slots.set(slot, structuredClone(snapshot)); },
    readActiveSlot: async () => activeSlot,
    writeActiveSlot: async (slot) => { activeSlot = slot; },
  };
  return { backend, slots };
}

describe('save validation and recovery', () => {
  it('round-trips files, layouts, settings, and request attempts', () => {
    const save = freshSave('Fern', 1234);
    save.files['helper.py'] = 'rate = 4';
    save.activeFile = 'helper.py';
    save.progress[save.puzzleId] = { code: 'deliver(0)', hints: 2, attempts: 3 };
    save.layouts.output = { x: 40, y: 90, width: 380, height: 210, minimized: true, closed: false, z: 4 };
    save.settings.reducedMotion = true;
    expect(importJSON(exportJSON(save))).toEqual(save);
  });
  it('migrates version zero while retaining code and partial settings', () => {
    const save = parseSave({ version: 0, name: 'Fern', code: 'fee = 7', settings: { reducedMotion: true } });
    expect(save.version).toBe(1);
    expect(save.files['main.py']).toBe('fee = 7');
    expect(save.settings.reducedMotion).toBe(true);
    expect(save.settings.masterVolume).toBe(0.7);
  });
  it('accepts base contract v1 saves and fills local metadata', () => {
    const { activeFile: _activeFile, progress: _progress, orderFiles: _orders, ...base } = freshSave();
    expect([_activeFile, _progress, _orders]).toEqual(['main.py', {}, {}]);
    expect(parseSave(base).activeFile).toBe('main.py');
    expect(parseSave(base).progress).toEqual({});
  });
  it.each([
    { version: 99 }, { resources: { ink: -5 } }, { files: { '../secret.py': 'x' } },
    { files: { 'numpy.py': 'x' } }, { activeFile: 'missing.py' }, { completed: ['unknown'] },
    { settings: { replaySpeed: Infinity } }, { hatchlings: 5 }, { lastSavedAt: -1 },
    { progress: { 'p0-01-stamp': { code: '', hints: 7, attempts: 0 } } },
  ])('rejects malformed save fields: %j', (patch) => {
    expect(() => parseSave({ ...freshSave(), ...patch })).toThrow();
  });
  it('rejects malformed JSON and oversized exports', () => {
    expect(() => importJSON('{broken')).toThrow();
    expect(() => importJSON(' '.repeat(2_000_001))).toThrow();
  });
  it('recovers the last good save and refuses two bad snapshots', () => {
    const valid = freshSave('Backup');
    expect(recoverSnapshot({ current: 'broken', lastGood: exportJSON(valid) })).toEqual({ save: valid, recovered: true });
    expect(() => recoverSnapshot({ current: 'broken', lastGood: '{}' })).toThrow();
  });
  it('serializes writes, isolates three slots, and preserves backup when current is corrupt', async () => {
    const { backend, slots } = memoryBackend();
    const service = createSaveService(backend);
    await Promise.all([service.save(0, freshSave('First')), service.save(0, freshSave('Second')), service.save(1, freshSave('Other'))]);
    expect((await service.load(0))?.save.name).toBe('Second');
    const snapshot = slots.get(0)!;
    slots.set(0, { ...snapshot, current: 'broken' });
    expect((await service.load(0))?.save.name).toBe('First');
    await service.save(0, freshSave('Repaired'));
    expect(recoverSnapshot({ current: 'broken', lastGood: slots.get(0)!.lastGood }).save.name).toBe('First');
    expect((await service.load(1))?.save.name).toBe('Other');
    expect(await service.load(2)).toBeNull();
    await expect(service.load(3)).rejects.toThrow();
  });
  it('defaults legacy databases to slot one and persists selection across service instances', async () => {
    const { backend } = memoryBackend();
    const service = createSaveService(backend);
    expect(await service.activeSlot()).toBe(0);
    await service.save(2, freshSave('Third'));
    expect(await createSaveService(backend).activeSlot()).toBe(2);
    await service.select(1);
    expect(await createSaveService(backend).activeSlot()).toBe(1);
    await expect(service.select(3)).rejects.toThrow();
    expect(await service.activeSlot()).toBe(1);
  });
});
