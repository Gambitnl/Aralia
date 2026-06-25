/**
 * Proves street-network pathing: a graph is built from street centerlines with
 * shared intersections merged, routes follow the streets (not straight lines),
 * progress sampling walks the polyline by arc length, and degenerate inputs fall
 * back safely.
 */
import { describe, it, expect } from 'vitest';
import {
  buildStreetGraph,
  routeAlongStreets,
  nearestNode,
  pathLength,
  positionAlongPath,
  type Point,
} from '../agentPath';
import type { TownPlan } from '../../artifacts';

// An H-shaped street network: two verticals joined by a horizontal rung, so the
// only way from bottom-left to bottom-right is up-across-down (an L route, never
// a straight diagonal).
const plan = {
  burgId: 1,
  plots: [],
  streets: [
    { id: 1, widthFt: 10, centerline: [[0, 0], [0, 50], [0, 100]] },     // left vertical
    { id: 2, widthFt: 10, centerline: [[100, 0], [100, 50], [100, 100]] }, // right vertical
    { id: 3, widthFt: 10, centerline: [[0, 50], [100, 50]] },             // horizontal rung
  ],
} as unknown as TownPlan;

describe('buildStreetGraph', () => {
  it('merges coincident street vertices into shared intersection nodes', () => {
    const g = buildStreetGraph(plan);
    // 6 distinct points: (0,0),(0,50),(0,100),(100,0),(100,50),(100,100).
    expect(g.nodes).toHaveLength(6);
    // (0,50) and (100,50) are 3-way intersections (vertical + rung).
    const mid = nearestNode(g, [0, 50]);
    expect(g.adj[mid].length).toBe(3);
  });
});

describe('routeAlongStreets', () => {
  it('routes along the streets, not a straight diagonal', () => {
    const from: Point = [0, 100];
    const to: Point = [100, 100];
    const path = routeAlongStreets(buildStreetGraph(plan), from, to);
    // Straight-line would be 100; the street route detours up to the rung (y=50)
    // and back down → 50 + 100 + 50 = 200 between the snapped nodes.
    expect(pathLength(path)).toBeGreaterThan(150);
    // The path passes through an intersection at y=50 (the rung).
    expect(path.some((p) => Math.abs(p[1] - 50) < 1e-6)).toBe(true);
  });

  it('brackets the route with the true endpoints (door to door)', () => {
    const from: Point = [3, 99];
    const to: Point = [97, 99];
    const path = routeAlongStreets(buildStreetGraph(plan), from, to);
    expect(path[0]).toEqual(from);
    expect(path[path.length - 1]).toEqual(to);
  });

  it('falls back to a straight segment when there are no streets', () => {
    const empty = { burgId: 1, plots: [], streets: [] } as unknown as TownPlan;
    const path = routeAlongStreets(buildStreetGraph(empty), [0, 0], [10, 10]);
    expect(path).toEqual([[0, 0], [10, 10]]);
  });

  it('is deterministic', () => {
    const g = buildStreetGraph(plan);
    expect(routeAlongStreets(g, [0, 0], [100, 100])).toEqual(routeAlongStreets(g, [0, 0], [100, 100]));
  });
});

describe('positionAlongPath', () => {
  const path: Point[] = [[0, 0], [0, 100], [100, 100]]; // L, total length 200

  it('clamps t<=0 to start and t>=1 to end', () => {
    expect(positionAlongPath(path, -1)).toEqual([0, 0]);
    expect(positionAlongPath(path, 2)).toEqual([100, 100]);
  });

  it('samples the midpoint by arc length (100 of 200 → the corner)', () => {
    const mid = positionAlongPath(path, 0.5);
    expect(mid[0]).toBeCloseTo(0);
    expect(mid[1]).toBeCloseTo(100);
  });

  it('samples a quarter of the way up the first leg', () => {
    const q = positionAlongPath(path, 0.25); // 50 of 200
    expect(q[0]).toBeCloseTo(0);
    expect(q[1]).toBeCloseTo(50);
  });
});
