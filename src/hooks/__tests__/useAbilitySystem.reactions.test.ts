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

describe('useAbilitySystem - Reactions', () => {
    const mockExecuteAction = vi.fn(() => true);
    const mockLogEntry = vi.fn();
    const mockCharacterUpdate = vi.fn();
    const mockAbilityEffect = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    // Standard attacks now delegate when-hit reaction arbitration to
    // AbilityCommandFactory. These hook-level checks protect the bridge and the
    // player-decline handshake; command-factory tests separately prove Shield
    // eligibility, resource spending, and hit cancellation.
    it('provides the hook reaction arbiter to standard attack commands', async () => {
        const { result } = renderHook(() => useAbilitySystem({
            characters: [attacker, defender],
            mapData: null,
            onExecuteAction: mockExecuteAction,
            onCharacterUpdate: mockCharacterUpdate,
            onLogEntry: mockLogEntry,
            onAbilityEffect: mockAbilityEffect
        }));

        await act(async () => {
            await result.current.executeAbility(
                basicAttack,
                attacker,
                defender.position,
                [defender.id]
            );
        });

        const { AbilityCommandFactory } = await import('../../commands');
        const latestFactoryCall = vi.mocked(AbilityCommandFactory.createCommands).mock.calls.at(-1);

        // The sixth factory argument is the async arbiter consumed by
        // WeaponAttackCommand when a hit opens an eligible reaction window.
        expect(latestFactoryCall?.[5]).toBe(result.current.requestReaction);
    });

    it('continues the reaction handshake with a null choice when the player declines', async () => {
        const { result } = renderHook(() => useAbilitySystem({
            characters: [attacker, defender],
            mapData: null,
            onExecuteAction: mockExecuteAction,
            onCharacterUpdate: mockCharacterUpdate,
            onLogEntry: mockLogEntry,
            onAbilityEffect: mockAbilityEffect
        }));

        let reactionChoice: Promise<string | null>;
        act(() => {
            reactionChoice = result.current.requestReaction(
                attacker.id,
                defender.id,
                'on_hit',
                [shieldSpell]
            );
        });

        expect(result.current.pendingReaction).toMatchObject({
            attackerId: attacker.id,
            targetId: defender.id,
            triggerType: 'on_hit',
            reactionSpells: [shieldSpell]
        });

        // A null answer means "do not spend a reaction". Resolving it must
        // release the waiting command and clear the prompt state immediately.
        act(() => {
            result.current.pendingReaction?.onResolve(null);
        });
        await expect(reactionChoice!).resolves.toBeNull();
        expect(result.current.pendingReaction).toBeNull();
    });

    it('should execute command via AbilityCommandFactory', async () => {
         const { result } = renderHook(() => useAbilitySystem({
            characters: [attacker, defender],
            mapData: {
                tiles: new Map([
                    ['0-0', { id: '0-0', coordinates: { x: 0, y: 0 }, terrain: 'plain', decoration: null, blocksMovement: false, blocksVision: false, movementCost: 1, elevation: 0 }],
                    ['1-0', { id: '1-0', coordinates: { x: 1, y: 0 }, terrain: 'plain', decoration: null, blocksMovement: false, blocksVision: false, movementCost: 1, elevation: 0 }]
                ]),
                dimensions: { width: 10, height: 10 },
                theme: 'dungeon',
                seed: 1
            } as BattleMapData,
            onExecuteAction: mockExecuteAction,
            onCharacterUpdate: mockCharacterUpdate,
            onLogEntry: mockLogEntry,
            onAbilityEffect: mockAbilityEffect
        }));

        await act(async () => {
            result.current.executeAbility(
                basicAttack,
                attacker,
                defender.position,
                [defender.id]
            );
        });

        // Check that AbilityCommandFactory was called
        // We need to import it to check the mock
        const { AbilityCommandFactory } = await import('../../commands');
        expect(AbilityCommandFactory.createCommands).toHaveBeenCalled();

        // Check that CommandExecutor was called
        const { CommandExecutor } = await import('../../commands');
        expect(CommandExecutor.execute).toHaveBeenCalled();
    });

    it('defers ability reactive events until command attack results are available', async () => {
        const { CommandExecutor } = await import('../../commands');
        combatEvents.clearForTest();
        vi.mocked(CommandExecutor.execute).mockImplementationOnce(() => {
            combatEvents.emit({
                type: 'unit_attack',
                attackerId: attacker.id,
                targetId: defender.id,
                isHit: false,
                isCrit: false,
                attackType: 'weapon',
                weaponType: 'melee'
            });

            return {
                success: true,
                finalState: {
                    characters: [attacker, defender],
                    combatLog: [],
                    reactiveTriggers: [],
                    activeLightSources: []
                }
            } as any;
        });

        const localExecuteAction = vi.fn(() => true);
        const { result } = renderHook(() => useAbilitySystem({
            characters: [attacker, defender],
            mapData: null,
            onExecuteAction: localExecuteAction,
            onCharacterUpdate: vi.fn(),
            onLogEntry: vi.fn(),
            onAbilityEffect: vi.fn()
        }));

        await act(async () => {
            await (result.current.executeAbility as any)(
                basicAttack,
                attacker,
                defender.position,
                [defender.id]
            );
        });

        expect(localExecuteAction).toHaveBeenCalledTimes(2);
        expect(localExecuteAction.mock.calls[0][0]).toEqual(expect.objectContaining({
            suppressAbilityEvents: true
        }));
        expect(localExecuteAction.mock.calls[1][0]).toEqual(expect.objectContaining({
            reactiveEventsOnly: true,
            attackResults: [{
                targetId: defender.id,
                isHit: false,
                isCritical: false,
                attackType: 'weapon',
                weaponType: 'melee'
            }]
        }));

        combatEvents.clearForTest();
    });

    it('prompts and materializes after-hit reaction spells from shared attack-result metadata', async () => {
        const { CommandExecutor, SpellCommandFactory } = await import('../../commands');
        combatEvents.clearForTest();
        const smiteSpell: Spell = {
            id: 'shining-smite-like',
            name: 'Shining Smite Like',
            level: 2,
            school: 'Transmutation',
            classes: ['Paladin'],
            description: 'A metadata-driven after-hit reaction smite.',
            castingTime: { value: 1, unit: 'reaction' },
            castingTrigger: {
                type: 'after_attack_hit',
                requiredCost: 'reaction',
                targetBinding: 'triggering_attack_target',
                attackFilter: {
                    attackType: 'weapon',
                    weaponType: 'melee'
                }
            },
            range: { type: 'self' },
            components: { verbal: true, somatic: false, material: false },
            duration: { type: 'instantaneous', concentration: false },
            targeting: { type: 'single', validTargets: ['enemies'] },
            effects: [{
                type: 'DAMAGE',
                damage: { dice: '2d6', type: 'radiant' },
                trigger: {
                    type: 'on_attack_hit',
                    frequency: 'once',
                    consumption: 'first_hit',
                    attackFilter: {
                        attackType: 'weapon',
                        weaponType: 'melee'
                    }
                },
                condition: { type: 'always' }
            }]
        } as unknown as Spell;
        const smitingAttacker: CombatCharacter = {
            ...attacker,
            id: 'smiting-attacker',
            name: 'Smiting Attacker',
            team: 'player',
            abilities: [({
                id: 'shining-smite-like-ability',
                name: 'Shining Smite Like',
                type: 'spell',
                spell: smiteSpell
            } as unknown as Ability)],
            actionEconomy: {
                ...attacker.actionEconomy,
                reaction: { used: false, remaining: 1 }
            },
            spellSlots: {
                level_2: { current: 1, max: 1 }
            // TODO #342(lint-intent): Use the shared spell-slot fixture once one exists for focused hook tests.
            } as unknown as CombatCharacter['spellSlots']
        };
        const hitTarget: CombatCharacter = {
            ...defender,
            id: 'smite-target',
            name: 'Smite Target',
            team: 'enemy',
            // This case proves the attacker's after-hit smite prompt. Remove
            // inherited Shield-style reactions so the target defensive-reaction
            // phase does not open a second pending prompt after the smite.
            abilities: []
        };
        const onCharacterUpdate = vi.fn();

        // The first command execution represents the weapon attack. It emits
        // the resolved hit event that the shared after-hit reaction bridge
        // consumes after command execution completes.
        vi.mocked(CommandExecutor.execute).mockImplementationOnce(() => {
            combatEvents.emit({
                type: 'unit_attack',
                attackerId: smitingAttacker.id,
                targetId: hitTarget.id,
                isHit: true,
                isCrit: false,
                attackType: 'weapon',
                weaponType: 'melee'
            });

            return {
                success: true,
                finalState: {
                    characters: [smitingAttacker, hitTarget],
                    combatLog: [],
                    reactiveTriggers: [],
                    activeLightSources: []
                }
            // TODO #343(lint-intent): Replace this broad command-result cast once the command test fixtures expose a minimal CombatResult builder.
            } as any;
        });

        const { result } = renderHook(() => useAbilitySystem({
            characters: [smitingAttacker, hitTarget],
            mapData: null,
            onExecuteAction: vi.fn(() => true),
            onCharacterUpdate,
            onLogEntry: vi.fn(),
            onAbilityEffect: vi.fn()
        }));

        let executionPromise: Promise<void>;
        await act(async () => {
            executionPromise = result.current.executeAbility(
                basicAttack,
                smitingAttacker,
                hitTarget.position,
                [hitTarget.id]
            );
        });

        await _waitFor(() => expect(result.current.pendingReaction).toEqual(expect.objectContaining({
            triggerType: 'on_hit',
            attackerId: smitingAttacker.id,
            targetId: hitTarget.id,
            reactionSpells: [expect.objectContaining({ id: smiteSpell.id })]
        })));

        act(() => {
            result.current.pendingReaction?.onResolve(smiteSpell.id);
        });

        await executionPromise!;

        expect(onCharacterUpdate).toHaveBeenCalledWith(expect.objectContaining({
            id: smitingAttacker.id,
            actionEconomy: expect.objectContaining({
                reaction: expect.objectContaining({ used: true })
            }),
            spellSlots: expect.objectContaining({
                level_2: expect.objectContaining({ current: 0 })
            })
        }));

        const smiteSpellPassedToFactory = vi.mocked(SpellCommandFactory.createCommands).mock.calls
            .map(call => call[0] as Spell)
            .find(spell => spell.id === smiteSpell.id);
        const smiteTargetsPassedToFactory = vi.mocked(SpellCommandFactory.createCommands).mock.calls
            .find(call => (call[0] as Spell).id === smiteSpell.id)?.[2] as CombatCharacter[] | undefined;

        expect(smiteSpellPassedToFactory?.effects[0]).toEqual(expect.objectContaining({
            trigger: expect.objectContaining({ type: 'immediate' })
        }));
        expect(smiteTargetsPassedToFactory).toEqual([hitTarget]);

        combatEvents.clearForTest();
    });

    it('does not prompt an after-hit reaction spell for nonmatching attack metadata', async () => {
        const { CommandExecutor, SpellCommandFactory } = await import('../../commands');
        combatEvents.clearForTest();
        const meleeOnlySmite: Spell = {
            id: 'blinding-smite-like',
            name: 'Blinding Smite Like',
            level: 3,
            school: 'Evocation',
            classes: ['Paladin'],
            description: 'A melee-only after-hit reaction smite used to prove nonmatching attacks stay quiet.',
            castingTime: { value: 1, unit: 'reaction' },
            castingTrigger: {
                type: 'after_attack_hit',
                requiredCost: 'reaction',
                targetBinding: 'triggering_attack_target',
                attackFilter: {
                    attackType: 'weapon',
                    weaponType: 'melee'
                }
            },
            range: { type: 'self' },
            components: { verbal: true, somatic: false, material: false },
            duration: { type: 'instantaneous', concentration: false },
            targeting: { type: 'single', validTargets: ['enemies'] },
            effects: [{
                type: 'STATUS_CONDITION',
                conditionName: 'Blinded',
                trigger: {
                    type: 'on_attack_hit',
                    frequency: 'once',
                    consumption: 'first_hit',
                    attackFilter: {
                        attackType: 'weapon',
                        weaponType: 'melee'
                    }
                },
                condition: { type: 'always' }
            }]
        // TODO #344(lint-intent): Replace this cast once compact reaction-spell fixtures expose the full migrated spell union.
        } as unknown as Spell;
        const smitingAttacker: CombatCharacter = {
            ...attacker,
            id: 'ranged-smite-attacker',
            name: 'Ranged Smite Attacker',
            team: 'player',
            abilities: [{
                id: 'blinding-smite-like-ability',
                name: 'Blinding Smite Like',
                type: 'spell',
                spell: meleeOnlySmite
            } as unknown as Ability],
            actionEconomy: {
                ...attacker.actionEconomy,
                reaction: { used: false, remaining: 1 }
            },
            spellSlots: {
                level_3: { current: 1, max: 1 }
            // TODO #346(lint-intent): Use the shared spell-slot fixture once one exists for focused hook tests.
            } as unknown as CombatCharacter['spellSlots']
        };
        const hitTarget: CombatCharacter = {
            ...defender,
            id: 'ranged-smite-target',
            name: 'Ranged Smite Target',
            team: 'enemy',
            // This negative case should prove that a ranged hit does not wake a
            // melee-only smite. Remove inherited Shield reactions so "no smite"
            // does not turn into an unrelated defensive prompt that waits for a
            // separate response.
            abilities: []
        };

        // The attack hits, but it is explicitly a ranged weapon hit. That is
        // close enough to look tempting, yet it must not wake a melee-only
        // smite because Shining/Blinding-style closure depends on strict
        // attack-filter matching rather than any-hit prompting.
        vi.mocked(CommandExecutor.execute).mockImplementationOnce(() => {
            combatEvents.emit({
                type: 'unit_attack',
                attackerId: smitingAttacker.id,
                targetId: hitTarget.id,
                isHit: true,
                isCrit: false,
                attackType: 'weapon',
                weaponType: 'ranged'
            });

            return {
                success: true,
                finalState: {
                    characters: [smitingAttacker, hitTarget],
                    combatLog: [],
                    reactiveTriggers: [],
                    activeLightSources: []
                }
            // TODO #347(lint-intent): Replace this broad command-result cast once the command test fixtures expose a minimal CombatResult builder.
            } as any;
        });

        const { result } = renderHook(() => useAbilitySystem({
            characters: [smitingAttacker, hitTarget],
            mapData: null,
            onExecuteAction: vi.fn(() => true),
            onCharacterUpdate: vi.fn(),
            onLogEntry: vi.fn(),
            onAbilityEffect: vi.fn()
        }));

        await act(async () => {
            await result.current.executeAbility(
                basicAttack,
                smitingAttacker,
                hitTarget.position,
                [hitTarget.id]
            );
        });

        expect(result.current.pendingReaction).toBeNull();
        expect(SpellCommandFactory.createCommands).not.toHaveBeenCalledWith(
            expect.objectContaining({ id: meleeOnlySmite.id }),
            expect.anything(),
            expect.anything(),
            expect.anything(),
            expect.anything()
        );

        combatEvents.clearForTest();
    });

    it('prompts an after-hit smite when legacy melee-weapon metadata meets a compact melee hit event', async () => {
        const { CommandExecutor } = await import('../../commands');
        combatEvents.clearForTest();
        const legacyMeleeSmite: Spell = {
            id: 'legacy-melee-smite-like',
            name: 'Legacy Melee Smite Like',
            level: 2,
            school: 'Evocation',
            classes: ['Paladin'],
            description: 'A smite fixture that keeps the older melee_weapon attack filter label.',
            castingTime: { value: 1, unit: 'reaction' },
            castingTrigger: {
                type: 'after_attack_hit',
                requiredCost: 'reaction',
                targetBinding: 'triggering_attack_target',
                attackFilter: {
                    attackType: 'weapon',
                    weaponType: 'melee_weapon'
                }
            },
            range: { type: 'self' },
            components: { verbal: true, somatic: false, material: false },
            duration: { type: 'instantaneous', concentration: false },
            targeting: { type: 'single', validTargets: ['enemies'] },
            effects: [{
                type: 'DAMAGE',
                damage: { dice: '2d6', type: 'radiant' },
                trigger: {
                    type: 'on_attack_hit',
                    frequency: 'once',
                    consumption: 'first_hit',
                    attackFilter: {
                        attackType: 'weapon',
                        weaponType: 'melee_weapon'
                    }
                },
                condition: { type: 'always' }
            }]
        } as unknown as Spell;
        const smitingAttacker: CombatCharacter = {
            ...attacker,
            id: 'legacy-melee-smite-attacker',
            name: 'Legacy Melee Smite Attacker',
            team: 'player',
            abilities: [{
                id: 'legacy-melee-smite-like-ability',
                name: 'Legacy Melee Smite Like',
                type: 'spell',
                spell: legacyMeleeSmite
            } as unknown as Ability],
            actionEconomy: {
                ...attacker.actionEconomy,
                reaction: { used: false, remaining: 1 }
            },
            spellSlots: {
                level_2: { current: 1, max: 1 }
            } as unknown as CombatCharacter['spellSlots']
        };
        const hitTarget: CombatCharacter = {
            ...defender,
            id: 'legacy-melee-smite-target',
            name: 'Legacy Melee Smite Target',
            team: 'enemy',
            // This proof is about legacy smite filter normalization on the
            // attacker's reaction, so the target must not open its own
            // defensive reaction prompt after the smite resolves.
            abilities: []
        };

        // The attack event is the modern compact melee shape. The spell filter
        // deliberately uses the older `melee_weapon` label so this guard proves
        // the prompt bridge normalizes migration-era spell metadata instead of
        // silently dropping the after-hit option.
        vi.mocked(CommandExecutor.execute).mockImplementationOnce(() => {
            combatEvents.emit({
                type: 'unit_attack',
                attackerId: smitingAttacker.id,
                targetId: hitTarget.id,
                isHit: true,
                isCrit: false,
                attackType: 'weapon',
                weaponType: 'melee'
            });

            return {
                success: true,
                finalState: {
                    characters: [smitingAttacker, hitTarget],
                    combatLog: [],
                    reactiveTriggers: [],
                    activeLightSources: []
                }
            // TODO #351(lint-intent): Replace this broad command-result cast once the command test fixtures expose a minimal CombatResult builder.
            } as any;
        });

        const { result } = renderHook(() => useAbilitySystem({
            characters: [smitingAttacker, hitTarget],
            mapData: null,
            onExecuteAction: vi.fn(() => true),
            onCharacterUpdate: vi.fn(),
            onLogEntry: vi.fn(),
            onAbilityEffect: vi.fn()
        }));

        let executionPromise: Promise<void>;
        await act(async () => {
            executionPromise = result.current.executeAbility(
                basicAttack,
                smitingAttacker,
                hitTarget.position,
                [hitTarget.id]
            );
        });

        await _waitFor(() => expect(result.current.pendingReaction).toEqual(expect.objectContaining({
            triggerType: 'on_hit',
            attackerId: smitingAttacker.id,
            targetId: hitTarget.id,
            reactionSpells: [expect.objectContaining({ id: legacyMeleeSmite.id })]
        })));

        act(() => {
            result.current.pendingReaction?.onResolve(null);
        });

        await executionPromise!;

        combatEvents.clearForTest();
    });

    it('prompts an after-hit smite when the spell explicitly includes Unarmed Strike', async () => {
        const { CommandExecutor } = await import('../../commands');
        combatEvents.clearForTest();
        const unarmedSmite: Spell = {
            id: 'shining-smite-unarmed-like',
            name: 'Shining Smite Unarmed Like',
            level: 2,
            school: 'Transmutation',
            classes: ['Paladin'],
            description: 'A smite fixture that allows weapon hits and Unarmed Strike hits.',
            castingTime: { value: 1, unit: 'reaction' },
            castingTrigger: {
                type: 'after_attack_hit',
                requiredCost: 'reaction',
                targetBinding: 'triggering_attack_target',
                attackFilter: {
                    attackType: 'weapon',
                    weaponType: 'any',
                    includesUnarmedStrike: true
                }
            },
            range: { type: 'self' },
            components: { verbal: true, somatic: false, material: false },
            duration: { type: 'instantaneous', concentration: false },
            targeting: { type: 'single', validTargets: ['enemies'] },
            effects: [{
                type: 'DAMAGE',
                damage: { dice: '2d6', type: 'radiant' },
                trigger: {
                    type: 'on_attack_hit',
                    frequency: 'once',
                    consumption: 'first_hit',
                    attackFilter: {
                        attackType: 'weapon',
                        weaponType: 'any'
                    }
                },
                condition: { type: 'always' }
            }]
        // TODO #352(lint-intent): Replace this cast once compact reaction-spell fixtures expose the full migrated spell union.
        } as unknown as Spell;
        const smitingAttacker: CombatCharacter = {
            ...attacker,
            id: 'unarmed-smite-attacker',
            name: 'Unarmed Smite Attacker',
            team: 'player',
            abilities: [{
                id: 'shining-smite-unarmed-like-ability',
                name: 'Shining Smite Unarmed Like',
                type: 'spell',
                spell: unarmedSmite
            } as unknown as Ability],
            actionEconomy: {
                ...attacker.actionEconomy,
                reaction: { used: false, remaining: 1 }
            },
            spellSlots: {
                level_2: { current: 1, max: 1 }
            } as unknown as CombatCharacter['spellSlots']
        };
        const hitTarget: CombatCharacter = {
            ...defender,
            id: 'unarmed-smite-target',
            name: 'Unarmed Smite Target',
            team: 'enemy',
            // Keep this fixture focused on the attacker-side unarmed smite
            // prompt, not the target's separate Shield-style reaction lane.
            abilities: []
        };

        // The attack event uses explicit unarmed metadata. The hook should not
        // rely on ordinary weapon matching here; it should honor the spell's
        // includesUnarmedStrike opt-in and offer the same after-hit prompt.
        vi.mocked(CommandExecutor.execute).mockImplementationOnce(() => {
            combatEvents.emit({
                type: 'unit_attack',
                attackerId: smitingAttacker.id,
                targetId: hitTarget.id,
                isHit: true,
                isCrit: false,
                attackType: 'unarmed',
                weaponType: 'unarmed'
            });

            return {
                success: true,
                finalState: {
                    characters: [smitingAttacker, hitTarget],
                    combatLog: [],
                    reactiveTriggers: [],
                    activeLightSources: []
                }
            // TODO #355(lint-intent): Replace this broad command-result cast once the command test fixtures expose a minimal CombatResult builder.
            } as any;
        });

        const { result } = renderHook(() => useAbilitySystem({
            characters: [smitingAttacker, hitTarget],
            mapData: null,
            onExecuteAction: vi.fn(() => true),
            onCharacterUpdate: vi.fn(),
            onLogEntry: vi.fn(),
            onAbilityEffect: vi.fn()
        }));

        let executionPromise: Promise<void>;
        await act(async () => {
            executionPromise = result.current.executeAbility(
                basicAttack,
                smitingAttacker,
                hitTarget.position,
                [hitTarget.id]
            );
        });

        await _waitFor(() => expect(result.current.pendingReaction).toEqual(expect.objectContaining({
            triggerType: 'on_hit',
            attackerId: smitingAttacker.id,
            targetId: hitTarget.id,
            reactionSpells: [expect.objectContaining({ id: unarmedSmite.id })]
        })));

        act(() => {
            result.current.pendingReaction?.onResolve(null);
        });

        await executionPromise!;

        combatEvents.clearForTest();
    });

    it('allows one bounded Counterspell response to a Counterspell before the original spell resolves', async () => {
        const { SpellCommandFactory } = await import('../../commands');
        const originalSpell: Spell = {
            id: 'fireball-like',
            name: 'Fireball Like',
            level: 3,
            school: 'Evocation',
            classes: ['Wizard'],
            description: 'A normal spell that can be interrupted.',
            castingTime: { value: 1, unit: 'action' },
            range: { type: 'ranged', distance: 150 },
            components: { verbal: true, somatic: true, material: true },
            duration: { type: 'instantaneous', concentration: false },
            targeting: { type: 'area', validTargets: ['point'] },
            effects: [{
                type: 'DAMAGE',
                damage: { dice: '8d6', type: 'fire' },
                trigger: { type: 'immediate' },
                condition: { type: 'always' }
            }]
        // TODO #356(lint-intent): Replace this cast once compact damaging-spell fixtures expose the full migrated spell union.
        } as unknown as Spell;
        const enemyCounterspell: Spell = {
            id: 'enemy-counterspell',
            name: 'Enemy Counterspell',
            level: 3,
            school: 'Abjuration',
            classes: ['Wizard'],
            description: 'Interrupts another spell.',
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
        const playerCounterspell: Spell = {
            ...enemyCounterspell,
            id: 'player-counterspell',
            name: 'Player Counterspell'
        };
        const originalCaster: CombatCharacter = {
            ...defender,
            id: 'original-caster',
            name: 'Original Caster',
            team: 'player',
            abilities: [{
                id: 'player-counterspell-ability',
                name: 'Player Counterspell',
                type: 'spell',
                spell: playerCounterspell
            } as unknown as Ability],
            actionEconomy: {
                ...defender.actionEconomy,
                reaction: { used: false, remaining: 1 }
            },
            spellSlots: {
                level_3: { current: 2, max: 2 }
            } as unknown as CombatCharacter['spellSlots']
        };
        const enemyReactor: CombatCharacter = {
            ...attacker,
            id: 'enemy-reactor',
            name: 'Enemy Reactor',
            team: 'enemy',
            abilities: [{
                id: 'enemy-counterspell-ability',
                name: 'Enemy Counterspell',
                type: 'spell',
                spell: enemyCounterspell
            } as unknown as Ability],
            actionEconomy: {
                ...attacker.actionEconomy,
                reaction: { used: false, remaining: 1 }
            },
            spellSlots: {
                level_3: { current: 1, max: 1 }
            } as unknown as CombatCharacter['spellSlots']
        };

        vi.mocked(combatUtils.getDistance).mockReturnValue(5);
        vi.mocked(savingThrowUtils.rollSavingThrow).mockReturnValue({
            total: 20,
            success: true,
            modifiersApplied: []
        });

        const { result } = renderHook(() => useAbilitySystem({
            characters: [originalCaster, enemyReactor],
            mapData: null,
            onExecuteAction: vi.fn(() => true),
            onCharacterUpdate: vi.fn(),
            onLogEntry: vi.fn(),
            onAbilityEffect: vi.fn()
        }));

        let executionPromise: Promise<void>;
        await act(async () => {
            executionPromise = result.current.executeSpell(
                originalSpell,
                originalCaster,
                [enemyReactor],
                originalSpell.level
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

        expect(spellIdsPassedToFactory).toContain(enemyCounterspell.id);
        expect(spellIdsPassedToFactory).toContain(playerCounterspell.id);
        expect(spellIdsPassedToFactory).toContain(originalSpell.id);
        expect(spellIdsPassedToFactory.filter(id => id.includes('counterspell'))).toHaveLength(2);
    });

    it('wastes the interrupted action while restoring only the interrupted spell slot on failed Counterspell', async () => {
        const { SpellCommandFactory } = await import('../../commands');
        const originalSpell: Spell = {
            id: 'fireball-like',
            name: 'Fireball Like',
            level: 3,
            school: 'Evocation',
            classes: ['Wizard'],
            description: 'A normal spell that should lose its action but keep its slot when interrupted.',
            castingTime: { value: 1, unit: 'action' },
            range: { type: 'ranged', distance: 150 },
            components: { verbal: true, somatic: true, material: true },
            duration: { type: 'instantaneous', concentration: false },
            targeting: { type: 'area', validTargets: ['point'] },
            effects: [{
                type: 'DAMAGE',
                damage: { dice: '8d6', type: 'fire' },
                trigger: { type: 'immediate' },
                condition: { type: 'always' }
            }]
        // TODO #362(lint-intent): Replace this cast once compact damaging-spell fixtures expose the full migrated spell union.
        } as unknown as Spell;
        const enemyCounterspell: Spell = {
            id: 'enemy-counterspell',
            name: 'Enemy Counterspell',
            level: 3,
            school: 'Abjuration',
            classes: ['Wizard'],
            description: 'Interrupts another spell.',
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
        const originalCaster: CombatCharacter = {
            ...defender,
            id: 'interrupted-caster',
            name: 'Interrupted Caster',
            team: 'player',
            abilities: [],
            actionEconomy: {
                ...defender.actionEconomy,
                action: { used: false, remaining: 1 },
                reaction: { used: false, remaining: 1 }
            },
            spellSlots: {
                level_3: { current: 1, max: 1 }
            // TODO #364(lint-intent): Use the shared spell-slot fixture once one exists for focused hook tests.
            } as unknown as CombatCharacter['spellSlots']
        };
        const enemyReactor: CombatCharacter = {
            ...attacker,
            id: 'counterspell-reactor',
            name: 'Counterspell Reactor',
            team: 'enemy',
            abilities: [{
                id: 'enemy-counterspell-ability',
                name: 'Enemy Counterspell',
                type: 'spell',
                spell: enemyCounterspell
            // TODO #365(lint-intent): Replace this broad ability cast once spellbook ability fixtures include reaction spells.
            } as unknown as Ability],
            actionEconomy: {
                ...attacker.actionEconomy,
                reaction: { used: false, remaining: 1 }
            },
            spellSlots: {
                level_3: { current: 1, max: 1 }
            } as unknown as CombatCharacter['spellSlots']
        };
        const fireballAbility: Ability = {
            id: 'fireball-like-ability',
            name: 'Fireball Like',
            description: 'A spell ability used to prove Counterspell slot preservation.',
            type: 'spell',
            cost: { type: 'action', spellSlotLevel: 3 },
            targeting: 'single_enemy',
            range: 30,
            effects: [],
            spell: originalSpell
        } as unknown as Ability;
        const onCharacterUpdate = vi.fn();

        vi.mocked(combatUtils.getDistance).mockReturnValue(5);
        vi.mocked(savingThrowUtils.rollSavingThrow).mockReturnValue({
            total: 5,
            success: false,
            modifiersApplied: []
        });

        const { result } = renderHook(() => useAbilitySystem({
            characters: [originalCaster, enemyReactor],
            mapData: null,
            onExecuteAction: vi.fn(() => true),
            onCharacterUpdate,
            onLogEntry: vi.fn(),
            onAbilityEffect: vi.fn()
        }));

        let executionPromise: Promise<void>;
        await act(async () => {
            executionPromise = result.current.executeAbility(
                fireballAbility,
                originalCaster,
                enemyReactor.position,
                [enemyReactor.id]
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

        await executionPromise!;

        expect(onCharacterUpdate).toHaveBeenCalledWith(expect.objectContaining({
            id: enemyReactor.id,
            actionEconomy: expect.objectContaining({
                reaction: expect.objectContaining({ used: true })
            }),
            spellSlots: expect.objectContaining({
                level_3: expect.objectContaining({ current: 0 })
            })
        }));
        expect(onCharacterUpdate).toHaveBeenCalledWith(expect.objectContaining({
            id: originalCaster.id,
            actionEconomy: expect.objectContaining({
                action: expect.objectContaining({ used: true })
            }),
            spellSlots: expect.objectContaining({
                level_3: expect.objectContaining({ current: 1 })
            })
        }));
        expect(vi.mocked(SpellCommandFactory.createCommands).mock.calls
            .map(call => (call[0] as Spell).id)).not.toContain(originalSpell.id);
    });

    it('allows the original spell command to continue when the Counterspell save succeeds', async () => {
        const { SpellCommandFactory } = await import('../../commands');
        const originalSpell: Spell = {
            id: 'fireball-success-path',
            name: 'Fireball Success Path',
            level: 3,
            school: 'Evocation',
            classes: ['Wizard'],
            description: 'A normal spell that should continue when the interruption save succeeds.',
            castingTime: { value: 1, unit: 'action' },
            range: { type: 'ranged', distance: 150 },
            components: { verbal: true, somatic: true, material: true },
            duration: { type: 'instantaneous', concentration: false },
            targeting: { type: 'area', validTargets: ['point'] },
            effects: [{
                type: 'DAMAGE',
                damage: { dice: '8d6', type: 'fire' },
                trigger: { type: 'immediate' },
                condition: { type: 'always' }
            }]
        } as unknown as Spell;
        const enemyCounterspell: Spell = {
            id: 'enemy-counterspell-success-path',
            name: 'Enemy Counterspell Success Path',
            level: 3,
            school: 'Abjuration',
            classes: ['Wizard'],
            description: 'Interrupts another spell unless the caster succeeds on the save.',
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
        const originalCaster: CombatCharacter = {
            ...defender,
            id: 'successful-save-caster',
            name: 'Successful Save Caster',
            team: 'player',
            abilities: [],
            actionEconomy: {
                ...defender.actionEconomy,
                reaction: { used: false, remaining: 1 }
            },
            spellSlots: {
                level_3: { current: 1, max: 1 }
            } as unknown as CombatCharacter['spellSlots']
        };
        const enemyReactor: CombatCharacter = {
            ...attacker,
            id: 'success-counterspell-reactor',
            name: 'Success Counterspell Reactor',
            team: 'enemy',
            abilities: [{
                id: 'enemy-counterspell-success-ability',
                name: 'Enemy Counterspell Success Path',
                type: 'spell',
                spell: enemyCounterspell
            } as unknown as Ability],
            actionEconomy: {
                ...attacker.actionEconomy,
                reaction: { used: false, remaining: 1 }
            },
            spellSlots: {
                level_3: { current: 1, max: 1 }
            } as unknown as CombatCharacter['spellSlots']
        };

        vi.mocked(combatUtils.getDistance).mockReturnValue(5);
        vi.mocked(savingThrowUtils.rollSavingThrow).mockReturnValue({
            total: 22,
            success: true,
            modifiersApplied: []
        });

        const { result } = renderHook(() => useAbilitySystem({
            characters: [originalCaster, enemyReactor],
            mapData: null,
            onExecuteAction: vi.fn(() => true),
            onCharacterUpdate: vi.fn(),
            onLogEntry: vi.fn(),
            onAbilityEffect: vi.fn()
        }));

        let executionPromise: Promise<void>;
        await act(async () => {
            executionPromise = result.current.executeSpell(
                originalSpell,
                originalCaster,
                [enemyReactor],
                originalSpell.level
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

        await executionPromise!;

        const spellIdsPassedToFactory = vi.mocked(SpellCommandFactory.createCommands).mock.calls
            .map(call => (call[0] as Spell).id);

        // A successful save means Counterspell did not stop the cast. The
        // selected reaction spell still runs and spends resources, but the
        // original spell must reach command creation afterward.
        expect(spellIdsPassedToFactory).toContain(enemyCounterspell.id);
        expect(spellIdsPassedToFactory).toContain(originalSpell.id);
    });

    it('does not offer Counterspell when the visible caster is outside the declared interruption range', async () => {
        const { SpellCommandFactory } = await import('../../commands');
        const originalSpell: Spell = {
            id: 'fireball-out-of-counterspell-range',
            name: 'Fireball Out Of Counterspell Range',
            level: 3,
            school: 'Evocation',
            classes: ['Wizard'],
            description: 'A normal spell used to prove Counterspell range gating.',
            castingTime: { value: 1, unit: 'action' },
            range: { type: 'ranged', distance: 150 },
            components: { verbal: true, somatic: true, material: true },
            duration: { type: 'instantaneous', concentration: false },
            targeting: { type: 'area', validTargets: ['point'] },
            effects: [{
                type: 'DAMAGE',
                damage: { dice: '8d6', type: 'fire' },
                trigger: { type: 'immediate' },
                condition: { type: 'always' }
            }]
        } as unknown as Spell;
        const enemyCounterspell: Spell = {
            id: 'enemy-counterspell-out-of-range',
            name: 'Enemy Counterspell Out Of Range',
            level: 3,
            school: 'Abjuration',
            classes: ['Wizard'],
            description: 'Interrupts another spell only within its trigger range.',
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
        const originalCaster: CombatCharacter = {
            ...defender,
            id: 'out-of-range-original-caster',
            name: 'Out Of Range Original Caster',
            team: 'player',
            abilities: [],
            actionEconomy: {
                ...defender.actionEconomy,
                reaction: { used: false, remaining: 1 }
            },
            spellSlots: {
                level_3: { current: 1, max: 1 }
            } as unknown as CombatCharacter['spellSlots']
        };
        const enemyReactor: CombatCharacter = {
            ...attacker,
            id: 'out-of-range-counterspell-reactor',
            name: 'Out Of Range Counterspell Reactor',
            team: 'enemy',
            abilities: [{
                id: 'enemy-counterspell-out-of-range-ability',
                name: 'Enemy Counterspell Out Of Range',
                type: 'spell',
                spell: enemyCounterspell
            } as unknown as Ability],
            actionEconomy: {
                ...attacker.actionEconomy,
                reaction: { used: false, remaining: 1 }
            },
            spellSlots: {
                level_3: { current: 1, max: 1 }
            } as unknown as CombatCharacter['spellSlots']
        };

        // The reactor can see the caster, but the shared interruption trigger
        // must still respect Counterspell's 60-foot range. Returning 65 feet
        // proves the prompt gate rejects a too-distant reaction spell instead
        // of offering it just because visibility and resources are valid.
        vi.mocked(combatUtils.getDistance).mockReturnValue(65);

        const { result } = renderHook(() => useAbilitySystem({
            characters: [originalCaster, enemyReactor],
            mapData: null,
            onExecuteAction: vi.fn(() => true),
            onCharacterUpdate: vi.fn(),
            onLogEntry: vi.fn(),
            onAbilityEffect: vi.fn()
        }));

        await act(async () => {
            await result.current.executeSpell(
                originalSpell,
                originalCaster,
                [enemyReactor],
                originalSpell.level
            );
        });

        const spellIdsPassedToFactory = vi.mocked(SpellCommandFactory.createCommands).mock.calls
            .map(call => (call[0] as Spell).id);

        expect(result.current.pendingReaction).toBeNull();
        expect(spellIdsPassedToFactory).toContain(originalSpell.id);
        expect(spellIdsPassedToFactory).not.toContain(enemyCounterspell.id);
    });

    it('spends the familiar reaction when a touch spell is delivered through Find Familiar', async () => {
        const { CommandExecutor } = await import('../../commands');
        const familiarCaster: CombatCharacter = {
            ...defender,
            id: 'familiar-caster',
            name: 'Familiar Caster',
            team: 'player',
            position: { x: 0, y: 0 }
        };
        const touchTarget: CombatCharacter = {
            ...attacker,
            id: 'touch-target',
            name: 'Touch Target',
            team: 'enemy',
            position: { x: 3, y: 0 }
        };
        const familiar: CombatCharacter = {
            ...defender,
            id: 'owl-familiar',
            name: 'Owl Familiar',
            team: 'player',
            position: { x: 2, y: 0 },
            isSummon: true,
            summonMetadata: {
                casterId: 'familiar-caster',
                spellId: 'find-familiar',
                entityType: 'familiar',
                sourceName: 'Find Familiar',
                actionPermissions: {
                    canDeliverTouchSpells: true,
                    touchDeliveryRangeFeet: 100,
                    touchDeliveryCost: 'reaction'
                },
                dismissable: true
            },
            actionEconomy: {
                ...defender.actionEconomy,
                reaction: { used: false, remaining: 1 }
            }
        };
        const touchSpell: Spell = {
            id: 'inflict-wounds-like',
            name: 'Inflict Wounds Like',
            level: 1,
            school: 'Necromancy',
            classes: ['Cleric'],
            description: 'A touch spell for familiar delivery proof.',
            castingTime: { value: 1, unit: 'action' },
            range: { type: 'touch', distance: 5 },
            components: { verbal: true, somatic: true, material: false },
            duration: { type: 'instantaneous', concentration: false },
            targeting: { type: 'single', validTargets: ['enemies'] },
            effects: []
        } as unknown as Spell;
        const touchAbility: Ability = {
            id: 'inflict-wounds-like-ability',
            name: 'Inflict Wounds Like',
            description: 'A touch spell for familiar delivery proof.',
            type: 'spell',
            range: 1,
            targeting: 'single_enemy',
            cost: { type: 'action' },
            effects: [],
            spell: touchSpell
        } as unknown as Ability;
        const onCharacterUpdate = vi.fn();
        const onAddSpellDeliveryVisual = vi.fn();

        // The caster is too far to touch the target directly, but the familiar
        // is within the 100-foot bond and adjacent to the target. This forces
        // the hook through the Find Familiar delivery path rather than ordinary
        // self-origin touch targeting.
        vi.mocked(combatUtils.getCharacterDistance).mockImplementation((first, second) => {
            const ids = new Set([first.id, second.id]);
            if (ids.has('familiar-caster') && ids.has('touch-target')) return 3;
            if (ids.has('familiar-caster') && ids.has('owl-familiar')) return 2;
            if (ids.has('owl-familiar') && ids.has('touch-target')) return 1;
            return 5;
        });
        vi.mocked(CommandExecutor.execute).mockReturnValueOnce({
            success: true,
            finalState: {
                characters: [familiarCaster, touchTarget, familiar],
                combatLog: [],
                reactiveTriggers: [],
                activeLightSources: []
            }
        } as any);

        const { result } = renderHook(() => useAbilitySystem({
            characters: [familiarCaster, touchTarget, familiar],
            mapData: null,
            onExecuteAction: vi.fn(() => true),
            onCharacterUpdate,
            onLogEntry: vi.fn(),
            onAbilityEffect: vi.fn(),
            onAddSpellDeliveryVisual
        }));

        await act(async () => {
            await (result.current.executeAbility as any)(
                touchAbility,
                familiarCaster,
                touchTarget.position,
                [touchTarget.id]
            );
        });

        expect(onCharacterUpdate).toHaveBeenCalledWith(expect.objectContaining({
            id: familiar.id,
            actionEconomy: expect.objectContaining({
                reaction: expect.objectContaining({
                    used: true
                })
            })
        }));
        expect(onAddSpellDeliveryVisual).toHaveBeenCalledWith(expect.objectContaining({
            spellId: touchSpell.id,
            casterId: familiarCaster.id,
            deliveryActorId: familiar.id,
            familiarId: familiar.id,
            targetId: touchTarget.id,
            label: 'TOUCH DELIVERY'
        }));
    });

    it('spends a familiar action when touch delivery declares an action cost', async () => {
        const { CommandExecutor } = await import('../../commands');
        const familiarCaster: CombatCharacter = {
            ...defender,
            id: 'action-cost-familiar-caster',
            name: 'Action-Cost Familiar Caster',
            team: 'player',
            position: { x: 0, y: 0 }
        };
        const touchTarget: CombatCharacter = {
            ...attacker,
            id: 'action-cost-touch-target',
            name: 'Action-Cost Touch Target',
            team: 'enemy',
            position: { x: 3, y: 0 }
        };
        const familiar: CombatCharacter = {
            ...defender,
            id: 'action-cost-familiar',
            name: 'Action-Cost Familiar',
            team: 'player',
            position: { x: 2, y: 0 },
            isSummon: true,
            summonMetadata: {
                casterId: 'action-cost-familiar-caster',
                spellId: 'future-touch-delivery-summon',
                entityType: 'familiar',
                sourceName: 'Future Touch Delivery Summon',
                actionPermissions: {
                    canDeliverTouchSpells: true,
                    touchDeliveryRangeFeet: 100,
                    touchDeliveryCost: 'action'
                },
                dismissable: true
            },
            actionEconomy: {
                ...defender.actionEconomy,
                action: { used: false, remaining: 1 },
                reaction: { used: false, remaining: 1 }
            }
        };
        const touchSpell: Spell = {
            id: 'action-cost-touch-spell',
            name: 'Action-Cost Touch Spell',
            level: 1,
            school: 'Necromancy',
            classes: ['Cleric'],
            description: 'A touch spell for non-reaction familiar delivery proof.',
            castingTime: { value: 1, unit: 'action' },
            range: { type: 'touch', distance: 5 },
            components: { verbal: true, somatic: true, material: false },
            duration: { type: 'instantaneous', concentration: false },
            targeting: { type: 'single', validTargets: ['enemies'] },
            effects: []
        } as unknown as Spell;
        const touchAbility: Ability = {
            id: 'action-cost-touch-ability',
            name: 'Action-Cost Touch Spell',
            description: 'A touch spell for non-reaction familiar delivery proof.',
            type: 'spell',
            range: 1,
            targeting: 'single_enemy',
            cost: { type: 'action' },
            effects: [],
            spell: touchSpell
        } as unknown as Ability;
        const onCharacterUpdate = vi.fn();

        // This distance setup forces the normal spell to be delivered through the
        // permissioned summoned actor. The caster cannot touch the target directly,
        // while the familiar is close enough to both the caster and target.
        vi.mocked(combatUtils.getCharacterDistance).mockImplementation((first, second) => {
            const ids = new Set([first.id, second.id]);
            if (ids.has('action-cost-familiar-caster') && ids.has('action-cost-touch-target')) return 3;
            if (ids.has('action-cost-familiar-caster') && ids.has('action-cost-familiar')) return 2;
            if (ids.has('action-cost-familiar') && ids.has('action-cost-touch-target')) return 1;
            return 5;
        });
        vi.mocked(CommandExecutor.execute).mockReturnValueOnce({
            success: true,
            finalState: {
                characters: [familiarCaster, touchTarget, familiar],
                combatLog: [],
                reactiveTriggers: [],
                activeLightSources: []
            }
        } as any);

        const { result } = renderHook(() => useAbilitySystem({
            characters: [familiarCaster, touchTarget, familiar],
            mapData: null,
            onExecuteAction: vi.fn(() => true),
            onCharacterUpdate,
            onLogEntry: vi.fn(),
            onAbilityEffect: vi.fn()
        }));

        await act(async () => {
            await (result.current.executeAbility as any)(
                touchAbility,
                familiarCaster,
                touchTarget.position,
                [touchTarget.id]
            );
        });

        expect(onCharacterUpdate).toHaveBeenCalledWith(expect.objectContaining({
            id: familiar.id,
            actionEconomy: expect.objectContaining({
                action: expect.objectContaining({
                    used: true
                }),
                reaction: expect.objectContaining({
                    used: false,
                    remaining: 1
                })
            })
        }));
    });

    it('spends a familiar bonus action when touch delivery declares a bonus-action cost', async () => {
        const { CommandExecutor } = await import('../../commands');
        const familiarCaster: CombatCharacter = {
            ...defender,
            id: 'bonus-cost-familiar-caster',
            name: 'Bonus-Cost Familiar Caster',
            team: 'player',
            position: { x: 0, y: 0 }
        };
        const touchTarget: CombatCharacter = {
            ...attacker,
            id: 'bonus-cost-touch-target',
            name: 'Bonus-Cost Touch Target',
            team: 'enemy',
            position: { x: 3, y: 0 }
        };
        const familiar: CombatCharacter = {
            ...defender,
            id: 'bonus-cost-familiar',
            name: 'Bonus-Cost Familiar',
            team: 'player',
            position: { x: 2, y: 0 },
            isSummon: true,
            summonMetadata: {
                casterId: 'bonus-cost-familiar-caster',
                spellId: 'future-bonus-touch-delivery-summon',
                entityType: 'familiar',
                sourceName: 'Future Bonus Touch Delivery Summon',
                actionPermissions: {
                    canDeliverTouchSpells: true,
                    touchDeliveryRangeFeet: 100,
                    touchDeliveryCost: 'bonus_action'
                },
                dismissable: true
            },
            actionEconomy: {
                ...defender.actionEconomy,
                action: { used: false, remaining: 1 },
                bonusAction: { used: false, remaining: 1 },
                reaction: { used: false, remaining: 1 }
            }
        };
        const touchSpell: Spell = {
            id: 'bonus-cost-touch-spell',
            name: 'Bonus-Cost Touch Spell',
            level: 1,
            school: 'Necromancy',
            classes: ['Cleric'],
            description: 'A touch spell for bonus-action familiar delivery proof.',
            castingTime: { value: 1, unit: 'action' },
            range: { type: 'touch', distance: 5 },
            components: { verbal: true, somatic: true, material: false },
            duration: { type: 'instantaneous', concentration: false },
            targeting: { type: 'single', validTargets: ['enemies'] },
            effects: []
        } as unknown as Spell;
        const touchAbility: Ability = {
            id: 'bonus-cost-touch-ability',
            name: 'Bonus-Cost Touch Spell',
            description: 'A touch spell for bonus-action familiar delivery proof.',
            type: 'spell',
            range: 1,
            targeting: 'single_enemy',
            cost: { type: 'action' },
            effects: [],
            spell: touchSpell
        } as unknown as Ability;
        const onCharacterUpdate = vi.fn();

        // This distance setup again forces summoned-actor delivery, but this time
        // the cost bridge must spend the actor's Bonus Action instead of the
        // Find Familiar default Reaction.
        vi.mocked(combatUtils.getCharacterDistance).mockImplementation((first, second) => {
            const ids = new Set([first.id, second.id]);
            if (ids.has('bonus-cost-familiar-caster') && ids.has('bonus-cost-touch-target')) return 3;
            if (ids.has('bonus-cost-familiar-caster') && ids.has('bonus-cost-familiar')) return 2;
            if (ids.has('bonus-cost-familiar') && ids.has('bonus-cost-touch-target')) return 1;
            return 5;
        });
        vi.mocked(CommandExecutor.execute).mockReturnValueOnce({
            success: true,
            finalState: {
                characters: [familiarCaster, touchTarget, familiar],
                combatLog: [],
                reactiveTriggers: [],
                activeLightSources: []
            }
        } as any);

        const { result } = renderHook(() => useAbilitySystem({
            characters: [familiarCaster, touchTarget, familiar],
            mapData: null,
            onExecuteAction: vi.fn(() => true),
            onCharacterUpdate,
            onLogEntry: vi.fn(),
            onAbilityEffect: vi.fn()
        }));

        await act(async () => {
            await (result.current.executeAbility as any)(
                touchAbility,
                familiarCaster,
                touchTarget.position,
                [touchTarget.id]
            );
        });

        expect(onCharacterUpdate).toHaveBeenCalledWith(expect.objectContaining({
            id: familiar.id,
            actionEconomy: expect.objectContaining({
                action: expect.objectContaining({
                    used: false,
                    remaining: 1
                }),
                bonusAction: expect.objectContaining({
                    used: true
                }),
                reaction: expect.objectContaining({
                    used: false,
                    remaining: 1
                })
            })
        }));
    });

    it('spends a familiar free action when touch delivery declares a limited free cost', async () => {
        const { CommandExecutor } = await import('../../commands');
        const familiarCaster: CombatCharacter = {
            ...defender,
            id: 'free-cost-familiar-caster',
            name: 'Free-Cost Familiar Caster',
            team: 'player',
            position: { x: 0, y: 0 }
        };
        const touchTarget: CombatCharacter = {
            ...attacker,
            id: 'free-cost-touch-target',
            name: 'Free-Cost Touch Target',
            team: 'enemy',
            position: { x: 3, y: 0 }
        };
        const familiar: CombatCharacter = {
            ...defender,
            id: 'free-cost-familiar',
            name: 'Free-Cost Familiar',
            team: 'player',
            position: { x: 2, y: 0 },
            isSummon: true,
            summonMetadata: {
                casterId: 'free-cost-familiar-caster',
                spellId: 'future-free-touch-delivery-summon',
                entityType: 'familiar',
                sourceName: 'Future Free Touch Delivery Summon',
                actionPermissions: {
                    canDeliverTouchSpells: true,
                    touchDeliveryRangeFeet: 100,
                    touchDeliveryCost: 'free'
                },
                dismissable: true
            },
            actionEconomy: {
                ...defender.actionEconomy,
                action: { used: false, remaining: 1 },
                reaction: { used: false, remaining: 1 },
                freeActions: 1
            }
        };
        const touchSpell: Spell = {
            id: 'free-cost-touch-spell',
            name: 'Free-Cost Touch Spell',
            level: 1,
            school: 'Necromancy',
            classes: ['Cleric'],
            description: 'A touch spell for limited-free familiar delivery proof.',
            castingTime: { value: 1, unit: 'action' },
            range: { type: 'touch', distance: 5 },
            components: { verbal: true, somatic: true, material: false },
            duration: { type: 'instantaneous', concentration: false },
            targeting: { type: 'single', validTargets: ['enemies'] },
            effects: []
        } as unknown as Spell;
        const touchAbility: Ability = {
            id: 'free-cost-touch-ability',
            name: 'Free-Cost Touch Spell',
            description: 'A touch spell for limited-free familiar delivery proof.',
            type: 'spell',
            range: 1,
            targeting: 'single_enemy',
            cost: { type: 'action' },
            effects: [],
            spell: touchSpell
        } as unknown as Ability;
        const onCharacterUpdate = vi.fn();

        // The free-cost path is still a limited economy spend. This fixture keeps
        // action and reaction available so the assertion can prove only the free
        // action pool changed.
        vi.mocked(combatUtils.getCharacterDistance).mockImplementation((first, second) => {
            const ids = new Set([first.id, second.id]);
            if (ids.has('free-cost-familiar-caster') && ids.has('free-cost-touch-target')) return 3;
            if (ids.has('free-cost-familiar-caster') && ids.has('free-cost-familiar')) return 2;
            if (ids.has('free-cost-familiar') && ids.has('free-cost-touch-target')) return 1;
            return 5;
        });
        vi.mocked(CommandExecutor.execute).mockReturnValueOnce({
            success: true,
            finalState: {
                characters: [familiarCaster, touchTarget, familiar],
                combatLog: [],
                reactiveTriggers: [],
                activeLightSources: []
            }
        } as any);

        const { result } = renderHook(() => useAbilitySystem({
            characters: [familiarCaster, touchTarget, familiar],
            mapData: null,
            onExecuteAction: vi.fn(() => true),
            onCharacterUpdate,
            onLogEntry: vi.fn(),
            onAbilityEffect: vi.fn()
        }));

        await act(async () => {
            await (result.current.executeAbility as any)(
                touchAbility,
                familiarCaster,
                touchTarget.position,
                [touchTarget.id]
            );
        });

        expect(onCharacterUpdate).toHaveBeenCalledWith(expect.objectContaining({
            id: familiar.id,
            actionEconomy: expect.objectContaining({
                action: expect.objectContaining({
                    used: false,
                    remaining: 1
                }),
                reaction: expect.objectContaining({
                    used: false,
                    remaining: 1
                }),
                freeActions: 0
            })
        }));
    });

    it('does not spend delivery-actor economy when touch delivery declares no cost', async () => {
        const { CommandExecutor } = await import('../../commands');
        const familiarCaster: CombatCharacter = {
            ...defender,
            id: 'none-cost-familiar-caster',
            name: 'No-Cost Familiar Caster',
            team: 'player',
            position: { x: 0, y: 0 }
        };
        const touchTarget: CombatCharacter = {
            ...attacker,
            id: 'none-cost-touch-target',
            name: 'No-Cost Touch Target',
            team: 'enemy',
            position: { x: 3, y: 0 }
        };
        const familiar: CombatCharacter = {
            ...defender,
            id: 'none-cost-familiar',
            name: 'No-Cost Familiar',
            team: 'player',
            position: { x: 2, y: 0 },
            isSummon: true,
            summonMetadata: {
                casterId: 'none-cost-familiar-caster',
                spellId: 'future-none-touch-delivery-summon',
                entityType: 'familiar',
                sourceName: 'Future No-Cost Touch Delivery Summon',
                actionPermissions: {
                    canDeliverTouchSpells: true,
                    touchDeliveryRangeFeet: 100,
                    touchDeliveryCost: 'none'
                },
                dismissable: true
            },
            actionEconomy: {
                ...defender.actionEconomy,
                action: { used: true, remaining: 0 },
                bonusAction: { used: true, remaining: 0 },
                reaction: { used: true, remaining: 0 },
                freeActions: 0
            }
        };
        const touchSpell: Spell = {
            id: 'none-cost-touch-spell',
            name: 'No-Cost Touch Spell',
            level: 1,
            school: 'Necromancy',
            classes: ['Cleric'],
            description: 'A touch spell for no-cost familiar delivery proof.',
            castingTime: { value: 1, unit: 'action' },
            range: { type: 'touch', distance: 5 },
            components: { verbal: true, somatic: true, material: false },
            duration: { type: 'instantaneous', concentration: false },
            targeting: { type: 'single', validTargets: ['enemies'] },
            effects: []
        } as unknown as Spell;
        const touchAbility: Ability = {
            id: 'none-cost-touch-ability',
            name: 'No-Cost Touch Spell',
            description: 'A touch spell for no-cost familiar delivery proof.',
            type: 'spell',
            range: 1,
            targeting: 'single_enemy',
            cost: { type: 'action' },
            effects: [],
            spell: touchSpell
        } as unknown as Ability;
        const onCharacterUpdate = vi.fn();

        // A true no-cost delivery permission should not be confused with a
        // limited free-action cost. The actor starts with every economy bucket
        // spent, and the spell should still resolve because the permission says
        // delivery itself has no actor-side cost.
        vi.mocked(combatUtils.getCharacterDistance).mockImplementation((first, second) => {
            const ids = new Set([first.id, second.id]);
            if (ids.has('none-cost-familiar-caster') && ids.has('none-cost-touch-target')) return 3;
            if (ids.has('none-cost-familiar-caster') && ids.has('none-cost-familiar')) return 2;
            if (ids.has('none-cost-familiar') && ids.has('none-cost-touch-target')) return 1;
            return 5;
        });
        vi.mocked(CommandExecutor.execute).mockReturnValueOnce({
            success: true,
            finalState: {
                characters: [familiarCaster, touchTarget, familiar],
                combatLog: [],
                reactiveTriggers: [],
                activeLightSources: []
            }
        } as any);

        const { result } = renderHook(() => useAbilitySystem({
            characters: [familiarCaster, touchTarget, familiar],
            mapData: null,
            onExecuteAction: vi.fn(() => true),
            onCharacterUpdate,
            onLogEntry: vi.fn(),
            onAbilityEffect: vi.fn()
        }));

        await act(async () => {
            await (result.current.executeAbility as any)(
                touchAbility,
                familiarCaster,
                touchTarget.position,
                [touchTarget.id]
            );
        });

        expect(CommandExecutor.execute).toHaveBeenCalled();
        expect(onCharacterUpdate).not.toHaveBeenCalledWith(expect.objectContaining({
            id: familiar.id
        }));
    });

    it('should log why a selected target cannot be used instead of failing silently', async () => {
        const shortAttack: Ability = {
            ...basicAttack,
            id: 'short-strike',
            name: 'Short Strike',
            range: 1
        };
        const localExecuteAction = vi.fn(() => true);
        const localLogEntry = vi.fn();
        const validationMap: BattleMapData = {
            tiles: new Map([
                ['0-0', { id: '0-0', coordinates: { x: 0, y: 0 }, terrain: 'floor', decoration: null, blocksMovement: false, blocksLoS: false, movementCost: 1, elevation: 0, effects: [] }],
                ['1-0', { id: '1-0', coordinates: { x: 1, y: 0 }, terrain: 'floor', decoration: null, blocksMovement: false, blocksLoS: false, movementCost: 1, elevation: 0, effects: [] }]
            ]),
            dimensions: { width: 10, height: 10 },
            theme: 'forest',
            seed: 1
        };

        const { result } = renderHook(() => useAbilitySystem({
            characters: [attacker, defender],
            // This two-tile map is enough for targeting validation. The mocked
            // distance helper reports a larger distance, which lets the test
            // focus on out-of-range feedback without depending on map geometry.
            mapData: validationMap,
            onExecuteAction: localExecuteAction,
            onCharacterUpdate: mockCharacterUpdate,
            onLogEntry: localLogEntry,
            onAbilityEffect: mockAbilityEffect
        }));

        act(() => {
            result.current.startTargeting(shortAttack, defender);
        });

        let didSelect = true;
        act(() => {
            didSelect = result.current.selectTarget(attacker.position, defender);
        });

        expect(didSelect).toBe(false);
        expect(localExecuteAction).not.toHaveBeenCalled();
        expect(localLogEntry).toHaveBeenCalledWith(expect.objectContaining({
            type: 'action',
            characterId: defender.id,
            message: expect.stringContaining('Attacker is too far away for Short Strike.')
        }));
    });
});

// ============================================================================
// Target-Move Debuff Registration
// ============================================================================
// on_target_move effects are delayed spell payloads: the spell cast creates a
// movement debuff, and the movement executor consumes it later when the target
// moves. This coverage protects the cast-time registration bridge and the saved
// spell DC captured for later trigger resolution.
// ============================================================================
