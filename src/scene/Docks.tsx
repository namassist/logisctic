import { BUILDING, FRONT_Z, type DockPlacement } from './layout';
import { COLORS, DOCK_TYPE_COLOR } from './palette';

const { doorHeight, wallThickness } = BUILDING;
const OUTSIDE = FRONT_Z + wallThickness / 2;

/**
 * Door, lamp and type sign for each dock (the number is an overlay label). Occupied doors are open and lit,
 * free doors have their shutter down, and docks under maintenance are taped off.
 */
export function Docks({ docks }: { docks: DockPlacement[] }) {
  return (
    <group>
      {docks.map(({ dock, x, doorWidth, occupiedBy }) => {
        const maintenance = dock.status === 'maintenance';
        const open = occupiedBy !== null;
        const typeColor = DOCK_TYPE_COLOR[dock.type];
        return (
          <group key={dock.id} position={[x, 0, 0]}>
            {!open && (
              <mesh position={[0, doorHeight / 2, FRONT_Z]} castShadow receiveShadow>
                <boxGeometry args={[doorWidth, doorHeight, 0.2]} />
                <meshStandardMaterial color={COLORS.shutter} roughness={0.6} metalness={0.3} />
              </mesh>
            )}

            {/* Lamp over the door: warm when a truck is being worked */}
            <mesh position={[0, doorHeight + 0.25, OUTSIDE + 0.15]}>
              <boxGeometry args={[doorWidth * 0.5, 0.12, 0.25]} />
              <meshStandardMaterial
                color={open ? COLORS.doorwayGlow : '#3b4048'}
                emissive={open ? COLORS.doorwayGlow : '#000000'}
                emissiveIntensity={open ? 2 : 0}
              />
            </mesh>

            {/* Sign coloured by dock type */}
            <mesh position={[0, doorHeight + 0.95, OUTSIDE + 0.05]}>
              <boxGeometry args={[doorWidth * 0.7, 0.45, 0.08]} />
              <meshStandardMaterial color={typeColor} emissive={typeColor} emissiveIntensity={0.5} />
            </mesh>

            {maintenance && (
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
          </group>
        );
      })}
    </group>
  );
}
