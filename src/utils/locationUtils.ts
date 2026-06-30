// Placeholder to fix build error
export const getLocation = () => ({ x: 0, y: 0 });

/**
 * Parse a `coord_<x>_<y>` legacy location id into its world-map tile coordinates.
 * Returns null for non-coord ids (static `LOCATIONS` ids) or malformed strings.
 *
 * Consolidates the `currentLocationId.split('_')` / `/^coord_(\d+)_(\d+)$/`
 * pattern duplicated across handleMovement / worldReducer (cell-native world,
 * Stage 2 — used to derive the canonical player cell from the legacy id).
 */
export function parseCoordinateLocationId(
  locationId: string | null | undefined,
): { x: number; y: number } | null {
  if (!locationId) return null;
  const m = /^coord_(\d+)_(\d+)$/.exec(locationId);
  if (!m) return null;
  return { x: Number(m[1]), y: Number(m[2]) };
}

/**
 * Resolve a legacy location id to its world-map tile, using the static
 * `LOCATIONS` table's `mapCoordinates` for named places and the `coord_X_Y`
 * encoding for procedural tiles. Returns null when neither applies (e.g. the
 * static start node 'clearing', which has no world tile until spawn relocation).
 */
export function locationIdToTile(
  locationId: string | null | undefined,
  locations: Record<string, { mapCoordinates?: { x: number; y: number } }>,
): { x: number; y: number } | null {
  const coord = parseCoordinateLocationId(locationId);
  if (coord) return coord;
  if (locationId && locations[locationId]?.mapCoordinates) {
    const { x, y } = locations[locationId].mapCoordinates!;
    return { x, y };
  }
  return null;
}
