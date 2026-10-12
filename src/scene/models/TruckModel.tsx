import type { VehicleClass } from '../../data';
import { TRUCK_SIZE } from '../layout';
import { COLORS } from '../palette';

const WHEEL_RADIUS = 0.5;
const WHEEL_WIDTH = 0.4;

interface Props {
  vehicleClass: VehicleClass;
  /** Status colour for the side stripe and roof beacon. */
  accent: string;
  /** Faint see-through version, for trucks the filters exclude. */
  ghost?: boolean;
}

const GHOST = { transparent: true, opacity: 0.12, depthWrite: false } as const;

/**
 * Box truck with the cab towards local +z and the cargo door at -z.
 * Remount it (key) when toggling `ghost`: material transparency is fixed at compile time.
 */
export function TruckModel({ vehicleClass, accent, ghost = false }: Props) {
  const fade = ghost ? GHOST : {};
  const shadow = !ghost;
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

  return (
    <group>
      {/* Chassis rail */}
      <mesh position={[0, 0.75, 0]} castShadow={shadow}>
        <boxGeometry args={[width * 0.7, 0.35, length - 0.4]} />
        <meshStandardMaterial color={COLORS.chassis} {...fade} />
      </mesh>

      {/* Cargo box */}
      <mesh position={[0, cargoBottom + cargoHeight / 2, cargoZ]} castShadow={shadow} receiveShadow>
        <boxGeometry args={[width, cargoHeight, cargoLength]} />
        <meshStandardMaterial color={COLORS.truckCargo} roughness={0.6} {...fade} />
      </mesh>
      {/* Status stripe along both sides */}
      <mesh position={[0, cargoBottom + 0.35, cargoZ]}>
        <boxGeometry args={[width + 0.02, 0.18, cargoLength - 0.4]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.35} {...fade} />
      </mesh>

      {/* Cab */}
      <mesh position={[0, 0.6 + cabHeight / 2, cabZ]} castShadow={shadow} receiveShadow>
        <boxGeometry args={[width, cabHeight, cabLength]} />
        <meshStandardMaterial color={COLORS.truckCab} roughness={0.4} {...fade} />
      </mesh>
      {/* Windscreen */}
      <mesh position={[0, 0.6 + cabHeight * 0.72, cabZ + cabLength / 2 + 0.01]}>
        <boxGeometry args={[width * 0.86, cabHeight * 0.36, 0.04]} />
        <meshStandardMaterial color={COLORS.glass} roughness={0.15} metalness={0.4} {...fade} />
      </mesh>
      {/* Roof beacon */}
      <mesh position={[0, 0.6 + cabHeight + 0.1, cabZ]}>
        <boxGeometry args={[0.7, 0.2, 0.3]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.2} {...fade} />
      </mesh>

      {/* Wheels */}
      {axles.flatMap((z) =>
        [-1, 1].map((side) => (
          <mesh
            key={`${z}-${side}`}
            position={[side * (width / 2 - WHEEL_WIDTH / 2 + 0.05), WHEEL_RADIUS, z]}
            rotation={[0, 0, Math.PI / 2]}
            castShadow={shadow}
          >
            <cylinderGeometry args={[WHEEL_RADIUS, WHEEL_RADIUS, WHEEL_WIDTH, 12]} />
            <meshStandardMaterial color={COLORS.tyre} roughness={0.9} {...fade} />
          </mesh>
        )),
      )}
    </group>
  );
}
