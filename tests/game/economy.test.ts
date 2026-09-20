import { describe, expect, it } from 'vitest';
import { getPuzzle, puzzles } from '../../src/game/catalog';
import { canEnterPuzzle, completePuzzle, enterWing, offlineSeconds, orderTrips, purchaseItem } from '../../src/game/economy';
import { freshSave } from '../../src/game/saves';

describe('M1 economy', () => {
  it('finishes every required lesson with no idling, hints throughout, and no bonus', () => {
    let save = freshSave();
    const m1 = [
      'p0-01-stamp', 'p0-02-shares', 'p0-03-badge', 'p0-04-budget',
      'ch1-show-1', 'ch1-show-2', 'ch1-vary-1', 'ch1-vary-2', 'ch1-break-1', 'ch1-break-2',
      'ch2-show-1', 'ch2-show-2',
    ].map(getPuzzle);
    for (const puzzle of m1) {
      expect(canEnterPuzzle(save, puzzle)).toBe(true);
      save = { ...save, ...enterWing(save, puzzle.chapter) };
      expect(save.resources.stars).toBeGreaterThanOrEqual(0);
      save = { ...save, ...completePuzzle(save, puzzle, false) };
    }
    expect(save.completed).toHaveLength(12);
    expect(save.resources.stars).toBe(13);
    expect(save.resources.eggs).toBe(2);
  });
  it('does not duplicate completion rewards and gates future requests', () => {
    const save = freshSave();
    expect(canEnterPuzzle(save, puzzles[5])).toBe(false);
    const complete = completePuzzle(save, puzzles[0], true);
    expect(complete.resources.stars).toBe(3);
    expect(completePuzzle(complete, puzzles[0], true)).toBe(complete);
  });
  it('charges purchases, equips owned hats for free, and bounds hatchlings', () => {
    let save = freshSave();
    expect(() => purchaseItem(save, 'hat-reading-cap')).toThrow();
    save.resources.ink = 50;
    save = { ...save, ...purchaseItem(save, 'hat-reading-cap') };
    expect(save.resources.ink).toBe(38);
    expect(save.hat).toBe('reading-cap');
    expect(purchaseItem(save, 'hat-reading-cap').resources.ink).toBe(38);
    save.resources.eggs = 5;
    for (let count = 0; count < 4; count++) save = { ...save, ...purchaseItem(save, 'hatchling') };
    expect(() => purchaseItem(save, 'hatchling')).toThrow();
    expect(() => purchaseItem(save, 'unknown')).toThrow();
  });
  it('caps offline progress at eight hours and rejects backward time', () => {
    expect(offlineSeconds(10000, 9000)).toBe(0);
    expect(offlineSeconds(0, 10 * 60 * 60 * 1000)).toBe(28800);
    expect(orderTrips(9999999, 0)).toBe(480);
    expect(orderTrips(60, 4)).toBe(5);
  });
});
