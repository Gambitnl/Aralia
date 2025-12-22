
import { describe, it, expect } from 'vitest';
import { calculatePassiveScore } from '../statUtils';

describe('statUtils', () => {
    describe('calculatePassiveScore', () => {
        it('calculates basic passive score (10 + Mod)', () => {
            // Mod: +3
            // 10 + 3 = 13
            expect(calculatePassiveScore(3)).toBe(13);
        });

        it('includes proficiency bonus if provided', () => {
            // Mod: +2, Prof: +2
            // 10 + 2 + 2 = 14
            expect(calculatePassiveScore(2, 2)).toBe(14);
        });

        it('adds +5 for advantage', () => {
            // Mod: +1, Prof: 0, Adv
            // 10 + 1 + 5 = 16
            expect(calculatePassiveScore(1, 0, 'advantage')).toBe(16);
        });

        it('subtracts 5 for disadvantage', () => {
            // Mod: +1, Prof: 0, Dis
            // 10 + 1 - 5 = 6
            expect(calculatePassiveScore(1, 0, 'disadvantage')).toBe(6);
        });

        it('handles complex case (Mod + Prof + Disadvantage)', () => {
            // Mod: +4, Prof: +3, Dis (-5)
            // 10 + 4 + 3 - 5 = 12
            expect(calculatePassiveScore(4, 3, 'disadvantage')).toBe(12);
        });
    });
});
