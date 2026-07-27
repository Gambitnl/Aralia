// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 20/07/2026, 00:39:56
 * Dependents: components/Worldforge/AtlasMapView.tsx, components/Worldforge/AtlasSvgView.tsx
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file chooses the next Worldforge atlas cell for keyboard navigation.
 *
 * The canonical SVG map and the retired canvas implementation both use the
 * same irregular Voronoi cell graph. Keeping this small calculation outside
 * either renderer prevents the live SVG route from importing canvas code while
 * preserving the old implementation as reference-only code for now.
 *
 * Called by: AtlasSvgView.tsx and the isolated AtlasMapView.tsx reference.
 * Depends on: no renderer, browser API, or generated-world side channel.
 */

// ============================================================================
// Direction contract
// ============================================================================
// These names describe screen-space intent. They do not pretend the generated
// atlas is a square grid; the graph remains the sole source of valid neighbors.
// ============================================================================

export type AtlasKeyboardDirection = "left" | "right" | "up" | "down";

// ============================================================================
// Irregular-cell navigation
// ============================================================================
// Choose only from the current cell's real Voronoi neighbors. The strongest
// directional match wins, and a cell with no match safely keeps focus in place.
// ============================================================================

export function directionalAtlasNeighbor(
  currentCellId: number,
  direction: AtlasKeyboardDirection,
  points: ArrayLike<readonly [number, number]>,
  neighbors: ArrayLike<ArrayLike<number>>,
): number {
  const origin = points[currentCellId];
  if (!origin) return currentCellId;

  const desired = direction === "left" ? [-1, 0]
    : direction === "right" ? [1, 0]
      : direction === "up" ? [0, -1]
        : [0, 1];

  let bestId = currentCellId;
  let bestScore = 0;
  for (const candidateId of Array.from(neighbors[currentCellId] ?? [])) {
    const candidate = points[candidateId];
    if (!candidate) continue;

    const dx = candidate[0] - origin[0];
    const dy = candidate[1] - origin[1];
    const distance = Math.hypot(dx, dy) || 1;
    const score = (dx * desired[0] + dy * desired[1]) / distance;
    if (score > bestScore) {
      bestScore = score;
      bestId = candidateId;
    }
  }

  return bestId;
}
