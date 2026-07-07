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
import { FEET_PER_FMG_PIXEL } from '../../adapter/atlasArtifact';
import { getBridgeAtlas } from '../../bridge/legacySubmapBridge';
import { enumerateDungeonSites, type DungeonSite } from './dungeonSites';
import { generateDungeonForSite } from './deriveIdentity';
import type { DungeonPlan, RumorHook } from '../types';

/**
 * The widest any hook can travel. Mirrors lore.ts's `radiusFt = 5280 × (2 +
 * LOUDNESS[kind])` with LOUDNESS maxed at `bloom` = 10 → 5280 × 12 = 63,360 ft
 * (12 miles). Any site whose mouth is beyond this from a burg reaches it with NO
 * hook, so it is pre-filtered out before its plan is ever generated. Kept in sync
 * with lore.ts by the test `MAX_HOOK_RADIUS_FT bounds every real hook`.
 */
export const MAX_HOOK_RADIUS_FT = 5280 * (2 + 10);

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

interface BurgLike {
  i?: number;
  cell?: number;
  removed?: boolean;
}

/** Feet position of a burg's seat cell (same convention as site.posFt). */
function burgPosFt(
  p: ReadonlyArray<readonly [number, number]>,
  cell: number,
): { x: number; y: number } {
  const pt = p[cell] ?? [0, 0];
  return {
    x: Math.round(pt[0] * FEET_PER_FMG_PIXEL),
    y: Math.round(pt[1] * FEET_PER_FMG_PIXEL),
  };
}

/**
 * Resolve a live burg's seat position in feet, or throw. Phantom burg 0 and
 * removed burgs are not real places, so a rumor query about them is a caller bug
 * (no-fallback): we throw rather than return [].
 */
function requireBurgPosFt(worldSeed: number, burgId: number): { x: number; y: number } {
  const atlas = getBridgeAtlas(worldSeed);
  const burgs = (atlas.pack.burgs ?? []) as BurgLike[];
  const b = burgs[burgId];
  if (!b || b.i === 0 || b.removed || typeof b.cell !== 'number') {
    throw new Error(
      `rumorsForBurg: burg ${burgId} in world ${worldSeed} is unknown, phantom-0, or removed.`,
    );
  }
  const p = atlas.pack.cells.p as ReadonlyArray<readonly [number, number]>;
  return burgPosFt(p, b.cell);
}

// ── Plan cache: generate each shortlisted site's plan at most once ──────────
//
// Keyed by `${seed}|${sitePath}`. Reused across every burg query in a world, so
// two neighboring burgs that both shortlist the same dungeon generate it once.
// Exposed to tests (planCacheSize / clearRumorCaches) so they can prove a call
// only generated the shortlisted sites, never the whole world.
const planCache = new Map<string, DungeonPlan>();

function planForSite(worldSeed: number, site: DungeonSite): DungeonPlan {
  const key = `${worldSeed >>> 0}|${site.sitePath}`;
  const cached = planCache.get(key);
  if (cached) return cached;
  const plan = generateDungeonForSite(worldSeed, site);
  planCache.set(key, plan);
  return plan;
}

// ── Result cache: one BurgRumor[] per (seed, burg) ──────────────────────────
const burgRumorCache = new Map<string, BurgRumor[]>();

/**
 * Squared distance in feet between a site mouth and a burg seat.
 * Compared against squared radii so no sqrt is needed on the hot path.
 */
function dist2Ft(site: DungeonSite, burg: { x: number; y: number }): number {
  const dx = site.posFt.x - burg.x;
  const dy = site.posFt.y - burg.y;
  return dx * dx + dy * dy;
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
export function rumorsForBurg(
  worldSeed: number,
  burgId: number,
  clearedSet?: Iterable<string>,
): BurgRumor[] {
  // Pillar 2, Task 8: a CLEARED site's hooks speak the past-tense `clearedText`.
  // The cleared set is part of the cache key, so a burg's rumors before and after
  // a clear are memoized separately (never cross-contaminated). The stable-sorted
  // key keeps the same set → same key regardless of iteration order.
  const cleared = clearedSet instanceof Set ? clearedSet : new Set(clearedSet ?? []);
  const clearedKey = [...cleared].sort().join(',');
  const key = `${worldSeed >>> 0}|${burgId}|${clearedKey}`;
  const cached = burgRumorCache.get(key);
  if (cached) return cached.map((r) => ({ ...r }));

  const burgPos = requireBurgPosFt(worldSeed, burgId); // throws on bad burgId
  const preR2 = MAX_HOOK_RADIUS_FT * MAX_HOOK_RADIUS_FT;

  const out: BurgRumor[] = [];
  for (const site of enumerateDungeonSites(worldSeed)) {
    // Stage 1 — plan-free distance pre-filter. Beyond the loudest possible
    // hook's reach, this site can't touch the burg; skip WITHOUT generating it.
    if (dist2Ft(site, burgPos) > preR2) continue;

    // Stage 2 — generate (once, cached) and apply each hook's exact radius.
    const plan = planForSite(worldSeed, site);
    const d2 = dist2Ft(site, burgPos);
    const isCleared = cleared.has(site.sitePath);
    for (const hook of plan.rumorHooks) {
      if (d2 > hook.radiusFt * hook.radiusFt) continue;
      out.push({
        sitePath: site.sitePath,
        dungeonName: plan.name,
        // A cleared dungeon's townsfolk speak of it in the past tense.
        text: isCleared ? hook.clearedText : hook.text,
        speakerBias: hook.speakerBias,
        eventRef: hook.eventRef,
      });
    }
  }

  // Stable order: by site path, then by the hook's event index within a dungeon.
  out.sort(
    (a, b) =>
      (a.sitePath < b.sitePath ? -1 : a.sitePath > b.sitePath ? 1 : 0) ||
      a.eventRef - b.eventRef,
  );

  burgRumorCache.set(key, out);
  return out.map((r) => ({ ...r }));
}

// ── Test-only cache introspection (kept tiny + honest) ──────────────────────

/** Number of dungeon plans generated so far (across all burg queries). Tests
 * assert this equals only the shortlisted sites after one call. */
export function planCacheSize(): number {
  return planCache.size;
}

/** Drop all memoized plans + burg results — lets a test start from a clean cache
 * to measure exactly how many plans one `rumorsForBurg` call generates. */
export function clearRumorCaches(): void {
  planCache.clear();
  burgRumorCache.clear();
}
