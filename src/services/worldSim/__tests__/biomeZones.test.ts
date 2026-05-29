import { extractBiomeZones } from '../biomeZones';

it('returns no zones for empty grids', () => {
  expect(extractBiomeZones([], 0, 0)).toEqual([]);
});

it('extracts one zone per distinct biome region', () => {
  const cols = 4;
  const rows = 4;
  const biomeIds: string[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      biomeIds.push(x < 2 ? 'forest' : 'plains');
    }
  }
  const zones = extractBiomeZones(biomeIds, cols, rows);
  expect(zones.map((z) => z.biomeId).sort()).toEqual(['forest', 'plains']);
  for (const z of zones) {
    expect(z.polygon.length).toBeGreaterThanOrEqual(4);
  }
});

it('produces two zones for two disjoint regions of the same biome', () => {
  const cols = 6;
  const rows = 4;
  const biomeIds: string[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const isForest = (x < 2) || (x > 3);
      biomeIds.push(isForest ? 'forest' : 'plains');
    }
  }
  const zones = extractBiomeZones(biomeIds, cols, rows);
  const forestZones = zones.filter((z) => z.biomeId === 'forest');
  expect(forestZones).toHaveLength(2);
});
