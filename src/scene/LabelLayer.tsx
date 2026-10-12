import type { RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';
import type { SceneLabel } from './labels';

/** DOM elements for each label, keyed by SceneLabel.key. */
export type LabelElements = Map<string, HTMLDivElement>;

/**
 * Plain DOM overlay with one element per label. It is rendered outside the
 * Canvas; <LabelProjector> moves the elements every frame.
 */
export function LabelLayer({ labels, elements }: { labels: SceneLabel[]; elements: RefObject<LabelElements> }) {
  return (
    <div className="label-layer">
      {labels.map((l) => (
        <div
          key={l.key}
          className={`label label--${l.variant}`}
          ref={(el) => {
            if (el) elements.current.set(l.key, el);
            else elements.current.delete(l.key);
          }}
        >
          {l.dot && <span className="label__dot" style={{ background: l.dot }} />}
          {l.text}
          {l.meta && <span className="label__meta">{l.meta}</span>}
        </div>
      ))}
    </div>
  );
}

const projected = new Vector3();

/** Lives inside the Canvas and pins each overlay element to its 3D anchor. */
export function LabelProjector({ labels, elements }: { labels: SceneLabel[]; elements: RefObject<LabelElements> }) {
  useFrame(({ camera, size }) => {
    for (const label of labels) {
      const el = elements.current.get(label.key);
      if (!el) continue;
      projected.set(...label.position).project(camera);
      const visible = projected.z < 1 && Math.abs(projected.x) < 1.2 && Math.abs(projected.y) < 1.2;
      el.style.visibility = visible ? 'visible' : 'hidden';
      if (!visible) continue;
      const x = ((projected.x + 1) / 2) * size.width;
      const y = ((1 - projected.y) / 2) * size.height;
      el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    }
  });
  return null;
}
