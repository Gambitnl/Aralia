// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/10/2026, 21:49:36
 * Dependents: components/World3D/FreeRoamCameraController.tsx, components/World3D/World3DScene.tsx, components/World3D/playerCameraFrame.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import * as THREE from 'three';
import {nearestGroundCameraHit} from './cameraGroundRaycast';

export type CameraPoint = readonly [number, number, number];
/** Nearest opaque town structure or ground surface along the camera arm. */
export type PlayerCameraSightline = (focus: CameraPoint, eye: CameraPoint) => number | null;

/** Query real mounted buildings, decks, terrain and roads, never the avatar or NPCs.
 * A clear building-only ray can still put the eye above an opaque bridge while
 * the accepted body stands underneath it, or inside a hill after walking down.
 * Reuse the rendered surfaces for visibility; geometry and feet stay unchanged. */
export function createPlayerCameraSightline(getScene: () => THREE.Scene | null,
  now: () => number = () => performance.now()): PlayerCameraSightline {
  const raycaster = new THREE.Raycaster(), focus = new THREE.Vector3(), direction = new THREE.Vector3();
  let cachedScene: THREE.Scene | null = null, refreshedAt = -Infinity;
  let player: THREE.Object3D | null = null, sampledFrame = -1;
  const playerBounds = new THREE.Box3(), partBounds = new THREE.Box3();
  let buildings: Array<{ root: THREE.Object3D; bounds: THREE.Box3 }> = [];
  return (from, to) => {
    const scene = getScene();
    // No mounted scene is unknown clearance, not proof of a clear arm.
    if (!scene) return 0;
    const time = now();
    // Streaming changes the occluder roster. Cache its broad phase, but read
    // live leaf transforms for every ray so opening a door clears it immediately.
    if (scene !== cachedScene || time - refreshedAt >= 1000) {
      buildings = []; player = null; sampledFrame = -1;
      scene.updateMatrixWorld(true);
      scene.traverse(object => {
        if (object.name === 'world3d:player') player = object;
        if (object.name === 'world3d:site-building' || object.name === 'world3d:decks'
          || object.name === 'world3d:terrain' || object.name === 'world3d:roads') buildings.push({ root: object,
          bounds: new THREE.Box3().setFromObject(object).expandByScalar(2) });
      });
      cachedScene = scene; refreshedAt = time;
    }
    const distance = Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
    if (distance < 1e-6) return null;
    const points: CameraPoint[] = [from];
    if (player?.parent) {
      // The actual figure supplies its height and width, including small races.
      // A clear torso ray alone can still hide the head behind a door lintel.
      const frame = Math.floor(time / 16);
      if (frame !== sampledFrame) {
        player.updateWorldMatrix(true, true); playerBounds.makeEmpty();
        // A projected shadow is wider than the real figure and can put empty
        // sample points inside a door frame. Only visible body parts frame it.
        player.traverseVisible(object => {
          const mesh = object as THREE.Mesh;
          if (!mesh.isMesh || mesh.name === 'blobShadow') return;
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          if (!materials.some(material => material?.visible && material.opacity > 0)) return;
          playerBounds.union(partBounds.setFromObject(mesh));
        });
        sampledFrame = frame;
      }
      if (playerBounds.isEmpty()) return 0;
      const x = (playerBounds.min.x + playerBounds.max.x) / 2, z = (playerBounds.min.z + playerBounds.max.z) / 2;
      const y = (playerBounds.min.y + playerBounds.max.y) / 2;
      const halfX = (playerBounds.max.x - playerBounds.min.x) * 0.42;
      const halfZ = (playerBounds.max.z - playerBounds.min.z) * 0.42;
      points.push([x, playerBounds.max.y - 0.06, z], [x, playerBounds.min.y + 0.12, z],
        [x - halfX, y, z], [x + halfX, y, z], [x, y, z - halfZ], [x, y, z + halfZ]);
    }
    let nearest: number | null = null;
    const updated = new Set<THREE.Object3D>();
    for (const point of points) {
    focus.set(...point); direction.set(...to).sub(focus);
    const sampleLength = direction.length();
    if (sampleLength < 1e-6) continue;
    raycaster.set(focus, direction.divideScalar(sampleLength));
    raycaster.near = 0.01; raycaster.far = sampleLength;
    for (const { root, bounds } of buildings) {
      let ancestor: THREE.Object3D | null = root;
      while (ancestor && ancestor !== scene && ancestor.visible) ancestor = ancestor.parent;
      if (ancestor !== scene || !scene.visible || !raycaster.ray.intersectsBox(bounds)) continue;
      if (!updated.has(root)) { root.updateWorldMatrix(true, true); updated.add(root); }
      if (root.name === 'world3d:terrain' || root.name === 'world3d:roads') {
        const hit = nearestGroundCameraHit(root, raycaster);
        if (hit !== null) {
          const armDistance = hit / sampleLength * distance;
          if (nearest === null || armDistance < nearest) nearest = armDistance;
        }
        continue;
      }
      for (const hit of raycaster.intersectObject(root, true)) {
        let visible = true;
        for (let object: THREE.Object3D | null = hit.object; object; object = object.parent) {
          if (!object.visible) { visible = false; break; }
        }
        const mesh = hit.object as THREE.Mesh;
        const material = Array.isArray(mesh.material) ? mesh.material[hit.face?.materialIndex ?? 0] : mesh.material;
        if (!visible || !material?.visible || material.opacity <= 0 || (material.transparent && material.opacity < 0.95)) continue;
        const armDistance = hit.distance / sampleLength * distance;
        if (nearest === null || armDistance < nearest) nearest = armDistance;
      }
    }
    }
    return nearest;
  };
}

/** Retract the eye before opaque structure on its existing arm; feet and focus never move. */
export function cameraBeforeBuilding(focus: CameraPoint, eye: CameraPoint,
  sightline: PlayerCameraSightline): CameraPoint | null {
  let candidate = eye;
  for (let attempt = 0; attempt < 5; attempt++) {
  const hit = sightline(focus, candidate);
  if (hit === null) return candidate;
  const length = Math.hypot(candidate[0] - focus[0], candidate[1] - focus[1], candidate[2] - focus[2]);
  const available = hit - 0.2;
  // Do not claim a clear view by putting the eye inside its focus or a wall.
  if (available < 0.25 || length < 1e-6) return null;
  const ratio = available / length;
  candidate = [focus[0] + (candidate[0] - focus[0]) * ratio,
    focus[1] + (candidate[1] - focus[1]) * ratio, focus[2] + (candidate[2] - focus[2]) * ratio];
  }
  return null;
}

/** The map's near plane cannot crop rooms after a legal walking-scale retraction.
 * Own only this camera's temporary projection; keep far depth, pose and geometry.
 * A later projection owner is never overwritten during cleanup. */
export function createPlayerCameraProjection() {
  let owned: {camera: THREE.PerspectiveCamera; originalNear: number; appliedNear: number} | null = null;
  const restore = () => {
    if (owned && owned.camera.near === owned.appliedNear && owned.camera.near !== owned.originalNear) {
      owned.camera.near = owned.originalNear;
      owned.camera.updateProjectionMatrix();
    }
    owned = null;
  };
  return {
    update(camera: THREE.Camera, enabled: boolean, focusDistanceM: number) {
      const perspective = camera as THREE.PerspectiveCamera;
      if (!enabled || !perspective.isPerspectiveCamera || !Number.isFinite(perspective.near) || perspective.near <= 0
        || !Number.isFinite(focusDistanceM) || focusDistanceM <= 0) {
        restore(); return;
      }
      if (owned?.camera !== perspective) {
        restore(); owned = {camera: perspective, originalNear: perspective.near, appliedNear: perspective.near};
      } else if (perspective.near !== owned.appliedNear) {
        owned.originalNear = perspective.near;
      }
      // Close rooms need a small plane; a long outdoor arm retains more of
      // the map's depth precision instead of keeping five centimeters everywhere.
      const near = Math.min(owned.originalNear, Math.max(.05, focusDistanceM * .1));
      if (perspective.near !== near) {
        perspective.near = near;
        perspective.updateProjectionMatrix();
      }
      owned.appliedNear = near;
    },
    restore,
  };
}
