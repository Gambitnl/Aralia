/**
 * @file festivals.ts — recurring annual festivals for the living-world town sim.
 *
 * Festivals are CALENDAR-deterministic: they recur on fixed days-of-year and
 * draw NO randomness at all. A festival on a given day-of-year is either shared
 * across every town (seasonal feasts) or specific to a burg (its Founding Day
 * and its Patron's Feast), derived from the burgId via the FROZEN fnv1a hash so
 * the same burg always celebrates on the same days. Keeping festivals decoupled
 * from rng means adding this layer leaves every other pass's RNG stream — and so
 * every existing test — completely unperturbed.
 *
 * Each burg also keeps the holy day of a PATRON DEITY, picked deterministically
 * from the game's pantheon by burgId — so the Patron's Feast is named for a real
 * god ("the Feast of Pelor"). (This is a deterministic per-town patron, not the
 * town's generated temple deity, which keeps this layer pure/decoupled.)
 *
 * Pure: derives names from (dayOfYear, burgId), mutates nothing.
 */
import { fnv1a } from '../seedPath';
import { DEITIES } from '../../../data/deities';
import { DAYS_PER_YEAR } from './constants';

/** A festival fixed to a particular day-of-year (0..364). */
export interface SeasonalFestival {
  name: string;
  dayOfYear: number;
}

/**
 * Shared seasonal festivals every town keeps, spread across the year. Days are
 * fixed points roughly at the quarter-marks of the 365-day calendar.
 */
export const SEASONAL_FESTIVALS: readonly SeasonalFestival[] = [
  { name: 'the Spring Festival', dayOfYear: 80 },
  { name: 'the Midsummer Festival', dayOfYear: 172 },
  { name: 'the Harvest Festival', dayOfYear: 266 },
  { name: 'the Midwinter Festival', dayOfYear: 355 },
];

/** Day-of-year (0..364) a burg celebrates its founding — deterministic per burg. */
export function foundingDayOfYear(burgId: number): number {
  return fnv1a(`founding:${burgId}`) % DAYS_PER_YEAR;
}

/** Day-of-year (0..364) a burg keeps its patron's feast — deterministic per burg. */
export function patronFeastDayOfYear(burgId: number): number {
  return fnv1a(`patron:${burgId}`) % DAYS_PER_YEAR;
}

/** The patron deity a burg honours — deterministic per burg, from the pantheon. */
export function patronDeityName(burgId: number): string {
  if (DEITIES.length === 0) return 'the Old Gods';
  return DEITIES[fnv1a(`deity:${burgId}`) % DEITIES.length].name;
}

/**
 * Names of all festivals (shared seasonal + this burg's Founding Day + Patron's
 * Feast) that fall on the given day-of-year. `[]` on an ordinary day.
 */
export function festivalsOnDayOfYear(dayOfYear: number, burgId: number): string[] {
  const names: string[] = [];
  for (const f of SEASONAL_FESTIVALS) {
    if (f.dayOfYear === dayOfYear) names.push(f.name);
  }
  if (foundingDayOfYear(burgId) === dayOfYear) names.push("the town's Founding Day");
  if (patronFeastDayOfYear(burgId) === dayOfYear) names.push(`the Feast of ${patronDeityName(burgId)}`);
  return names;
}
