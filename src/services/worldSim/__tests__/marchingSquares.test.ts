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
