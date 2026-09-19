import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import { Color, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, Object3D } from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import type { Position, BookRecord } from './director';
import { CATEGORY_COLORS } from './director';

export interface DisplayBook extends BookRecord {
  position: Position;
  rotation?: Position;
  scale?: Position;
  ghost?: boolean;
  wrong?: boolean;
  tied?: boolean;
}
interface BooksProps {
  books: DisplayBook[];
  colorblind?: boolean;
  opacity?: number;
  wireframe?: boolean;
  onHover?: (book: DisplayBook | null) => void;
}

function BookPart({ part, books, opacity, wireframe, onHover }: BooksProps & { part: string }) {
  const gltf = useGLTF('/models/book.glb');
  const ref = useRef<InstancedMesh>(null);
  const resources = useMemo(() => {
    gltf.scene.updateMatrixWorld(true);
    const object = gltf.scene.getObjectByName(`${part}_mesh`);
    if (!(object instanceof Mesh)) throw new Error(`Book GLB is missing ${part}_mesh`);
    const geometry = object.geometry.clone().applyMatrix4(object.matrixWorld);
    const original = Array.isArray(object.material) ? object.material[0] : object.material;
    const material = original.clone();
    if (part === 'Cover' && material instanceof MeshStandardMaterial) material.color.set('#FFFFFF');
    return { geometry, material };
  }, [gltf.scene, part]);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const transform = new Object3D();
    books.forEach((book, index) => {
      transform.position.set(...book.position);
      transform.rotation.set(...(book.rotation ?? [0, 0, 0]));
      transform.scale.set(...(book.scale ?? [book.thickness, 1, 1]));
      transform.updateMatrix();
      ref.current?.setMatrixAt(index, transform.matrix);
      const color = book.ghost ? '#8FB3D9' : book.wrong ? '#C8323C' : book.tied ? '#E0B43A'
        : part === 'Cover' ? CATEGORY_COLORS[book.category] : '#FFFFFF';
      ref.current?.setColorAt(index, new Color(color));
    });
    ref.current.count = books.length;
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
    ref.current.computeBoundingSphere();
    const materials = Array.isArray(ref.current.material) ? ref.current.material : [ref.current.material];
    for (const material of materials) {
      material.opacity = opacity ?? 1;
      material.transparent = (opacity ?? 1) < 1;
      material.depthWrite = (opacity ?? 1) === 1;
      if (material instanceof MeshStandardMaterial) material.wireframe = wireframe ?? false;
    }
  }, [books, opacity, wireframe, part]);
  useEffect(() => () => {
    resources.geometry.dispose();
    resources.material.dispose();
  }, [resources]);
  const hover = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    onHover?.(event.instanceId === undefined ? null : books[event.instanceId] ?? null);
  };
  return <instancedMesh ref={ref} args={[resources.geometry, resources.material, 800]}
    castShadow receiveShadow onPointerMove={onHover ? hover : undefined}
    onPointerOut={onHover ? () => onHover(null) : undefined} dispose={null} />;
}

export function Books({ colorblind = false, ...props }: BooksProps) {
  const bands = useMemo(() => colorblind ? props.books.flatMap((book) =>
    Array.from({ length: book.category + 1 }, (_, index): DisplayBook => {
      const scale = book.scale ?? [book.thickness, 1, 1];
      return { ...book,
        position: [book.position[0], book.position[1] + (0.045 + index * 0.029) * scale[1], book.position[2]],
        scale: [scale[0] * 0.85, scale[1] * 0.17, scale[2]] };
    })) : props.books, [colorblind, props.books]);
  return <group>
    <BookPart {...props} part="Cover" />
    <BookPart {...props} part="Pages" />
    <BookPart {...props} books={bands} part="Band" />
  </group>;
}

export function bookMatrix(book: DisplayBook): Matrix4 {
  const object = new Object3D();
  object.position.set(...book.position);
  object.rotation.set(...(book.rotation ?? [0, 0, 0]));
  object.scale.set(...(book.scale ?? [book.thickness, 1, 1]));
  return object.updateMatrix(), object.matrix;
}
