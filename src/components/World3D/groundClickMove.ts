/**
 * @file groundClickMove.ts
 * Pure conversion for interactive-3D click-to-move: turn a raycast hit on the
 * ground (scene-local meters, what R3F reports in `event.point`) into the
 * tile/world meters convention `SET_PLAYER_GROUND_POS` stores and `PlayerAvatar`
 * renders from.
 *
 * This is the SAME convention the camera-walk (`handleGroundPositionChange`) and
 * the fight-in-place pick plane already use — `sceneToWorld` (add the scene
 * origin) — so a clicked destination lands the avatar exactly where the camera
 * walk would. Kept pure + separate so the coordinate math (the one place a sign
 * error would silently teleport the player) is unit-tested without an R3F render.
 */
import { sceneToWorld, type SceneOrigin } from '@/systems/world3d/sceneOrigin';

/**
 * Convert a ground raycast hit to the player-ground-position meters, clamped to
 * the loaded tile so a click can't send the avatar past the streamed surface
 * (crossing to a neighbour tile is a separate concern — LOCALE_CROSS_TO_CELL).
 *
 * @param pointX scene-local X of the raycast hit (`event.point.x`)
 * @param pointZ scene-local Z of the raycast hit (`event.point.z`)
 * @param origin the scene origin (world point the scene is drawn relative to)
 * @param extentX tile width in meters (GroundWorld.extentMetersX); <=0 disables clamp
 * @param extentZ tile depth in meters (GroundWorld.extentMetersZ); <=0 disables clamp
 */
export function sceneHitToTileMeters(
  pointX: number,
  pointZ: number,
  origin: SceneOrigin,
  extentX: number,
  extentZ: number,
): { xM: number; zM: number } {
  const world = sceneToWorld(pointX, pointZ, origin);
  const xM = extentX > 0 ? Math.max(0, Math.min(extentX, world.x)) : world.x;
  const zM = extentZ > 0 ? Math.max(0, Math.min(extentZ, world.z)) : world.z;
  return { xM, zM };
}
