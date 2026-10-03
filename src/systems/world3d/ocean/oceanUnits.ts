/**
 * @file oceanUnits.ts — the ONE metric boundary of the ocean module.
 *
 * Worldforge canon is feet. Oceanography is metric. Every published constant
 * in the JONSWAP spectrum — alpha, the peak frequency, the TMA depth term,
 * the dispersion relation — assumes meters, seconds and m/s. Rewriting those
 * constants into feet would be a silent transcription bug waiting to happen.
 *
 * So the module keeps the physics metric and converts exactly once, here.
 *
 * The conversion factor is NOT redefined. It is imported from the canonical
 * `src/systems/worldforge/units.ts`, which fixes 1 ft = 0.3048 m exactly.
 *
 * RULE FOR CALLERS: if a value leaves this module it is in feet, and its name
 * ends in `Ft`. If a value stays inside it is in meters, and its name ends in
 * `M` or `Ms`. A name with neither suffix is a bug.
 */
import { FEET_PER_METER, metersFromFeet, type Feet } from '../../worldforge/units';

export { FEET_PER_METER, metersFromFeet };
export type { Feet };

/** Meters -> feet. The outbound half of the boundary. */
export function oceanFeetFromMeters(meters: number): Feet {
  return meters * FEET_PER_METER;
}

/** Feet -> meters. The inbound half of the boundary. */
export function oceanMetersFromFeet(feet: Feet): number {
  return feet * 0.3048;
}
