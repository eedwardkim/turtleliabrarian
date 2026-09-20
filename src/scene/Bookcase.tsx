import { useLayoutEffect, useMemo, useRef } from 'react';
import type { CSSProperties } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Html, OrthographicCamera } from '@react-three/drei';
import type { OrthographicCamera as OrthographicCameraImpl } from 'three';
import type { Value, WorldProps } from '../contracts';
import { bookcaseFrame } from './bookcaseFrame';
import type { ShelfBook } from './bookcaseFrame';
import './scene.css';

const COLORS = ['#52797b', '#b8654d', '#d5a34e', '#778f63', '#725d7e', '#698eb0', '#c67c88'];

function CloseUpCamera() {
  const { size } = useThree();
  const camera = useRef<OrthographicCameraImpl>(null);
  useLayoutEffect(() => {
    camera.current?.lookAt(0, 1.75, 0);
    camera.current?.updateProjectionMatrix();
  }, [size.width, size.height]);
  return <OrthographicCamera ref={camera} makeDefault position={[0.35, 3.4, 12]}
    zoom={Math.min(size.width / 9.4, size.height / 4.7)} near={0.1} far={40} />;
}

function Book({ book }: { book: ShelfBook }) {
  const height = Math.max(0.7, Math.min(3, book.height / 10));
  const color = COLORS[book.id % COLORS.length];
  return <group position={[book.x, 0.2 + book.lift, book.depth]} rotation={[0, 0, book.lean]}>
    <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
      <boxGeometry args={[0.64, height, 0.78]} />
      <meshStandardMaterial color={color} roughness={0.8} />
    </mesh>
    <mesh position={[0, height - 0.04, -0.03]}>
      <boxGeometry args={[0.54, 0.055, 0.66]} />
      <meshStandardMaterial color="#f4e6cf" />
    </mesh>
    {[0.13, height - 0.18].map(y => <mesh key={y} position={[0, y, 0.397]}>
      <boxGeometry args={[0.57, 0.025, 0.018]} />
      <meshStandardMaterial color="#edd29b" metalness={0.15} roughness={0.7} />
    </mesh>)}
    <Html center position={[0, height * 0.57, 0.42]} zIndexRange={[1, 0]}>
      <span className="shelf-book-title">{book.title}</span>
    </Html>
    <Html center position={[0, 0.33, 0.42]} zIndexRange={[1, 0]}>
      <span className="shelf-book-height">{book.height}</span>
    </Html>
  </group>;
}

export function Bookcase({ inputs, result, event, progress, reducedMotion, settled, bottom }: Pick<WorldProps,
  'inputs' | 'result' | 'event' | 'progress' | 'reducedMotion'> & { settled?: Value; bottom: number }) {
  const books = useMemo(() => bookcaseFrame(inputs.books, result?.trace ?? [], event, progress, reducedMotion, settled),
    [inputs.books, result?.trace, event, progress, reducedMotion, settled]);
  const description = [...books].sort((a, b) => a.x - b.x).map(book => `${book.title}: ${book.height}`).join(', ');
  const style: CSSProperties = { bottom };
  return <div className="bookcase-world" style={style} role="img" aria-label={`Bookcase, left to right: ${description}`}>
    <Canvas orthographic shadows camera={{ position: [0.35, 3.4, 12], zoom: 70, near: 0.1, far: 40 }}
      dpr={[1, 1.5]} gl={{ antialias: true }}>
      <color attach="background" args={['#eee5d5']} />
      <hemisphereLight args={['#fff7e9', '#a68b6a', 2.4]} />
      <directionalLight position={[-4, 7, 6]} intensity={3} castShadow
        shadow-mapSize={[1024, 1024]} shadow-normalBias={0.03} />
      <mesh position={[0, 1.85, -0.52]} receiveShadow>
        <boxGeometry args={[8, 3.8, 0.16]} />
        <meshStandardMaterial color="#dbc9ac" roughness={1} />
      </mesh>
      {[0.1, 3.8].map(y => <mesh key={y} position={[0, y, 0]} castShadow receiveShadow>
        <boxGeometry args={[8.3, 0.2, 1.22]} />
        <meshStandardMaterial color="#926d4c" roughness={0.85} />
      </mesh>)}
      {[-4, 4].map(x => <mesh key={x} position={[x, 1.95, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.18, 3.8, 1.2]} />
        <meshStandardMaterial color="#ab8260" roughness={0.85} />
      </mesh>)}
      {books.map(book => <Book key={book.id} book={book} />)}
      <CloseUpCamera />
    </Canvas>
  </div>;
}
