import { runWorldSim } from '../index';

const REALISTIC_COLS = 60;
const REALISTIC_ROWS = 40;
const TIME_BUDGET_MS = 5000;

const buildInput = (seed: number) => {
  const cells = REALISTIC_COLS * REALISTIC_ROWS;
  const heights: number[] = [];
  for (let i = 0; i < cells; i++) {
    const v = Math.sin(i * 0.13 + seed) * 30 + Math.cos(i * 0.21 + seed * 0.5) * 20 + 30;
    heights.push(Math.max(0, Math.min(100, Math.round(v))));
  }
  return {
    seed,
    templateId: 'continents',
    cols: REALISTIC_COLS,
    rows: REALISTIC_ROWS,
    heights,
    temperatures: new Array(cells).fill(15),
    moisture: new Array(cells).fill(25),
    biomeIds: new Array(cells).fill(0).map((_, i) => (heights[i] < 20 ? 'ocean' : heights[i] < 40 ? 'plains' : 'forest')),
  };
};

it('end-to-end pipeline produces a complete WorldData object', () => {
  const out = runWorldSim(buildInput(2026));
  expect(out.version).toBe(2);
  expect(out.heights).toHaveLength(REALISTIC_COLS * REALISTIC_ROWS);
  expect(out.coastlines.length).toBeGreaterThanOrEqual(0);
  expect(Array.isArray(out.rivers)).toBe(true);
  expect(Array.isArray(out.roads)).toBe(true);
  expect(Array.isArray(out.sites)).toBe(true);
  expect(Array.isArray(out.biomeZones)).toBe(true);
});

it('completes within the soft performance budget on realistic input', () => {
  const start = performance.now();
  runWorldSim(buildInput(2027));
  const elapsed = performance.now() - start;
  expect(elapsed).toBeLessThan(TIME_BUDGET_MS);
});
