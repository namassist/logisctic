import { memo, useMemo } from 'react';
import { Instance, Instances } from '@react-three/drei';
import type { EntityRef } from '../state/entities';
import { useClickHandlers } from './interaction';
import { RACK, type RackPlacement, type StockPlacement } from './layout';
import { COLORS } from './palette';

type Box = {
  position: [number, number, number];
  scale: [number, number, number];
  color?: string;
  /** What clicking this instance selects. */
  target: EntityRef;
};

interface Props {
  racks: RackPlacement[];
  stock: StockPlacement[];
  onSelect: (ref: EntityRef) => void;
}

/**
 * drei's <Instances> sizes its matrix buffer once, from the first `limit`.
 * Instances beyond it get no matrix and pick at random spots, so callers pass
 * the most boxes the group can ever hold, and the group is remounted (keyed
 * by capacity) if that ever changes.
 */
function BoxInstances({ boxes, capacity, color, onSelect, invisible = false }: {
  boxes: Box[];
  capacity: number;
  color: string;
  onSelect: Props['onSelect'];
  /** Pick-only geometry: clickable but never drawn. */
  invisible?: boolean;
}) {
  const handlers = useClickHandlers();
  return (
    <Instances limit={Math.max(capacity, boxes.length, 1)} castShadow={!invisible} receiveShadow={!invisible}>
      <boxGeometry args={[1, 1, 1]} />
      {invisible ? (
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      ) : (
        <meshStandardMaterial color={color} roughness={0.8} />
      )}
      {boxes.map((b, i) => (
        <Instance key={i} position={b.position} scale={b.scale} color={b.color} {...handlers(() => onSelect(b.target))} />
      ))}
    </Instances>
  );
}

/**
 * Pallet racking for every aisle in use, with stock drawn at the bin each
 * inventory record points at. Rack parts select the rack; pallets and
 * cartons select the stock item. Only re-renders when stock changes.
 */
export const Shelving = memo(function Shelving({ racks, stock, onSelect }: Props) {
  const { uprights, beams, hits, pallets, cartons } = useMemo(() => {
    const uprights: Box[] = [];
    const beams: Box[] = [];
    const hits: Box[] = [];
    const height = RACK.levels * RACK.levelHeight;

    for (const rack of racks) {
      const target: EntityRef = { kind: 'rack', id: rack.key };
      const z0 = rack.z - rack.length / 2;
      const bayLength = rack.length / RACK.bays;
      for (const side of [-1, 1]) {
        const x = rack.x + (side * RACK.depth) / 2;
        for (let b = 0; b <= RACK.bays; b++) {
          uprights.push({ position: [x, height / 2, z0 + b * bayLength], scale: [0.09, height, 0.09], target });
        }
        for (let level = 1; level <= RACK.levels; level++) {
          beams.push({ position: [x, level * RACK.levelHeight, rack.z], scale: [0.07, 0.12, rack.length], target });
        }
      }
      // The frame is mostly gaps, so give each rack solid pick areas on its
      // top and ends; the bays stay open so cartons select their stock item.
      const w = RACK.depth + 0.1;
      hits.push({ position: [rack.x, height + 0.1, rack.z], scale: [w, 0.25, rack.length], target });
      for (const end of [z0, z0 + rack.length]) {
        hits.push({ position: [rack.x, height / 2, end], scale: [w, height, 0.25], target });
      }
    }

    const pallets: Box[] = [];
    const cartons: Box[] = [];
    const cartonHeight = RACK.levelHeight - 0.4;
    for (const s of stock) {
      const target: EntityRef = { kind: 'item', id: s.item.id };
      for (const z of s.bayZs) {
        pallets.push({ position: [s.x, s.y - 0.07, z], scale: [RACK.depth - 0.05, 0.14, s.bayLength - 0.2], target });
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

  // Rack parts are fixed per site; stock can grow to a full row of bays per item.
  const stockCapacity = stock.length * RACK.bays;
  return (
    <group>
      <BoxInstances key={`u${uprights.length}`} boxes={uprights} capacity={uprights.length} color={COLORS.rackUpright} onSelect={onSelect} />
      <BoxInstances key={`b${beams.length}`} boxes={beams} capacity={beams.length} color={COLORS.rackBeam} onSelect={onSelect} />
      <BoxInstances key={`h${hits.length}`} boxes={hits} capacity={hits.length} color="#000000" onSelect={onSelect} invisible />
      <BoxInstances key={`p${stockCapacity}`} boxes={pallets} capacity={stockCapacity} color={COLORS.pallet} onSelect={onSelect} />
      {/* White base so each instance's own colour shows through */}
      <BoxInstances key={`c${stockCapacity}`} boxes={cartons} capacity={stockCapacity} color="#ffffff" onSelect={onSelect} />
    </group>
  );
});
