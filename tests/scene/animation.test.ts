import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { AnimationMixer, LoopOnce, Vector3 } from 'three';
import type { Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

async function load(name: string) {
  const bytes = await readFile(`public/models/${name}.glb`);
  return new GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer, '');
}

function pose(root: Object3D) {
  const transforms: number[][] = [];
  root.traverse((node) => {
    transforms.push([...node.position.toArray(), ...node.quaternion.toArray()]);
  });
  return transforms;
}

describe('real Three.js GLB animation playback without a browser', () => {
  it.each(['shelby', 'quill', 'atlas', 'patron', 'sieve', 'stamp'])('%s clips animate rigid nodes and seek repeatably', async (name) => {
    const gltf = await load(name);
    const mixer = new AnimationMixer(gltf.scene);
    const rest = pose(gltf.scene);
    expect(gltf.animations.length).toBeGreaterThan(0);
    for (const clip of gltf.animations) {
      const action = mixer.clipAction(clip);
      action.reset().setLoop(LoopOnce, 1);
      action.clampWhenFinished = true;
      action.play();
      mixer.setTime(clip.duration * 0.25);
      const quarter = pose(gltf.scene);
      expect(quarter, clip.name).not.toEqual(rest);
      mixer.setTime(clip.duration * 0.7);
      mixer.setTime(clip.duration * 0.25);
      expect(pose(gltf.scene), clip.name).toEqual(quarter);
      mixer.stopAllAction();
      expect(pose(gltf.scene), clip.name).toEqual(rest);
    }
    mixer.uncacheRoot(gltf.scene);
  });
  it('ends flip belly-up and get_up upright in the exported Y-up coordinate system', async () => {
    const gltf = await load('shelby');
    const mixer = new AnimationMixer(gltf.scene);
    const root = gltf.scene.getObjectByName('Shelby');
    if (!root) throw new Error('Missing Shelby root');
    for (const [name, up] of [['flip', -1], ['get_up', 1]] as const) {
      const clip = gltf.animations.find((candidate) => candidate.name === name);
      if (!clip) throw new Error(`Missing ${name}`);
      const action = mixer.clipAction(clip).reset().setLoop(LoopOnce, 1);
      action.clampWhenFinished = true;
      action.play();
      mixer.setTime(clip.duration);
      expect(new Vector3(0, 1, 0).applyQuaternion(root.quaternion).y).toBeCloseTo(up, 4);
      mixer.stopAllAction();
    }
    mixer.uncacheRoot(gltf.scene);
  });
});
