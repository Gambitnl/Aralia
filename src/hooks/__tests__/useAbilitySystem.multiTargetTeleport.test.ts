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

describe('useAbilitySystem - multi-target teleport assignment guard', () => {
    it('collects one destination per selected teleport target before executing', async () => {
        vi.clearAllMocks();
        const { SpellCommandFactory } = await import('../../commands');
        const secondTarget: CombatCharacter = {
            ...attacker,
            id: 'second-target',
            name: 'Second Target',
            position: { x: 2, y: 0 }
        };
        const assignmentMap: BattleMapData = {
            tiles: new Map([
                ['0-0', { id: '0-0', coordinates: { x: 0, y: 0 }, terrain: 'floor', decoration: null, blocksMovement: false, blocksLoS: false, movementCost: 1, elevation: 0, effects: [] }],
                ['1-0', { id: '1-0', coordinates: { x: 1, y: 0 }, terrain: 'floor', decoration: null, blocksMovement: false, blocksLoS: false, movementCost: 1, elevation: 0, effects: [] }],
                ['2-0', { id: '2-0', coordinates: { x: 2, y: 0 }, terrain: 'floor', decoration: null, blocksMovement: false, blocksLoS: false, movementCost: 1, elevation: 0, effects: [] }],
                ['4-1', { id: '4-1', coordinates: { x: 4, y: 1 }, terrain: 'floor', decoration: null, blocksMovement: false, blocksLoS: false, movementCost: 1, elevation: 0, effects: [] }],
                ['4-2', { id: '4-2', coordinates: { x: 4, y: 2 }, terrain: 'floor', decoration: null, blocksMovement: false, blocksLoS: false, movementCost: 1, elevation: 0, effects: [] }]
            ]),
            dimensions: { width: 5, height: 5 },
            theme: 'forest',
            seed: 2
        };
        const scatterSpell: Spell = {
            id: 'scatter',
            name: 'Scatter',
            level: 6,
            school: 'Conjuration',
            classes: ['Wizard'],
            description: 'Teleport chosen creatures to chosen spaces.',
            castingTime: { value: 1, unit: 'action' },
            range: { type: 'ranged', distance: 30 },
            components: { verbal: true, somatic: false, material: false },
            duration: { type: 'instantaneous', concentration: false },
            targeting: { type: 'multi', range: 6, validTargets: ['creatures'], lineOfSight: true, maxTargets: 2 },
            effects: [{
                type: 'MOVEMENT',
                movementType: 'teleport',
                distance: 120,
                forcedMovement: { direction: 'caster_choice', maxDistance: '120 ft', usesReaction: false },
                duration: { type: 'rounds', value: 0 },
                trigger: { type: 'immediate' },
                condition: { type: 'always' }
            }]
        } as unknown as Spell;
        const scatterAbility: Ability = {
            id: 'scatter-ability',
            name: 'Scatter',
            description: 'Move multiple creatures to chosen spaces.',
            type: 'spell',
            range: 6,
            targeting: 'single_enemy',
            cost: { type: 'action' },
            effects: [{ type: 'teleport', value: 24 }],
            spell: scatterSpell
        } as unknown as Ability;
        const onExecuteAction = vi.fn(() => true);
        const onNotification = vi.fn();
        const { result } = renderHook(() => useAbilitySystem({
            characters: [defender, attacker, secondTarget],
            mapData: assignmentMap,
            onExecuteAction,
            onCharacterUpdate: vi.fn(),
            onLogEntry: vi.fn(),
            onNotification,
            onAbilityEffect: vi.fn()
        }));

        act(() => {
            result.current.startTargeting(scatterAbility, defender);
        });

        let selectedTargets = true;
        act(() => {
            selectedTargets = result.current.selectTarget(attacker.position, defender);
        });

        expect(selectedTargets).toBe(false);
        expect(onExecuteAction).not.toHaveBeenCalled();
        expect(onNotification).toHaveBeenCalledWith('Choose a teleport destination for Attacker.', 'info');

        let selectedFirstDestination = true;
        act(() => {
            selectedFirstDestination = result.current.selectTarget({ x: 4, y: 1 }, defender);
        });

        expect(selectedFirstDestination).toBe(false);
        expect(onExecuteAction).not.toHaveBeenCalled();
        expect(onNotification).toHaveBeenCalledWith('Choose a teleport destination for Second Target.', 'info');

        let selectedSecondDestination = false;
        await act(async () => {
            selectedSecondDestination = result.current.selectTarget({ x: 4, y: 2 }, defender);
        });

        await _waitFor(() => expect(SpellCommandFactory.createCommands).toHaveBeenCalled());

        const spellPassedToFactory = vi.mocked(SpellCommandFactory.createCommands).mock.calls.at(-1)?.[0] as Spell;
        const movementEffect = spellPassedToFactory.effects[0] as any;

        expect(selectedSecondDestination).toBe(true);
        expect(onExecuteAction).toHaveBeenCalledWith(expect.objectContaining({
            characterId: defender.id,
            targetCharacterIds: [attacker.id, secondTarget.id]
        }));
        expect(movementEffect.destinationsByTargetId).toEqual({
            [attacker.id]: { x: 4, y: 1 },
            [secondTarget.id]: { x: 4, y: 2 }
        });
    });

    it('blocks Scatter-style teleports until destination choices exist', async () => {
        vi.clearAllMocks();
        const { SpellCommandFactory } = await import('../../commands');
        const scatterSpell: Spell = {
            id: 'scatter',
            name: 'Scatter',
            level: 6,
            school: 'Conjuration',
            classes: ['Wizard'],
            description: 'Teleport chosen creatures to chosen spaces.',
            castingTime: { value: 1, unit: 'action' },
            range: { type: 'ranged', distance: 30 },
            components: { verbal: true, somatic: false, material: false },
            duration: { type: 'instantaneous', concentration: false },
            targeting: { type: 'multi', range: 30, validTargets: ['creatures'], lineOfSight: true, maxTargets: 5 },
            effects: [{
                type: 'MOVEMENT',
                movementType: 'teleport',
                distance: 120,
                forcedMovement: { direction: 'caster_choice', maxDistance: '120 ft', usesReaction: false },
                duration: { type: 'rounds', value: 0 },
                trigger: { type: 'immediate' },
                condition: { type: 'always' }
            }]
        } as unknown as Spell;
        const scatterAbility: Ability = {
            id: 'scatter-ability',
            name: 'Scatter',
            description: 'Move multiple creatures to chosen spaces.',
            type: 'spell',
            range: 6,
            targeting: 'single_enemy',
            cost: { type: 'action' },
            effects: [{ type: 'teleport', value: 24 }],
            spell: scatterSpell
        } as unknown as Ability;
        const onExecuteAction = vi.fn(() => true);
        const onLogEntry = vi.fn();
        const onNotification = vi.fn();
        const { result } = renderHook(() => useAbilitySystem({
            characters: [attacker, defender],
            mapData: null,
            onExecuteAction,
            onCharacterUpdate: vi.fn(),
            onLogEntry,
            onNotification,
            onAbilityEffect: vi.fn()
        }));

        await act(async () => {
            await (result.current.executeAbility as any)(
                scatterAbility,
                defender,
                attacker.position,
                [attacker.id]
            );
        });

        expect(onExecuteAction).not.toHaveBeenCalled();
        expect(SpellCommandFactory.createCommands).not.toHaveBeenCalled();
        expect(onNotification).toHaveBeenCalledWith(
            'Scatter needs destination choices for its teleport targets before it can resolve.',
            'error'
        );
        expect(onLogEntry).toHaveBeenCalledWith(expect.objectContaining({
            type: 'action',
            characterId: defender.id,
            targetIds: [attacker.id],
            message: 'Scatter needs destination choices for its teleport targets before it can resolve.',
            data: expect.objectContaining({ pendingGap: 'SSO-TELEPORT-DESTINATION-SELECTION-001' })
        }));
    });
});

// ============================================================================
// Active Light Source Live-State Bridge
// ============================================================================
// Light spells create map-visible illumination inside command execution. These
// guards prove the ability hook publishes the final light-source array back to
// the live combat owner instead of leaving the light trapped in temporary
// command state.
// ============================================================================
