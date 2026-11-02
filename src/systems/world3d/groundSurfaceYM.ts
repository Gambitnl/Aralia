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
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 02/11/2026, 21:55:43
 * Dependents: components/World3D/terrain/groundSurfaceYM.ts, systems/world3d/groundBuildingMotion.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

// Moved 2026-11-02 from src/components/World3D/terrain/groundSurfaceYM.ts (GG-587, rule C11): systems/ code
// (prepareHistoricalTownLoad) needs this pure module. The old path re-exports it.

import { groundSurfaceY, type GroundWorld } from '@/systems/worldforge/bridge/groundChunkLoader';

/**
 * Sample the ground-world surface height (meters) at tile-local meters.
 */
export function groundSurfaceYM(ground: GroundWorld, xM: number, zM: number): number {
  // Walking and building placement share the existing continuous terrain query.
  // Nearest-cell sampling invented steps at cell midpoints and buried saved feet.
  return groundSurfaceY(ground, xM, zM);
}
