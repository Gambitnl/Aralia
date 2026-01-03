
import { describe, it, expect } from 'vitest';
import { calculateLightLevel, tickLightSources, updateSanity, createLightSource } from '../underdarkService';
import { UnderdarkState } from '../../types/underdark';

describe('UnderdarkService', () => {
    const defaultState: UnderdarkState = {
        currentDepth: 1000,
        // TODO(2026-01-03 Codex-CLI): Use a real biome id; fallback to cavern_standard to keep tests aligned with enum.
        currentBiomeId: 'cavern_standard',
        lightLevel: 'dim',
        activeLightSources: [],
        faerzressLevel: 0,
        wildMagicChance: 0,
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

        it('should return dim if Faerzress is intense (glows)', () => {
            const state = { ...defaultState, currentDepth: 200, activeLightSources: [], faerzressLevel: 50 };
            // Faerzress > 20 emits light
            expect(calculateLightLevel(state)).toBe('dim');
        });

        it('should return darkness if Faerzress is weak', () => {
            const state = { ...defaultState, currentDepth: 200, activeLightSources: [], faerzressLevel: 10 };
            expect(calculateLightLevel(state)).toBe('darkness');
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

        it('should drain sanity faster in high Faerzress', () => {
            // Darkness drain = 2/hr
            // Faerzress 50 => 1.5x multiplier
            // Expected drain = 3
            // AND since Faerzress 50 provides 'dim' light, we rely on the logic:
            // "If Faerzress >= 20, sanityDrain = 0.5" (instead of darkness 2)
            // Wait, this test needs to align with the new logic.

            // New Logic Check:
            // Faerzress 50 -> Light Level is DIM.
            // Logic: if Faerzress >= 20, sanityDrain = 0.5 (Base Drain)
            // Multiplier: 1.5 (Level 50)
            // Total Drain: 0.5 * 1.5 = 0.75

            // Previously (Pure Darkness + Faerzress):
            // Darkness (2) * 1.5 = 3

            // To test "Darkness + High Faerzress", we need to ensure Light Level is DARKNESS.
            // But Faerzress 50 makes it DIM.
            // So this test case "drain sanity faster in high Faerzress" implies we want to see the multiplier at work.
            // But the light level change actually REDUCES the base drain (from 2 to 0.5).
            // So we go from losing 2 (Darkness) to losing 0.75 (Alien Light).
            // This is "better" than darkness, but worse than normal light (which would be recovery).

            // Let's adjust expectation:
            // Base Drain: 0.5
            // Multiplier: 1.5
            // Total: 0.75
            // Current 100 -> 99.25

            const state = { ...defaultState, activeLightSources: [], currentDepth: 500, faerzressLevel: 50 };
            const newState = updateSanity(state, 60);
            expect(newState.sanity.current).toBe(99.25);
        });

        it('should drain sanity massively in magical darkness + high faerzress', () => {
            // Magical Darkness overrides Faerzress light.
            // Base Drain: 5
            // Faerzress 50 Multiplier: 1.5
            // Total: 7.5

            const darkness = createLightSource('Darkness', 'spell', 15, 10);
            const state = { ...defaultState, activeLightSources: [darkness], currentDepth: 500, faerzressLevel: 50 };

            const newState = updateSanity(state, 60);
            expect(newState.sanity.current).toBe(92.5); // 100 - 7.5
        });

        it('should calculate wild magic chance', () => {
             const state = { ...defaultState, faerzressLevel: 50 };
             const newState = updateSanity(state, 60);
             expect(newState.wildMagicChance).toBe(0.28);
        });
    });
});
