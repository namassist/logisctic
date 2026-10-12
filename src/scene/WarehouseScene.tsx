import { SoftShadows } from '@react-three/drei';
import { EffectComposer, Outline, Select, Selection, ToneMapping } from '@react-three/postprocessing';
import { BlendFunction, ToneMappingMode } from 'postprocessing';
import type { EntityRef } from '../state/entities';
import { Building } from './Building';
import { Decor } from './Decor';
import { Docks } from './Docks';
import { Forklifts } from './Forklifts';
import { Ground } from './Ground';
import type { HighlightBox, SiteLayout } from './layout';
import { COLORS } from './palette';
import { Shelving } from './Shelving';
import { Trucks } from './Trucks';

/** Shadow frustum half-size; covers the whole playable map. */
const SHADOW_EXTENT = 110;
const OUTLINE_COLOR = 0xf5a524;

interface Props {
  layout: SiteLayout;
  selection: EntityRef | null;
  /** Box to outline for selections drawn with instancing (racks, stock). */
  highlight: HighlightBox | null;
  onSelect: (ref: EntityRef) => void;
}

/** Invisible box that only shows up as an outline. */
function OutlineBox({ box }: { box: HighlightBox }) {
  return (
    <Select enabled>
      <mesh position={box.center}>
        <boxGeometry args={box.size} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </Select>
  );
}

/** Everything inside the Canvas for one site, drawn from a precomputed layout. */
export function WarehouseScene({ layout, selection, highlight, onSelect }: Props) {
  return (
    <Selection>
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
      <Docks docks={layout.docks} selection={selection} onSelect={onSelect} />
      <Shelving racks={layout.racks} stock={layout.stock} onSelect={onSelect} />
      <Trucks trucks={layout.trucks} selection={selection} onSelect={onSelect} />
      <Forklifts forklifts={layout.forklifts} selection={selection} onSelect={onSelect} />
      <Decor />
      {highlight && <OutlineBox box={highlight} />}

      {/* The composer turns off renderer tone mapping, so it's re-applied as the last pass. */}
      <EffectComposer multisampling={4} autoClear={false}>
        <Outline
          // Alpha keeps the amber readable over the light floor (the default screen blend washes it out).
          blendFunction={BlendFunction.ALPHA}
          blur
          edgeStrength={8}
          visibleEdgeColor={OUTLINE_COLOR}
          // Same colour for hidden edges: rack/stock outline boxes sit behind their own
          // geometry, and a truck behind a wall should still read as selected.
          hiddenEdgeColor={OUTLINE_COLOR}
          width={1200}
        />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      </EffectComposer>
    </Selection>
  );
}
