import { useLayoutEffect, useRef } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { Color, Matrix4, Quaternion, Vector3, type BufferGeometry, type InstancedMesh, type Material } from 'three';
import { useClickable } from './interaction';

export interface InstanceSpec {
  position: [number, number, number];
  scale: [number, number, number];
  /** Per-instance colour; multiplied with the material colour (use a white material). */
  color?: string;
}

interface Props<T extends InstanceSpec> {
  items: T[];
  geometry: BufferGeometry;
  material: Material;
  castShadow?: boolean;
  receiveShadow?: boolean;
  /** Makes instances clickable; called with the instance that was clicked. */
  onPick?: (item: T) => void;
}

const matrix = new Matrix4();
const position = new Vector3();
const scale = new Vector3();
const rotation = new Quaternion();
const color = new Color();

/**
 * Many copies of one geometry in a single draw call. Matrices are written only
 * when `items` changes, never per frame, and the bounding sphere is
 * recomputed then so culling and picking match the instances.
 */
export function StaticInstances<T extends InstanceSpec>({ items, geometry, material, castShadow, receiveShadow, onPick }: Props<T>) {
  const mesh = useRef<InstancedMesh>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const handlers = useClickable(
    onPick ? (e: ThreeEvent<MouseEvent>) => e.instanceId !== undefined && onPick(itemsRef.current[e.instanceId]) : undefined,
  );

  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    items.forEach((item, i) => {
      matrix.compose(position.set(...item.position), rotation, scale.set(...item.scale));
      m.setMatrixAt(i, matrix);
      if (item.color) m.setColorAt(i, color.set(item.color));
    });
    m.count = items.length;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, [items]);

  return (
    // Capacity is part of args, so a larger list rebuilds the mesh with room for it.
    <instancedMesh
      ref={mesh}
      args={[geometry, material, Math.max(items.length, 1)]}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
     
      {...handlers}
    />
  );
}
