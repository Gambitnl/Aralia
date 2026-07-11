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

describe('useAbilitySystem - free-form player input target bridge', () => {
    it('preserves selected spell targets when generic AI input is collected', async () => {
        const { SpellCommandFactory } = await import('../../commands');
        const freeformSpell: Spell = {
            id: 'minor-illusion',
            name: 'Minor Illusion',
            level: 0,
            school: 'Illusion',
            classes: ['Wizard'],
            description: 'Create a described image or sound at the selected place.',
            castingTime: { value: 1, unit: 'action' },
            range: { type: 'distance', distance: 30 },
            components: { verbal: false, somatic: true, material: true },
            duration: { type: 'timed', value: 1, unit: 'minute', concentration: false },
            targeting: { type: 'point', validTargets: ['point'], range: 30 },
            arbitrationType: 'ai_dm',
            aiContext: {
                prompt: 'Describe the image or sound.',
                playerInputRequired: true
            },
            effects: [{
                type: 'UTILITY',
                utilityType: 'sensory',
                description: 'Creates a harmless illusion.',
                trigger: { type: 'immediate' },
                condition: { type: 'always' }
            }]
        } as unknown as Spell;
        const selectedSpellTargets: SelectedSpellTarget[] = [{
            kind: 'point',
            position: { x: 3, y: 3 },
            purpose: 'ground_target'
        } as unknown as SelectedSpellTarget];
        let confirmInput: ((input: string) => void) | null = null;
        const onRequestInput = vi.fn((_spell: Spell, onConfirm: (input: string) => void) => {
            // Capture the modal callback instead of auto-confirming so the
            // assertion can prove command creation waits for the player's text.
            confirmInput = onConfirm;
        });
        const { result } = renderHook(() => useAbilitySystem({
            characters: [attacker, defender],
            mapData: null,
            onExecuteAction: vi.fn(() => true),
            onCharacterUpdate: vi.fn(),
            onLogEntry: vi.fn(),
            onAbilityEffect: vi.fn(),
            onRequestInput
        }));

        await act(async () => {
            await result.current.executeSpell(
                freeformSpell,
                attacker,
                [defender],
                0,
                undefined,
                undefined,
                undefined,
                selectedSpellTargets
            );
        });

        expect(onRequestInput).toHaveBeenCalledWith(freeformSpell, expect.any(Function));
        expect(SpellCommandFactory.createCommands).not.toHaveBeenCalled();

        await act(async () => {
            confirmInput?.('A faint bell rings from the marked square.');
        });

        await _waitFor(() => expect(SpellCommandFactory.createCommands).toHaveBeenCalled());

        // SpellCommandFactory receives selectedSpellTargets as its final
        // argument. Keeping the exact array proves the input callback did not
        // drop object/point target context while waiting for the modal.
        expect(vi.mocked(SpellCommandFactory.createCommands).mock.calls.at(-1)?.[8]).toBe(selectedSpellTargets);
    });
});
