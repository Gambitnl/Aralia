/**
 * @file gridAtlasBridge.ts — WF atlas-cell spatial helpers (cell-native world).
 *
 * Grid retirement (Cell-Native World): the legacy square-grid ↔ atlas-cell
 * coordinate bridge that used to live here is GONE. The world addresses places
 * by Voronoi cell id over a graph of `graphWidth × graphHeight` — there is no
 * 30×20 grid frame to translate to or from anymore.
 *
 * What remains are pure atlas-space helpers the owned map still depends on:
 * land-snapping a cell, resolving a cell's 3D-entry anchor, and fanning out
 * co-located map pins. The anchor keeps one canonical cell identity while an
 * optional town coordinate only changes the camera window inside that cell.
 * Pure: no React/DOM.
 */
import type { FmgAtlasResult } from '../fmg/generateAtlas';
import type { Entry3DAnchor } from '../../../types/state';
/**
 * Snap an atlas cell to the nearest LAND cell. A land cell returns itself; a
 * water/edge cell returns the nearest cell with height ≥ LAND_H (by site
 * distance). The single home for the land rule both the marker and 3D-entry
 * halves share, so they stop naming different cells for a place.
 */
export declare function snapToLandCell(atlas: FmgAtlasResult, cellId: number): number;
/**
 * Resolve the exact 3D-entry anchor for a clicked atlas cell (cell-native world).
 * The land-snapped clicked cell remains the location identity used by travel,
 * saves, the 2D marker, and the 3D worker. A burg's position is carried only as
 * a window-center override so the Locale still frames the town. FMG occasionally
 * places a burg coordinate across a Voronoi boundary from the cell that owns it;
 * treating that coordinate as a second cell id made the player occupy two places.
 */
export declare function entry3DAnchorForCell(atlas: FmgAtlasResult, cellId: number): Entry3DAnchor;
/**
 * Fan out points that resolve to the identical location so co-located markers
 * (e.g. several SP4 hidden places discovered in the same place, which all snap
 * to one Voronoi site) don't stack into one indistinguishable pin. Points
 * sharing a coordinate are spread on a small deterministic ring around it; unique
 * points pass through untouched. Order-stable (index-seeded), so it's frame-safe.
 */
export declare function spreadColocatedPoints<T extends {
    x: number;
    y: number;
}>(points: T[], radius?: number): T[];
