
import { describe, it, expect } from 'vitest';
import { UnderdarkMechanics } from '../UnderdarkMechanics';
import { GameState, UnderdarkState, LightSource } from '../../../types';
import { initialGameState } from '../../../state/appState';

describe('UnderdarkMechanics', () => {

    // Helper to create a clean state with specific underdark settings
    const createTestState = (underdarkOverrides: Partial<UnderdarkState>): GameState => {
        return {
            ...initialGameState,
            underdark: {
                ...initialGameState.underdark,
                ...underdarkOverrides
            },
            gameTime: new Date('2025-01-01T12:00:00Z') // Fixed time
        };
    };

    it('should consume light source duration', () => {
        const torch: LightSource = {
            id: 'torch1',
            type: 'torch',
            name: 'Torch',
            radius: 20,
            durationRemaining: 60, // 60 minutes
            isActive: true
        };

        const state = createTestState({
            activeLightSources: [torch],
            currentDepth: 100 // Must be in underdark for some logic, though consumption happens regardless
        });

        // Advance 30 minutes (1800 seconds)
        const result = UnderdarkMechanics.processTime(state, 1800);

        expect(result.underdark.activeLightSources[0].durationRemaining).toBe(30);
        expect(result.messages.length).toBe(0);
    });

    it('should remove expired light sources and log a message', () => {
        const torch: LightSource = {
            id: 'torch1',
            type: 'torch',
            name: 'Torch',
            radius: 20,
            durationRemaining: 10, // 10 minutes
            isActive: true
        };

        const state = createTestState({
            activeLightSources: [torch],
            currentDepth: 100
        });

        // Advance 20 minutes (1200 seconds) - Torch should die
        const result = UnderdarkMechanics.processTime(state, 1200);

        expect(result.underdark.activeLightSources.length).toBe(0);
        expect(result.messages.length).toBeGreaterThan(0);
        expect(result.messages[0].text).toContain('flickers and dies');
    });

    it('should set light level to darkness when no sources remain in Underdark', () => {
        const state = createTestState({
            activeLightSources: [],
            currentDepth: 100, // In Underdark
            lightLevel: 'bright' // Start bright (maybe from previous source)
        });

        const result = UnderdarkMechanics.processTime(state, 60);

        expect(result.underdark.lightLevel).toBe('darkness');
    });

    it('should NOT reduce sanity if in bright light', () => {
        // Need an active light source to keep it bright, otherwise processTime sets it to darkness
        const torch: LightSource = {
            id: 'torch1',
            type: 'torch',
            name: 'Torch',
            radius: 20,
            durationRemaining: 600, // Long lasting
            isActive: true
        };

        const state = createTestState({
            activeLightSources: [torch],
            currentDepth: 100,
            lightLevel: 'bright',
            sanity: { current: 100, max: 100, madnessLevel: 0 }
        });

        const result = UnderdarkMechanics.processTime(state, 3600); // 1 hour

        expect(result.underdark.sanity.current).toBe(100);
    });

    it('should reduce sanity if in darkness', () => {
        const state = createTestState({
            currentDepth: 100,
            lightLevel: 'darkness',
            sanity: { current: 100, max: 100, madnessLevel: 0 }
        });

        // 1 hour of darkness = 2 sanity loss (1 per 30 mins)
        const result = UnderdarkMechanics.processTime(state, 3600);

        expect(result.underdark.sanity.current).toBe(98);
    });

    it('should increase madness level when sanity drops below threshold', () => {
        const state = createTestState({
            currentDepth: 100,
            lightLevel: 'darkness',
            sanity: { current: 26, max: 100, madnessLevel: 0 } // Just above 25%
        });

        // Drop enough to cross 25% threshold (need to lose > 1 point)
        // 1 hour = -2 points -> 24 (which is < 25)
        const result = UnderdarkMechanics.processTime(state, 3600);

        expect(result.underdark.sanity.current).toBe(24);
        expect(result.underdark.sanity.madnessLevel).toBe(3); // Highest madness
        expect(result.messages.length).toBeGreaterThan(0);
        expect(result.messages[0].text).toContain('darkness presses against your mind');
    });
});
