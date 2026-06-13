// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 12/06/2026, 09:51:50
 * Dependents: components/Worldforge/regionDraw.ts, systems/worldforge/region/generateRegion.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file provides the shared river-centerline smoothing used by both L1
 * region generation and the region canvas renderer.
 *
 * WF-G5 exists because the visual river band and the terrain carve drifted
 * apart at tight bends. Keeping the smoothing here, beside the region
 * generator, gives the generator and renderer one pure source of truth without
 * making systems code import from React/component code.
 *
 * Called by: generateRegion.ts (river carve), regionDraw.ts (river band draw).
 * Depends on: no runtime systems; this helper is deterministic geometry math.
 */

import type { Feet } from '../units';

// ============================================================================
// Shared Parameters
// ============================================================================
// These constants name the renderer's current curve shape. Any future visual
// tweak should change this value once here, then let carve and draw move
// together instead of creating another hidden mismatch.
// ============================================================================

export const REGION_RIVER_SMOOTHING_ITERATIONS = 3;

// ============================================================================
// Chaikin Smoothing
// ============================================================================
// Chaikin smoothing cuts each corner into two weighted points per pass. After
// three passes a hard atlas-cell river bend becomes a readable curved band
// while straight reaches stay on the same line.
// ============================================================================

export function smoothRegionRiverCenterline(
  points: Array<[Feet, Feet]>,
  iterations = REGION_RIVER_SMOOTHING_ITERATIONS,
): Array<[Feet, Feet]> {
  // A line needs at least two points to be rendered or carved. Return a shallow
  // copy so callers can safely treat the result as their own path.
  if (points.length < 2 || iterations <= 0) {
    return points.map(([x, y]) => [x, y]);
  }

  let current: Array<[Feet, Feet]> = points.map(([x, y]) => [x, y]);

  // Each pass replaces every segment with two points. The original endpoints
  // are not preserved, matching the pre-existing road smoothing behavior in
  // generateRegion.ts and keeping river bands softly clipped inside the window.
  for (let iter = 0; iter < iterations; iter++) {
    const smoothed: Array<[Feet, Feet]> = [];
    for (let i = 0; i < current.length - 1; i++) {
      const [ax, ay] = current[i];
      const [bx, by] = current[i + 1];
      smoothed.push([ax * 0.75 + bx * 0.25, ay * 0.75 + by * 0.25]);
      smoothed.push([ax * 0.25 + bx * 0.75, ay * 0.25 + by * 0.75]);
    }
    current = smoothed;
  }

  return current;
}
