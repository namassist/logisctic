/**
 * Shared easing for things that move between placements (trucks, forklifts
 * and the labels pinned to them). Using one rate keeps labels in step with
 * the object they follow.
 */
const FOLLOW_RATE = 2.5;

/** Fraction of the remaining distance to cover this frame. */
export function followAlpha(dt: number): number {
  return 1 - Math.exp(-FOLLOW_RATE * Math.min(dt, 0.1));
}

/** Interpolates angles the short way round. */
export function lerpAngle(from: number, to: number, alpha: number): number {
  const diff = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return from + diff * alpha;
}
