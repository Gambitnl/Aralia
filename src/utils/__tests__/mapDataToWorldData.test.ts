import { describe, expect, it } from 'vitest';
import type { MapData } from '@/types/world';
import type { WorldData } from '@/services/worldSim/types';
import {
  isWorldDataReadyForStreaming,
  resolveWorldDataFor3D,
} from '../mapDataToWorldData';

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

const minimalWorldData = (cols: number, rows: number): WorldData => ({
  version: 2,
  seed: 9,
  templateId: 'test',
  gridSize: { rows, cols },
  heights: new Array(cols * rows).fill(40),
  temperatures: new Array(cols * rows).fill(10),
  moisture: new Array(cols * rows).fill(20),
  biomeIds: new Array(cols * rows).fill('plains'),
  rivers: [],
  roads: [],
  sites: [],
  coastlines: [],
  lakes: [],
  biomeZones: [],
});

describe('isWorldDataReadyForStreaming', () => {
  it('accepts v2 WorldData with heights matching grid size', () => {
    expect(isWorldDataReadyForStreaming(minimalWorldData(4, 3))).toBe(true);
  });

  it('rejects missing or short heights array', () => {
    const wd = minimalWorldData(4, 3);
    wd.heights = [1, 2];
    expect(isWorldDataReadyForStreaming(wd)).toBe(false);
    expect(isWorldDataReadyForStreaming(undefined)).toBe(false);
  });
});

describe('resolveWorldDataFor3D', () => {
  it('returns null when mapData is absent', () => {
    expect(resolveWorldDataFor3D(null, 1)).toBeNull();
  });

  it('returns embedded worldData when already v2', () => {
    const cols = 6;
    const rows = 5;
    const worldData = minimalWorldData(cols, rows);
    const mapData: MapData = {
      gridSize: { rows, cols },
      tiles: fakeTiles(cols, rows),
      worldData,
    };
    expect(resolveWorldDataFor3D(mapData, 1)).toBe(worldData);
  });

  it('migrates legacy azgaarWorld payload into streamable WorldData', () => {
    const cols = 8;
    const rows = 6;
    const mapData: MapData = {
      gridSize: { rows, cols },
      tiles: fakeTiles(cols, rows),
      azgaarWorld: {
        version: 1,
        templateId: 'continents',
        heights: new Array(cols * rows).fill(35),
        temperatures: new Array(cols * rows).fill(12),
        moisture: new Array(cols * rows).fill(18),
        rivers: new Array(cols * rows).fill(false),
      },
    };
    const resolved = resolveWorldDataFor3D(mapData, 42);
    expect(resolved).not.toBeNull();
    expect(resolved!.version).toBe(2);
    expect(resolved!.heights.length).toBeGreaterThanOrEqual(cols * rows);
  });
});
