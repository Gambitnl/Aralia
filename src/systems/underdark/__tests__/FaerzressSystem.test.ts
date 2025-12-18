
import { describe, it, expect } from 'vitest';
import { FaerzressSystem } from '../FaerzressSystem';

describe('FaerzressSystem', () => {
    describe('calculateWildMagicChance', () => {
        it('returns 0 for no Faerzress', () => {
            expect(FaerzressSystem.calculateWildMagicChance(0)).toBe(0);
        });

        it('returns base chance for low Faerzress', () => {
            // 0.05 + (1 / 100) * 0.45 = 0.05 + 0.0045 = 0.0545 -> 0.05
            expect(FaerzressSystem.calculateWildMagicChance(1)).toBe(0.05);
        });

        it('returns high chance for max Faerzress', () => {
            // 100 level: 0.05 + 0.45 = 0.50
            expect(FaerzressSystem.calculateWildMagicChance(100)).toBe(0.50);
        });

        it('scales linearly', () => {
            // 50 level: 0.05 + (0.5 * 0.45) = 0.05 + 0.225 = 0.275 -> 0.28
            expect(FaerzressSystem.calculateWildMagicChance(50)).toBe(0.28);
        });
    });

    describe('emitsLight', () => {
        it('returns false for low levels', () => {
            expect(FaerzressSystem.emitsLight(0)).toBe(false);
            expect(FaerzressSystem.emitsLight(19)).toBe(false);
        });

        it('returns true for high levels', () => {
            expect(FaerzressSystem.emitsLight(20)).toBe(true);
            expect(FaerzressSystem.emitsLight(100)).toBe(true);
        });
    });

    describe('getSanityDrainMultiplier', () => {
        it('returns 1 for no Faerzress', () => {
            expect(FaerzressSystem.getSanityDrainMultiplier(0)).toBe(1);
        });

        it('returns 1.5 for 50 Faerzress', () => {
            expect(FaerzressSystem.getSanityDrainMultiplier(50)).toBe(1.5);
        });

        it('returns 2 for 100 Faerzress', () => {
            expect(FaerzressSystem.getSanityDrainMultiplier(100)).toBe(2);
        });
    });

    describe('getTeleportationStatus', () => {
        it('returns safe for low levels', () => {
            expect(FaerzressSystem.getTeleportationStatus(5)).toBe('safe');
        });

        it('returns risky for medium levels', () => {
            expect(FaerzressSystem.getTeleportationStatus(20)).toBe('risky');
            expect(FaerzressSystem.getTeleportationStatus(79)).toBe('risky');
        });

        it('returns blocked for high levels', () => {
            expect(FaerzressSystem.getTeleportationStatus(80)).toBe('blocked');
            expect(FaerzressSystem.getTeleportationStatus(100)).toBe('blocked');
        });
    });
});
