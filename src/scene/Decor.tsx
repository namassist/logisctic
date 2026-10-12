import { useMemo } from 'react';
import { Instance, Instances } from '@react-three/drei';
import { COLORS } from './palette';

/** Small deterministic PRNG so the trees land in the same place every load. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Strips around the site where trees may grow (x/z ranges). */
const TREE_BELTS: [minX: number, maxX: number, minZ: number, maxZ: number, count: number][] = [
  [-70, -44, -38, 56, 16], // left of the building
  [-42, 66, -40, -30, 14], // behind the building
  [70, 86, -38, 56, 10], // right of the yard
  [-90, 90, 70, 84, 18], // across the road
];

/** Low-poly trees framing the site. */
export function Decor() {
  const trees = useMemo(() => {
    const rand = mulberry32(42);
    return TREE_BELTS.flatMap(([minX, maxX, minZ, maxZ, count]) =>
      Array.from({ length: count }, () => ({
        x: minX + rand() * (maxX - minX),
        z: minZ + rand() * (maxZ - minZ),
        size: 1.6 + rand() * 1.4,
      })),
    );
  }, []);

  return (
    <group>
      <Instances limit={trees.length} castShadow>
        <cylinderGeometry args={[0.25, 0.35, 1, 6]} />
        <meshStandardMaterial color={COLORS.trunk} />
        {trees.map((t, i) => (
          <Instance key={i} position={[t.x, t.size * 0.6, t.z]} scale={[1, t.size * 1.2, 1]} />
        ))}
      </Instances>
      <Instances limit={trees.length} castShadow receiveShadow>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color={COLORS.foliage} flatShading roughness={0.9} />
        {trees.map((t, i) => (
          <Instance key={i} position={[t.x, t.size * 1.9, t.z]} scale={t.size} />
        ))}
      </Instances>
    </group>
  );
}
