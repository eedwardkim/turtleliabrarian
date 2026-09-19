import type { Puzzle, SaveData } from '../contracts';
import world from '../../content/strings/world.json';
import { puzzles } from './catalog';

export const OFFLINE_CAP_SECONDS = 8 * 60 * 60;
export const ORDER_SECONDS = 60;
export const MAX_HATCHLINGS = 4;
export const EGG_CHAPTERS: readonly number[] = [0, 1, 4, 8];

const wings: Record<string, { name: string; blurb: string }> = world.wings;
const shopCopy: Record<string, { title: string; description: string }> = world.shop;

/**
 * Star prices for opening a wing. Every price is well below the stars a player
 * has already banked at two stars per completed request, so the campaign cannot
 * be locked out by spending; `tests/game/release-progression.test.ts` proves it.
 */
export const WING_COSTS: Readonly<Record<number, number>> = {
  1: 3, 2: 8, 3: 6, 4: 6, 5: 6, 6: 6, 7: 6, 8: 6, 9: 6, 10: 6, 11: 6, 12: 6, 13: 10,
};

/** The Sealed Archive, where sampling trips start burning Lamp Oil. */
export const ARCHIVE_CHAPTER = 6;

export function wingName(chapter: number): string {
  return wings[String(chapter)]?.name ?? `Wing ${chapter}`;
}

export function wingBlurb(chapter: number): string {
  return wings[String(chapter)]?.blurb ?? '';
}

export function shopDescription(id: string): string {
  return shopCopy[id]?.description ?? '';
}

export function wingCost(chapter: number): number {
  if (chapter <= 0) return 0;
  return WING_COSTS[chapter] ?? 6;
}

export function wingUnlocked(save: SaveData, chapter: number): boolean {
  return chapter <= 0 || save.ownedItems.includes(`wing-${chapter}`);
}

export interface ShopItem {
  id: string;
  title: string;
  description: string;
  cost: number;
  currency: 'ink' | 'eggs';
  chapter: number;
  repeatable?: boolean;
}

function entry(id: string, cost: number, currency: 'ink' | 'eggs', chapter: number, repeatable = false): ShopItem {
  return { id, title: shopCopy[id]?.title ?? id, description: shopDescription(id), cost, currency, chapter, repeatable };
}

export const shop: ShopItem[] = [
  entry('script-slot', 10, 'ink', 1),
  entry('replay-speed', 15, 'ink', 1),
  entry('standing-slot', 20, 'ink', 2),
  entry('standing-slot-3', 45, 'ink', 4),
  entry('ink-ledger', 60, 'ink', 3),
  entry('oil-flask', 10, 'ink', ARCHIVE_CHAPTER, true),
  entry('hat-reading-cap', 12, 'ink', 1),
  entry('hat-beanie', 18, 'ink', 2),
  entry('hat-beret', 16, 'ink', 3),
  entry('hat-graduation', 24, 'ink', 4),
  entry('hat-lantern', 30, 'ink', ARCHIVE_CHAPTER),
  entry('hatchling', 1, 'eggs', 1, true),
];

export const OIL_PER_FLASK = 20;

export function hats(): ShopItem[] {
  return shop.filter((item) => item.id.startsWith('hat-'));
}

export function scriptCapacity(save: SaveData): number {
  return save.ownedItems.includes('script-slot') ? 8 : 2;
}

export function orderCapacity(save: SaveData): number {
  return 1 + (save.ownedItems.includes('standing-slot') ? 1 : 0) + (save.ownedItems.includes('standing-slot-3') ? 1 : 0);
}

export function maxReplaySpeed(save: SaveData): number {
  return save.ownedItems.includes('replay-speed') ? 8 : 2;
}

export function inkFor(save: SaveData, perPatron: number, patrons: number): number {
  const ledger = save.ownedItems.includes('ink-ledger') ? 1.25 : 1;
  const cap = save.hat === 'reading-cap' ? 1.1 : 1;
  return Math.floor(perPatron * patrons * ledger * cap);
}

/** Archive sampling burns lamp oil from the Sealed Archive onward. */
export function oilCost(save: SaveData, puzzle: Puzzle): number {
  if (puzzle.chapter < ARCHIVE_CHAPTER) return 0;
  const base = Math.max(1, Math.ceil(puzzle.queueSize / 3));
  return save.hat === 'lantern' ? Math.ceil(base / 2) : base;
}

/**
 * Required requests must always be affordable, so the archive lends oil when the
 * flask is dry instead of blocking the run.
 */
export function spendOil<T extends SaveData>(save: T, puzzle: Puzzle): { save: T; lent: number } {
  const cost = oilCost(save, puzzle);
  if (!cost) return { save, lent: 0 };
  const lent = Math.max(0, cost - save.resources.oil);
  return { save: { ...save, resources: { ...save.resources, oil: save.resources.oil + lent - cost } }, lent };
}

export function completePuzzle(save: SaveData, puzzle: Puzzle, firstTryWithoutHints: boolean): SaveData {
  if (save.completed.includes(puzzle.id)) return save;
  const completed = [...save.completed, puzzle.id];
  const chapterFinished = puzzles.filter((entry) => entry.chapter === puzzle.chapter).every((entry) => completed.includes(entry.id));
  const bonus = firstTryWithoutHints ? 1 : 0;
  const cap = save.hat === 'graduation' ? 1 : 0;
  return {
    ...save, completed,
    resources: {
      ...save.resources,
      stars: save.resources.stars + 2 + bonus + cap,
      eggs: save.resources.eggs + (chapterFinished && EGG_CHAPTERS.includes(puzzle.chapter) ? 1 : 0),
    },
  };
}

/** The beret forgives a single hint when awarding the clean-solve star. */
export function firstTryBonus(save: SaveData, attempts: number, hints: number): boolean {
  return attempts === 0 && hints <= (save.hat === 'beret' ? 1 : 0);
}

export function canEnterPuzzle(save: SaveData, puzzle: Puzzle): boolean {
  const index = puzzles.findIndex((entry) => entry.id === puzzle.id);
  return index === 0 || save.completed.includes(puzzle.id) || save.completed.includes(puzzles[index - 1].id);
}

export function enterWing(save: SaveData, chapter: number): SaveData {
  const id = `wing-${chapter}`;
  const cost = wingCost(chapter);
  if (chapter === 0 || save.ownedItems.includes(id)) return save;
  if (save.resources.stars < cost) throw new Error('Complete the earlier requests to earn this wing’s stars.');
  const opened = { ...save, ownedItems: [...save.ownedItems, id], resources: { ...save.resources, stars: save.resources.stars - cost } };
  if (chapter !== ARCHIVE_CHAPTER) return opened;
  return { ...opened, resources: { ...opened.resources, oil: opened.resources.oil + 40 } };
}

export interface AtlasWing {
  chapter: number;
  name: string;
  blurb: string;
  cost: number;
  unlocked: boolean;
  puzzles: { id: string; title: string; completed: boolean; reachable: boolean }[];
}

/** The Atlas view: every wing, its price in stars, and the requests inside it. */
export function atlasWings(save: SaveData): AtlasWing[] {
  const chapters = [...new Set(puzzles.map((entry) => entry.chapter))].sort((a, b) => a - b);
  return chapters.map((chapter) => ({
    chapter,
    name: wingName(chapter),
    blurb: wingBlurb(chapter),
    cost: wingCost(chapter),
    unlocked: wingUnlocked(save, chapter),
    puzzles: puzzles.filter((entry) => entry.chapter === chapter).map((entry) => ({
      id: entry.id,
      title: entry.title,
      completed: save.completed.includes(entry.id),
      reachable: wingUnlocked(save, chapter) && canEnterPuzzle(save, entry),
    })),
  }));
}

export function ownsHat(save: SaveData, hat: string): boolean {
  return hat === '' || save.ownedItems.includes(`hat-${hat}`);
}

/** Hats are reversible: equipping the empty string hangs the current hat back up. */
export function equipHat(save: SaveData, hat: string): SaveData {
  const name = hat.startsWith('hat-') ? hat.slice(4) : hat;
  if (!ownsHat(save, name)) throw new Error('That hat is still on the shop shelf.');
  return { ...save, hat: save.hat === name ? '' : name };
}

export function purchaseItem(save: SaveData, id: string): SaveData {
  const item = shop.find((entry) => entry.id === id);
  if (!item) throw new Error('That item is not on the shop shelf.');
  if (id === 'hatchling' && save.hatchlings >= MAX_HATCHLINGS) throw new Error('All four helpers have hatched.');
  if (!item.repeatable && save.ownedItems.includes(id)) {
    return id.startsWith('hat-') ? { ...save, hat: id.slice(4) } : save;
  }
  if (save.resources[item.currency] < item.cost) throw new Error('There is not enough in the ledger for that purchase.');
  const resources = { ...save.resources, [item.currency]: save.resources[item.currency] - item.cost };
  if (id === 'oil-flask') resources.oil = resources.oil + OIL_PER_FLASK;
  return {
    ...save,
    resources,
    ownedItems: item.repeatable ? save.ownedItems : [...save.ownedItems, id],
    hat: id.startsWith('hat-') ? id.slice(4) : save.hat,
    hatchlings: save.hatchlings + (id === 'hatchling' ? 1 : 0),
  };
}

export function offlineSeconds(lastSavedAt: number, now: number): number {
  return Math.max(0, Math.min(OFFLINE_CAP_SECONDS, (now - lastSavedAt) / 1000));
}

/** Trips per ORDER_SECONDS: one for the turtle, one for each hatchling, plus the beanie's hurry. */
export function orderRate(hatchlings: number, hat = ''): number {
  const helpers = 1 + Math.min(MAX_HATCHLINGS, Math.max(0, hatchlings));
  return helpers * (hat === 'beanie' ? 1.15 : 1);
}

export function orderTrips(seconds: number, hatchlings: number, hat = ''): number {
  return Math.floor(Math.min(OFFLINE_CAP_SECONDS, Math.max(0, seconds)) / ORDER_SECONDS * orderRate(hatchlings, hat));
}

/** Seconds of shelf time consumed by `trips` completed trips. */
export function tripSeconds(trips: number, hatchlings: number, hat = ''): number {
  return trips * ORDER_SECONDS / orderRate(hatchlings, hat);
}

/**
 * Helpers split their trips between the active standing orders instead of each
 * order collecting the whole shift; earlier orders keep the remainder.
 */
export function shareTrips(trips: number, orders: number): number[] {
  if (orders <= 0) return [];
  const base = Math.floor(trips / orders);
  const extra = trips - base * orders;
  return Array.from({ length: orders }, (_, index) => base + (index < extra ? 1 : 0));
}
