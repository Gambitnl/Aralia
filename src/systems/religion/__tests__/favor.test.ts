
import { describe, it, expect } from 'vitest';
import { calculateFavorChange, evaluateAction } from '../../../utils/religionUtils';
import { DivineFavor, DeityAction } from '../../../types';

describe('Religion System - Favor', () => {
    const baseFavor: DivineFavor = {
        score: 0,
        rank: 'Neutral',
        consecutiveDaysPrayed: 0,
        history: [],
        blessings: []
    };

    it('should increase favor when an action has positive change', () => {
        const action: DeityAction = {
            id: 'good',
            description: 'Did good thing',
            favorChange: 10
        };

        const result = calculateFavorChange(baseFavor, action);
        expect(result.score).toBe(10);
        expect(result.history).toHaveLength(1);
    });

    it('should decrease favor when an action has negative change', () => {
        const action: DeityAction = {
            id: 'bad',
            description: 'Did bad thing',
            favorChange: -20
        };

        const result = calculateFavorChange(baseFavor, action);
        expect(result.score).toBe(-20);
    });

    it('should clamp favor between -100 and 100', () => {
        const bigAction: DeityAction = {
            id: 'big',
            description: 'Did huge thing',
            favorChange: 200
        };
        const result = calculateFavorChange(baseFavor, bigAction);
        expect(result.score).toBe(100);

        const badAction: DeityAction = {
            id: 'awful',
            description: 'Did terrible thing',
            favorChange: -200
        };
        const result2 = calculateFavorChange(baseFavor, badAction);
        expect(result2.score).toBe(-100);
    });

    it('should evaluate trigger against deity preferences', () => {
        // Bahamut approves PROTECT_WEAK (+2)
        const action = evaluateAction('bahamut', 'PROTECT_WEAK');
        expect(action).not.toBeNull();
        expect(action?.favorChange).toBe(2);
        expect(action?.description).toBe('Protect the innocent from harm');
    });

    it('should return null for irrelevant triggers', () => {
        const action = evaluateAction('bahamut', 'EAT_SANDWICH');
        expect(action).toBeNull();
    });

    it('should evaluate forbiddances correctly', () => {
        // Bahamut forbids HARM_INNOCENT (-10)
        const action = evaluateAction('bahamut', 'HARM_INNOCENT');
        expect(action).not.toBeNull();
        expect(action?.favorChange).toBe(-10);
    });
});
