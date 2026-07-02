/**
 * @file edgeWeld.ts
 * @description Weld a chunk's border-vertex heights onto the shared anchor
 * polyline so neighboring chunks are watertight across LOD tiers.
 *
 * Why this is built this way:
 * - Neighboring chunks sample the same height field, but at per-tier edge
 *   densities (17/9/5 vertices per edge). Between shared vertices the finer
 *   edge follows the field while the coarser edge cuts a chord — a real
 *   T-junction crack, visible as a grid of dark/white slivers (the flat-shaded,
 *   front-side-only material can't hide it behind the skirt).
 * - All tiers DO share the 5 anchor vertices at t = 0, 1/4, 1/2, 3/4, 1 along
 *   each edge (the config invariant: every tier's segment count is a multiple
 *   of 4). Snapping every other border vertex onto the straight line between
 *   its surrounding anchors makes every tier emit the exact same border
 *   polyline — watertight with NO knowledge of the neighbor's tier, which also
 *   makes it immune to the streamer's stale-tier patchwork (chunks keep their
 *   loaded resolution until unloaded).
 * - Interior vertices are untouched; only the outermost ring loses detail, and
 *   only down to the coarsest tier's edge sampling.
 */

/** Number of edge segments in the shared anchor basis (the coarsest tier). */
export const ANCHOR_SEGMENTS = 4;

/**
 * Returns a copy of `heights` whose border vertices are snapped onto the
 * piecewise-linear curve through the edge's anchor vertices. No-op (returns the
 * input untouched) when the grid can't nest into the anchor basis — callers
 * with custom resolutions keep their exact samples.
 */
export function weldChunkEdgeHeights(heights: Float32Array, resolution: number): Float32Array {
  const segments = resolution - 1;
  if (segments < ANCHOR_SEGMENTS || segments % ANCHOR_SEGMENTS !== 0) return heights;
  const step = segments / ANCHOR_SEGMENTS; // vertices between consecutive anchors
  if (step === 1) return heights; // every border vertex is an anchor already

  const welded = heights.slice();
  const weldRun = (indexAt: (k: number) => number): void => {
    for (let a = 0; a < segments; a += step) {
      const h0 = welded[indexAt(a)];
      const h1 = welded[indexAt(a + step)];
      for (let k = 1; k < step; k++) {
        welded[indexAt(a + k)] = h0 + (h1 - h0) * (k / step);
      }
    }
  };

  weldRun((k) => k); // north edge (j = 0)
  weldRun((k) => segments * resolution + k); // south edge (j = res-1)
  weldRun((k) => k * resolution); // west edge (i = 0)
  weldRun((k) => k * resolution + segments); // east edge (i = res-1)
  return welded;
}
