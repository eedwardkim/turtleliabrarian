import type { Puzzle, SaveData } from '../contracts';
import { puzzles } from './catalog';

export const OFFLINE_CAP_SECONDS = 8 * 60 * 60;
export const ORDER_SECONDS = 60;
export const WING_COSTS: Readonly<Record<number, number>> = { 1: 3, 2: 8 };

export interface ShopItem {
  id: string;
  title: string;
  cost: number;
  currency: 'ink' | 'eggs';
}

export const shop: ShopItem[] = [
  { id: 'script-slot', title: 'A second writing desk', cost: 10, currency: 'ink' },
  { id: 'replay-speed', title: 'Well-oiled cart wheels', cost: 15, currency: 'ink' },
  { id: 'standing-slot', title: 'A second order peg', cost: 20, currency: 'ink' },
  { id: 'hat-reading-cap', title: 'Reading cap', cost: 12, currency: 'ink' },
  { id: 'hat-beret', title: 'Beret', cost: 16, currency: 'ink' },
  { id: 'hat-graduation', title: 'Graduation cap', cost: 24, currency: 'ink' },
  { id: 'hat-lantern', title: 'Lantern hat', cost: 30, currency: 'ink' },
  { id: 'hat-beanie', title: 'Knit beanie', cost: 18, currency: 'ink' },
  { id: 'hatchling', title: 'Hatch a helper', cost: 1, currency: 'eggs' },
];

export function completePuzzle(save: SaveData, puzzle: Puzzle, firstTryWithoutHints: boolean): SaveData {
  if (save.completed.includes(puzzle.id)) return save;
  const completed = [...save.completed, puzzle.id];
  const chapterFinished = puzzles.filter((entry) => entry.chapter === puzzle.chapter).every((entry) => completed.includes(entry.id));
  return {
    ...save, completed,
    resources: {
      ...save.resources,
      stars: save.resources.stars + 2 + (firstTryWithoutHints ? 1 : 0),
      eggs: save.resources.eggs + (chapterFinished && puzzle.chapter < 2 ? 1 : 0),
    },
  };
}

export function canEnterPuzzle(save: SaveData, puzzle: Puzzle): boolean {
  const index = puzzles.findIndex((entry) => entry.id === puzzle.id);
  return index === 0 || save.completed.includes(puzzle.id) || save.completed.includes(puzzles[index - 1].id);
}

export function enterWing(save: SaveData, chapter: number): SaveData {
  const id = `wing-${chapter}`;
  const cost = WING_COSTS[chapter] ?? 0;
  if (chapter === 0 || save.ownedItems.includes(id)) return save;
  if (save.resources.stars < cost) throw new Error('Complete the earlier requests to earn this wing’s stars.');
  return { ...save, ownedItems: [...save.ownedItems, id], resources: { ...save.resources, stars: save.resources.stars - cost } };
}

export function purchaseItem(save: SaveData, id: string): SaveData {
  const item = shop.find((entry) => entry.id === id);
  if (!item) throw new Error('That item is not on the shop shelf.');
  if (id === 'hatchling' && save.hatchlings >= 4) throw new Error('All four helpers have hatched.');
  if (id !== 'hatchling' && save.ownedItems.includes(id)) {
    return id.startsWith('hat-') ? { ...save, hat: id.slice(4) } : save;
  }
  if (save.resources[item.currency] < item.cost) throw new Error('There is not enough in the ledger for that purchase.');
  return {
    ...save,
    resources: { ...save.resources, [item.currency]: save.resources[item.currency] - item.cost },
    ownedItems: id === 'hatchling' ? save.ownedItems : [...save.ownedItems, id],
    hat: id.startsWith('hat-') ? id.slice(4) : save.hat,
    hatchlings: save.hatchlings + (id === 'hatchling' ? 1 : 0),
  };
}

export function offlineSeconds(lastSavedAt: number, now: number): number {
  return Math.max(0, Math.min(OFFLINE_CAP_SECONDS, (now - lastSavedAt) / 1000));
}

export function orderTrips(seconds: number, hatchlings: number): number {
  return Math.floor(Math.min(OFFLINE_CAP_SECONDS, Math.max(0, seconds)) / ORDER_SECONDS * (1 + hatchlings));
}
