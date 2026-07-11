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

describe('useAbilitySystem - command game-state context', () => {
    it('passes current map context into spell command creation', async () => {
        const { SpellCommandFactory } = await import('../../commands');
        const mapData: BattleMapData = {
            dimensions: { width: 3, height: 3 },
            tiles: new Map(),
            theme: 'dungeon',
            seed: 7
        } as unknown as BattleMapData;
        const contextSpell: Spell = {
            id: 'context-sensitive-spell',
            name: 'Context Sensitive Spell',
            level: 1,
            school: 'Transmutation',
            classes: ['Wizard'],
            description: 'Needs current map context at command creation.',
            castingTime: { value: 1, unit: 'action' },
            range: { type: 'distance', distance: 30 },
            components: { verbal: true, somatic: true, material: false },
            duration: { type: 'instantaneous' },
            targeting: { type: 'single', validTargets: ['enemies'] },
            effects: [{
                type: 'UTILITY',
                utilityType: 'investigate',
                trigger: { type: 'immediate' },
                condition: { type: 'always' }
            }]
        } as unknown as Spell;
        const contextAbility: Ability = {
            id: 'context-sensitive-ability',
            name: 'Context Sensitive Spell',
            description: 'Uses the command factory.',
            type: 'spell',
            range: 30,
            targeting: 'single_enemy',
            cost: { type: 'action' },
            effects: [],
            spell: contextSpell
        } as unknown as Ability;
        const { result } = renderHook(() => useAbilitySystem({
            characters: [attacker, defender],
            mapData,
            onExecuteAction: vi.fn(() => true),
            onCharacterUpdate: vi.fn(),
            onLogEntry: vi.fn(),
            onAbilityEffect: vi.fn()
        }));

        await act(async () => {
            await (result.current.executeAbility as any)(
                contextAbility,
                attacker,
                defender.position,
                [defender.id]
            );
        });

        // The fifth argument is the game/world context passed to command
        // creation. It should include the current map data instead of the old
        // empty placeholder object, otherwise map-aware commands and arbiters
        // lose context before execution starts.
        expect(vi.mocked(SpellCommandFactory.createCommands).mock.calls.at(-1)?.[4]).toEqual(
            expect.objectContaining({ mapData })
        );
    });

    it('registers scheduled turn effects after command creation owns the immediate cast', async () => {
        const { CommandExecutor } = await import('../../commands');
        const onAddScheduledSpellEffect = vi.fn();
        const scheduledSpell: Spell = {
            id: 'scheduled-proof-spell',
            name: 'Scheduled Proof Spell',
            level: 2,
            school: 'Enchantment',
            classes: ['Wizard'],
            description: 'Stores delayed turn effects after the immediate cast resolves.',
            castingTime: { value: 1, unit: 'action' },
            range: { type: 'ranged', distance: 60 },
            components: { verbal: true, somatic: true, material: false },
            duration: { type: 'timed', value: 1, unit: 'minute', concentration: true },
            targeting: { type: 'single', validTargets: ['enemies'] },
            effects: [
                {
                    type: 'DAMAGE',
                    damage: { dice: '1d6', type: 'psychic' },
                    trigger: { type: 'turn_start' },
                    condition: { type: 'always' }
                },
                {
                    type: 'STATUS_CONDITION',
                    statusCondition: { name: 'Dazed', duration: { type: 'rounds', value: 1 } },
                    trigger: { type: 'turn_end' },
                    condition: { type: 'always' }
                }
            ]
        } as unknown as Spell;
        const scheduledAbility: Ability = {
            id: 'scheduled-proof-ability',
            name: 'Scheduled Proof Spell',
            description: 'Uses delayed turn effects.',
            type: 'spell',
            range: 60,
            targeting: 'single_enemy',
            cost: { type: 'action' },
            effects: [],
            spell: scheduledSpell
        } as unknown as Ability;

        vi.mocked(CommandExecutor.execute).mockReturnValueOnce({
            success: true,
            finalState: {
                characters: [attacker, defender],
                combatLog: [],
                turnState: { currentTurn: 3 }
            }
        } as any);

        const { result } = renderHook(() => useAbilitySystem({
            characters: [attacker, defender],
            mapData: null,
            onExecuteAction: vi.fn(() => true),
            onCharacterUpdate: vi.fn(),
            onLogEntry: vi.fn(),
            onAbilityEffect: vi.fn(),
            onAddScheduledSpellEffect
        }));

        await act(async () => {
            await (result.current.executeAbility as any)(
                scheduledAbility,
                attacker,
                defender.position,
                [defender.id]
            );
        });

        // The hook is the orchestrator for delayed turn effects: the command
        // factory deliberately skips bare scheduled triggers during immediate
        // command creation, then this post-command branch registers durable
        // records for the turn manager/combat engine to resolve later.
        expect(onAddScheduledSpellEffect).toHaveBeenCalledTimes(2);
        expect(onAddScheduledSpellEffect).toHaveBeenCalledWith(expect.objectContaining({
            spellId: scheduledSpell.id,
            casterId: attacker.id,
            targetId: defender.id,
            timing: 'turn_start',
            saveDC: 17,
            effects: [expect.objectContaining({ trigger: expect.objectContaining({ type: 'turn_start' }) })]
        }));
        expect(onAddScheduledSpellEffect).toHaveBeenCalledWith(expect.objectContaining({
            spellId: scheduledSpell.id,
            casterId: attacker.id,
            targetId: defender.id,
            timing: 'turn_end',
            saveDC: 17,
            effects: [expect.objectContaining({ trigger: expect.objectContaining({ type: 'turn_end' }) })]
        }));
    });
});

// ============================================================================
// Allocated Spell Command Targets
// ============================================================================
// The target resolver can now reduce an already selected area candidate list by
// pool allocation. This hook-level guard proves the command factory receives
// that reduced affected-target list, not the broader UI candidate list.
// ============================================================================
