import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { TitleScreen, IntroScreen } from '../../src/ui/Screens';
import { ReplayPanel } from '../../src/ui/GamePanels';
import type { SaveData, RunResult } from '../../src/contracts';
import type { ComponentProps } from 'react';

const save: SaveData = {
  version: 1, name: 'Shelby', puzzleId: 'prologue-01', completed: [], files: { 'main.py': '2 + 2' },
  resources: { ink: 0, stars: 0, oil: 0, eggs: 0, served: 0 },
  settings: { masterVolume: 1, musicVolume: 0.5, sfxVolume: 1, replaySpeed: 1, reducedMotion: false, uiScale: 1, editorFontSize: 14, colorblind: false, openStacks: false },
  layouts: {}, seenTutorials: [], standingOrders: [], lastSavedAt: 0, ownedItems: [], hat: '', hatchlings: 0,
};

describe('title flow', () => {
  const game = { save, ready: true, loading: 1, loadingMessage: '', setScreen: vi.fn() };
  const props: ComponentProps<typeof TitleScreen> = { game, openDialog: vi.fn(), onNew: vi.fn(), error: '', retry: vi.fn() };
  it('offers a fresh start and omits Continue without saved progress', () => {
    const html = renderToStaticMarkup(createElement(TitleScreen, props));
    expect(html).toContain('New game');
    expect(html).toContain('Load a library');
    expect(html).toContain('Settings');
    expect(html).toContain('Credits');
    expect(html).not.toContain('Continue');
  });
  it('offers Continue for an existing library', () => {
    const html = renderToStaticMarkup(createElement(TitleScreen, { ...props, game: { ...game, save: { ...save, lastSavedAt: 1234 } } }));
    expect(html).toContain('Continue');
  });
  it('announces real loading progress and exposes retry only on failure', () => {
    const html = renderToStaticMarkup(createElement(TitleScreen, { ...props, game: { ...game, ready: false, loading: 0.43, loadingMessage: 'Loading NumPy' } }));
    expect(html).toContain('aria-valuenow="43"');
    expect(html).toContain('Loading NumPy');
    expect(html).not.toContain('New game');
    const failed = renderToStaticMarkup(createElement(TitleScreen, { ...props, game: { ...game, ready: false }, error: 'Asset checksum mismatch' }));
    expect(failed).toContain('Asset checksum mismatch');
    expect(failed).toContain('Try again');
  });
  it('makes the story skippable from its first page', () => {
    const html = renderToStaticMarkup(createElement(IntroScreen, { onFinish: vi.fn(), onBeat: vi.fn(), reducedMotion: true }));
    expect(html).toContain('Skip story');
    expect(html).toContain('Turn the page');
    expect(html).toContain('Some libraries have foundations.');
  });
});

describe('recorded-trace replay', () => {
  const result: RunResult = { stdout: '', value: 4, delivered: null, error: null, elapsedMs: 1, inputs: {}, trace: [
    { version: 1, seq: 0, type: 'where', line: 2, inputs: ['books'], output: 'kept', payload: {} },
    { version: 1, seq: 1, type: 'deliver', line: 4, inputs: ['kept'], output: null, payload: {} },
  ] };
  it('binds the scrubber to actual trace length and clamps out-of-range indices', () => {
    const html = renderToStaticMarkup(createElement(ReplayPanel, { result, index: 900, paused: true, speed: 1, onIndex: vi.fn(), onPaused: vi.fn(), onSpeed: vi.fn() }));
    expect(html).toContain('max="1"');
    expect(html).toContain('value="1"');
    expect(html).toContain('Event 2 of 2');
    expect(html).toContain('Line 4');
    expect(html).toContain('Play replay');
  });
  it('omits controls when there is no recorded trace', () => {
    const html = renderToStaticMarkup(createElement(ReplayPanel, { result: null, index: 0, paused: false, speed: 1, onIndex: vi.fn(), onPaused: vi.fn(), onSpeed: vi.fn() }));
    expect(html).toContain('Run your code to make a replay.');
    expect(html).not.toContain('<input');
    expect(html).not.toContain('<button');
  });
});
