
import { describe, it, expect, vi } from 'vitest';
import { characterReducer } from '../characterReducer';
import { GameState, Item } from '../../../types';
import { AppAction } from '../../actionTypes';

// Mock ITEMS manually
const ITEMS = {
    'torch': { id: 'torch', name: 'Torch' } as Item
};

// We need a minimal GameState
const mockState: GameState = {
    party: [
        { id: 'c1', name: 'Char1', hp: 10, maxHp: 20 } as any,
        { id: 'c2', name: 'Char2', hp: 5, maxHp: 20 } as any,
    ],
    inventory: [],
    gold: 0,
    // ... other fields irrelevant for this test
} as any;

describe('Character Reducer - New Exploration Actions', () => {
    it('should add item to inventory', () => {
        const action: AppAction = {
            type: 'ADD_ITEM',
            payload: { itemId: 'torch', count: 1 }
        };

        const newState = characterReducer(mockState, action);
        expect(newState.inventory).toHaveLength(1);
        expect(newState.inventory![0].name).toBe('Torch'); // Check name instead of ID
        expect(newState.inventory![0].id).not.toBe('torch'); // Verify ID is regenerated
    });

    it('should add multiple items', () => {
        const action: AppAction = {
            type: 'ADD_ITEM',
            payload: { itemId: 'torch', count: 3 }
        };
        const newState = characterReducer(mockState, action);
        expect(newState.inventory).toHaveLength(3);
    });

    it('should modify party health (damage)', () => {
        const action: AppAction = {
            type: 'MODIFY_PARTY_HEALTH',
            payload: { amount: -2 }
        };
        const newState = characterReducer(mockState, action);
        expect(newState.party![0].hp).toBe(8); // 10 - 2
        expect(newState.party![1].hp).toBe(3); // 5 - 2
    });

    it('should modify party health (heal)', () => {
        const action: AppAction = {
            type: 'MODIFY_PARTY_HEALTH',
            payload: { amount: 5 }
        };
        const newState = characterReducer(mockState, action);
        expect(newState.party![0].hp).toBe(15); // 10 + 5
        expect(newState.party![1].hp).toBe(10); // 5 + 5
    });

    it('should clamp health at maxHp', () => {
        const action: AppAction = {
            type: 'MODIFY_PARTY_HEALTH',
            payload: { amount: 100 }
        };
        const newState = characterReducer(mockState, action);
        expect(newState.party![0].hp).toBe(20);
    });

    it('should clamp health at 0', () => {
        const action: AppAction = {
            type: 'MODIFY_PARTY_HEALTH',
            payload: { amount: -100 }
        };
        const newState = characterReducer(mockState, action);
        expect(newState.party![0].hp).toBe(0);
    });
});
