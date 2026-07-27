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
export declare function disasterSummary(kind: DisasterKind): string;
/**
 * Draw one year's disaster. Disasters are rare: ~4% fire, ~3% plague, ~5% crime
 * wave, else null (~88% of years are calm). Pure; exactly ONE rng draw so the
 * stream stays aligned with the rest of the year-boundary passes.
 */
export declare function rollAnnualDisaster(rng: SeededRandom): {
    kind: DisasterKind;
} | null;
/**
 * Deaths from a fire: a small absolute count that grows slightly with town size
 * (1 in a hamlet, up to 3 in a city), never exceeding the living population.
 */
export declare function fireDeaths(pop: number): number;
/**
 * Deaths from a plague: ~12% of the population, capped so a plague can never
 * wipe a town out (at least one survivor; never more than half taken).
 */
export declare function plagueDeaths(pop: number): number;
/** Per-villager wealth loss from a crime wave (a negative delta). */
export declare function crimeWaveWealthLoss(): number;
