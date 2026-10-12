import { memo, useMemo } from 'react';
import { GEOMETRY, MATERIALS } from './resources';
import { createRng } from '../sim/simulation';
import { StaticInstances, type InstanceSpec } from './StaticInstances';

/** Strips around the site where trees may grow (x/z ranges). */
const TREE_BELTS: [minX: number, maxX: number, minZ: number, maxZ: number, count: number][] = [
  [-70, -44, -38, 56, 16], // left of the building
  [-42, 66, -40, -30, 14], // behind the building
  [70, 86, -38, 56, 10], // right of the yard
  [-90, 90, 70, 84, 18], // across the road
];

/** Low-poly trees framing a site, in site coordinates; `seed` varies the planting per site. */
export const Decor = memo(function Decor({ seed }: { seed: number }) {
  const { trunks, canopies } = useMemo(() => {
    const rand = createRng(seed); // same seed, same trees every load
    const trees = TREE_BELTS.flatMap(([minX, maxX, minZ, maxZ, count]) =>
      Array.from({ length: count }, () => ({
        x: minX + rand() * (maxX - minX),
        z: minZ + rand() * (maxZ - minZ),
        size: 1.6 + rand() * 1.4,
      })),
    );
    return {
      trunks: trees.map((t): InstanceSpec => ({ position: [t.x, t.size * 0.6, t.z], scale: [1, t.size * 1.2, 1] })),
      canopies: trees.map((t): InstanceSpec => ({ position: [t.x, t.size * 1.9, t.z], scale: [t.size, t.size, t.size] })),
    };
  }, [seed]);

  return (
    <group>
      <StaticInstances items={trunks} geometry={GEOMETRY.trunk} material={MATERIALS.trunk} castShadow />
      <StaticInstances items={canopies} geometry={GEOMETRY.canopy} material={MATERIALS.foliage} castShadow receiveShadow />
    </group>
  );
});
