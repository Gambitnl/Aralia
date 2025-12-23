
import { describe, it, expect } from 'vitest';
import { getStatusVisual, STATUS_VISUALS, DEFAULT_STATUS_VISUAL, getClassVisual, CLASS_VISUALS, DEFAULT_CLASS_VISUAL } from '../visuals';

describe('visuals.ts', () => {
    describe('getStatusVisual', () => {
        // Table-driven test for standard status visuals
        const testCases = [
            { input: 'blinded', expectedId: 'blinded', expectedIcon: '👁️' },
            { input: 'Blinded', expectedId: 'blinded', expectedIcon: '👁️' },
            { input: 'charmed', expectedId: 'charmed', expectedIcon: '💕' },
            { input: 'Poisoned', expectedId: 'poisoned', expectedIcon: '🤢' },
            { input: 'bane', expectedId: 'bane', expectedIcon: '📉' },
            { input: 'Bane', expectedId: 'bane', expectedIcon: '📉' },
        ];

        it.each(testCases)('should return correct spec for "$input"', ({ input, expectedId, expectedIcon }) => {
            const result = getStatusVisual(input);
            expect(result.id).toBe(expectedId);
            expect(result.icon).toBe(expectedIcon);
            // Verify it matches the registry
            expect(result).toBe(STATUS_VISUALS[expectedId]);
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
