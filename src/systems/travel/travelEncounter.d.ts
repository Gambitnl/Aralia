/**
 * @file travelEncounter.ts — deterministic "danger on the road" roll for a trip.
 *
 * When the player confirms travel along a planned route, decide whether an
 * encounter happens (and roughly where). Probability compounds per cell from the
 * route's danger, so longer / more dangerous routes are likelier to be ambushed,
 * while short safe hops usually pass. Deterministic from a seed key so the same
 * trip resolves the same way (no save-scumming by re-hovering).
 *
 * Pure: no React/DOM. The caller maps `atCellIndex` back to a world tile and
 * hands off to the existing encounter system.
 */
import { type SeedPath } from '../worldforge/seedPath';
import { type SeaEncounterOutcome } from '../naval/seaEncounter';
import type { RoutePlan } from './routePlanning';
/**
 * Per-sea-step base encounter chance at sea-danger = 1.0 (tuning knob). Mirrors
 * the land PER_CELL_AT_MAX_DANGER framing but a touch higher: an open-water haul
 * should feel meaningfully riskier per leg than a road. TUNABLE — flagged for
 * design review.
 */
export declare const PER_SEA_STEP_AT_MAX_DANGER = 0.08;
export interface EncounterRoll {
    encounter: boolean;
    /** Total trip encounter probability in [0,1] (for display / debugging). */
    chance: number;
    /** Index into route.cells where the encounter occurs, or null. */
    atCellIndex: number | null;
}
/**
 * Roll a single encounter for the whole trip. `chance` = 1 − (1 − danger·k)^steps,
 * i.e. independent per-step exposure compounded over the route. A seeded RNG off
 * `seedPath` (+ the route signature) keeps it deterministic per trip.
 */
export declare function rollTravelEncounter(route: RoutePlan, seedPath: SeedPath): EncounterRoll;
/** An EncounterRoll for a sea leg, carrying the chosen sea-table outcome. */
export interface SeaTripEncounterRoll extends EncounterRoll {
    /** The chosen sea-encounter outcome when `encounter` is true, else null. */
    outcome: SeaEncounterOutcome | null;
}
/**
 * Sea counterpart of `rollTravelEncounter` for a COMMITTED multi-modal trip
 * (travel G16). Where the land roll compounds danger over every cell, this
 * compounds ONLY over the trip's sea steps (edges entering a sea cell) and scales
 * by the route's sea danger tier (lane/coastal/open), so a hired-ferry crossing
 * is its own gameplay and not a reskinned road ambush. On a hit it draws from the
 * shared SEA_ENCOUNTER_TABLE (pirates / sea beast / drifting wreck / merchant /
 * squall) — the same vocabulary the day-by-day owned-ship voyage uses — so both
 * maritime paths speak one language. A hostile outcome carries combat foes for
 * the existing announce/handoff path; peaceful ones are flavor only (naval combat
 * internals are Naval G3, not wired here).
 *
 * Land steps contribute nothing here (they stay on the land encounter path), so
 * an all-land route — no sea cell in `isSeaCell` — always returns no encounter,
 * leaving land-only trips unaffected. Deterministic from `seedPath` + the route
 * signature, matching the land roll's no-save-scum discipline.
 */
export declare function rollSeaEncounter(route: RoutePlan, isSeaCell: (cell: number) => boolean, seaDanger: number, seedPath: SeedPath): SeaTripEncounterRoll;
