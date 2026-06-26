import { describe, it, expect } from 'vitest';
import { planFastestRoute, planRoutesFrom, transportSpeedMph, type TravelGraph } from '../routePlanning';
import type { TravelTerrain } from '../../../types/travel';
import { STANDARD_VEHICLES } from '../../../types/travel';

/**
 * These tests protect the generic travel route planner.
 *
 * The planner powers world-map travel previews by finding the fastest path
 * across whatever graph a map tier provides. The tests keep ordinary land
 * routing stable while allowing specialized graphs, such as maritime travel,
 * to supply their own per-edge travel time.
 */

/**
 * 3x1 line of cells: 0 — 1 — 2, centroids 10 units apart. Cell 1's terrain is
 * configurable so we can prove difficult terrain / impassability reroute & cost.
 */
function lineGraph(opts: {
  terrain1?: TravelTerrain;
  passable1?: boolean;
  danger?: Record<number, number>;
}): TravelGraph {
  const pos: Record<number, [number, number]> = { 0: [0, 0], 1: [10, 0], 2: [20, 0], 3: [10, 10] };
  // 0-1-2 in a line; 3 is a detour neighbor of 0 and 2 (so a reroute exists if 1 is blocked).
  const adj: Record<number, number[]> = { 0: [1, 3], 1: [0, 2], 2: [1, 3], 3: [0, 2] };
  return {
    neighbors: (c) => adj[c] ?? [],
    position: (c) => pos[c],
    terrain: (c) => (c === 1 ? (opts.terrain1 ?? 'open') : 'open'),
    passable: (c) => (c === 1 ? (opts.passable1 ?? true) : true),
    danger: (c) => opts.danger?.[c] ?? 0,
  };
}

describe('transportSpeedMph', () => {
  it('walking is 3mph; a riding horse is 6mph; a puller-limited cart is 2mph', () => {
    expect(transportSpeedMph({ method: 'walking' })).toBe(3);
    expect(transportSpeedMph({ method: 'mounted', vehicle: STANDARD_VEHICLES.riding_horse })).toBe(6);
    expect(transportSpeedMph({ method: 'vehicle', vehicle: STANDARD_VEHICLES.cart })).toBe(2);
    expect(transportSpeedMph(null)).toBe(3);
  });
});

describe('planFastestRoute', () => {
  it('routes straight through open terrain and computes miles + minutes', () => {
    const g = lineGraph({});
    // milesPerUnit 0.1 → each 10-unit edge = 1 mile. 2 edges = 2 miles at 3mph = 40 min.
    const r = planFastestRoute(g, 0, 2, { milesPerUnit: 0.1, speedMph: 3 })!;
    expect(r.cells).toEqual([0, 1, 2]);
    expect(r.miles).toBeCloseTo(2, 6);
    expect(r.minutes).toBeCloseTo(40, 6);
    expect(r.points).toHaveLength(3);
  });

  it('a faster transport reduces the travel time proportionally', () => {
    const g = lineGraph({});
    const foot = planFastestRoute(g, 0, 2, { milesPerUnit: 0.1, speedMph: 3 })!;
    const horse = planFastestRoute(g, 0, 2, { milesPerUnit: 0.1, speedMph: 6 })!;
    expect(horse.minutes).toBeCloseTo(foot.minutes / 2, 6);
  });

  it('reroutes around an impassable cell via the detour', () => {
    const g = lineGraph({ passable1: false });
    const r = planFastestRoute(g, 0, 2, { milesPerUnit: 0.1, speedMph: 3 })!;
    expect(r.cells).toEqual([0, 3, 2]); // detours through cell 3, not blocked cell 1
  });

  it('prefers the detour when the direct cell is difficult terrain (half speed)', () => {
    // Direct path 0-1-2: cell 1 difficult (×0.5 speed → double time on that edge).
    // Detour 0-3-2: all open. Distances: direct edges 10+10; detour edges ~14.1+14.1.
    // Direct minutes: (1mi/3) + (1mi/(3*0.5)) = 0.333h + 0.667h = 60 min.
    // Detour minutes: 2 × (1.414mi/3) = ~56.6 min → detour wins.
    const g = lineGraph({ terrain1: 'difficult' });
    const r = planFastestRoute(g, 0, 2, { milesPerUnit: 0.1, speedMph: 3 })!;
    expect(r.cells).toEqual([0, 3, 2]);
  });

  it('reports the max per-cell danger along the chosen route', () => {
    const g = lineGraph({ danger: { 1: 0.7 } });
    const r = planFastestRoute(g, 0, 2, { milesPerUnit: 0.1, speedMph: 3 })!;
    expect(r.danger).toBeCloseTo(0.7, 6);
  });

  it('returns null when the goal is unreachable / impassable', () => {
    const g: TravelGraph = {
      neighbors: () => [],
      position: () => [0, 0],
      terrain: () => 'open',
      passable: (c) => c === 0,
    };
    expect(planFastestRoute(g, 0, 2, { milesPerUnit: 1, speedMph: 3 })).toBeNull();
  });

  it('start === goal is a zero-length route', () => {
    const g = lineGraph({});
    const r = planFastestRoute(g, 1, 1, { milesPerUnit: 0.1, speedMph: 3 })!;
    expect(r.cells).toEqual([1]);
    expect(r.minutes).toBe(0);
  });
});

describe('planRoutesFrom (single-source field)', () => {
  it('uses graph-supplied per-edge minutes when available', () => {
    const graph: TravelGraph = {
      neighbors: (c) => (c === 0 ? [1] : c === 1 ? [0, 2] : [1]),
      position: (c) => [c, 0],
      terrain: () => 'open',
      passable: () => true,
      edgeMinutes: (_from, to) => (to === 1 ? 1 : to === 2 ? 100 : 1),
    };

    const field = planRoutesFrom(graph, 0, { milesPerUnit: 1, speedMph: 999 });
    const route = field.to(2);

    expect(route).not.toBeNull();
    expect(route!.minutes).toBe(101);
    expect(route!.cells).toEqual([0, 1, 2]);
  });

  it('computes one field that resolves routes to any cell (instant hover reconstruct)', () => {
    const g = lineGraph({});
    const field = planRoutesFrom(g, 0, { milesPerUnit: 0.1, speedMph: 3 });
    // The field reaches every passable cell from the origin.
    expect(field.dist.get(0)).toBe(0);
    expect(field.dist.get(2)).toBeCloseTo(40, 6); // same as point-to-point
    // to(goal) matches planFastestRoute for arbitrary goals.
    expect(field.to(2)!.cells).toEqual([0, 1, 2]);
    expect(field.to(3)!.cells).toEqual([0, 3]);
    expect(field.to(0)!.minutes).toBe(0);
  });

  it('field.to returns null for an unreachable / impassable goal', () => {
    const g: TravelGraph = {
      neighbors: () => [],
      position: () => [0, 0],
      terrain: () => 'open',
      passable: (c) => c === 0,
    };
    const field = planRoutesFrom(g, 0, { milesPerUnit: 1, speedMph: 3 });
    expect(field.to(2)).toBeNull();
  });
});
