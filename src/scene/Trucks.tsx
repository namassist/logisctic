import { memo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Select } from '@react-three/postprocessing';
import type { Group } from 'three';
import type { TruckId, VehicleClass } from '../data';
import type { EntityRef } from '../state/entities';
import { useClickHandlers } from './interaction';
import type { TruckPlacement } from './layout';
import { TruckModel } from './models/TruckModel';
import { followAlpha, lerpAngle } from './motion';

interface Props {
  trucks: TruckPlacement[];
  selection: EntityRef | null;
  onSelect: (ref: EntityRef) => void;
}

export function Trucks({ trucks, selection, onSelect }: Props) {
  return (
    <group>
      {trucks.map((p) => (
        <TruckItem
          key={p.truck.id}
          id={p.truck.id}
          vehicleClass={p.truck.vehicleClass}
          accent={p.accent}
          x={p.x}
          z={p.z}
          rotation={p.rotation}
          selected={selection?.kind === 'truck' && selection.id === p.truck.id}
          onSelect={onSelect}
        />
      ))}
    </group>
  );
}

interface ItemProps {
  id: TruckId;
  vehicleClass: VehicleClass;
  accent: string;
  x: number;
  z: number;
  rotation: number;
  selected: boolean;
  onSelect: (ref: EntityRef) => void;
}

/** Drives smoothly to each new placement instead of jumping. */
const TruckItem = memo(function TruckItem({ id, vehicleClass, accent, x, z, rotation, selected, onSelect }: ItemProps) {
  const group = useRef<Group>(null);
  // Initial transform only; later placements are eased in useFrame.
  const initial = useRef({ position: [x, 0, z] as const, rotation: [0, rotation, 0] as const }).current;
  const handlers = useClickHandlers();

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    const a = followAlpha(dt);
    g.position.x += (x - g.position.x) * a;
    g.position.z += (z - g.position.z) * a;
    g.rotation.y = lerpAngle(g.rotation.y, rotation, a);
  });

  return (
    <group ref={group} position={initial.position} rotation={initial.rotation} {...handlers(() => onSelect({ kind: 'truck', id }))}>
      <Select enabled={selected}>
        <TruckModel vehicleClass={vehicleClass} accent={accent} />
      </Select>
    </group>
  );
});
