/**
 * @file roadCourse.test.ts — a world road is smoothed between towns but runs
 * exactly through every town it serves (GG-541).
 */
import { describe, it, expect } from 'vitest';
import { keepRoadOffRivers, roadCourseFt, type RoutePoint } from '../roadCourse';
import { smoothRegionRiverCenterline } from '../riverCenterlineSmoothing';

const has = (line: Array<[number, number]>, [x, y]: [number, number]) =>
  line.some(([a, b]) => Math.abs(a - x) < 1e-9 && Math.abs(b - y) < 1e-9);

describe('roadCourseFt', () => {
  // A route that turns a sharp corner at a town (cell 2 holds burg 7).
  const points: RoutePoint[] = [[0, 0, 1], [10, 0, 2], [10, 10, 3]];
  const cellBurg = [0, 0, 7, 0];

  it('runs through the town at the corner instead of cutting it', () => {
    const course = roadCourseFt(points, 100, cellBurg);
    expect(has(course, [1000, 0])).toBe(true);
    // The old whole-route smoothing missed the town by a wide margin.
    const old = smoothRegionRiverCenterline(points.map(([x, y]) => [x * 100, y * 100]));
    const miss = Math.min(...old.map(([x, y]) => Math.hypot(x - 1000, y)));
    expect(miss).toBeGreaterThan(100);
  });

  it('keeps a town at the route end', () => {
    const course = roadCourseFt([[0, 0, 2], [10, 0, 1], [10, 10, 3]], 100, cellBurg);
    expect(course[0]).toEqual([0, 0]);
  });

  it('matches the old smoothing on a route with no town on it', () => {
    const plain = roadCourseFt(points, 100, [0, 0, 0, 0]);
    expect(plain).toEqual(smoothRegionRiverCenterline(points.map(([x, y]) => [x * 100, y * 100])));
  });

  it('does not repeat a town point between two smoothed pieces', () => {
    const course = roadCourseFt(points, 100, cellBurg);
    const at = course.filter(([x, y]) => x === 1000 && y === 0);
    expect(at).toHaveLength(1);
  });
});

describe('keepRoadOffRivers (GG-582)', () => {
  // A straight river along the x axis; the road keeps 50 ft from its center line.
  const river = { line: [[-1000, 0], [1000, 0]] as Array<[number, number]>, clear: 50 };
  const lineD = (p: [number, number]) => Math.abs(p[1]);

  it('moves a road that runs down the river onto one bank, and keeps it there', () => {
    const road: Array<[number, number]> = [[-800, 200], [-400, 3], [400, -2], [800, 220]];
    const out = keepRoadOffRivers(road, [river]);
    expect(Math.min(...out.map(lineD))).toBeGreaterThanOrEqual(50 - 1e-9);
    // It came from the north bank and leaves to the north bank: no crossing.
    expect(out.every(([, y]) => y > 0)).toBe(true);
    expect(out[0]).toEqual([-800, 200]);
    expect(out[out.length - 1]).toEqual([800, 220]);
  });

  it('crosses once, square to the river, when the road leaves on the other side', () => {
    const road: Array<[number, number]> = [[-800, 200], [-300, 10], [300, -10], [800, -200]];
    const out = keepRoadOffRivers(road, [river]);
    const flips = out.slice(1).filter((p, i) => Math.sign(p[1]) !== Math.sign(out[i][1]));
    expect(flips).toHaveLength(1);
    const k = out.findIndex((p, i) => i > 0 && Math.sign(p[1]) !== Math.sign(out[i - 1][1]));
    // The crossing runs straight across: same x on both banks, 2 x clear long.
    expect(out[k][0]).toBeCloseTo(out[k - 1][0], 9);
    expect(Math.abs(out[k][1] - out[k - 1][1])).toBeCloseTo(100, 9);
  });

  it('leaves a road that never comes near the river unchanged', () => {
    const road: Array<[number, number]> = [[-800, 300], [0, 400], [800, 300]];
    expect(keepRoadOffRivers(road, [river])).toEqual(road);
  });

  it('does not move a point the caller holds', () => {
    const road: Array<[number, number]> = [[-800, 200], [0, 0], [800, 200]];
    const out = keepRoadOffRivers(road, [river], (p) => p[0] === 0 && p[1] === 0);
    expect(out.some(([x, y]) => x === 0 && y === 0)).toBe(true);
  });
});
