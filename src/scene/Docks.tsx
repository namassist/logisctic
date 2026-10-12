import { memo, useMemo } from 'react';
import type { EntityRef } from '../state/entities';
import { BUILDING, DOCK_OUTSIDE_Z, FRONT_Z, dockHitBox, type DockPlacement } from './layout';
import { COLORS } from './palette';
import { GEOMETRY, MATERIALS } from './resources';
import { StaticInstances, type InstanceSpec } from './StaticInstances';

const { doorHeight } = BUILDING;
const LAMP_OFF = '#3b4048';

interface Props {
  docks: DockPlacement[];
  onSelect: (ref: EntityRef) => void;
}

type DockHit = InstanceSpec & { ref: EntityRef };

/**
 * Every door fitting of one site, instanced by kind: shutters on closed doors,
 * lamps (lit while a truck is worked), type signs, and hazard tape and cones
 * at docks under maintenance. Clicks land on invisible per-dock hit boxes; the
 * selected dock is outlined through the scene's highlight box.
 */
export const Docks = memo(function Docks({ docks, onSelect }: Props) {
  const parts = useMemo(() => {
    const shutters: InstanceSpec[] = [];
    const lamps: InstanceSpec[] = [];
    const signs: InstanceSpec[] = [];
    const tape: InstanceSpec[] = [];
    const cones: InstanceSpec[] = [];
    const hits: DockHit[] = [];
    for (const p of docks) {
      const { x, doorWidth } = p;
      if (!p.doorOpen) shutters.push({ position: [x, doorHeight / 2, FRONT_Z], scale: [doorWidth, doorHeight, 0.2], color: COLORS.shutter });
      lamps.push({
        position: [x, doorHeight + 0.25, DOCK_OUTSIDE_Z + 0.15],
        scale: [doorWidth * 0.5, 0.12, 0.25],
        color: p.doorOpen ? COLORS.doorwayGlow : LAMP_OFF,
      });
      signs.push({ position: [x, doorHeight + 0.95, DOCK_OUTSIDE_Z + 0.05], scale: [doorWidth * 0.7, 0.45, 0.08], color: p.signColor });
      if (p.underMaintenance) {
        tape.push({ position: [x, 1.1, DOCK_OUTSIDE_Z + 0.2], scale: [doorWidth + 0.4, 0.18, 0.1], color: COLORS.hazard });
        for (const side of [-1, 1]) {
          cones.push({ position: [x + side * (doorWidth / 2 + 0.3), 0.4, DOCK_OUTSIDE_Z + 1.5], scale: [1, 1, 1] });
        }
      }
      const box = dockHitBox(p);
      hits.push({ position: box.center, scale: box.size, ref: { kind: 'dock', id: p.dock.id } });
    }
    return { shutters, lamps, signs, tape, cones, hits };
  }, [docks]);

  return (
    <group>
      <StaticInstances items={parts.shutters} geometry={GEOMETRY.box} material={MATERIALS.instanced} castShadow receiveShadow />
      <StaticInstances items={parts.lamps} geometry={GEOMETRY.box} material={MATERIALS.glow} />
      <StaticInstances items={parts.signs} geometry={GEOMETRY.box} material={MATERIALS.glow} />
      <StaticInstances items={parts.tape} geometry={GEOMETRY.box} material={MATERIALS.glow} castShadow />
      <StaticInstances items={parts.cones} geometry={GEOMETRY.cone} material={MATERIALS.cone} castShadow />
      <StaticInstances items={parts.hits} geometry={GEOMETRY.box} material={MATERIALS.pickOnly} onPick={(h) => onSelect(h.ref)} />
    </group>
  );
});
