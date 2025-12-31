
import { describe, it, expect } from 'vitest';
import {
  getTerrainMovementCost,
  getTerrainCover,
  terrainGrantsStealth,
  getEffectiveTerrain,
  TERRAIN_RULES
} from '../TerrainSystem';
import { BattleMapTerrain } from '../../types/combat';
import { WeatherState } from '../../types/environment';

describe('TerrainSystem', () => {
  it('returns standard movement cost for unknown terrain', () => {
    // @ts-ignore - Testing runtime fallback for invalid type
    expect(getTerrainMovementCost('void_dimension')).toBe(1);
  });

  it('returns correct movement cost for difficult terrain', () => {
    expect(getTerrainMovementCost('dense_forest')).toBe(2);
    expect(getTerrainMovementCost('mud')).toBe(3);
  });

  it('returns correct cover type for terrain', () => {
    expect(getTerrainCover('grass')).toBe('none');
    expect(getTerrainCover('dense_forest')).toBe('half');
    expect(getTerrainCover('water')).toBe('three_quarters');
  });

  it('identifies stealth advantage correctly', () => {
    expect(terrainGrantsStealth('dense_forest')).toBe(true);
    expect(terrainGrantsStealth('road')).toBe(false);
  });

  it('verifies all registered rules have valid IDs', () => {
    Object.values(TERRAIN_RULES).forEach(rule => {
      expect(rule.movementCost).toBeGreaterThanOrEqual(1);
      expect(['none', 'half', 'three_quarters', 'total']).toContain(rule.cover);
    });
  });

  describe('getEffectiveTerrain (Dynamic Interactions)', () => {
    const baseWeather: WeatherState = {
      precipitation: 'none',
      temperature: 'temperate',
      wind: { direction: 'north', speed: 'calm' },
      visibility: 'clear'
    };

    it('turns dirt to mud during heavy rain', () => {
      const rainWeather: WeatherState = { ...baseWeather, precipitation: 'heavy_rain' };
      const effect = getEffectiveTerrain('dirt', rainWeather);

      expect(effect.id).toBe('mud');
      expect(effect.movementCost).toBe(3);
    });

    it('makes grass muddy during heavy rain', () => {
      const rainWeather: WeatherState = { ...baseWeather, precipitation: 'heavy_rain' };
      const effect = getEffectiveTerrain('grass', rainWeather);

      expect(effect.id).toBe('grass'); // ID stays same
      expect(effect.movementCost).toBe(2); // Cost increases
      expect(effect.name).toBe('Muddy Grass');
    });

    it('freezes water into ice', () => {
      const freezingWeather: WeatherState = { ...baseWeather, temperature: 'freezing' };
      const effect = getEffectiveTerrain('water', freezingWeather);

      expect(effect.id).toBe('ice');
      expect(effect.movementCost).toBe(1); // Easier to move on ice than swim
    });

    it('accumulates snow on open ground', () => {
      const snowWeather: WeatherState = { ...baseWeather, precipitation: 'snow' };
      const effect = getEffectiveTerrain('road', snowWeather);

      expect(effect.movementCost).toBe(2);
      expect(effect.name).toBe('Snow-covered Road');
    });

    it('adds ice hazard to wet surfaces when freezing', () => {
      const freezingRain: WeatherState = {
        ...baseWeather,
        temperature: 'freezing',
        precipitation: 'heavy_rain' // Freezing rain
      };
      // Test on rock, which doesn't turn to mud or melt
      const effect = getEffectiveTerrain('rock', freezingRain);

      expect(effect.name).toContain('Frozen');
      expect(effect.hazards?.some(h => h.id === 'slippery_ice')).toBe(true);
    });
  });
});
