import type { MapData } from '@/types/world';
import { migrateMapDataToWorldDataV2 } from '../worldDataMigration';

/**
 * These tests protect the loader-side world-data migration.
 *
 * Old saves arrive with legacy tile grids, optional Azgaar terrain, or already
 * migrated `WorldData`. The migration must keep those saves readable. (Grid
 * retirement: the old `worldGeography` snapshot backfill is removed — nothing
 * read it — so these tests no longer assert it.)
 */

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

const rowBiomes = (cols: number, biomes: string[]) =>
  biomes.map((biomeId, y) =>
    Array.from({ length: cols }, (_, x) => ({
      x,
      y,
      biomeId,
      discovered: false,
      isPlayerCurrent: false,
    })),
  );

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

it('records biome-derived provenance when no azgaarWorld terrain is present', () => {
  const cols = 8;
  const rows = 6;
  const before: MapData = {
    gridSize: { rows, cols },
    tiles: fakeTiles(cols, rows),
    // no azgaarWorld, no worldData → migration must derive heights from biomes
  };
  const after = migrateMapDataToWorldDataV2(before, 7);
  expect(after.worldData).toBeDefined();
  expect(after.generation).toBeDefined();
  expect(after.generation!.source).toBe('biome-derived');
  expect(after.generation!.reason).toMatch(/biome/i);
});

it('derives a heightfield with real variance from biomes (no flat pancake)', () => {
  const cols = 8;
  const rows = 6;
  const before: MapData = {
    gridSize: { rows, cols },
    tiles: fakeTiles(cols, rows),
  };
  const after = migrateMapDataToWorldDataV2(before, 7);
  const heights = after.worldData!.heights;
  // The defect (WSS-004) was a constant heightfield. Assert it now varies.
  expect(new Set(heights).size).toBeGreaterThan(1);
  expect(Math.max(...heights)).toBeGreaterThan(Math.min(...heights));
});

it('derives temperatures from biome climate bands instead of a flat constant', () => {
  const cols = 4;
  const rows = 4;
  const tiles = rowBiomes(cols, [
    'tundra_icefield',
    'plains_prairie',
    'plains_savanna',
    'jungle_tropical',
  ]);
  const before: MapData = { gridSize: { rows, cols }, tiles };
  const after = migrateMapDataToWorldDataV2(before, 77);
  const temps = after.worldData!.temperatures;

  expect(new Set(temps).size).toBeGreaterThan(1);
  expect(temps[0]).toBeLessThan(temps[temps.length - 1]);
});

it('derives moisture from biome moisture bands instead of a flat constant', () => {
  const cols = 4;
  const rows = 4;
  const tiles = rowBiomes(cols, [
    'desert_dune',
    'steppe_windswept',
    'plains_prairie',
    'wetland_swamp',
  ]);
  const before: MapData = { gridSize: { rows, cols }, tiles };
  const after = migrateMapDataToWorldDataV2(before, 78);
  const moisture = after.worldData!.moisture;

  expect(new Set(moisture).size).toBeGreaterThan(1);
  expect(moisture[0]).toBeLessThan(moisture[moisture.length - 1]);
});

it('relief correlates with biome elevation bands (mountains > plains > ocean)', () => {
  // 3 rows: row 0 ocean (aquatic), row 1 plains (low), row 2 mountains (high).
  const cols = 4;
  const rows = 3;
  const rowBiomes = ['ocean', 'plains_prairie', 'mountain_alpine'];
  const tiles = rowBiomes.map((biomeId, y) =>
    Array.from({ length: cols }, (_, x) => ({
      x,
      y,
      biomeId,
      discovered: false,
      isPlayerCurrent: false,
    })),
  );
  const before: MapData = { gridSize: { rows, cols }, tiles };
  const after = migrateMapDataToWorldDataV2(before, 99);
  const h = after.worldData!.heights; // row-major, length cols*rows
  const rowAvg = (r: number) =>
    h.slice(r * cols, (r + 1) * cols).reduce((s, v) => s + v, 0) / cols;
  const ocean = rowAvg(0);
  const plains = rowAvg(1);
  const mountains = rowAvg(2);
  expect(ocean).toBeLessThan(plains);
  expect(plains).toBeLessThan(mountains);
  expect(ocean).toBeLessThan(20); // below SEA_LEVEL → water
});

it('biome-derived heightfield is deterministic for a given seed', () => {
  const cols = 6;
  const rows = 5;
  const mk = (): MapData => ({ gridSize: { rows, cols }, tiles: fakeTiles(cols, rows) });
  const a = migrateMapDataToWorldDataV2(mk(), 12345);
  const b = migrateMapDataToWorldDataV2(mk(), 12345);
  const c = migrateMapDataToWorldDataV2(mk(), 54321);
  expect(a.worldData!.heights).toEqual(b.worldData!.heights);
  // Different seed → different heightfield (jitter is seed-driven).
  expect(a.worldData!.heights).not.toEqual(c.worldData!.heights);
});

it('does NOT record biome-derived provenance when azgaarWorld heights exist', () => {
  const cols = 6;
  const rows = 6;
  const before: MapData = {
    gridSize: { rows, cols },
    tiles: fakeTiles(cols, rows),
    azgaarWorld: {
      version: 1,
      templateId: 'continents',
      heights: new Array(cols * rows).fill(45),
      temperatures: new Array(cols * rows).fill(10),
      moisture: new Array(cols * rows).fill(20),
      rivers: new Array(cols * rows).fill(false),
    },
  };
  const after = migrateMapDataToWorldDataV2(before, 7);
  expect(after.generation).toBeUndefined();
});

it('does not clobber an existing generation reason', () => {
  const cols = 4;
  const rows = 4;
  const before: MapData = {
    gridSize: { rows, cols },
    tiles: fakeTiles(cols, rows),
    generation: { source: 'legacy-fallback', reason: 'boom', at: 123 },
  };
  const after = migrateMapDataToWorldDataV2(before, 7);
  expect(after.generation).toEqual({ source: 'legacy-fallback', reason: 'boom', at: 123 });
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

it('returns a v2-worldData save unchanged (worldGeography backfill retired)', () => {
  const cols = 4;
  const rows = 4;
  const worldData = {
    version: 2 as const,
    seed: 11,
    templateId: 'v2-without-geography',
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
  const before: MapData = {
    gridSize: { rows, cols },
    tiles: fakeTiles(cols, rows),
    worldData,
  };

  const after = migrateMapDataToWorldDataV2(before, 11);

  // Grid retirement: a v2-worldData save is now returned unchanged. The
  // worldGeography snapshot (a mapData.tiles-derived bridge nothing reads) is
  // no longer backfilled (and the field is removed from MapData).
  expect(after).toBe(before);
  expect(after.worldData).toBe(worldData);
});

it('migrates a legacy (pre-v2) save to v2 worldData while keeping legacy tiles readable', () => {
  const cols = 4;
  const rows = 3;
  const before: MapData = {
    gridSize: { rows, cols },
    tiles: fakeTiles(cols, rows),
  };

  const after = migrateMapDataToWorldDataV2(before, 314);

  // Grid retirement: worldData heightfield still backfills for legacy saves
  // (climate/relief); the worldGeography snapshot field is gone entirely.
  expect(after.worldData).toBeDefined();
  expect(after.gridSize).toEqual(before.gridSize);
  expect(after.tiles[0][0]).toMatchObject({
    x: 0,
    y: 0,
    biomeId: 'plains',
    discovered: false,
    isPlayerCurrent: false,
  });
});

it('returns an already-v2 save by reference (idempotent no-op)', () => {
  const cols = 3;
  const rows = 3;
  const worldData = {
    version: 2 as const,
    seed: 5,
    templateId: 'already-v2',
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
  const before: MapData = {
    gridSize: { rows, cols },
    tiles: fakeTiles(cols, rows),
    worldData,
  };

  const after = migrateMapDataToWorldDataV2(before, 5);

  expect(after).toBe(before);
  expect(after.worldData).toBe(worldData);
});
