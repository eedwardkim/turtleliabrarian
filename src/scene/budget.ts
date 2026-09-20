import type { AssetName } from './Asset';
import type { StagingKind } from './staging';

/**
 * Measured cost of every GLB in public/models (meshes, triangles). Meshes drive draw
 * calls: shadow casters are drawn twice per frame (shadow map pass + colour pass).
 * tests/scene/budget-release.test.ts re-measures the GLBs so this table cannot drift.
 */
export interface AssetCost { meshes: number; triangles: number }
export const ASSET_COST: Readonly<Record<AssetName, AssetCost>> = {
  archive: { meshes: 2, triangles: 456 }, atlas: { meshes: 6, triangles: 1960 },
  badger: { meshes: 1, triangles: 712 }, beanie: { meshes: 1, triangles: 172 },
  beret: { meshes: 1, triangles: 160 }, bin: { meshes: 2, triangles: 276 },
  board: { meshes: 2, triangles: 480 }, book: { meshes: 3, triangles: 60 },
  bookends: { meshes: 2, triangles: 176 }, bookworm: { meshes: 2, triangles: 164 },
  cabinet: { meshes: 6, triangles: 552 }, cap: { meshes: 1, triangles: 152 },
  card: { meshes: 1, triangles: 108 }, cart: { meshes: 2, triangles: 412 },
  chute: { meshes: 2, triangles: 352 }, cloud: { meshes: 1, triangles: 320 },
  desk: { meshes: 1, triangles: 244 }, egg: { meshes: 2, triangles: 172 },
  flag: { meshes: 2, triangles: 74 }, galton: { meshes: 4, triangles: 976 },
  geese: { meshes: 2, triangles: 880 }, gradcap: { meshes: 2, triangles: 156 },
  grid: { meshes: 1, triangles: 204 }, hatchling: { meshes: 8, triangles: 1344 },
  hedgehog: { meshes: 1, triangles: 590 }, heron: { meshes: 1, triangles: 568 },
  jar: { meshes: 3, triangles: 612 }, lamp: { meshes: 1, triangles: 280 },
  lantern_hat: { meshes: 2, triangles: 200 }, ledger: { meshes: 4, triangles: 260 },
  library: { meshes: 2, triangles: 1928 }, lost_found: { meshes: 2, triangles: 344 },
  magpie: { meshes: 4, triangles: 378 }, marble: { meshes: 1, triangles: 48 },
  newt: { meshes: 1, triangles: 618 }, patron: { meshes: 1, triangles: 702 },
  press: { meshes: 3, triangles: 404 }, quill: { meshes: 5, triangles: 1660 },
  request: { meshes: 1, triangles: 124 }, residual: { meshes: 1, triangles: 92 },
  scale: { meshes: 4, triangles: 428 }, shelby: { meshes: 9, triangles: 1416 },
  shelf: { meshes: 1, triangles: 332 }, sieve: { meshes: 2, triangles: 348 },
  sky: { meshes: 1, triangles: 224 }, slip: { meshes: 1, triangles: 132 },
  spool: { meshes: 2, triangles: 264 }, stairs: { meshes: 1, triangles: 528 },
  stamp: { meshes: 2, triangles: 336 }, trapdoor: { meshes: 2, triangles: 140 },
  wing: { meshes: 2, triangles: 196 },
};

export const DRAW_CALL_BUDGET = 150;
export const TRIANGLE_BUDGET = 400_000;
export const MAX_HATCHLINGS = 4;
/** Only the four most recently unlocked wings get a marker; older ones stay implied. */
export const MAX_WING_MARKERS = 4;
export const BOOK_INSTANCE_PARTS = 3;
/** The sky dome renders unlit with shadows disabled; everything else casts. */
const SHADOWLESS: ReadonlySet<AssetName> = new Set<AssetName>(['sky']);

export function assetCalls(name: AssetName, count = 1): number {
  return ASSET_COST[name].meshes * (SHADOWLESS.has(name) ? 1 : 2) * Math.max(0, count);
}
export function assetTriangles(name: AssetName, count = 1): number {
  return ASSET_COST[name].triangles * Math.max(0, count);
}

export const HATS: Readonly<Record<string, AssetName>> = {
  cap: 'cap', beret: 'beret', gradcap: 'gradcap', lantern_hat: 'lantern_hat',
  lantern: 'lantern_hat', beanie: 'beanie',
};
export function hatAsset(hat: string): AssetName | null {
  return HATS[hat?.toLowerCase?.() ?? ''] ?? null;
}

export interface WingSpec { chapter: number; name: string; prop: AssetName; label: string }
/** One marker per unlocked chapter wing; only the current wing shows its themed prop. */
export const WINGS: readonly WingSpec[] = [
  { chapter: 1, name: 'Returns', prop: 'cart', label: 'Returns' },
  { chapter: 2, name: 'Stacks', prop: 'shelf', label: 'Stacks' },
  { chapter: 3, name: 'Sorting Room', prop: 'sieve', label: 'Sorting' },
  { chapter: 4, name: 'Card Catalog', prop: 'cabinet', label: 'Catalog' },
  { chapter: 5, name: 'Bindery', prop: 'press', label: 'Bindery' },
  { chapter: 6, name: 'Archive', prop: 'archive', label: 'Archive' },
  { chapter: 7, name: 'Reading Room', prop: 'board', label: 'Reading' },
  { chapter: 8, name: 'Marble Hall', prop: 'galton', label: 'Marbles' },
  { chapter: 9, name: 'Ledger Nook', prop: 'ledger', label: 'Ledgers' },
  { chapter: 10, name: 'Weighing Room', prop: 'scale', label: 'Weighing' },
  { chapter: 11, name: 'Chute Room', prop: 'chute', label: 'Chutes' },
  { chapter: 12, name: 'Atlas Deck', prop: 'flag', label: 'Atlas Deck' },
];

export interface ScenePlanInput {
  chapter: number;
  hat: string;
  hatchlings: number;
  staging: StagingKind;
  showOutput: boolean;
  showGhosts: boolean;
}
export interface ScenePlan {
  hatchlings: number;
  hat: AssetName | null;
  wings: readonly WingSpec[];
  wingProp: WingSpec | null;
  stagingProps: readonly AssetName[];
  clouds: number;
  sieve: boolean;
  stamp: boolean;
  quill: boolean;
  patron: boolean;
  lamps: number;
  bookGroups: number;
  drawCalls: number;
  triangles: number;
}

/** Set pieces always staged for an operation family. */
export const STAGING_ASSETS: Readonly<Record<StagingKind, readonly AssetName[]>> = {
  idle: [], sieve: [], stamp: [], marble: ['jar', 'marble'],
  bins: ['bin', 'bin', 'bin'], drawers: ['cabinet'], join: ['spool', 'press', 'lost_found'],
  sample: ['archive', 'trapdoor'], chart: ['board'],
  bookends: ['bookends'], fit: ['scale', 'grid'],
  proportions: ['galton'], trips: ['slip'], deliver: ['request'],
  error: ['flag'],
};
/** Extra set pieces staged only when the draw-call budget still allows them. */
export const STAGING_EXTRAS: Readonly<Record<StagingKind, readonly AssetName[]>> = {
  idle: [], sieve: [], stamp: [], marble: [], bins: ['bin', 'bin'], drawers: ['ledger'],
  join: [], sample: ['stairs'], chart: ['grid'], bookends: ['board'], fit: ['residual'],
  proportions: ['chute'], trips: [], deliver: [], error: [],
};

function stagingCost(kind: StagingKind) {
  return STAGING_ASSETS[kind].reduce((cost, name) => ({
    calls: cost.calls + assetCalls(name), triangles: cost.triangles + assetTriangles(name),
  }), { calls: 0, triangles: 0 });
}
export function stagingCount(plan: ScenePlan, name: AssetName): number {
  return plan.stagingProps.filter((entry) => entry === name).length;
}

/**
 * Chooses what to render so the heaviest view stays inside the draw-call budget.
 * Required elements (Atlas, the library, Shelby with her hat, Quill, the patron, carts,
 * books, the first helper turtle and the operation set piece) are never dropped. Anything
 * else is taken in priority order while it fits: extra helpers first, then wings, then
 * decoration.
 */
export function planScene(input: ScenePlanInput): ScenePlan {
  const hatchlings = Math.max(0, Math.min(MAX_HATCHLINGS, Math.floor(input.hatchlings) || 0));
  const hat = hatAsset(input.hat);
  const chapter = Math.max(0, Math.floor(input.chapter) || 0);
  const unlocked = WINGS.filter((wing) => wing.chapter <= chapter).slice(-MAX_WING_MARKERS);
  const wingProp = unlocked.length ? unlocked[unlocked.length - 1] : null;
  const staging = stagingCost(input.staging);
  const bookGroups = 1 + (input.showOutput ? 1 : 0) + (input.showGhosts ? 1 : 0);

  let calls = assetCalls('sky') + assetCalls('atlas') + assetCalls('library')
    + assetCalls('shelf', 2) + assetCalls('desk')
    + assetCalls('cart', input.showOutput ? 2 : 1)
    + assetCalls('shelby') + (hat ? assetCalls(hat) : 0) + assetCalls('quill') + assetCalls('patron')
    + assetCalls('hatchling', Math.min(1, hatchlings)) + staging.calls
    + bookGroups * BOOK_INSTANCE_PARTS * 2;
  let triangles = assetTriangles('sky') + assetTriangles('atlas') + assetTriangles('library')
    + assetTriangles('shelf', 2) + assetTriangles('desk')
    + assetTriangles('cart', input.showOutput ? 2 : 1)
    + assetTriangles('shelby') + (hat ? assetTriangles(hat) : 0)
    + assetTriangles('quill') + assetTriangles('patron')
    + assetTriangles('hatchling', Math.min(1, hatchlings)) + staging.triangles
    + bookGroups * 40 * assetTriangles('book');

  const staged = [...STAGING_ASSETS[input.staging]];
  const plan: ScenePlan = { hatchlings: Math.min(1, hatchlings), hat, wings: [], wingProp: null,
    stagingProps: staged, clouds: 0, sieve: false, stamp: false, quill: true, patron: true, lamps: 0,
    bookGroups, drawCalls: calls, triangles };

  const optional: { cost: number; triangles: number; take: () => void }[] = [
    ...STAGING_EXTRAS[input.staging].map((name) => ({ cost: assetCalls(name),
      triangles: assetTriangles(name), take: () => { staged.push(name); } })),
    ...Array.from({ length: Math.max(0, hatchlings - 1) }, (_, index) => ({
      cost: assetCalls('hatchling'), triangles: assetTriangles('hatchling'),
      take: () => { plan.hatchlings = index + 2; } })),
    ...(wingProp ? [{ cost: assetCalls(wingProp.prop), triangles: assetTriangles(wingProp.prop),
      take: () => { plan.wingProp = wingProp; } }] : []),
    ...unlocked.map((wing, index) => ({ cost: assetCalls('wing'), triangles: assetTriangles('wing'),
      take: () => { plan.wings = unlocked.slice(0, index + 1); } })),
    { cost: assetCalls('lamp'), triangles: assetTriangles('lamp'), take: () => { plan.lamps = 1; } },
    { cost: assetCalls('sieve'), triangles: assetTriangles('sieve'), take: () => { plan.sieve = true; } },
    { cost: assetCalls('stamp'), triangles: assetTriangles('stamp'), take: () => { plan.stamp = true; } },
    { cost: assetCalls('lamp'), triangles: assetTriangles('lamp'), take: () => { plan.lamps = 2; } },
    ...[1, 2, 3].map((count) => ({ cost: assetCalls('cloud'), triangles: assetTriangles('cloud'),
      take: () => { plan.clouds = count; } })),
  ];
  for (const item of optional) {
    if (calls + item.cost > DRAW_CALL_BUDGET || triangles + item.triangles > TRIANGLE_BUDGET) continue;
    calls += item.cost;
    triangles += item.triangles;
    item.take();
  }
  plan.drawCalls = calls;
  plan.triangles = triangles;
  return plan;
}
