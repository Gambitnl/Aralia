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
import type { RoutePlan } from './routePlanning';

/** Per-cell base encounter chance at danger = 1.0 (tuning knob). */
const PER_CELL_AT_MAX_DANGER = 0.06;
const MAX_TRIP_CHANCE = 0.95;

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
