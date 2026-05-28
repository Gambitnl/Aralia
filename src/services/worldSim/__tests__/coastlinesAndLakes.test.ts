import { extractCoastlines, extractLakes } from '../coastlinesAndLakes';

it('extracts no coastline when the entire grid is water', () => {
  const cols = 4;
  const rows = 4;
  const heights = new Array(cols * rows).fill(10);
  const polys = extractCoastlines(heights, cols, rows);
  expect(polys).toEqual([]);
});

it('extracts one coastline polygon when an island sits in water', () => {
  const cols = 6;
  const rows = 6;
  const heights = new Array(cols * rows).fill(10);
  for (let y = 2; y <= 3; y++) for (let x = 2; x <= 3; x++) heights[y * cols + x] = 50;
  const polys = extractCoastlines(heights, cols, rows);
  expect(polys).toHaveLength(1);
});

it('extracts a lake when there is interior water surrounded by land', () => {
  const cols = 6;
  const rows = 6;
  const heights = new Array(cols * rows).fill(50);
  for (let y = 2; y <= 3; y++) for (let x = 2; x <= 3; x++) heights[y * cols + x] = 10;
  const lakes = extractLakes(heights, cols, rows);
  expect(lakes).toHaveLength(1);
});

it('does not classify ocean as a lake', () => {
  const cols = 6;
  const rows = 6;
  const heights = new Array(cols * rows).fill(10);
  const lakes = extractLakes(heights, cols, rows);
  expect(lakes).toEqual([]);
});
