import { migrateMapDataToWorldDataV2 } from '../worldDataMigration';
import type { MapData } from '@/types/world';

const fakeTiles = (cols: number, rows: number) => {
  const tiles = [];
  for (let y = 0; y < rows; y++) {
    const row = [];
    for (let x = 0; x < cols; x++) {
      row.push({ x, y, biomeId: 'plains', discovered: false, isPlayerCurrent: false });
    }
    tiles.push(row);
  }
  return tiles;
};

it('populates worldData when missing using azgaarWorld payload', () => {
  const cols = 10;
  const rows = 8;
  const before: MapData = {
    gridSize: { rows, cols },
    tiles: fakeTiles(cols, rows),
    azgaarWorld: {
      version: 1,
      templateId: 'continents',
      heights: new Array(cols * rows).fill(30),
      temperatures: new Array(cols * rows).fill(10),
      moisture: new Array(cols * rows).fill(20),
      rivers: new Array(cols * rows).fill(false),
    },
  };
  const after = migrateMapDataToWorldDataV2(before, 42);
  expect(after.worldData).toBeDefined();
  expect(after.worldData!.version).toBe(2);
});

it('is a no-op when worldData already exists and is v2', () => {
  const cols = 6;
  const rows = 6;
  const seedWd = {
    version: 2 as const,
    seed: 1,
    templateId: 't',
    gridSize: { rows, cols },
    heights: new Array(cols * rows).fill(30),
    temperatures: [],
    moisture: [],
    biomeIds: [],
    rivers: [],
    roads: [],
    sites: [],
    coastlines: [],
    lakes: [],
    biomeZones: [],
  };
  const before: MapData = { gridSize: { rows, cols }, tiles: fakeTiles(cols, rows), worldData: seedWd };
  const after = migrateMapDataToWorldDataV2(before, 1);
  expect(after.worldData).toBe(seedWd);
});
