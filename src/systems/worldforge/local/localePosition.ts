/**
 * @file localePosition.ts — the meters↔Locale-feet bridge (cell-native world,
 * Stage 3).
 *
 * Stage 3 ("Locale movement") makes the 2D Locale view and the 3D ground view
 * two synced views of ONE movement state. That state is the player's position
 * inside the current Locale (the zoomed-in town map / ground world).
 *
 * The 3D ground view already writes that position as TILE-LOCAL METERS into
 * `GameState.playerGroundPos` (`{ xM, zM }`), where one ground cell is
 * GROUND_METERS_PER_CELL = 1.524 m = 5 ft. The canonical player presence
 * (`PlayerCell.localeCoords`) records it as CONTINUOUS LOCALE FEET. This module
 * is the single, pure, exact conversion between the two domains — meters live
 * only at the World3D boundary (Worldforge is feet-canon, SPEC §4), and we
 * convert once, here, via the canonical `units.ts` shim.
 *
 * It introduces NO mapping of cells↔tiles and never calls the Stage-1 protected
 * functions (`legacyTileToAtlasCell` / `getTownTilesForGrid` / `atlasCellToLegacyGrid`).
 * Locale feet are strictly Locale-LOCAL (relative to the current ground world's
 * north-west origin), exactly as `subMapCoordinates` was tile-local.
 *
 * GRID-RETIRE: BA-3 — `localeCoords` is now continuous Locale feet backed by
 * `playerGroundPos` (this bridge + the worldReducer mirror), resolving the
 * Stage-2 "submap sub-tile" band-aid for the ground path.
 */
import { feetFromMeters, metersFromFeet } from '../units';

/** One Locale (ground) cell is 5 ft — mirrors GROUND_METERS_PER_CELL (1.524 m). */
export const LOCALE_CELL_FT = 5;

/**
 * Tile-local ground meters (`playerGroundPos.{xM,zM}`) → Locale-local feet
 * `{x,y}`. The 3D Z axis maps to the 2D/Locale Y axis (same convention as
 * `PlayerWorldPosition.z` → 2D atlas Y). Pure + exact.
 */
export function groundPosToLocaleFeet(pos: { xM: number; zM: number }): { x: number; y: number } {
  return { x: feetFromMeters(pos.xM), y: feetFromMeters(pos.zM) };
}

/**
 * Locale-local feet `{x,y}` → tile-local ground meters `{xM,zM}` (for a 3D spawn
 * / camera move). Inverse of `groundPosToLocaleFeet`. Pure + exact.
 */
export function localeFeetToGroundMeters(feet: { x: number; y: number }): { xM: number; zM: number } {
  return { xM: metersFromFeet(feet.x), zM: metersFromFeet(feet.y) };
}

/**
 * Clamp a Locale-feet position to a ground world's extent. The Locale spans
 * `cols × LOCALE_CELL_FT` feet east and `rows × LOCALE_CELL_FT` feet south.
 */
export function clampLocaleFeet(
  feet: { x: number; y: number },
  extent: { cols: number; rows: number },
): { x: number; y: number } {
  const maxX = extent.cols * LOCALE_CELL_FT;
  const maxY = extent.rows * LOCALE_CELL_FT;
  return {
    x: Math.max(0, Math.min(maxX, feet.x)),
    y: Math.max(0, Math.min(maxY, feet.y)),
  };
}
