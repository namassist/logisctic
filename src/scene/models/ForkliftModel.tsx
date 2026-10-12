import { CylinderGeometry, type BufferGeometry } from 'three';
import { COLORS } from '../palette';
import { accentMaterial, boxPart, MATERIALS, merge, part } from '../resources';

/** Counterbalance forklift with the forks pointing towards local +z, optionally carrying a carton. */
function buildForklift(carrying: boolean): BufferGeometry {
  const metal = COLORS.forkliftMetal;
  const wheel = new CylinderGeometry(0.28, 0.28, 0.22, 10);
  const geometry = merge([
    // Body and counterweight
    boxPart([1.1, 0.8, 1.7], [0, 0.65, -0.1], COLORS.forkliftBody),
    boxPart([1.1, 0.7, 0.4], [0, 0.85, -0.85], metal),
    // Overhead guard: four posts and a roof
    ...[
      [-0.45, -0.55],
      [0.45, -0.55],
      [-0.45, 0.45],
      [0.45, 0.45],
    ].map(([x, z]) => boxPart([0.07, 1.0, 0.07], [x, 1.55, z], metal)),
    boxPart([1.0, 0.06, 1.1], [0, 2.08, -0.05], metal),
    // Mast and forks
    ...[-0.35, 0.35].map((x) => boxPart([0.1, 2.5, 0.1], [x, 1.3, 0.85], metal)),
    ...[-0.25, 0.25].map((x) => boxPart([0.1, 0.05, 1.2], [x, 0.12, 1.45], metal)),
    ...(carrying ? [boxPart([0.95, 0.8, 1.0], [0, 0.55, 1.45], COLORS.carton)] : []),
    // Wheels
    ...[
      [-0.55, 0.45],
      [0.55, 0.45],
      [-0.55, -0.6],
      [0.55, -0.6],
    ].map(([x, z]) => part(wheel, [x, 0.28, z], COLORS.tyre, Math.PI / 2)),
  ]);
  wheel.dispose();
  return geometry;
}

const BODY = { empty: buildForklift(false), loaded: buildForklift(true) };
const BEACON = boxPart([0.22, 0.14, 0.22], [0, 2.18, -0.3], '#ffffff');

interface Props {
  /** Status colour for the beacon on the overhead guard. */
  accent: string;
  /** Show a carton on the forks. */
  carrying?: boolean;
}

/** Two draw calls per forklift: the body and the status beacon. */
export function ForkliftModel({ accent, carrying = false }: Props) {
  return (
    <group>
      <mesh geometry={carrying ? BODY.loaded : BODY.empty} material={MATERIALS.vertexColored} castShadow receiveShadow />
      <mesh geometry={BEACON} material={accentMaterial(accent)} />
    </group>
  );
}
