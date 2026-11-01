/** @file Original foam surface reader contract and TSL expression alias. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 25/10/2026, 04:08:32
 * Dependents: systems/world3d/ocean/oceanFoam.ts, systems/world3d/ocean/oceanFoamReader.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/** A TSL node expression. See `oceanSurface.ts` for why this is `any`. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TslNode = any;

/** The surface's side of the foam: one call at one fragment. */
export interface OceanFoamReader {
  shade(p: {
    /** The fragment's grid coordinate, meters (the surface's `vSample`). */
    sample: TslNode;
    /** The surface's footprint-faded summed fold deficit there, 1 - jac. */
    deficit: TslNode;
    /** The long and short axis of the pixel's footprint on the water, meters. */
    longM: TslNode;
    shortM: TslNode;
  }): { alpha: TslNode; bright: TslNode };
  /**
   * The lasting foam's coverage at a grid coordinate, 0 to 1: the store's F
   * (fine level where it holds the water, else coarse) through the same
   * coverage ramp the surface draws, with no lace and no footprint. Legal in
   * a compute kernel (no screen derivatives): for the spray, whose roots can
   * hold on foam that lasts (GG-279), and for any piece that must know where
   * the water is white.
   */
  coverageAt(sample: TslNode): TslNode;
}
