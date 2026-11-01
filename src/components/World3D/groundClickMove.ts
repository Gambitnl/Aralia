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

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 28/10/2026, 02:41:27
 * Dependents: components/World3D/GroundMovePlane.tsx
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { sceneToWorld, type SceneOrigin } from '@/systems/world3d/sceneOrigin';
import { Raycaster, type Object3D, type Ray, type Vector3 } from 'three';

type GroundPointer = Pick<PointerEvent, 'pointerId' | 'button' | 'clientX' | 'clientY' | 'isPrimary'>;

/** Camera pan/orbit and ground travel share the canvas. Commit only a primary
 * tap on release; a drag stays canceled even if it returns to its start. The
 * component observes moves outside the pick plane too, so leaving and returning
 * cannot turn a camera gesture into an accidental destination. */
export function createGroundMoveGesture(maxTravelPx = 5) {
  let start: { pointerId: number; x: number; y: number; dragged: boolean } | null = null;
  const cancel = () => { start = null; };
  const valid = (event: GroundPointer) => [event.pointerId, event.clientX, event.clientY].every(Number.isFinite);
  const move = (event: GroundPointer) => {
    if (!start) return;
    if (!valid(event) || event.pointerId !== start.pointerId || event.isPrimary === false) { cancel(); return; }
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > maxTravelPx) start.dragged = true;
  };
  return {
    begin(event: GroundPointer) {
      cancel();
      if (event.button !== 0 || event.isPrimary === false || !valid(event)) return;
      start = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, dragged: false };
    },
    move,
    finish(event: GroundPointer): boolean {
      move(event);
      const accepted = !!start && !start.dragged && event.button === 0;
      cancel();
      return accepted;
    },
    cancel,
  };
}

/** The input plane only captures a pointer event. Its flat elevation cannot
 * define a destination on a raised street or hillside. Pick the nearest real,
 * terrain mesh with the same camera ray used for that click. Presentation
 * toggles may hide terrain without deleting its physical ground surface. */
export function renderedGroundHit(scene: Object3D, ray: Ray): Vector3 | null {
  const terrain: Object3D[] = [];
  scene.traverse(object => {
    if (object.name !== 'world3d:terrain') return;
    terrain.push(object);
  });
  const caster = new Raycaster();
  caster.ray.copy(ray);
  return caster.intersectObjects(terrain, false)[0]?.point ?? null;
}

/** A flat input plane can stand above a desk on sloping ground. Let the visible
 * person, door or furnishing receive that click without also starting a walk.
 * Compare against the real terrain, rather than the input plane's elevation;
 * interactive objects behind the ground do not own the visible destination. */
export function hasInteractionBeforeGround(
  intersections: readonly { distance: number; eventObject: Object3D }[],
  inputPlane: Object3D,
  ray: Ray,
  groundHit: Vector3,
): boolean {
  const groundDistance = ray.origin.distanceTo(groundHit);
  return intersections.some(hit => hit.eventObject !== inputPlane
    && Number.isFinite(hit.distance) && hit.distance >= 0
    && hit.distance <= groundDistance + 1e-5);
}

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
