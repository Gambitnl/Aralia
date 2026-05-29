import { traceRivers } from '../rivers';

it('returns no rivers when there is no land', () => {
  const cols = 4;
  const rows = 4;
  const heights = new Array(cols * rows).fill(10);
  expect(traceRivers(heights, cols, rows, 1)).toEqual([]);
});

it('traces a river down a single-slope ridge to the sea', () => {
  const cols = 6;
  const rows = 1;
  const heights = [80, 70, 60, 40, 25, 10];
  const rivers = traceRivers(heights, cols, rows, 1);
  expect(rivers.length).toBeGreaterThanOrEqual(1);
  const main = rivers[0];
  expect(main.points[0].x).toBeLessThan(5);
  expect(main.points[main.points.length - 1].x).toBeGreaterThanOrEqual(4);
  for (let i = 1; i < main.discharge.length; i++) {
    expect(main.discharge[i]).toBeGreaterThanOrEqual(main.discharge[i - 1]);
  }
});

it('is deterministic for a given seed and heightmap', () => {
  const cols = 8;
  const rows = 8;
  const heights = new Array(cols * rows).fill(0).map((_, i) => 80 - i);
  const a = traceRivers(heights, cols, rows, 1);
  const b = traceRivers(heights, cols, rows, 1);
  expect(JSON.stringify(a)).toBe(JSON.stringify(b));
});
