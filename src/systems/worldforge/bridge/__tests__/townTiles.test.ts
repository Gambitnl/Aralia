/**
 * @file townTiles.test.ts
 * Verifies the inverse bridge lookup that tells ground mode which legacy
 * world-grid tiles can open directly onto a Worldforge town.
 *
 * The production bridge still owns the expensive FMG world, region, and local
 * caches. These tests therefore call the real bridge API and then spot-check a
 * small capped set through makeGroundWorld so the inverse stays tied to the
 * same forward path players use without turning the suite into a full atlas
 * scan.
 */
import { describe, expect, it } from 'vitest';
import {
  getBridgeAtlas,
  getTownTilesForGrid,
  getWorldforgeLocalForLocation,
  townHalfExtentFt,
} from '../legacySubmapBridge';
import { makeGroundWorld } from '../groundChunkLoader';
import { generateRegion } from '../../region/generateRegion';
import { rootSeedPath } from '../../seedPath';
import { FEET_PER_FMG_PIXEL } from '../../adapter/atlasArtifact';

// ============================================================================
// Probe Ground Truth
// ============================================================================
// These assertions preserve the manual captures from the orchestration brief:
// seed 42 has visible towns at these legacy grid coordinates even though the
// earlier operator probe used two different grid sizes.
// ============================================================================

describe('getTownTilesForGrid', () => {
  it('finds the known seed 42 town-bearing tiles on both probe grids', () => {
    const thirtyByTwenty = getTownTilesForGrid(42, 30, 20);
    const twentyFiveBySixteen = getTownTilesForGrid(42, 25, 16);

    // Tile identity matters more than a specific burg id here because the
    // bridge may report one entry per burg if a future larger town overlaps
    // the same local window.
    expect(thirtyByTwenty).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ x: 17, y: 6 }),
        expect.objectContaining({ x: 19, y: 7 }),
        expect.objectContaining({ x: 20, y: 7 }),
      ]),
    );
    expect(twentyFiveBySixteen).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ x: 16, y: 4 }),
      ]),
    );
  }, 60_000); // first test pays the full atlas build; use the generation lane's bound

  it('only reports tiles that the forward bridge opens with town content', () => {
    const townTiles = getTownTilesForGrid(42, 30, 20);

    // Forward verification creates regions, locals, town plans, interiors, and
    // rosters. Six tiles are enough to prove the inverse uses the live bridge
    // path while keeping the test below the brief's runtime budget.
    for (const tile of townTiles.slice(0, 6)) {
      const { local, region } = getWorldforgeLocalForLocation(
        42,
        tile.x,
        tile.y,
        30,
        20,
      );
      const ground = makeGroundWorld(local, 42, region);

      expect(ground.towns.length).toBeGreaterThan(0);
    }
  // 180 s (GG-552, 2026-11-01): the town-look rules (Remy's ruling q2) give
  // towns 2 to 3 times more buildings. Six ground builds took 58.5 s alone and
  // 95 s beside other suites, over the old 60 s bound.
  }, 180_000);

  it('returns deterministic results for repeat calls', () => {
    const first = getTownTilesForGrid(42, 30, 20);
    const second = getTownTilesForGrid(42, 30, 20);

    expect(second).toEqual(first);
  });

  it('matches the region town envelope half-extent for burg 13 and a large burg in seed 903674813 (GG-523)', () => {
    const worldSeed = 903674813;
    const atlas = getBridgeAtlas(worldSeed);
    const burgs = atlas.pack.burgs ?? [];

    // Burg 13 is a small hamlet whose population sits at the minimum town span
    // floor (1,200 ft span / 2 + 200 ft apron = 800 ft half-extent, not 400 ft).
    const burg13 = burgs[13];
    expect(burg13).toBeDefined();
    expect(burg13?.i).toBe(13);

    // Pick the largest live burg in seed 903674813 to verify the upper scaling
    // regime above the minimum floor as well.
    const largeBurg = burgs
      .filter((b): b is NonNullable<typeof b> => Boolean(b?.i && !b.removed))
      .reduce((max, b) => ((b.population ?? 0) > (max.population ?? 0) ? b : max));
    expect(largeBurg.i).not.toBe(13);
    expect(largeBurg.population ?? 0).toBeGreaterThan(10);

    for (const burg of [burg13!, largeBurg]) {
      const region = generateRegion(atlas, burg.cell, rootSeedPath(worldSeed), {
        feetPerPixel: FEET_PER_FMG_PIXEL,
        resolutionFt: 100,
        world: atlas,
        windowCenterPx: [burg.x, burg.y],
      });
      const site = region.townSites.find((s) => s.burgId === burg.i);
      expect(site).toBeDefined();

      const halfExtent = townHalfExtentFt(burg);
      expect(halfExtent).toBe(site!.envelope.width / 2);
      expect(halfExtent).toBe(site!.envelope.height / 2);
    }

    expect(townHalfExtentFt(burg13!)).toBeGreaterThanOrEqual(800);
    expect(townHalfExtentFt(largeBurg)).toBeGreaterThan(townHalfExtentFt(burg13!));
  }, 60_000);
});
