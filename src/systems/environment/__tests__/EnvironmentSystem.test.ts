
import { describe, it, expect } from 'vitest';
// TODO(lint-intent): 'TERRAIN_RULES' is unused in this test; use it in the assertion path or remove it.
import { getWeatherModifiers, getTerrainMovementCost, TERRAIN_RULES as _TERRAIN_RULES } from '../EnvironmentSystem';
import { WeatherState } from '../../../types/environment';
import { Spell } from '../../../types/spells';

describe('EnvironmentSystem', () => {
  describe('getWeatherModifiers', () => {
    const fireBolt: Spell = {
      id: 'fire-bolt',
      name: 'Fire Bolt',
      level: 0,
      // TODO(2026-01-03 pass 4 Codex-CLI): cast spell school to enum until test helpers supply real enum value.
      school: 'Evocation' as unknown as Spell['school'],
      classes: ['Wizard'],
      description: 'Hurls a mote of fire.',
      castingTime: { value: 1, unit: 'action' },
      range: { type: 'ranged', distance: 120 },
      components: { verbal: true, somatic: true, material: false },
      duration: { type: 'instantaneous', concentration: false },
      targeting: { type: 'single', validTargets: ['creatures'], range: 120 },
      attackType: 'ranged',
      effects: [
        {
          trigger: { type: 'immediate' },
          condition: { type: 'hit' },
          type: 'DAMAGE',
          damage: { dice: '1d10', type: 'Fire' }
        }
      ]
    };

    it('should reduce fire damage in heavy rain', () => {
      const rainWeather: WeatherState = {
        precipitation: 'heavy_rain',
        temperature: 'temperate',
        wind: { direction: 'north', speed: 'calm' },
        visibility: 'lightly_obscured'
      };

      const modifiers = getWeatherModifiers(rainWeather, fireBolt);
      expect(modifiers).toHaveLength(1);
      expect(modifiers[0].type).toBe('damage');
      expect(modifiers[0].value).toBe(0.5);
    });

    it('should penalize ranged attacks in strong wind', () => {
      const windWeather: WeatherState = {
        precipitation: 'none',
        temperature: 'temperate',
        wind: { direction: 'west', speed: 'strong' },
        visibility: 'clear'
      };

      const modifiers = getWeatherModifiers(windWeather, fireBolt);
      expect(modifiers).toHaveLength(1);
      expect(modifiers[0].type).toBe('attack');
      expect(modifiers[0].value).toBe(-2);
    });

    it('should apply multiple modifiers if conditions overlap', () => {
      const stormWeather: WeatherState = {
        precipitation: 'storm',
        temperature: 'temperate',
        wind: { direction: 'west', speed: 'strong' }, // Storm implies strong wind usually, but defined explicitly here
        visibility: 'heavily_obscured'
      };

      const modifiers = getWeatherModifiers(stormWeather, fireBolt);
      expect(modifiers.some(m => m.type === 'damage')).toBe(true);
      expect(modifiers.some(m => m.type === 'attack')).toBe(true);
    });
  });

  describe('getTerrainMovementCost', () => {
    it('should return 1 for grass', () => {
      expect(getTerrainMovementCost('grass')).toBe(1);
    });

    it('should return 2 for difficult terrain', () => {
      expect(getTerrainMovementCost('difficult')).toBe(2);
    });

    it('should return 2 for water', () => {
      expect(getTerrainMovementCost('water')).toBe(2);
    });

    it('should return 999 for wall', () => {
        expect(getTerrainMovementCost('wall')).toBe(999);
    });
  });
});
