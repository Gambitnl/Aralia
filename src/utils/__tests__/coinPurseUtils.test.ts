import { describe, expect, it } from 'vitest';
import { gpToCoins, coinsToGp, formatCoins, formatGpAsCoins } from '../coinPurseUtils';

describe('coinPurseUtils', () => {
    describe('gpToCoins', () => {
        it('converts whole GP values', () => {
            expect(gpToCoins(5)).toEqual({ pp: 0, gp: 5, sp: 0, cp: 0 });
        });

        it('converts to platinum for large values', () => {
            expect(gpToCoins(25)).toEqual({ pp: 2, gp: 5, sp: 0, cp: 0 });
            expect(gpToCoins(100)).toEqual({ pp: 10, gp: 0, sp: 0, cp: 0 });
        });

        it('handles silver pieces', () => {
            expect(gpToCoins(2.5)).toEqual({ pp: 0, gp: 2, sp: 5, cp: 0 });
            expect(gpToCoins(0.3)).toEqual({ pp: 0, gp: 0, sp: 3, cp: 0 });
        });

        it('handles copper pieces', () => {
            expect(gpToCoins(0.01)).toEqual({ pp: 0, gp: 0, sp: 0, cp: 1 });
            expect(gpToCoins(0.05)).toEqual({ pp: 0, gp: 0, sp: 0, cp: 5 });
        });

        it('handles mixed denominations', () => {
            // 12.34 GP = 1 PP (10 GP) + 2 GP + 3 SP (0.3 GP) + 4 CP (0.04 GP)
            expect(gpToCoins(12.34)).toEqual({ pp: 1, gp: 2, sp: 3, cp: 4 });
        });

        it('handles zero', () => {
            expect(gpToCoins(0)).toEqual({ pp: 0, gp: 0, sp: 0, cp: 0 });
        });

        it('handles typical item prices', () => {
            // Torch: 1 CP
            expect(gpToCoins(0.01)).toEqual({ pp: 0, gp: 0, sp: 0, cp: 1 });
            // Rations: 5 SP
            expect(gpToCoins(0.5)).toEqual({ pp: 0, gp: 0, sp: 5, cp: 0 });
            // Longsword: 15 GP
            expect(gpToCoins(15)).toEqual({ pp: 1, gp: 5, sp: 0, cp: 0 });
            // Plate Armor: 1500 GP
            expect(gpToCoins(1500)).toEqual({ pp: 150, gp: 0, sp: 0, cp: 0 });
        });
    });

    describe('coinsToGp', () => {
        it('converts coins back to GP', () => {
            expect(coinsToGp({ pp: 1, gp: 2, sp: 3, cp: 4 })).toBeCloseTo(12.34);
            expect(coinsToGp({ pp: 0, gp: 5, sp: 0, cp: 0 })).toBe(5);
            expect(coinsToGp({ pp: 0, gp: 0, sp: 0, cp: 1 })).toBeCloseTo(0.01);
        });
    });

    describe('formatCoins', () => {
        it('formats non-zero denominations only', () => {
            expect(formatCoins({ pp: 0, gp: 5, sp: 0, cp: 0 })).toBe('5 GP');
            expect(formatCoins({ pp: 1, gp: 2, sp: 3, cp: 4 })).toBe('1 PP, 2 GP, 3 SP, 4 CP');
            expect(formatCoins({ pp: 0, gp: 0, sp: 5, cp: 3 })).toBe('5 SP, 3 CP');
        });

        it('handles compact mode', () => {
            expect(formatCoins({ pp: 1, gp: 2, sp: 3, cp: 4 }, { compact: true })).toBe('1PP 2GP 3SP 4CP');
        });

        it('handles zero value', () => {
            expect(formatCoins({ pp: 0, gp: 0, sp: 0, cp: 0 })).toBe('0 GP');
        });
    });

    describe('formatGpAsCoins', () => {
        it('formats GP value as coin string', () => {
            expect(formatGpAsCoins(0.01)).toBe('1 CP');
            expect(formatGpAsCoins(0.5)).toBe('5 SP');
            expect(formatGpAsCoins(5)).toBe('5 GP');
            expect(formatGpAsCoins(15)).toBe('1 PP, 5 GP');
            expect(formatGpAsCoins(12.34)).toBe('1 PP, 2 GP, 3 SP, 4 CP');
        });

        it('formats in compact mode', () => {
            expect(formatGpAsCoins(12.34, { compact: true })).toBe('1PP 2GP 3SP 4CP');
        });
    });
});
