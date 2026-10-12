import { memo, useMemo } from 'react';
import type { EntityRef } from '../state/entities';
import { RACK, type RackPlacement, type StockPlacement } from './layout';
import { COLORS } from './palette';
import { GEOMETRY, MATERIALS } from './resources';
import { StaticInstances, type InstanceSpec } from './StaticInstances';

/** An instanced box that selects something when clicked. */
type PickBox = InstanceSpec & { target: EntityRef };

interface Props {
  racks: RackPlacement[];
  stock: StockPlacement[];
  onSelect: (ref: EntityRef) => void;
}

/**
 * Pallet racking for every aisle in use, with stock drawn at the bin each
 * inventory record points at: five instanced draws per site. The rack's top
 * and ends select the rack; pallets and cartons select the stock item. Thin
 * frame parts don't take clicks, so they never steal one from a carton behind
 * them. Only re-renders when stock changes.
 */
export const Shelving = memo(function Shelving({ racks, stock, onSelect }: Props) {
  const { uprights, beams, hits, pallets, cartons } = useMemo(() => {
    const uprights: InstanceSpec[] = [];
    const beams: InstanceSpec[] = [];
    const hits: PickBox[] = [];
    const height = RACK.levels * RACK.levelHeight;

    for (const rack of racks) {
      const target: EntityRef = { kind: 'rack', id: rack.key };
      const z0 = rack.z - rack.length / 2;
      const bayLength = rack.length / RACK.bays;
      for (const side of [-1, 1]) {
        const x = rack.x + (side * RACK.depth) / 2;
        for (let b = 0; b <= RACK.bays; b++) {
          uprights.push({ position: [x, height / 2, z0 + b * bayLength], scale: [0.09, height, 0.09], color: COLORS.rackUpright });
        }
        for (let level = 1; level <= RACK.levels; level++) {
          beams.push({ position: [x, level * RACK.levelHeight, rack.z], scale: [0.07, 0.12, rack.length], color: COLORS.rackBeam });
        }
      }
      // The frame is mostly gaps, so each rack gets solid pick areas on its
      // top and ends; the bays stay open so cartons select their stock item.
      const w = RACK.depth + 0.1;
      hits.push({ position: [rack.x, height + 0.1, rack.z], scale: [w, 0.25, rack.length], target });
      for (const end of [z0, z0 + rack.length]) {
        hits.push({ position: [rack.x, height / 2, end], scale: [w, height, 0.25], target });
      }
    }

    const pallets: PickBox[] = [];
    const cartons: PickBox[] = [];
    const cartonHeight = RACK.levelHeight - 0.4;
    for (const s of stock) {
      const target: EntityRef = { kind: 'item', id: s.item.id };
      for (const z of s.bayZs) {
        pallets.push({
          position: [s.x, s.y - 0.07, z],
          scale: [RACK.depth - 0.05, 0.14, s.bayLength - 0.2],
          color: COLORS.pallet,
          target,
        });
        cartons.push({
          position: [s.x, s.y + cartonHeight / 2, z],
          scale: [RACK.depth - 0.15, cartonHeight, s.bayLength - 0.35],
          color: s.color,
          target,
        });
      }
    }
    return { uprights, beams, hits, pallets, cartons };
  }, [racks, stock]);

  const pick = (box: PickBox) => onSelect(box.target);
  return (
    <group>
      <StaticInstances items={uprights} geometry={GEOMETRY.box} material={MATERIALS.instanced} castShadow receiveShadow />
      <StaticInstances items={beams} geometry={GEOMETRY.box} material={MATERIALS.instanced} castShadow receiveShadow />
      <StaticInstances items={hits} geometry={GEOMETRY.box} material={MATERIALS.pickOnly} onPick={pick} />
      <StaticInstances items={pallets} geometry={GEOMETRY.box} material={MATERIALS.instanced} castShadow receiveShadow onPick={pick} />
      <StaticInstances items={cartons} geometry={GEOMETRY.box} material={MATERIALS.instanced} castShadow receiveShadow onPick={pick} />
    </group>
  );
});
