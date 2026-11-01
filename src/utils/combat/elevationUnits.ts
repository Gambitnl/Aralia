/**
 * @file src/utils/combat/elevationUnits.ts
 * Converts the battle map's encoded elevation (real meters divided by the
 * shared 0.3-meter unit) back to true feet.
 *
 * C11 (agora-9ed9.11): moved verbatim from components/BattleMap/
 * elevationPresentation.ts, which re-exports it, so combat utils no longer
 * import a component module.
 */
import { BATTLE_MAP_ELEVATION_METERS_PER_UNIT } from '../../config/mapConfig';

const FEET_PER_METER = 3.280839895;

/** Recover true relief feet from the battle map's renderer-oriented encoding. */
export function elevationUnitsToFeet(elevation: number): number {
  if (!Number.isFinite(elevation)) return 0;
  return elevation * BATTLE_MAP_ELEVATION_METERS_PER_UNIT * FEET_PER_METER;
}

/**
 * Encode true relief feet in the battle map's elevation units: the inverse of
 * `elevationUnitsToFeet`. A spell that moves earth by a stated number of feet
 * changes a tile's elevation by this many units (GG-533, 2026-10-29).
 */
export function feetToElevationUnits(feet: number): number {
  if (!Number.isFinite(feet)) return 0;
  return feet / FEET_PER_METER / BATTLE_MAP_ELEVATION_METERS_PER_UNIT;
}
