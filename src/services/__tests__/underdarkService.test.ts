
import { describe, it, expect } from 'vitest';
import { calculateLightLevel, tickLightSources, updateSanity, createLightSource } from '../underdarkService';
import { UnderdarkState } from '../../types/underdark';

describe('UnderdarkService', () => {
    const defaultState: UnderdarkState = {
        currentDepth: 1000,
        lightLevel: 'dim',
        activeLightSources: [],
        sanity: { current: 100, max: 100, madnessLevel: 0 }
    };

    describe('calculateLightLevel', () => {
        it('should return bright for surface (depth 0)', () => {
            const state = { ...defaultState, currentDepth: 0 };
            expect(calculateLightLevel(state)).toBe('bright');
        });

        it('should return darkness for deep underground with no lights', () => {
            const state = { ...defaultState, currentDepth: 200, activeLightSources: [] };
            expect(calculateLightLevel(state)).toBe('darkness');
        });

        it('should return bright if a torch is active', () => {
            const torch = createLightSource('Torch', 'torch', 20, 60);
            const state = { ...defaultState, activeLightSources: [torch] };
            expect(calculateLightLevel(state)).toBe('bright');
        });

        it('should return magical_darkness if Darkness spell is active', () => {
            const darkness = createLightSource('Darkness', 'spell', 15, 10);
            const torch = createLightSource('Torch', 'torch', 20, 60);
            const state = { ...defaultState, activeLightSources: [torch, darkness] };
            expect(calculateLightLevel(state)).toBe('magical_darkness');
        });
    });

    describe('tickLightSources', () => {
        it('should reduce duration of active sources', () => {
            const torch = createLightSource('Torch', 'torch', 20, 60);
            const state = { ...defaultState, activeLightSources: [torch] };

            const newState = tickLightSources(state, 10);
            expect(newState.activeLightSources[0].durationRemaining).toBe(50);
        });

        it('should deactivate sources when duration hits 0', () => {
            const torch = createLightSource('Torch', 'torch', 20, 10);
            const state = { ...defaultState, activeLightSources: [torch] };

            const newState = tickLightSources(state, 15);
            expect(newState.activeLightSources[0].durationRemaining).toBe(0);
            expect(newState.activeLightSources[0].isActive).toBe(false);
        });
    });

    describe('updateSanity', () => {
        it('should drain sanity in darkness', () => {
            // Ensure calculateLightLevel returns 'darkness'
            const state = { ...defaultState, activeLightSources: [], currentDepth: 500 };

            // 60 minutes in darkness = 2 sanity loss
            const newState = updateSanity(state, 60);
            expect(newState.sanity.current).toBe(98);
        });

        it('should increase madness level as sanity drops', () => {
            const state = { ...defaultState, activeLightSources: [], currentDepth: 500, sanity: { current: 21, max: 100, madnessLevel: 1 } };

            // Drop below 20
            // 2 sanity loss per hour. Need to lose > 1.
            const newState = updateSanity(state, 60); // 21 - 2 = 19
            expect(newState.sanity.current).toBe(19);
            expect(newState.sanity.madnessLevel).toBe(3);
        });
    });
});
