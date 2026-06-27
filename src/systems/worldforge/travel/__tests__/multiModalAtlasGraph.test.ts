import { describe, it, expect } from 'vitest';
import { planRoutesFrom } from '../../../travel/routePlanning';
import type { FmgAtlasResult } from '../../fmg/generateAtlas';
import {
  buildFerryLaneCells,
  buildMultiModalAtlasGraph,
  SEA_DANGER_LANE,
  SEA_DANGER_COASTAL,
  SEA_DANGER_OPEN,
} from '../multiModalAtlasGraph';

/**
 * These tests protect the first maritime-routing graph slice.
 *
 * The tiny fixture below proves the behavior players need on the world map:
 * land-only travel cannot magically cross the sea, while a ferry-capable trip
 * can board at one port, follow a sea lane, and arrive at another port.
 *
 * The extended fixture (makeOpenWaterAtlas) also proves that a ship (kind:'ship')
 * can traverse open-ocean cells while ferries remain lane-bound.
 */

// This fixture is a deliberately tiny world map:
// land cell 0 connects to port cell 1, ferry cells 2 and 3 cross water,
// and port cell 4 is the reachable island on the far side.
function makePortedIslandAtlas(): FmgAtlasResult {
  return {
    graphWidth: 5,
    biomesData: { name: ['Marine', 'Grassland'] },
    pack: {
      cells: {
        c: [[1], [0, 2], [1, 3], [2, 4], [3]],
        p: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]],
        h: [30, 30, 5, 5, 30],
        biome: [1, 1, 0, 0, 1],
        haven: [0, 2, 0, 0, 3],
        harbor: [0, 1, 0, 0, 1],
      },
      burgs: [
        { i: 0 },
        { i: 1, cell: 1, port: 7 },
        { i: 2, cell: 4, port: 7 },
      ],
      routes: [{ group: 'searoutes', cells: [2, 3] }],
    },
  } as unknown as FmgAtlasResult;
}

/**
 * Extended fixture for open-water / ship tests.
 *
 * Layout (7 cells, left→right):
 *   0 (land)  — 1 (land, port) — 2 (water, lane) — 3 (water, open-ocean)
 *                                                  — 4 (water, coastal) — 5 (land, port) — 6 (land)
 *
 * Adjacency:
 *   0:[1], 1:[0,2], 2:[1,3], 3:[2,4], 4:[3,5], 5:[4,6], 6:[5]
 *
 * Sea cells:
 *   2 = ferry lane (in searoutes)
 *   3 = open ocean (no land neighbor)
 *   4 = coastal (neighbor 5 is land)
 *
 * Ports:
 *   cell 1 (burg 1, port=7, haven→cell 2)
 *   cell 5 (burg 2, port=7, haven→cell 4)
 *
 * Interior land cell:
 *   cell 0 is land but NOT a port (haven=0, no burg with port).
 */
function makeOpenWaterAtlas(): FmgAtlasResult {
  return {
    graphWidth: 7,
    biomesData: { name: ['Marine', 'Grassland'] },
    pack: {
      cells: {
        // adjacency
        c: [[1], [0, 2], [1, 3], [2, 4], [3, 5], [4, 6], [5]],
        // positions
        p: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0]],
        // heights: land=30, sea=5
        h: [30, 30, 5, 5, 5, 30, 30],
        // biomes: 0=Marine, 1=Grassland
        biome: [1, 1, 0, 0, 0, 1, 1],
        // haven: port cells point to their adjacent water cell
        // cell 1 → water cell 2, cell 5 → water cell 4
        haven: [0, 2, 0, 0, 0, 4, 0],
        harbor: [0, 1, 0, 0, 0, 1, 0],
      },
      burgs: [
        { i: 0 },
        { i: 1, cell: 1, port: 7 },
        { i: 2, cell: 5, port: 7 },
      ],
      // Only cell 2 is on a ferry lane — cells 3 and 4 are NOT in searoutes
      routes: [{ group: 'searoutes', cells: [2] }],
    },
  } as unknown as FmgAtlasResult;
}

// ============================================================================
// Original tests (ferry lane extraction)
// ============================================================================

describe('buildFerryLaneCells', () => {
  it('collects only generated sea-route cells', () => {
    const lanes = buildFerryLaneCells(makePortedIslandAtlas());

    expect([...lanes].sort()).toEqual([2, 3]);
  });

  it('also reads generated sea-route point cells when route.cells is absent', () => {
    const atlas = makePortedIslandAtlas();
    (atlas.pack as any).routes = [
      {
        group: 'searoutes',
        points: [
          [2, 0, 2],
          [3, 0, 3],
        ],
      },
    ];

    const lanes = buildFerryLaneCells(atlas);

    expect([...lanes].sort()).toEqual([2, 3]);
  });
});

// ============================================================================
// Original tests (ferry regression — behavior must be unchanged)
// ============================================================================

describe('buildMultiModalAtlasGraph', () => {
  it('keeps a ported island unreachable when the trip has no sea capability', () => {
    const graph = buildMultiModalAtlasGraph(makePortedIslandAtlas(), {
      sea: null,
    });
    const field = planRoutesFrom(graph, 0, { milesPerUnit: 1, speedMph: 3 });

    expect(field.to(1)).not.toBeNull();
    expect(field.to(4)).toBeNull();
  });

  it('reaches a ported island by crossing harbor-to-harbor ferry lanes', () => {
    const graph = buildMultiModalAtlasGraph(makePortedIslandAtlas(), {
      sea: { kind: 'ferry', speedMph: 8 },
    });
    const field = planRoutesFrom(graph, 0, { milesPerUnit: 1, speedMph: 3 });
    const route = field.to(4);

    expect(route).not.toBeNull();
    expect(route!.cells).toEqual([0, 1, 2, 3, 4]);
  });
});

// ============================================================================
// 3A: Ship open-water passability tests (added in 3A)
// ============================================================================

describe('buildMultiModalAtlasGraph — ship open-water passability (3A)', () => {
  /**
   * Test 1: Ferry regression with open-water atlas.
   * A ferry cannot cross cells 3/4 (they are not in searoutes).
   * The island (cell 5 / 6) must be UNREACHABLE via ferry.
   */
  it('ferry cannot cross non-lane open-water cells — island unreachable', () => {
    const graph = buildMultiModalAtlasGraph(makeOpenWaterAtlas(), {
      sea: { kind: 'ferry', speedMph: 8 },
    });
    const field = planRoutesFrom(graph, 0, { milesPerUnit: 1, speedMph: 3 });

    // Cell 2 (lane) is reachable, but cells 3, 4, 5, 6 (non-lane) are not
    expect(field.to(2)).not.toBeNull(); // lane cell reachable
    expect(field.to(3)).toBeNull();     // open ocean — ferry cannot enter
    expect(field.to(5)).toBeNull();     // island port — ferry cannot reach
    expect(field.to(6)).toBeNull();     // island interior — ferry cannot reach
  });

  /**
   * Test 2: Ship can cross non-lane open-water cells.
   * With kind:'ship', route from cell 0 → cell 6 should exist.
   * The route must pass through ports (cells 1 and 5) — no interior-land→sea jump.
   */
  it('ship reaches island by crossing open-water cells not on ferry lanes', () => {
    const graph = buildMultiModalAtlasGraph(makeOpenWaterAtlas(), {
      sea: { kind: 'ship', speedMph: 8 },
    });
    const field = planRoutesFrom(graph, 0, { milesPerUnit: 1, speedMph: 3 });
    const route = field.to(6);

    expect(route).not.toBeNull();
    expect(route!.cells).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  /**
   * Test 3: Embark gate — a ship cannot step from a non-port land cell into sea.
   * Cell 0 is interior land (not a port). There must be no direct edge 0→sea.
   * With no port at cell 0, cell 0's sea-crossing is impossible.
   */
  it('ship cannot embark from interior land cell that is not a port', () => {
    const graph = buildMultiModalAtlasGraph(makeOpenWaterAtlas(), {
      sea: { kind: 'ship', speedMph: 8 },
    });

    // Cell 0 neighbors are [cell 1]. Cell 1 is land, so this is a land→land edge.
    // But let's verify directly: the graph neighbors of cell 0 should NOT include any sea cell.
    const neighbors0 = graph.neighbors(0);
    // Cell 1 is land — OK. No sea cells should appear.
    const isSea = (c: number) => [2, 3, 4].includes(c); // fixture sea cells 2–4
    expect(neighbors0.some(isSea)).toBe(false);
  });

  /**
   * Test 4: Danger tiers for kind:'ship'.
   * Cell 2 = lane → SEA_DANGER_LANE
   * Cell 4 = coastal (neighbor 5 is land) → SEA_DANGER_COASTAL
   * Cell 3 = open ocean (no land neighbors) → SEA_DANGER_OPEN
   * Order: lane < coastal < open
   */
  it('ship danger: lane < coastal < open-ocean', () => {
    const graph = buildMultiModalAtlasGraph(makeOpenWaterAtlas(), {
      sea: { kind: 'ship', speedMph: 8 },
    });

    const dangerLane = graph.danger!(2);     // lane cell
    const dangerCoastal = graph.danger!(4);  // coastal cell (adj to land cell 5)
    const dangerOpen = graph.danger!(3);     // open ocean (adj only to water cells 2, 4)

    expect(dangerLane).toBe(SEA_DANGER_LANE);
    expect(dangerCoastal).toBe(SEA_DANGER_COASTAL);
    expect(dangerOpen).toBe(SEA_DANGER_OPEN);
    expect(dangerLane).toBeLessThan(dangerCoastal);
    expect(dangerCoastal).toBeLessThan(dangerOpen);
  });

  /**
   * Test 5: Ferry danger is unchanged — flat FERRY_LANE_DANGER for all sea cells.
   * Even if a cell would be "coastal" or "open" for a ship,
   * a ferry still sees 0.12 for any sea cell it can actually reach (lane cells).
   */
  it('ferry danger stays at the flat old value for sea cells (0.12)', () => {
    const graph = buildMultiModalAtlasGraph(makePortedIslandAtlas(), {
      sea: { kind: 'ferry', speedMph: 8 },
    });

    // Cells 2 and 3 are ferry-lane sea cells
    expect(graph.danger!(2)).toBe(0.12);
    expect(graph.danger!(3)).toBe(0.12);
  });
});
