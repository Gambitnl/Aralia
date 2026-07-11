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

describe('useAbilitySystem - mode-choice input', () => {
    it('collects required AI-DM player intent before creating spell commands', async () => {
        const { SpellCommandFactory } = await import('../../commands');
        const caster = {
            id: 'caster-ai-input',
            name: 'AI Input Caster',
            team: 'player',
            position: { x: 0, y: 0 },
            actionEconomy: { action: { used: false }, bonusAction: { used: false }, reaction: { used: false }, movement: { used: 0, total: 30 } },
            spellSlots: { 0: { used: 0, total: 0 } }
        } as unknown as CombatCharacter;
        const aiSpell: Spell = {
            id: 'prestidigitation',
            name: 'Prestidigitation',
            level: 0,
            school: 'Transmutation',
            classes: ['Wizard'],
            description: 'Describe a harmless magical effect.',
            castingTime: { value: 1, unit: 'action' },
            range: { type: 'ranged', distance: 10 },
            components: { verbal: true, somatic: true, material: false },
            duration: { type: 'instantaneous', concentration: false },
            targeting: { type: 'self', range: 0, validTargets: ['self'], lineOfSight: false },
            effects: [],
            arbitrationType: 'ai_dm',
            aiContext: {
                prompt: 'Adjudicate the requested harmless magical effect.',
                playerInputRequired: true
            }
        } as unknown as Spell;
        const aiAbility: Ability = {
            id: aiSpell.id,
            name: aiSpell.name,
            description: aiSpell.description,
            type: 'spell',
            cost: { type: 'action' },
            range: 0,
            targeting: 'self',
            effects: [],
            spell: aiSpell
        } as unknown as Ability;
        let confirmInput: ((input: string) => void) | undefined;
        const onRequestInput = vi.fn((_spell: Spell, onConfirm: (input: string) => void) => {
            confirmInput = onConfirm;
        });

        const { result } = renderHook(() => useAbilitySystem({
            characters: [caster],
            mapData: null,
            onExecuteAction: vi.fn(() => true),
            onCharacterUpdate: vi.fn(),
            onLogEntry: vi.fn(),
            onAbilityEffect: vi.fn(),
            onRequestInput
        }));

        await act(async () => {
            await (result.current.executeAbility as any)(
                aiAbility,
                caster,
                caster.position,
                [caster.id]
            );
        });

        // AI-DM spells that need player intent must pause before command
        // creation, otherwise they can spend action resources with no prompt
        // text for the arbitrator.
        expect(onRequestInput).toHaveBeenCalledWith(aiSpell, expect.any(Function));
        expect(SpellCommandFactory.createCommands).not.toHaveBeenCalled();

        await act(async () => {
            confirmInput?.('Make the torch glow blue');
        });

        await _waitFor(() => expect(SpellCommandFactory.createCommands).toHaveBeenCalled());
        expect(vi.mocked(SpellCommandFactory.createCommands).mock.calls.at(-1)?.[5]).toBe('Make the torch glow blue');
    });

    it('collects a mode choice before creating spell commands', async () => {
        const { SpellCommandFactory } = await import('../../commands');
        const caster = {
            id: 'caster-mode-choice',
            name: 'Mode Caster',
            team: 'player',
            position: { x: 0, y: 0 },
            actionEconomy: { action: { used: false }, bonusAction: { used: false }, reaction: { used: false }, movement: { used: 0, total: 30 } },
            spellSlots: { 2: { used: 0, total: 2 } }
        } as unknown as CombatCharacter;
        const target = {
            id: 'target-mode-choice',
            name: 'Mode Target',
            team: 'enemy',
            position: { x: 1, y: 0 },
            actionEconomy: { action: { used: false }, bonusAction: { used: false }, reaction: { used: false }, movement: { used: 0, total: 30 } },
            spellSlots: {}
        } as unknown as CombatCharacter;
        const modeSpell: Spell = {
            id: 'blindness-deafness',
            name: 'Blindness/Deafness',
            level: 2,
            school: 'Necromancy',
            classes: ['Wizard'],
            description: 'Choose whether the target is blinded or deafened.',
            castingTime: { value: 1, unit: 'action' },
            range: { type: 'ranged', distance: 30 },
            components: { verbal: true, somatic: false, material: false },
            duration: { type: 'timed', value: 1, unit: 'minute' },
            targeting: { type: 'single', range: 30, validTargets: ['enemies'], lineOfSight: false },
            effects: [],
            modeChoice: {
                type: 'choose_one',
                timing: 'on_cast',
                optionCount: 2,
                optionsSource: 'modeChoice.options',
                options: [
                    { label: 'Blindness', summary: 'Blind the target.', effectIndices: [0] },
                    { label: 'Deafness', summary: 'Deafen the target.', effectIndices: [1] }
                ]
            }
        } as unknown as Spell;
        const modeAbility: Ability = {
            id: modeSpell.id,
            name: modeSpell.name,
            description: modeSpell.description,
            type: 'spell',
            cost: { type: 'action', spellSlotLevel: 2 },
            range: 6,
            targeting: 'single_enemy',
            effects: [],
            spell: modeSpell
        } as unknown as Ability;
        const onRequestInput = vi.fn((_spell: Spell, onConfirm: (input: string) => void) => {
            onConfirm('Deafness');
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
                modeAbility,
                caster,
                target.position,
                [target.id]
            );
        });

        // Mode-choice spells must pause for a selected option before command
        // creation. The selected label becomes playerInput so
        // SpellCommandFactory can keep only that option's effects.
        expect(onRequestInput).toHaveBeenCalledWith(modeSpell, expect.any(Function));
        await _waitFor(() => expect(SpellCommandFactory.createCommands).toHaveBeenCalled());
        expect(vi.mocked(SpellCommandFactory.createCommands).mock.calls.at(-1)?.[5]).toBe('Deafness');
    });

    it('collects a Command control option before creating spell commands', async () => {
        const { SpellCommandFactory } = await import('../../commands');
        const caster = {
            id: 'caster-command-choice',
            name: 'Command Caster',
            team: 'player',
            position: { x: 0, y: 0 },
            actionEconomy: { action: { used: false }, bonusAction: { used: false }, reaction: { used: false }, movement: { used: 0, total: 30 } },
            spellSlots: { 1: { used: 0, total: 2 } }
        } as unknown as CombatCharacter;
        const target = {
            id: 'target-command-choice',
            name: 'Command Target',
            team: 'enemy',
            position: { x: 1, y: 0 },
            actionEconomy: { action: { used: false }, bonusAction: { used: false }, reaction: { used: false }, movement: { used: 0, total: 30 } },
            spellSlots: {}
        } as unknown as CombatCharacter;
        const commandSpell: Spell = {
            id: 'command',
            name: 'Command',
            level: 1,
            school: 'Enchantment',
            classes: ['Cleric'],
            description: 'Choose one command word for the target.',
            castingTime: { value: 1, unit: 'action' },
            range: { type: 'ranged', distance: 60 },
            components: { verbal: true, somatic: false, material: false },
            duration: { type: 'instantaneous', value: 0, unit: 'round' },
            targeting: { type: 'single', range: 60, validTargets: ['enemies'], lineOfSight: false },
            effects: [{
                type: 'UTILITY',
                utilityType: 'control',
                description: 'On a failed save, the target obeys the selected command word.',
                trigger: { type: 'immediate' },
                condition: { type: 'save' },
                controlOptions: [
                    { name: 'Approach', effect: 'approach' },
                    { name: 'Flee', effect: 'flee' },
                    { name: 'Grovel', effect: 'grovel' }
                ]
            }]
        } as unknown as Spell;
        const commandAbility: Ability = {
            id: commandSpell.id,
            name: commandSpell.name,
            description: commandSpell.description,
            type: 'spell',
            cost: { type: 'action', spellSlotLevel: 1 },
            range: 12,
            targeting: 'single_enemy',
            effects: [],
            spell: commandSpell
        } as unknown as Ability;
        const onRequestInput = vi.fn((_spell: Spell, onConfirm: (input: string) => void) => {
            onConfirm('Flee');
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
                commandAbility,
                caster,
                target.position,
                [target.id]
            );
        });

        // Command is authored as one utility effect with several control words.
        // The hook should request the chosen word and pass it through the same
        // playerInput bridge used by mode choices, rather than letting command
        // execution fall back to first-listed Approach.
        expect(onRequestInput).toHaveBeenCalledWith(commandSpell, expect.any(Function));
        await _waitFor(() => expect(SpellCommandFactory.createCommands).toHaveBeenCalled());
        expect(vi.mocked(SpellCommandFactory.createCommands).mock.calls.at(-1)?.[5]).toBe('Flee');
    });
});
