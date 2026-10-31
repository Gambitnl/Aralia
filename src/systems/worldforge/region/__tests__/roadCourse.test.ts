/**
 * @file roadCourse.test.ts — a world road is smoothed between towns but runs
 * exactly through every town it serves (GG-541).
 */
import { describe, it, expect } from 'vitest';
import { roadCourseFt, type RoutePoint } from '../roadCourse';
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
