
import { describe, it, expect } from 'vitest';
import { generateDailyWeather } from '../WeatherSystem';
import { createMockGameState } from '../../../utils/factories';
import { WeatherState } from '../../../types/weather';
import { Season } from '../../../utils/timeUtils';
import { SeededRandom } from '../../../utils/seededRandom';

describe('WeatherSystem', () => {
    it('generates valid weather state', () => {
        const state = createMockGameState();
        const rng = new SeededRandom(12345);
        const weather = generateDailyWeather(state, rng);

        expect(weather).toHaveProperty('condition');
        expect(weather).toHaveProperty('wind');
        expect(weather).toHaveProperty('temperature');
        expect(weather).toHaveProperty('description');
        expect(weather).toHaveProperty('travelModifier');
        expect(weather).toHaveProperty('visibilityModifier');
        expect(weather).toHaveProperty('lastUpdatedDay');
    });

    it('generates appropriate weather for seasons (mocking generic logic)', () => {
        // Since we can't easily mock getSeason without mocking timeUtils module,
        // we test the system with dates we know fall in specific seasons.
        // Epoch is Jan 1 (Winter)

        const winterState = createMockGameState({ gameTime: new Date(Date.UTC(351, 0, 1)) }); // Jan
        const rng = new SeededRandom(123);

        // Generate multiple times to check distribution
        const conditions: string[] = [];
        for(let i=0; i<20; i++) {
            conditions.push(generateDailyWeather(winterState, new SeededRandom(i)).condition);
        }

        // Winter should have snow or clear/cloudy, less likely rain
        expect(conditions).toContain('snow');
        expect(conditions).not.toContain('heatwave');
    });

    it('applies modifiers correctly', () => {
        const state = createMockGameState();
        const rng = new SeededRandom(999);
        // Force specific outcome by trial or just check logic structure

        const weather = generateDailyWeather(state, rng);
        if (weather.condition === 'storm') {
            expect(weather.travelModifier).toBeGreaterThan(1.0);
            expect(weather.visibilityModifier).toBeLessThan(1.0);
        } else if (weather.condition === 'clear') {
            expect(weather.travelModifier).toBe(1.0);
        }
    });
});
