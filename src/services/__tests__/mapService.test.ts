import { describe, expect, it } from 'vitest';
import { generateMap } from '../mapService';
import { BIOMES, LOCATIONS, STARTING_LOCATION_ID } from '../../constants';
import { MAP_GRID_SIZE } from '../../config/mapConfig';

function flattenBiomeIds(mapData: ReturnType<typeof generateMap>): string[] {
  return mapData.tiles.flat().map((tile) => tile.biomeId);
}

describe('mapService generateMap (Azgaar-source default)', () => {
  it('is deterministic for the same seed', () => {
    const seed = 123456789;
    const mapA = generateMap(MAP_GRID_SIZE.rows, MAP_GRID_SIZE.cols, LOCATIONS, BIOMES, seed);
    const mapB = generateMap(MAP_GRID_SIZE.rows, MAP_GRID_SIZE.cols, LOCATIONS, BIOMES, seed);
    expect(flattenBiomeIds(mapA)).toEqual(flattenBiomeIds(mapB));
  });

  it('changes output for different seeds', () => {
    const mapA = generateMap(MAP_GRID_SIZE.rows, MAP_GRID_SIZE.cols, LOCATIONS, BIOMES, 11111);
    const mapB = generateMap(MAP_GRID_SIZE.rows, MAP_GRID_SIZE.cols, LOCATIONS, BIOMES, 22222);

    const a = flattenBiomeIds(mapA);
    const b = flattenBiomeIds(mapB);
    const differences = a.reduce((count, biomeId, index) => count + (biomeId !== b[index] ? 1 : 0), 0);

    expect(differences).toBeGreaterThan(Math.floor(a.length * 0.1));
  });

  it('anchors predefined locations onto their map coordinates', () => {
    const mapData = generateMap(MAP_GRID_SIZE.rows, MAP_GRID_SIZE.cols, LOCATIONS, BIOMES, 424242);

    for (const location of Object.values(LOCATIONS)) {
      const x = location.mapCoordinates.x;
      const y = location.mapCoordinates.y;
      if (x < 0 || y < 0 || x >= MAP_GRID_SIZE.cols || y >= MAP_GRID_SIZE.rows) continue;

      const tile = mapData.tiles[y][x];
      expect(tile.locationId).toBe(location.id);
      expect(tile.biomeId).toBe(location.biomeId);
    }
  });

  it('marks the starting location and adjacent tiles as discovered', () => {
    const mapData = generateMap(MAP_GRID_SIZE.rows, MAP_GRID_SIZE.cols, LOCATIONS, BIOMES, 4242);
    const start = LOCATIONS[STARTING_LOCATION_ID];
    const sx = start.mapCoordinates.x;
    const sy = start.mapCoordinates.y;

    expect(mapData.tiles[sy][sx].isPlayerCurrent).toBe(true);
    expect(mapData.tiles[sy][sx].discovered).toBe(true);

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = sx + dx;
        const ny = sy + dy;
        if (nx < 0 || ny < 0 || nx >= MAP_GRID_SIZE.cols || ny >= MAP_GRID_SIZE.rows) continue;
        expect(mapData.tiles[ny][nx].discovered).toBe(true);
      }
    }
  });
});
