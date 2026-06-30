/**
 * @file economy.ts — event-grained town economy (SPEC D8). Once a year a town
 * draws an economic outcome (good harvest, lean year, levy, trade boom, or a
 * steady year). Outcomes move every living villager's wealth meter and the
 * town's prosperity meter, and write one chronicle line — NOT a per-tick price
 * simulation.
 *
 * Pure: the roll is a function of the supplied RNG only.
 */
import { SeededRandom } from '../../../utils/random/seededRandom';

export type EconomyKind = 'good_year' | 'lean_year' | 'levy' | 'boom' | 'steady';

export interface EconomyOutcome {
  kind: EconomyKind;
  /** Plain-English chronicle line ('' for a steady year — no entry written). */
  summary: string;
  /** Wealth delta applied to every living villager (clamped at 0). */
  wealthDelta: number;
  /** Town prosperity delta (meter clamped to 0..100). */
  prosperityDelta: number;
}

/**
 * Draw one year's economic outcome. ~half of years are 'steady' (no event);
 * the rest split across good/lean/levy/boom.
 */
export function rollAnnualEconomy(rng: SeededRandom): EconomyOutcome {
  const r = rng.next();
  if (r < 0.15) {
    return { kind: 'good_year', summary: 'A bountiful harvest enriched the town.', wealthDelta: 12, prosperityDelta: 8 };
  }
  if (r < 0.3) {
    return { kind: 'lean_year', summary: 'A hard year — lean harvests left the town poorer.', wealthDelta: -10, prosperityDelta: -8 };
  }
  if (r < 0.4) {
    return { kind: 'levy', summary: "A heavy levy drained the town's coffers.", wealthDelta: -8, prosperityDelta: -4 };
  }
  if (r < 0.52) {
    return { kind: 'boom', summary: 'Brisk trade brought prosperity to the market.', wealthDelta: 9, prosperityDelta: 6 };
  }
  return { kind: 'steady', summary: '', wealthDelta: 0, prosperityDelta: 0 };
}
