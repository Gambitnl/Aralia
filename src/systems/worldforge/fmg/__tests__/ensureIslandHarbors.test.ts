import { describe, expect, it } from 'vitest';
import {
  ensureIslandHarbors,
  type IslandHarborPack,
} from '../ensureIslandHarbors';
import type { Burg } from '../burgs-generator';

/**
 * This test file proves the maritime reachability pass on tiny hand-built maps.
 *
 * The full FMG generator has large frozen golden tests, so these fixtures keep the
 * new island-harbor behavior small and deterministic: every cell is named by id,
 * every neighbor is explicit, and the expected result can be checked without
 * running the whole world pipeline.
 */

// ============================================================================
// Fixture Builder
// ============================================================================
// The fixtures below model one mainland port, one significant island, one island
// with an existing village, and one tiny rock. Water cells connect those land
// components to the same sea feature so a generated ferry route can be added.
// ============================================================================

function makePack(): IslandHarborPack {
  const pack: IslandHarborPack = {
    cells: {
      i: [0, 1, 2, 3, 4, 5, 6],
      c: [
        [1],
        [0, 2, 3, 5, 6],
        [1],
        [1, 4],
        [3],
        [1],
        [1],
      ],
      h: [35, 5, 36, 34, 35, 5, 5],
      p: [
        [0, 0],
        [1, 0],
        [2, 0],
        [1, 1],
        [2, 1],
        [1, -1],
        [2, -1],
      ],
      haven: [1, 0, 1, 1, 0, 0, 0],
      harbor: [1, 0, 1, 1, 0, 0, 0],
      f: [1, 2, 1, 1, 1, 2, 2],
      burg: new Uint16Array(7),
      culture: new Uint16Array([1, 0, 1, 1, 1, 1, 1]),
      state: new Uint16Array([1, 0, 1, 1, 1, 1, 1]),
      pop: new Float32Array([10, 0, 4, 5, 5, 0.1, 0.1]),
      routes: {},
    },
    features: [
      0,
      { i: 1, type: 'island', land: true, cells: 6 },
      { i: 2, type: 'ocean', land: false, cells: 1 },
    ],
    burgs: [
      0,
      {
        i: 1,
        cell: 0,
        x: 0,
        y: 0,
        state: 1,
        culture: 1,
        name: 'Mainport',
        feature: 1,
        capital: 1,
        port: 2,
      },
      {
        i: 2,
        cell: 3,
        x: 1,
        y: 1,
        state: 1,
        culture: 1,
        name: 'Coaststead',
        feature: 1,
        capital: 0,
      },
    ],
    routes: [
      {
        i: 0,
        group: 'searoutes',
        feature: 2,
        points: [[2, -1, 6]],
        cells: [6],
      },
    ],
  };

  pack.cells.burg![0] = 1;
  pack.cells.burg![3] = 2;
  return pack;
}

// ============================================================================
// Reachability Behavior
// ============================================================================
// These checks match the maritime design spec: significant landmasses receive a
// port by promotion or spawning, but tiny uninhabited rocks do not get dock spam.
// ============================================================================

describe('ensureIslandHarbors', () => {
  it('promotes a coastal village on a significant island and links its water cell to searoutes', () => {
    const pack = makePack();

    const report = ensureIslandHarbors(pack, { minLandCells: 2 });

    const promoted = pack.burgs![2] as Burg;
    expect(promoted.port).toBe(2);
    expect(report.promotedBurgIds).toEqual([2]);
    expect(pack.routes!.some((route) => route.group === 'searoutes' && route.cells?.includes(1))).toBe(true);
    expect(pack.cells.routes?.[1]?.[6]).toBeTruthy();
  });

  it('spawns a minimal fishing village when a significant island has no burg', () => {
    const pack = makePack();
    pack.burgs = pack.burgs!.filter((burg) => !burg || burg.i !== 2);
    pack.cells.burg![3] = 0;

    const report = ensureIslandHarbors(pack, { minLandCells: 2 });

    expect(report.spawnedBurgIds).toEqual([2]);
    expect(pack.burgs![2]).toMatchObject({
      i: 2,
      cell: 3,
      port: 2,
      group: 'village',
      type: 'Naval',
    });
    expect(pack.cells.burg![3]).toBe(2);
  });

  // GG-520 (audit 2026-10-25): the new route used to be one straight hop to the
  // LOWEST-numbered lane cell anywhere on the sea (water cells tie on harbor and
  // population), so real routes ran 600-2,000 km across land and the ferry
  // planner, which steps only between adjacent cells, could not use them.
  it('routes a new harbor through adjacent water cells to the nearest lane', () => {
    // Island cell 0 docks at water cell 3. Lane cell 5 is two water steps away;
    // lane cell 2 has the lowest id but is four steps away.
    const pack: IslandHarborPack = {
      cells: {
        i: [0, 1, 2, 3, 4, 5, 6, 7, 8],
        c: [[3], [2], [1, 8], [0, 4, 6], [3, 5], [4], [3, 7], [6, 8], [7, 2]],
        h: [35, 35, 5, 5, 5, 5, 5, 5, 5],
        p: [[0, 0], [9, 9], [8, 8], [1, 0], [2, 0], [3, 0], [1, 1], [2, 2], [3, 3]],
        haven: [3, 2, 0, 0, 0, 0, 0, 0, 0],
        harbor: [1, 1, 0, 0, 0, 0, 0, 0, 0],
        f: [1, 3, 2, 2, 2, 2, 2, 2, 2],
        burg: new Uint16Array(9),
        culture: new Uint16Array(9),
        state: new Uint16Array(9),
        pop: new Float32Array(9),
        routes: {},
      },
      features: [
        0,
        { i: 1, type: 'island', land: true, cells: 1 },
        { i: 2, type: 'ocean', land: false, cells: 7 },
        { i: 3, type: 'island', land: true, cells: 1 },
      ],
      burgs: [
        0,
        { i: 1, cell: 1, x: 9, y: 9, state: 0, culture: 0, name: 'Mainport', feature: 3, capital: 0, port: 2 },
      ],
      routes: [
        { i: 0, group: 'searoutes', feature: 2, points: [[8, 8, 2]], cells: [2] },
        { i: 1, group: 'searoutes', feature: 2, points: [[3, 0, 5]], cells: [5] },
      ],
    };
    pack.cells.burg![1] = 1;

    const report = ensureIslandHarbors(pack, { minLandCells: 1 });

    expect(report.spawnedBurgIds).toHaveLength(1);
    const added = pack.routes![pack.routes!.length - 1];
    expect(added.cells).toEqual([3, 4, 5]);
    expect(added.points.map((point) => point[2])).toEqual([3, 4, 5]);
    // Every step joins neighbors, and every step is water.
    for (let i = 0; i < added.cells!.length - 1; i++) {
      expect(pack.cells.c[added.cells![i]]).toContain(added.cells![i + 1]);
    }
    expect(added.cells!.every((cell) => pack.cells.h[cell] < 20)).toBe(true);
    expect(pack.cells.routes?.[4]?.[5]).toBe(added.i);
  });

  it('skips tiny uninhabited rocks', () => {
    const pack = makePack();

    const report = ensureIslandHarbors(pack, { minLandCells: 2 });

    expect(report.skippedComponentCells).toContainEqual([2]);
    expect(pack.cells.burg![2]).toBe(0);
  });
});
