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

  it('skips tiny uninhabited rocks', () => {
    const pack = makePack();

    const report = ensureIslandHarbors(pack, { minLandCells: 2 });

    expect(report.skippedComponentCells).toContainEqual([2]);
    expect(pack.cells.burg![2]).toBe(0);
  });
});
