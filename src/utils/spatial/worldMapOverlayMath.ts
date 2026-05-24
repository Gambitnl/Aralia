// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 24/05/2026, 18:04:55
 * Dependents: utils/spatial/index.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file translates Aralia's hidden world-grid cells onto the visible Azgaar atlas.
 *
 * The travel UI still thinks in row-and-column world cells, while the player sees a
 * pannable and zoomable Azgaar iframe. These helpers keep the highlight boxes lined up
 * with the same transform that the iframe bridge uses for click targeting.
 *
 * Called by: MapPane.tsx for travel precision overlays.
 * Depends on: the Azgaar iframe bridge transform shape exposed by the embedded atlas.
 */

// ============================================================================
// Shared Transform Shapes
// ============================================================================
// These types describe the small bridge payload MapPane can read from the Azgaar
// iframe. Keeping the shape here lets click targeting and visual overlays share
// the same contract instead of each inventing its own version.
// ============================================================================

export type AzgaarAtlasTransform = {
  graphWidth: number;
  graphHeight: number;
  viewX: number;
  viewY: number;
  scale: number;
};

export type OverlayPercentRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

// ============================================================================
// Coordinate Mapping
// ============================================================================
// This section converts world-grid percentages into overlay percentages. The
// fallback path intentionally returns identity mapping so the UI remains usable
// before the Azgaar bridge reports its pan and zoom transform.
// ============================================================================

export function worldNormalizedToOverlayNormalized(
  normalized: number,
  axis: 'x' | 'y',
  transform: AzgaarAtlasTransform | null | undefined,
): number {
  // If the iframe bridge is not ready, line the overlay up with the untransformed
  // atlas. This preserves the old click behavior and avoids blank or NaN styles.
  if (!transform || transform.graphWidth <= 0 || transform.graphHeight <= 0 || transform.scale <= 0) {
    return normalized;
  }

  // Translate a 0-1 world coordinate into the SVG coordinate system Azgaar uses
  // after panning and zooming, then convert it back into a 0-1 overlay coordinate.
  const graphSize = axis === 'x' ? transform.graphWidth : transform.graphHeight;
  const viewOffset = axis === 'x' ? transform.viewX : transform.viewY;
  const worldCoord = normalized * graphSize;
  const svgCoord = worldCoord * transform.scale + viewOffset;
  return svgCoord / graphSize;
}

export function getCellOverlayPercentRect(
  cellX: number,
  cellY: number,
  cols: number,
  rows: number,
  transform: AzgaarAtlasTransform | null | undefined,
): OverlayPercentRect {
  // Convert the cell edges into normalized world positions. Using the edges
  // rather than the center gives MapPane a full rectangle to draw.
  const normLeft = cellX / cols;
  const normRight = (cellX + 1) / cols;
  const normTop = cellY / rows;
  const normBottom = (cellY + 1) / rows;

  // Project each edge into the current overlay space. The percentages can move
  // outside the visible 0-100 range when the atlas is panned, which is expected.
  const left = worldNormalizedToOverlayNormalized(normLeft, 'x', transform) * 100;
  const right = worldNormalizedToOverlayNormalized(normRight, 'x', transform) * 100;
  const top = worldNormalizedToOverlayNormalized(normTop, 'y', transform) * 100;
  const bottom = worldNormalizedToOverlayNormalized(normBottom, 'y', transform) * 100;

  // Keep the rectangle visible even under extreme zoom or rounding conditions.
  return {
    left,
    top,
    width: Math.max(0.25, right - left),
    height: Math.max(0.25, bottom - top),
  };
}
