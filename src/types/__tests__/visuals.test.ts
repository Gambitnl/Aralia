
import { describe, it, expect } from 'vitest';
import { getStatusVisual, STATUS_VISUALS, DEFAULT_STATUS_VISUAL, getClassVisual, CLASS_VISUALS, DEFAULT_CLASS_VISUAL } from '../visuals';

describe('visuals.ts', () => {
    describe('getStatusVisual', () => {
        it('should return correct spec for known condition id', () => {
            const result = getStatusVisual('blinded');
            expect(result).toBe(STATUS_VISUALS['blinded']);
            expect(result.icon).toBe('👁️');
        });

        it('should return correct spec for known condition id with different case', () => {
             const result = getStatusVisual('Blinded');
             expect(result).toBe(STATUS_VISUALS['blinded']);
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

         // Verify some key entries exist from the migration
        it('should have key entries from statusIcons.ts', () => {
            expect(getStatusVisual('Poisoned').icon).toBe('🤢');
            expect(getStatusVisual('Charmed').icon).toBe('💕');
        });
    });

    describe('getClassVisual', () => {
         it('should return correct spec for known class id', () => {
            const result = getClassVisual('fighter');
            expect(result).toBe(CLASS_VISUALS['fighter']);
            expect(result.icon).toBe('⚔️');
         });

         it('should return correct spec for known class id with different case', () => {
            const result = getClassVisual('Wizard');
            expect(result).toBe(CLASS_VISUALS['wizard']);
         });

          it('should return default spec for unknown class', () => {
            const result = getClassVisual('NotAClass');
            expect(result).toBe(DEFAULT_CLASS_VISUAL);
        });
    });
});
