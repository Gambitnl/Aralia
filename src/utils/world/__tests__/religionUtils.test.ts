
import { describe, it, expect, vi } from 'vitest';
import {
    calculateFavorChange,
    getDivineStanding,
    canAffordService,
    // TODO(lint-intent): 'getDeity' is unused in this test; use it in the assertion path or remove it.
    getDeity as _getDeity,
    evaluateAction,
    grantBlessing
} from '../religionUtils';
import { DivineFavor, DeityAction, TempleService, Blessing } from '../../types';

// Mock the DEITIES data to prevent dependency on actual data file changes
vi.mock('../../data/deities', () => ({
    DEITIES: [
        {
            id: 'test_god',
            name: 'Test God',
            approves: [
                { trigger: 'GOOD_ACT', description: 'Did good', favorChange: 5 }
            ],
            forbids: [
                { trigger: 'BAD_ACT', description: 'Did bad', favorChange: -5 }
            ]
        }
    ]
}));

describe('religionUtils', () => {
    describe('calculateFavorChange', () => {
        const baseFavor: DivineFavor = {
            deityId: 'test_god',
            favor: 0,
            history: [],
            blessings: [],
            transgressions: []
        };

        it('should add favor correctly', () => {
            const action: DeityAction = { description: 'Good deed', favorChange: 10 };
            const result = calculateFavorChange(baseFavor, action);
            expect(result.favor).toBe(10);
            expect(result.history).toHaveLength(1);
        });

        it('should subtract favor correctly', () => {
            const action: DeityAction = { description: 'Bad deed', favorChange: -10 };
            const result = calculateFavorChange(baseFavor, action);
            expect(result.favor).toBe(-10);
        });

        it('should clamp favor at 100', () => {
            const highFavor = { ...baseFavor, favor: 95 };
            const action: DeityAction = { description: 'Great deed', favorChange: 10 };
            const result = calculateFavorChange(highFavor, action);
            expect(result.favor).toBe(100);
        });

        it('should clamp favor at -100', () => {
            const lowFavor = { ...baseFavor, favor: -95 };
            const action: DeityAction = { description: 'Terrible deed', favorChange: -10 };
            const result = calculateFavorChange(lowFavor, action);
            expect(result.favor).toBe(-100);
        });
    });

    describe('grantBlessing', () => {
        const baseFavor: DivineFavor = {
            deityId: 'test_god',
            favor: 50,
            history: [],
            blessings: [],
            transgressions: []
        };

        it('should add a blessing', () => {
            const blessing: Blessing = {
                id: 'b1',
                name: 'Blessing 1',
                description: 'A blessing',
                effectType: 'buff'
            };
            const result = grantBlessing(baseFavor, blessing);
            expect(result.blessings).toHaveLength(1);
            expect(result.blessings[0].id).toBe('b1');
        });
    });

    describe('evaluateAction', () => {
        it('should return correct action for approved trigger', () => {
            const result = evaluateAction('test_god', 'GOOD_ACT');
            expect(result).toEqual({
                description: 'Did good',
                favorChange: 5
            });
        });

        it('should return correct action for forbidden trigger', () => {
            const result = evaluateAction('test_god', 'BAD_ACT');
            expect(result).toEqual({
                description: 'Did bad',
                favorChange: -5
            });
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
            mechanicalEffect: 'heal_hp'
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
