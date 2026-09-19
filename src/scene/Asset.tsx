import { useEffect, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { AnimationMixer, BackSide, LoopOnce, Mesh, MeshStandardMaterial } from 'three';
import type { Position } from './director';

export type AssetName = 'shelby' | 'quill' | 'atlas' | 'patron' | 'hatchling'
  | 'heron' | 'badger' | 'newt' | 'geese' | 'hedgehog' | 'bookworm' | 'magpie'
  | 'book' | 'cart' | 'card' | 'shelf' | 'desk' | 'lamp' | 'sieve' | 'stamp'
  | 'library' | 'cloud' | 'slip' | 'request' | 'cabinet' | 'ledger' | 'bin'
  | 'lost_found' | 'board' | 'trapdoor' | 'stairs' | 'archive' | 'wing' | 'sky'
  | 'scale' | 'press' | 'spool' | 'jar' | 'marble' | 'flag' | 'bookends'
  | 'residual' | 'grid' | 'galton' | 'chute' | 'cap' | 'beret' | 'gradcap'
  | 'lantern_hat' | 'beanie' | 'egg';

// The backdrop is viewed from inside and never casts or receives shadows.
const BACKDROP: ReadonlySet<AssetName> = new Set<AssetName>(['sky']);

interface AssetProps {
  name: AssetName;
  position?: Position;
  rotation?: Position;
  scale?: number;
  clip?: string;
  progress?: number;
  opacity?: number;
  wireframe?: boolean;
  hideSaddle?: boolean;
}

export function Asset({ name, position, rotation, scale = 1, clip, progress = 0,
  opacity = 1, wireframe = false, hideSaddle = false }: AssetProps) {
  const gltf = useGLTF(`/models/${name}.glb`);
  const model = useMemo(() => {
    const clone = gltf.scene.clone(true);
    const backdrop = BACKDROP.has(name);
    clone.traverse((object) => {
      if (object instanceof Mesh) {
        object.castShadow = !backdrop;
        object.receiveShadow = !backdrop;
        object.material = Array.isArray(object.material)
          ? object.material.map((material) => material.clone()) : object.material.clone();
        if (backdrop) {
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          for (const material of materials) material.side = BackSide;
        }
      }
    });
    return clone;
  }, [gltf.scene, name]);
  const mixer = useMemo(() => new AnimationMixer(model), [model]);
  useEffect(() => {
    model.traverse((object) => {
      if (object.name === 'Saddle') object.visible = !hideSaddle;
      if (!(object instanceof Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        material.opacity = (material.name === 'glass' ? 0.3 : 1) * opacity;
        material.transparent = material.opacity < 1;
        material.depthWrite = material.opacity === 1;
        if (material instanceof MeshStandardMaterial) material.wireframe = wireframe;
      }
    });
  }, [model, opacity, wireframe, hideSaddle]);
  useEffect(() => {
    mixer.stopAllAction();
    const animation = gltf.animations.find((candidate) => candidate.name === clip);
    if (animation) {
      const action = mixer.clipAction(animation);
      action.reset().setLoop(LoopOnce, 1);
      action.clampWhenFinished = true;
      action.play();
      mixer.setTime(Math.max(0, Math.min(1, progress)) * animation.duration);
    }
  }, [mixer, gltf.animations, clip, progress]);
  useEffect(() => () => {
    mixer.stopAllAction();
    mixer.uncacheRoot(model);
    model.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => material.dispose());
    });
  }, [mixer, model]);
  return <group position={position} rotation={rotation} scale={scale}>
    <primitive object={model} dispose={null} />
  </group>;
}
