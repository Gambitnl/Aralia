/**
 * @file terrainSim.ts — the system that advances ground scars through time.
 *
 * CONTEXT.md, "Terrain sim": it owns one local window, it holds the last day it
 * simulated, and it catches up when the player loads that window. It mirrors
 * the town sim, which solved the same problem for town life — see
 * `../townsim/townSimRegistry.ts` for the pattern this file follows
 * (registry of per-place states, `lastSimDay`, catch-up on load, pure
 * functions that return new state rather than mutating).
 *
 * Two differences from the town sim, both deliberate:
 *
 *  1. No RNG. A town's day is a roll; a scar's day is arithmetic. Healing is
 *     linear in days, which makes it CHUNKING-INDEPENDENT for free: advancing
 *     100 days in one call lands on exactly the same state as two 50-day
 *     calls, with no per-day reseeding needed. Tests assert this, because a
 *     scar that healed differently depending on how the player spent time
 *     would be a save-visible bug.
 *
 *  2. Records leave something behind. A town's dead villager is pruned; a
 *     healed scar becomes a ScarMark, which does not expire.
 */
import { markFromHealedScar, createGroundScar, createScarMark } from './groundScar';
import type { CreateGroundScarInput, CreateScarMarkInput } from './groundScar';
import type {
  GroundScar,
  ScarMark,
  TerrainSimRegistry,
  TerrainSimState,
} from './types';

/** A fresh, empty terrain sim state for one local window. */
export function createTerrainSimState(windowId: string, day: number): TerrainSimState {
  return { windowId, lastSimDay: day, scars: [], marks: [], nextId: 1 };
}

/** Next id for a scar or mark in this window, and the state that owns it. */
function takeId(state: TerrainSimState): { id: string; nextId: number } {
  return { id: `${state.windowId}:${state.nextId}`, nextId: state.nextId + 1 };
}

/**
 * Add a ground scar to a window. The sim assigns the id, so callers pass
 * everything except `id`.
 *
 * Returns the new state AND the created scar, because the common caller (a
 * spell landing) wants to log or highlight the exact record it just made.
 */
export function addGroundScar(
  state: TerrainSimState,
  input: Omit<CreateGroundScarInput, 'id'>,
): { state: TerrainSimState; scar: GroundScar } {
  const { id, nextId } = takeId(state);
  const scar = createGroundScar({ ...input, id });
  return { state: { ...state, scars: [...state.scars, scar], nextId }, scar };
}

/**
 * Add a scar mark directly, without a scar ever existing. This is the path a
 * SURFACE TREATMENT takes: a scorch changes the top of the ground only, so it
 * has no depth to heal and goes straight into the mark list.
 */
export function addScarMark(
  state: TerrainSimState,
  input: Omit<CreateScarMarkInput, 'id'>,
): { state: TerrainSimState; mark: ScarMark } {
  const { id, nextId } = takeId(state);
  const mark = createScarMark({ ...input, id });
  return { state: { ...state, marks: [...state.marks, mark], nextId }, mark };
}

/** The gameDay a scar reaches zero depth, given its state as of `fromDay`. */
export function healedDayFor(scar: GroundScar, fromDay: number): number {
  const remaining = Math.abs(scar.depthM);
  if (remaining === 0) return fromDay;
  if (scar.healMetersPerDay <= 0) return Number.POSITIVE_INFINITY; // never heals
  return fromDay + remaining / scar.healMetersPerDay;
}

/**
 * Bring one local window up to `toDay`.
 *
 * Scars lose `healMetersPerDay` metres of depth per day and heal toward the
 * height the generator produced. A scar that reaches zero depth is REMOVED and
 * its mark is appended, dated the day it actually finished — not the day the
 * player happened to reload — so a window loaded a year late still records the
 * right history.
 *
 * Marks gain weathering and are never removed here.
 *
 * Going backwards is a no-op: the sim only ever catches up.
 */
export function advanceTerrainSim(state: TerrainSimState, toDay: number): TerrainSimState {
  const days = toDay - state.lastSimDay;
  if (days <= 0) return state;

  const scars: GroundScar[] = [];
  const newMarks: ScarMark[] = [];

  for (const scar of state.scars) {
    const healedDay = healedDayFor(scar, state.lastSimDay);
    if (healedDay <= toDay) {
      // The scar record ends and its mark begins. The mark then weathers for
      // whatever is left of the window we are advancing across, so a long
      // catch-up does not hand back a suspiciously fresh mark.
      const mark = markFromHealedScar(scar, Math.ceil(healedDay));
      const weatheredDays = Math.max(0, toDay - mark.bornDay);
      newMarks.push({
        ...mark,
        weathering: Math.min(1, mark.weatheringPerDay * weatheredDays),
      });
      continue;
    }
    const drop = scar.healMetersPerDay * days;
    // `depthM` may be negative (a mound). Heal moves it toward zero either way.
    const depthM = scar.depthM > 0 ? scar.depthM - drop : scar.depthM + drop;
    scars.push({ ...scar, depthM });
  }

  const marks: ScarMark[] = state.marks.map((mark) => {
    const weathering = Math.min(1, mark.weathering + mark.weatheringPerDay * days);
    return weathering === mark.weathering ? mark : { ...mark, weathering };
  });

  return { ...state, lastSimDay: toDay, scars, marks: [...marks, ...newMarks] };
}

/** Bring every tracked local window up to `toDay`. */
export function advanceTerrainRegistry(
  registry: TerrainSimRegistry,
  toDay: number,
): TerrainSimRegistry {
  let changed = false;
  const next: TerrainSimRegistry = {};
  for (const [windowId, state] of Object.entries(registry)) {
    const advanced = advanceTerrainSim(state, toDay);
    if (advanced !== state) changed = true;
    next[windowId] = advanced;
  }
  return changed ? next : registry;
}

/**
 * Save-size safety valve, NOT an expiry. A mark does not expire, but a window
 * the player fights in for two hundred sessions cannot carry an unbounded mark
 * list into every save. When a window exceeds `maxMarks`, the most weathered
 * marks — the ones a viewer can barely see — are dropped first.
 *
 * This is opt-in. The sim never calls it on its own, so no caller loses history
 * without asking for it.
 */
export function pruneScarMarks(state: TerrainSimState, maxMarks: number): TerrainSimState {
  if (state.marks.length <= maxMarks) return state;
  const kept = [...state.marks]
    .sort((a, b) => a.weathering - b.weathering || b.bornDay - a.bornDay)
    .slice(0, maxMarks);
  return { ...state, marks: kept };
}
