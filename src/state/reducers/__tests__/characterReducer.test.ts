// TODO(lint-intent): 'vi' is unused in this test; use it in the assertion path or remove it.
import { describe, it, expect, vi as _vi } from 'vitest';
import { characterReducer } from '../characterReducer';
// TODO(lint-intent): 'PlayerCharacter' is unused in this test; use it in the assertion path or remove it.
import { GameState, PlayerCharacter as _PlayerCharacter } from '../../../types';
import { createMockPlayerCharacter } from '../../../utils/factories';

describe('characterReducer', () => {
    // Mock initial state
    const initialState: GameState = {
        party: [
            createMockPlayerCharacter({ id: 'char1', xp: 0, level: 1 })
        ],
        inventory: [],
        gold: 100,
        // ... other state props needed for reducer context if any
        dynamicLocationItemIds: {},
        currentLocationId: 'loc1',
        merchantModal: undefined,
        characterSheetModal: { isOpen: false, character: null },
    } as unknown as GameState;

    it('should handle MODIFY_GOLD', () => {
        const action = { type: 'MODIFY_GOLD', payload: { amount: 50.5 } } as const;
        const newState = characterReducer(initialState, action);
        expect(newState.gold).toBe(150.5);

        const action2 = { type: 'MODIFY_GOLD', payload: { amount: -200 } } as const;
        const newState2 = characterReducer(initialState, action2);
        expect(newState2.gold).toBe(0); // Should clamp to 0
    });

    it('should handle GRANT_EXPERIENCE', () => {
        const action = { type: 'GRANT_EXPERIENCE', payload: { amount: 300 } } as const;
        const newState = characterReducer(initialState, action);

        // At level 1, 300 XP is enough to reach level 2 (cumulative: 1->0, 2->300)
        // Wait, standard 5e: Level 2 at 300 XP.
        // Factory char starts at 0 XP. +300 => 300.
        // applyXpAndHandleLevelUps should trigger level up if logic holds.

        expect(newState.party).toBeDefined();
        if (newState.party) {
             const char = newState.party[0];
             expect(char.xp).toBe(300);
             expect(char.level).toBe(2);
        }
    });
});
