
import { renderHook, act } from '@testing-library/react';
import { useTurnOrder } from './useTurnOrder';
import { CombatCharacter, CombatAction } from '../../types/combat';
import { describe, it, expect } from 'vitest';

describe('useTurnOrder', () => {
    const mockCharacter1: CombatCharacter = {
        id: 'char1',
        name: 'Hero',
        initiative: 10,
        currentHP: 10,
        stats: { baseInitiative: 0 } as any,
        actionEconomy: {} as any,
    } as CombatCharacter;

    const mockCharacter2: CombatCharacter = {
        id: 'char2',
        name: 'Goblin',
        initiative: 5,
        currentHP: 10,
        stats: { baseInitiative: 0 } as any,
        actionEconomy: {} as any,
    } as CombatCharacter;

    const characters = [mockCharacter1, mockCharacter2];

    it('should initialize turn order correctly', () => {
        const { result } = renderHook(() => useTurnOrder({ characters }));

        // Before initialization
        expect(result.current.turnState.turnOrder).toEqual([]);

        act(() => {
            result.current.initializeTurnOrder(characters);
        });

        expect(result.current.turnState.turnOrder).toEqual(['char1', 'char2']);
        expect(result.current.turnState.currentCharacterId).toBe('char1');
        expect(result.current.turnState.currentTurn).toBe(1);
    });

    it('should advance turns correctly', () => {
        const { result } = renderHook(() => useTurnOrder({ characters }));

        act(() => {
            result.current.initializeTurnOrder(characters);
        });

        // Turn 1, Char 1
        expect(result.current.turnState.currentCharacterId).toBe('char1');

        act(() => {
            const { isNewRound, nextCharacterId } = result.current.advanceTurn();
            expect(isNewRound).toBe(false);
            expect(nextCharacterId).toBe('char2');
        });

        // Turn 1, Char 2
        expect(result.current.turnState.currentCharacterId).toBe('char2');

        act(() => {
            const { isNewRound, nextCharacterId } = result.current.advanceTurn();
            expect(isNewRound).toBe(true);
            expect(nextCharacterId).toBe('char1');
        });

        // Turn 2, Char 1
        expect(result.current.turnState.currentTurn).toBe(2);
        expect(result.current.turnState.currentCharacterId).toBe('char1');
    });

    it('should skip dead characters', () => {
        const deadCharacter = { ...mockCharacter2, currentHP: 0 };
        const updatedCharacters = [mockCharacter1, deadCharacter];

        const { result } = renderHook(() => useTurnOrder({ characters: updatedCharacters }));

        act(() => {
            result.current.initializeTurnOrder(updatedCharacters);
        });

        expect(result.current.turnState.currentCharacterId).toBe('char1');

        act(() => {
            const { nextCharacterId } = result.current.advanceTurn();
            // Should skip char2 (dead) and go back to char1 (next round)
            expect(nextCharacterId).toBe('char1');
        });

         expect(result.current.turnState.currentTurn).toBe(2);
    });

    it('should allow joining turn order', () => {
        const { result } = renderHook(() => useTurnOrder({ characters }));

        act(() => {
            result.current.initializeTurnOrder([mockCharacter1]);
        });

        expect(result.current.turnState.turnOrder).toEqual(['char1']);

        act(() => {
            result.current.joinTurnOrder('char2');
        });

        expect(result.current.turnState.turnOrder).toEqual(['char1', 'char2']);
    });

    it('should record actions', () => {
        const { result } = renderHook(() => useTurnOrder({ characters }));

        act(() => {
            result.current.initializeTurnOrder(characters);
        });

        const mockAction: CombatAction = {
            id: 'action1',
            type: 'move',
            characterId: 'char1',
            cost: { type: 'movement-only' },
            timestamp: 123
        };

        act(() => {
            result.current.recordAction(mockAction);
        });

        expect(result.current.turnState.actionsThisTurn).toContain(mockAction);

        // Verify actions are cleared on turn advance
        act(() => {
            result.current.advanceTurn();
        });

        expect(result.current.turnState.actionsThisTurn).toEqual([]);
    });
});
