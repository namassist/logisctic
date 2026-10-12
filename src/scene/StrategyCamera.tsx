import { useEffect, useRef } from 'react';
import { MapControls } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
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
  /** Start target relative to a site's origin; right of centre to clear the left sidebar and show the yard. */
  startTarget: [14, 0, 20] as [number, number, number],
  startDistance: 112,
  minDistance: 30,
  maxDistance: 200,
};

const FLIGHT = {
  /** Seconds, growing with the distance travelled. */
  duration: (travel: number) => MathUtils.clamp(0.9 + travel / 400, 1.2, 2.4),
  /** Extra camera distance at mid-flight, so the move reads as a fly-over. */
  lift: (travel: number) => Math.min(110, travel * 0.3),
};

interface Flight {
  from: Vector3;
  to: Vector3;
  distance: number;
  lift: number;
  elapsed: number;
  duration: number;
}

/** Camera position for a given target and distance along the fixed view angle. */
export function cameraPosition(target: [number, number, number], distance: number): [number, number, number] {
  const dir = new Vector3(
    Math.sin(YAW) * Math.cos(PITCH),
    Math.sin(PITCH),
    Math.cos(YAW) * Math.cos(PITCH),
  ).multiplyScalar(distance);
  return [target[0] + dir.x, target[1] + dir.y, target[2] + dir.z];
}

/** Start target in world space for a site whose origin is at `originX`. */
export function siteStartTarget(originX: number): [number, number, number] {
  return [originX + CAMERA.startTarget[0], 0, CAMERA.startTarget[2]];
}

/** Clamp to [min + margin, max - margin], or the midpoint if that range is empty. */
function clampInside(value: number, min: number, max: number, margin: number): number {
  const lo = min + margin;
  const hi = max - margin;
  return lo <= hi ? MathUtils.clamp(value, lo, hi) : (min + max) / 2;
}

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * Drag to pan across the ground plane, wheel to zoom, arrow keys to pan.
 * Rotation is locked so the isometric angle never changes. The target is
 * clamped to the focused site's MAP_BOUNDS minus the zoom-dependent view
 * reach. When the focused site changes, the camera flies there: same spot
 * relative to the site, same zoom, with a lift at mid-flight.
 */
export function StrategyCamera({ focusX }: { focusX: number }) {
  const controls = useRef<MapControlsImpl>(null);
  const initialTarget = useRef(siteStartTarget(focusX)).current;
  /** Site whose bounds apply (switched when a flight starts). */
  const boundsX = useRef(focusX);
  const flight = useRef<Flight | null>(null);

  useEffect(() => {
    controls.current?.listenToKeyEvents(document.body);
  }, []);

  useEffect(() => {
    const c = controls.current;
    if (!c || focusX === boundsX.current) return;
    const from = c.target.clone();
    const to = new Vector3(from.x - boundsX.current + focusX, 0, from.z);
    const travel = from.distanceTo(to);
    flight.current = {
      from,
      to,
      distance: c.object.position.distanceTo(c.target),
      lift: FLIGHT.lift(travel),
      elapsed: 0,
      duration: FLIGHT.duration(travel),
    };
    boundsX.current = focusX;
    c.enabled = false; // no user input mid-flight
  }, [focusX]);

  useFrame((_, dt) => {
    const f = flight.current;
    const c = controls.current;
    if (!f || !c) return;
    f.elapsed += dt;
    const t = Math.min(1, f.elapsed / f.duration);
    c.target.lerpVectors(f.from, f.to, easeInOutCubic(t));
    const distance = f.distance + Math.sin(Math.PI * t) * f.lift;
    c.object.position.set(...cameraPosition([c.target.x, 0, c.target.z], distance));
    c.object.lookAt(c.target);
    if (t >= 1) {
      flight.current = null;
      c.enabled = true;
      c.update();
    }
  });

  const clampToMap = () => {
    const c = controls.current;
    if (!c || flight.current) return;
    const { target } = c;
    const reach = c.object.position.distanceTo(target) * VIEW_REACH;
    const ox = boundsX.current;
    const dx = clampInside(target.x, ox + MAP_BOUNDS.minX, ox + MAP_BOUNDS.maxX, reach) - target.x;
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
      target={initialTarget}
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
