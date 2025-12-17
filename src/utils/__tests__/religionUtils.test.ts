
import { describe, it, expect, beforeEach } from 'vitest';
import { initialGameState } from '../../state/appState';
import { canAffordTempleService, modifyFavor, getFavorRank, getServicesForDeity } from '../religionUtils';
import { GameState } from '../../types';
import { DEITIES, TEMPLE_SERVICES } from '../../data/religion';

describe('religionUtils', () => {
    let mockGameState: GameState;

    beforeEach(() => {
        mockGameState = {
            ...initialGameState,
            gold: 100,
            religion: {
                deityFavor: {},
                discoveredDeities: [],
                activeBlessings: [],
            },
            inventory: [],
            questLog: []
        };
    });

    describe('getFavorRank', () => {
        it('should return correct ranks for scores', () => {
            expect(getFavorRank(-60)).toBe('Heretic');
            expect(getFavorRank(-20)).toBe('Shunned');
            expect(getFavorRank(0)).toBe('Neutral');
            expect(getFavorRank(20)).toBe('Initiate');
            expect(getFavorRank(50)).toBe('Devotee');
            expect(getFavorRank(80)).toBe('Champion');
            expect(getFavorRank(98)).toBe('Chosen');
        });
    });

    describe('modifyFavor', () => {
        it('should initialize favor if not present', () => {
            const newState = modifyFavor(mockGameState, 'pelor', 10);
            expect(newState.religion.deityFavor['pelor']).toBeDefined();
            expect(newState.religion.deityFavor['pelor'].score).toBe(10);
            expect(newState.religion.deityFavor['pelor'].rank).toBe('Initiate');
        });

        it('should accumulate favor', () => {
            let state = modifyFavor(mockGameState, 'pelor', 10);
            state = modifyFavor(state, 'pelor', 25);
            expect(state.religion.deityFavor['pelor'].score).toBe(35);
        });

        it('should clamp favor between -100 and 100', () => {
            let state = modifyFavor(mockGameState, 'pelor', 150);
            expect(state.religion.deityFavor['pelor'].score).toBe(100);

            state = modifyFavor(state, 'pelor', -300);
            expect(state.religion.deityFavor['pelor'].score).toBe(-100);
        });

        it('should add to discoveredDeities when favor becomes positive', () => {
            const state = modifyFavor(mockGameState, 'pelor', 5);
            expect(state.religion.discoveredDeities).toContain('pelor');
        });
    });

    describe('canAffordTempleService', () => {
        it('should succeed if requirements met', () => {
            // Pelor service with low cost
            const result = canAffordTempleService(mockGameState, 'pelor', 'healing_word');
            expect(result.success).toBe(true);
        });

        it('should fail if not enough gold', () => {
            mockGameState.gold = 0;
            const result = canAffordTempleService(mockGameState, 'pelor', 'healing_word');
            expect(result.success).toBe(false);
            expect(result.reason).toContain('Not enough gold');
        });

        it('should fail if not enough favor', () => {
            // Strength blessing requires 20 favor
            const result = canAffordTempleService(mockGameState, 'pelor', 'blessing_strength');
            expect(result.success).toBe(false);
            expect(result.reason).toContain('Not enough favor');
        });

        it('should succeed if favor requirement met', () => {
            let state = modifyFavor(mockGameState, 'pelor', 25);
            // Must update mockGameState manually or use the returned state if the function was pure (it is pure, so we need to pass the new state)
            const result = canAffordTempleService(state, 'pelor', 'blessing_strength');
            expect(result.success).toBe(true);
        });
    });

    describe('getServicesForDeity', () => {
        it('should return services based on domains', () => {
             const pelorServices = getServicesForDeity('pelor'); // Life, Light
             const serviceIds = pelorServices.map(s => s.id);

             expect(serviceIds).toContain('healing_word');
             expect(serviceIds).toContain('restoration');
             // Should not contain war blessing
             expect(serviceIds).not.toContain('blessing_strength');
        });

        it('should return war services for war deity', () => {
            const bahamutServices = getServicesForDeity('bahamut'); // Life, War
            const serviceIds = bahamutServices.map(s => s.id);
            expect(serviceIds).toContain('blessing_strength');
        });
    });
});
