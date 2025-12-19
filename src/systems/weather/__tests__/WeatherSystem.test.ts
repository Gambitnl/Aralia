
import { describe, it, expect } from 'vitest';
import { generateDailyWeather, describeWeatherChange } from '../WeatherSystem';
import { Season } from '../../../utils/timeUtils';
import { SeededRandom } from '../../../utils/seededRandom';
import { WeatherState } from '../../../types/environment';

describe('WeatherSystem', () => {
    const defaultWeather: WeatherState = {
        precipitation: 'none',
        temperature: 'temperate',
        wind: { speed: 'calm', direction: 'north' },
        visibility: 'clear'
    };

    const rng = new SeededRandom(12345);

    describe('generateDailyWeather', () => {
        it('should generate valid weather state', () => {
            const weather = generateDailyWeather(Season.Spring, defaultWeather, rng);
            expect(weather).toHaveProperty('precipitation');
            expect(weather).toHaveProperty('temperature');
            expect(weather).toHaveProperty('wind');
            expect(weather).toHaveProperty('visibility');
        });

        it('should bias towards winter conditions in Winter', () => {
            let snowCount = 0;
            let freezingCount = 0;
            const iterations = 100;
            let current = defaultWeather;

            for (let i = 0; i < iterations; i++) {
                current = generateDailyWeather(Season.Winter, current, rng);
                if (current.precipitation === 'snow' || current.precipitation === 'blizzard') {
                    snowCount++;
                }
                if (current.temperature === 'freezing' || current.temperature === 'cold') {
                    freezingCount++;
                }
            }

            // Winter should have significant snow and cold
            expect(snowCount).toBeGreaterThan(10);
            expect(freezingCount).toBeGreaterThan(50);
        });

        it('should bias towards hot conditions in Summer', () => {
            let hotCount = 0;
            let snowCount = 0;
            const iterations = 100;
            let current = defaultWeather;

            for (let i = 0; i < iterations; i++) {
                current = generateDailyWeather(Season.Summer, current, rng);
                if (current.temperature === 'hot' || current.temperature === 'extreme_heat') {
                    hotCount++;
                }
                if (current.precipitation === 'snow') {
                    snowCount++;
                }
            }

            expect(hotCount).toBeGreaterThan(20);
            expect(snowCount).toBe(0); // Assuming no snow in summer config
        });
    });

    describe('describeWeatherChange', () => {
        it('should describe precipitation changes', () => {
            const oldW = { ...defaultWeather, precipitation: 'none' as const };
            const newW = { ...defaultWeather, precipitation: 'storm' as const };

            const desc = describeWeatherChange(oldW, newW);
            expect(desc).toContain('storm');
        });

        it('should return null for minor insignificant changes', () => {
             // Changing wind direction only is usually ignored unless gale
             const oldW = { ...defaultWeather, wind: { speed: 'light' as const, direction: 'north' as const } };
             const newW = { ...defaultWeather, wind: { speed: 'light' as const, direction: 'south' as const } };

             const desc = describeWeatherChange(oldW, newW);
             expect(desc).toBeNull();
        });

        it('should describe temperature extremes', () => {
             const oldW = { ...defaultWeather, temperature: 'temperate' as const };
             const newW = { ...defaultWeather, temperature: 'freezing' as const };

             const desc = describeWeatherChange(oldW, newW);
             expect(desc).toContain('freezing');
        });
    });
});
