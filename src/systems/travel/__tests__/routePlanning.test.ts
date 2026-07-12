import { describe, it, expect } from 'vitest';
import { planFastestRoute, planRoutesFrom, routeHaltIndex, transportSpeedMph, type TravelGraph } from '../routePlanning';
import type { TravelTerrain } from '../../../types/travel';
import { STANDARD_VEHICLES } from '../../../types/travel';
import { climbFactorFor } from '../../worldforge/travel/routeTerrain';

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

// Edge-level climb cost (2026-07-11 mountains): a graph may expose
// climbFactor(from, to); the planner multiplies it into the speed-factor
// branch so ascents genuinely cost time and pass routes beat scrambles.
describe('climbFactor edge hook (2026-07-11 mountains)', () => {
  it('multiplies into the terrain-table branch (absent hook = unchanged times)', () => {
    const flat = lineGraph({});
    const climb: TravelGraph = { ...lineGraph({}), climbFactor: (_from, to) => (to === 1 ? 0.5 : 1) };
    expect(planFastestRoute(flat, 0, 1, { milesPerUnit: 0.1, speedMph: 3 })!.minutes).toBeCloseTo(20, 6);
    expect(planFastestRoute(climb, 0, 1, { milesPerUnit: 0.1, speedMph: 3 })!.minutes).toBeCloseTo(40, 6);
  });

  it('composes with a graded speedFactor (both multiply)', () => {
    const g: TravelGraph = {
      ...lineGraph({}),
      speedFactor: (c) => (c === 1 ? 0.5 : 1),
      climbFactor: (_from, to) => (to === 1 ? 0.5 : 1),
    };
    // 1 mile at 3 mph = 20 min, × 2 (terrain) × 2 (climb) = 80 min.
    expect(planFastestRoute(g, 0, 1, { milesPerUnit: 0.1, speedMph: 3 })!.minutes).toBeCloseTo(80, 6);
  });

  it('edgeMinutes stays authoritative — climbFactor is not double-applied on top', () => {
    const g: TravelGraph = {
      ...lineGraph({}),
      edgeMinutes: () => 7,
      climbFactor: () => 0.5,
    };
    expect(planFastestRoute(g, 0, 1, { milesPerUnit: 0.1, speedMph: 3 })!.minutes).toBe(7);
  });

  // The mechanics heart: once climbing costs time, a flat-but-long saddle
  // route beats the short-but-steep scramble straight over the ridge.
  it('prefers the flat pass route over the direct scramble across a ridge', () => {
    // Direct line 0—1—5 hops a h75 ridge cell; the detour 0—2—3—4—5 swings
    // around it over gentle h35/40/35 saddle cells (longer, ~29 units vs 20).
    //
    //      2(h35) — 3(h40) — 4(h35)     ← the pass (long, gentle)
    //     /                    \
    //  0(h30) —— 1(h75) —— 5(h30)       ← the scramble (short, steep)
    const h: Record<number, number> = { 0: 30, 1: 75, 2: 35, 3: 40, 4: 35, 5: 30 };
    const pos: Record<number, [number, number]> = {
      0: [0, 0], 1: [10, 0], 5: [20, 0],
      2: [5, 8], 3: [10, 9], 4: [15, 8],
    };
    const adj: Record<number, number[]> = {
      0: [1, 2], 1: [0, 5], 2: [0, 3], 3: [2, 4], 4: [3, 5], 5: [1, 4],
    };
    const graph = (withClimb: boolean): TravelGraph => ({
      neighbors: (c) => adj[c] ?? [],
      position: (c) => pos[c],
      terrain: () => 'open',
      passable: () => true,
      ...(withClimb
        ? { climbFactor: (from: number, to: number) => climbFactorFor(h[to] - h[from], null) }
        : {}),
    });
    // Without climb cost the scramble is simply shorter and wins…
    expect(planFastestRoute(graph(false), 0, 5, { milesPerUnit: 0.1, speedMph: 3 })!.cells)
      .toEqual([0, 1, 5]);
    // …with it, the planner threads the saddle instead.
    expect(planFastestRoute(graph(true), 0, 5, { milesPerUnit: 0.1, speedMph: 3 })!.cells)
      .toEqual([0, 2, 3, 4, 5]);
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
    // The exact edge-cost ledger is what lets provisioning stop at cell 1
    // after one minute instead of guessing from the three equally spaced points.
    expect(route!.cumulativeMinutes).toEqual([0, 1, 101]);
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

describe('routeHaltIndex', () => {
  it('uses cumulative edge time rather than vertex fraction for a supply horizon', () => {
    const route = {
      cells: [10, 11, 12, 13],
      points: [[0, 0], [1, 0], [2, 0], [3, 0]] as Array<[number, number]>,
      miles: 3,
      minutes: 180,
      cumulativeMinutes: [0, 10, 170, 180],
      danger: 0,
    };

    expect(routeHaltIndex(route, 60)).toBe(1);
    expect(routeHaltIndex(route, 175)).toBe(2);
  });

  it('does not grant a free first edge at a zero-minute horizon and can require a land halt', () => {
    const route = {
      cells: [20, 21, 22, 23],
      points: [[0, 0], [1, 0], [2, 0], [3, 0]] as Array<[number, number]>,
      miles: 3,
      minutes: 90,
      cumulativeMinutes: [0, 30, 60, 90],
      danger: 0,
    };

    expect(routeHaltIndex(route, 0)).toBe(0);
    expect(routeHaltIndex(route, 75, (cell) => cell === 20 || cell === 23)).toBe(0);
  });
});
