import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { freshSave, importJSON, exportJSON } from '../../src/game/saves';
import { TitleScreen } from '../../src/ui/Screens';
import { createGame } from '../../src/game/controller';
import { createSaveService } from '../../src/game/saves';
import { defaultLayout } from '../../src/ui/helpers';
import type { RunResult } from '../../src/contracts';

describe('onboarding and persisted preferences', () => {
  it('keeps a newly created or preference-only save behind New game after reload', () => {
    const save = importJSON(exportJSON({ ...freshSave(), lastSavedAt: Date.now() }));
    const html = renderToStaticMarkup(createElement(TitleScreen, {
      game: { save, ready: true, loading: 1, loadingMessage: '', setScreen: vi.fn() },
      openDialog: vi.fn(), onNew: vi.fn(), error: '', retry: vi.fn(),
    }));
    expect(html).not.toContain('Continue');
    expect(html).toContain('New game');
  });
  it('round-trips a completed introduction and accepts saves from before the flag', () => {
    expect(importJSON(exportJSON({ ...freshSave(), started: true })).started).toBe(true);
    const legacy = freshSave();
    delete legacy.started;
    expect(importJSON(JSON.stringify(legacy)).started).toBe(true);
  });
  it('resets desk layouts when a new game starts', async () => {
    const result: RunResult = { stdout: '', value: 4, delivered: 4, error: null, elapsedMs: 1, inputs: { days: 2, rate: 2 }, trace: [] };
    const runtime = { init: vi.fn(async () => undefined), run: vi.fn(async () => result), stop: vi.fn(), dispose: vi.fn() };
    const persistence = createSaveService({
      read: async () => undefined, write: async () => undefined,
      readActiveSlot: async () => undefined, writeActiveSlot: async () => undefined,
    });
    const game = createGame(runtime, persistence);
    await game.getState().initialize();
    const viewport = { width: 1366, height: 768 };
    for (const id of ['request', 'editor', 'output']) game.getState().setLayout(id, { ...defaultLayout(id, viewport), x: 900, y: 700 });
    game.getState().newGame('Fern');
    expect(game.getState().save.layouts).toEqual({});
    for (const id of ['request', 'editor', 'output']) expect(defaultLayout(id, viewport).closed).toBe(false);
    game.getState().disposeGame();
  });
});
