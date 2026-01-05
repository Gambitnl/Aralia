import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { useTurnManager } from '../../../hooks/combat/useTurnManager';
import { renderHook, act } from '@testing-library/react';
import { CombatCharacter, StatusEffect } from '../../../types/combat';
import { rollSavingThrow } from '../../../utils/savingThrowUtils';
import { createMockCombatCharacter } from '../../../utils/factories';

// Mock dependencies
vi.mock('../../../utils/savingThrowUtils', () => ({
    rollSavingThrow: vi.fn(),
    calculateSpellDC: vi.fn(() => 15) // Default DC
}));

vi.mock('../../../utils/combatUtils', () => ({
    // TODO(lint-intent): 'val' is unused in this test; use it in the assertion path or remove it.
    createDamageNumber: vi.fn((_val) => ({ id: 'dmg-1', duration: 1000 })),
    generateId: vi.fn(() => 'id_123'),
    getActionMessage: vi.fn(),
    rollDice: vi.fn(() => 5)
}));

vi.mock('../../../hooks/combat/useActionEconomy', () => ({
    useActionEconomy: () => ({
        canAfford: vi.fn(() => true),
        consumeAction: vi.fn()
    })
}));

vi.mock('../../../hooks/combat/useCombatAI', () => ({
    useCombatAI: () => { }
}));

describe('TurnManager Repeat Saves', () => {
    let character: CombatCharacter;
    // Was using tuple-style Mock generics; updated to function signatures to match vitest Mock type.
    let mockOnCharacterUpdate: Mock<(character: CombatCharacter) => void>;
    let mockOnLogEntry: Mock<(entry: unknown) => void>;
    const makeSaveResult = (success: boolean, total: number) => ({
        success,
        roll: total,
        total,
        dc: 15,
        natural20: false,
        natural1: false
    });

    beforeEach(() => {
        mockOnCharacterUpdate = vi.fn();
        mockOnLogEntry = vi.fn();
        character = createMockCombatCharacter({
            id: 'char-1',
            name: 'Test Char',
            team: 'player'
        });
    });

    it('should trigger repeat save at end of turn', () => {
        // Add effect with turn_end repeat save
        const effect: StatusEffect = {
            id: 'eff-1',
            name: 'Laughing',
            type: 'debuff',
            duration: 10,
            effect: { type: 'condition' },
            repeatSave: {
                timing: 'turn_end',
                saveType: 'Wisdom',
                dc: 15,
                successEnds: true
            }
        } as unknown as StatusEffect;
        character.statusEffects = [effect];

        // Mock successful save BEFORE rendering hook
        // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
        vi.mocked(rollSavingThrow).mockReturnValue(makeSaveResult(true, 16));

        const { result } = renderHook(() => useTurnManager({
            characters: [character],
            mapData: null,
            onCharacterUpdate: mockOnCharacterUpdate,
            onLogEntry: mockOnLogEntry
        }));

        // Start turn logic is internal, but endTurn triggers processEndOfTurnEffects
        // Set current character to char-1
        act(() => {
            // Initialize combat sets up turn order
            result.current.initializeCombat([character]);
        });

        act(() => {
            result.current.endTurn();
        });

        // Verify state update via callback
        expect(mockOnCharacterUpdate).toHaveBeenCalled();
        const lastCallArgs = mockOnCharacterUpdate.mock.calls[mockOnCharacterUpdate.mock.calls.length - 1];
        const updatedChar = lastCallArgs[0];

        // The updated character should have the effect removed
        expect(updatedChar.statusEffects).toHaveLength(0);
        expect(rollSavingThrow).toHaveBeenCalledWith(expect.anything(), 'Wisdom', 15, expect.anything());
    });

    it('should explicitly fail repeat save at end of turn', () => {
        const effect: StatusEffect = {
            id: 'eff-1',
            name: 'Laughing',
            type: 'debuff',
            duration: 10,
            effect: { type: 'condition' },
            repeatSave: {
                timing: 'turn_end',
                saveType: 'Wisdom',
                dc: 15,
                successEnds: true
            }
        } as unknown as StatusEffect;
        character.statusEffects = [effect];

        const { result } = renderHook(() => useTurnManager({
            characters: [character],
            mapData: null,
            onCharacterUpdate: mockOnCharacterUpdate,
            onLogEntry: mockOnLogEntry
        }));

        act(() => {
            result.current.initializeCombat([character]);
        });

        // Mock failed save
        // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
        vi.mocked(rollSavingThrow).mockReturnValue(makeSaveResult(false, 10));

        act(() => {
            result.current.endTurn();
        });

        const lastCall = mockOnCharacterUpdate.mock.calls[mockOnCharacterUpdate.mock.calls.length - 1][0];
        expect(lastCall.statusEffects).toHaveLength(1);
    });

    // Note: Testing `handleDamage` and `damagedThisTurn` is trickier because `handleDamage` is internal.
    // But we can trigger damage via `executeAction` or check if `damageNumbers` state updates reflect it?
    // `useTurnManager` doesn't expose `handleDamage`.
    // However, damage from sustain triggers logs.
    // We can try to test logic via processMoveTriggers?
    // Or just rely on endTurn behavior which uses `processRepeatSaves`.

    // Actually, we can assume `handleDamage` works if we see `damagedThisTurn` affect `turn_end` logic?
    // But how to set `damagedThisTurn` from outside?
    // We can't directly. `damagedThisTurn` is reset at start/end of turn.
    // If we can trigger damage via a mechanism `useTurnManager` handles (e.g. movement into hazard), we can test it.

    // Alternatively, we can just verification that `damagedThisTurn` is reset.
    it('should reset damagedThisTurn at end of turn', () => {
        // Manually set damagedThisTurn to true on input character
        character.damagedThisTurn = true;
        const { result } = renderHook(() => useTurnManager({
            characters: [character],
            mapData: null,
            onCharacterUpdate: mockOnCharacterUpdate,
            onLogEntry: mockOnLogEntry
        }));

        act(() => {
            result.current.initializeCombat([character]);
        });

        act(() => {
            result.current.endTurn();
        });

        // Verify damagedThisTurn is reset in the update
        expect(mockOnCharacterUpdate).toHaveBeenCalled();
        const lastCallArgs = mockOnCharacterUpdate.mock.calls[mockOnCharacterUpdate.mock.calls.length - 1];
        const updatedChar = lastCallArgs[0];
        expect(updatedChar.damagedThisTurn).toBe(false);
    });

});
