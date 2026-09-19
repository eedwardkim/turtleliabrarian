import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { freshSave, importJSON, exportJSON } from '../../src/game/saves';
import { TitleScreen } from '../../src/ui/Screens';

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
});
