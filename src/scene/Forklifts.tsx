import { memo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Select } from '@react-three/postprocessing';
import { Vector3, type Group } from 'three';
import type { ForkliftId } from '../data';
import type { EntityRef } from '../state/entities';
import { useClickable } from './interaction';
import type { ForkliftPlacement } from './layout';
import { ForkliftModel } from './models/ForkliftModel';
import { followAlpha, lerpAngle } from './motion';
import { COLORS } from './palette';
import { accentMaterial, GEOMETRY } from './resources';

/** How far a working forklift shuttles back and forth along its forks. */
const SHUTTLE_RANGE = 2.5;

interface Props {
  forklifts: ForkliftPlacement[];
  selection: EntityRef | null;
  onSelect: (ref: EntityRef) => void;
}

export function Forklifts({ forklifts, selection, onSelect }: Props) {
  return (
    <group>
      {forklifts.map((p) => (
        <ForkliftItem
          key={p.forklift.id}
          id={p.forklift.id}
          x={p.x}
          z={p.z}
          rotation={p.rotation}
          accent={p.accent}
          moving={p.moving}
          carrying={p.carrying}
          charging={p.charging}
          phase={p.phase}
          selected={selection?.kind === 'forklift' && selection.id === p.forklift.id}
          onSelect={onSelect}
        />
      ))}
    </group>
  );
}

interface ItemProps {
  id: ForkliftId;
  x: number;
  z: number;
  rotation: number;
  accent: string;
  moving: boolean;
  carrying: boolean;
  charging: boolean;
  phase: number;
  selected: boolean;
  onSelect: (ref: EntityRef) => void;
}

const ForkliftItem = memo(function ForkliftItem(props: ItemProps) {
  const { id, x, z, rotation, accent, moving, carrying, charging, phase, selected, onSelect } = props;
  const group = useRef<Group>(null);
  const initial = useRef({ position: [x, 0, z] as const, rotation: [0, rotation, 0] as const }).current;
  // Eased spot the shuttle motion is centred on, and how much of it to apply.
  const base = useRef(new Vector3(x, 0, z));
  const amplitude = useRef(moving ? 1 : 0);
  const handlers = useClickable(() => onSelect({ kind: 'forklift', id }));

  useFrame(({ clock }, dt) => {
    const g = group.current;
    if (!g) return;
    const a = followAlpha(dt);
    base.current.x += (x - base.current.x) * a;
    base.current.z += (z - base.current.z) * a;
    amplitude.current += ((moving ? 1 : 0) - amplitude.current) * a;
    g.rotation.y = lerpAngle(g.rotation.y, rotation, a);
    const offset = Math.sin(clock.elapsedTime * 0.6 + phase) * SHUTTLE_RANGE * amplitude.current;
    g.position.x = base.current.x + Math.sin(g.rotation.y) * offset;
    g.position.z = base.current.z + Math.cos(g.rotation.y) * offset;
  });

  return (
    <group ref={group} position={initial.position} rotation={initial.rotation} {...handlers}>
      <Select enabled={selected}>
        <ForkliftModel accent={accent} carrying={carrying} />
        {charging && (
          // Wall charger beside the parking spot
          <mesh
            position={[0.9, 0.6, 1.4]}
            scale={[0.5, 1.2, 0.4]}
            geometry={GEOMETRY.box}
            material={accentMaterial(COLORS.forkliftMetal)}
            castShadow
           
          />
        )}
      </Select>
    </group>
  );
});
