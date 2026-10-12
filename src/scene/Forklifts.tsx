import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import type { ForkliftPlacement } from './layout';
import { ForkliftModel } from './models/ForkliftModel';
import { COLORS, FORKLIFT_STATUS_COLOR } from './palette';

/** How far an active forklift shuttles back and forth from its spot. */
const SHUTTLE_RANGE = 2.5;

function PlacedForklift({ placement, index }: { placement: ForkliftPlacement; index: number }) {
  const { forklift, x, z, rotation } = placement;
  const group = useRef<Group>(null);
  const active = forklift.status === 'active';

  useFrame(({ clock }) => {
    if (!active || !group.current) return;
    // Drive along the forks' axis, each unit out of phase with the others.
    const offset = Math.sin(clock.elapsedTime * 0.6 + index * 1.7) * SHUTTLE_RANGE;
    group.current.position.x = x + Math.sin(rotation) * offset;
    group.current.position.z = z + Math.cos(rotation) * offset;
  });

  return (
    <group ref={group} position={[x, 0, z]} rotation={[0, rotation, 0]}>
      <ForkliftModel accent={FORKLIFT_STATUS_COLOR[forklift.status]} carrying={active} />
      {forklift.status === 'charging' && (
        // Wall charger beside the parking spot
        <mesh position={[0.9, 0.6, 1.4]} castShadow>
          <boxGeometry args={[0.5, 1.2, 0.4]} />
          <meshStandardMaterial color={COLORS.forkliftMetal} emissive={FORKLIFT_STATUS_COLOR.charging} emissiveIntensity={0.15} />
        </mesh>
      )}
    </group>
  );
}

export function Forklifts({ forklifts }: { forklifts: ForkliftPlacement[] }) {
  return (
    <group>
      {forklifts.map((p, i) => (
        <PlacedForklift key={p.forklift.id} placement={p} index={i} />
      ))}
    </group>
  );
}
