import { describe, it, expect } from 'vitest';
import {
  environmentForBiome,
  biomeGrowsTrees,
  TREE_BIOME_KEYS,
} from '../treeEnvironment';

describe('treeEnvironment', () => {
  it('maps every declared biome key to axes inside 0..1', () => {
    for (const key of TREE_BIOME_KEYS) {
      const env = environmentForBiome(key);
      for (const [axis, value] of Object.entries(env)) {
        expect(value, `${key}.${axis}`).toBeGreaterThanOrEqual(0);
        expect(value, `${key}.${axis}`).toBeLessThanOrEqual(1);
      }
    }
  });

  it('FAILS LOUDLY on an unmapped biome — no silent default', () => {
    expect(() => environmentForBiome('Nonsense')).toThrow(/no environment mapped/);
    // Treeless surfaces are absent on purpose, not by accident.
    expect(() => environmentForBiome('Marine')).toThrow(/no environment mapped/);
    expect(() => environmentForBiome('Glacier')).toThrow(/no environment mapped/);
    expect(() => environmentForBiome('ocean')).toThrow(/no environment mapped/);
    expect(biomeGrowsTrees('Marine')).toBe(false);
    expect(biomeGrowsTrees('Taiga')).toBe(true);
  });

  it('ground biome ids alias onto the atlas names, not a second table', () => {
    expect(environmentForBiome('jungle')).toEqual(environmentForBiome('Tropical rainforest'));
    expect(environmentForBiome('forest')).toEqual(
      environmentForBiome('Temperate deciduous forest'),
    );
    expect(environmentForBiome('swamp')).toEqual(environmentForBiome('Wetland'));
  });

  it('the biomes separate on the axes that matter', () => {
    const jungle = environmentForBiome('Tropical rainforest');
    const desert = environmentForBiome('Hot desert');
    const tundra = environmentForBiome('Tundra');

    expect(jungle.light).toBeLessThan(desert.light);
    expect(jungle.aridity).toBeLessThan(desert.aridity);
    expect(jungle.vigor).toBeGreaterThan(desert.vigor);
    expect(tundra.wind).toBeGreaterThan(jungle.wind);
    expect(tundra.chill).toBeGreaterThan(jungle.chill);
  });

  it('elevation raises wind and chill and lowers vigor', () => {
    const low = environmentForBiome('Grassland', { elevationFt: 0 });
    const high = environmentForBiome('Grassland', { elevationFt: 9000 });
    expect(high.wind).toBeGreaterThan(low.wind);
    expect(high.chill).toBeGreaterThan(low.chill);
    expect(high.vigor).toBeLessThan(low.vigor);
  });

  it('latitude raises chill', () => {
    const equator = environmentForBiome('Grassland', { latitudeDeg: 0 });
    const polar = environmentForBiome('Grassland', { latitudeDeg: -78 });
    expect(polar.chill).toBeGreaterThan(equator.chill);
    // Sign is ignored: only the distance from the equator is read.
    expect(environmentForBiome('Grassland', { latitudeDeg: 78 })).toEqual(polar);
  });

  it('moisture overrides most of the biome aridity', () => {
    const dryReading = environmentForBiome('Grassland', { moisture01: 0 });
    const wetReading = environmentForBiome('Grassland', { moisture01: 1 });
    expect(dryReading.aridity).toBeGreaterThan(wetReading.aridity);
    // Omitted moisture is a no-op, not a hidden default.
    expect(environmentForBiome('Grassland').aridity)
      .toBe(environmentForBiome('Grassland', {}).aridity);
  });

  it('is pure: the same inputs always give the same axes', () => {
    const a = environmentForBiome('Taiga', { elevationFt: 4200, latitudeDeg: 61, moisture01: 0.4 });
    const b = environmentForBiome('Taiga', { elevationFt: 4200, latitudeDeg: 61, moisture01: 0.4 });
    expect(a).toEqual(b);
  });
});
