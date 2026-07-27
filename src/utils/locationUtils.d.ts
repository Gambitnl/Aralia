export declare const getLocation: () => {
    x: number;
    y: number;
};
/**
 * Parse a `coord_<x>_<y>` legacy location id into its world-map tile coordinates.
 * Returns null for non-coord ids (static `LOCATIONS` ids) or malformed strings.
 *
 * Consolidates the `currentLocationId.split('_')` / `/^coord_(\d+)_(\d+)$/`
 * pattern duplicated across handleMovement / worldReducer (cell-native world,
 * Stage 2 — used to derive the canonical player cell from the legacy id).
 */
export declare function parseCoordinateLocationId(locationId: string | null | undefined): {
    x: number;
    y: number;
} | null;
/**
 * Resolve a legacy location id to its world-map tile via the `coord_X_Y`
 * encoding for procedural tiles. Returns null for static `LOCATIONS` ids.
 *
 * Grid retirement (2026-07-01): the static-`LOCATIONS` `mapCoordinates` branch
 * was removed — authored locations no longer carry grid coordinates, so that
 * lookup could only ever return null. Only the legacy `coord_` back-compat
 * parse (old saves) remains. The `locations` argument is retained for call-site
 * compatibility but is no longer read.
 */
export declare function locationIdToTile(locationId: string | null | undefined, _locations?: Record<string, unknown>): {
    x: number;
    y: number;
} | null;
