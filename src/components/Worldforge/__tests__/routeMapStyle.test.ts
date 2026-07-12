import { describe, it, expect } from 'vitest';
import { segmentRouteByVisibility, routeOpacity, ROUTE_STROKES } from '../routeMapStyle';

describe('segmentRouteByVisibility', () => {
  it('splits a polyline where visibility changes, sharing the boundary point', () => {
    // cells: 1,2 visible; 3,4 faint; 5 visible
    const points = [[0, 0, 1], [1, 0, 2], [2, 0, 3], [3, 0, 4], [4, 0, 5]];
    const vis = (c: number) => (c === 3 || c === 4 ? 'faint' as const : 'visible' as const);
    const segs = segmentRouteByVisibility(points, vis);
    expect(segs.map((s) => s.visibility)).toEqual(['visible', 'faint', 'visible']);
    // Segments overlap at boundaries so strokes stay continuous.
    expect(segs[0].points.at(-1)).toEqual([2, 0, 3]);
    expect(segs[1].points[0]).toEqual([2, 0, 3]);
    expect(segs[1].points.at(-1)).toEqual([4, 0, 5]);
  });
  it('returns one segment for uniform visibility', () => {
    const points = [[0, 0, 1], [1, 0, 2]];
    expect(segmentRouteByVisibility(points, () => 'visible')).toHaveLength(1);
  });
});

describe('style tables', () => {
  it('every kind has a stroke; only highways carry a casing', () => {
    expect(ROUTE_STROKES.highway.casing).toBeDefined();
    for (const kind of ['road', 'trail', 'path', 'searoute'] as const) {
      expect(ROUTE_STROKES[kind].casing).toBeUndefined();
      expect(ROUTE_STROKES[kind].stroke).toMatch(/^#/);
    }
  });
  it('opacity fades faint and overgrown path segments', () => {
    expect(routeOpacity('path', 'visible')).toBeCloseTo(0.55);
    expect(routeOpacity('path', 'faint')).toBeCloseTo(0.35);
    expect(routeOpacity('path', 'overgrown')).toBeCloseTo(0.2);
    expect(routeOpacity('road', 'visible')).toBe(1);
  });
});
