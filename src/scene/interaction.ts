import { useEffect, useMemo, useRef } from 'react';
import { useThree, type ThreeEvent } from '@react-three/fiber';

/**
 * Pointer travel (px) between press and release above which a release is a
 * pan, not a click. R3F fires onClick after a drag that started on an object.
 */
const CLICK_TOLERANCE_PX = 4;

interface ClickHandlers {
  onClick: (e: ThreeEvent<MouseEvent>) => void;
  onPointerOver: (e: ThreeEvent<PointerEvent>) => void;
  onPointerOut: (e: ThreeEvent<PointerEvent>) => void;
}

/**
 * Click + hover-cursor handlers for a selectable object; pass nothing to make
 * it inert. Handlers keep a stable identity, and the pointer cursor is reset
 * if the object is disabled or unmounted while hovered.
 */
export function useClickable(activate?: (e: ThreeEvent<MouseEvent>) => void): Partial<ClickHandlers> {
  const canvas = useThree((s) => s.gl.domElement);
  const latest = useRef(activate);
  latest.current = activate;
  const hovered = useRef(false);
  const enabled = activate !== undefined;

  useEffect(
    () => () => {
      if (hovered.current) {
        hovered.current = false;
        canvas.style.cursor = '';
      }
    },
    [enabled, canvas],
  );

  return useMemo(
    () =>
      enabled
        ? {
            onClick: (e) => {
              e.stopPropagation();
              if (e.delta <= CLICK_TOLERANCE_PX) latest.current?.(e);
            },
            onPointerOver: (e) => {
              e.stopPropagation();
              hovered.current = true;
              canvas.style.cursor = 'pointer';
            },
            onPointerOut: () => {
              hovered.current = false;
              canvas.style.cursor = '';
            },
          }
        : {},
    [enabled, canvas],
  );
}

/** For solid geometry (walls): stops clicks and hover reaching what's behind. */
export function usePointerBlocker(): ClickHandlers {
  const canvas = useThree((s) => s.gl.domElement);
  return useMemo(
    () => ({
      onClick: (e) => e.stopPropagation(),
      onPointerOver: (e) => {
        e.stopPropagation();
        canvas.style.cursor = '';
      },
      onPointerOut: () => {},
    }),
    [canvas],
  );
}
