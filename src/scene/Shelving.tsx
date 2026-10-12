import { useMemo } from 'react';
import { Instance, Instances } from '@react-three/drei';
import { RACK, type RackPlacement, type StockPlacement } from './layout';
import { COLORS } from './palette';

type Box = { position: [number, number, number]; scale: [number, number, number]; color?: string };

function BoxInstances({ boxes, color }: { boxes: Box[]; color: string }) {
  return (
    <Instances limit={Math.max(boxes.length, 1)} castShadow receiveShadow>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={color} roughness={0.8} />
      {boxes.map((b, i) => (
        <Instance key={i} position={b.position} scale={b.scale} color={b.color} />
      ))}
    </Instances>
  );
}

/**
 * Pallet racking for every aisle in use, with stock drawn at the bin each
 * inventory record points at. Rack parts and cartons are instanced.
 */
export function Shelving({ racks, stock }: { racks: RackPlacement[]; stock: StockPlacement[] }) {
  const { uprights, beams, pallets, cartons } = useMemo(() => {
    const uprights: Box[] = [];
    const beams: Box[] = [];
    const height = RACK.levels * RACK.levelHeight;
    const bayLength = (l: number) => l / RACK.bays;

    for (const rack of racks) {
      const z0 = rack.z - rack.length / 2;
      for (const side of [-1, 1]) {
        const x = rack.x + (side * RACK.depth) / 2;
        for (let b = 0; b <= RACK.bays; b++) {
          uprights.push({ position: [x, height / 2, z0 + b * bayLength(rack.length)], scale: [0.09, height, 0.09] });
        }
        for (let level = 1; level <= RACK.levels; level++) {
          beams.push({ position: [x, level * RACK.levelHeight, rack.z], scale: [0.07, 0.12, rack.length] });
        }
      }
    }

    const pallets: Box[] = [];
    const cartons: Box[] = [];
    const cartonHeight = RACK.levelHeight - 0.4;
    for (const s of stock) {
      for (const z of s.bayZs) {
        pallets.push({ position: [s.x, s.y - 0.07, z], scale: [RACK.depth - 0.05, 0.14, s.bayLength - 0.2] });
        cartons.push({
          position: [s.x, s.y + cartonHeight / 2, z],
          scale: [RACK.depth - 0.15, cartonHeight, s.bayLength - 0.35],
          color: s.low ? COLORS.cartonLow : COLORS.carton,
        });
      }
    }
    return { uprights, beams, pallets, cartons };
  }, [racks, stock]);

  return (
    <group>
      <BoxInstances boxes={uprights} color={COLORS.rackUpright} />
      <BoxInstances boxes={beams} color={COLORS.rackBeam} />
      <BoxInstances boxes={pallets} color={COLORS.pallet} />
      {/* White base so each instance's own colour shows through */}
      <BoxInstances boxes={cartons} color="#ffffff" />
    </group>
  );
}
