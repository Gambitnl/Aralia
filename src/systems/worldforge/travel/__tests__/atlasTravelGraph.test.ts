import { describe, it, expect } from 'vitest';
import { buildAtlasTravelGraph, buildRoadCells, atlasMilesPerUnit, transportMobility, nearestLandCell } from '../atlasTravelGraph';
import { planFastestRoute } from '../../../travel/routePlanning';
import { STANDARD_VEHICLES } from '../../../../types/travel';

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

describe('nearestLandCell', () => {
  it('returns the cell itself when already land', () => {
    expect(nearestLandCell(atlas, 0)).toBe(0); // cell 0 is land (h=50)
  });
  it('snaps a sea cell to its nearest land neighbor', () => {
    // cell 3 is water (h=5); its neighbor cell 2 is land (h=50).
    expect(nearestLandCell(atlas, 3)).toBe(2);
  });
});

describe('transport mobility', () => {
  it('maps transport → land/water/air', () => {
    expect(transportMobility({ method: 'walking' })).toBe('land');
    expect(transportMobility({ method: 'mounted', vehicle: STANDARD_VEHICLES.riding_horse })).toBe('land');
    expect(transportMobility({ method: 'vehicle', vehicle: STANDARD_VEHICLES.rowboat })).toBe('water');
    expect(transportMobility({ method: 'mounted', vehicle: { id: 'griffon', name: 'Griffon', speed: 80, capacityWeight: 400, type: 'air' } })).toBe('air');
  });

  it('land transport cannot enter water; water transport cannot enter land; air can do both', () => {
    const land = buildAtlasTravelGraph(atlas, { mobility: 'land' });
    const water = buildAtlasTravelGraph(atlas, { mobility: 'water' });
    const air = buildAtlasTravelGraph(atlas, { mobility: 'air' });
    expect(land.passable(2)).toBe(true);  expect(land.passable(3)).toBe(false);  // land cell vs sea
    expect(water.passable(2)).toBe(false); expect(water.passable(3)).toBe(true);  // boats need water
    expect(air.passable(2)).toBe(true);   expect(air.passable(3)).toBe(true);     // flight crosses both
  });

  it('a flying mount can reach a water cell a land mount cannot', () => {
    const land = buildAtlasTravelGraph(atlas, { mobility: 'land' });
    const air = buildAtlasTravelGraph(atlas, { mobility: 'air' });
    expect(planFastestRoute(land, 0, 3, { milesPerUnit: 0.1, speedMph: 3 })).toBeNull();
    expect(planFastestRoute(air, 0, 3, { milesPerUnit: 0.1, speedMph: 8 })!.cells).toEqual([0, 1, 2, 3]);
  });
});
