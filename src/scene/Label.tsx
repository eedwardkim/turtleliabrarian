import type { ReactNode } from 'react';
import { Html } from '@react-three/drei';
import type { Position } from './director';

export function Label({ position, children, kind = '' }: {
  position: Position; children: ReactNode; kind?: string;
}) {
  return <Html position={position} center zIndexRange={[4, 0]} className={`scene-label ${kind}`}
    style={{ pointerEvents: 'none' }}>{children}</Html>;
}
