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
import { calculateExhaustionEffects } from '../../utils/combat/physicsUtils';

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
// ── Exhaustion's travel cost (travel G1, second half) ───────────────────────
// Failing the march was already wired: App sets the party-wide 'exhaustion'
// condition. What was missing is the OTHER half the rule asks for — an exhausted
// party moves slower. The 5e exhaustion penalty (−5 ft of speed per level) already
// lives in `calculateExhaustionEffects`; these two helpers translate it into the
// overland mph the route planner speaks, so the toll shows up as longer trips
// instead of a cosmetic chip. Nothing about the condition mechanism changes.

/** Overland mph per foot of speed (D&D: 30 ft ≈ 3 mph, so 10 ft ≈ 1 mph). */
const MPH_PER_SPEED_FOOT = 1 / 10;

/** Slowest a worn-out party can still be said to travel, so time stays finite. */
const MIN_EXHAUSTED_MPH = 0.5;

/** The condition string App applies party-wide when a forced march bites. */
export const EXHAUSTION_CONDITION = 'exhaustion';

/**
 * Exhaustion level carried by the party, as travel reads it: the WORST member's
 * level, since the group moves at its slowest member's pace.
 *
 * Today the party-wide condition is a flat string, so a party either carries
 * exhaustion (level 1) or does not. Numbered forms ('exhaustion_2') are read
 * when present so a future stacking implementation needs no change here —
 * see docs/projects/GLOBAL_GAPS.md for the open stacking gap.
 */
export function partyExhaustionLevel(party: readonly { conditions?: string[] }[]): number {
  let worst = 0;
  for (const pc of party) {
    for (const raw of pc.conditions ?? []) {
      const c = String(raw).toLowerCase();
      if (c === EXHAUSTION_CONDITION) worst = Math.max(worst, 1);
      const numbered = /^exhaustion[_ -]?(\d)$/.exec(c);
      if (numbered) worst = Math.max(worst, Number(numbered[1]));
    }
  }
  return worst;
}

/**
 * Overland speed (mph) after exhaustion. Level 0 returns the input untouched, so
 * a rested party is never penalized and every existing call site is unaffected
 * until a caller opts in by passing a level.
 *
 * Level 6 means death in the combat rules, and `calculateExhaustionEffects`
 * stops reporting a speed penalty there; for travel we clamp to level 5 so a
 * doomed party is still the slowest party rather than accidentally the fastest.
 */
export function exhaustedSpeedMph(baseMph: number, level: number): number {
  if (!(level > 0)) return baseMph;
  const { speedPenalty } = calculateExhaustionEffects(Math.min(level, 5));
  return Math.max(MIN_EXHAUSTED_MPH, baseMph - speedPenalty * MPH_PER_SPEED_FOOT);
}
