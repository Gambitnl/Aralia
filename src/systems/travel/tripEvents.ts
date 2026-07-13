/**
 * @file tripEvents.ts — one seeded travel event per committed land trip
 * (mountains spec §3, trip-events bullet; Remy ruling 2026-07-11).
 *
 * The travel-event service and its biome pools (mountain, forest_haunted,
 * forest_fey, …) have been data-live but DEAD in real play: nothing rolled them
 * on the cell-native travel path. This module revives them. MapPane owns the
 * committed trip; `rollTripEvent` decides — once per trip, seeded — whether an
 * event fires, which biome pool governs it, and how a skill-check event
 * resolves against the party. App applies the returned outcome (message to the
 * adventure log, delay onto the trip's clock advance), mirroring navDrift.
 *
 * Caller-guarded: MapPane only calls this for LAND trips (`hasSeaLeg` skips it
 * — you don't meet a rockslide on a ferry), exactly like deriveNavDrift's
 * commit-site guard. The unit-level guard here is the degenerate no-trip route.
 *
 * Outcome scope (v1): `message` + `extraSeconds` only. A `delay` effect is the
 * one mechanical consequence applied; other effect types (health_change,
 * item_gain, gold_gain, xp_gain, buff) currently read as flavor in the message
 * — wiring those consequences is a later slice, not silently faked here.
 */
import { SKILLS_DATA } from '../../data/skills';
import { generateTravelEvent } from '../../services/travelEventService';
import { TRIP_EVENT_CHANCE, TRIP_EVENT_DRAMA } from '../worldforge/mountains/mountainTunables';
import type { AbilityScores } from '../../types';
import { getAbilityModifierValue } from '../../utils/character/statUtils';
import type { SeededRandom } from '@/utils/random';

/** What a fired trip event hands App: the log line + the trip-clock delay. */
export interface TripEventOutcome {
  message: string;
  extraSeconds: number;
}

/**
 * The minimal party-member shape trip-event checks read — the EXACT fields the
 * partySurvivalModifier computation (GameModals) already reads off
 * `gameState.party`, generalized to any skill: `finalAbilityScores` (falling
 * back to `abilityScores`, then 10), `skills[].id` for proficiency, and
 * `proficiencyBonus` (default 2). All optional, so MapPane's transport-only
 * callers stay valid; `PlayerCharacter` satisfies it structurally.
 */
export interface TripEventPartyMember {
  finalAbilityScores?: Partial<AbilityScores> | null;
  abilityScores?: Partial<AbilityScores> | null;
  skills?: ReadonlyArray<{ id: string }> | null;
  proficiencyBonus?: number | null;
}

/**
 * The legacy biome id that GOVERNS a trip's single event roll (which pool the
 * service draws from). Priority (mountains spec §3):
 *   1. The FIRST id in TRIP_EVENT_DRAMA present among the route's biomes —
 *      drama outranks frequency (one crag cell beats ten forest cells).
 *   2. Else the route's most-crossed non-`plains_*` id (plains are the bland
 *      default; they never outvote a real biome). Ties go to the id reached
 *      first along the route.
 *   3. Else 'general' (an all-plains or all-unknown route still gets the
 *      general pool).
 * Cells whose biome is unknown (`undefined`) are ignored, not defaulted.
 */
export function governingTripBiome(
  routeCells: number[],
  biomeIdOf: (cell: number) => string | undefined,
): string {
  const biomes: string[] = [];
  for (const cell of routeCells) {
    const biome = biomeIdOf(cell);
    if (biome) biomes.push(biome);
  }
  const present = new Set(biomes);
  for (const dramaId of TRIP_EVENT_DRAMA) {
    if (present.has(dramaId)) return dramaId;
  }
  // Most-frequent non-plains id; Map iteration preserves first-crossed order.
  const counts = new Map<string, number>();
  for (const biome of biomes) {
    if (biome.startsWith('plains_')) continue;
    counts.set(biome, (counts.get(biome) ?? 0) + 1);
  }
  let governing: string | undefined;
  let bestCount = 0;
  for (const [id, count] of counts) {
    if (count > bestCount) { governing = id; bestCount = count; }
  }
  return governing ?? 'general';
}

/**
 * A trip skill check's total: one d20 off the shared trip stream + the PARTY'S
 * BEST modifier for the skill. The modifier generalizes GameModals'
 * partySurvivalModifier verbatim — per member, ability mod of the skill's
 * governing ability (skills index skill → ability; `finalAbilityScores` ??
 * `abilityScores` ?? 10) plus `proficiencyBonus` (?? 2) when the member lists
 * the skill among their proficiencies — then MAX across the party (the best
 * climber hauls everyone past the rockslide). An all-negative party stays
 * negative (starting at zero would silently upgrade weak groups); only an
 * EMPTY party reads as modifier 0.
 */
export function bestPartyCheckTotal(
  party: ReadonlyArray<TripEventPartyMember>,
  skill: string,
  rng: SeededRandom,
): number {
  const roll = rng.nextInt(1, 21); // d20 — nextInt is max-exclusive ⇒ 1..20
  const ability = SKILLS_DATA[skill]?.ability;
  let best = Number.NEGATIVE_INFINITY;
  for (const pc of party) {
    const score = (ability != null
      ? pc.finalAbilityScores?.[ability] ?? pc.abilityScores?.[ability]
      : undefined) ?? 10;
    const proficient = pc.skills?.some((s) => s.id === skill) ?? false;
    const modifier = getAbilityModifierValue(score) + (proficient ? (pc.proficiencyBonus ?? 2) : 0);
    if (modifier > best) best = modifier;
  }
  return roll + (Number.isFinite(best) ? best : 0);
}

/**
 * Roll THE one travel event for a committed land trip. Returns undefined when
 * no event fires (the TRIP_EVENT_CHANCE gate holds ~75% of trips silent) or
 * when the route is no trip at all (fewer than 2 cells — no rng consumed).
 *
 * One seeded stream, in draw order: chance gate → weighted pool pick → (skill
 * check events only) the party's d20 via `partyCheckTotal`. MapPane constructs
 * the SeededRandom from (worldSeed, destination cell) and passes the SAME
 * instance to both this rng and the partyCheckTotal closure, so a given world
 * + trip always reproduces the same event AND the same check roll.
 *
 * Skill-check events resolve here, not in App: `partyCheckTotal(skill) >= dc`
 * picks the success branch, else failure. The outcome message is the event
 * description plus the branch description (failure text is optional in the
 * data; absent means the base description stands alone). The delay is the
 * resolved effect — branch effect when the branch carries one, else the
 * event's base effect — and only `delay` effects cost time (hours × 3600).
 */
export function rollTripEvent(
  routeCells: number[],
  biomeIdOf: (cell: number) => string | undefined,
  partyCheckTotal: (skill: string) => number,
  rng: SeededRandom,
): TripEventOutcome | undefined {
  if (routeCells.length < 2) return undefined; // no trip, no event, no rng draw
  const governing = governingTripBiome(routeCells, biomeIdOf);
  const event = generateTravelEvent(governing, TRIP_EVENT_CHANCE, undefined, () => rng.next());
  if (!event) return undefined;

  let message = event.description;
  let effect = event.effect;
  if (event.skillCheck) {
    const { check, successEffect, successDescription, failureEffect, failureDescription } = event.skillCheck;
    const success = partyCheckTotal(check.skill) >= check.dc;
    const branchDescription = success ? successDescription : failureDescription;
    if (branchDescription) message = `${event.description} ${branchDescription}`;
    effect = (success ? successEffect : failureEffect) ?? event.effect;
  }
  const extraSeconds = effect?.type === 'delay' ? effect.amount * 3600 : 0;
  return { message, extraSeconds };
}
