import { describe, expect, it } from 'vitest';
import { puzzles } from '../../src/game/catalog';
import {
  ARCHIVE_CHAPTER, atlasWings, canEnterPuzzle, completePuzzle, enterWing, equipHat, firstTryBonus, inkFor,
  MAX_HATCHLINGS, OFFLINE_CAP_SECONDS, offlineSeconds, oilCost, orderTrips, purchaseItem, shareTrips, shop,
  spendOil, tripSeconds, wingCost, wingName, wingUnlocked,
} from '../../src/game/economy';
import { freshSave, migrateSave, parseSave } from '../../src/game/saves';

/**
 * Release regressions for the full campaign: a player who solves every request
 * once, never idles, and buys nothing must still be able to open every wing.
 */
describe('release progression', () => {
  it('opens every wing on stars earned from a single clean pass', () => {
    let save = freshSave();
    for (const puzzle of puzzles) {
      expect(canEnterPuzzle(save, puzzle)).toBe(true);
      save = { ...save, ...enterWing(save, puzzle.chapter) };
      expect(wingUnlocked(save, puzzle.chapter)).toBe(true);
      expect(save.resources.stars).toBeGreaterThanOrEqual(0);
      save = { ...save, ...completePuzzle(save, puzzle, false) };
    }
    expect(save.completed).toHaveLength(puzzles.length);
  });

  it('never blocks a required archive request on an empty flask', () => {
    const archive = puzzles.filter((puzzle) => puzzle.chapter >= ARCHIVE_CHAPTER);
    for (const puzzle of archive) {
      const dry = { ...freshSave(), resources: { ...freshSave().resources, oil: 0 } };
      const { save, lent } = spendOil(dry, puzzle);
      expect(oilCost(dry, puzzle)).toBeGreaterThan(0);
      expect(lent).toBeGreaterThan(0);
      expect(save.resources.oil).toBe(0);
    }
  });

  it('gives each shop entry a mechanical effect', () => {
    const base = { ...freshSave(), resources: { ...freshSave().resources, ink: 500, eggs: 4 } };
    for (const item of shop) {
      const bought = { ...base, ...purchaseItem(base, item.id) };
      const changed = bought.resources[item.currency] !== base.resources[item.currency];
      const effect = item.id === 'hatchling'
        ? bought.hatchlings === base.hatchlings + 1
        : item.id.startsWith('hat-')
          ? bought.hat === item.id.slice(4)
          : item.id === 'oil-flask'
            ? bought.resources.oil > base.resources.oil
            : bought.ownedItems.includes(item.id);
      expect(changed, `${item.id} charges its currency`).toBe(true);
      expect(effect, `${item.id} changes the game`).toBe(true);
    }
  });

  it('keeps hats reversible and their effects real', () => {
    const owner = { ...freshSave(), ownedItems: ['hat-beret', 'hat-lantern', 'hat-reading-cap'], hat: 'beret' };
    expect(firstTryBonus(owner, 0, 1)).toBe(true);
    expect(firstTryBonus({ ...owner, hat: '' }, 0, 1)).toBe(false);
    const archive = puzzles.find((puzzle) => puzzle.chapter >= ARCHIVE_CHAPTER);
    if (archive) expect(oilCost({ ...owner, hat: 'lantern' }, archive)).toBeLessThanOrEqual(oilCost({ ...owner, hat: '' }, archive));
    expect(inkFor({ ...owner, hat: 'reading-cap' }, 10, 3)).toBeGreaterThan(inkFor({ ...owner, hat: '' }, 10, 3));
    expect(equipHat(owner, 'beret').hat).toBe('');
    expect(equipHat({ ...owner, hat: '' }, 'hat-beret').hat).toBe('beret');
    expect(() => equipHat(freshSave(), 'beret')).toThrow();
  });

  it('shares helper trips between standing orders and caps offline time', () => {
    expect(shareTrips(7, 3)).toEqual([3, 2, 2]);
    expect(shareTrips(7, 3).reduce((sum, value) => sum + value, 0)).toBe(7);
    expect(shareTrips(2, 0)).toEqual([]);
    expect(offlineSeconds(0, Date.now())).toBe(OFFLINE_CAP_SECONDS);
    const solo = orderTrips(600, 0);
    const crew = orderTrips(600, MAX_HATCHLINGS);
    expect(crew).toBeGreaterThan(solo);
    expect(tripSeconds(crew, MAX_HATCHLINGS)).toBeCloseTo(600, 0);
  });

  it('describes every wing in the atlas with reachable requests', () => {
    const wings = atlasWings(freshSave());
    expect(wings.length).toBeGreaterThan(0);
    expect(wings[0].puzzles[0].reachable).toBe(true);
    for (const wing of wings) {
      expect(wing.name).not.toBe('');
      expect(wing.name).not.toMatch(/^Wing \d+$/);
      expect(wing.cost).toBe(wingCost(wing.chapter));
      expect(wing.puzzles.length).toBeGreaterThan(0);
      expect(wingName(wing.chapter)).toBe(wing.name);
    }
  });

  it('keeps an M1-era save loadable', () => {
    const legacy = {
      version: 1, name: 'Wren', puzzleId: puzzles[0].id, activeFile: 'main.py',
      files: { 'main.py': 'print(1)' }, progress: {}, completed: [], lastSavedAt: Date.now(),
      resources: { ink: 4, stars: 2, oil: 0, eggs: 0, served: 3 },
      settings: { replaySpeed: 1, reducedMotion: false, uiScale: 1, editorFontSize: 14, colorblind: false, openStacks: false, masterVolume: 0.7, musicVolume: 0.3, sfxVolume: 0.6 },
    };
    const save = parseSave(migrateSave(legacy));
    expect(save.name).toBe('Wren');
    expect(save.resources.ink).toBe(4);
    expect(save.hatchlings).toBe(0);
    expect(save.hat).toBe('');
    expect(save.standingOrders).toEqual([]);
    expect(save.settings.muted).toBe(false);
    expect(save.settings.ambience).toBe(true);
  });
});
