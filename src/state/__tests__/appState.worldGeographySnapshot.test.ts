import { describe, expect, it } from 'vitest';
import type { MapData } from '@/types/world';
import type { WorldData } from '@/services/worldSim/types';
import { GamePhase } from '@/types';
import { createMockGameState, createMockPlayerCharacter } from '@/utils/core/factories';
import { appReducer } from '../appState';
import { migrateMapDataToWorldDataV2 } from '../migrations/worldDataMigration';
import { fromMapData, resolveWorldData } from '@/utils/world/worldGeographyAdapter';

/**
 * These tests prove the World T9 startup/load continuity slice.
 *
 * The reducers still receive and store legacy `MapData`, but new-game, dummy,
 * and loaded-game payloads must already be rich enough for the geography
 * adapter to produce a seeded `WorldGeographySnapshot`. This lets later agents
 * keep adapting consumers without changing save/load persistence or 3D entry.
 */

describe('appState world geography snapshot continuity', () => {
  it('keeps new-game setup map payloads snapshot-ready', () => {
    const worldSeed = 91001;
    const mapData = createMapData({ worldData: createWorldData(worldSeed) });

    const nextState = appReducer(createMockGameState({ phase: GamePhase.MAIN_MENU }), {
      type: 'START_NEW_GAME_SETUP',
      payload: {
        mapData,
        dynamicLocationItemIds: { village: ['lantern'] },
        worldSeed,
      },
    });

    const snapshot = fromMapData(nextState.mapData!);

    expect(nextState.phase).toBe(GamePhase.CHARACTER_CREATION);
    expect(nextState.worldSeed).toBe(worldSeed);
    expect(snapshot.source).toBe('worlddata-v2');
    expect(snapshot.seed).toBe(worldSeed);
    expect(snapshot.gridSize).toEqual(mapData.gridSize);
    expect(snapshot.points).toHaveLength(mapData.gridSize.rows * mapData.gridSize.cols);
    expect(resolveWorldData(snapshot)).toBe(mapData.worldData);
    expect(nextState.mapData!.tiles).toBe(mapData.tiles);
  });

  it('keeps dummy/dev start map payloads snapshot-ready', () => {
    const worldSeed = 91002;
    const mapData = createMapData({ worldData: createWorldData(worldSeed) });
    const generatedParty = [createMockPlayerCharacter({ id: 'player', name: 'Snapshot Hero' })];

    const nextState = appReducer(createMockGameState({ phase: GamePhase.MAIN_MENU }), {
      type: 'START_GAME_FOR_DUMMY',
      payload: {
        mapData,
        dynamicLocationItemIds: { village: ['ration'] },
        generatedParty,
        worldSeed,
        initialInventory: [],
      },
    });

    const snapshot = fromMapData(nextState.mapData!);

    expect(nextState.phase).toBe(GamePhase.PLAYING);
    expect(nextState.worldSeed).toBe(worldSeed);
    expect(snapshot.source).toBe('worlddata-v2');
    expect(snapshot.seed).toBe(worldSeed);
    expect(snapshot.gridSize).toEqual(mapData.gridSize);
    expect(snapshot.points.some((point) => point.isPlayerCurrent)).toBe(true);
    expect(resolveWorldData(snapshot)).toBe(mapData.worldData);
    expect(nextState.mapData!.tiles).toBe(mapData.tiles);
  });

  it('keeps dummy preview initialization map payloads snapshot-ready', () => {
    const worldSeed = 91003;
    const mapData = createMapData({ worldData: createWorldData(worldSeed) });
    const baseState = createMockGameState({
      phase: GamePhase.MAIN_MENU,
      party: [createMockPlayerCharacter({ id: 'player', name: 'Preview Hero' })],
    });

    const nextState = appReducer(baseState, {
      type: 'INITIALIZE_DUMMY_PLAYER_STATE',
      payload: {
        worldSeed,
        mapData,
        dynamicLocationItemIds: { village: ['torch'] },
        initialLocationDescription: 'A preview-ready village.',
        initialSubMapCoordinates: { x: 2, y: 3 },
        initialActiveDynamicNpcIds: ['npc-1'],
        initialInventory: [],
      },
    });

    const snapshot = fromMapData(nextState.mapData!);

    expect(nextState.worldSeed).toBe(worldSeed);
    expect(snapshot.source).toBe('worlddata-v2');
    expect(snapshot.seed).toBe(worldSeed);
    expect(snapshot.gridSize).toEqual(mapData.gridSize);
    expect(resolveWorldData(snapshot)).toBe(mapData.worldData);
    expect(nextState.mapData!.tiles).toBe(mapData.tiles);
  });

  it('keeps loaded-game map payloads snapshot-ready after legacy migration', () => {
    const worldSeed = 91004;
    const legacyMapData = createMapData();
    const migratedMapData = migrateMapDataToWorldDataV2(legacyMapData, worldSeed);
    const loadedState = createMockGameState({
      phase: GamePhase.PLAYING,
      worldSeed,
      mapData: migratedMapData,
      party: [createMockPlayerCharacter({ id: 'player', name: 'Loaded Hero' })],
    });

    const nextState = appReducer(createMockGameState({ phase: GamePhase.MAIN_MENU }), {
      type: 'LOAD_GAME_SUCCESS',
      payload: loadedState,
    });

    const snapshot = fromMapData(nextState.mapData!);

    expect(nextState.phase).toBe(GamePhase.LOAD_TRANSITION);
    expect(nextState.worldSeed).toBe(worldSeed);
    expect(snapshot.source).toBe('worlddata-v2');
    expect(snapshot.seed).toBe(worldSeed);
    expect(snapshot.gridSize).toEqual(legacyMapData.gridSize);
    expect(snapshot.points).toHaveLength(legacyMapData.gridSize.rows * legacyMapData.gridSize.cols);
    expect(resolveWorldData(snapshot)).toBe(migratedMapData.worldData);
    expect(nextState.mapData!.tiles).toBe(legacyMapData.tiles);
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
          biomeId: 'plains',
          discovered: true,
          isPlayerCurrent: true,
        },
        {
          x: 1,
          y: 0,
          biomeId: 'forest',
          discovered: true,
          isPlayerCurrent: false,
        },
      ],
      [
        {
          x: 0,
          y: 1,
          biomeId: 'hills',
          discovered: false,
          isPlayerCurrent: false,
        },
        {
          x: 1,
          y: 1,
          biomeId: 'settlement',
          locationId: 'village',
          discovered: false,
          isPlayerCurrent: false,
        },
      ],
    ],
    ...overrides,
  };
}

function createWorldData(seed: number): WorldData {
  return {
    version: 2,
    seed,
    templateId: 'startup-snapshot-test-world',
    gridSize: { rows: 2, cols: 2 },
    heights: [10, 20, 30, 40],
    temperatures: [0.4, 0.5, 0.6, 0.7],
    moisture: [0.3, 0.4, 0.5, 0.6],
    biomeIds: ['plains', 'forest', 'hills', 'settlement'],
    rivers: [],
    roads: [],
    sites: [],
    coastlines: [],
    lakes: [],
    biomeZones: [],
  };
}
