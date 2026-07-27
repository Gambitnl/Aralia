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
export type AtlasKeyboardDirection = "left" | "right" | "up" | "down";
export declare function directionalAtlasNeighbor(currentCellId: number, direction: AtlasKeyboardDirection, points: ArrayLike<readonly [number, number]>, neighbors: ArrayLike<ArrayLike<number>>): number;
