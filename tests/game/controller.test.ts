import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RunResult } from '../../src/contracts';
import { createGame } from '../../src/game/controller';
import { puzzles } from '../../src/game/catalog';
import { createSaveService, exportJSON, freshSave, type Snapshot } from '../../src/game/saves';

const output: RunResult = {
  stdout: '4\n', value: 4, delivered: 4, error: null, elapsedMs: 1,
  inputs: { days: 2, rate: 2 },
  trace: [
    { version: 1, seq: 0, type: 'bind', line: 1, inputs: [], output: 'fee', payload: { value: 4 } },
    { version: 1, seq: 1, type: 'deliver', line: 2, inputs: ['fee'], output: null, payload: { value: 4 } },
  ],
};
const stores: ReturnType<typeof createGame>[] = [];

function harness() {
  const snapshots = new Map<number, Snapshot>();
  let activeSlot: number | undefined;
  const persistence = createSaveService({
    read: async (slot) => snapshots.get(slot),
    write: async (slot, snapshot) => { snapshots.set(slot, snapshot); },
    readActiveSlot: async () => activeSlot,
    writeActiveSlot: async (slot) => { activeSlot = slot; },
  });
  const runtime = {
    init: vi.fn(async (): Promise<void> => undefined),
    run: vi.fn(async (): Promise<RunResult> => structuredClone(output)),
    stop: vi.fn(),
    dispose: vi.fn(),
  };
  const store = createGame(runtime, persistence);
  stores.push(store);
  return { store, runtime, persistence, snapshots };
}

afterEach(() => { stores.splice(0).forEach((store) => store.getState().disposeGame()); });

describe('runtime-backed game orchestration (controlled runtime responses)', () => {
  it('initializes once, asks the engine for preview, and checks delivered output', async () => {
    const { store, runtime } = harness();
    await Promise.all([store.getState().initialize(), store.getState().initialize()]);
    expect(runtime.init).toHaveBeenCalledTimes(1);
    expect(runtime.run).toHaveBeenNthCalledWith(1, expect.objectContaining({
      code: puzzles[0].reference, inputCode: puzzles[0].inputCode, inputs: puzzles[0].visibleInputs,
    }));
    expect(store.getState().expected).toBe(4);
    store.getState().setCode('fee = days * rate\ndeliver(fee)');
    await store.getState().run();
    expect(store.getState().diff?.pass).toBe(true);
    expect(store.getState().currentLine).toBe(1);
    store.getState().tickReplay(200);
    expect(store.getState().currentLine).toBe(2);
    store.getState().skipReplay();
    expect(store.getState().progress).toBe(1);
    store.getState().replay();
    expect(store.getState().traceIndex).toBe(0);
    expect(store.getState().progress).toBe(0);
  });
  it('synchronizes active files and passes import files to the runtime', async () => {
    const { store, runtime } = harness();
    await store.getState().initialize();
    store.getState().setCode('from helper import rate\ndeliver(days * rate)');
    store.getState().addFile('helper.py');
    store.getState().setCode('rate = 2');
    expect(store.getState().save.activeFile).toBe('helper.py');
    store.getState().setActiveFile('main.py');
    expect(store.getState().code).toContain('from helper import rate');
    await store.getState().run();
    expect(runtime.run).toHaveBeenLastCalledWith(expect.objectContaining({ files: {
      'main.py': store.getState().code, 'helper.py': 'rate = 2',
    } }));
    store.getState().addFile('numpy.py');
    expect(Object.keys(store.getState().save.files)).toHaveLength(2);
    store.getState().setActiveFile('missing.py');
    expect(store.getState().activeFile).toBe('main.py');
  });
  it('ignores a late runtime response after stop', async () => {
    const { store, runtime } = harness();
    await store.getState().initialize();
    let finish!: (result: RunResult) => void;
    runtime.run.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const pending = store.getState().run();
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    store.getState().stop();
    finish(output);
    await pending;
    expect(store.getState().busy).toBe(false);
    expect(store.getState().result).toBeNull();
    expect(store.getState().status).toContain('Stopped');
  });
  it('serves the whole queue, gates rewards on all passes, and replays a failed shelf', async () => {
    const { store, runtime } = harness();
    await store.getState().initialize();
    runtime.run.mockResolvedValueOnce(output).mockResolvedValueOnce({ ...output, delivered: 99 });
    await store.getState().serveQueue();
    expect(store.getState().queue).toHaveLength(6);
    expect(store.getState().queue[0].status).toBe('failed');
    expect(store.getState().save.completed).toEqual([]);
    expect(store.getState().save.resources.ink).toBe(5);
    await store.getState().replayQueue(0);
    expect(store.getState().result?.delivered).toBe(99);
    expect(store.getState().diff?.pass).toBe(false);
    await store.getState().serveQueue();
    expect(store.getState().save.completed).toEqual([puzzles[0].id]);
    expect(store.getState().save.resources.stars).toBe(2);
    await store.getState().serveQueue();
    expect(store.getState().save.resources.stars).toBe(2);
  });
  it('restores code and hints when revisiting a completed request', async () => {
    const { store } = harness();
    await store.getState().initialize();
    store.getState().setCode('deliver(days * rate)');
    store.getState().hint();
    await store.getState().serveQueue();
    store.getState().nextPuzzle();
    await store.getState().waitForIdle();
    expect(store.getState().puzzle.id).toBe(puzzles[1].id);
    expect(store.getState().code).toBe(puzzles[1].starter);
    store.getState().gotoPuzzle(puzzles[0].id);
    await store.getState().waitForIdle();
    expect(store.getState().hintLevel).toBe(1);
    expect(store.getState().code).toBe('deliver(days * rate)');
    store.getState().gotoPuzzle(puzzles[4].id);
    expect(store.getState().puzzle.id).toBe(puzzles[0].id);
  });
  it('keeps a filed order and helper snapshots paired until explicitly refiled', async () => {
    const { store } = harness();
    await store.getState().initialize();
    store.getState().addFile('helper.py');
    store.getState().setCode('rate = 2');
    store.getState().setActiveFile('main.py');
    store.getState().setCode('from helper import rate\ndeliver(rate * days)');
    await store.getState().serveQueue();
    store.getState().fileStandingOrder();
    store.getState().setActiveFile('helper.py');
    store.getState().setCode('rate = 3');
    store.getState().setActiveFile('main.py');
    store.getState().setCode('from helper import rate\ndeliver((rate - 1) * days)');
    await store.getState().serveQueue();
    expect(store.getState().save.orderFiles[puzzles[0].id]['helper.py']).toBe('rate = 2');
    expect(store.getState().save.standingOrders[0].code).toContain('rate * days');
    store.getState().fileStandingOrder();
    expect(store.getState().save.orderFiles[puzzles[0].id]['helper.py']).toBe('rate = 3');
    expect(store.getState().save.standingOrders[0].code).toContain('(rate - 1) * days');
  });
  it('samples real order requests, caps offline rewards, and retains fractional intervals', async () => {
    const { store, runtime } = harness();
    await store.getState().initialize();
    await store.getState().serveQueue();
    store.getState().fileStandingOrder();
    const before = store.getState().save.resources.served;
    runtime.run.mockClear();
    store.getState().stepClock(10 * 60 * 60);
    await store.getState().waitForIdle();
    expect(runtime.run.mock.calls.length).toBeGreaterThanOrEqual(5);
    expect(store.getState().save.resources.served - before).toBe(480);
    store.getState().stepClock(61);
    await store.getState().waitForIdle();
    store.getState().stepClock(59);
    await store.getState().waitForIdle();
    expect(store.getState().save.resources.served - before).toBe(482);
  });
  it('pauses failed orders without rewarding them', async () => {
    const { store, runtime } = harness();
    await store.getState().initialize();
    await store.getState().serveQueue();
    store.getState().fileStandingOrder();
    const before = store.getState().save.resources.served;
    runtime.run.mockResolvedValueOnce(output).mockResolvedValueOnce({ ...output, delivered: 18 });
    store.getState().stepClock(600);
    await store.getState().waitForIdle();
    expect(store.getState().save.standingOrders[0].paused).toBe(true);
    expect(store.getState().save.standingOrders[0].failure?.result?.delivered).toBe(18);
    expect(store.getState().save.resources.served).toBe(before);
  });
  it('gives a foreground run priority over an in-flight background order', async () => {
    const { store, runtime } = harness();
    await store.getState().initialize();
    await store.getState().serveQueue();
    store.getState().fileStandingOrder();
    const before = store.getState().save.resources.served;
    let finish!: (result: RunResult) => void;
    runtime.run.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    store.getState().stepClock(60);
    expect(store.getState().backgroundBusy).toBe(true);
    await store.getState().run();
    finish(output);
    await Promise.resolve();
    expect(runtime.stop).toHaveBeenCalled();
    expect(store.getState().diff?.pass).toBe(true);
    expect(store.getState().save.resources.served).toBe(before);
  });
  it('imports and loads slots without mixing files, and never rewrites editor code for scratch', async () => {
    const { store, snapshots } = harness();
    await store.getState().initialize();
    store.getState().setCode('deliver(42)');
    await store.getState().scratch('print(42)');
    expect(store.getState().code).toBe('deliver(42)');
    await store.getState().saveSlot(2);
    expect(snapshots.has(2)).toBe(true);
    const other = freshSave('Fern');
    other.files['note.py'] = 'print("hello")';
    other.activeFile = 'note.py';
    await store.getState().importSave(exportJSON(other));
    expect(store.getState().code).toBe('print("hello")');
    expect(store.getState().save.files[store.getState().activeFile]).toBe(store.getState().code);
    await store.getState().loadSlot(0);
    expect(store.getState().code).toBe('deliver(42)');
    expect(store.getState().activeSlot).toBe(0);
  });
  it('dismisses first-time tutorials and lets the Almanac replay them', async () => {
    const { store } = harness();
    store.getState().triggerTutorial('new-game');
    const id = store.getState().activeTutorial!;
    store.getState().dismissTutorial();
    expect(store.getState().save.seenTutorials).toContain(id);
    store.getState().triggerTutorial('new-game');
    expect(store.getState().activeTutorial).not.toBe(id);
    store.getState().replayTutorial(id);
    expect(store.getState().activeTutorial).toBe(id);
  });
  it('resumes the selected bookmark after importing and constructing a new game', async () => {
    const { store, persistence, runtime } = harness();
    await store.getState().initialize();
    store.getState().setCode('# Bookmark 1');
    await store.getState().saveSlot(0);
    await store.getState().saveSlot(2);
    const imported = freshSave('Fern');
    imported.files['main.py'] = 'deliver(37)';
    await store.getState().importSave(exportJSON(imported));
    store.getState().disposeGame();
    const reloaded = createGame(runtime, persistence);
    stores.push(reloaded);
    await reloaded.getState().initialize();
    expect(reloaded.getState().activeSlot).toBe(2);
    expect(reloaded.getState().code).toBe('deliver(37)');
    await reloaded.getState().loadSlot(0);
    expect(await persistence.activeSlot()).toBe(0);
    expect(reloaded.getState().code).toBe('# Bookmark 1');
  });
  it('rejects invalid imports and empty slots without replacing the current library', async () => {
    const { store, persistence } = harness();
    await store.getState().initialize();
    store.getState().setCode('deliver(42)');
    await persistence.flush();
    const before = store.getState().save;
    await expect(store.getState().importSave('{"broken":')).rejects.toThrow();
    expect(store.getState().save).toBe(before);
    await expect(store.getState().loadSlot(2)).rejects.toThrow('empty');
    expect(store.getState().save).toBe(before);
    expect(store.getState().activeSlot).toBe(0);
  });
  it('propagates disk failures and preserves the library when an import cannot be saved', async () => {
    const { store, persistence } = harness();
    await store.getState().initialize();
    const before = store.getState().save;
    vi.spyOn(persistence, 'save').mockRejectedValue(new Error('Disk full'));
    await expect(store.getState().importSave(exportJSON(freshSave('Fern')))).rejects.toThrow('Disk full');
    expect(store.getState().save).toBe(before);
    await expect(store.getState().saveSlot(1)).rejects.toThrow('Disk full');
  });
  it('makes replay upgrade purchases change the reachable speed', () => {
    const { store } = harness();
    store.getState().setSpeed(8);
    expect(store.getState().save.settings.replaySpeed).toBe(2);
    store.setState({ save: { ...store.getState().save, resources: { ...store.getState().save.resources, ink: 15 } } });
    store.getState().purchase('replay-speed');
    store.getState().setSpeed(8);
    expect(store.getState().save.settings.replaySpeed).toBe(8);
    expect(store.getState().save.resources.ink).toBe(0);
  });
  it('keeps recovery notices visible after preview generation', async () => {
    const { store, snapshots } = harness();
    snapshots.set(0, { current: 'broken', lastGood: exportJSON(freshSave('Backup')) });
    await store.getState().initialize();
    expect(store.getState().save.name).toBe('Backup');
    expect(store.getState().status).toContain('recovered');
  });
  it('does not overwrite edits made while a slot write is pending', async () => {
    const { store, persistence } = harness();
    store.getState().setCode('deliver(1)');
    const writing = store.getState().saveSlot(1);
    store.getState().setCode('deliver(2)');
    await writing;
    await persistence.flush();
    expect(store.getState().save.files['main.py']).toBe('deliver(2)');
    expect(store.getState().code).toBe('deliver(2)');
    expect((await persistence.load(1))?.save.files['main.py']).toBe('deliver(2)');
  });
  it('does not revive a disposed game when initialization resolves', async () => {
    const { store, runtime } = harness();
    let finish!: () => void;
    runtime.init.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const loading = store.getState().initialize();
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    store.getState().disposeGame();
    finish();
    await loading;
    expect(store.getState().ready).toBe(false);
    expect(runtime.run).not.toHaveBeenCalled();
  });
  it('advances capture replay only by explicit frame steps', async () => {
    vi.useFakeTimers();
    try {
      const { store } = harness();
      await store.getState().initialize();
      store.getState().setScreen('game');
      store.getState().setCaptureMode(true);
      await store.getState().run();
      const before = store.getState().replayElapsed;
      await vi.advanceTimersByTimeAsync(5000);
      expect(store.getState().replayElapsed).toBe(before);
      expect(store.getState().traceIndex).toBe(0);
      store.getState().tickReplay(1000 / 30);
      expect(store.getState().replayElapsed).toBeGreaterThan(before);
    } finally { vi.useRealTimers(); }
  });
  it('settles idle waiters without clock ticks after work or Stop', async () => {
    vi.useFakeTimers();
    try {
      const { store } = harness();
      store.setState({ busy: true });
      const settled = vi.fn();
      const pending = store.getState().waitForIdle().then(settled);
      store.setState({ busy: false, backgroundBusy: true });
      await Promise.resolve();
      expect(settled).not.toHaveBeenCalled();
      store.setState({ backgroundBusy: false });
      await pending;
      expect(settled).toHaveBeenCalledOnce();
      store.setState({ busy: true });
      const stopped = store.getState().waitForIdle();
      store.getState().stop();
      await stopped;
      expect(vi.getTimerCount()).toBe(0);
    } finally { vi.useRealTimers(); }
  });
});
