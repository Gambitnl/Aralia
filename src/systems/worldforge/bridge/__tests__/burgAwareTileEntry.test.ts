/**
 * @file burgAwareTileEntry.test.ts
 * Burg-aware grid-tile entry (2026-07-02): a legacy grid tile that visually
 * contains burgs must open onto one of them — the burg nearest the tile
 * center — with the Locale window centered on that burg (the same settlement
 * mode WF_TOWN / cell-addressed entry uses).
 *
 * Before this rule, the grid path anchored on the nearest-land cell to the
 * tile center and a burg rendered only when its own cell won that lottery
 * (~50 of ~850 burgs per world). Whole culture families — e.g. every Highland
 * burg across seeds 1234 and 2026 — had zero live towns in ground mode.
 */
import { describe, expect, it } from 'vitest';
import {
  getBridgeAtlas,
  getTownTilesForGrid,
  getWorldforgeLocalForLocation,
} from '../legacySubmapBridge';
import { makeGroundWorld } from '../groundChunkLoader';
import { listSelectableTowns } from '../../local/startTowns';
import type { Burg } from '../../fmg/burgs-generator';

// The bridge's fixed FMG canvas (legacySubmapBridge FMG_WIDTH/FMG_HEIGHT) and
// the live world-map grid. tileOf is the floor proportional projection — the
// algebraic inverse of the bridge's tile-center convention.
const COLS = 25;
const ROWS = 16;
const tileOf = (x: number, y: number) => ({
  x: Math.floor((x / 960) * COLS),
  y: Math.floor((y / 540) * ROWS),
});

describe('burg-aware grid-tile entry', () => {
  it("entering the lowest-pop port's own tile renders a burg contained in that tile", () => {
    const seed = 42;
    const world = getBridgeAtlas(seed);
    // The lowest-population port — proven to render 0/219 under the old
    // anchor-lottery grid path (see cellAddressedEntry.test.ts).
    const town = listSelectableTowns(world)
      .filter((t) => t.isPort)
      .sort((a, b) => a.population - b.population)[0];
    const burgs = world.pack.burgs as Burg[];
    const burg = burgs[town.burgIndex]!;
    const tile = tileOf(burg.x, burg.y);

    const { local, region } = getWorldforgeLocalForLocation(seed, tile.x, tile.y, COLS, ROWS);
    const ground = makeGroundWorld(local, seed, region);

    expect(ground.towns.length).toBeGreaterThan(0);
    // The rendered town must actually live in the entered tile — not be a
    // lottery neighbour that happened to sit near the snapped anchor.
    const shownTiles = ground.towns.map((t) => {
      const b = burgs[t.burgId]!;
      return tileOf(b.x, b.y);
    });
    expect(shownTiles).toContainEqual(tile);
  }, 60_000);

  it('getTownTilesForGrid lists every burg-bearing tile', () => {
    const seed = 42;
    const world = getBridgeAtlas(seed);
    const listed = new Set(
      getTownTilesForGrid(seed, COLS, ROWS).map((e) => `${e.x},${e.y}`),
    );
    const missing: string[] = [];
    for (const burg of (world.pack.burgs as Burg[]) ?? []) {
      if (!burg?.i || burg.removed) continue;
      const t = tileOf(burg.x, burg.y);
      if (!listed.has(`${t.x},${t.y}`)) missing.push(`burg ${burg.i} @ (${t.x},${t.y})`);
    }
    expect(missing).toEqual([]);
  }, 60_000);
});
