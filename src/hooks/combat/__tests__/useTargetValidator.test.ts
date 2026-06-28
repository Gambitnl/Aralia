import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { findTouchDeliveryActor, useTargetValidator } from '../useTargetValidator';
import type { Ability, BattleMapData, BattleMapTile, CombatCharacter } from '../../../types/combat';
import { createMockCombatCharacter } from '../../../utils/core/factories';
import findFamiliar from '../../../../public/data/spells/level-1/find-familiar.json';

/**
 * This test file covers the targeting rulebook used by the battle-map UI.
 *
 * The important player-facing behavior is not just whether a target is valid,
 * but whether the system can explain invalid clicks such as a melee attack
 * aimed at an enemy several grid tiles away. It also protects the controlled
 * touch-delivery bridge: a caster can target through a summoned actor only when
 * that actor has the right permission, range, adjacency, and declared delivery
 * cost available.
 *
 * Called by: Vitest focused hook/targeting checks.
 * Depends on: useTargetValidator, findTouchDeliveryActor, and combat test
 * factories.
 */

const createTile = (x: number, y: number): BattleMapTile => ({
    id: `${x}-${y}`,
    coordinates: { x, y },
    terrain: 'floor',
    elevation: 0,
    movementCost: 1,
    blocksMovement: false,
    blocksLoS: false,
    decoration: null,
    effects: []
});

const createMap = (width: number, height: number): BattleMapData => {
    const tiles = new Map<string, BattleMapTile>();

    // Build a complete rectangular test map so range, line-of-sight, and tile
    // existence checks behave like the real combat grid.
    for (let x = 0; x < width; x += 1) {
        for (let y = 0; y < height; y += 1) {
            const tile = createTile(x, y);
            tiles.set(tile.id, tile);
        }
    }

    return {
        dimensions: { width, height },
        tiles,
        theme: 'forest',
        seed: 1
    };
};

const meleeAttack: Ability = {
    id: 'unarmed_strike',
    name: 'Unarmed Strike',
    description: 'A basic close-range attack.',
    type: 'attack',
    cost: { type: 'action' },
    targeting: 'single_enemy',
    range: 1,
    effects: [{ type: 'damage', value: 1, damageType: 'physical' }]
};

const holdPersonLikeAbility: Ability = {
    ...meleeAttack,
    id: 'hold-person-like',
    name: 'Hold Person Like',
    validCreatureTypes: ['Humanoid'],
    range: 2
};

const holySmiteLikeAbility: Ability & { excludeCreatureTypes?: string[] } = {
    ...meleeAttack,
    id: 'holy-smite-like',
    name: 'Holy Smite Like',
    validCreatureTypes: ['Humanoid', 'Fey'],
    excludeCreatureTypes: ['Undead'],
    range: 2
};

const structuredEnemySpellAbility: Ability = {
    id: 'structured-enemy-spell',
    name: 'Structured Enemy Spell',
    description: 'A spell ability that keeps the source spell targeting contract attached.',
    type: 'spell',
    cost: { type: 'action' },
    targeting: 'single_any',
    range: 2,
    effects: [{ type: 'damage', value: 1, damageType: 'force' }],
    spell: {
        targeting: {
            type: 'single',
            range: 60,
            validTargets: ['enemies'],
            lineOfSight: false
        }
    }
};

const touchSpellAbility: Ability = {
    id: 'cure-wounds-like',
    name: 'Cure Wounds Like',
    description: 'A touch spell used to prove familiar delivery.',
    type: 'spell',
    cost: { type: 'action' },
    targeting: 'single_any',
    range: 1,
    effects: [{ type: 'heal', value: 1 }],
    spell: {
        range: {
            type: 'touch'
        }
    }
};

describe('useTargetValidator', () => {
    it('keeps existing boolean validation while explaining out-of-range enemies', () => {
        const caster = createMockCombatCharacter({
            id: 'kaelen',
            name: 'Kaelen',
            team: 'player',
            position: { x: 0, y: 0 }
        });
        const farEnemy = createMockCombatCharacter({
            id: 'orc-1',
            name: 'Orc 1',
            team: 'enemy',
            position: { x: 3, y: 0 }
        });

        const { result } = renderHook(() => useTargetValidator({
            characters: [caster, farEnemy],
            mapData: createMap(5, 5)
        }));

        const validation = result.current.getTargetValidation(meleeAttack, caster, farEnemy.position);

        expect(result.current.isValidTarget(meleeAttack, caster, farEnemy.position)).toBe(false);
        expect(validation).toEqual({
            isValid: false,
            reason: 'Orc 1 is too far away for Unarmed Strike. Range: 1 tile (5 ft); distance: 3 tiles (15 ft).'
        });
    });

    it('still returns adjacent enemies as valid targets', () => {
        const caster = createMockCombatCharacter({
            id: 'kaelen',
            name: 'Kaelen',
            team: 'player',
            position: { x: 0, y: 0 }
        });
        const adjacentEnemy = createMockCombatCharacter({
            id: 'goblin-1',
            name: 'Goblin 1',
            team: 'enemy',
            position: { x: 1, y: 0 }
        });

        const { result } = renderHook(() => useTargetValidator({
            characters: [caster, adjacentEnemy],
            mapData: createMap(3, 3)
        }));

        expect(result.current.getTargetValidation(meleeAttack, caster, adjacentEnemy.position)).toEqual({
            isValid: true
        });
        expect(result.current.getValidTargets(meleeAttack, caster)).toEqual([adjacentEnemy.position]);
    });

    it('explains when a single-target enemy ability is aimed at empty ground', () => {
        const caster = createMockCombatCharacter({
            id: 'kaelen',
            name: 'Kaelen',
            team: 'player',
            position: { x: 0, y: 0 }
        });

        const { result } = renderHook(() => useTargetValidator({
            characters: [caster],
            mapData: createMap(3, 3)
        }));

        expect(result.current.getTargetValidation(meleeAttack, caster, { x: 1, y: 0 })).toEqual({
            isValid: false,
            reason: 'Unarmed Strike needs an enemy target.'
        });
    });

    it('rejects non-matching target creature types with manual combat reason path', () => {
        const caster = createMockCombatCharacter({
            id: 'kaelen',
            name: 'Kaelen',
            team: 'player',
            position: { x: 0, y: 0 }
        });
        const undeadTarget = createMockCombatCharacter({
            id: 'undead-1',
            name: 'Undead 1',
            team: 'enemy',
            position: { x: 1, y: 0 },
            stats: {
                ...createMockCombatCharacter({ currentHP: 10 }).stats,
                creatureTypes: ['Undead']
            }
        });

        const { result } = renderHook(() => useTargetValidator({
            characters: [caster, undeadTarget],
            mapData: createMap(3, 3)
        }));

        expect(result.current.getTargetValidation(holdPersonLikeAbility, caster, undeadTarget.position)).toEqual({
            isValid: false,
            reason: 'Hold Person Like can only target Humanoid creatures.'
        });
    });

    it('supports case-insensitive creature typing and exclusion in getTargetValidation', () => {
        const caster = createMockCombatCharacter({
            id: 'kaelen',
            name: 'Kaelen',
            team: 'player',
            position: { x: 0, y: 0 }
        });
        const undeadHumanoidTarget = createMockCombatCharacter({
            id: 'zombie-1',
            name: 'Zombie 1',
            team: 'enemy',
            position: { x: 1, y: 0 },
            stats: {
                ...createMockCombatCharacter({ currentHP: 10 }).stats,
                creatureTypes: ['undead', 'humanoid']
            }
        });

        const feyTarget = createMockCombatCharacter({
            id: 'sprite-1',
            name: 'Sprite 1',
            team: 'enemy',
            position: { x: 2, y: 0 },
            stats: {
                ...createMockCombatCharacter({ currentHP: 10 }).stats,
                creatureTypes: ['fey']
            }
        });

        const { result } = renderHook(() => useTargetValidator({
            characters: [caster, undeadHumanoidTarget, feyTarget],
            mapData: createMap(4, 4)
        }));

        expect(result.current.getTargetValidation(holySmiteLikeAbility, caster, undeadHumanoidTarget.position)).toEqual({
            isValid: false,
            reason: 'Holy Smite Like can only target Humanoid, Fey creatures.'
        });
        expect(result.current.getTargetValidation(holySmiteLikeAbility, caster, feyTarget.position)).toEqual({
            isValid: true
        });
    });

    it('uses structured spell targeting rejection reasons before generic single-any targeting', () => {
        const caster = createMockCombatCharacter({
            id: 'kaelen',
            name: 'Kaelen',
            team: 'player',
            position: { x: 0, y: 0 }
        });
        const ally = createMockCombatCharacter({
            id: 'ally-1',
            name: 'Ally 1',
            team: 'player',
            position: { x: 1, y: 0 }
        });

        const { result } = renderHook(() => useTargetValidator({
            characters: [caster, ally],
            mapData: createMap(3, 3)
        }));

        expect(result.current.getTargetValidation(structuredEnemySpellAbility, caster, ally.position)).toEqual({
            isValid: false,
            reason: 'This spell can only target enemies.'
        });
    });

    it('allows Find Familiar touch delivery only when permission, range, adjacency, and reaction are available', () => {
        const caster = createMockCombatCharacter({
            id: 'kaelen',
            name: 'Kaelen',
            team: 'player',
            position: { x: 0, y: 0 }
        });
        const target = createMockCombatCharacter({
            id: 'ally-target',
            name: 'Ally Target',
            team: 'player',
            position: { x: 3, y: 0 }
        });
        const familiar = createMockCombatCharacter({
            id: 'owl-familiar',
            name: 'Owl Familiar',
            team: 'player',
            position: { x: 2, y: 0 }
        });
        familiar.isSummon = true;
        familiar.summonMetadata = {
            casterId: caster.id,
            spellId: 'find-familiar',
            entityType: 'familiar',
            sourceName: 'Find Familiar',
            actionPermissions: {
                canDeliverTouchSpells: true,
                touchDeliveryRangeFeet: 100,
                touchDeliveryCost: 'reaction'
            },
            dismissable: true
        };

        // The familiar is 10 feet from the caster and adjacent to the target,
        // so it can be the delivery origin for this otherwise out-of-reach
        // touch spell.
        expect(findTouchDeliveryActor(touchSpellAbility, caster, target, [caster, target, familiar])).toEqual({
            deliveryActor: familiar,
            casterDistance: 2,
            targetDistance: 1
        });

        const spentReactionFamiliar = {
            ...familiar,
            actionEconomy: {
                ...familiar.actionEconomy,
                reaction: { used: true, remaining: 0 }
            }
        };

        expect(findTouchDeliveryActor(touchSpellAbility, caster, target, [caster, target, spentReactionFamiliar])).toBeNull();
        // The permission model is shared beyond Find Familiar. A future actor
        // can declare no delivery cost, and targeting should not reject that
        // actor just because its Reaction is already spent.
        expect(findTouchDeliveryActor(touchSpellAbility, caster, target, [
            caster,
            target,
            {
                ...spentReactionFamiliar,
                summonMetadata: {
                    ...spentReactionFamiliar.summonMetadata!,
                    actionPermissions: {
                        ...spentReactionFamiliar.summonMetadata!.actionPermissions,
                        touchDeliveryCost: 'none'
                    }
                }
            }
        ])).toMatchObject({
            deliveryActor: expect.objectContaining({ id: familiar.id }),
            casterDistance: 2,
            targetDistance: 1
        });
        // The permission, not the familiar name, is the shared runtime
        // authority. This keeps future controlled actors from needing a
        // Find-Familiar-shaped identity just to use the same delivery bridge.
        expect(findTouchDeliveryActor(touchSpellAbility, caster, target, [
            caster,
            target,
            {
                ...spentReactionFamiliar,
                id: 'permissioned-touch-construct',
                name: 'Permissioned Touch Construct',
                summonMetadata: {
                    ...spentReactionFamiliar.summonMetadata!,
                    entityType: 'touch_construct',
                    sourceName: 'Permissioned Touch Construct',
                    actionPermissions: {
                        ...spentReactionFamiliar.summonMetadata!.actionPermissions,
                        touchDeliveryCost: 'none'
                    }
                }
            }
        ])).toMatchObject({
            deliveryActor: expect.objectContaining({ id: 'permissioned-touch-construct' }),
            casterDistance: 2,
            targetDistance: 1
        });
        expect(findTouchDeliveryActor(touchSpellAbility, caster, target, [
            caster,
            target,
            {
                ...familiar,
                position: { x: 21, y: 0 }
            }
        ])).toBeNull();
        // The familiar can be close enough to the caster but still too far
        // from the touch target. This protects Find Familiar's delivery rule:
        // the familiar is the delivery origin, so it must be adjacent to the
        // creature receiving the touch spell.
        expect(findTouchDeliveryActor(touchSpellAbility, caster, target, [
            caster,
            target,
            {
                ...familiar,
                position: { x: 1, y: 0 }
            }
        ])).toBeNull();
        expect(findTouchDeliveryActor(touchSpellAbility, caster, target, [
            caster,
            target,
            {
                ...familiar,
                summonMetadata: {
                    ...familiar.summonMetadata!,
                    actionPermissions: {
                        ...familiar.summonMetadata!.actionPermissions,
                        canDeliverTouchSpells: false
                    }
                }
            }
        ])).toBeNull();
        expect(findTouchDeliveryActor(touchSpellAbility, caster, target, [
            caster,
            target,
            {
                ...familiar,
                summonMetadata: {
                    ...familiar.summonMetadata!,
                    actionPermissions: undefined
                }
            }
        ])).toBeNull();
    });
});

describe('findTouchDeliveryActor action-cost variants', () => {
    type SummonActionPermissions = NonNullable<NonNullable<CombatCharacter['summonMetadata']>['actionPermissions']>;

    it('uses live Find Familiar action-permission data for reaction-cost touch delivery', () => {
        const caster = createMockCombatCharacter({
            id: 'live-find-familiar-caster',
            name: 'Live Find Familiar Caster',
            team: 'player',
            position: { x: 0, y: 0 }
        });
        const target = createMockCombatCharacter({
            id: 'live-find-familiar-target',
            name: 'Live Find Familiar Target',
            team: 'enemy',
            position: { x: 3, y: 0 }
        });
        const summonEffect = findFamiliar.effects.find(effect => effect.type === 'SUMMONING');
        const liveActionPermissions = summonEffect?.summon?.actionPermissions;
        const liveFamiliar = createMockCombatCharacter({
            id: 'live-find-familiar-owl',
            name: 'Live Find Familiar Owl',
            team: 'player',
            position: { x: 2, y: 0 },
            actionEconomy: {
                action: { used: false, remaining: 1 },
                bonusAction: { used: false, remaining: 1 },
                reaction: { used: false, remaining: 1 },
                movement: { used: 0, total: 30 }
            },
            summonMetadata: {
                casterId: caster.id,
                spellId: findFamiliar.id,
                entityType: summonEffect?.summon?.entityType,
                sourceName: findFamiliar.name,
                actionPermissions: liveActionPermissions as SummonActionPermissions,
                dismissable: true
            }
        });

        // This guard ties the shared delivery-actor bridge to the actual Find
        // Familiar packet. If the live spell data loses touch-delivery
        // permission, its 100-foot range, or its reaction cost, the validator
        // proof should fail before the parent row is closed.
        expect(liveActionPermissions).toEqual(expect.objectContaining({
            canDeliverTouchSpells: true,
            touchDeliveryRangeFeet: 100,
            touchDeliveryCost: 'reaction'
        }));
        expect(findTouchDeliveryActor(touchSpellAbility, caster, target, [
            caster,
            target,
            liveFamiliar
        ])).toMatchObject({
            deliveryActor: expect.objectContaining({ id: liveFamiliar.id }),
            casterDistance: 2,
            targetDistance: 1
        });

        // The same live packet declares a Reaction cost, so the shared helper
        // must reject the delivery actor when that specific actor's Reaction
        // is already spent. This protects Find Familiar from accidentally
        // inheriting the no-cost future-actor path.
        expect(findTouchDeliveryActor(touchSpellAbility, caster, target, [
            caster,
            target,
            {
                ...liveFamiliar,
                actionEconomy: {
                    ...liveFamiliar.actionEconomy,
                    reaction: { used: true, remaining: 0 }
                }
            }
        ])).toBeNull();
    });

    it('rejects touch-delivery actors that cannot afford their declared action, bonus-action, or free cost', () => {
        const caster = createMockCombatCharacter({
            id: 'caster-touch-costs',
            name: 'Touch Caster',
            team: 'player',
            position: { x: 0, y: 0 }
        });
        const target = createMockCombatCharacter({
            id: 'touch-target-costs',
            name: 'Touch Target',
            team: 'player',
            position: { x: 2, y: 0 }
        });
        const actionEconomyTemplate = createMockCombatCharacter({ id: 'economy-template' }).actionEconomy;

        const actionSpentFamiliar = createMockCombatCharacter({
            id: 'action-spent-familiar',
            name: 'Action-Spent Familiar',
            team: 'player',
            position: { x: 1, y: 0 },
            isSummon: true,
            actionEconomy: {
                ...actionEconomyTemplate,
                action: { used: true, remaining: 0 }
            },
            summonMetadata: {
                casterId: caster.id,
                entityType: 'familiar',
                sourceName: 'Find Familiar',
                actionPermissions: {
                    canDeliverTouchSpells: true,
                    touchDeliveryRangeFeet: 100,
                    touchDeliveryCost: 'action'
                }
            }
        });
        const bonusActionSpentFamiliar = createMockCombatCharacter({
            id: 'bonus-action-spent-familiar',
            name: 'Bonus-Action-Spent Familiar',
            team: 'player',
            position: { x: 1, y: 0 },
            isSummon: true,
            actionEconomy: {
                ...actionEconomyTemplate,
                bonusAction: { used: true, remaining: 0 }
            },
            summonMetadata: {
                casterId: caster.id,
                entityType: 'familiar',
                sourceName: 'Find Familiar',
                actionPermissions: {
                    canDeliverTouchSpells: true,
                    touchDeliveryRangeFeet: 100,
                    touchDeliveryCost: 'bonus_action'
                }
            }
        });
        const freeActionSpentFamiliar = createMockCombatCharacter({
            id: 'free-action-spent-familiar',
            name: 'Free-Action-Spent Familiar',
            team: 'player',
            position: { x: 1, y: 0 },
            isSummon: true,
            actionEconomy: {
                ...actionEconomyTemplate,
                freeActions: 0
            },
            summonMetadata: {
                casterId: caster.id,
                entityType: 'familiar',
                sourceName: 'Find Familiar',
                actionPermissions: {
                    canDeliverTouchSpells: true,
                    touchDeliveryRangeFeet: 100,
                    touchDeliveryCost: 'free'
                }
            }
        });

        // Touch-delivery permissions can now declare more than reactions. These
        // cases prove the shared validator does not treat action, bonus-action,
        // or limited free-action delivery actors as free just because Find
        // Familiar itself uses a Reaction.
        expect(findTouchDeliveryActor(touchSpellAbility, caster, target, [caster, actionSpentFamiliar, target])).toBeNull();
        expect(findTouchDeliveryActor(touchSpellAbility, caster, target, [caster, bonusActionSpentFamiliar, target])).toBeNull();
        expect(findTouchDeliveryActor(touchSpellAbility, caster, target, [caster, freeActionSpentFamiliar, target])).toBeNull();
    });
});

