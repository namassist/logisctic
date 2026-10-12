import { memo } from 'react';
import { Select } from '@react-three/postprocessing';
import type { DockId } from '../data';
import type { EntityRef } from '../state/entities';
import { useClickHandlers } from './interaction';
import { BUILDING, FRONT_Z, type DockPlacement } from './layout';
import { COLORS } from './palette';

const { doorHeight, wallThickness } = BUILDING;
const OUTSIDE = FRONT_Z + wallThickness / 2;
/** Clickable area: the doorway plus the sign above it. */
const HIT_HEIGHT = doorHeight + 1.4;

interface Props {
  docks: DockPlacement[];
  selection: EntityRef | null;
  onSelect: (ref: EntityRef) => void;
}

export function Docks({ docks, selection, onSelect }: Props) {
  return (
    <group>
      {docks.map((p) => (
        <DockItem
          key={p.dock.id}
          id={p.dock.id}
          x={p.x}
          doorWidth={p.doorWidth}
          doorOpen={p.doorOpen}
          underMaintenance={p.underMaintenance}
          signColor={p.signColor}
          selected={selection?.kind === 'dock' && selection.id === p.dock.id}
          onSelect={onSelect}
        />
      ))}
    </group>
  );
}

interface ItemProps {
  id: DockId;
  x: number;
  doorWidth: number;
  doorOpen: boolean;
  underMaintenance: boolean;
  signColor: string;
  selected: boolean;
  onSelect: (ref: EntityRef) => void;
}

/** Door (open and lit, or shutter down), type sign, and hazard tape when under maintenance. */
const DockItem = memo(function DockItem({ id, x, doorWidth, doorOpen, underMaintenance, signColor, selected, onSelect }: ItemProps) {
  const handlers = useClickHandlers();
  return (
    <group position={[x, 0, 0]} {...handlers(() => onSelect({ kind: 'dock', id }))}>
      <Select enabled={selected}>
        {/* Invisible hit area so an open doorway is still clickable */}
        <mesh position={[0, HIT_HEIGHT / 2, OUTSIDE + 0.35]}>
          <boxGeometry args={[doorWidth + 0.6, HIT_HEIGHT, 0.9]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>

        {!doorOpen && (
          <mesh position={[0, doorHeight / 2, FRONT_Z]} castShadow receiveShadow>
            <boxGeometry args={[doorWidth, doorHeight, 0.2]} />
            <meshStandardMaterial color={COLORS.shutter} roughness={0.6} metalness={0.3} />
          </mesh>
        )}

        <mesh position={[0, doorHeight + 0.25, OUTSIDE + 0.15]}>
          <boxGeometry args={[doorWidth * 0.5, 0.12, 0.25]} />
          <meshStandardMaterial
            color={doorOpen ? COLORS.doorwayGlow : '#3b4048'}
            emissive={doorOpen ? COLORS.doorwayGlow : '#000000'}
            emissiveIntensity={doorOpen ? 2 : 0}
          />
        </mesh>

        <mesh position={[0, doorHeight + 0.95, OUTSIDE + 0.05]}>
          <boxGeometry args={[doorWidth * 0.7, 0.45, 0.08]} />
          <meshStandardMaterial color={signColor} emissive={signColor} emissiveIntensity={0.5} />
        </mesh>

        {underMaintenance && (
          <>
            <mesh position={[0, 1.1, OUTSIDE + 0.2]} castShadow>
              <boxGeometry args={[doorWidth + 0.4, 0.18, 0.1]} />
              <meshStandardMaterial color={COLORS.hazard} emissive={COLORS.hazard} emissiveIntensity={0.4} />
            </mesh>
            {[-1, 1].map((side) => (
              <mesh key={side} position={[side * (doorWidth / 2 + 0.3), 0.4, OUTSIDE + 1.5]} castShadow>
                <coneGeometry args={[0.25, 0.8, 8]} />
                <meshStandardMaterial color="#f97316" />
              </mesh>
            ))}
          </>
        )}
      </Select>
    </group>
  );
});
