import { renderHook, act, waitFor as _waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { materializeAfterHitReactionSpell, useAbilitySystem } from '../useAbilitySystem';
import { ActiveTruePolymorphTransformation, CombatCharacter, Ability, BattleMapData, LightSource, SelectedSpellTarget, SpellObjectAccessChange } from '../../types/combat';
import { Spell } from '../../types/spells';
import { Item } from '../../types';
import type { ActiveSpellZone } from '../../systems/spells/effects';
import * as savingThrowUtils from '../../utils/savingThrowUtils';
import { combatEvents } from '../../systems/events/CombatEvents';
import * as combatUtils from '../../utils/combatUtils';
import shiningSmite from '../../../public/data/spells/level-2/shining-smite.json';
import blindingSmite from '../../../public/data/spells/level-3/blinding-smite.json';
import { shieldSpell, attacker, defender, swordItem, basicAttack } from './useAbilitySystem.fixtures';

/**
 * This file checks the combat ability hook from the player's point of view.
 *
 * The hook is the place where spell buttons, target picks, action costs, reaction
 * prompts, visuals, and command execution meet. These tests keep important spell
 * wiring from silently falling back to prose-only behavior when a spell needs a
 * real combat system behind it.
 *
 * Called by: focused Vitest runs for spell and combat hook behavior.
 * Depends on: mocked command execution, combat distance helpers, and representative
 * spell/character fixtures in this file.
 */

// Mock dependencies
vi.mock('../combat/useTargeting', async () => {
    const React = await vi.importActual<typeof import('react')>('react');

    return {
        useTargeting: () => {
            // This mock keeps the real selected-ability state because the
            // targeting-feedback test needs to exercise the same start-target
            // then click-target flow used by the battle map.
            const [selectedAbility, setSelectedAbility] = React.useState<unknown | null>(null);
            const [targetingMode, setTargetingMode] = React.useState(false);
            const [teleportDestinationPreview, setTeleportDestinationPreview] = React.useState<unknown | null>(null);

            return {
                startTargeting: React.useCallback((ability: unknown) => {
                    setSelectedAbility(ability);
                    setTargetingMode(true);
                    setTeleportDestinationPreview(null);
                }, []),
                cancelTargeting: React.useCallback(() => {
                    setSelectedAbility(null);
                    setTargetingMode(false);
                    setTeleportDestinationPreview(null);
                }, []),
                selectedAbility,
                targetingMode,
                aoePreview: null,
                teleportDestinationPreview,
                params: null,
                previewAoE: vi.fn(),
                previewTeleportDestinations: React.useCallback((ability: unknown, caster: CombatCharacter, movedTarget: CombatCharacter = caster) => {
                    // The real targeting hook derives destination tiles from map
                    // range, blocking, occupancy, and line of sight. The unit
                    // tests only need stable destination tiles so the ability
                    // hook can prove it waits for destinations before casting.
                    const destination = movedTarget.id === 'second-target'
                        ? { x: 4, y: 2 }
                        : { x: 4, y: 1 };
                    setTeleportDestinationPreview({
                        origin: movedTarget.position,
                        targetId: movedTarget.id,
                        affectedTiles: [destination],
                        ability
                    });
                }, []),
                isTeleportDestination: React.useCallback((position: { x: number; y: number }) => (
                    !!teleportDestinationPreview && (teleportDestinationPreview as { affectedTiles: Array<{ x: number; y: number }> }).affectedTiles.some(tile =>
                        tile.x === position.x && tile.y === position.y
                    )
                ), [teleportDestinationPreview])
            };
        }
    };
});

vi.mock('../../commands', () => ({
    SpellCommandFactory: { createCommands: vi.fn().mockResolvedValue([]) },
    AbilityCommandFactory: { createCommands: vi.fn().mockReturnValue([]) },
    CommandExecutor: { execute: vi.fn().mockReturnValue({ success: true, finalState: { characters: [], combatLog: [] } }) }
}));

vi.mock('../../utils/combatUtils', () => ({
    getDistance: vi.fn(() => 5),
    getCharacterDistance: vi.fn(() => 5),
    // useTargetValidator asks for every occupied tile so large tokens and
    // future multi-cell creatures stay blocked consistently. Tests use single
    // tile characters, so the mock mirrors that smallest legal footprint.
    getOccupiedTiles: (character: CombatCharacter) => [character.position],
    calculateDamage: () => 5,
    generateId: () => 'test-id',
    rollDice: () => 15, // Always roll high for testing hits
    rollDamage: () => 5
}));

vi.mock('../../utils/savingThrowUtils', () => ({
    calculateSpellDC: () => 17,
    rollSavingThrow: vi.fn(() => ({ total: 18, success: true, modifiersApplied: [] }))
}));

beforeEach(() => {
    // Hook tests share mocked command factories and utility modules. Clearing
    // call history before each test keeps command-path assertions about "not
    // called yet" focused on the current interaction instead of earlier casts.
    vi.clearAllMocks();
    // Most tests in this file only need a stable generic grid distance. Tests
    // that prove familiar delivery can override this per case without leaking
    // their custom geometry into later spell-hook checks.
    vi.mocked(combatUtils.getDistance).mockReturnValue(5);
    vi.mocked(combatUtils.getCharacterDistance).mockReturnValue(5);
    // Counterspell and other save-gated hook tests sometimes force a failed
    // save for one interaction. Reset the default here so a failed interruption
    // proof cannot leak into later spell execution tests.
    vi.mocked(savingThrowUtils.rollSavingThrow).mockReturnValue({ total: 18, success: true, modifiersApplied: [] });
});

describe('useAbilitySystem - self-teleport destination selection', () => {
    it('waits for a destination tile and attaches it to the teleport movement effect', async () => {
        const { SpellCommandFactory } = await import('../../commands');
        const destination = { x: 4, y: 1 };
        const mistyStepSpell: Spell = {
            id: 'misty-step',
            name: 'Misty Step',
            level: 2,
            school: 'Conjuration',
            classes: ['Wizard'],
            description: 'Teleport to an unoccupied space you can see.',
            castingTime: { value: 1, unit: 'bonus_action' },
            range: { type: 'self', distance: 0 },
            components: { verbal: true, somatic: false, material: false },
            duration: { type: 'instantaneous', concentration: false },
            targeting: { type: 'self', validTargets: ['self'], lineOfSight: true },
            effects: [{
                type: 'MOVEMENT',
                movementType: 'teleport',
                distance: 30,
                forcedMovement: { direction: 'caster_choice', maxDistance: '30 ft', usesReaction: false },
                duration: { type: 'rounds', value: 0 },
                trigger: { type: 'immediate' },
                condition: { type: 'always' }
            }]
        } as unknown as Spell;
        const mistyStepAbility: Ability = {
            id: 'misty-step-ability',
            name: 'Misty Step',
            description: 'Teleport before resolving the command.',
            type: 'spell',
            range: 0,
            targeting: 'self',
            cost: { type: 'bonus' },
            effects: [{ type: 'teleport', value: 6 }],
            spell: mistyStepSpell
        } as unknown as Ability;
        const onExecuteAction = vi.fn(() => true);
        const { result } = renderHook(() => useAbilitySystem({
            characters: [defender],
            mapData: null,
            onExecuteAction,
            onCharacterUpdate: vi.fn(),
            onLogEntry: vi.fn(),
            onAbilityEffect: vi.fn()
        }));

        act(() => {
            result.current.startTargeting(mistyStepAbility, defender);
        });

        expect(onExecuteAction).not.toHaveBeenCalled();
        expect(SpellCommandFactory.createCommands).not.toHaveBeenCalled();

        let didSelect = false;
        await act(async () => {
            didSelect = result.current.selectTarget(destination, defender);
        });

        await _waitFor(() => expect(SpellCommandFactory.createCommands).toHaveBeenCalled());

        const spellPassedToFactory = vi.mocked(SpellCommandFactory.createCommands).mock.calls.at(-1)?.[0] as Spell;
        const movementEffect = spellPassedToFactory.effects[0] as any;

        expect(didSelect).toBe(true);
        expect(onExecuteAction).toHaveBeenCalledWith(expect.objectContaining({
            characterId: defender.id,
            targetPosition: destination,
            targetCharacterIds: [defender.id]
        }));
        expect(movementEffect.destination).toEqual(destination);
    });

    it('reports invalid self-teleport destinations without falling back to self-target validation', async () => {
        const mistyStepSpell: Spell = {
            id: 'misty-step',
            name: 'Misty Step',
            level: 2,
            school: 'Conjuration',
            classes: ['Wizard'],
            description: 'Teleport to an unoccupied space you can see.',
            castingTime: { value: 1, unit: 'bonus_action' },
            range: { type: 'self', distance: 0 },
            components: { verbal: true, somatic: false, material: false },
            duration: { type: 'instantaneous', concentration: false },
            targeting: { type: 'self', validTargets: ['self'], lineOfSight: true },
            effects: [{
                type: 'MOVEMENT',
                movementType: 'teleport',
                distance: 30,
                forcedMovement: { direction: 'caster_choice', maxDistance: '30 ft', usesReaction: false },
                duration: { type: 'rounds', value: 0 },
                trigger: { type: 'immediate' },
                condition: { type: 'always' }
            }]
        } as unknown as Spell;
        const mistyStepAbility: Ability = {
            id: 'misty-step-ability',
            name: 'Misty Step',
            description: 'Teleport before resolving the command.',
            type: 'spell',
            range: 0,
            targeting: 'self',
            cost: { type: 'bonus' },
            effects: [{ type: 'teleport', value: 6 }],
            spell: mistyStepSpell
        } as unknown as Ability;
        const onExecuteAction = vi.fn(() => true);
        const onLogEntry = vi.fn();
        const onNotification = vi.fn();
        const { result } = renderHook(() => useAbilitySystem({
            characters: [defender],
            mapData: null,
            onExecuteAction,
            onCharacterUpdate: vi.fn(),
            onLogEntry,
            onNotification,
            onAbilityEffect: vi.fn()
        }));

        act(() => {
            result.current.startTargeting(mistyStepAbility, defender);
        });

        let didSelect = true;
        act(() => {
            didSelect = result.current.selectTarget({ x: 2, y: 2 }, defender);
        });

        expect(didSelect).toBe(false);
        expect(onExecuteAction).not.toHaveBeenCalled();
        expect(onNotification).toHaveBeenCalledWith(
            'Misty Step needs a visible, unoccupied destination within range.',
            'error'
        );
        expect(onLogEntry).toHaveBeenCalledWith(expect.objectContaining({
            type: 'action',
            characterId: defender.id,
            message: 'Misty Step needs a visible, unoccupied destination within range.',
            data: expect.objectContaining({ attemptedDestination: { x: 2, y: 2 } })
        }));
    });
});

// ============================================================================
// Multi-Target Teleport Assignment Guard
// ============================================================================
// Scatter-style spells choose creatures first and landing spaces second. The
// current UI does not yet collect one destination per moved target, so the hook
// must stop before command creation instead of letting the movement command
// invent fallback destinations.
// ============================================================================
