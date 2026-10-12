import { COLORS } from '../palette';

interface Props {
  /** Status colour for the beacon on the overhead guard. */
  accent: string;
  /** Show a carton on the forks. */
  carrying?: boolean;
}

/** Counterbalance forklift with the forks pointing towards local +z. */
export function ForkliftModel({ accent, carrying = false }: Props) {
  return (
    <group>
      {/* Body and counterweight */}
      <mesh position={[0, 0.65, -0.1]} castShadow receiveShadow>
        <boxGeometry args={[1.1, 0.8, 1.7]} />
        <meshStandardMaterial color={COLORS.forkliftBody} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.85, -0.85]} castShadow>
        <boxGeometry args={[1.1, 0.7, 0.4]} />
        <meshStandardMaterial color={COLORS.forkliftMetal} />
      </mesh>

      {/* Overhead guard: four posts and a roof */}
      {[
        [-0.45, -0.55],
        [0.45, -0.55],
        [-0.45, 0.45],
        [0.45, 0.45],
      ].map(([x, z]) => (
        <mesh key={`${x}-${z}`} position={[x, 1.55, z]} castShadow>
          <boxGeometry args={[0.07, 1.0, 0.07]} />
          <meshStandardMaterial color={COLORS.forkliftMetal} />
        </mesh>
      ))}
      <mesh position={[0, 2.08, -0.05]} castShadow>
        <boxGeometry args={[1.0, 0.06, 1.1]} />
        <meshStandardMaterial color={COLORS.forkliftMetal} />
      </mesh>
      <mesh position={[0, 2.18, -0.3]}>
        <boxGeometry args={[0.22, 0.14, 0.22]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.4} />
      </mesh>

      {/* Mast */}
      {[-0.35, 0.35].map((x) => (
        <mesh key={x} position={[x, 1.3, 0.85]} castShadow>
          <boxGeometry args={[0.1, 2.5, 0.1]} />
          <meshStandardMaterial color={COLORS.forkliftMetal} />
        </mesh>
      ))}

      {/* Forks */}
      {[-0.25, 0.25].map((x) => (
        <mesh key={x} position={[x, 0.12, 1.45]} castShadow>
          <boxGeometry args={[0.1, 0.05, 1.2]} />
          <meshStandardMaterial color={COLORS.forkliftMetal} metalness={0.5} />
        </mesh>
      ))}
      {carrying && (
        <mesh position={[0, 0.55, 1.45]} castShadow>
          <boxGeometry args={[0.95, 0.8, 1.0]} />
          <meshStandardMaterial color={COLORS.carton} />
        </mesh>
      )}

      {/* Wheels */}
      {[
        [-0.55, 0.45],
        [0.55, 0.45],
        [-0.55, -0.6],
        [0.55, -0.6],
      ].map(([x, z]) => (
        <mesh key={`${x}-${z}`} position={[x, 0.28, z]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.28, 0.28, 0.22, 10]} />
          <meshStandardMaterial color={COLORS.tyre} />
        </mesh>
      ))}
    </group>
  );
}
