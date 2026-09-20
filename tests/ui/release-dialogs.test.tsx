import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { AtlasDialog, SettingsDialog, ShopDialog } from '../../src/ui/UtilityDialogs';
import { atlasWings, shop as shopCatalog } from '../../src/game/economy';
import { freshSave } from '../../src/game/saves';
import { puzzles } from '../../src/game/catalog';
import type { GameStateForUI, ShopItem } from '../../src/ui/types';

const save = freshSave();
const game = {
  save, puzzle: puzzles[0], screen: 'game', gotoPuzzle: vi.fn(), purchase: vi.fn(),
  equipHat: vi.fn(), setSettings: vi.fn(), reset: vi.fn(),
} as unknown as GameStateForUI;

const items: ShopItem[] = shopCatalog.map((item) => ({
  id: item.id, title: item.title, description: item.description, ink: item.cost,
  currency: item.currency, chapter: item.chapter, repeatable: item.repeatable, hat: item.id.startsWith('hat-'),
}));

describe('atlas of wings', () => {
  it('names every wing, prices locked ones, and hides unreached requests', () => {
    const html = renderToStaticMarkup(createElement(AtlasDialog, { game, wings: atlasWings(save), onClose: vi.fn() }));
    expect(html).toContain('Atlas of the library');
    expect(html).toContain(puzzles[0].title);
    expect(html).toContain('to open');
    expect(html).toContain('Finish the request before this one');
  });
  it('reveals every request under Open Stacks', () => {
    const open = { ...save, settings: { ...save.settings, openStacks: true } };
    const html = renderToStaticMarkup(createElement(AtlasDialog, { game: { ...game, save: open }, wings: atlasWings(open), onClose: vi.fn() }));
    expect(html).not.toContain('Finish the request before this one');
    expect(html).toContain('Open Stacks is on');
  });
});

describe('shop rendering', () => {
  it('keeps repeatable stock purchasable and hats reversible', () => {
    const rich = { ...save, resources: { ...save.resources, ink: 500, eggs: 4 }, ownedItems: ['oil-flask', 'hat-reading-cap'], hat: 'reading-cap', puzzleId: save.puzzleId };
    const html = renderToStaticMarkup(createElement(ShopDialog, { game: { ...game, save: rich, puzzle: { ...puzzles[0], chapter: 12 } }, items, onClose: vi.fn() }));
    expect(html).toContain('Hang it back up');
    expect((html.match(/Purchase/g) ?? []).length).toBeGreaterThan(1);
  });
});

describe('audio settings', () => {
  it('exposes mute, ambience and the gesture note', () => {
    const html = renderToStaticMarkup(createElement(SettingsDialog, { game, onClose: vi.fn(), onTour: vi.fn() }));
    expect(html).toContain('Mute everything');
    expect(html).toContain('Ambient music');
    expect(html).toContain('after your first click');
  });
});
