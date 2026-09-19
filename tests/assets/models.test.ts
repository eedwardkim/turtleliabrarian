import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { ANIMATIONS } from '../../src/scene/director';

interface Gltf {
  nodes: { name?: string; scale?: number[]; mesh?: number }[];
  meshes: { primitives: { indices: number; attributes: Record<string, number> }[] }[];
  accessors: { count: number; min?: number[]; max?: number[] }[];
  animations?: { name: string; channels: { target: { node: number; path: string } }[] }[];
  asset: { version: string; generator: string };
}
async function glb(name: string): Promise<Gltf> {
  const bytes = await readFile(`public/models/${name}.glb`);
  expect(bytes.readUInt32LE(0)).toBe(0x46546c67);
  expect(bytes.readUInt32LE(4)).toBe(2);
  expect(bytes.readUInt32LE(8)).toBe(bytes.length);
  expect(bytes.readUInt32LE(16)).toBe(0x4e4f534a);
  return JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8'));
}
const budgets = {
  shelby: 3000, quill: 3000, atlas: 15000, patron: 2000, book: 60, cart: 800,
  card: 300, shelf: 1000, desk: 1000, lamp: 600, sieve: 800, stamp: 800, library: 6000, cloud: 800,
};

describe('committed Blender GLBs', () => {
  it.each(Object.entries(budgets))('%s is valid binary glTF under %i triangles', async (name, budget) => {
    const data = await glb(name);
    expect(data.asset.version).toBe('2.0');
    expect(data.asset.generator).toContain('Blender');
    const triangles = data.meshes.reduce((sum, mesh) => sum + mesh.primitives
      .reduce((subtotal, primitive) => subtotal + data.accessors[primitive.indices].count / 3, 0), 0);
    expect(triangles).toBeGreaterThan(0);
    expect(triangles).toBeLessThanOrEqual(budget);
    for (const node of data.nodes) {
      for (const scale of node.scale ?? [1, 1, 1]) expect(scale).toBeCloseTo(1, 5);
    }
  });
  it('has every character clip used by the Director', async () => {
    const model = await glb('shelby');
    const names = model.animations?.map((animation) => animation.name) ?? [];
    for (const animation of Object.values(ANIMATIONS)) expect(names).toContain(animation.clip);
    for (const name of ['flip', 'flail_loop', 'get_up', 'cheer']) expect(names).toContain(name);
    const flip = model.animations?.find((animation) => animation.name === 'flip');
    expect(flip?.channels.map((channel) => channel.target.path)).toContain('rotation');
    expect(flip?.channels.map((channel) => channel.target.path)).toContain('translation');
  });
  it('preserves the three rigid book parts for instanced rendering', async () => {
    const model = await glb('book');
    for (const name of ['Cover_mesh', 'Pages_mesh', 'Band_mesh']) {
      const node = model.nodes.find((candidate) => candidate.name === name);
      expect(node?.mesh).toBeDefined();
      expect(model.meshes[node?.mesh ?? -1].primitives).toHaveLength(1);
    }
  });
  it('fits the conservative maximum scene budget including shadows and two hatchlings', async () => {
    const counts: Record<string, number> = { atlas: 1, library: 1, shelf: 2, desk: 1,
      lamp: 2, sieve: 1, stamp: 1, cart: 2, shelby: 3, quill: 1, patron: 1, cloud: 3, card: 2 };
    let calls = 0;
    let triangles = 0;
    for (const [name, count] of Object.entries(counts)) {
      const data = await glb(name);
      for (const mesh of data.meshes) {
        calls += mesh.primitives.length * count;
        triangles += mesh.primitives.reduce((sum, primitive) => sum
          + data.accessors[primitive.indices].count / 3, 0) * count;
      }
    }
    calls += 9 + 2; // Three book batches, gold thread and debug grid.
    triangles += 150 * 108; // Input, output, ghosts, decor, and five-band accessibility pattern.
    expect(calls * 2 + 6).toBeLessThanOrEqual(150); // Shadow pass and transparent back faces.
    expect(triangles * 2).toBeLessThanOrEqual(400000);
  });
  it('exports upright neutral character transforms independently of animation endpoints', async () => {
    for (const name of ['shelby', 'quill', 'atlas', 'patron']) {
      const data = await glb(name);
      const node = data.nodes.find((entry) => entry.name?.toLowerCase() === name);
      expect(node).toBeDefined();
      expect(node).not.toHaveProperty('rotation');
      expect(node).not.toHaveProperty('translation');
    }
  });
});
