import { readFile } from 'node:fs/promises';
import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Mesh } from 'three';
import type { AssetName } from '../../src/scene/Asset';
import { ASSET_COST, DRAW_CALL_BUDGET, MAX_HATCHLINGS, MAX_WING_MARKERS, planScene, STAGING_ASSETS,
  STAGING_EXTRAS, TRIANGLE_BUDGET, WINGS, hatAsset } from '../../src/scene/budget';
import type { StagingKind } from '../../src/scene/staging';

const MODELS = 'public/models';
const loader = new GLTFLoader();

async function measure(name: string) {
  const bytes = await readFile(`${MODELS}/${name}.glb`);
  const gltf = await loader.parseAsync(Uint8Array.from(bytes).buffer, '');
  let meshes = 0;
  let triangles = 0;
  gltf.scene.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    meshes += 1;
    const index = object.geometry.index;
    triangles += (index ? index.count : object.geometry.attributes.position.count) / 3;
  });
  return { meshes, triangles: Math.round(triangles) };
}

const KINDS = Object.keys(STAGING_ASSETS) as StagingKind[];

describe('the scene cost table tracks the real GLBs', () => {
  it('matches every model the scene can render', async () => {
    const files = readdirSync(MODELS).filter((name) => name.endsWith('.glb'))
      .map((name) => name.replace('.glb', '') as AssetName);
    expect(files.length).toBeGreaterThan(0);
    for (const name of files) {
      expect(ASSET_COST[name], `${name} missing from ASSET_COST`).toBeDefined();
      expect({ name, ...await measure(name) }).toEqual({ name, ...ASSET_COST[name] });
    }
  }, 60_000);
});

describe('the scene plan holds the release budgets', () => {
  it('stays inside 150 draw calls and 400k triangles for every heaviest view', () => {
    for (const staging of KINDS) {
      for (const hatchlings of [0, 1, 2, 3, 4, 9]) {
        for (const hat of ['', 'cap', 'lantern_hat', 'gradcap']) {
          for (const chapter of [0, 1, 6, 12, 40]) {
            const plan = planScene({ chapter, hat, hatchlings, staging, showOutput: true, showGhosts: true });
            expect(plan.drawCalls, `${staging}/${hatchlings}/${hat}/${chapter}`)
              .toBeLessThanOrEqual(DRAW_CALL_BUDGET);
            expect(plan.triangles).toBeLessThanOrEqual(TRIANGLE_BUDGET);
          }
        }
      }
    }
  });

  it('never drops the hat, Quill, the patron or the set piece', () => {
    for (const staging of KINDS) {
      const plan = planScene({ chapter: 12, hat: 'gradcap', hatchlings: 12, staging,
        showOutput: true, showGhosts: true });
      expect(plan.hat).toBe('gradcap');
      expect(plan.quill).toBe(true);
      expect(plan.patron).toBe(true);
      expect(plan.hatchlings).toBeGreaterThanOrEqual(2);
      expect(plan.hatchlings).toBeLessThanOrEqual(MAX_HATCHLINGS);
      expect(plan.stagingProps.length).toBeGreaterThanOrEqual(STAGING_ASSETS[staging].length);
    }
    // A quiet view has room for every helper the contract provides.
    expect(planScene({ chapter: 1, hat: 'cap', hatchlings: 9, staging: 'idle',
      showOutput: false, showGhosts: false }).hatchlings).toBe(MAX_HATCHLINGS);
    expect(planScene({ chapter: 1, hat: 'none', hatchlings: 0, staging: 'idle',
      showOutput: false, showGhosts: false }).hat).toBeNull();
  });

  it('spends the headroom of a light view on decoration', () => {
    const quiet = planScene({ chapter: 2, hat: 'cap', hatchlings: 0, staging: 'idle',
      showOutput: false, showGhosts: false });
    expect(quiet.clouds).toBe(3);
    expect(quiet.quill).toBe(true);
    expect(quiet.patron).toBe(true);
    expect(quiet.sieve).toBe(true);
    expect(quiet.stamp).toBe(true);
    expect(quiet.lamps).toBe(2);
    expect(quiet.wings.map((wing) => wing.name)).toEqual(['Returns', 'Stacks']);
  });

  it('drops decoration before the operation set piece when the view is heavy', () => {
    const heavy = planScene({ chapter: 12, hat: 'cap', hatchlings: 4, staging: 'bins',
      showOutput: true, showGhosts: true });
    expect(heavy.stagingProps.filter((name) => name === 'bin').length).toBeGreaterThanOrEqual(3);
    expect(heavy.clouds).toBe(0);
    expect(heavy.wings.length).toBeLessThanOrEqual(MAX_WING_MARKERS);
    expect(heavy.drawCalls).toBeLessThanOrEqual(DRAW_CALL_BUDGET);
  });

  it('unlocks one wing marker per finished chapter', () => {
    expect(planScene({ chapter: 0, hat: '', hatchlings: 0, staging: 'idle',
      showOutput: false, showGhosts: false }).wings).toEqual([]);
    const midgame = planScene({ chapter: 6, hat: '', hatchlings: 0, staging: 'idle',
      showOutput: false, showGhosts: false });
    expect(midgame.wings.map((wing) => wing.chapter)).toEqual([3, 4, 5, 6]);
    expect(midgame.wingProp?.name).toBe('Archive');
  });

  it('only stages props that exist in public/models', () => {
    const files = new Set(readdirSync(MODELS).filter((name) => name.endsWith('.glb'))
      .map((name) => name.replace('.glb', '')));
    for (const kind of KINDS) {
      for (const name of [...STAGING_ASSETS[kind], ...STAGING_EXTRAS[kind]]) expect(files).toContain(name);
    }
    for (const wing of WINGS) expect(files).toContain(wing.prop);
    for (const hat of ['cap', 'beret', 'gradcap', 'lantern_hat', 'beanie']) {
      expect(files).toContain(hatAsset(hat));
    }
  });
});
