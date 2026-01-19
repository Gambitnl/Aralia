
import { describe, it, expect, vi } from 'vitest';
import {
    calculateFavorChange,
    getDivineStanding,
    canAffordService,
    evaluateAction,
    grantBlessing
} from '../religionUtils';
import { DivineFavor, DeityAction, TempleService, Blessing } from '../../../types';

// Mock the DEITIES data to prevent dependency on actual data file changes.
// NOTE: Path matches the import specifier used by religionUtils.
vi.mock('../../../data/deities', () => ({
    DEITIES: [
        {
            id: 'test_god',
            name: 'Test God',
            approves: [
                { trigger: 'GOOD_ACT', description: 'Did good', favorChange: 5, id: 'GOOD_ACT' }
            ],
            forbids: [
                { trigger: 'BAD_ACT', description: 'Did bad', favorChange: -5, id: 'BAD_ACT' }
            ]
        }
    ]
}));

describe('religionUtils', () => {
    describe('calculateFavorChange', () => {
        const baseFavor: DivineFavor = {
            score: 0,
            rank: 'Neutral',
            consecutiveDaysPrayed: 0,
            history: [],
            blessings: []
        };

        it('should add favor correctly', () => {
            const action: DeityAction = { id: 'act-1', description: 'Good deed', favorChange: 10 };
            const result = calculateFavorChange(baseFavor, action);
            expect(result.score).toBe(10);
            expect(result.history).toHaveLength(1);
        });

        it('should subtract favor correctly', () => {
            const action: DeityAction = { id: 'act-2', description: 'Bad deed', favorChange: -10 };
            const result = calculateFavorChange(baseFavor, action);
            expect(result.score).toBe(-10);
        });

        it('should clamp favor at 100', () => {
            const highFavor = { ...baseFavor, score: 95 };
            const action: DeityAction = { id: 'act-3', description: 'Great deed', favorChange: 10 };
            const result = calculateFavorChange(highFavor, action);
            expect(result.score).toBe(100);
        });

        it('should clamp favor at -100', () => {
            const lowFavor = { ...baseFavor, score: -95 };
            const action: DeityAction = { id: 'act-4', description: 'Terrible deed', favorChange: -10 };
            const result = calculateFavorChange(lowFavor, action);
            expect(result.score).toBe(-100);
        });
    });

    describe('grantBlessing', () => {
        const baseFavor: DivineFavor = {
            score: 50,
            rank: 'Devotee',
            consecutiveDaysPrayed: 5,
            history: [],
            blessings: []
        };

        it('should add a blessing', () => {
            const blessing: Blessing = {
                id: 'b1',
                name: 'Blessing 1',
                description: 'A blessing',
                effect: { type: 'stat_bonus', stat: 'Strength', value: 1 }
            };
            const result = grantBlessing(baseFavor, blessing);
            expect(result.blessings).toHaveLength(1);
            expect(result.blessings[0].id).toBe('b1');
        });
    });

    describe('evaluateAction', () => {
        it('should return correct action for approved trigger', () => {
            const result = evaluateAction('test_god', 'GOOD_ACT');
            // Action IDs are namespaced by deity + trigger for traceability.
            expect(result).toMatchObject({
                description: 'Did good',
                favorChange: 5
            });
            expect(result?.id).toBe('test_god_approve_GOOD_ACT');
        });

        it('should return correct action for forbidden trigger', () => {
            const result = evaluateAction('test_god', 'BAD_ACT');
            // Action IDs are namespaced by deity + trigger for traceability.
            expect(result).toMatchObject({
                description: 'Did bad',
                favorChange: -5
            });
            expect(result?.id).toBe('test_god_forbid_BAD_ACT');
        });

        it('should return null for unknown trigger', () => {
            const result = evaluateAction('test_god', 'NEUTRAL_ACT');
            expect(result).toBeNull();
        });

        it('should return null for unknown deity', () => {
            const result = evaluateAction('unknown_god', 'GOOD_ACT');
            expect(result).toBeNull();
        });
    });

    describe('getDivineStanding', () => {
        it('should return correct standings', () => {
            expect(getDivineStanding(95)).toBe('Chosen');
            expect(getDivineStanding(50)).toBe('Devout');
            expect(getDivineStanding(10)).toBe('Follower');
            expect(getDivineStanding(0)).toBe('Neutral');
            expect(getDivineStanding(-20)).toBe('Unfavored');
            expect(getDivineStanding(-60)).toBe('Shunned');
            expect(getDivineStanding(-95)).toBe('Enemy of the Faith');
        });
    });

    describe('canAffordService', () => {
        const service: TempleService = {
            id: 'healing',
            name: 'Healing',
            description: 'Heals HP',
            costGp: 50,
            minFavor: 10,
            effect: { type: 'heal', value: 50 }
        };

        it('should return true if affordable and favor met', () => {
            expect(canAffordService(service, 100, 20).allowed).toBe(true);
        });

        it('should return false if insufficient gold', () => {
            expect(canAffordService(service, 40, 20).allowed).toBe(false);
        });

        it('should return false if insufficient favor', () => {
            expect(canAffordService(service, 100, 0).allowed).toBe(false);
        });
    });
});
