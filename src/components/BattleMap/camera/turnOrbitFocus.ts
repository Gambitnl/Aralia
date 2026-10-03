/**
 * @file turnOrbitFocus.ts — the pure math behind the per-turn orbit refocus (9A).
 *
 * `CameraController` cannot be unit-tested without an R3F canvas, but the CLAIM
 * 9A makes is arithmetic: over exactly {@link TURN_FOCUS_LERP_SECONDS}, the orbit
 * target travels to the new actor while the camera keeps the distance and angles
 * the player chose. That is what this module computes, and what the controller's
 * frame loop consumes — so the behavior is pinned by tests rather than by a
 * screenshot alone.
 *
 * Deliberately Vector3-free (plain `{x,y,z}` records) so the tests carry no
 * three.js/WebGL dependency.
 */
import { TURN_FOCUS_LERP_SECONDS } from '../../../systems/combat/CameraFocusEventEmitter';

/** A plain world-space point. Structurally compatible with THREE.Vector3. */
export interface OrbitPoint {
  x: number;
  y: number;
  z: number;
}

/**
 * Smoothstep easing: zero velocity at both ends, so the refocus reads as a
 * deliberate camera decision rather than a snap that decays. Clamped, so a
 * frame that overshoots the duration lands exactly on the destination.
 */
export function easeTurnOrbit(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  return clamped * clamped * (3 - 2 * clamped);
}

/** Normalized progress of an orbit that has been running `elapsedSeconds`. */
export function turnOrbitProgress(
  elapsedSeconds: number,
  durationSeconds: number = TURN_FOCUS_LERP_SECONDS,
): number {
  if (durationSeconds <= 0) return 1;
  return Math.min(1, Math.max(0, elapsedSeconds / durationSeconds));
}

/**
 * Where the camera body must end up so that, once the orbit target has moved to
 * `focus`, the view keeps its current distance and angles.
 *
 * This is the whole difference between an ORBIT and the pre-existing pan: the
 * pan slid only the target and let the camera lag behind it, changing the
 * framing; carrying the target→camera offset preserves it exactly.
 */
export function orbitDestinationForFocus(
  cameraPosition: OrbitPoint,
  currentTarget: OrbitPoint,
  focus: OrbitPoint,
): OrbitPoint {
  return {
    x: focus.x + (cameraPosition.x - currentTarget.x),
    y: focus.y + (cameraPosition.y - currentTarget.y),
    z: focus.z + (cameraPosition.z - currentTarget.z),
  };
}

/** Linear interpolation between two points at an already-eased fraction. */
export function lerpOrbitPoint(from: OrbitPoint, to: OrbitPoint, eased: number): OrbitPoint {
  return {
    x: from.x + (to.x - from.x) * eased,
    y: from.y + (to.y - from.y) * eased,
    z: from.z + (to.z - from.z) * eased,
  };
}

/** Grid tile → the world-space point the camera centers on. Mirrors the actors' tile math. */
export function focusPointForTile(
  tile: { x: number; y: number },
  groundY: number,
  tileSize = 1.0,
): OrbitPoint {
  return {
    x: tile.x * tileSize + tileSize / 2,
    y: groundY,
    z: tile.y * tileSize + tileSize / 2,
  };
}

export { TURN_FOCUS_LERP_SECONDS };
