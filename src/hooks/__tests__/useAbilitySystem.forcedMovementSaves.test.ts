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

describe('useAbilitySystem - immediate forced-movement repeat saves', () => {
    it('removes an after-forced-movement status when the immediate movement repeat save succeeds', async () => {
        const { SpellCommandFactory, CommandExecutor } = await import('../../commands');
        const caster = {
            id: 'caster-immediate-force',
            name: 'Immediate Force Caster',
            team: 'player',
            position: { x: 0, y: 0 },
            actionEconomy: { action: { used: false }, bonusAction: { used: false }, reaction: { used: false }, movement: { used: 0, total: 30 } },
            spellSlots: { 1: { used: 0, total: 1 } },
            statusEffects: []
        } as unknown as CombatCharacter;
        const target = {
            id: 'target-immediate-force',
            name: 'Immediate Force Target',
            team: 'enemy',
            position: { x: 1, y: 0 },
            actionEconomy: { action: { used: false }, bonusAction: { used: false }, reaction: { used: false }, movement: { used: 0, total: 30 } },
            spellSlots: {},
            savePenaltyRiders: [{
                id: 'mind-sliver-rider',
                spellId: 'mind-sliver',
                casterId: caster.id,
                sourceName: 'Mind Sliver',
                dice: '1d4',
                applies: 'next_save',
                duration: { type: 'rounds', value: 1 },
                appliedTurn: 1
            }],
            statusEffects: [{
                id: 'compelled',
                name: 'Charmed',
                type: 'debuff',
                duration: 2,
                repeatSave: {
                    timing: 'after_forced_movement',
                    saveType: 'Wisdom',
                    successEnds: true,
                    useOriginalDC: true
                }
            }],
            conditions: [{
                name: 'Charmed',
                duration: { type: 'rounds', value: 2 },
                appliedTurn: 0
            }]
        } as unknown as CombatCharacter;
        const forceSpell: Spell = {
            id: 'immediate-force-test',
            name: 'Immediate Force Test',
            level: 1,
            school: 'Enchantment',
            classes: ['Wizard'],
            description: 'Moves a target immediately and grants an after-movement save.',
            castingTime: { value: 1, unit: 'action' },
            range: { type: 'ranged', distance: 30 },
            components: { verbal: true, somatic: true, material: false },
            duration: { type: 'instantaneous' },
            targeting: { type: 'single', range: 30, validTargets: ['enemies'], lineOfSight: false },
            effects: [{
                type: 'MOVEMENT',
                movementType: 'push',
                distance: 10,
                duration: { type: 'instantaneous' },
                trigger: { type: 'immediate', frequency: 'once', movementType: 'forced' },
                condition: { type: 'always' }
            }]
        } as unknown as Spell;
        const forceAbility: Ability = {
            id: 'immediate-force-ability',
            name: 'Immediate Force Test',
            description: 'Spell-backed immediate forced movement.',
            type: 'spell',
            range: 30,
            targeting: 'single_enemy',
            cost: { type: 'action' },
            effects: [],
            spell: forceSpell
        } as unknown as Ability;
        const onCharacterUpdate = vi.fn();

        vi.mocked(savingThrowUtils.rollSavingThrow).mockReturnValue({
            total: 18,
            success: true,
            modifiersApplied: []
        } as any);
        vi.mocked(SpellCommandFactory.createCommands).mockResolvedValueOnce([]);
        vi.mocked(CommandExecutor.execute).mockResolvedValueOnce({
            success: true,
            executedCommands: [],
            finalState: {
                isActive: true,
                characters: [
                    caster,
                    {
                        ...target,
                        position: { x: 3, y: 0 }
                    }
                ],
                combatLog: []
            } as any
        });

        const { result } = renderHook(() => useAbilitySystem({
            characters: [caster, target],
            mapData: null,
            onExecuteAction: vi.fn(() => true),
            onCharacterUpdate,
            onLogEntry: vi.fn(),
            onAbilityEffect: vi.fn()
        }));

        await act(async () => {
            await (result.current.executeAbility as any)(
                forceAbility,
                caster,
                target.position,
                [target.id]
            );
        });

        await _waitFor(() => expect(savingThrowUtils.rollSavingThrow).toHaveBeenCalled());
        expect(savingThrowUtils.rollSavingThrow).toHaveBeenCalledWith(
            expect.objectContaining({ id: target.id }),
            'Wisdom',
            expect.any(Number),
            [expect.objectContaining({ dice: '-1d4', source: 'Mind Sliver' })]
        );
        expect(onCharacterUpdate).toHaveBeenCalledWith(expect.objectContaining({
            id: target.id,
            position: { x: 3, y: 0 },
            statusEffects: [],
            conditions: [],
            savePenaltyRiders: []
        }));
    });
});
