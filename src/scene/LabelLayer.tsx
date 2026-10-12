import { useEffect, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';
import type { SceneLabel } from './labels';
import { followAlpha } from './motion';

/** DOM elements for each label, keyed by SceneLabel.key. */
export type LabelElements = Map<string, HTMLDivElement>;

/**
 * Plain DOM overlay with one element per label. It is rendered outside the
 * Canvas; <LabelProjector> moves the elements every frame.
 */
export function LabelLayer({ labels, elements }: { labels: SceneLabel[]; elements: RefObject<LabelElements> }) {
  // One stable ref callback per key: an inline callback would be detached and
  // re-attached on every render (every simulation tick).
  const refCallbacks = useRef(new Map<string, (el: HTMLDivElement | null) => void>());
  const refFor = (key: string) => {
    let cb = refCallbacks.current.get(key);
    if (!cb) {
      cb = (el) => {
        if (el) elements.current.set(key, el);
        else elements.current.delete(key);
      };
      refCallbacks.current.set(key, cb);
    }
    return cb;
  };

  return (
    <div className="label-layer">
      {labels.map((l) => (
        <div key={l.key} className={`label label--${l.variant}`} ref={refFor(l.key)}>
          {l.dot && <span className="label__dot" style={{ background: l.dot }} />}
          {l.text}
          {l.meta && <span className="label__meta">{l.meta}</span>}
        </div>
      ))}
    </div>
  );
}

const projected = new Vector3();
/** Labels further than this from the camera (e.g. at other sites) are hidden. */
const MAX_LABEL_DISTANCE = 260;

/** What was last written to a label's style, so unchanged labels aren't touched. */
interface Written {
  visible: boolean;
  transform: string;
}

/**
 * Lives inside the Canvas and pins each overlay element to its 3D anchor.
 * Anchors ease towards new positions at the same rate as the objects they
 * belong to, so a label rides along with a truck as it drives. Styles are
 * only written when they change, to keep style recalculation off idle frames.
 */
export function LabelProjector({ labels, elements }: { labels: SceneLabel[]; elements: RefObject<LabelElements> }) {
  const anchors = useRef(new Map<string, Vector3>());
  const written = useRef(new WeakMap<HTMLElement, Written>());

  // Forget anchors of labels that went away, so a truck that comes back later
  // starts its label where the truck reappears.
  useEffect(() => {
    const keys = new Set(labels.map((l) => l.key));
    for (const key of anchors.current.keys()) if (!keys.has(key)) anchors.current.delete(key);
  }, [labels]);

  useFrame(({ camera, size }, dt) => {
    const a = followAlpha(dt);
    for (const label of labels) {
      const el = elements.current.get(label.key);
      if (!el) continue;
      let anchor = anchors.current.get(label.key);
      if (!anchor) anchors.current.set(label.key, (anchor = new Vector3(...label.position)));
      anchor.x += (label.position[0] - anchor.x) * a;
      anchor.y += (label.position[1] - anchor.y) * a;
      anchor.z += (label.position[2] - anchor.z) * a;
      projected.copy(anchor).project(camera);
      const visible =
        projected.z < 1 &&
        Math.abs(projected.x) < 1.2 &&
        Math.abs(projected.y) < 1.2 &&
        camera.position.distanceTo(anchor) < MAX_LABEL_DISTANCE;

      let last = written.current.get(el);
      if (!last) written.current.set(el, (last = { visible: false, transform: '' }));
      if (visible !== last.visible) {
        el.style.visibility = visible ? 'visible' : 'hidden';
        last.visible = visible;
      }
      if (!visible) continue;
      const x = Math.round(((projected.x + 1) / 2) * size.width);
      const y = Math.round(((1 - projected.y) / 2) * size.height);
      const transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
      if (transform !== last.transform) {
        el.style.transform = transform;
        last.transform = transform;
      }
    }
  });
  return null;
}
