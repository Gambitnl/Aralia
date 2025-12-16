
import { describe, it, expect } from 'vitest';
import { religionReducer } from '../religionReducer';
import { GameState, GamePhase } from '../../../types';
import { initialGameState } from '../../appState';

describe('religionReducer', () => {
    it('should increase favor when PRAY action is dispatched', () => {
        const initialState: GameState = {
            ...initialGameState,
            gold: 100,
            divineFavor: {
                bahamut: { deityId: 'bahamut', favor: 0, history: [] }
            }
        };

        const action: any = {
            type: 'PRAY',
            payload: { deityId: 'bahamut', offering: 50 }
        };

        const newState = religionReducer(initialState, action);

        expect(newState.divineFavor).toBeDefined();
        expect(newState.divineFavor!['bahamut'].favor).toBeGreaterThan(0);
        // Base 1 + (50/10) = 6
        expect(newState.divineFavor!['bahamut'].favor).toBe(6);
        expect(newState.gold).toBe(50);
        expect(newState.messages).toHaveLength(initialState.messages.length + 1);
    });

    it('should ignore invalid deity', () => {
        const initialState: GameState = { ...initialGameState };
        const action: any = {
            type: 'PRAY',
            payload: { deityId: 'invalid_god' }
        };
        const newState = religionReducer(initialState, action);
        expect(newState).toEqual({});
    });
});
