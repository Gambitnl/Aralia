import { generateRoads } from '../roads';
import type { Site } from '../types';

const flat = (cols: number, rows: number) => new Array(cols * rows).fill(40);

const mkSite = (id: string, x: number, y: number): Site => ({
  id,
  kind: 'town',
  position: { x, y },
  footprint: [],
});

it('returns no roads if there are fewer than 2 towns', () => {
  const sites = [mkSite('t0', 1, 1)];
  expect(generateRoads(flat(10, 10), 10, 10, sites)).toEqual([]);
});

it('connects 3 towns into a connected graph (n-1 minimum spanning tree edges)', () => {
  const sites = [
    mkSite('t0', 2, 2),
    mkSite('t1', 8, 2),
    mkSite('t2', 5, 7),
  ];
  const roads = generateRoads(flat(10, 10), 10, 10, sites);
  expect(roads.length).toBeGreaterThanOrEqual(2);
  for (const r of roads) {
    expect(r.fromSiteId).not.toBe(r.toSiteId);
    expect(r.points.length).toBeGreaterThanOrEqual(2);
  }
});

it('road polylines avoid impassable water cells', () => {
  const cols = 10;
  const rows = 10;
  const heights = flat(cols, rows);
  for (let x = 0; x < cols; x++) heights[5 * cols + x] = 10;
  heights[5 * cols + 5] = 40;
  const sites = [mkSite('t0', 2, 2), mkSite('t1', 2, 8)];
  const roads = generateRoads(heights, cols, rows, sites);
  expect(roads.length).toBeGreaterThanOrEqual(1);
  const points = roads[0].points;
  const passesBridge = points.some((p) => Math.abs(p.x - 5) < 1 && Math.abs(p.y - 5) < 1);
  expect(passesBridge).toBe(true);
});

it('roads are deterministic for the same input', () => {
  const sites = [
    mkSite('t0', 2, 2),
    mkSite('t1', 8, 2),
    mkSite('t2', 5, 7),
  ];
  const a = generateRoads(flat(10, 10), 10, 10, sites);
  const b = generateRoads(flat(10, 10), 10, 10, sites);
  expect(JSON.stringify(a)).toBe(JSON.stringify(b));
});

it('handles disconnected islands by returning a spanning forest', () => {
  // Two land regions separated by impassable water with no bridge.
  const cols = 10;
  const rows = 10;
  const heights = new Array(cols * rows).fill(40);
  for (let x = 0; x < cols; x++) heights[5 * cols + x] = 10; // sea row, no bridge
  const sites = [
    mkSite('t0', 2, 2),
    mkSite('t1', 7, 2),
    mkSite('t2', 2, 8),
    mkSite('t3', 7, 8),
  ];
  const roads = generateRoads(heights, cols, rows, sites);
  // Two land regions, each with 2 towns → 2 MST edges total (one per region).
  // No road should cross the sea row.
  for (const r of roads) {
    for (const p of r.points) {
      const cx = Math.floor(p.x);
      const cy = Math.floor(p.y);
      expect(heights[cy * cols + cx]).toBeGreaterThanOrEqual(20);
    }
  }
  // At least one road exists (north or south region).
  expect(roads.length).toBeGreaterThanOrEqual(2);
});

it('road points are all on land (no water cells visited)', () => {
  const cols = 10;
  const rows = 10;
  const heights = new Array(cols * rows).fill(40);
  for (let x = 0; x < cols; x++) heights[5 * cols + x] = 10;
  heights[5 * cols + 5] = 40;
  const sites = [mkSite('t0', 2, 2), mkSite('t1', 2, 8)];
  const roads = generateRoads(heights, cols, rows, sites);
  for (const r of roads) {
    for (const p of r.points) {
      const cx = Math.floor(p.x);
      const cy = Math.floor(p.y);
      expect(heights[cy * cols + cx]).toBeGreaterThanOrEqual(20);
    }
  }
});
