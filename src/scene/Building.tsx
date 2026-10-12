import { memo, useEffect, useMemo } from 'react';
import { usePointerBlocker } from './interaction';
import { BUILDING, FRONT_Z, type DockPlacement, type ZonePlacement } from './layout';
import { COLORS } from './palette';
import { boxPart, GEOMETRY, MATERIALS, merge } from './resources';
import { StaticInstances, type InstanceSpec } from './StaticInstances';

const { width, depth, wallHeight, wallThickness: t, doorHeight } = BUILDING;
const HALF_W = width / 2;
const LINE_Y = 0.06;

interface Props {
  docks: DockPlacement[];
  zones: ZonePlacement[];
}

/**
 * Roofless warehouse shell (cut away so the floor is visible) with door
 * openings in the front wall wherever there is a dock. Walls and coping are
 * merged into one mesh; floor markings are instanced.
 */
export const Building = memo(
  function Building({ docks, zones }: Props) {
    // Walls swallow clicks so objects hidden behind them can't be picked.
    const blocker = usePointerBlocker();

    const shell = useMemo(() => {
      // Front wall: solid pieces between the door openings, plus a header above.
      const openings = docks.map((d) => [d.x - d.doorWidth / 2, d.x + d.doorWidth / 2] as const).sort((a, b) => a[0] - b[0]);
      const pieces: [number, number][] = [];
      let cursor = -HALF_W;
      for (const [start, end] of openings) {
        pieces.push([cursor, start]);
        cursor = end;
      }
      pieces.push([cursor, HALF_W]);

      const wall = (size: [number, number, number], pos: [number, number, number]) => boxPart(size, pos, COLORS.wall);
      const coping = (size: [number, number, number], pos: [number, number, number]) => boxPart(size, pos, COLORS.wallTrim);
      return merge([
        wall([width, wallHeight, t], [0, wallHeight / 2, -FRONT_Z]),
        wall([t, wallHeight, depth], [-HALF_W, wallHeight / 2, 0]),
        wall([t, wallHeight, depth], [HALF_W, wallHeight / 2, 0]),
        ...pieces.filter(([a, b]) => b > a).map(([a, b]) => wall([b - a, wallHeight, t], [(a + b) / 2, wallHeight / 2, FRONT_Z])),
        wall([width, wallHeight - doorHeight, t], [0, (doorHeight + wallHeight) / 2, FRONT_Z]),
        coping([width + t, 0.2, t + 0.2], [0, wallHeight + 0.1, -FRONT_Z]),
        coping([width + t, 0.2, t + 0.2], [0, wallHeight + 0.1, FRONT_Z]),
        coping([t + 0.2, 0.2, depth], [-HALF_W, wallHeight + 0.1, 0]),
        coping([t + 0.2, 0.2, depth], [HALF_W, wallHeight + 0.1, 0]),
      ]);
    }, [docks]);
    useEffect(() => () => shell.dispose(), [shell]);

    // Zone outlines and the walkway in front of the racking.
    const lines = useMemo(() => {
      const line = (x: number, z: number, w: number, d: number): InstanceSpec => ({
        position: [x, LINE_Y, z],
        scale: [w, 0.02, d],
        color: COLORS.laneYellow,
      });
      const stagingZ = Math.max(...zones.map((z) => z.maxZ), -FRONT_Z) + 2;
      return [
        ...zones.flatMap((z) => {
          const cx = (z.minX + z.maxX) / 2;
          const cz = (z.minZ + z.maxZ) / 2;
          return [
            line(cx, z.minZ, z.maxX - z.minX, 0.12),
            line(cx, z.maxZ, z.maxX - z.minX, 0.12),
            line(z.minX, cz, 0.12, z.maxZ - z.minZ),
            line(z.maxX, cz, 0.12, z.maxZ - z.minZ),
          ];
        }),
        line(0, stagingZ, width - 4, 0.2),
      ];
    }, [zones]);

    return (
      <group>
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={MATERIALS.concrete}>
          <planeGeometry args={[width, depth]} />
        </mesh>
        <mesh geometry={shell} material={MATERIALS.vertexColored} castShadow receiveShadow {...blocker} />
        <StaticInstances items={lines} geometry={GEOMETRY.box} material={MATERIALS.instanced} receiveShadow />
      </group>
    );
  },
  // The shell only depends on where the doors are, not on who's at them.
  (a, b) =>
    a.zones === b.zones &&
    a.docks.length === b.docks.length &&
    a.docks.every((d, i) => d.x === b.docks[i].x && d.doorWidth === b.docks[i].doorWidth),
);
