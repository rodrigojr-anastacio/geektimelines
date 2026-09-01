/**
 * Pointer-gesture maths, kept free of the DOM so it can be unit tested.
 * These are the parts that break silently on a phone: a flick that never
 * glides, a pinch that runs away, a zoom that drifts off the anchor point.
 */

export const MIN_ZOOM = 0.14;
export const MAX_ZOOM = 2.4;

export interface View {
  k: number;
  x: number;
  y: number;
}

export interface Sample {
  t: number;
  x: number;
  y: number;
}

export const clampZoom = (k: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, k));

/** Zoom to `k` while keeping the point under (px, py) pinned in place. */
export function zoomAround(view: View, k: number, px: number, py: number): View {
  const next = clampZoom(k);
  const ratio = next / view.k;
  return { k: next, x: px - (px - view.x) * ratio, y: py - (py - view.y) * ratio };
}

/** Scale for a pinch, given the distance the fingers started and are at now. */
export function pinchZoom(startK: number, startDistance: number, distance: number): number {
  if (!startDistance || !distance) return startK;
  return clampZoom(startK * (distance / startDistance));
}

export const DECAY = 0.94;
export const MIN_FLICK_SPEED = 2;
export const STOP_SPEED = 0.4;
/** A release this long after the last move is a hold, not a flick. */
export const FLICK_WINDOW_MS = 90;

/**
 * Velocity in px per frame from recent move samples, or null when the gesture
 * was too slow, too short or ended with a pause.
 */
export function flickVelocity(samples: Sample[], now: number): { vx: number; vy: number } | null {
  if (samples.length < 2) return null;
  const first = samples[0];
  const last = samples[samples.length - 1];
  const elapsed = last.t - first.t;
  if (elapsed <= 0) return null;
  if (last.t < now - FLICK_WINDOW_MS) return null;
  const vx = ((last.x - first.x) / elapsed) * 16;
  const vy = ((last.y - first.y) / elapsed) * 16;
  if (Math.hypot(vx, vy) < MIN_FLICK_SPEED) return null;
  return { vx, vy };
}

/** One step of the glide. Returns null once it has slowed to a stop. */
export function glideStep(velocity: { vx: number; vy: number }): { vx: number; vy: number } | null {
  const vx = velocity.vx * DECAY;
  const vy = velocity.vy * DECAY;
  return Math.hypot(vx, vy) > STOP_SPEED ? { vx, vy } : null;
}

/** Centroid and spread of the pointers currently down. */
export function centroid(points: { x: number; y: number }[]) {
  const midX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
  const midY = points.reduce((sum, p) => sum + p.y, 0) / points.length;
  const [a, b] = points;
  return { midX, midY, distance: b ? Math.hypot(b.x - a.x, b.y - a.y) : 0 };
}

export interface Size {
  width: number;
  height: number;
}

/** How far past an edge the canvas may be dragged before it stops. */
export const EDGE_MARGIN = 24;

/**
 * Keeps the canvas from being dragged off into empty space. When an axis of the
 * scaled world is smaller than the viewport it is centred on that axis instead,
 * so a small map cannot be shoved into a corner.
 */
export function clampView(view: View, world: Size, box: Size, margin = EDGE_MARGIN): View {
  const axis = (value: number, scaled: number, viewport: number) => {
    if (!Number.isFinite(value)) return 0;
    if (scaled <= viewport) return (viewport - scaled) / 2;
    return Math.min(margin, Math.max(viewport - scaled - margin, value));
  };
  return {
    k: view.k,
    x: axis(view.x, world.width * view.k, box.width),
    y: axis(view.y, world.height * view.k, box.height),
  };
}

/** True when the view is already pinned against an edge on that axis. */
export function isPinned(view: View, world: Size, box: Size, margin = EDGE_MARGIN) {
  const clamped = clampView(view, world, box, margin);
  return {
    x: Math.abs(clamped.x - view.x) > 0.01,
    y: Math.abs(clamped.y - view.y) > 0.01,
  };
}
