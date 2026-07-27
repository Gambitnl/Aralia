/**
 * @file cellFeatures.ts — extract a burg cell's inherited water & roads from the
 * FMG atlas, in ATLAS-PIXEL coords, so {@link canonicalTown} can fold them into
 * the single canonical town plan (docks, bridges, road-continued main streets).
 *
 * These are pure reads of the shared atlas keyed by burgId, so the 2D drill and
 * the 3D bake derive byte-identical inputs — identity is preserved (both views
 * call `getCanonicalTownPlan`, which generates once and transforms the result).
 *
 * Frame note: everything here is atlas-pixel space (the same frame as the cell
 * polygon). `canonicalTown` applies the cell-normalisation affine to these
 * polylines so they land in the town's normalised footprint frame.
 */
import { type Pt } from '../submap/submapEngine';
import type { FmgWorldResult } from '../fmg/generateWorld';
/** Minimal atlas surface this module reads (satisfied by FmgWorldResult). */
export type TownAtlas = Pick<FmgWorldResult, 'pack'>;
/** The burg's home FMG cell index. */
export declare function burgCellId(atlas: TownAtlas, burgId: number): number;
/** The burg's home-cell Voronoi polygon in atlas-pixel coords (the town footprint). */
export declare function burgCellPolygon(atlas: TownAtlas, burgId: number): Pt[];
/**
 * Inherited rivers + coast for the burg cell as atlas-pixel polylines.
 *
 * - Rivers: for each river whose cell sequence passes through the cell, emit a
 *   local crossing segment `[mid(prev,cur), cur, mid(cur,next)]` (a half-segment
 *   when the cell is the river's source or mouth) so the line actually crosses
 *   the footprint — seating riverside docks and bridges between wards.
 * - Coast: every water-facing boundary edge of a coastal cell, so waterfront
 *   wards seat docks on the true harbour side.
 */
export declare function cellWaterFeatures(atlas: TownAtlas, burgId: number): {
    rivers: Pt[][];
    coast: Pt[][];
};
export declare function cellWaterPolylines(atlas: TownAtlas, burgId: number): Pt[][];
/**
 * Inherited regional roads passing through the burg cell, clipped to the cell
 * polygon (atlas-pixel coords). Searoutes are excluded; every land tier
 * (highways, roads, trails, paths) becomes a continued main street in
 * {@link canonicalTown}.
 */
export declare function cellRoadPolylines(atlas: TownAtlas, burgId: number): Pt[][];
