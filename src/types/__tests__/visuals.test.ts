
import { describe, it, expect } from 'vitest';
import { lookupConditionVisual, resolveConditionVisual } from '../../utils/visuals/conditionPalette';
import { getStatusVisual, STATUS_VISUALS, DEFAULT_STATUS_VISUAL, getClassVisual, CLASS_VISUALS, DEFAULT_CLASS_VISUAL } from '../visuals';

describe('visuals.ts', () => {
    describe('getStatusVisual', () => {
        // Table-driven test for standard status visuals
        // Taunted and Bane are the only rows STATUS_VISUALS still owns; every
        // condition is served from the shared palette (agora-f821.30).
        const registryCases = [
            { input: 'bane', expectedId: 'bane', expectedIcon: '📉' },
            { input: 'Bane', expectedId: 'bane', expectedIcon: '📉' },
            { input: 'taunted', expectedId: 'taunted', expectedIcon: '🤬' },
        ];

        it.each(registryCases)('should return correct spec for "$input"', ({ input, expectedId, expectedIcon }) => {
            const result = getStatusVisual(input);
            expect(result.id).toBe(expectedId);
            expect(result.icon).toBe(expectedIcon);
            // Verify it matches the registry
            expect(result).toBe(STATUS_VISUALS[expectedId]);
        });

        const conditionCases = [
            { input: 'blinded', expectedId: 'blinded', expectedIcon: '👁️' },
            { input: 'Blinded', expectedId: 'blinded', expectedIcon: '👁️' },
            { input: 'charmed', expectedId: 'charmed', expectedIcon: '💕' },
            { input: 'Poisoned', expectedId: 'poisoned', expectedIcon: '🤢' },
            { input: 'Frozen', expectedId: 'frozen', expectedIcon: '🧊' },
        ];

        it.each(conditionCases)('should delegate "$input" to the condition palette', ({ input, expectedId, expectedIcon }) => {
            const result = getStatusVisual(input);
            expect(result.id).toBe(expectedId);
            // StatusConditionCommand stamps this icon onto every StatusEffect,
            // so a per-condition glyph must survive the move.
            expect(result.icon).toBe(expectedIcon);
            expect(result.color).toBe(resolveConditionVisual(input).chipColor);
            // The condition must NOT have been left behind in this registry.
            expect(STATUS_VISUALS[expectedId]).toBeUndefined();
            // Specs are cached, so identity holds across calls.
            expect(getStatusVisual(input)).toBe(result);
        });

        it('defines no condition color in two files', () => {
            for (const key of Object.keys(STATUS_VISUALS)) {
                expect(lookupConditionVisual(key), `${key} is defined twice`).toBeUndefined();
            }
        });

        it('should return default spec for unknown condition', () => {
            const result = getStatusVisual('NotARealCondition');
            expect(result).toBe(DEFAULT_STATUS_VISUAL);
            expect(result.id).toBe('unknown');
        });

        it('should return default spec for empty string', () => {
            const result = getStatusVisual('');
            expect(result).toBe(DEFAULT_STATUS_VISUAL);
        });
    });

    describe('getClassVisual', () => {
         // Table-driven test for class visuals
         const classTestCases = [
             { input: 'fighter', expectedId: 'fighter', expectedIcon: '⚔️' },
             { input: 'Wizard', expectedId: 'wizard', expectedIcon: '🧙' },
             { input: 'CLERIC', expectedId: 'cleric', expectedIcon: '✝️' },
         ];

         it.each(classTestCases)('should return correct spec for "$input"', ({ input, expectedId, expectedIcon }) => {
            const result = getClassVisual(input);
            expect(result.id).toBe(expectedId);
            expect(result.icon).toBe(expectedIcon);
            expect(result).toBe(CLASS_VISUALS[expectedId]);
         });

          it('should return default spec for unknown class', () => {
            const result = getClassVisual('NotAClass');
            expect(result).toBe(DEFAULT_CLASS_VISUAL);
        });
    });
});
