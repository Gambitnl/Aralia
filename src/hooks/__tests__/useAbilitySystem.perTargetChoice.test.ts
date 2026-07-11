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

describe('useAbilitySystem - per-target choice input', () => {
    const createChoiceCaster = (id: string, x: number): CombatCharacter => ({
        id,
        name: id,
        team: 'player',
        position: { x, y: 0 },
        actionEconomy: { action: { used: false }, bonusAction: { used: false }, reaction: { used: false }, movement: { used: 0, total: 30 } },
        spellSlots: { 2: { used: 0, total: 2 } }
    } as unknown as CombatCharacter);

    const createChoiceTarget = (id: string, x: number): CombatCharacter => ({
        id,
        name: id,
        team: 'player',
        position: { x, y: 0 },
        actionEconomy: { action: { used: false }, bonusAction: { used: false }, reaction: { used: false }, movement: { used: 0, total: 30 } },
        spellSlots: {}
    } as unknown as CombatCharacter);

    const enhanceAbilitySpell = {
        id: 'enhance-ability',
        name: 'Enhance Ability',
        level: 2,
        school: 'Transmutation',
        classes: ['Bard'],
        description: 'Choose an ability for the target.',
        castingTime: { value: 1, unit: 'action' },
        range: { type: 'touch', distance: 0 },
        components: { verbal: true, somatic: true, material: true },
        duration: { type: 'timed', value: 1, unit: 'hour', concentration: true },
        targeting: {
            type: 'multi',
            range: 5,
            validTargets: ['creatures'],
            lineOfSight: false,
            maxTargets: 1,
            perTargetChoice: {
                choiceType: 'ability',
                scope: 'each_target',
                options: ['Strength', 'Dexterity', 'Intelligence', 'Wisdom', 'Charisma'],
                differentChoicesAllowed: true,
                required: true
            }
        },
        effects: []
    } as unknown as Spell;

    it('collects a single-target per-target choice before creating spell commands', async () => {
        const { SpellCommandFactory } = await import('../../commands');
        const caster = createChoiceCaster('enhancer', 0);
        const target = createChoiceTarget('ally-one', 1);
        const ability = {
            id: enhanceAbilitySpell.id,
            name: enhanceAbilitySpell.name,
            description: enhanceAbilitySpell.description,
            type: 'spell',
            cost: { type: 'action', spellSlotLevel: 2 },
            range: 1,
            targeting: 'single_ally',
            effects: [],
            spell: enhanceAbilitySpell
        } as unknown as Ability;
        const onRequestInput = vi.fn((_spell: Spell, onConfirm: (input: string) => void) => {
            onConfirm('Wisdom');
        });

        const { result } = renderHook(() => useAbilitySystem({
            characters: [caster, target],
            mapData: null,
            onExecuteAction: vi.fn(() => true),
            onCharacterUpdate: vi.fn(),
            onLogEntry: vi.fn(),
            onAbilityEffect: vi.fn(),
            onRequestInput
        }));

        await act(async () => {
            await (result.current.executeAbility as any)(
                ability,
                caster,
                target.position,
                [target.id]
            );
        });

        // A one-target Enhance Ability cast can safely use the existing modal:
        // the selected ability belongs to the only selected target and is passed
        // through as playerInput for command creation.
        expect(onRequestInput).toHaveBeenCalledWith(enhanceAbilitySpell, expect.any(Function));
        await _waitFor(() => expect(SpellCommandFactory.createCommands).toHaveBeenCalled());
        expect(vi.mocked(SpellCommandFactory.createCommands).mock.calls.at(-1)?.[5]).toBe('Wisdom');
    });

    it('collects target-indexed choices before multi-target per-target choice commands', async () => {
        const { SpellCommandFactory } = await import('../../commands');
        const caster = createChoiceCaster('enhancer', 0);
        const firstTarget = createChoiceTarget('ally-one', 1);
        const secondTarget = createChoiceTarget('ally-two', 2);
        const onExecuteAction = vi.fn(() => true);
        const choices = ['Strength', 'Wisdom'];
        const onRequestInput = vi.fn((_spell: Spell, onConfirm: (input: string) => void) => {
            onConfirm(choices.shift() ?? 'Charisma');
        });
        const ability = {
            id: enhanceAbilitySpell.id,
            name: enhanceAbilitySpell.name,
            description: enhanceAbilitySpell.description,
            type: 'spell',
            cost: { type: 'action', spellSlotLevel: 3 },
            range: 1,
            targeting: 'single_ally',
            effects: [],
            spell: enhanceAbilitySpell
        } as unknown as Ability;

        const { result } = renderHook(() => useAbilitySystem({
            characters: [caster, firstTarget, secondTarget],
            mapData: null,
            onExecuteAction,
            onCharacterUpdate: vi.fn(),
            onLogEntry: vi.fn(),
            onNotification: vi.fn(),
            onAbilityEffect: vi.fn(),
            onRequestInput
        }));

        await act(async () => {
            await (result.current.executeAbility as any)(
                ability,
                caster,
                firstTarget.position,
                [firstTarget.id, secondTarget.id]
            );
        });

        // Higher-slot Enhance Ability can choose different abilities for each
        // target. The hook should request one option per selected target before
        // spending the action or creating commands, then pass a target-indexed
        // assignment payload on the spell clone.
        expect(onRequestInput).toHaveBeenCalledTimes(2);
        await _waitFor(() => expect(SpellCommandFactory.createCommands).toHaveBeenCalled());
        expect(onExecuteAction).toHaveBeenCalled();
        const spellPassedToFactory = vi.mocked(SpellCommandFactory.createCommands).mock.calls.at(-1)?.[0] as Spell & {
            perTargetChoicesByTargetId?: Record<string, string>
        };
        expect(spellPassedToFactory.perTargetChoicesByTargetId).toEqual({
            [firstTarget.id]: 'Strength',
            [secondTarget.id]: 'Wisdom'
        });
    });
});

// ============================================================================
// Self-Teleport Destination Selection
// ============================================================================
// Self-target teleport spells are a two-step map interaction: first the player
// chooses the spell, then they choose a destination tile. This coverage protects
// that the caster remains the moved target while the clicked tile is passed into
// the rich movement effect for the command layer.
// ============================================================================
