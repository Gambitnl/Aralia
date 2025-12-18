import { describe, it, expect } from 'vitest';
import { WeatherSystem } from '../WeatherSystem';
import { WeatherState } from '../../types/environment/weather';
import { Spell } from '../../types/spells';

describe('WeatherSystem', () => {
  describe('generateWeatherForBiome', () => {
    it('should generate valid weather state', () => {
      const weather = WeatherSystem.generateWeatherForBiome('forest');
      expect(weather).toHaveProperty('precipitation');
      expect(weather).toHaveProperty('wind');
      expect(weather).toHaveProperty('visibility');
      expect(weather).toHaveProperty('temperature');
    });

    it('should favor hot weather in desert', () => {
      // Run multiple times to reduce flake, or seed random if possible.
      // For now, checking logical consistency of the function output
      const weather = WeatherSystem.generateWeatherForBiome('desert');
      expect(['hot', 'scorching', 'temperate']).toContain(weather.temperature);
    });

    it('should favor freezing weather in tundra', () => {
      const weather = WeatherSystem.generateWeatherForBiome('tundra');
      expect(['freezing', 'cold', 'temperate']).toContain(weather.temperature);
    });
  });

  describe('getEnvironmentModifiers', () => {
    it('should return movement penalties for storms', () => {
      const stormWeather: WeatherState = {
        precipitation: 'storm',
        wind: { speed: 'strong', direction: 'N' },
        visibility: 'heavily_obscured',
        temperature: 'temperate'
      };

      const mods = WeatherSystem.getEnvironmentModifiers(stormWeather);
      expect(mods.movementCostMultiplier).toBeGreaterThan(1);
      expect(mods.description).toContain('Movement slowed by storm');
    });

    it('should return attack penalties for gale force winds', () => {
      const galeWeather: WeatherState = {
        precipitation: 'none',
        wind: { speed: 'gale', direction: 'W' },
        visibility: 'clear',
        temperature: 'temperate'
      };

      const mods = WeatherSystem.getEnvironmentModifiers(galeWeather);
      expect(mods.attackModifier).toBeDefined();
      expect(mods.attackModifier?.value).toBeLessThan(0);
    });

    it('should dampen fire damage in rain', () => {
        const rainWeather: WeatherState = {
            precipitation: 'heavy_rain',
            wind: { speed: 'light', direction: 'N' },
            visibility: 'lightly_obscured',
            temperature: 'temperate'
        };

        const mods = WeatherSystem.getEnvironmentModifiers(rainWeather);
        const fireMod = mods.damageMultiplier?.find(m => m.type === 'fire');
        expect(fireMod).toBeDefined();
        expect(fireMod?.value).toBe(0.5);
    });
  });

  describe('getSpellModifiers', () => {
    it('should identify fire spells in rain', () => {
      const rainWeather: WeatherState = {
        precipitation: 'heavy_rain',
        wind: { speed: 'light', direction: 'N' },
        visibility: 'lightly_obscured',
        temperature: 'temperate'
      };

      const fireSpell: Spell = {
        id: 'firebolt',
        name: 'Fire Bolt',
        level: 0,
        school: 'Evocation',
        castingTime: { value: 1, unit: 'action' },
        range: { type: 'ranged', distance: 120 },
        components: { verbal: true, somatic: true },
        duration: { type: 'instantaneous' },
        effects: [
          {
            type: 'DAMAGE',
            trigger: { type: 'on_cast' }, // Added trigger
            condition: { type: 'hit' }, // Added condition
            damage: {
              amount: 1,
              dice: '1d10',
              type: 'Fire'
            }
          }
        ],
        description: 'Hurl a mote of fire.'
      };

      const mods = WeatherSystem.getSpellModifiers(rainWeather, fireSpell);
      expect(mods).toBeDefined();
      const fireMod = mods?.damageMultiplier?.find(m => m.type === 'fire');
      expect(fireMod?.value).toBe(0.5);
    });
  });
});
