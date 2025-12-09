import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useTurnManager } from '../../../hooks/combat/useTurnManager';
import { renderHook, act } from '@testing-library/react';
import { CombatCharacter, StatusEffect } from '../../../types/combat';
import { rollSavingThrow } from '../../../utils/savingThrowUtils';

// Mock dependencies
vi.mock('../../../utils/savingThrowUtils', () => ({
    rollSavingThrow: vi.fn(),
    calculateSpellDC: vi.fn(() => 15) // Default DC
}));

vi.mock('../../../utils/combatUtils', () => ({
    createDamageNumber: vi.fn((val) => ({ id: 'dmg-1', duration: 1000 })),
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
    let mockOnCharacterUpdate: any;
    let mockOnLogEntry: any;

    beforeEach(() => {
        mockOnCharacterUpdate = vi.fn();
        mockOnLogEntry = vi.fn();
        character = {
            id: 'char-1',
            name: 'Test Char',
            currentHP: 20,
            maxHP: 20,
            statusEffects: [],
            conditions: [],
            stats: { wisdom: 10, dexterity: 10, constitution: 10, strength: 10, intelligence: 10, charisma: 10, baseInitiative: 0, speed: 30, cr: '1' },
            abilities: [],
            team: 'player',
            position: { x: 0, y: 0 },
            initiative: 10,
            actionEconomy: {
                action: { used: false, remaining: 1 },
                bonusAction: { used: false, remaining: 1 },
                reaction: { used: false, remaining: 1 },
                movement: { used: 0, total: 30 },
                freeActions: 1
            }
        };
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
        };
        character.statusEffects = [effect];

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

        // Mock successful save
        (rollSavingThrow as any).mockImplementation(() => ({ success: true, total: 16 }));

        act(() => {
            result.current.endTurn();
        });

        // Character update should be called with effect removed
        expect(mockOnCharacterUpdate).toHaveBeenCalled();
        const lastCall = mockOnCharacterUpdate.mock.calls[mockOnCharacterUpdate.mock.calls.length - 1][0];
        expect(lastCall.statusEffects).toHaveLength(0);
        expect(rollSavingThrow).toHaveBeenCalledWith(expect.anything(), 'Wisdom', 15);
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
        };
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
        (rollSavingThrow as any).mockReturnValue({ success: false, total: 10 });

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

        const lastCall = mockOnCharacterUpdate.mock.calls[mockOnCharacterUpdate.mock.calls.length - 1][0];
        expect(lastCall.damagedThisTurn).toBe(false);
    });

});
