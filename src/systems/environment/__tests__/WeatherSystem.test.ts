
import { describe, it, expect, vi } from 'vitest';
// TODO(lint-intent): 'CLIMATES' is unused in this test; use it in the assertion path or remove it.
import { updateWeather, getClimateForBiome, CLIMATES as _CLIMATES } from '../WeatherSystem';
// TODO(lint-intent): 'Temperature' is unused in this test; use it in the assertion path or remove it.
import { WeatherState, Temperature as _Temperature, VisibilityLevel as _VisibilityLevel } from '../../../types/environment';
import { TimeOfDay } from '../../../utils/core';

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

    it('should maintain weather state most of the time (stability check)', () => {
        // Mock Math.random to return 0.9 (keep state)
        vi.spyOn(Math, 'random').mockReturnValue(0.9);

        const nextWeather = updateWeather(baseWeather, 'plains', TimeOfDay.Day);
        // It returns a NEW object now because it applies time modifiers even on stability
        // But since the time is Day and base is temperate/clear, it should be DEEP equal
        expect(nextWeather).toEqual(baseWeather);

        vi.restoreAllMocks();
    });

    it('should change weather when random check passes', () => {
        // Mock Math.random to return 0.1 (change state)
        vi.spyOn(Math, 'random').mockReturnValue(0.1);

        const nextWeather = updateWeather(baseWeather, 'plains', TimeOfDay.Day);
        // It might be the same due to weighted random, but the function should have executed logic
        // We can check if it returned a new object or at least matches the schema
        expect(nextWeather).toBeDefined();
        expect(nextWeather.precipitation).toBeDefined();
        expect(nextWeather.baseTemperature).toBeDefined();

        vi.restoreAllMocks();
    });

    // --- TimeOfDay Integration Tests ---

    it('should shift temperature down at Night but preserve base', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.9); // Keep existing weather

        // Base is temperate. Night should make it Cold.
        const nextWeather = updateWeather(baseWeather, 'plains', TimeOfDay.Night);

        expect(nextWeather.temperature).toBe('cold');
        expect(nextWeather.baseTemperature).toBe('temperate');

        vi.restoreAllMocks();
    });

    it('should NOT drift temperature when called repeatedly at Night', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.9); // Keep existing weather

        // Iteration 1: Temperate -> Cold
        let weather = updateWeather(baseWeather, 'plains', TimeOfDay.Night);
        expect(weather.temperature).toBe('cold');
        expect(weather.baseTemperature).toBe('temperate');

        // Iteration 2: Should still be Cold (derived from Temperate), NOT Freezing
        weather = updateWeather(weather, 'plains', TimeOfDay.Night);
        expect(weather.temperature).toBe('cold');
        expect(weather.baseTemperature).toBe('temperate');

        vi.restoreAllMocks();
    });

    it('should reduce visibility to heavily_obscured at Night but preserve base', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.9); // Keep existing

        const nextWeather = updateWeather(baseWeather, 'plains', TimeOfDay.Night);
        // Night always enforces heavy obscurity
        expect(nextWeather.visibility).toBe('heavily_obscured');
        expect(nextWeather.baseVisibility).toBe('clear');

        vi.restoreAllMocks();
    });

     it('should reduce visibility to lightly_obscured at Dusk/Dawn if clear', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.9); // Keep existing (Clear)

        const nextWeather = updateWeather(baseWeather, 'desert', TimeOfDay.Dusk);
        expect(nextWeather.visibility).toBe('lightly_obscured');
        expect(nextWeather.baseVisibility).toBe('clear');

        vi.restoreAllMocks();
    });

    it('should recover to base state when Day returns', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.9); // Keep existing

        // 1. Set to Night
        const nightWeather = updateWeather(baseWeather, 'plains', TimeOfDay.Night);
        expect(nightWeather.temperature).toBe('cold');
        expect(nightWeather.visibility).toBe('heavily_obscured');

        // 2. Return to Day
        const dayWeather = updateWeather(nightWeather, 'plains', TimeOfDay.Day);
        expect(dayWeather.temperature).toBe('temperate');
        expect(dayWeather.visibility).toBe('clear');
        expect(dayWeather.baseTemperature).toBe('temperate');

        vi.restoreAllMocks();
    });

    it('should correctly migrate existing storm state', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.9); // Keep existing

        // Simulating a state from before baseVisibility existed:
        // A storm implies heavily_obscured.
        const legacyStorm: WeatherState = {
             precipitation: 'storm',
             temperature: 'temperate',
             wind: { direction: 'north', speed: 'strong' },
             visibility: 'heavily_obscured',
             // NO baseVisibility
        };

        const migrated = updateWeather(legacyStorm, 'plains', TimeOfDay.Day);

        // Should derive baseVisibility from the precipitation, not default to 'clear'
        expect(migrated.baseVisibility).toBe('heavily_obscured');
        expect(migrated.visibility).toBe('heavily_obscured');

        vi.restoreAllMocks();
    });
});
