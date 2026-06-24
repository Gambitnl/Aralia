import { describe, it, expect } from 'vitest';
import { buildAtlasTravelGraph, buildRoadCells, atlasMilesPerUnit } from '../atlasTravelGraph';
import { planFastestRoute } from '../../../travel/routePlanning';

// Minimal atlas stub: 3 land cells in a line + 1 water cell. Cell 1 has a road.
const atlas = {
  graphWidth: 1000,
  biomesData: { name: ['Marine', 'Grassland', 'Glacier'] },
  pack: {
    cells: {
      c: [[1], [0, 2], [1, 3], [2]],          // adjacency
      p: [[0, 0], [10, 0], [20, 0], [30, 0]], // centroids
      h: [50, 50, 50, 5],                      // cells 0-2 land, cell 3 water
      biome: [1, 1, 2, 0],                     // cell 2 = Glacier (difficult), cell 3 = Marine
    },
    routes: [{ cells: [1] }],                  // cell 1 is on a road
  },
} as any;

describe('buildRoadCells', () => {
  it('collects all cells on routes', () => {
    expect(buildRoadCells(atlas)).toEqual(new Set([1]));
  });
});

describe('atlasMilesPerUnit', () => {
  it('falls back to a continent-sized scale when no distanceScale', () => {
    expect(atlasMilesPerUnit(atlas)).toBeCloseTo(3, 6); // 3000 / 1000
  });
  it('uses distanceScale (km→mi) when present', () => {
    expect(atlasMilesPerUnit({ ...atlas, distanceScale: 2 } as any)).toBeCloseTo(2 * 0.621371, 6);
  });
});

describe('buildAtlasTravelGraph', () => {
  const g = buildAtlasTravelGraph(atlas);

  it('maps neighbors, positions, terrain (road/difficult/open) and passability', () => {
    expect(g.neighbors(1)).toEqual([0, 2]);
    expect(g.position(2)).toEqual([20, 0]);
    expect(g.terrain(1)).toBe('road');       // on a route
    expect(g.terrain(2)).toBe('difficult');  // Glacier
    expect(g.terrain(0)).toBe('open');       // Grassland
    expect(g.passable(2)).toBe(true);        // land
    expect(g.passable(3)).toBe(false);       // water
  });

  it('halves danger on road cells vs wilderness', () => {
    expect(g.danger!(0)).toBeCloseTo(0.2, 6);   // Grassland baseline
    expect(g.danger!(1)).toBeCloseTo(0.1, 6);   // Grassland on road = ×0.5
    expect(g.danger!(2)).toBeCloseTo(0.6, 6);   // Glacier baseline
  });

  it('plans a route over the atlas graph that stops at the water edge', () => {
    const r = planFastestRoute(g, 0, 2, { milesPerUnit: 0.1, speedMph: 3 })!;
    expect(r.cells).toEqual([0, 1, 2]);
    expect(r.danger).toBeCloseTo(0.6, 6); // max along route (the Glacier cell)
    // Cell 3 (water) is unreachable for land travel.
    expect(planFastestRoute(g, 0, 3, { milesPerUnit: 0.1, speedMph: 3 })).toBeNull();
  });
});
