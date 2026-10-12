import { SoftShadows } from '@react-three/drei';
import { Building } from './Building';
import { Decor } from './Decor';
import { Docks } from './Docks';
import { Forklifts } from './Forklifts';
import { Ground } from './Ground';
import type { SiteLayout } from './layout';
import { COLORS } from './palette';
import { Shelving } from './Shelving';
import { Trucks } from './Trucks';

/** Shadow frustum half-size; covers the whole playable map. */
const SHADOW_EXTENT = 110;

/** Everything inside the Canvas for one site, drawn from a precomputed layout. */
export function WarehouseScene({ layout }: { layout: SiteLayout }) {
  return (
    <>
      <color attach="background" args={[COLORS.background]} />
      <fog attach="fog" args={[COLORS.background, 230, 420]} />

      <SoftShadows size={18} samples={12} focus={0.6} />
      <hemisphereLight args={['#b7c6e8', '#3a332a', 1.5]} />
      {/* Key light (casts the shadows) and a soft fill from the camera side for the walls */}
      <directionalLight
        position={[60, 95, 75]}
        intensity={3.4}
        color="#ffe3bd"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
        shadow-camera-left={-SHADOW_EXTENT}
        shadow-camera-right={SHADOW_EXTENT}
        shadow-camera-top={SHADOW_EXTENT}
        shadow-camera-bottom={-SHADOW_EXTENT}
        shadow-camera-near={10}
        shadow-camera-far={320}
      />
      <directionalLight position={[-60, 50, 90]} intensity={0.9} color="#c9d6ff" />

      <Ground dockCount={layout.docks.length} />
      <Building docks={layout.docks} zones={layout.zones} />
      <Docks docks={layout.docks} />
      <Shelving racks={layout.racks} stock={layout.stock} />
      <Trucks trucks={layout.trucks} />
      <Forklifts forklifts={layout.forklifts} />
      <Decor />
    </>
  );
}
