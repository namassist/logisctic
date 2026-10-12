import { BUILDING, FRONT_Z, type DockPlacement, type ZonePlacement } from './layout';
import { COLORS } from './palette';

const { width, depth, wallHeight, wallThickness, doorHeight } = BUILDING;
const HALF_W = width / 2;

function Wall({ x, z, w, d, h = wallHeight, y = 0 }: { x: number; z: number; w: number; d: number; h?: number; y?: number }) {
  return (
    <mesh position={[x, y + h / 2, z]} castShadow receiveShadow>
      <boxGeometry args={[w, h, d]} />
      <meshStandardMaterial color={COLORS.wall} roughness={0.85} />
    </mesh>
  );
}

function FloorLine({ x, z, w, d }: { x: number; z: number; w: number; d: number }) {
  return (
    <mesh position={[x, 0.06, z]} receiveShadow>
      <boxGeometry args={[w, 0.02, d]} />
      <meshStandardMaterial color={COLORS.laneYellow} roughness={0.7} />
    </mesh>
  );
}

/**
 * Roofless warehouse shell (cut away so the floor is visible) with door
 * openings in the front wall wherever there is a dock.
 */
export function Building({ docks, zones }: { docks: DockPlacement[]; zones: ZonePlacement[] }) {
  // Front wall: solid pieces between the door openings, plus a header above.
  const openings = docks
    .map((d) => [d.x - d.doorWidth / 2, d.x + d.doorWidth / 2] as const)
    .sort((a, b) => a[0] - b[0]);
  const frontPieces: [number, number][] = [];
  let cursor = -HALF_W;
  for (const [start, end] of openings) {
    frontPieces.push([cursor, start]);
    cursor = end;
  }
  frontPieces.push([cursor, HALF_W]);

  const t = wallThickness;
  const stagingLineZ = Math.max(...zones.map((z) => z.maxZ), -FRONT_Z) + 2;

  return (
    <group>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color={COLORS.concrete} roughness={0.9} />
      </mesh>

      <Wall x={0} z={-FRONT_Z} w={width} d={t} />
      <Wall x={-HALF_W} z={0} w={t} d={depth} />
      <Wall x={HALF_W} z={0} w={t} d={depth} />
      {frontPieces.map(([a, b]) => (
        <Wall key={a} x={(a + b) / 2} z={FRONT_Z} w={b - a} d={t} />
      ))}
      <Wall x={0} z={FRONT_Z} w={width} d={t} y={doorHeight} h={wallHeight - doorHeight} />

      {/* Dark coping along the top of the walls */}
      {[
        [0, -FRONT_Z, width + t, t + 0.2],
        [0, FRONT_Z, width + t, t + 0.2],
        [-HALF_W, 0, t + 0.2, depth],
        [HALF_W, 0, t + 0.2, depth],
      ].map(([x, z, w, d]) => (
        <mesh key={`${x}-${z}`} position={[x, wallHeight + 0.1, z]} castShadow>
          <boxGeometry args={[w, 0.2, d]} />
          <meshStandardMaterial color={COLORS.wallTrim} />
        </mesh>
      ))}

      {/* Zone outlines and the walkway in front of the racking */}
      {zones.flatMap((z) => {
        const cx = (z.minX + z.maxX) / 2;
        const cz = (z.minZ + z.maxZ) / 2;
        const w = z.maxX - z.minX;
        const d = z.maxZ - z.minZ;
        return [
          <FloorLine key={`${z.zone}-n`} x={cx} z={z.minZ} w={w} d={0.12} />,
          <FloorLine key={`${z.zone}-s`} x={cx} z={z.maxZ} w={w} d={0.12} />,
          <FloorLine key={`${z.zone}-w`} x={z.minX} z={cz} w={0.12} d={d} />,
          <FloorLine key={`${z.zone}-e`} x={z.maxX} z={cz} w={0.12} d={d} />,
        ];
      })}
      <FloorLine x={0} z={stagingLineZ} w={width - 4} d={0.2} />
    </group>
  );
}
