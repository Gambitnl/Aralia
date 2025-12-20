
import { describe, it, expect } from 'vitest';
import { religionReducer } from '../religionReducer';
import { GameState, DivineFavor } from '../../../types';
import { AppAction } from '../../actionTypes';

describe('religionReducer', () => {
    // Helper to create a minimal valid state
    const createInitialState = (): GameState => ({
        divineFavor: {},
        gold: 100,
        messages: [],
        // ... include other required fields as minimal stubs if necessary
        // Typescript partial matching might be needed if state is huge, but let's try casting
    } as unknown as GameState);

    it('should handle PRAY action', () => {
        const state = createInitialState();
        const action: AppAction = {
            type: 'PRAY',
            payload: { deityId: 'pelor', offering: 0 }
        };

        const result = religionReducer(state, action);
        // The reducer returns partial state, merge it
        const newState = { ...state, ...result };

        expect(newState.divineFavor['pelor']).toBeDefined();
        expect(newState.divineFavor['pelor'].favor).toBe(1); // Default prayer boost
        expect(newState.messages).toHaveLength(1);
        expect(newState.messages[0].text).toContain('You pray to Pelor');
    });

    it('should handle PRAY action with offering', () => {
        const state = createInitialState();
        const action: AppAction = {
            type: 'PRAY',
            payload: { deityId: 'pelor', offering: 20 }
        };

        const result = religionReducer(state, action);
        const newState = { ...state, ...result };

        expect(newState.gold).toBe(80); // 100 - 20
        expect(newState.divineFavor['pelor'].favor).toBe(3); // 1 (base) + 2 (20/10)
    });

    it('should handle TRIGGER_DEITY_ACTION for approval', () => {
        const state = createInitialState();
        // Bahamut approves PROTECT_WEAK (+2)
        const action: AppAction = {
            type: 'TRIGGER_DEITY_ACTION',
            payload: { trigger: 'PROTECT_WEAK' }
        };

        const result = religionReducer(state, action);
        const newState = { ...state, ...result };

        expect(newState.divineFavor['bahamut']).toBeDefined();
        expect(newState.divineFavor['bahamut'].favor).toBe(2);
        // Should not generate message for small change on neutral unless specific logic (here < 5 is silent for Neutral)
        // Wait, logic says: if (existingFavor.rank !== 'Neutral' || Math.abs(change) >= 5)
        // Rank starts Neutral. Change is 2. So no message.
        expect(newState.messages).toHaveLength(0);
    });

    it('should handle TRIGGER_DEITY_ACTION for forbiddance', () => {
        const state = createInitialState();
        // Bahamut forbids HARM_INNOCENT (-10)
        const action: AppAction = {
            type: 'TRIGGER_DEITY_ACTION',
            payload: { trigger: 'HARM_INNOCENT' }
        };

        const result = religionReducer(state, action);
        const newState = { ...state, ...result };

        expect(newState.divineFavor['bahamut']).toBeDefined();
        expect(newState.divineFavor['bahamut'].favor).toBe(-10);
        // Change is >= 5, so message should appear
        expect(newState.messages).toHaveLength(1);
        expect(newState.messages[0].text).toContain('Bahamut loses favor');
    });

    it('should affect multiple deities if applicable', () => {
        const state = createInitialState();
        // Assume 'DESTROY_UNDEAD' is liked by Pelor (+1) and Raven Queen (+3)
        // Note: Check actual data in src/data/deities/index.ts
        // Pelor: DESTROY_UNDEAD (+1)
        // Raven Queen: DESTROY_UNDEAD (+3)

        const action: AppAction = {
            type: 'TRIGGER_DEITY_ACTION',
            payload: { trigger: 'DESTROY_UNDEAD' }
        };

        const result = religionReducer(state, action);
        const newState = { ...state, ...result };

        expect(newState.divineFavor['pelor'].favor).toBe(1);
        expect(newState.divineFavor['raven_queen'].favor).toBe(3);
    });
});
