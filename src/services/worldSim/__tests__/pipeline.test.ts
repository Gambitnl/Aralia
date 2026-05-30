import { runWorldSim } from '../index';

it('returns a WorldData v2 object with all required fields', () => {
  const cols = 20;
  const rows = 12;
  const heights = new Array(cols * rows).fill(0).map((_, i) => 20 + (i % 60));
  const temperatures = new Array(cols * rows).fill(15);
  const moisture = new Array(cols * rows).fill(20);
  const biomeIds = new Array(cols * rows).fill('plains');
  const out = runWorldSim({
    seed: 42,
    templateId: 'continents',
    cols,
    rows,
    heights,
    temperatures,
    moisture,
    biomeIds,
  });
  expect(out.version).toBe(2);
  expect(out.seed).toBe(42);
  expect(out.gridSize).toEqual({ rows, cols });
  expect(out.rivers).toBeDefined();
  expect(out.roads).toBeDefined();
  expect(out.sites).toBeDefined();
  expect(out.coastlines).toBeDefined();
  expect(out.lakes).toBeDefined();
  expect(out.biomeZones).toBeDefined();
});

it('is deterministic for a given seed', () => {
  const params = {
    seed: 99,
    templateId: 'archipelago',
    cols: 16,
    rows: 12,
    heights: new Array(16 * 12).fill(0).map((_, i) => (i * 7) % 100),
    temperatures: new Array(16 * 12).fill(10),
    moisture: new Array(16 * 12).fill(30),
    biomeIds: new Array(16 * 12).fill('forest'),
  };
  const a = runWorldSim(params);
  const b = runWorldSim(params);
  expect(JSON.stringify(a)).toBe(JSON.stringify(b));
});
