/** A camera-only return to accepted footing; no movement, discovery or time writes. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 28/10/2026, 17:04:05
 * Dependents: components/World3D/World3DScene.tsx
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type {GroundWorld} from '@/systems/worldforge/bridge/groundChunkLoader';
import type {SceneOrigin} from '@/systems/world3d/sceneOrigin';
import {worldToScene} from '@/systems/world3d/sceneOrigin';
import {resolveBuildingMotion} from './groundBuildingMotion';
import {groundSurfaceYM} from './terrain/groundSurfaceYM';
import type {CameraFrameRequest} from './FreeRoamCameraController';
import type {PlayerCameraSightline} from './playerCameraVisibility';

export function playerCameraFrame(
  ground: GroundWorld | null | undefined,
  foot: {xM: number; zM: number; yM: number} | null,
  origin: SceneOrigin,
  nonce: number,
  sightline?: PlayerCameraSightline,
): CameraFrameRequest | null {
  if (!ground || !foot || ![foot.xM, foot.zM, foot.yM].every(Number.isFinite)) return null;
  const target = worldToScene(foot.xM, foot.zM, origin);
  const targetY = foot.yM + 1.15;
  // Try nearby directions and indoor eye heights before shortening the arm.
  // Mounted structure owns visibility; callers without a scene retain the
  // conservative walking sweep. Leave the view alone if no arm is clear.
  // Furnished inn passages can admit three meters but reject four. Test that
  // intermediate arm before compressing the view to two meters; walls, doors,
  // furniture and accepted feet retain their existing physical authority.
  for (const radius of (sightline ? [6, 4, 3, 2, 1.5, 1, 0.65] : [6, 4, 2, 1.5]))
    for (const eyeHeight of (sightline ? [2.6, 1.85] : [2.6])) for (let i = 0; i < 8; i++) {
    const angle = Math.PI / 4 + i * Math.PI / 4;
    const candidate = {xM: foot.xM + Math.cos(angle) * radius, zM: foot.zM + Math.sin(angle) * radius};
    // Mounted geometry checks the actual eye-line, including ceilings and open
    // leaves. Keep the conservative walking sweep for callers without a scene.
    if (!sightline && resolveBuildingMotion(ground, foot, candidate, foot.yM).blocked) continue;
    const eyeY = Math.max(foot.yM + eyeHeight, groundSurfaceYM(ground, candidate.xM, candidate.zM) + 1.5);
    const steps = Math.ceil(radius / 0.5);
    let terrainBlocks = false;
    for (let step = 1; step <= steps; step++) {
      const t = step / steps;
      const height = groundSurfaceYM(ground, foot.xM + (candidate.xM - foot.xM) * t, foot.zM + (candidate.zM - foot.zM) * t);
      if (height + 0.2 >= targetY + (eyeY - targetY) * t) { terrainBlocks = true; break; }
    }
    if (terrainBlocks) continue;
    const position = worldToScene(candidate.xM, candidate.zM, origin);
    if (sightline?.([target.x, targetY, target.z], [position.x, eyeY, position.z]) != null) continue;
    return {kind: 'player', nonce, target: [target.x, targetY, target.z],
      position: [position.x, eyeY, position.z], height: eyeY - targetY};
  }
  return null;
}
