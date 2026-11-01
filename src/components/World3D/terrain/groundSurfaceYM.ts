/**
 * @file groundSurfaceYM.ts
 * Sampler helper that queries height in meters for a given ground position.
 *
 * Extracted from PlayerAvatar.tsx to decouple non-React component exports
 * from TSX files, ensuring React Fast Refresh hot-reloading works properly in Vite.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 28/10/2026, 11:27:04
 * Dependents: components/World3D/GroundMovePlane.tsx, components/World3D/combat/InPlaceCombatLayer.tsx, components/World3D/groundBuildingMotion.ts, components/World3D/hooks/useInPlaceCombatTransition.ts, components/World3D/playerCameraFrame.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { groundSurfaceY, type GroundWorld } from '@/systems/worldforge/bridge/groundChunkLoader';

/**
 * Sample the ground-world surface height (meters) at tile-local meters.
 */
export function groundSurfaceYM(ground: GroundWorld, xM: number, zM: number): number {
  // Walking and building placement share the existing continuous terrain query.
  // Nearest-cell sampling invented steps at cell midpoints and buried saved feet.
  return groundSurfaceY(ground, xM, zM);
}
