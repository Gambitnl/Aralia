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

describe('useAbilitySystem - selected object target refs', () => {
    it('passes registered map object refs into the combat action and spell command factory', async () => {
        vi.clearAllMocks();
        const { SpellCommandFactory } = await import('../../commands');
        const caster = {
            id: 'object-caster',
            name: 'Object Caster',
            team: 'player',
            position: { x: 0, y: 0 },
            actionEconomy: { action: { used: false }, bonusAction: { used: false }, reaction: { used: false }, movement: { used: 0, total: 30 } },
            spellSlots: { 1: { used: 0, total: 1 } },
            statusEffects: []
        } as unknown as CombatCharacter;
        const looseStone = {
            id: 'loose-stone',
            name: 'Loose Stone',
            position: { x: 1, y: 0 },
            size: 'Tiny',
            weightPounds: 2,
            isWornOrCarried: false,
            isMagical: false,
            isFixedToSurface: false
        };
        const mapData: BattleMapData = {
            dimensions: { width: 3, height: 3 },
            tiles: new Map([
                ['0-0', { id: '0-0', coordinates: { x: 0, y: 0 }, terrain: 'floor', decoration: null, blocksMovement: false, blocksLoS: false, movementCost: 1, elevation: 0, effects: [] }],
                ['1-0', { id: '1-0', coordinates: { x: 1, y: 0 }, terrain: 'floor', decoration: null, blocksMovement: false, blocksLoS: false, movementCost: 1, elevation: 0, effects: [] }]
            ]),
            theme: 'dungeon',
            seed: 13,
            targetableObjects: [looseStone]
        };
        const objectSpell: Spell = {
            id: 'catapult-object-ref-test',
            name: 'Catapult Object Ref Test',
            level: 1,
            school: 'Transmutation',
            classes: ['Wizard'],
            description: 'Targets a loose object without pretending it is a creature.',
            castingTime: { value: 1, unit: 'action' },
            range: { type: 'ranged', distance: 60 },
            components: { verbal: false, somatic: true, material: false },
            duration: { type: 'instantaneous' },
            targeting: {
                type: 'single',
                range: 60,
                validTargets: ['objects'],
                lineOfSight: false
            },
            effects: [{
                type: 'UTILITY',
                utilityType: 'object_interaction',
                description: 'Launches the selected object.',
                trigger: { type: 'immediate' },
                condition: { type: 'always' }
            }]
        } as unknown as Spell;
        const objectAbility = {
            id: objectSpell.id,
            name: objectSpell.name,
            type: 'spell',
            targeting: 'single_any',
            range: 60,
            cost: { type: 'action' },
            effects: [],
            spell: objectSpell
        } as unknown as Ability;
        const onExecuteAction = vi.fn(() => true);

        const { result } = renderHook(() => useAbilitySystem({
            characters: [caster],
            mapData,
            onExecuteAction,
            onCharacterUpdate: vi.fn(),
            onLogEntry: vi.fn(),
            onNotification: vi.fn(),
            onAbilityEffect: vi.fn()
        }));

        act(() => {
            result.current.startTargeting(objectAbility, caster);
        });

        let didSelect = false;
        await act(async () => {
            didSelect = result.current.selectTarget(looseStone.position, caster);
        });

        await _waitFor(() => expect(SpellCommandFactory.createCommands).toHaveBeenCalled());

        const expectedSelectedTargets = [{
            kind: 'object',
            id: 'loose-stone',
            name: 'Loose Stone',
            position: looseStone.position,
            object: looseStone
        }];

        expect(didSelect).toBe(true);
        expect(onExecuteAction).toHaveBeenCalledWith(expect.objectContaining({
            targetCharacterIds: [],
            selectedSpellTargets: expectedSelectedTargets
        }));
        expect(vi.mocked(SpellCommandFactory.createCommands).mock.calls.at(-1)?.[2]).toEqual([]);
        expect(vi.mocked(SpellCommandFactory.createCommands).mock.calls.at(-1)?.[8]).toEqual(expectedSelectedTargets);
    });

    it('surfaces registered map object positions as valid spell targets', () => {
        vi.clearAllMocks();
        const caster = {
            id: 'object-highlight-caster',
            name: 'Object Highlight Caster',
            team: 'player',
            position: { x: 0, y: 0 },
            actionEconomy: { action: { used: false }, bonusAction: { used: false }, reaction: { used: false }, movement: { used: 0, total: 30 } },
            spellSlots: { 1: { used: 0, total: 1 } },
            statusEffects: []
        } as unknown as CombatCharacter;
        const looseStone = {
            id: 'highlight-stone',
            name: 'Highlight Stone',
            position: { x: 1, y: 0 },
            size: 'Tiny',
            weightPounds: 2,
            isWornOrCarried: false,
            isMagical: false,
            isFixedToSurface: false
        };
        const mapData: BattleMapData = {
            dimensions: { width: 3, height: 3 },
            tiles: new Map([
                ['0-0', { id: '0-0', coordinates: { x: 0, y: 0 }, terrain: 'floor', decoration: null, blocksMovement: false, blocksLoS: false, movementCost: 1, elevation: 0, effects: [] }],
                ['1-0', { id: '1-0', coordinates: { x: 1, y: 0 }, terrain: 'floor', decoration: null, blocksMovement: false, blocksLoS: false, movementCost: 1, elevation: 0, effects: [] }]
            ]),
            theme: 'dungeon',
            seed: 17,
            targetableObjects: [looseStone]
        };
        const objectSpell: Spell = {
            id: 'catapult-highlight-test',
            name: 'Catapult Highlight Test',
            level: 1,
            school: 'Transmutation',
            classes: ['Wizard'],
            description: 'Highlights a loose object target.',
            castingTime: { value: 1, unit: 'action' },
            range: { type: 'ranged', distance: 60 },
            components: { verbal: false, somatic: true, material: false },
            duration: { type: 'instantaneous' },
            targeting: {
                type: 'single',
                range: 60,
                validTargets: ['objects'],
                lineOfSight: false
            },
            effects: [{
                type: 'UTILITY',
                utilityType: 'object_interaction',
                description: 'Launches the selected object.',
                trigger: { type: 'immediate' },
                condition: { type: 'always' }
            }]
        } as unknown as Spell;
        const objectAbility = {
            id: objectSpell.id,
            name: objectSpell.name,
            type: 'spell',
            targeting: 'single_any',
            range: 60,
            cost: { type: 'action' },
            effects: [],
            spell: objectSpell
        } as unknown as Ability;

        const { result } = renderHook(() => useAbilitySystem({
            characters: [caster],
            mapData,
            onExecuteAction: vi.fn(() => true),
            onCharacterUpdate: vi.fn(),
            onLogEntry: vi.fn(),
            onNotification: vi.fn(),
            onAbilityEffect: vi.fn()
        }));

        expect(result.current.getValidTargets(objectAbility, caster)).toContainEqual(looseStone.position);
    });

    it('surfaces object-specific rejection text when a registered map object fails spell eligibility', async () => {
        vi.clearAllMocks();
        const caster = {
            id: 'object-rejection-caster',
            name: 'Object Rejection Caster',
            team: 'player',
            position: { x: 0, y: 0 },
            actionEconomy: { action: { used: false }, bonusAction: { used: false }, reaction: { used: false }, movement: { used: 0, total: 30 } },
            spellSlots: { 1: { used: 0, total: 1 } },
            statusEffects: []
        } as unknown as CombatCharacter;
        const fixedDoor = {
            id: 'fixed-door',
            name: 'Fixed Door',
            position: { x: 1, y: 0 },
            size: 'Medium',
            weightPounds: 120,
            isWornOrCarried: false,
            isMagical: false,
            isFixedToSurface: true
        };
        const mapData: BattleMapData = {
            dimensions: { width: 3, height: 3 },
            tiles: new Map([
                ['0-0', { id: '0-0', coordinates: { x: 0, y: 0 }, terrain: 'floor', decoration: null, blocksMovement: false, blocksLoS: false, movementCost: 1, elevation: 0, effects: [] }],
                ['1-0', { id: '1-0', coordinates: { x: 1, y: 0 }, terrain: 'floor', decoration: null, blocksMovement: false, blocksLoS: false, movementCost: 1, elevation: 0, effects: [] }]
            ]),
            theme: 'dungeon',
            seed: 19,
            targetableObjects: [fixedDoor]
        };
        const objectSpell: Spell = {
            id: 'catapult-fixed-object-rejection-test',
            name: 'Catapult Fixed Object Rejection Test',
            level: 1,
            school: 'Transmutation',
            classes: ['Wizard'],
            description: 'Rejects fixed objects without falling back to creature-only text.',
            castingTime: { value: 1, unit: 'action' },
            range: { type: 'ranged', distance: 60 },
            components: { verbal: false, somatic: true, material: false },
            duration: { type: 'instantaneous' },
            targeting: {
                type: 'single',
                range: 60,
                validTargets: ['objects'],
                lineOfSight: false,
                filter: {
                    objectEligibility: {
                        fixedToSurface: 'excluded'
                    }
                }
            },
            effects: [{
                type: 'UTILITY',
                utilityType: 'object_interaction',
                description: 'Launches the selected object.',
                trigger: { type: 'immediate' },
                condition: { type: 'always' }
            }]
        } as unknown as Spell;
        const objectAbility = {
            id: objectSpell.id,
            name: objectSpell.name,
            type: 'spell',
            targeting: 'single_any',
            range: 60,
            cost: { type: 'action' },
            effects: [],
            spell: objectSpell
        } as unknown as Ability;
        const onNotification = vi.fn();
        const onLogEntry = vi.fn();

        const { result } = renderHook(() => useAbilitySystem({
            characters: [caster],
            mapData,
            onExecuteAction: vi.fn(() => true),
            onCharacterUpdate: vi.fn(),
            onLogEntry,
            onNotification,
            onAbilityEffect: vi.fn()
        }));

        act(() => {
            result.current.startTargeting(objectAbility, caster);
        });

        let didSelect = true;
        await act(async () => {
            didSelect = result.current.selectTarget(fixedDoor.position, caster);
        });

        expect(didSelect).toBe(false);
        expect(result.current.targetValidationReason).toBe('This spell cannot target an object fixed to a surface.');
        expect(onNotification).toHaveBeenCalledWith('This spell cannot target an object fixed to a surface.', 'error');
        expect(onLogEntry).toHaveBeenCalledWith(expect.objectContaining({
            message: 'This spell cannot target an object fixed to a surface.'
        }));
    });

});

// ============================================================================
// Immediate Forced-Movement Repeat Saves
// ============================================================================
// Scheduled movement has its own repeat-save bridge in useCombatEngine. Immediate
// spell casts resolve here through CommandExecutor, so this test protects the
// matching bridge that gives Compulsion-style statuses their save after a forced
// movement command actually moves the target.
// ============================================================================
