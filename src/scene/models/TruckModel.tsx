import { CylinderGeometry, type BufferGeometry } from 'three';
import type { VehicleClass } from '../../data';
import { TRUCK_SIZE } from '../layout';
import { COLORS } from '../palette';
import { accentMaterial, boxPart, MATERIALS, merge, part } from '../resources';

const WHEEL_RADIUS = 0.5;
const WHEEL_WIDTH = 0.4;

interface TruckGeometry {
  /** Chassis, cargo box, cab, windscreen and wheels, vertex-coloured. */
  body: BufferGeometry;
  /** Side stripe and roof beacon, drawn in the status colour. */
  accent: BufferGeometry;
}

const cache = new Map<VehicleClass, TruckGeometry>();

/** Box truck with the cab towards local +z and the cargo door at -z; one geometry pair per class. */
function truckGeometry(vehicleClass: VehicleClass): TruckGeometry {
  const cached = cache.get(vehicleClass);
  if (cached) return cached;

  const { length, width, height } = TRUCK_SIZE[vehicleClass];
  const cabLength = vehicleClass === 'heavy' ? 2.4 : 2;
  const cargoLength = length - cabLength - 0.25;
  const cargoBottom = 1.1;
  const cargoHeight = height - cargoBottom;
  const cabHeight = Math.min(height - 0.4, 2.8);
  const cabZ = length / 2 - cabLength / 2;
  const cargoZ = -length / 2 + cargoLength / 2;
  const rearAxles = vehicleClass === 'heavy' ? [-length / 2 + 1.3, -length / 2 + 2.5] : [-length / 2 + 1.3];
  const axles = [length / 2 - cabLength * 0.55, ...rearAxles];
  const wheel = new CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, WHEEL_WIDTH, 12);

  const body = merge([
    boxPart([width * 0.7, 0.35, length - 0.4], [0, 0.75, 0], COLORS.chassis),
    boxPart([width, cargoHeight, cargoLength], [0, cargoBottom + cargoHeight / 2, cargoZ], COLORS.truckCargo),
    boxPart([width, cabHeight, cabLength], [0, 0.6 + cabHeight / 2, cabZ], COLORS.truckCab),
    boxPart([width * 0.86, cabHeight * 0.36, 0.04], [0, 0.6 + cabHeight * 0.72, cabZ + cabLength / 2 + 0.01], COLORS.glass),
    ...axles.flatMap((z) =>
      [-1, 1].map((side) =>
        part(wheel, [side * (width / 2 - WHEEL_WIDTH / 2 + 0.05), WHEEL_RADIUS, z], COLORS.tyre, Math.PI / 2),
      ),
    ),
  ]);
  const accent = merge([
    boxPart([width + 0.02, 0.18, cargoLength - 0.4], [0, cargoBottom + 0.35, cargoZ], '#ffffff'),
    boxPart([0.7, 0.2, 0.3], [0, 0.6 + cabHeight + 0.1, cabZ], '#ffffff'),
  ]);
  wheel.dispose();

  const geometry = { body, accent };
  cache.set(vehicleClass, geometry);
  return geometry;
}

interface Props {
  vehicleClass: VehicleClass;
  /** Status colour for the side stripe and roof beacon. */
  accent: string;
  /** Faint see-through version, for trucks the filters exclude. */
  ghost?: boolean;
}

/** Two draw calls per truck: the body and the status-coloured accents. */
export function TruckModel({ vehicleClass, accent, ghost = false }: Props) {
  const geometry = truckGeometry(vehicleClass);
  return (
    <group>
      <mesh
        geometry={geometry.body}
        material={ghost ? MATERIALS.vertexColoredGhost : MATERIALS.vertexColored}
        castShadow={!ghost}
        receiveShadow
       
      />
      <mesh geometry={geometry.accent} material={accentMaterial(accent, ghost)} />
    </group>
  );
}
