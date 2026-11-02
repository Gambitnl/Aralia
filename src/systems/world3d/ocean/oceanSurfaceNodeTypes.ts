/** @file Shared original TSL expression alias for ocean surface source modules. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 25/10/2026, 04:16:12
 * Dependents: systems/world3d/ocean/oceanSurface.ts, systems/world3d/ocean/oceanSurfaceShade.ts, systems/world3d/ocean/oceanSurfaceShadeParams.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * A TSL node expression. The alias and its reason now live in one shared place,
 * src/types/tslNode.ts (GG-588), so each module no longer adds its own `any`.
 * This module re-exports it for the ocean surface modules that import it here.
 */
export type { TslNode } from '@/types/tslNode';
