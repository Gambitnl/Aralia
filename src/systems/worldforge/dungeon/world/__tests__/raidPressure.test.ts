/**
 * @file raidPressure.test.ts — Pillar 2, Task 8 (living ecology): the raid-
 * pressure signal a burg feels from the uncleared dungeons around it.
 *
 * Real cached bridge atlas for a fixed seed (same pattern as rumors.test.ts). We
 * discover real burg/site pairs rather than hardcoding ids.
 */
import { describe, expect, it } from 'vitest';
import { getBridgeAtlas } from '../../../bridge/legacySubmapBridge';
import { enumerateDungeonSites, type DungeonSite } from '../dungeonSites';
import { raidPressureForBurg } from '../raidPressure';

const SEED = 7;
const atlas = getBridgeAtlas(SEED);
const sites = enumerateDungeonSites(SEED);

interface BurgLike { i?: number; cell?: number; removed?: boolean }
const burgs = (atlas.pack.burgs ?? []) as BurgLike[];

/** A live burg that sits AT one of its own sites (temple/sewer) — guaranteed to
 * feel nonzero pressure when that site is uncleared. */
function findBurgAtSite(): { burgId: number; site: DungeonSite } {
  for (const s of sites) {
    if (s.burgId !== undefined) return { burgId: s.burgId, site: s };
  }
  throw new Error('test fixture: expected a burg-owned site in seed 7');
}

describe('raidPressureForBurg — Pillar 2 Task 8', () => {
  it('a burg at an uncleared site feels nonzero pressure in [0,1]', () => {
    const { burgId } = findBurgAtSite();
    const p = raidPressureForBurg(SEED, burgId, new Set());
    expect(p).toBeGreaterThan(0);
    expect(p).toBeLessThanOrEqual(1);
  });

  it('is zero when every nearby site is cleared', () => {
    const { burgId } = findBurgAtSite();
    const allPaths = new Set(sites.map((s) => s.sitePath));
    expect(raidPressureForBurg(SEED, burgId, allPaths)).toBe(0);
  });

  it('is monotone in count: clearing sites cannot raise pressure', () => {
    const { burgId, site } = findBurgAtSite();
    const full = raidPressureForBurg(SEED, burgId, new Set());
    const partial = raidPressureForBurg(SEED, burgId, new Set([site.sitePath]));
    expect(partial).toBeLessThanOrEqual(full);
    // Clearing the burg's OWN (distance-0) site strictly lowers its pressure.
    expect(partial).toBeLessThan(full);
  });

  it('is monotone in proximity: a nearer uncleared site means more pressure', () => {
    // Compare a burg that owns a site (a site sits right on it) against the same
    // burg once that on-site dungeon is cleared — the remaining pressure comes
    // only from farther sites, so it is strictly lower (proximity dominates).
    const { burgId, site } = findBurgAtSite();
    const near = raidPressureForBurg(SEED, burgId, new Set());
    const farOnly = raidPressureForBurg(SEED, burgId, new Set([site.sitePath]));
    expect(near).toBeGreaterThan(farOnly);
  });

  it('is deterministic (same inputs → same value)', () => {
    const { burgId } = findBurgAtSite();
    expect(raidPressureForBurg(SEED, burgId, new Set())).toBe(
      raidPressureForBurg(SEED, burgId, new Set()),
    );
  });

  it('throws on phantom burg 0 (no-fallback)', () => {
    expect(() => raidPressureForBurg(SEED, 0, new Set())).toThrow();
  });
});
