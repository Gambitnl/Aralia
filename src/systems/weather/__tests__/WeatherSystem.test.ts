
import { describe, it, expect } from 'vitest';
import { generateDailyWeather, getWeatherTravelModifier, getWeatherDescription } from '../WeatherSystem';
import { WeatherState } from '../../../types/environment';
import { Season } from '../../../utils/timeUtils';
import { SeededRandom } from '../../../utils/seededRandom';

describe('WeatherSystem', () => {
  const baseWeather: WeatherState = {
    precipitation: 'none',
    temperature: 'temperate',
    wind: { direction: 'north', speed: 'calm' },
    visibility: 'clear'
  };

  const rng = new SeededRandom(12345);

  describe('generateDailyWeather', () => {
    it('should generate valid weather state', () => {
      const weather = generateDailyWeather(baseWeather, 'plains', Season.Spring, rng);
      expect(weather).toHaveProperty('precipitation');
      expect(weather).toHaveProperty('temperature');
      expect(weather).toHaveProperty('wind');
      expect(weather).toHaveProperty('visibility');
    });

    it('should produce snow in winter/tundra', () => {
      // Force winter
      const weather = generateDailyWeather(baseWeather, 'tundra', Season.Winter, rng);
      // Tundra + Winter is very likely to be freezing
      if (weather.precipitation !== 'none') {
        expect(['snow', 'blizzard']).toContain(weather.precipitation);
      }
    });
  });

  describe('getWeatherTravelModifier', () => {
    it('should return 1.0 for clear weather', () => {
      expect(getWeatherTravelModifier(baseWeather)).toBe(1.0);
    });

    it('should apply penalties for bad weather', () => {
      const stormWeather: WeatherState = {
        ...baseWeather,
        precipitation: 'storm',
        wind: { direction: 'north', speed: 'strong' }
      };
      // Storm (0.5) + Strong Wind (0.1) = 1.6
      expect(getWeatherTravelModifier(stormWeather)).toBeGreaterThan(1.0);
    });

    it('should apply massive penalty for blizzard', () => {
       const blizzard: WeatherState = {
        ...baseWeather,
        precipitation: 'blizzard',
        visibility: 'heavily_obscured',
        temperature: 'freezing'
      };
      // Blizzard (0.75) + Obscured (0.3) + Freezing (0.1) = 2.15
      expect(getWeatherTravelModifier(blizzard)).toBeGreaterThan(2.0);
    });
  });

  describe('getWeatherDescription', () => {
    it('should describe clear weather', () => {
      expect(getWeatherDescription(baseWeather)).toBe('The weather is clear and temperate.');
    });

    it('should describe complex weather', () => {
       const w: WeatherState = {
         precipitation: 'heavy_rain',
         temperature: 'cold',
         wind: { direction: 'north', speed: 'strong' },
         visibility: 'lightly_obscured'
       };
       // "It is chilly and windy and pouring rain."
       const desc = getWeatherDescription(w);
       expect(desc).toContain('chilly');
       expect(desc).toContain('pouring rain');
    });
  });
});
