import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCombatValidation } from '../useCombatValidation';
import { useActionExecutor } from '../useActionExecutor';
import type {
    Ability,
    BattleMapData,
    BattleMapTile,
    CombatAction,
    CombatCharacter,
} from '../../../types/combat';
import {
    mockCanAfford,
    mockConsumeAction,
    mockOnLogEntry,
    mockCharacter,
    mockTurnState,
    defaultProps,
    resetActionExecutorMocks,
} from './useActionExecutor.fixtures';

/**
 * This file proves the ability prerequisite gate in useCombatValidation and its
 * production wiring inside useActionExecutor (Agora task agora-d908).
 *
 * Called by: focused Vitest runtime proof for the combat prerequisite gate.
 * Depends on: useCombatValidation, useActionExecutor, and ActionValidator.
 */

const swordSwing: Ability = {
    id: 'sword-swing',
    name: 'Sword Swing',
    description: 'A weapon attack.',
    type: 'attack',
    cost: { type: 'action' },
    targeting: 'single_enemy',
    range: 1,
    effects: []
};

const firebolt: Ability = {
    id: 'firebolt',
    name: 'Fire Bolt',
    description: 'A spell attack.',
    type: 'spell',
    attackType: 'spell',
    cost: { type: 'action' },
    targeting: 'single_enemy',
    range: 24,
    effects: []
};

const hero: CombatCharacter = { ...mockCharacter, abilities: [swordSwing] };

const buildMap = (tileKeys: string[]): BattleMapData => ({
    dimensions: { width: 4, height: 4 },
    tiles: new Map<string, BattleMapTile>(tileKeys.map(key => {
        const [x, y] = key.split('-').map(Number);
        return [key, {
            id: key,
            coordinates: { x, y },
            terrain: 'grass',
            elevation: 0,
            movementCost: 1,
            blocksLoS: false,
            blocksMovement: false,
            decoration: 'none',
            effects: []
        } as unknown as BattleMapTile];
    })),
    theme: 'forest',
    seed: 1
} as unknown as BattleMapData);

const renderValidation = (characters: CombatCharacter[], mapData: BattleMapData | null = null) =>
    renderHook(() => useCombatValidation(characters, mapData)).result;

describe('useCombatValidation ability prerequisites', () => {
    it('allows an ordinary ability for a healthy, unencumbered caster', () => {
        const result = renderValidation([hero]);
        expect(result.current.checkAbilityUsable(hero, swordSwing)).toEqual({ usable: true });
        expect(result.current.isAbilityUsable(hero, swordSwing)).toBe(true);
    });

    it('refuses any ability while the caster is incapacitated', () => {
        const stunned: CombatCharacter = {
            ...hero,
            conditions: [{ name: 'stunned', duration: { type: 'permanent' }, appliedTurn: 1 }]
        };
        const check = renderValidation([stunned]).current.checkAbilityUsable(stunned, swordSwing);
        expect(check.usable).toBe(false);
        expect(check.code).toBe('INCAPACITATED');
    });

    it('refuses a weapon ability while disarmed but keeps spells usable', () => {
        const disarmed: CombatCharacter = {
            ...hero,
            conditions: [{ name: 'disarmed', duration: { type: 'permanent' }, appliedTurn: 1 }]
        };
        const validation = renderValidation([disarmed]).current;
        expect(validation.checkAbilityUsable(disarmed, swordSwing).code).toBe('DISARMED');
        expect(validation.checkAbilityUsable(disarmed, firebolt).usable).toBe(true);
    });

    it('refuses an ability that is still on cooldown or out of uses', () => {
        const validation = renderValidation([hero]).current;
        expect(validation.checkAbilityUsable(hero, { ...swordSwing, currentCooldown: 2 }).code)
            .toBe('ON_COOLDOWN');
        expect(validation.checkAbilityUsable(hero, { ...swordSwing, maxUses: 3, usesRemaining: 0 }).code)
            .toBe('USES_DEPLETED');
    });

    it('refuses an ability when the caster stands off the battle map', () => {
        const offMap: CombatCharacter = { ...hero, position: { x: 9, y: 9 } };
        const check = renderValidation([offMap], buildMap(['0-0', '1-0'])).current
            .checkAbilityUsable(offMap, swordSwing);
        expect(check.usable).toBe(false);
        expect(check.code).toBe('OFF_MAP');
    });

    it('enforces the adjacent position prerequisite against the live roster', () => {
        const shoulderCharge: Ability = {
            ...swordSwing,
            id: 'shoulder-charge',
            name: 'Shoulder Charge',
            prerequisites: { position: 'adjacent' }
        };
        const nearFoe: CombatCharacter = {
            ...mockCharacter, id: 'foe-near', name: 'Near Foe',
            team: 'enemy', position: { x: 1, y: 0 }, abilities: []
        };
        const farFoe: CombatCharacter = { ...nearFoe, id: 'foe-far', name: 'Far Foe', position: { x: 6, y: 0 } };

        expect(renderValidation([hero, nearFoe]).current
            .checkAbilityUsable(hero, shoulderCharge).usable).toBe(true);

        const missing = renderValidation([hero, farFoe]).current
            .checkAbilityUsable(hero, shoulderCharge);
        expect(missing.usable).toBe(false);
        expect(missing.code).toBe('NO_TARGET_IN_REACH');
    });

    it('enforces the minimum-movement prerequisite from movement already spent', () => {
        const pounce: Ability = {
            ...swordSwing, id: 'pounce', name: 'Pounce',
            prerequisites: { minimumMovement: 20 }
        };
        const stillStanding = renderValidation([hero]).current.checkAbilityUsable(hero, pounce);
        expect(stillStanding.code).toBe('INSUFFICIENT_MOVEMENT_TAKEN');

        const charged: CombatCharacter = {
            ...hero,
            actionEconomy: { ...hero.actionEconomy, movement: { used: 25, total: 30 } }
        };
        expect(renderValidation([charged]).current.checkAbilityUsable(charged, pounce).usable).toBe(true);
    });

    it('refuses an otherAbilityUsed prerequisite the caller cannot verify', () => {
        const followUp: Ability = {
            ...swordSwing, id: 'follow-up', name: 'Follow Up',
            prerequisites: { otherAbilityUsed: 'sword-swing' }
        };
        const validation = renderValidation([hero]).current;

        const unverifiable = validation.checkAbilityUsable(hero, followUp);
        expect(unverifiable.usable).toBe(false);
        expect(unverifiable.code).toBe('PREREQUISITE_UNVERIFIABLE');

        expect(validation.checkAbilityUsable(hero, followUp, { abilityIdsUsedThisTurn: ['sword-swing'] }).usable)
            .toBe(true);
        expect(validation.checkAbilityUsable(hero, followUp, { abilityIdsUsedThisTurn: [] }).usable)
            .toBe(false);
    });
});

describe('useActionExecutor ability prerequisite gate', () => {
    const depletedSwing: Ability = { ...swordSwing, maxUses: 1, usesRemaining: 0 };
    const gatedHero: CombatCharacter = { ...mockCharacter, abilities: [depletedSwing] };
    const action: CombatAction = {
        id: 'gated-ability',
        characterId: gatedHero.id,
        type: 'ability',
        abilityId: depletedSwing.id,
        cost: { type: 'action' },
        timestamp: Date.now()
    };

    it('rejects a depleted ability before any resource is spent', async () => {
        resetActionExecutorMocks();
        mockCanAfford.mockReturnValue(true);
        mockConsumeAction.mockReturnValue(gatedHero);

        const { result } = renderHook(() => useActionExecutor({
            ...defaultProps,
            characters: [gatedHero],
            turnState: { ...mockTurnState, currentCharacterId: gatedHero.id }
        }));

        expect(await result.current.executeAction(action)).toBe(false);
        expect(mockConsumeAction).not.toHaveBeenCalled();
        expect(mockOnLogEntry).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                rejectedReason: 'ability_prerequisite',
                prerequisiteCode: 'USES_DEPLETED'
            })
        }));
    });

    it('lets an ability with satisfied prerequisites through to payment', async () => {
        resetActionExecutorMocks();
        const readyHero: CombatCharacter = { ...mockCharacter, abilities: [swordSwing] };
        mockCanAfford.mockReturnValue(true);
        mockConsumeAction.mockReturnValue(readyHero);

        const { result } = renderHook(() => useActionExecutor({
            ...defaultProps,
            characters: [readyHero],
            turnState: { ...mockTurnState, currentCharacterId: readyHero.id }
        }));

        expect(await result.current.executeAction({ ...action, abilityId: swordSwing.id })).toBe(true);
        expect(mockConsumeAction).toHaveBeenCalled();
    });
});
