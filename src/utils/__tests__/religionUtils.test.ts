
import { describe, it, expect, vi } from 'vitest';
import {
    calculateFavorChange,
    getDivineStanding,
    evaluateAction,
    canAffordService
} from '../religionUtils';
import { DivineFavor, TempleService } from '../../types';

// Mock the DEITIES data to prevent dependency on actual data file changes
vi.mock('../../data/deities', () => ({
    DEITIES: [
        {
            id: 'test_god',
            name: 'Test God',
            titles: ['The Tester'],
            domains: ['Life'],
            alignment: 'Neutral Good',
            symbol: 'A Test Tube',
            description: 'God of Tests',
            commandments: ['Test everything'],
            approves: [
                { trigger: 'GOOD_ACT', description: 'Did good', favorChange: 5 }
            ],
            forbids: [
                { trigger: 'BAD_ACT', description: 'Did bad', favorChange: -5 }
            ],
            relationships: []
        }
    ]
}));

describe('religionUtils', () => {
    describe('calculateFavorChange', () => {
        const baseFavor: DivineFavor = {
            score: 0,
            rank: 'Neutral',
            consecutiveDaysPrayed: 0
        };

        it('should add favor correctly', () => {
            const action = { description: 'Good deed', favorChange: 10 };
            const result = calculateFavorChange(baseFavor, action);
            expect(result.score).toBe(10);
            expect(result.rank).toBe('Initiate'); // 10 is Initiate
        });

        it('should subtract favor correctly', () => {
            const action = { description: 'Bad deed', favorChange: -20 };
            const result = calculateFavorChange(baseFavor, action);
            expect(result.score).toBe(-20);
            expect(result.rank).toBe('Shunned'); // -20 is Shunned
        });

        it('should clamp favor at 100', () => {
            const highFavor = { ...baseFavor, score: 95 };
            const action = { description: 'Great deed', favorChange: 10 };
            const result = calculateFavorChange(highFavor, action);
            expect(result.score).toBe(100);
            expect(result.rank).toBe('Chosen');
        });

        it('should clamp favor at -100', () => {
            const lowFavor = { ...baseFavor, score: -95 };
            const action = { description: 'Terrible deed', favorChange: -10 };
            const result = calculateFavorChange(lowFavor, action);
            expect(result.score).toBe(-100);
            expect(result.rank).toBe('Heretic');
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
    });

    describe('getDivineStanding', () => {
        it('should return correct standings', () => {
            expect(getDivineStanding(95)).toBe('Chosen');
            expect(getDivineStanding(50)).toBe('Champion');
            expect(getDivineStanding(25)).toBe('Devotee');
            expect(getDivineStanding(10)).toBe('Initiate');
            expect(getDivineStanding(0)).toBe('Neutral');
            expect(getDivineStanding(-20)).toBe('Shunned');
            expect(getDivineStanding(-95)).toBe('Heretic');
        });
    });

    describe('canAffordService', () => {
        const service: TempleService = {
            id: 'healing',
            name: 'Healing',
            description: 'Heals HP',
            requirement: {
                goldCost: 50,
                minFavor: 10
            },
            effect: { type: 'heal' }
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
