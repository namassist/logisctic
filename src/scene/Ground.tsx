import { useMemo } from 'react';
import { Grid, Instance, Instances } from '@react-three/drei';
import { APRON, DOCK_SPACING, FRONT_Z, MAP_BOUNDS, ROAD, YARD, YARD_SLOT } from './layout';
import { COLORS } from './palette';

const LINE_Y = 0.06;

/** A flat rectangle on the ground, given by its x/z extents. */
function Pad({ minX, maxX, minZ, maxZ, y, color }: {
  minX: number; maxX: number; minZ: number; maxZ: number; y: number; color: string;
}) {
  return (
    <mesh position={[(minX + maxX) / 2, y, (minZ + maxZ) / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[maxX - minX, maxZ - minZ]} />
      <meshStandardMaterial color={color} roughness={0.95} />
    </mesh>
  );
}

type Stripe = { x: number; z: number; w: number; d: number };

function Stripes({ stripes, color }: { stripes: Stripe[]; color: string }) {
  return (
    <Instances limit={stripes.length} receiveShadow>
      <boxGeometry args={[1, 0.02, 1]} />
      <meshStandardMaterial color={color} roughness={0.7} />
      {stripes.map((s, i) => (
        <Instance key={i} position={[s.x, LINE_Y, s.z]} scale={[s.w, 1, s.d]} />
      ))}
    </Instances>
  );
}

/** Grass, the highway joining every site, and the reference grid, in world coordinates. */
export function WorldGround({ highway }: { highway: { minX: number; maxX: number } }) {
  const { yellow, white } = useMemo(() => {
    const length = highway.maxX - highway.minX;
    const centerX = (highway.minX + highway.maxX) / 2;
    const yellow: Stripe[] = [-1, 1].map((side) => ({
      x: centerX,
      z: ROAD.z + side * (ROAD.width / 2 - 0.4),
      w: length,
      d: 0.15,
    }));
    const white: Stripe[] = [];
    for (let x = highway.minX + 2; x < highway.maxX; x += 6) white.push({ x, z: ROAD.z, w: 3, d: 0.15 });
    return { yellow, white };
  }, [highway.minX, highway.maxX]);

  const span = highway.maxX - highway.minX;
  const centerX = (highway.minX + highway.maxX) / 2;
  const gridDepth = MAP_BOUNDS.maxZ - MAP_BOUNDS.minZ + 60;

  return (
    <group>
      <mesh position={[centerX, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[span + 800, 800]} />
        <meshStandardMaterial color={COLORS.grass} roughness={1} />
      </mesh>
      <Pad minX={highway.minX} maxX={highway.maxX} minZ={ROAD.z - ROAD.width / 2} maxZ={ROAD.z + ROAD.width / 2} y={0.012} color={COLORS.road} />
      <Grid
        position={[centerX, 0.04, (MAP_BOUNDS.minZ + MAP_BOUNDS.maxZ) / 2]}
        args={[span, gridDepth]}
        cellSize={2}
        cellThickness={0.6}
        cellColor="#3b4452"
        sectionSize={10}
        sectionThickness={1}
        sectionColor="#56657a"
        fadeDistance={260}
        fadeStrength={1.5}
      />
      <Stripes stripes={yellow} color={COLORS.laneYellow} />
      <Stripes stripes={white} color={COLORS.laneWhite} />
    </group>
  );
}

/** One site's apron, yard and markings, in site coordinates. */
export function SiteGround({ dockCount }: { dockCount: number }) {
  const { yellow, white } = useMemo(() => {
    const yellow: Stripe[] = [];
    const white: Stripe[] = [];

    // Bay lines between dock doors, running out across the apron.
    const bayLength = 16;
    for (let i = 0; i <= dockCount; i++) {
      const x = (i - dockCount / 2) * DOCK_SPACING;
      yellow.push({ x, z: FRONT_Z + bayLength / 2, w: 0.15, d: bayLength });
    }
    yellow.push({ x: 0, z: FRONT_Z + bayLength, w: dockCount * DOCK_SPACING, d: 0.15 });

    // Yard parking slots.
    const slotDepth = 13;
    for (let row = 0; row < 2; row++) {
      const z = YARD_SLOT.firstZ + row * YARD_SLOT.rowGap + slotDepth / 2 - 0.5;
      for (let i = 0; i <= YARD_SLOT.perRow; i++) {
        const x = YARD_SLOT.firstX - YARD_SLOT.width / 2 + i * YARD_SLOT.width;
        white.push({ x, z, w: 0.12, d: slotDepth });
      }
    }
    return { yellow, white };
  }, [dockCount]);

  return (
    <group>
      <Pad {...APRON} y={0.01} color={COLORS.asphalt} />
      <Pad {...YARD} y={0.011} color={COLORS.asphalt} />
      <Stripes stripes={yellow} color={COLORS.laneYellow} />
      <Stripes stripes={white} color={COLORS.laneWhite} />
    </group>
  );
}
