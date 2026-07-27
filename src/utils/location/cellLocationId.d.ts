/**
 * @file cellLocationId.ts — the cell-native player-location id (grid retirement).
 *
 * The player's wilderness/world location is identified by the FMG atlas cell they
 * stand in: `cell_<cellId>`. This replaces the legacy `coord_<x>_<y>` id, which
 * encoded a 30x20 grid tile that no longer exists. Authored places keep their
 * static `LOCATIONS` ids (e.g. 'clearing', 'town_1') — only the procedural
 * wilderness id changes.
 *
 * Pure string helpers; no world/atlas dependency.
 */
export declare const CELL_LOCATION_PREFIX = "cell_";
/** Build the cell-native location id for an atlas cell. */
export declare function makeCellLocationId(cellId: number): string;
/**
 * Parse a `cell_<cellId>` id into its atlas cell id. Returns null for static
 * `LOCATIONS` ids, the legacy `coord_X_Y` form, or malformed strings.
 */
export declare function parseCellLocationId(locationId: string | null | undefined): number | null;
/** True when the id is a cell-native wilderness id (not a static LOCATIONS id). */
export declare function isCellLocationId(locationId: string | null | undefined): boolean;
/**
 * True for a procedural WORLD/wilderness location id (vs a static `LOCATIONS` id).
 * Accepts the cell-native `cell_<id>` form AND the legacy `coord_<x>_<y>` form, so
 * pre-retirement saves keep resolving until their ids are rewritten on load.
 */
export declare function isWildernessLocationId(locationId: string | null | undefined): boolean;
