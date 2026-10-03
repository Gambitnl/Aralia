import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useActionExecutor } from '../useActionExecutor';
import { CombatCharacter, CombatAction, ReactiveTrigger } from '../../../types/combat';
import type { SpellEffect } from '../../../types/spells';
import {
    mockHandleDamage,
    mockConsumeAction,
    mockOnCharacterUpdate,
    mockCharacter,
    mockTurnState,
    defaultProps,
    resetActionExecutorMocks,
} from './useActionExecutor.fixtures';

/**
 * This file proves the sustain path reads reactive triggers through the same
 * shared selector and damage applicator as the on-target-attack resolver
 * (Agora task agora-5e55).
 *
 * Called by: focused Vitest runtime proof for useActionExecutor.
 * Depends on: useActionExecutor and the shared ReactiveTrigger contract.
 */

const witchBoltSustain: SpellEffect = {
    type: 'DAMAGE',
    trigger: {
        type: 'on_caster_action',
        frequency: 'every_time',
        consumption: 'unlimited'
    },
    condition: { type: 'always' },
    damage: { dice: '7', type: 'Lightning' }
} as unknown as SpellEffect;

const otherTrigger: SpellEffect = {
    type: 'DAMAGE',
    trigger: {
        type: 'on_target_attack',
        frequency: 'every_time',
        consumption: 'unlimited'
    },
    condition: { type: 'always' },
    damage: { dice: '99', type: 'Cold' }
} as unknown as SpellEffect;

describe('useActionExecutor sustain reactive triggers', () => {
    beforeEach(() => {
        resetActionExecutorMocks();
    });

    const caster: CombatCharacter = {
        ...mockCharacter,
        id: 'char1',
        name: 'Bolt Caster',
        concentratingOn: {
            spellId: 'witch-bolt',
            spellName: 'Witch Bolt',
            spellLevel: 1,
            startedTurn: 1,
            effectIds: [],
            canDropAsFreeAction: true,
            sustainCost: { actionType: 'action', optional: false },
            sustainedThisTurn: false
        }
    };

    const boltedTarget: CombatCharacter = {
        ...mockCharacter,
        id: 'bolted_target',
        name: 'Bolted Target',
        position: { x: 2, y: 0 }
    };

    const sustainAction: CombatAction = {
        id: 'sustain-witch-bolt',
        characterId: caster.id,
        type: 'sustain',
        cost: { type: 'action' },
        timestamp: Date.now()
    };

    it('rolls and delivers sustain damage to the trigger target', async () => {
        mockConsumeAction.mockReturnValue({ ...caster });
        mockHandleDamage.mockImplementation((character: CombatCharacter) => character);

        const trigger: ReactiveTrigger = {
            id: 'witch-bolt-trigger',
            sourceEffect: witchBoltSustain,
            sourceSpellId: 'witch-bolt',
            casterId: caster.id,
            targetId: boltedTarget.id,
            createdTurn: 1
        };

        const { result } = renderHook(() => useActionExecutor({
            ...defaultProps,
            characters: [caster, boltedTarget],
            turnState: { ...mockTurnState, turnOrder: [caster.id], currentCharacterId: caster.id },
            reactiveTriggers: [trigger]
        }));

        expect(await result.current.executeAction(sustainAction)).toBe(true);

        // '7' is a flat dice expression, so the shared applicator's roll is exact.
        expect(mockHandleDamage).toHaveBeenCalledWith(
            expect.objectContaining({ id: boltedTarget.id }),
            7,
            'sustained spell',
            'Lightning',
            mockTurnState.currentTurn
        );
        expect(mockOnCharacterUpdate).toHaveBeenCalled();
    });

    it('ignores triggers owned by another caster or of another trigger type', async () => {
        mockConsumeAction.mockReturnValue({ ...caster });
        mockHandleDamage.mockImplementation((character: CombatCharacter) => character);

        const foreignCasterTrigger: ReactiveTrigger = {
            id: 'foreign-sustain',
            sourceEffect: witchBoltSustain,
            casterId: 'someone_else',
            targetId: boltedTarget.id,
            createdTurn: 1
        };
        const wrongTypeTrigger: ReactiveTrigger = {
            id: 'wrong-type',
            sourceEffect: otherTrigger,
            casterId: caster.id,
            targetId: boltedTarget.id,
            createdTurn: 1
        };

        const { result } = renderHook(() => useActionExecutor({
            ...defaultProps,
            characters: [caster, boltedTarget],
            turnState: { ...mockTurnState, turnOrder: [caster.id], currentCharacterId: caster.id },
            reactiveTriggers: [foreignCasterTrigger, wrongTypeTrigger]
        }));

        expect(await result.current.executeAction(sustainAction)).toBe(true);
        expect(mockHandleDamage).not.toHaveBeenCalled();
    });

    it('skips a sustain trigger whose target has left the roster', async () => {
        mockConsumeAction.mockReturnValue({ ...caster });
        mockHandleDamage.mockImplementation((character: CombatCharacter) => character);

        const orphanTrigger: ReactiveTrigger = {
            id: 'orphan-sustain',
            sourceEffect: witchBoltSustain,
            casterId: caster.id,
            targetId: 'already_removed',
            createdTurn: 1
        };

        const { result } = renderHook(() => useActionExecutor({
            ...defaultProps,
            characters: [caster],
            turnState: { ...mockTurnState, turnOrder: [caster.id], currentCharacterId: caster.id },
            reactiveTriggers: [orphanTrigger]
        }));

        expect(await result.current.executeAction(sustainAction)).toBe(true);
        expect(mockHandleDamage).not.toHaveBeenCalled();
    });
});
