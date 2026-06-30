/**
 * @file disasters.ts — rare, dramatic town-scale events (SPEC D8). Once a year a
 * town may suffer a fire, a plague, or a crime wave. Disasters are uncommon (~12%
 * of years) and bounded so they shock a town's history without ever wiping it out:
 * fires kill a small absolute count, plagues a capped fraction, crime waves drain
 * wealth rather than lives. Like the economy, this is event-grained — one annual
 * draw produces one announcement plus its bounded consequences.
 *
 * Pure: the roll is a function of the supplied RNG only; magnitude helpers are
 * deterministic functions of population (victim SELECTION happens in townSim.ts,
 * which owns the living roster + RNG draw order).
 */
import { SeededRandom } from '../../../utils/random/seededRandom';

export type DisasterKind = 'fire' | 'plague' | 'crime_wave';

/** Plain-English announcement for a town-level disaster chronicle line. */
export function disasterSummary(kind: DisasterKind): string {
  switch (kind) {
    case 'fire':
      return 'A fire swept through the town.';
    case 'plague':
      return 'A plague struck the town.';
    case 'crime_wave':
      return 'A crime wave troubled the town.';
  }
}

/**
 * Draw one year's disaster. Disasters are rare: ~4% fire, ~3% plague, ~5% crime
 * wave, else null (~88% of years are calm). Pure; exactly ONE rng draw so the
 * stream stays aligned with the rest of the year-boundary passes.
 */
export function rollAnnualDisaster(rng: SeededRandom): { kind: DisasterKind } | null {
  const r = rng.next();
  if (r < 0.04) return { kind: 'fire' };
  if (r < 0.07) return { kind: 'plague' };
  if (r < 0.12) return { kind: 'crime_wave' };
  return null;
}

/**
 * Deaths from a fire: a small absolute count that grows slightly with town size
 * (1 in a hamlet, up to 3 in a city), never exceeding the living population.
 */
export function fireDeaths(pop: number): number {
  if (pop <= 0) return 0;
  const scaled = 1 + Math.floor(pop / 60); // 1, then +1 per ~60 souls
  return Math.min(3, scaled, pop);
}

/**
 * Deaths from a plague: ~12% of the population, capped so a plague can never
 * wipe a town out (at least one survivor; never more than half taken).
 */
export function plagueDeaths(pop: number): number {
  if (pop <= 0) return 0;
  const toll = Math.round(pop * 0.12);
  const capped = Math.min(toll, Math.floor(pop / 2)); // never take more than half
  return Math.max(0, Math.min(capped, Math.max(0, pop - 1))); // always leave a survivor
}

/** Per-villager wealth loss from a crime wave (a negative delta). */
export function crimeWaveWealthLoss(): number {
  return -8;
}
