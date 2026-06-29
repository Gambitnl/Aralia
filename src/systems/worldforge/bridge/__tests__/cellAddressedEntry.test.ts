import { describe, it, expect } from 'vitest';
import { getBridgeAtlas, getWorldforgeLocalForCell } from '../legacySubmapBridge';
import { makeGroundWorld } from '../groundChunkLoader';
import { listSelectableTowns } from '../../local/startTowns';
import { findCellAtPoint } from '../../../../components/Worldforge/atlasSvg';

/**
 * Stage 1 (cell-native world): the foundation behavior. Entering a town centers
 * its Locale window on the BURG'S world position (not the cell site) so the
 * burg's town renders — closing the start-selection 0/219 spawn bug.
 *
 * Why the position, not just the cell id: cells are ~30k ft across but the
 * Locale window is REGION_SIZE_FT (25k ft), so a site-centered window routinely
 * misses a burg that sits 15k–39k ft from its cell's Voronoi site.
 */
describe('cell-addressed Locale entry', () => {
  it("entering at a burg's world position renders that burg's town", () => {
    const seed = 42;
    const world = getBridgeAtlas(seed);
    // The lowest-population port — provably 0/219 under the grid path.
    const town = listSelectableTowns(world)
      .filter((t) => t.isPort)
      .sort((a, b) => a.population - b.population)[0];
    const burg = (world.pack.burgs as Array<{ x: number; y: number }>)[town.burgIndex];

    // The anchor cell is the one actually at the burg's position (burg.cell can
    // be stale); the window is centered on the burg.
    const cell = findCellAtPoint(world as never, burg.x, burg.y);
    const { local, region } = getWorldforgeLocalForCell(seed, cell, { centerPx: [burg.x, burg.y] });
    const ground = makeGroundWorld(local, seed, region);

    expect(ground.towns.some((t) => t.burgId === town.burgIndex)).toBe(true);
  });

  // The grid path rendered the chosen burg 0/219 times across seeds; the
  // position-centered entry must render it every time.
  it.each([42, 1, 2, 7, 100, 2024])(
    'seed %i: the lowest-pop port renders at its burg-centered Locale',
    (seed) => {
      const world = getBridgeAtlas(seed);
      const town = listSelectableTowns(world)
        .filter((t) => t.isPort)
        .sort((a, b) => a.population - b.population)[0];
      const burg = (world.pack.burgs as Array<{ x: number; y: number }>)[town.burgIndex];
      const cell = findCellAtPoint(world as never, burg.x, burg.y);
      const { local, region } = getWorldforgeLocalForCell(seed, cell, { centerPx: [burg.x, burg.y] });
      const ground = makeGroundWorld(local, seed, region);
      expect(ground.towns.some((t) => t.burgId === town.burgIndex)).toBe(true);
    },
  );
});
