import { describe, expect, it } from 'vitest';
import { generateMap } from '../mapService';
import { BIOMES, LOCATIONS, STARTING_LOCATION_ID } from '../../constants';

// Grid retirement: the world no longer carries a 30x20 grid. The dev-only
// generateMap generator still takes explicit dimensions, so the test fixes
// them locally rather than reading a retired global constant.
const GEN_ROWS = 20;
const GEN_COLS = 30;

function flattenBiomeIds(mapData: ReturnType<typeof generateMap>): string[] {
  return mapData.tiles.flat().map((tile) => tile.biomeId);
}

describe('mapService generateMap (Azgaar-source default)', () => {
  it('is deterministic for the same seed', () => {
    const seed = 123456789;
    const mapA = generateMap(GEN_ROWS, GEN_COLS, LOCATIONS, BIOMES, seed);
    const mapB = generateMap(GEN_ROWS, GEN_COLS, LOCATIONS, BIOMES, seed);
    expect(flattenBiomeIds(mapA)).toEqual(flattenBiomeIds(mapB));
  });

  it('changes output for different seeds', () => {
    const mapA = generateMap(GEN_ROWS, GEN_COLS, LOCATIONS, BIOMES, 11111);
    const mapB = generateMap(GEN_ROWS, GEN_COLS, LOCATIONS, BIOMES, 22222);

    const a = flattenBiomeIds(mapA);
    const b = flattenBiomeIds(mapB);
    const differences = a.reduce((count, biomeId, index) => count + (biomeId !== b[index] ? 1 : 0), 0);

    expect(differences).toBeGreaterThan(Math.floor(a.length * 0.1));
  });

  // Grid retirement (2026-07-01): the "anchors predefined locations onto their map
  // coordinates" + "marks the starting location discovered" tests are removed —
  // authored LOCATIONS no longer carry grid mapCoordinates (the field itself was
  // deleted from the Location type), so generateMap (now a dev-only generator) no
  // longer anchors them onto a 30x20 tile grid.
  it('authored LOCATIONS resolve without any grid mapCoordinates field', () => {
    const start = LOCATIONS[STARTING_LOCATION_ID];
    expect(start).toBeDefined();
    expect('mapCoordinates' in start).toBe(false);
  });

  it('generateMap returns MapData with worldData v2 attached', () => {
    const map = generateMap(20, 30, {}, BIOMES, 7777);
    expect(map.worldData).toBeDefined();
    expect(map.worldData!.version).toBe(2);
    expect(map.worldData!.seed).toBe(7777);
    expect(map.worldData!.gridSize).toEqual({ rows: 20, cols: 30 });
  });

  it('generateMap is deterministic — same seed produces identical worldData', () => {
    const a = generateMap(15, 20, {}, BIOMES, 1234);
    const b = generateMap(15, 20, {}, BIOMES, 1234);
    expect(JSON.stringify(a.worldData)).toBe(JSON.stringify(b.worldData));
  });

  it('every freshly-generated MapData has worldData (invariant)', () => {
    // Even on the legacy fallback path (or any future code path), MapData.worldData must exist.
    const map = generateMap(10, 12, {}, BIOMES, 8888);
    expect(map.worldData).toBeDefined();
    expect(map.worldData!.version).toBe(2);
  });
});
