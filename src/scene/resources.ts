/**
 * Geometries and materials shared by every object of a kind, built once for
 * the app's lifetime. They're passed to meshes as props, which R3F never
 * disposes, so unmounting one truck can't free what the others still use.
 */
import {
  BoxGeometry,
  BufferAttribute,
  Color,
  ConeGeometry,
  CylinderGeometry,
  IcosahedronGeometry,
  Matrix4,
  MeshBasicMaterial,
  MeshStandardMaterial,
  type BufferGeometry,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { COLORS } from './palette';

// ── Geometry ───────────────────────────────────────────────────────────────

export const GEOMETRY = {
  /** Unit box; size it with an instance's scale. */
  box: new BoxGeometry(1, 1, 1),
  cone: new ConeGeometry(0.25, 0.8, 8),
  trunk: new CylinderGeometry(0.25, 0.35, 1, 6),
  canopy: new IcosahedronGeometry(1, 0),
};

const tmpMatrix = new Matrix4();
const tmpColor = new Color();

/** One part of a merged model: a geometry placed in model space, painted one colour. */
export function part(
  geometry: BufferGeometry,
  position: [number, number, number],
  color: string,
  rotationZ = 0,
): BufferGeometry {
  return paint(geometry.clone(), position, color, rotationZ);
}

export function boxPart(size: [number, number, number], position: [number, number, number], color: string) {
  return paint(new BoxGeometry(...size), position, color, 0);
}

function paint(g: BufferGeometry, position: [number, number, number], color: string, rotationZ: number): BufferGeometry {
  g.applyMatrix4(tmpMatrix.makeRotationZ(rotationZ).setPosition(...position));
  tmpColor.set(color); // Color.set converts sRGB hex to the linear working space
  const colors = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < colors.length; i += 3) colors.set([tmpColor.r, tmpColor.g, tmpColor.b], i);
  g.setAttribute('color', new BufferAttribute(colors, 3));
  return g;
}

/** Merges parts into one geometry (one draw call) and frees the pieces. */
export function merge(parts: BufferGeometry[]): BufferGeometry {
  const merged = mergeGeometries(parts);
  if (!merged) throw new Error('Could not merge model parts');
  for (const p of parts) p.dispose();
  return merged;
}

// ── Materials ──────────────────────────────────────────────────────────────

const GHOST = { transparent: true, opacity: 0.12, depthWrite: false } as const;

export const MATERIALS = {
  /** Merged models painted with per-vertex colours. */
  vertexColored: new MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }),
  vertexColoredGhost: new MeshStandardMaterial({ vertexColors: true, roughness: 0.6, ...GHOST }),
  /** Instanced boxes coloured per instance (instance colour × white). */
  instanced: new MeshStandardMaterial({ color: '#ffffff', roughness: 0.8 }),
  /** Self-lit parts (dock signs and lamps). */
  glow: new MeshBasicMaterial({ color: '#ffffff' }),
  /** Pick-only geometry: raycasts, never drawn. */
  pickOnly: new MeshBasicMaterial({ visible: false }),
  ground: (color: string) => standard(color, 0.95),
  concrete: new MeshStandardMaterial({ color: COLORS.concrete, roughness: 0.9 }),
  trunk: new MeshStandardMaterial({ color: COLORS.trunk }),
  foliage: new MeshStandardMaterial({ color: COLORS.foliage, flatShading: true, roughness: 0.9 }),
  cone: new MeshStandardMaterial({ color: '#f97316' }),
};

const standardCache = new Map<string, MeshStandardMaterial>();
function standard(color: string, roughness: number): MeshStandardMaterial {
  const key = `${color}/${roughness}`;
  let m = standardCache.get(key);
  if (!m) standardCache.set(key, (m = new MeshStandardMaterial({ color, roughness })));
  return m;
}

const accentCache = new Map<string, MeshStandardMaterial>();
/** Status-coloured, slightly glowing material (truck stripe and beacon, forklift beacon). */
export function accentMaterial(color: string, ghost = false): MeshStandardMaterial {
  const key = `${color}/${ghost}`;
  let m = accentCache.get(key);
  if (!m) {
    m = new MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.8, ...(ghost ? GHOST : {}) });
    accentCache.set(key, m);
  }
  return m;
}
