import { describe, it, expect } from 'vitest';
import { planRoutesFrom } from '../../../travel/routePlanning';
import type { FmgAtlasResult } from '../../fmg/generateAtlas';
import {
  buildFerryLaneCells,
  buildMultiModalAtlasGraph,
} from '../multiModalAtlasGraph';

/**
 * These tests protect the first maritime-routing graph slice.
 *
 * The tiny fixture below proves the behavior players need on the world map:
 * land-only travel cannot magically cross the sea, while a ferry-capable trip
 * can board at one port, follow a sea lane, and arrive at another port.
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
