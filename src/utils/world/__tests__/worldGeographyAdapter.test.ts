import { describe, expect, it } from 'vitest';
import { METERS_PER_CELL } from '@/utils/worldCoords';
import type { WorldData } from '@/services/worldSim/types';
import type { MapData } from '@/types/world';
import {
  applyMutationsToMapData,
  buildLegacyDiscoveryMutations,
  createClearCurrentMutation,
  createLegacyTileId,
  createSetCurrentMutation,
  fromMapData,
  resolve3DAnchor,
  resolveLegacyTile,
  resolvePoint,
  resolveWorldData,
} from '../worldGeographyAdapter';

// These tests lock the first adapter slice to read-only projection. They avoid
// runtime rewiring so future passes can compare old and new world geography
// behavior before replacing legacy tile-grid consumers.

describe('worldGeographyAdapter', () => {
  it('projects legacy tiles into stable geography points', () => {
    const mapData = createMapData();

    const snapshot = fromMapData(mapData);

    expect(snapshot.source).toBe('legacy-mapdata');
    expect(snapshot.gridSize).toEqual({ rows: 2, cols: 2 });
    expect(snapshot.points).toHaveLength(4);
    expect(snapshot.points[0]).toMatchObject({
      id: createLegacyTileId(0, 0),
      legacyTile: { x: 0, y: 0 },
      biomeId: 'grassland',
      discovered: true,
      isPlayerCurrent: true,
      passability: { passable: true, source: 'assumed-passable' },
    });
  });

  it('resolves points by stable id and legacy coordinates', () => {
    const snapshot = fromMapData(createMapData());

    expect(resolvePoint(snapshot, 'legacy-tile:1:0')?.biomeId).toBe('water');
    expect(resolvePoint(snapshot, createLegacyTileId(0, 1))?.biomeId).toBe('forest');
    expect(resolveLegacyTile(snapshot, { x: 1, y: 1 })?.locationId).toBe('town-1');
    expect(resolveLegacyTile(snapshot, { x: 7, y: 7 })).toBeNull();
  });

  it('records passability when a biome allow-list is supplied', () => {
    const snapshot = fromMapData(createMapData(), {
      passableBiomeIds: ['grassland', 'forest', 'settlement'],
    });

    expect(resolveLegacyTile(snapshot, { x: 1, y: 0 })?.passability).toEqual({
      passable: false,
      source: 'biome-allow-list',
    });
    expect(resolveLegacyTile(snapshot, { x: 0, y: 1 })?.passability).toEqual({
      passable: true,
      source: 'biome-allow-list',
    });
  });

  it('records passability from canonical biome definitions when supplied', () => {
    const snapshot = fromMapData(createMapData(), {
      biomesById: {
        grassland: { passable: true },
        water: { passable: false },
        forest: { passable: true },
        settlement: { passable: true },
      },
    });

    expect(resolveLegacyTile(snapshot, { x: 1, y: 0 })?.passability).toEqual({
      passable: false,
      source: 'biome-registry',
    });
    expect(resolveLegacyTile(snapshot, { x: 0, y: 0 })?.passability).toEqual({
      passable: true,
      source: 'biome-registry',
    });
  });

  it('carries ready WorldData without mutating the legacy map payload', () => {
    const mapData = createMapData({ worldData: createWorldData() });

    const snapshot = fromMapData(mapData);

    expect(snapshot.source).toBe('worlddata-v2');
    expect(snapshot.seed).toBe(42);
    expect(snapshot.templateId).toBe('adapter-test-world');
    expect(resolveWorldData(snapshot)).toBe(mapData.worldData);
    expect(snapshot.points[0]).not.toBe(mapData.tiles[0][0]);
  });

  it('builds bounded legacy discovery mutations for a reveal radius', () => {
    const mapData = createMapData();

    const mutations = buildLegacyDiscoveryMutations(mapData, { x: 0, y: 0 }, 1);

    expect(mutations).toEqual([
      { type: 'discover', target: createLegacyTileId(0, 0) },
      { type: 'discover', target: createLegacyTileId(1, 0) },
      { type: 'discover', target: createLegacyTileId(0, 1) },
      { type: 'discover', target: createLegacyTileId(1, 1) },
    ]);
  });

  it('applies discovery mutations without mutating caller-owned tile arrays', () => {
    const mapData = createMapData();
    const originalWaterTile = mapData.tiles[0][1];

    const result = applyMutationsToMapData(mapData, [
      { type: 'discover', target: createLegacyTileId(1, 0) },
    ]);

    expect(mapData.tiles[0][1]).toBe(originalWaterTile);
    expect(mapData.tiles[0][1].discovered).toBe(false);
    expect(result.mapData.tiles).not.toBe(mapData.tiles);
    expect(result.mapData.tiles[0][1]).not.toBe(originalWaterTile);
    expect(result.mapData.tiles[0][1].discovered).toBe(true);
    expect(resolveLegacyTile(result.snapshot, { x: 1, y: 0 })?.discovered).toBe(true);
    expect(result.changedLegacyTiles).toEqual([{ x: 1, y: 0 }]);
  });

  it('moves the current marker while optionally discovering the target', () => {
    const mapData = createMapData();

    const result = applyMutationsToMapData(mapData, [
      createSetCurrentMutation(createLegacyTileId(1, 0)),
    ]);

    expect(result.mapData.tiles[0][0].isPlayerCurrent).toBe(false);
    expect(result.mapData.tiles[0][1].isPlayerCurrent).toBe(true);
    expect(result.mapData.tiles[0][1].discovered).toBe(true);
    expect(resolveLegacyTile(result.snapshot, { x: 1, y: 0 })?.isPlayerCurrent).toBe(true);
    expect(result.changedLegacyTiles).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]);
  });

  it('can clear current markers and ignore non-legacy mutation targets', () => {
    const mapData = createMapData();

    const result = applyMutationsToMapData(mapData, [
      createClearCurrentMutation(),
      {
        type: 'discover',
        target: { kind: 'azgaar-cell', id: 'azgaar-cell:12' },
      },
    ]);

    expect(result.mapData.tiles.flat().some((tile) => tile.isPlayerCurrent)).toBe(false);
    expect(result.changedLegacyTiles).toEqual([{ x: 0, y: 0 }]);
    expect(resolvePoint(result.snapshot, 'azgaar-cell:12')).toBeNull();
  });

  it('resolves a persisted geography point into the 3D entry anchor', () => {
    const mapData = createMapData({ worldData: createWorldData() });
    const snapshot = fromMapData(mapData);

    const anchor = resolve3DAnchor(snapshot, createLegacyTileId(1, 1));

    expect(anchor).toMatchObject({
      point: expect.objectContaining({
        id: createLegacyTileId(1, 1),
        biomeId: 'settlement',
      }),
      worldPosition: {
        x: METERS_PER_CELL * 1.5,
        y: expect.any(Number),
        z: METERS_PER_CELL * 1.5,
      },
      groundPosition: {
        tileX: 1,
        tileY: 1,
        xM: METERS_PER_CELL / 2,
        zM: METERS_PER_CELL / 2,
      },
    });
  });
});

function createMapData(overrides: Partial<MapData> = {}): MapData {
  return {
    gridSize: { rows: 2, cols: 2 },
    tiles: [
      [
        {
          x: 0,
          y: 0,
          biomeId: 'grassland',
          discovered: true,
          isPlayerCurrent: true,
        },
        {
          x: 1,
          y: 0,
          biomeId: 'water',
          discovered: false,
          isPlayerCurrent: false,
        },
      ],
      [
        {
          x: 0,
          y: 1,
          biomeId: 'forest',
          discovered: true,
          isPlayerCurrent: false,
        },
        {
          x: 1,
          y: 1,
          biomeId: 'settlement',
          locationId: 'town-1',
          discovered: true,
          isPlayerCurrent: false,
        },
      ],
    ],
    ...overrides,
  };
}

function createWorldData(): WorldData {
  return {
    version: 2,
    seed: 42,
    templateId: 'adapter-test-world',
    gridSize: { rows: 2, cols: 2 },
    heights: [0, 1, 2, 3],
    temperatures: [0.5, 0.5, 0.5, 0.5],
    moisture: [0.5, 0.5, 0.5, 0.5],
    biomeIds: ['grassland', 'water', 'forest', 'settlement'],
    rivers: [],
    roads: [],
    sites: [],
    coastlines: [],
    lakes: [],
    biomeZones: [],
  };
}
