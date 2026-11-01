/** Identifies the exact rock geometry shared by Film releases and Flow guards.
 * Saved surfaces can have a different property order after lossless decoding.
 * Explicit field order preserves the existing native identity strings without
 * changing geometry, checkpoint state, or the meaning of the contact guards. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 11/10/2026, 03:54:37
 * Dependents: systems/world3d/river/waterfallContactFilm.ts, systems/world3d/river/waterfallContactFlow.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { ContactSurface } from './waterfallContactFlow';

export function waterfallContactGeometryIdentity(surface: ContactSurface): string {
  // Preserve the existing JSON number semantics, including its signed-zero
  // limitation. Exact lossless checkpoint comparison remains a separate gate.
  return JSON.stringify({ id: surface.id, vertices: surface.vertices, normal: surface.normal });
}
