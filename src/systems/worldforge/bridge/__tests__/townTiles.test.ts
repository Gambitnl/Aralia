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
  getTownTilesForGrid,
  getWorldforgeLocalForLocation,
} from '../legacySubmapBridge';
import { makeGroundWorld } from '../groundChunkLoader';

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
  }, 30_000); // first test pays the full atlas build; 5s default flakes under parallel load

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
  });

  it('returns deterministic results for repeat calls', () => {
    const first = getTownTilesForGrid(42, 30, 20);
    const second = getTownTilesForGrid(42, 30, 20);

    expect(second).toEqual(first);
  });
});
