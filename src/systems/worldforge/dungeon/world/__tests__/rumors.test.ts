/**
 * @file rumors.test.ts — Pillar 2, Task 7.
 *
 * Real cached bridge atlas for a fixed seed (same pattern as dungeonSites/
 * deriveIdentity tests). We DISCOVER real burg/site pairs from the world rather
 * than hardcoding ids (culture names + marker placement vary per process):
 *  - a burg AT a site (dist 0) must hear that dungeon's loudest hook;
 *  - a burg far beyond MAX_HOOK_RADIUS_FT from every site hears nothing;
 *  - the same query is deterministic;
 *  - one call generates ONLY the shortlisted sites' plans, never the whole world;
 *  - every rumor's speakerBias is a legal value.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { getBridgeAtlas } from '../../../bridge/legacySubmapBridge';
import { FEET_PER_FMG_PIXEL } from '../../../adapter/atlasArtifact';
import { enumerateDungeonSites, type DungeonSite } from '../dungeonSites';
import { generateDungeonForSite } from '../deriveIdentity';
import {
  rumorsForBurg,
  MAX_HOOK_RADIUS_FT,
  planCacheSize,
  clearRumorCaches,
} from '../rumors';

const SEED = 7;
const atlas = getBridgeAtlas(SEED);
const sites = enumerateDungeonSites(SEED);

interface BurgLike { i?: number; cell?: number; removed?: boolean }
const burgs = (atlas.pack.burgs ?? []) as BurgLike[];
const p = atlas.pack.cells.p as ReadonlyArray<readonly [number, number]>;

const LEGAL_BIAS = new Set(['elder', 'scholar', 'adventurer']);

/** Feet position of a burg's seat cell (matches rumors.ts / site.posFt). */
function burgPosFt(burgId: number): { x: number; y: number } {
  const b = burgs[burgId];
  const pt = p[b.cell!];
  return {
    x: Math.round(pt[0] * FEET_PER_FMG_PIXEL),
    y: Math.round(pt[1] * FEET_PER_FMG_PIXEL),
  };
}

function distFt(a: { x: number; y: number }, s: DungeonSite): number {
  const dx = a.x - s.posFt.x;
  const dy = a.y - s.posFt.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** The live burg whose seat sits exactly on a site (dist 0) — every burg-owned
 * site (temple/sewer) has one, so seed 7's 837 burgs guarantee a case. */
function findBurgAtSite(): { burgId: number; site: DungeonSite } {
  for (const s of sites) {
    if (s.burgId !== undefined) return { burgId: s.burgId, site: s };
  }
  throw new Error('test fixture: expected at least one burg-owned site in seed 7');
}

/** A live burg whose seat is beyond MAX_HOOK_RADIUS_FT from EVERY site — it can
 * hear no dungeon at all. Scans live burgs for the first that qualifies. */
function findFarBurg(): number {
  for (let i = 0; i < burgs.length; i++) {
    const b = burgs[i];
    if (!b || b.i === 0 || b.removed || typeof b.cell !== 'number') continue;
    const pos = burgPosFt(i);
    let near = false;
    for (const s of sites) {
      if (distFt(pos, s) <= MAX_HOOK_RADIUS_FT) { near = true; break; }
    }
    if (!near) return typeof b.i === 'number' ? b.i : i;
  }
  throw new Error('test fixture: expected at least one far burg in seed 7');
}

beforeEach(() => clearRumorCaches());

describe('rumorsForBurg — Pillar 2 Task 7', () => {
  it('the test world enumerates sites, at least one burg-owned', () => {
    expect(sites.length).toBeGreaterThan(0);
    expect(sites.some((s) => s.burgId !== undefined)).toBe(true);
  });

  it('MAX_HOOK_RADIUS_FT bounds every real hook (kept in sync with lore.ts)', () => {
    // Generate a handful of plans and confirm no hook exceeds the pre-filter
    // radius — if lore.ts widens the loudest hook, this fails loudly.
    for (const s of sites.slice(0, 8)) {
      const plan = generateDungeonForSite(SEED, s);
      for (const h of plan.rumorHooks) {
        expect(h.radiusFt).toBeLessThanOrEqual(MAX_HOOK_RADIUS_FT);
      }
    }
  });

  it('a burg AT a site hears that dungeon (its loudest hook reaches it)', () => {
    const { burgId, site } = findBurgAtSite();
    const rumors = rumorsForBurg(SEED, burgId);
    expect(rumors.length).toBeGreaterThan(0);
    // At least one rumor is about the site the burg sits on.
    expect(rumors.some((r) => r.sitePath === site.sitePath)).toBe(true);
    // And it carries the dungeon's real derived name + a grounded eventRef.
    const own = rumors.find((r) => r.sitePath === site.sitePath)!;
    const plan = generateDungeonForSite(SEED, site);
    expect(own.dungeonName).toBe(plan.name);
    expect(plan.rumorHooks.some((h) => h.eventRef === own.eventRef)).toBe(true);
  });

  it('a far burg (beyond max earshot of every site) hears nothing', () => {
    const far = findFarBurg();
    expect(rumorsForBurg(SEED, far)).toEqual([]);
  });

  it('is deterministic: same burg ⇒ identical rumor list', () => {
    const { burgId } = findBurgAtSite();
    clearRumorCaches();
    const a = rumorsForBurg(SEED, burgId);
    clearRumorCaches();
    const b = rumorsForBurg(SEED, burgId);
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });

  it('every rumor carries a legal speakerBias', () => {
    const { burgId } = findBurgAtSite();
    for (const r of rumorsForBurg(SEED, burgId)) {
      expect(LEGAL_BIAS.has(r.speakerBias)).toBe(true);
    }
  });

  it('is stably ordered by (sitePath, eventRef)', () => {
    const { burgId } = findBurgAtSite();
    const rumors = rumorsForBurg(SEED, burgId);
    const sorted = [...rumors].sort(
      (x, y) =>
        (x.sitePath < y.sitePath ? -1 : x.sitePath > y.sitePath ? 1 : 0) ||
        x.eventRef - y.eventRef,
    );
    expect(rumors).toEqual(sorted);
  });

  it('does NOT generate the whole world: only shortlisted sites get plans', () => {
    clearRumorCaches();
    const { burgId } = findBurgAtSite();
    const burgPos = burgPosFt(burgId);
    // How many sites are within the loudest-possible earshot (the shortlist)?
    const shortlisted = sites.filter((s) => distFt(burgPos, s) <= MAX_HOOK_RADIUS_FT).length;

    rumorsForBurg(SEED, burgId);

    // Exactly the shortlisted sites were generated — never all `sites.length`.
    expect(planCacheSize()).toBe(shortlisted);
    expect(planCacheSize()).toBeLessThan(sites.length);
  });

  it('throws on phantom burg 0 (no-fallback)', () => {
    expect(() => rumorsForBurg(SEED, 0)).toThrow();
  });

  it('throws on an unknown burg id (no-fallback)', () => {
    expect(() => rumorsForBurg(SEED, burgs.length + 1000)).toThrow();
  });

  // ── Pillar 2, Task 8: cleared sites flip their rumors ─────────────────────
  it('clearing a site swaps its hooks to the cleared (past-tense) text', () => {
    const { burgId, site } = findBurgAtSite();
    clearRumorCaches();
    const uncleared = rumorsForBurg(SEED, burgId);
    const ownUncleared = uncleared.filter((r) => r.sitePath === site.sitePath);
    expect(ownUncleared.length).toBeGreaterThan(0);

    clearRumorCaches();
    const cleared = rumorsForBurg(SEED, burgId, new Set([site.sitePath]));
    const ownCleared = cleared.filter((r) => r.sitePath === site.sitePath);
    expect(ownCleared.length).toBe(ownUncleared.length);

    // Same hooks (by eventRef), but the text changed to the plan's clearedText.
    const plan = generateDungeonForSite(SEED, site);
    for (const r of ownCleared) {
      const hook = plan.rumorHooks.find((h) => h.eventRef === r.eventRef)!;
      expect(r.text).toBe(hook.clearedText);
      expect(hook.clearedText).not.toBe(hook.text);
    }
    // A DIFFERENT site the burg hears is unchanged by clearing this one.
    for (const r of cleared) {
      if (r.sitePath === site.sitePath) continue;
      const twin = uncleared.find((u) => u.sitePath === r.sitePath && u.eventRef === r.eventRef);
      if (twin) expect(r.text).toBe(twin.text);
    }
  });

  it('cleared-rumor swap is deterministic', () => {
    const { burgId, site } = findBurgAtSite();
    clearRumorCaches();
    const a = rumorsForBurg(SEED, burgId, [site.sitePath]);
    clearRumorCaches();
    const b = rumorsForBurg(SEED, burgId, [site.sitePath]);
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });
});
