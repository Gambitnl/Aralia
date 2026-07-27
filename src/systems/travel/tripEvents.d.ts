import type { AbilityScores } from '../../types';
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
    skills?: ReadonlyArray<{
        id: string;
    }> | null;
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
export declare function governingTripBiome(routeCells: number[], biomeIdOf: (cell: number) => string | undefined): string;
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
export declare function bestPartyCheckTotal(party: ReadonlyArray<TripEventPartyMember>, skill: string, rng: SeededRandom): number;
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
export declare function rollTripEvent(routeCells: number[], biomeIdOf: (cell: number) => string | undefined, partyCheckTotal: (skill: string) => number, rng: SeededRandom): TripEventOutcome | undefined;
