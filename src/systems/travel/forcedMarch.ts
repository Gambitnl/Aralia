/**
 * @file forcedMarch.ts — resolve a committed trip's forced-march exhaustion risk
 * (travel G1) into per-member Constitution saving throws.
 *
 * MapPane computes WHETHER a trip is a forced march (its duration crosses the
 * safe 8-hour day) and the resulting save DC via
 * {@link calculateForcedMarchStatus}, stamping `forcedMarch` onto the trip meta.
 * App's executor then calls this pure resolver after the move: each party member
 * rolls a Constitution save vs the DC, and those who fail are worn down. Keeping
 * the roll pure (the d20 source is injected) mirrors {@link buildProvisionActions}
 * — App wires the real dice util; tests inject a deterministic roll.
 *
 * This reuses the EXISTING condition mechanism: App applies the party-wide
 * 'exhaustion' condition (the same `SET_PARTY_CONDITION` path as travel's
 * 'fatigued'/'starving') when the march bites. No new exhaustion system is
 * invented here — only the per-member save resolution the gap requires.
 */
import type { PlayerCharacter } from '../../types/character';
import { getAbilityModifierValue } from '../../utils/character/statUtils';
import { calculateProficiencyBonus } from '../../utils/character/savingThrowUtils';

/** One member's forced-march Constitution save outcome. */
export interface ForcedMarchSaveResult {
  /** Character id (when present). */
  id?: string;
  /** Character name, for the adventure-log announcement. */
  name: string;
  /** Raw d20 roll. */
  roll: number;
  /** Roll + Constitution modifier (+ proficiency when proficient). */
  total: number;
  /** The DC the save had to meet or beat. */
  dc: number;
  /** True when the member failed (total < dc) and is worn down. */
  failed: boolean;
}

/** The party-level result of a forced march's Constitution saves. */
export interface ForcedMarchOutcome {
  /** Per-member save results, in party order. */
  results: ForcedMarchSaveResult[];
  /** Names of members who failed their save (worn down by the march). */
  failedNames: string[];
  /** True when at least one member failed — the march exhausts the party. */
  anyFailed: boolean;
}

/**
 * Roll each party member's Constitution save against a forced-march DC.
 *
 * @param party    The travelling party.
 * @param saveDC   The Constitution save DC (from {@link calculateForcedMarchStatus}).
 * @param rollD20  A d20 source returning 1–20. App passes the real dice util;
 *                 tests inject a deterministic sequence.
 */
export function resolveForcedMarch(
  party: readonly PlayerCharacter[],
  saveDC: number,
  rollD20: () => number,
): ForcedMarchOutcome {
  const results: ForcedMarchSaveResult[] = party.map((pc) => {
    const conScore = (pc.finalAbilityScores as { Constitution?: number } | undefined)?.Constitution ?? 10;
    let mod = getAbilityModifierValue(conScore);
    const proficient = (pc.savingThrowProficiencies ?? []).some(
      (a) => String(a).toLowerCase() === 'constitution',
    );
    if (proficient) mod += calculateProficiencyBonus(pc.level ?? 1);
    const roll = rollD20();
    const total = roll + mod;
    return {
      id: pc.id,
      name: pc.name ?? 'A traveler',
      roll,
      total,
      dc: saveDC,
      failed: total < saveDC,
    };
  });
  const failedNames = results.filter((r) => r.failed).map((r) => r.name);
  return { results, failedNames, anyFailed: failedNames.length > 0 };
}
