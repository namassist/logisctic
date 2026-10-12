import { useEffect, useRef } from 'react';
import { MapControls } from '@react-three/drei';
import { MathUtils, Vector3 } from 'three';
import type { MapControls as MapControlsImpl } from 'three-stdlib';
import { MAP_BOUNDS } from './layout';

/** Fixed RTS-style view: looking down from the dock/yard corner. */
const YAW = MathUtils.degToRad(45);
const PITCH = MathUtils.degToRad(50);

/**
 * How far the visible ground reaches from the camera target, per unit of
 * camera distance. The target is kept this far inside MAP_BOUNDS so the
 * screen edges stay over the map at every zoom level.
 */
const VIEW_REACH = 0.3;

export const CAMERA = {
  fov: 32,
  startTarget: [6, 0, 16] as [number, number, number],
  startDistance: 112,
  minDistance: 30,
  maxDistance: 200,
};

/** Camera position for a given target and distance along the fixed view angle. */
export function cameraPosition(target: [number, number, number], distance: number): [number, number, number] {
  const dir = new Vector3(
    Math.sin(YAW) * Math.cos(PITCH),
    Math.sin(PITCH),
    Math.cos(YAW) * Math.cos(PITCH),
  ).multiplyScalar(distance);
  return [target[0] + dir.x, target[1] + dir.y, target[2] + dir.z];
}

/** Clamp to [min + margin, max - margin], or the midpoint if that range is empty. */
function clampInside(value: number, min: number, max: number, margin: number): number {
  const lo = min + margin;
  const hi = max - margin;
  return lo <= hi ? MathUtils.clamp(value, lo, hi) : (min + max) / 2;
}

/**
 * Drag to pan across the ground plane, wheel to zoom, arrow keys to pan.
 * Rotation is locked so the isometric angle never changes. The target is
 * clamped to MAP_BOUNDS minus the zoom-dependent view reach, so zoomed in you
 * can reach every edge and zoomed out the view is pulled back to the centre.
 */
export function StrategyCamera() {
  const controls = useRef<MapControlsImpl>(null);

  useEffect(() => {
    controls.current?.listenToKeyEvents(document.body);
  }, []);

  const clampToMap = () => {
    const c = controls.current;
    if (!c) return;
    const { target } = c;
    const reach = c.object.position.distanceTo(target) * VIEW_REACH;
    const dx = clampInside(target.x, MAP_BOUNDS.minX, MAP_BOUNDS.maxX, reach) - target.x;
    const dz = clampInside(target.z, MAP_BOUNDS.minZ, MAP_BOUNDS.maxZ, reach) - target.z;
    const dy = -target.y;
    if (dx === 0 && dz === 0 && dy === 0) return;
    // Shift camera and target together so the viewing angle is preserved.
    target.x += dx;
    target.y += dy;
    target.z += dz;
    c.object.position.x += dx;
    c.object.position.y += dy;
    c.object.position.z += dz;
  };

  return (
    <MapControls
      ref={controls}
      makeDefault
      target={CAMERA.startTarget}
      enableRotate={false}
      screenSpacePanning={false}
      enableDamping
      dampingFactor={0.12}
      minDistance={CAMERA.minDistance}
      maxDistance={CAMERA.maxDistance}
      zoomSpeed={0.8}
      keyPanSpeed={25}
      onChange={clampToMap}
    />
  );
}
