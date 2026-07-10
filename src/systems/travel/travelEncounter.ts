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
import { rngFromPath, streamPath, type SeedPath } from '../worldforge/seedPath';
import { SEA_ENCOUNTER_TABLE, type SeaEncounterOutcome } from '../naval/seaEncounter';
import type { RoutePlan } from './routePlanning';

/** Per-cell base encounter chance at danger = 1.0 (tuning knob). */
const PER_CELL_AT_MAX_DANGER = 0.06;
const MAX_TRIP_CHANCE = 0.95;

/**
 * Per-sea-step base encounter chance at sea-danger = 1.0 (tuning knob). Mirrors
 * the land PER_CELL_AT_MAX_DANGER framing but a touch higher: an open-water haul
 * should feel meaningfully riskier per leg than a road. TUNABLE — flagged for
 * design review.
 */
export const PER_SEA_STEP_AT_MAX_DANGER = 0.08;

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
export function rollTravelEncounter(route: RoutePlan, seedPath: SeedPath): EncounterRoll {
  const steps = Math.max(0, route.cells.length - 1);
  const perStep = Math.max(0, Math.min(1, route.danger)) * PER_CELL_AT_MAX_DANGER;
  const chance = steps === 0 ? 0 : Math.min(MAX_TRIP_CHANCE, 1 - Math.pow(1 - perStep, steps));

  if (chance <= 0) return { encounter: false, chance: 0, atCellIndex: null };

  // Stable per-trip RNG: seed by the route's endpoints + length so re-planning the
  // same trip rolls the same outcome.
  const sig = `enc:${route.cells[0]}-${route.cells[route.cells.length - 1]}:${route.cells.length}`;
  const rng = rngFromPath(streamPath(seedPath, sig));
  const encounter = rng.next() < chance;
  if (!encounter) return { encounter: false, chance, atCellIndex: null };

  // Place it somewhere along the way (not the start cell).
  const atCellIndex = 1 + Math.floor(rng.next() * Math.max(1, route.cells.length - 1));
  return { encounter: true, chance, atCellIndex: Math.min(atCellIndex, route.cells.length - 1) };
}

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
export function rollSeaEncounter(
  route: RoutePlan,
  isSeaCell: (cell: number) => boolean,
  seaDanger: number,
  seedPath: SeedPath,
): SeaTripEncounterRoll {
  // Route indices whose entered cell is sea — the only steps that expose the trip
  // to a maritime encounter. Land steps are excluded so land-only trips (and the
  // land legs of a mixed trip) never draw from the sea table.
  const seaStepIndices: number[] = [];
  for (let i = 1; i < route.cells.length; i++) {
    if (isSeaCell(route.cells[i])) seaStepIndices.push(i);
  }
  const seaSteps = seaStepIndices.length;
  const perStep = Math.max(0, Math.min(1, seaDanger)) * PER_SEA_STEP_AT_MAX_DANGER;
  const chance = seaSteps === 0 ? 0 : Math.min(MAX_TRIP_CHANCE, 1 - Math.pow(1 - perStep, seaSteps));

  if (chance <= 0) return { encounter: false, chance: 0, atCellIndex: null, outcome: null };

  const sig = `seaenc:${route.cells[0]}-${route.cells[route.cells.length - 1]}:${route.cells.length}:${seaSteps}`;
  const rng = rngFromPath(streamPath(seedPath, sig));
  const encounter = rng.next() < chance;
  if (!encounter) return { encounter: false, chance, atCellIndex: null, outcome: null };

  // Same seeded stream picks the outcome AND its placement (a sea cell along the
  // way). nextInt is MAX-EXCLUSIVE (architecture memory): [0, length) is valid.
  const outcome = SEA_ENCOUNTER_TABLE[rng.nextInt(0, SEA_ENCOUNTER_TABLE.length)];
  const atCellIndex = seaStepIndices[rng.nextInt(0, seaSteps)];
  return { encounter: true, chance, atCellIndex, outcome };
}
