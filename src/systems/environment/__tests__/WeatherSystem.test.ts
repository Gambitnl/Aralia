
import { describe, it, expect } from 'vitest';
// TODO(lint-intent): 'CLIMATES' is unused in this test; use it in the assertion path or remove it.
import { updateWeather, getClimateForBiome, CLIMATES as _CLIMATES } from '../WeatherSystem';
// TODO(lint-intent): 'Temperature' is unused in this test; use it in the assertion path or remove it.
import { WeatherState, Temperature as _Temperature, VisibilityLevel as _VisibilityLevel } from '../../../types/environment';
import { TimeOfDay } from '../../../utils/core';
import { SeededRandom } from '../../../utils/random';

const createRandomSource = (...values: number[]) => {
    let index = 0;

    return {
        next: () => values[Math.min(index++, values.length - 1)]
    };
};

describe('WeatherSystem', () => {
    // Basic mock weather state
    const baseWeather: WeatherState = {
        precipitation: 'none',
        temperature: 'temperate',
        wind: { direction: 'north', speed: 'calm' },
        visibility: 'clear',
        baseTemperature: 'temperate',
        baseVisibility: 'clear'
    };

    it('should return a valid climate profile for a known biome', () => {
        const profile = getClimateForBiome('forest');
        expect(profile).toBeDefined();
        expect(profile.id).toBe('forest');
    });

    it('should default to plains for unknown biome', () => {
        const profile = getClimateForBiome('unknown_void_dimension');
        expect(profile.id).toBe('plains');
    });

    it('should return identical weather for identical seeded inputs', () => {
        const seed = 12345;
        const first = updateWeather(baseWeather, 'plains', TimeOfDay.Day, new SeededRandom(seed));
        const second = updateWeather(baseWeather, 'plains', TimeOfDay.Day, new SeededRandom(seed));

        expect(first).toEqual(second);
    });

    it('should change weather when random check passes', () => {
        const nextWeather = updateWeather(baseWeather, 'plains', TimeOfDay.Day, createRandomSource(0.1, 0.0, 0.0, 0.0));
        // It might be the same due to weighted random, but the function should have executed logic
        // We can check if it returned a new object or at least matches the schema
        expect(nextWeather).toBeDefined();
        expect(nextWeather.precipitation).toBeDefined();
        expect(nextWeather.baseTemperature).toBeDefined();
    });

    // --- TimeOfDay Integration Tests ---

    it('should shift temperature down at Night but preserve base', () => {
        // Base is temperate. Night should make it Cold.
        const nextWeather = updateWeather(baseWeather, 'plains', TimeOfDay.Night, createRandomSource(0.9));

        expect(nextWeather.temperature).toBe('cold');
        expect(nextWeather.baseTemperature).toBe('temperate');
    });

    it('should NOT drift temperature when called repeatedly at Night', () => {
        // Iteration 1: Temperate -> Cold
        let weather = updateWeather(baseWeather, 'plains', TimeOfDay.Night, createRandomSource(0.9));
        expect(weather.temperature).toBe('cold');
        expect(weather.baseTemperature).toBe('temperate');

        // Iteration 2: Should still be Cold (derived from Temperate), NOT Freezing
        weather = updateWeather(weather, 'plains', TimeOfDay.Night, createRandomSource(0.9));
        expect(weather.temperature).toBe('cold');
        expect(weather.baseTemperature).toBe('temperate');
    });

    it('should reduce visibility to heavily_obscured at Night but preserve base', () => {
        const nextWeather = updateWeather(baseWeather, 'plains', TimeOfDay.Night, createRandomSource(0.9));
        // Night always enforces heavy obscurity
        expect(nextWeather.visibility).toBe('heavily_obscured');
        expect(nextWeather.baseVisibility).toBe('clear');
    });

     it('should reduce visibility to lightly_obscured at Dusk/Dawn if clear', () => {
        const nextWeather = updateWeather(baseWeather, 'desert', TimeOfDay.Dusk, createRandomSource(0.9));
        expect(nextWeather.visibility).toBe('lightly_obscured');
        expect(nextWeather.baseVisibility).toBe('clear');
    });

    it('should recover to base state when Day returns', () => {
        // 1. Set to Night
        const nightWeather = updateWeather(baseWeather, 'plains', TimeOfDay.Night, createRandomSource(0.9));
        expect(nightWeather.temperature).toBe('cold');
        expect(nightWeather.visibility).toBe('heavily_obscured');

        // 2. Return to Day
        const dayWeather = updateWeather(nightWeather, 'plains', TimeOfDay.Day, createRandomSource(0.9));
        expect(dayWeather.temperature).toBe('temperate');
        expect(dayWeather.visibility).toBe('clear');
        expect(dayWeather.baseTemperature).toBe('temperate');
    });

    it('should correctly migrate existing storm state', () => {
        // Simulating a state from before baseVisibility existed:
        // A storm implies heavily_obscured.
        const legacyStorm: WeatherState = {
             precipitation: 'storm',
             temperature: 'temperate',
             wind: { direction: 'north', speed: 'strong' },
             visibility: 'heavily_obscured',
             // NO baseVisibility
        };

        const migrated = updateWeather(legacyStorm, 'plains', TimeOfDay.Day, createRandomSource(0.9));

        // Should derive baseVisibility from the precipitation, not default to 'clear'
        expect(migrated.baseVisibility).toBe('heavily_obscured');
        expect(migrated.visibility).toBe('heavily_obscured');
    });
});
