/**
 * @file climateFromBiomes.test.ts
 * Deterministic biome-based fallback climate derivation for worldsim-service WSS-006.
 */

import { describe, expect, it } from 'vitest';
import { climateFromBiomes } from '../climateFromBiomes';

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

describe('climateFromBiomes', () => {
  it('returns one temperature and moisture value per cell', () => {
    const cols = 5;
    const rows = 3;
    const biomeIds = new Array(cols * rows).fill('plains_prairie');

    const climate = climateFromBiomes(biomeIds, cols, rows, 1);

    expect(climate.temperatures).toHaveLength(cols * rows);
    expect(climate.moisture).toHaveLength(cols * rows);
  });

  it('tracks temperature across biome climate bands', () => {
    const cols = 4;
    const rows = 4;
    const biomeIds = rowBiomes(cols, [
      'tundra_icefield',
      'plains_prairie',
      'plains_savanna',
      'jungle_tropical',
    ]).flatMap((row) => row.map((tile) => tile.biomeId));

    const climate = climateFromBiomes(biomeIds, cols, rows, 77);

    expect(climate.temperatures[0]).toBeLessThan(
      climate.temperatures[climate.temperatures.length - 1],
    );
  });

  it('tracks moisture across biome moisture bands', () => {
    const cols = 4;
    const rows = 4;
    const biomeIds = rowBiomes(cols, [
      'desert_dune',
      'steppe_windswept',
      'plains_prairie',
      'wetland_swamp',
    ]).flatMap((row) => row.map((tile) => tile.biomeId));

    const climate = climateFromBiomes(biomeIds, cols, rows, 78);

    expect(climate.moisture[0]).toBeLessThan(climate.moisture[climate.moisture.length - 1]);
  });

  it('is deterministic for a given seed and varies with a different seed', () => {
    const cols = 6;
    const rows = 6;
    const biomeIds = new Array(cols * rows).fill('forest_temperate');

    const a = climateFromBiomes(biomeIds, cols, rows, 100);
    const b = climateFromBiomes(biomeIds, cols, rows, 100);
    const c = climateFromBiomes(biomeIds, cols, rows, 200);

    expect(a.temperatures).toEqual(b.temperatures);
    expect(a.moisture).toEqual(b.moisture);
    expect(a.temperatures).not.toEqual(c.temperatures);
    expect(a.moisture).not.toEqual(c.moisture);
  });
});
