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

describe('useAbilitySystem - active light source live-state bridge', () => {
    it('publishes spell-created light sources from command results', async () => {
        const { CommandExecutor } = await import('../../commands');
        const createdLight: LightSource = {
            id: 'light-source-1',
            sourceSpellId: 'light',
            casterId: defender.id,
            brightRadius: 20,
            dimRadius: 20,
            attachedTo: 'caster',
            attachedToCharacterId: defender.id,
            opaqueCoverBlocks: true,
            createdTurn: 0
        };
        const lightSpell: Spell = {
            id: 'light',
            name: 'Light',
            level: 0,
            school: 'Evocation',
            classes: ['Wizard'],
            description: 'Creates a glowing light.',
            castingTime: { value: 1, unit: 'action' },
            range: { type: 'touch', distance: 5 },
            components: { verbal: true, somatic: false, material: true },
            duration: { type: 'timed', value: 1, unit: 'hour', concentration: false },
            targeting: { type: 'self', validTargets: ['self'] },
            effects: [{
                type: 'UTILITY',
                utilityType: 'light',
                description: 'Creates bright and dim light.',
                light: {
                    brightRadius: 20,
                    dimRadius: 20,
                    attachedTo: 'caster',
                    opaqueCoverBlocks: true
                },
                trigger: { type: 'immediate' },
                condition: { type: 'always' }
            }]
        } as unknown as Spell;
        const lightAbility: Ability = {
            id: 'light-ability',
            name: 'Light',
            description: 'Creates a glowing light.',
            type: 'spell',
            range: 5,
            targeting: 'self',
            cost: { type: 'action' },
            effects: [],
            spell: lightSpell
        } as unknown as Ability;
        const onActiveLightSourcesUpdate = vi.fn();

        vi.mocked(CommandExecutor.execute).mockReturnValueOnce({
            success: true,
            finalState: {
                characters: [defender],
                combatLog: [],
                reactiveTriggers: [],
                activeLightSources: [createdLight]
            }
        } as any);

        const { result } = renderHook(() => useAbilitySystem({
            characters: [defender],
            mapData: null,
            onExecuteAction: vi.fn(() => true),
            onCharacterUpdate: vi.fn(),
            onLogEntry: vi.fn(),
            onAbilityEffect: vi.fn(),
            onActiveLightSourcesUpdate
        }));

        await act(async () => {
            await (result.current.executeAbility as any)(
                lightAbility,
                defender,
                defender.position,
                [defender.id]
            );
        });

        expect(onActiveLightSourcesUpdate).toHaveBeenCalledWith([createdLight]);
    });

    it('starts command execution from current lights and publishes concentration light cleanup', async () => {
        const { CommandExecutor } = await import('../../commands');
        const existingLight: LightSource = {
            id: 'linked-light',
            sourceSpellId: 'faerie-fire',
            casterId: defender.id,
            brightRadius: 10,
            dimRadius: 10,
            attachedTo: 'caster',
            attachedToCharacterId: defender.id,
            createdTurn: 0
        };
        const concentratingDefender: CombatCharacter = {
            ...defender,
            concentratingOn: {
                spellId: 'faerie-fire',
                spellName: 'Faerie Fire',
                spellLevel: 1,
                startedTurn: 0,
                effectIds: ['linked-light'],
                canDropAsFreeAction: true
            }
        };
        const onActiveLightSourcesUpdate = vi.fn();

        vi.mocked(CommandExecutor.execute).mockReturnValueOnce({
            success: true,
            finalState: {
                characters: [{ ...concentratingDefender, concentratingOn: undefined }],
                combatLog: [],
                reactiveTriggers: [],
                activeLightSources: []
            }
        } as any);

        const { result } = renderHook(() => useAbilitySystem({
            characters: [concentratingDefender],
            mapData: null,
            onExecuteAction: vi.fn(() => true),
            onCharacterUpdate: vi.fn(),
            onLogEntry: vi.fn(),
            onAbilityEffect: vi.fn(),
            activeLightSources: [existingLight],
            onActiveLightSourcesUpdate
        }));

        await act(async () => {
            await result.current.dropConcentration(concentratingDefender);
        });

        // The break-concentration command should receive the existing light
        // array so linked light cleanup has something real to remove.
        expect(vi.mocked(CommandExecutor.execute).mock.calls.at(-1)?.[1]).toEqual(expect.objectContaining({
            activeLightSources: [existingLight]
        }));
        expect(onActiveLightSourcesUpdate).toHaveBeenCalledWith([]);
    });

    it('starts concentration cleanup from current spell zones and publishes zone removal', async () => {
        const { CommandExecutor } = await import('../../commands');
        const existingZone: ActiveSpellZone = {
            id: 'grease-zone',
            spellId: 'grease',
            casterId: defender.id,
            position: { x: 2, y: 2 },
            areaOfEffect: { shape: 'square', size: 10 },
            effects: [],
            triggeredThisTurn: new Set(),
            triggeredEver: new Set()
        };
        const concentratingDefender: CombatCharacter = {
            ...defender,
            concentratingOn: {
                spellId: 'grease',
                spellName: 'Grease',
                spellLevel: 1,
                startedTurn: 0,
                effectIds: ['grease-zone'],
                canDropAsFreeAction: true
            }
        };
        const onSpellZonesUpdate = vi.fn();
        const mapData = {
            tiles: new Map(),
            dimensions: { width: 3, height: 3 },
            theme: 'dungeon'
        } as BattleMapData;
        const cleanedMapData = {
            ...mapData,
            tiles: new Map()
        } as BattleMapData;
        const onMapUpdate = vi.fn();

        vi.mocked(CommandExecutor.execute).mockReturnValueOnce({
            success: true,
            finalState: {
                characters: [{ ...concentratingDefender, concentratingOn: undefined }],
                combatLog: [],
                reactiveTriggers: [],
                spellZones: [],
                mapData: cleanedMapData
            }
        
        } as any);

        const { result } = renderHook(() => useAbilitySystem({
            characters: [concentratingDefender],
            mapData,
            onExecuteAction: vi.fn(() => true),
            onCharacterUpdate: vi.fn(),
            onLogEntry: vi.fn(),
            onAbilityEffect: vi.fn(),
            spellZones: [existingZone],
            onSpellZonesUpdate,
            onMapUpdate
        }));

        await act(async () => {
            await result.current.dropConcentration(concentratingDefender);
        });

        expect(vi.mocked(CommandExecutor.execute).mock.calls.at(-1)?.[1]).toEqual(expect.objectContaining({
            spellZones: [existingZone],
            mapData
        }));
        expect(onSpellZonesUpdate).toHaveBeenCalledWith([]);
        expect(onMapUpdate).toHaveBeenCalledWith(cleanedMapData);
    });

    it('publishes object result records from command execution for map markers', async () => {
        const { CommandExecutor } = await import('../../commands');
        const objectImpact = {
            id: 'impact-1',
            objectId: 'dry-crate',
            objectName: 'Dry Crate',
            position: { x: 2, y: 1 },
            sourceSpellId: 'fire-bolt',
            sourceSpellName: 'Fire Bolt',
            casterId: defender.id,
            damage: { dice: '1d10', type: 'fire' },
            createdTurn: 0
        };
        const fireEffect = {
            id: 'fire-1',
            spellId: 'fire-bolt',
            sourceName: 'Fire Bolt',
            casterId: defender.id,
            position: { x: 2, y: 1 },
            createdTurn: 0,
            kind: 'ignited_object',
            objectId: 'dry-crate',
            objectName: 'Dry Crate',
            damage: { dice: '1d10', type: 'fire' },
            ignitesTouchedObjects: true,
            excludesWornOrCarriedObjects: true
        };
        const objectRepair = {
            id: 'repair-1',
            objectId: 'cracked-vase',
            objectName: 'Cracked Vase',
            position: { x: 3, y: 1 },
            sourceSpellId: 'mending',
            sourceSpellName: 'Mending',
            casterId: defender.id,
            createdTurn: 0,
            outcome: 'repaired',
            repairState: {
                targetKind: 'object',
                repairLimit: 'single_break_or_tear',
                maxDamageDimensionFeet: 1,
                leavesNoTrace: true,
                canPhysicallyRepairMagicItem: true,
                restoresMagicToMagicItem: false
            }
        };
        const transformation: ActiveTruePolymorphTransformation = {
            id: 'true-polymorph-transformation-1',
            mode: 'object_to_creature',
            spellId: 'true-polymorph',
            spellName: 'True Polymorph',
            casterId: defender.id,
            sourceObjectId: 'loose-boulder',
            sourceObjectName: 'Loose Boulder',
            sourceObjectPosition: { x: 4, y: 1 },
            transformedCreatureId: 'loose-boulder-creature',
            controlledUntilFullDuration: true,
            createdTurn: 0
        };
        const objectAccessChange: SpellObjectAccessChange = {
            id: 'access-1',
            objectId: 'locked-door',
            objectName: 'Locked Door',
            position: { x: 5, y: 1 },
            sourceSpellId: 'knock',
            sourceSpellName: 'Knock',
            casterId: defender.id,
            createdTurn: 0,
            outcome: 'suppressed_magical_lock',
            suppressesMagicalClosure: 'arcane-lock',
            targetOperableDuringSuppression: true
        };
        const onSpellObjectImpactsUpdate = vi.fn();
        const onSpellObjectRepairsUpdate = vi.fn();
        const onSpellObjectAccessChangesUpdate = vi.fn();
        const onActiveFireEffectsUpdate = vi.fn();
        const onActiveTruePolymorphTransformationsUpdate = vi.fn();

        vi.mocked(CommandExecutor.execute).mockReturnValueOnce({
            success: true,
            finalState: {
                characters: [defender],
                combatLog: [],
                reactiveTriggers: [],
                spellObjectImpacts: [objectImpact],
                spellObjectRepairs: [objectRepair],
                spellObjectAccessChanges: [objectAccessChange],
                activeFireEffects: [fireEffect],
                activeTruePolymorphTransformations: [transformation]
            }
        } as any);

        const { result } = renderHook(() => useAbilitySystem({
            characters: [defender],
            mapData: null,
            onExecuteAction: vi.fn(() => true),
            onCharacterUpdate: vi.fn(),
            onLogEntry: vi.fn(),
            onAbilityEffect: vi.fn(),
            onSpellObjectImpactsUpdate,
            onSpellObjectRepairsUpdate,
            onSpellObjectAccessChangesUpdate,
            onActiveFireEffectsUpdate,
            onActiveTruePolymorphTransformationsUpdate
        }));

        await act(async () => {
            await (result.current.executeAbility as any)(
                basicAttack,
                defender,
                defender.position,
                [defender.id]
            );
        });

        expect(onSpellObjectImpactsUpdate).toHaveBeenCalledWith([objectImpact]);
        expect(onSpellObjectRepairsUpdate).toHaveBeenCalledWith([objectRepair]);
        expect(onSpellObjectAccessChangesUpdate).toHaveBeenCalledWith([objectAccessChange]);
        expect(onActiveFireEffectsUpdate).toHaveBeenCalledWith([fireEffect]);
        expect(onActiveTruePolymorphTransformationsUpdate).toHaveBeenCalledWith([transformation]);
    });
});

// ============================================================================
// Free-Form Input Target Metadata Bridge
// ============================================================================
// Some spells ask the player for text after the map/object target has already
// been selected. This guard proves the follow-up input callback resumes the
// same command path with the selected target metadata still attached.
// ============================================================================
