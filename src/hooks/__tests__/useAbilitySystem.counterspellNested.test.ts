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

describe('Counterspell nested interruption outcome', () => {
    it('lets the original spell continue when the selected Counterspell is itself interrupted', async () => {
        const { SpellCommandFactory } = await import('../../commands');
        const originalSpell: Spell = {
            id: 'original-spell-after-counter-counterspell',
            name: 'Original Spell After Counter-Counterspell',
            level: 3,
            school: 'Evocation',
            classes: ['Wizard'],
            description: 'A spell that should continue if the attempted Counterspell is stopped first.',
            castingTime: { value: 1, unit: 'action' },
            range: { type: 'ranged', distance: 150 },
            components: { verbal: true, somatic: true, material: true },
            duration: { type: 'instantaneous', concentration: false },
            targeting: { type: 'single', validTargets: ['creatures'] },
            effects: [{
                type: 'DAMAGE',
                damage: { dice: '8d6', type: 'fire' },
                trigger: { type: 'immediate' },
                condition: { type: 'always' }
            }]
        } as unknown as Spell;
        const counterspellFixture: Spell = {
            id: 'counterspell-fixture',
            name: 'Counterspell Fixture',
            level: 3,
            school: 'Abjuration',
            classes: ['Wizard'],
            description: 'Interrupts another spell unless it is interrupted first.',
            castingTime: { value: 1, unit: 'reaction' },
            castingTrigger: {
                type: 'when_visible_creature_casts_spell',
                requiredCost: 'reaction',
                maxRangeFeet: 60
            },
            interruptionState: {
                saveType: 'Constitution',
                failureOutcome: 'spell_has_no_effect',
                preservesInterruptedSlot: true
            },
            range: { type: 'ranged', distance: 60 },
            components: { verbal: false, somatic: true, material: false },
            duration: { type: 'instantaneous', concentration: false },
            targeting: { type: 'single', validTargets: ['creatures'] },
            effects: []
        } as unknown as Spell;
        const enemyCounterspell: Spell = {
            ...counterspellFixture,
            id: 'enemy-counterspell-stopped-by-player',
            name: 'Enemy Counterspell Stopped By Player'
        };
        const playerCounterspell: Spell = {
            ...counterspellFixture,
            id: 'player-counterspell-stops-enemy',
            name: 'Player Counterspell Stops Enemy'
        };
        const originalCaster = {
            id: 'nested-original-caster',
            name: 'Nested Original Caster',
            team: 'player',
            position: { x: 0, y: 0 },
            currentHP: 30,
            maxHP: 30,
            abilities: [{
                id: 'player-counterspell-ability',
                name: 'Player Counterspell',
                type: 'spell',
                spell: playerCounterspell
            } as unknown as Ability],
            actionEconomy: { action: { used: false, remaining: 1 }, bonusAction: { used: false, remaining: 1 }, reaction: { used: false, remaining: 1 }, movement: { used: 0, total: 30 } },
            spellSlots: { level_3: { current: 2, max: 2 } }
        } as unknown as CombatCharacter;
        const enemyReactor = {
            id: 'nested-enemy-reactor',
            name: 'Nested Enemy Reactor',
            team: 'enemy',
            position: { x: 1, y: 0 },
            currentHP: 30,
            maxHP: 30,
            abilities: [{
                id: 'enemy-counterspell-ability',
                name: 'Enemy Counterspell',
                type: 'spell',
                spell: enemyCounterspell
            } as unknown as Ability],
            actionEconomy: { action: { used: false, remaining: 1 }, bonusAction: { used: false, remaining: 1 }, reaction: { used: false, remaining: 1 }, movement: { used: 0, total: 30 } },
            spellSlots: { level_3: { current: 1, max: 1 } }
        } as unknown as CombatCharacter;
        const target = {
            id: 'nested-original-target',
            name: 'Nested Original Target',
            team: 'enemy',
            position: { x: 2, y: 0 },
            currentHP: 30,
            maxHP: 30,
            actionEconomy: { action: { used: false, remaining: 1 }, bonusAction: { used: false, remaining: 1 }, reaction: { used: false, remaining: 1 }, movement: { used: 0, total: 30 } }
        } as unknown as CombatCharacter;
        const originalAbility = {
            id: 'original-spell-after-counter-counterspell-ability',
            name: originalSpell.name,
            description: originalSpell.description,
            type: 'spell',
            cost: { type: 'action', spellSlotLevel: 3 },
            targeting: 'single_enemy',
            range: 30,
            effects: [],
            spell: originalSpell
        } as unknown as Ability;

        vi.mocked(combatUtils.getDistance).mockReturnValue(5);
        // Both interruption saves fail: the enemy Counterspell would stop the
        // original spell, but the player's nested Counterspell stops that enemy
        // reaction before its stale save can be applied to the original cast.
        vi.mocked(savingThrowUtils.rollSavingThrow).mockReturnValue({
            total: 5,
            success: false,
            modifiersApplied: []
        });

        const { result } = renderHook(() => useAbilitySystem({
            characters: [originalCaster, enemyReactor, target],
            mapData: null,
            onExecuteAction: vi.fn(() => true),
            onCharacterUpdate: vi.fn(),
            onLogEntry: vi.fn(),
            onAbilityEffect: vi.fn()
        }));

        let executionPromise: Promise<void>;
        await act(async () => {
            executionPromise = (result.current.executeAbility as any)(
                originalAbility,
                originalCaster,
                target.position,
                [target.id]
            );
        });

        await _waitFor(() => expect(result.current.pendingReaction).toEqual(expect.objectContaining({
            triggerType: 'on_cast',
            attackerId: originalCaster.id,
            targetId: enemyReactor.id,
            reactionSpells: [expect.objectContaining({ id: enemyCounterspell.id })]
        })));

        act(() => {
            result.current.pendingReaction?.onResolve(enemyCounterspell.id);
        });

        await _waitFor(() => expect(result.current.pendingReaction).toEqual(expect.objectContaining({
            triggerType: 'on_cast',
            attackerId: enemyReactor.id,
            targetId: originalCaster.id,
            reactionSpells: [expect.objectContaining({ id: playerCounterspell.id })]
        })));

        act(() => {
            result.current.pendingReaction?.onResolve(playerCounterspell.id);
        });

        await executionPromise!;

        const spellIdsPassedToFactory = vi.mocked(SpellCommandFactory.createCommands).mock.calls
            .map(call => (call[0] as Spell).id);

        // The enemy Counterspell is selected, pays its reaction, and then is
        // itself interrupted before it can create commands. The player's nested
        // Counterspell and the original spell should be the command payloads
        // that actually reach execution.
        expect(spellIdsPassedToFactory).not.toContain(enemyCounterspell.id);
        expect(spellIdsPassedToFactory).toContain(playerCounterspell.id);
        expect(spellIdsPassedToFactory).toContain(originalSpell.id);
        expect(spellIdsPassedToFactory.slice(-1)[0]).toBe(originalSpell.id);
    });
});
