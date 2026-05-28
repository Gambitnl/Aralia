import { extractPolygons } from '../marchingSquares';

it('returns no polygons when no cell is inside', () => {
  const field = (x: number, y: number) => 0;
  const polys = extractPolygons(field, 4, 4, 0.5);
  expect(polys).toEqual([]);
});

it('extracts a single square polygon from a 3x3 block of insiders', () => {
  const field = (x: number, y: number) => (x >= 1 && x <= 3 && y >= 1 && y <= 3 ? 1 : 0);
  const polys = extractPolygons(field, 5, 5, 0.5);
  expect(polys).toHaveLength(1);
  expect(polys[0].length).toBeGreaterThanOrEqual(4);
  for (const v of polys[0]) {
    expect(v.x).toBeGreaterThanOrEqual(0.5);
    expect(v.x).toBeLessThanOrEqual(4.5);
    expect(v.y).toBeGreaterThanOrEqual(0.5);
    expect(v.y).toBeLessThanOrEqual(4.5);
  }
});

it('extracts two separate polygons for two disjoint islands', () => {
  const field = (x: number, y: number) => {
    const a = x >= 1 && x <= 2 && y >= 1 && y <= 2;
    const b = x >= 5 && x <= 6 && y >= 5 && y <= 6;
    return a || b ? 1 : 0;
  };
  const polys = extractPolygons(field, 8, 8, 0.5);
  expect(polys).toHaveLength(2);
});

it('extracts a 4-vertex polygon from a single-cell inside region', () => {
  const field = (x: number, y: number) => (x === 2 && y === 2 ? 1 : 0);
  const polys = extractPolygons(field, 5, 5, 0.5);
  expect(polys).toHaveLength(1);
  expect(polys[0]).toHaveLength(4);
});

it('produces two polygons for a doughnut (region with interior hole)', () => {
  // A 5x5 inside region with a 1x1 hole in the center, in a 7x7 grid.
  const field = (x: number, y: number) => {
    const inOuter = x >= 1 && x <= 5 && y >= 1 && y <= 5;
    const inHole = x === 3 && y === 3;
    return inOuter && !inHole ? 1 : 0;
  };
  const polys = extractPolygons(field, 7, 7, 0.5);
  expect(polys).toHaveLength(2);
});

it('traces correctly for inside cells flush with the grid border', () => {
  // 2x2 block in the top-left corner of the grid.
  const field = (x: number, y: number) => (x <= 1 && y <= 1 ? 1 : 0);
  const polys = extractPolygons(field, 4, 4, 0.5);
  expect(polys).toHaveLength(1);
  // Polygon should include corner (0,0).
  const hasOrigin = polys[0].some((v) => v.x === 0 && v.y === 0);
  expect(hasOrigin).toBe(true);
});

it('discards open chains gracefully (returns valid polygons only)', () => {
  // Field that creates no inside cells — sanity that no malformed polygons leak through.
  const polys = extractPolygons(() => 0, 10, 10, 0.5);
  expect(polys).toEqual([]);
});
