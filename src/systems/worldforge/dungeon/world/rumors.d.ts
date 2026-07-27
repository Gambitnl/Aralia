/**
 * @file rumors.ts — Pillar 2, Task 7: carry a dungeon's rumor hooks to the
 * townsfolk of nearby burgs, then surface them through the EXISTING town-gossip
 * rumor path.
 *
 * Every generated dungeon plan carries `rumorHooks: RumorHook[]` (lore.ts) —
 * spoken-register lines ("They say the hold fell to the Damunvilian Rebels.
 * Nobody took it back."), each with its OWN `radiusFt` (loudness-scaled: a quiet
 * seal barely leaves the dungeon, a fungal bloom is talked about 12 miles off).
 * A burg "hears" a hook when the burg sits within that hook's `radiusFt` of the
 * dungeon's mouth. `rumorsForBurg(worldSeed, burgId)` returns every hook that
 * reaches a burg, in a deterministic order, cached per (seed, burg).
 *
 * COST CONSTRAINT (the crux). Each hook's radius lives INSIDE the plan, and
 * generating a plan is expensive (~30-50 ms). So computing rumors for one burg
 * must NOT generate every dungeon plan in the world. Two-stage filter:
 *
 *   1. PRE-FILTER by distance, plan-free. The loudest possible hook has
 *      radius `MAX_HOOK_RADIUS_FT` (= 5280 × (2 + max loudness); LOUDNESS max is
 *      `bloom`=10 → 12 miles). Any site whose MOUTH is farther than that from the
 *      burg cannot possibly reach it with ANY hook, so it is dropped WITHOUT
 *      generating its plan — a cheap `site.posFt` vs burg-position compare.
 *   2. EXACT per-hook radius on the shortlist. Only the shortlisted sites get
 *      their plan generated (once, cached via `generateDungeonForSite`), and each
 *      hook is kept only if the burg is within THAT hook's own `radiusFt`.
 *
 * So a call generates at most the plans of the sites within 12 miles of the burg,
 * never the whole world. The plan cache (`planCache`) is exposed to tests so they
 * can assert only shortlisted sites were generated.
 *
 * No-fallback (Aralia directive): an unknown / phantom-0 / removed burgId throws
 * — a caller asking about a burg that isn't there is a bug, not a quiet [].
 *
 * Determinism: no draws here. Sites come in `enumerateDungeonSites` order;
 * output is sorted (sitePath, eventRef) for a stable, seed-stable list. Pure data
 * apart from the memoization caches. Zero THREE imports.
 */
import type { SeedPath } from '../../seedPath';
import type { RumorHook } from '../types';
/**
 * The widest any hook can travel. Mirrors lore.ts's `radiusFt = 5280 × (2 +
 * LOUDNESS[kind])` with LOUDNESS maxed at `bloom` = 10 → 5280 × 12 = 63,360 ft
 * (12 miles). Any site whose mouth is beyond this from a burg reaches it with NO
 * hook, so it is pre-filtered out before its plan is ever generated. Kept in sync
 * with lore.ts by the test `MAX_HOOK_RADIUS_FT bounds every real hook`.
 */
export declare const MAX_HOOK_RADIUS_FT: number;
/**
 * One dungeon rumor that has reached a burg — a hook plus the dungeon it names.
 * `sitePath` + `eventRef` uniquely identify the hook (a dungeon can emit several).
 */
export interface BurgRumor {
    /** The frozen site path of the dungeon this rumor is about. */
    sitePath: SeedPath;
    /** The dungeon's real derived name, e.g. "The Marrowick Crypt". */
    dungeonName: string;
    /** The spoken-register rumor line. */
    text: string;
    /** Which NPC archetype tends to speak this line. */
    speakerBias: RumorHook['speakerBias'];
    /** The dungeon event this rumor is grounded in (index into the plan's log). */
    eventRef: number;
}
/**
 * Every dungeon rumor that reaches a burg, deterministic + cached.
 *
 * Two-stage (see file header): a plan-free distance PRE-FILTER by
 * `MAX_HOOK_RADIUS_FT` shortlists nearby sites, then only those sites' plans are
 * generated and each hook kept iff the burg is within THAT hook's own radiusFt.
 *
 * @param worldSeed  World seed (drives site enumeration + plan generation).
 * @param burgId     A live burg id (throws on phantom-0 / removed / unknown).
 * @returns          Hooks reaching this burg, sorted (sitePath, eventRef).
 */
export declare function rumorsForBurg(worldSeed: number, burgId: number, clearedSet?: Iterable<string>): BurgRumor[];
/** Number of dungeon plans generated so far (across all burg queries). Tests
 * assert this equals only the shortlisted sites after one call. */
export declare function planCacheSize(): number;
/** Drop all memoized plans + burg results — lets a test start from a clean cache
 * to measure exactly how many plans one `rumorsForBurg` call generates. */
export declare function clearRumorCaches(): void;
