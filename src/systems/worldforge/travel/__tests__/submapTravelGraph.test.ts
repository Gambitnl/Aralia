import { describe, it, expect } from 'vitest';
import { buildSubmapTravelGraph, buildSubmapAdjacency } from '../submapTravelGraph';
import { planFastestRoute } from '../../../travel/routePlanning';
import type { SubmapModel, SubmapCell } from '../../submap/submapEngine';

// Three square cells in a row, each sharing a vertical edge with the next:
//  cell0 [0..10]  cell1 [10..20]  cell2 [20..30]  (all y 0..10)
const cells: SubmapCell[] = [
  { siteIndex: 0, polygon: [[0, 0], [10, 0], [10, 10], [0, 10]], biome: 'Grassland' },
  { siteIndex: 1, polygon: [[10, 0], [20, 0], [20, 10], [10, 10]], biome: 'Wetland' },
  { siteIndex: 2, polygon: [[20, 0], [30, 0], [30, 10], [20, 10]], biome: 'Grassland' },
];
const model: SubmapModel = { boundary: [[0, 0], [30, 0], [30, 10], [0, 10]], biome: 'Grassland', cells, burgCellIndex: null, polylines: [] };

describe('buildSubmapAdjacency', () => {
  it('connects cells that share a polygon edge', () => {
    const adj = buildSubmapAdjacency(cells);
    expect(adj[0].sort()).toEqual([1]);     // 0 shares an edge only with 1
    expect(adj[1].sort()).toEqual([0, 2]);  // middle cell touches both
    expect(adj[2].sort()).toEqual([1]);
  });
});

describe('buildSubmapTravelGraph', () => {
  const g = buildSubmapTravelGraph(model);

  it('exposes neighbors, centroids, biome terrain and danger', () => {
    expect(g.neighbors(1).sort()).toEqual([0, 2]);
    expect(g.position(1)).toEqual([15, 5]);
    expect(g.terrain(0)).toBe('open');       // Grassland
    expect(g.terrain(1)).toBe('difficult');  // Wetland
    expect(g.passable(1)).toBe(true);
    expect(g.danger!(1)).toBeCloseTo(0.45, 6); // Wetland baseline
  });

  it('plans a route across the submap cells (difficult middle counts in danger)', () => {
    const r = planFastestRoute(g, 0, 2, { milesPerUnit: 0.01, speedMph: 3 })!;
    expect(r.cells).toEqual([0, 1, 2]);
    expect(r.danger).toBeCloseTo(0.45, 6); // max along route = the Wetland cell
    expect(r.minutes).toBeGreaterThan(0);
  });
});
