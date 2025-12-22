
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReactiveEffectCommand } from '../ReactiveEffectCommand';
import { SpellEffect } from '@/types/spells';
import { CommandContext } from '../base/SpellCommand';
import { CombatState } from '@/types/combat';
import { createMockCombatState, createMockCombatCharacter } from '@/utils/factories';

// Mock logger
vi.mock('../../utils/logger', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

describe('ReactiveEffectCommand', () => {
    let mockState: CombatState;
    let mockContext: CommandContext;

    beforeEach(() => {
        mockState = createMockCombatState();
        mockContext = {
            spellId: 'spell-1',
            spellName: 'Test Spell',
            castAtLevel: 1,
            caster: createMockCombatCharacter({ id: 'caster-1' }),
            targets: [createMockCombatCharacter({ id: 'target-1' })],
            gameState: {} as any
        };
    });

    it('should use effect duration if present', () => {
        const effect: SpellEffect = {
            type: 'MOVEMENT', // Using MOVEMENT as a proxy for an effect that might have duration
            trigger: { type: 'on_target_move' },
            condition: { type: 'always' },
            movementType: 'stop',
            duration: { type: 'rounds', value: 3 }
        } as any;

        const command = new ReactiveEffectCommand(effect, mockContext);
        const newState = command.execute(mockState);

        const trigger = newState.reactiveTriggers?.[newState.reactiveTriggers.length - 1];
        expect(trigger).toBeDefined();
        expect(trigger?.expiresAtRound).toBe(mockState.turnState.currentTurn + 3);
    });

    it('should fallback to context spell duration if effect duration is missing', () => {
        // Effect with NO duration
        const effect: SpellEffect = {
            type: 'DAMAGE',
            trigger: { type: 'on_target_move' },
            condition: { type: 'always' },
            damage: { dice: '1d6', type: 'Fire' }
        } as any;

        // Context has spell duration
        const contextWithDuration: CommandContext = {
            ...mockContext,
            effectDuration: { type: 'rounds', value: 5 }
        };

        const command = new ReactiveEffectCommand(effect, contextWithDuration);
        const newState = command.execute(mockState);

        const trigger = newState.reactiveTriggers?.[newState.reactiveTriggers.length - 1];
        expect(trigger).toBeDefined();
        expect(trigger?.expiresAtRound).toBe(mockState.turnState.currentTurn + 5);
    });

    it('should handle "minutes" duration type correctly', () => {
        const effect: SpellEffect = {
            type: 'MOVEMENT',
            trigger: { type: 'on_target_move' },
            condition: { type: 'always' },
            movementType: 'stop'
        } as any;

        const contextWithDuration: CommandContext = {
            ...mockContext,
            effectDuration: { type: 'minutes', value: 1 } // 1 minute = 10 rounds
        };

        const command = new ReactiveEffectCommand(effect, contextWithDuration);
        const newState = command.execute(mockState);

        const trigger = newState.reactiveTriggers?.[newState.reactiveTriggers.length - 1];
        expect(trigger).toBeDefined();
        expect(trigger?.expiresAtRound).toBe(mockState.turnState.currentTurn + 10);
    });

    it('should have undefined expiry if no duration is found', () => {
         const effect: SpellEffect = {
            type: 'DAMAGE',
            trigger: { type: 'on_target_move' },
            condition: { type: 'always' },
            damage: { dice: '1d6', type: 'Fire' }
        } as any;

        const command = new ReactiveEffectCommand(effect, mockContext); // No duration in context
        const newState = command.execute(mockState);

        const trigger = newState.reactiveTriggers?.[newState.reactiveTriggers.length - 1];
        expect(trigger).toBeDefined();
        expect(trigger?.expiresAtRound).toBeUndefined();
    });
});
