
import { describe, it, expect } from 'vitest';
import {
    calculateFavorChange,
    getDivineStanding,
    canAffordService
} from '../religionUtils';
import { DivineFavor, DeityAction, TempleService } from '../../types';

describe('religionUtils', () => {
    describe('calculateFavorChange', () => {
        it('should correctly add positive favor', () => {
            const initialFavor: DivineFavor = { deityId: 'test', favor: 0, history: [] };
            const action: DeityAction = { id: 'pray', description: 'Pray', domain: 'social', favorChange: 10 };
            const result = calculateFavorChange(initialFavor, action);
            expect(result.favor).toBe(10);
            expect(result.history).toHaveLength(1);
        });

        it('should clamp favor at 100', () => {
            const initialFavor: DivineFavor = { deityId: 'test', favor: 95, history: [] };
            const action: DeityAction = { id: 'heroic', description: 'Heroism', domain: 'combat', favorChange: 20 };
            const result = calculateFavorChange(initialFavor, action);
            expect(result.favor).toBe(100);
        });

        it('should clamp favor at -100', () => {
            const initialFavor: DivineFavor = { deityId: 'test', favor: -90, history: [] };
            const action: DeityAction = { id: 'sin', description: 'Sin', domain: 'social', favorChange: -20 };
            const result = calculateFavorChange(initialFavor, action);
            expect(result.favor).toBe(-100);
        });
    });

    describe('getDivineStanding', () => {
        it('should return correct standings', () => {
            expect(getDivineStanding(100)).toBe('Chosen');
            expect(getDivineStanding(50)).toBe('Devout');
            expect(getDivineStanding(0)).toBe('Neutral');
            expect(getDivineStanding(-100)).toBe('Enemy of the Faith');
        });
    });

    describe('canAffordService', () => {
        const service: TempleService = {
            id: 'heal',
            name: 'Healing',
            description: 'Heals HP',
            costGp: 50,
            minFavor: 10
        };

        it('should allow if requirements met', () => {
            const result = canAffordService(service, 100, 20);
            expect(result.allowed).toBe(true);
        });

        it('should fail if not enough gold', () => {
            const result = canAffordService(service, 10, 20);
            expect(result.allowed).toBe(false);
            expect(result.reason).toBe('Insufficient gold.');
        });

        it('should fail if favor too low', () => {
            const result = canAffordService(service, 100, 0);
            expect(result.allowed).toBe(false);
            expect(result.reason).toBe('Insufficient divine favor.');
        });
    });
});
