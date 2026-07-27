/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 14/07/2026, 18:51:30
 * Dependents: components/World3D/World3DWrapper.tsx, components/Worldforge/LivingWorldPreview.tsx, state/reducers/worldReducer.ts, systems/worldforge/townsim/chronicleForLocation.ts, systems/worldforge/townsim/townSimRegistration.ts
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
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
import type { TownSimState } from './types';
/** Tracked towns keyed by burgId. */
export type TownSimRegistry = Record<number, TownSimState>;
/**
 * Trim a town's persisted state to bound save growth: drop chronicle events
 * older than RETENTION_YEARS, and dead villagers who died beyond the window and
 * are no longer referenced by any LIVING villager (kin links stay intact while
 * anyone connected to the living survives). Cumulative `totals` are NOT touched,
 * so population invariants remain checkable. Pure + deterministic (no rng).
 */
export declare function pruneTownState(state: TownSimState, currentDay: number): TownSimState;
/** Deterministic RNG for one town's one day. */
export declare function seedForTownDay(worldSeed: number, burgId: number, day: number): SeededRandom;
/**
 * Advance one town's sim state up to `targetDay`, rolling each intervening day
 * with its own per-(burg,day) seed. No-op if already at/after targetDay.
 *
 * `raidPressure` (Pillar 2, Task 8, optional) is the 0..1 raid-pressure signal
 * the burg feels from uncleared dungeons; when supplied, each day's roll may
 * emit a raid-worry line. Constant across the advance window (the pressure moves
 * far slower than a day) — passed straight through to `rollTownDay`. Omitting it
 * leaves the sim byte-identical to its pre-Task-8 behavior.
 */
export declare function advanceTown(state: TownSimState, worldSeed: number, targetDay: number, raidPressure?: number): TownSimState;
/**
 * Advance tracked towns up to `targetDay`. If `onlyBurgIds` is given, ONLY those
 * burgs advance this call (distance-LOD: tick near towns daily); the rest are
 * left at their current `lastSimDay` and catch up in a later call. Because each
 * day is re-seeded per (worldSeed, burgId, day), a town caught up in one big
 * batch yields IDENTICAL state to one ticked daily — so LOD changes only WHEN
 * the work happens, never the outcome. Omit `onlyBurgIds` to advance all.
 */
export declare function advanceRegistry(registry: TownSimRegistry, worldSeed: number, targetDay: number, onlyBurgIds?: Iterable<number>, raidPressureFor?: (burgId: number) => number): TownSimRegistry;
/**
 * Ensure a burg is tracked. If absent, lazily initialise it via `init()`; if
 * already present, returns the registry unchanged. Returns a new registry when
 * a town is added (pure).
 */
export declare function ensureTown(registry: TownSimRegistry, burgId: number, init: () => TownSimState): TownSimRegistry;
