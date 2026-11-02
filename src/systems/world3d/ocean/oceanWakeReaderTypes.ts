/** @file Original wake surface contract and TSL expression alias; no allocation. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 25/10/2026, 03:57:03
 * Dependents: systems/world3d/ocean/oceanWake.ts, systems/world3d/ocean/oceanWakeReader.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { TslNode } from '@/types/tslNode';

/** A TSL node expression: the shared alias in src/types/tslNode.ts (GG-588). */
export type { TslNode };

/** The surface's side of the wake: one call per stage. */
export interface OceanWakeReader {
  /** Vertex stage: extra height at grid coordinate `sample` (vec2, meters). */
  lift(sample: TslNode): TslNode;
  /** Fragment stage, at the fragment's grid coordinate and pixel footprint. */
  shade(p: { sample: TslNode; longM: TslNode; shortM: TslNode }): {
    /** d(eta)/dx, d(eta)/dz of the wake, to add to the surface's slope. */
    slope: TslNode;
    /** Foam alpha, 0 to 1, to max with the surface's own foam. */
    foam: TslNode;
    /**
     * Bubble cloud weight, 0 to 1, and its light: the surface adds
     * bubbleColor x bubbles to the water's body, under the fresnel.
     */
    bubbles: TslNode;
    bubbleColor: TslNode;
    /**
     * The foam's own light, about 0.65 to 1.08, or 1 where the wake has no
     * foam. The surface multiplies its foam color by it (round 3's routed
     * change), so the wake's white water can have thickness: thin edges and
     * hole rims greyer, the down-sun sides of its heaps in their own shadow.
     * With the look's `foamVolume` and `ageShade` off (round 2) it is the
     * constant 1.
     */
    foamShade: TslNode;
    /**
     * Optional. The share of the sea's specular (sparks and the sun lobe)
     * that survives here, 0 to 1. Leave it out and the surface uses
     * 1 - foam, the rule before this field existed. The churned water of a
     * wake is matte foam and a slick that damps the short waves, so a
     * reader may cut the glints harder than its foam alpha alone.
     */
    glint?: TslNode;
    /**
     * Optional. The wake foam's own opacity share, 0 to 1. The surface
     * mixes foam over the water at 0.85 x its alpha, so 15% of the water
     * shows through; with this field the cap is 0.85 + 0.15 x opacity, so
     * dense young churn can reach solid white while older foam stays
     * translucent. Leave it out and the cap stays 0.85, the rule before
     * this field existed.
     */
    opacity?: TslNode;
  };
}
