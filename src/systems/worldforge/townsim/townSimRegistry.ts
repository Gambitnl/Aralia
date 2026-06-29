/**
 * @file townSimRegistry.ts — Plan C1: the multi-town persistence + cadence core.
 *
 * A registry holds one TownSimState per tracked burg. `advanceRegistry` brings
 * every tracked town up to the current game day. Each day is rolled with an RNG
 * re-seeded per (worldSeed, burgId, day), so a town's history is INDEPENDENT of
 * how the player's time advances are chunked (advancing 100 days in one call ==
 * two 50-day calls). That chunking-independence is what makes the daily-loop
 * wiring (Plan C2) deterministic regardless of ADVANCE_TIME granularity.
 *
 * Path-dependence (SPEC D6) enters via WHICH towns are in the registry and each
 * town's lastSimDay — both set by when the player first encountered the town.
 *
 * Pure: returns new registries, never mutates inputs.
 */
import { SeededRandom } from '../../../utils/random/seededRandom';
import { makeSeedPath, seedFromPath } from '../seedPath';
import { rollTownDay } from './townSim';
import type { TownSimState } from './types';

/** Tracked towns keyed by burgId. */
export type TownSimRegistry = Record<number, TownSimState>;

/** Deterministic RNG for one town's one day. */
export function seedForTownDay(worldSeed: number, burgId: number, day: number): SeededRandom {
  return new SeededRandom(
    seedFromPath(makeSeedPath(worldSeed, `burg:${burgId}`, `day:${day}`, 's:townsim')),
  );
}

/**
 * Advance one town's sim state up to `targetDay`, rolling each intervening day
 * with its own per-(burg,day) seed. No-op if already at/after targetDay.
 */
export function advanceTown(
  state: TownSimState,
  worldSeed: number,
  targetDay: number,
): TownSimState {
  let s = state;
  for (let day = s.lastSimDay + 1; day <= targetDay; day++) {
    s = rollTownDay(s, day, seedForTownDay(worldSeed, s.burgId, day));
  }
  return s;
}

/** Advance every tracked town in the registry up to `targetDay`. */
export function advanceRegistry(
  registry: TownSimRegistry,
  worldSeed: number,
  targetDay: number,
): TownSimRegistry {
  const next: TownSimRegistry = {};
  for (const key of Object.keys(registry)) {
    const burgId = Number(key);
    next[burgId] = advanceTown(registry[burgId], worldSeed, targetDay);
  }
  return next;
}

/**
 * Ensure a burg is tracked. If absent, lazily initialise it via `init()`; if
 * already present, returns the registry unchanged. Returns a new registry when
 * a town is added (pure).
 */
export function ensureTown(
  registry: TownSimRegistry,
  burgId: number,
  init: () => TownSimState,
): TownSimRegistry {
  if (registry[burgId]) return registry;
  return { ...registry, [burgId]: init() };
}
