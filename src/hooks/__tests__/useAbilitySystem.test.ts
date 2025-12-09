
import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAbilitySystem } from '../useAbilitySystem';
import { CombatCharacter, Ability } from '../../types/combat';
import { Spell } from '../../types/spells';

// Mock dependencies
vi.mock('../combat/useTargeting', () => ({
    useTargeting: () => ({
        startTargeting: vi.fn(),
        cancelTargeting: vi.fn(),
        selectedAbility: null,
        targetingMode: null,
        aoePreview: null,
        params: null,
        previewAoE: vi.fn()
    })
}));

vi.mock('../../commands', () => ({
    SpellCommandFactory: { createCommands: vi.fn().mockResolvedValue([]) },
    CommandExecutor: { execute: vi.fn().mockReturnValue({ success: true, finalState: { characters: [], combatLog: [] } }) }
}));

vi.mock('../../utils/combatUtils', () => ({
    getDistance: () => 5,
    calculateDamage: () => 5,
    generateId: () => 'test-id',
    rollDice: () => 15 // Always roll high for testing hits
}));

// Mock Data Setup
const shieldSpell: Spell = {
    id: 'shield',
    name: 'Shield',
    level: 1,
    school: 'Abjuration',
    classes: ['Wizard'],
    description: 'Shield spell',
    castingTime: { value: 1, unit: 'reaction' },
    range: { type: 'self' },
    components: { verbal: true, somatic: true, material: false },
    duration: { type: 'timed', value: 1, unit: 'round', concentration: false },
    targeting: { type: 'self', validTargets: ['self'] },
    effects: [{
        type: 'DEFENSIVE',
        defenseType: 'ac_bonus',
        acBonus: 5,
        duration: { type: 'rounds', value: 1 },
        trigger: { type: 'immediate' },
        condition: { type: 'always' },
        reactionTrigger: { event: 'when_hit' }
    }]
} as any;

const attacker: CombatCharacter = {
    id: 'attacker',
    name: 'Attacker',
    team: 'enemy',
    position: { x: 0, y: 0 },
    currentHP: 10,
    maxHP: 10,
    stats: { strength: 18, dexterity: 10 },
    abilities: [],
    actionEconomy: { reaction: { remaining: 1, used: false }, action: {}, bonusAction: {}, movement: {} },
    statusEffects: [],
    level: 1
} as any;

const defender: CombatCharacter = {
    id: 'defender',
    name: 'Defender',
    team: 'player',
    position: { x: 1, y: 0 },
    currentHP: 10,
    maxHP: 10,
    armorClass: 10, // Low AC to ensure hit
    stats: { dexterity: 10 },
    abilities: [{ id: 'shield-ab', spell: shieldSpell, type: 'spell' } as any],
    actionEconomy: { reaction: { remaining: 1, used: false }, action: {}, bonusAction: {}, movement: {} },
    statusEffects: [],
    level: 1
} as any;

const basicAttack: Ability = {
    id: 'attack',
    name: 'Attack',
    type: 'attack',
    range: 5,
    targeting: 'single_enemy',
    effects: [], // damage
    cost: { type: 'action' },
    isProficient: true
} as any;

describe('useAbilitySystem - Reactions', () => {
    const mockExecuteAction = vi.fn(() => true);
    const mockLogEntry = vi.fn();
    const mockCharacterUpdate = vi.fn();
    const mockAbilityEffect = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should prompt for reaction when attack hits and target has Shield', async () => {
        const { result } = renderHook(() => useAbilitySystem({
            characters: [attacker, defender],
            mapData: { tiles: new Map([['0-0', {}], ['1-0', {}]]), dimensions: { width: 10, height: 10 } } as any,
            onExecuteAction: mockExecuteAction,
            onCharacterUpdate: mockCharacterUpdate,
            onLogEntry: mockLogEntry,
            onAbilityEffect: mockAbilityEffect
        }));

        // Trigger Attack
        // executeAbility is async wrapped
        let executionPromise: Promise<void> | undefined;

        await act(async () => {
            // We cast to any because result.current.executeAbility signature might inferred slightly differently in test context
            executionPromise = (result.current.executeAbility as any)(
                basicAttack,
                attacker,
                defender.position,
                [defender.id]
            );
        });

        // The attack logic runs, rolls a 15 (mocked), checks AC 10 -> Hit.
        // It sees checks for reactions. Defender has Shield and reaction resource.
        // It sets pendingReaction.

        await waitFor(() => {
            expect(result.current.pendingReaction).not.toBeNull();
        }, { timeout: 1000 });

        expect(result.current.pendingReaction?.triggerType).toBe('on_hit');
        expect(result.current.pendingReaction?.targetId).toBe(defender.id);
        expect(result.current.pendingReaction?.reactionSpells).toHaveLength(1);
        expect(result.current.pendingReaction?.reactionSpells[0].id).toBe('shield');

        // Resolve Reaction: Cast Shield
        await act(async () => {
            result.current.pendingReaction?.onResolve('shield');
        });

        // Wait for ability execution to complete
        if (executionPromise) await executionPromise;

        // Assert Log Entry shows reaction
        // We look for the specific reaction message
        expect(mockLogEntry).toHaveBeenCalledWith(expect.objectContaining({
            type: 'action',
            data: expect.objectContaining({ reaction: true })
        }));

        // Also assert that the attack continued (hit or miss logic)
        // Since we blocked execution, verifying we reached the log means we resumed.
    });

    it('should continue immediately if reaction is declined', async () => {
        const { result } = renderHook(() => useAbilitySystem({
            characters: [attacker, defender],
            mapData: { tiles: new Map([['0-0', {}], ['1-0', {}]]), dimensions: { width: 10, height: 10 } } as any,
            onExecuteAction: mockExecuteAction,
            onCharacterUpdate: mockCharacterUpdate,
            onLogEntry: mockLogEntry,
            onAbilityEffect: mockAbilityEffect
        }));

        let executionPromise: Promise<void> | undefined;

        await act(async () => {
            executionPromise = (result.current.executeAbility as any)(
                basicAttack,
                attacker,
                defender.position,
                [defender.id]
            );
        });

        await waitFor(() => {
            expect(result.current.pendingReaction).not.toBeNull();
        });

        // Resolve Reaction: Null (Skip)
        await act(async () => {
            result.current.pendingReaction?.onResolve(null);
        });

        if (executionPromise) await executionPromise;

        // Should NOT have reaction log
        // But should have hit log
        expect(mockLogEntry).not.toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ reaction: true })
        }));
        expect(mockLogEntry).toHaveBeenCalledWith(expect.objectContaining({
            message: expect.stringMatching(/HITS/),
        }));
    });
});
