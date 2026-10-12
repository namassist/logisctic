import { useCallback, useMemo } from 'react';
import { useThree, type ThreeEvent } from '@react-three/fiber';

/**
 * Pointer travel (px) between press and release above which a release is a
 * pan, not a click. R3F fires onClick after a drag that started on an object.
 */
const CLICK_TOLERANCE_PX = 4;

export interface ClickHandlers {
  onClick: (e: ThreeEvent<MouseEvent>) => void;
  onPointerOver: (e: ThreeEvent<PointerEvent>) => void;
  onPointerOut: (e: ThreeEvent<PointerEvent>) => void;
}

/** Returns a factory for click + hover-cursor handlers on selectable objects. */
export function useClickHandlers(): (activate: () => void) => ClickHandlers {
  const canvas = useThree((s) => s.gl.domElement);
  return useCallback(
    (activate) => ({
      onClick: (e) => {
        e.stopPropagation();
        if (e.delta <= CLICK_TOLERANCE_PX) activate();
      },
      onPointerOver: (e) => {
        e.stopPropagation();
        canvas.style.cursor = 'pointer';
      },
      onPointerOut: () => {
        canvas.style.cursor = '';
      },
    }),
    [canvas],
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
