import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useActionExecutor } from '../useActionExecutor';
import { CombatCharacter, CombatAction, TurnState, Ability, Position } from '../../../types/combat';
import type { ActiveSpellZone } from '../../../systems/spells/effects/triggerHandler';
import type { SpellEffect } from '../../../types/spells';
import {
    mockEndTurn,
    mockCanAfford,
    mockConsumeAction,
    mockRecordAction,
    mockAddDamageNumber,
    mockQueueAnimation,
    mockHandleDamage,
    mockProcessRepeatSaves,
    mockProcessTileEffects,
    mockOnCharacterUpdate,
    mockOnLogEntry,
    mockSetMovementDebuffs,
    mockExecuteReactionSpell,
    mockCharacter,
    mockTurnState,
    defaultProps,
    resetActionExecutorMocks,
} from './useActionExecutor.fixtures';

describe('useActionExecutor', () => {
    beforeEach(() => {
        resetActionExecutorMocks();
    });

    it('should apply on-target-attack reactive damage to the attacker instead of the protected target', async () => {
        // Armor of Agathys-style retaliation belongs on the creature that made
        // the triggering attack. This attack ability is intentionally small so
        // the test only proves the reactive target routing, not hit chance or
        // melee filtering, which remain separate open gates.
        const meleeAttack: Ability = {
            id: 'claw',
            name: 'Claw',
            description: 'A simple melee attack used to trigger retaliation.',
            type: 'attack',
            cost: { type: 'action' },
            targeting: 'single_enemy',
            range: 1,
            effects: [{ type: 'damage', value: 1, damageType: 'physical', dice: '1' }]
        };
        const attacker: CombatCharacter = {
            ...mockCharacter,
            id: 'frostbitten_attacker',
            name: 'Frostbitten Attacker',
            position: { x: 1, y: 0 },
            abilities: [meleeAttack]
        };
        const protectedCaster: CombatCharacter = {
            ...mockCharacter,
            id: 'protected_caster',
            name: 'Protected Caster',
            position: { x: 0, y: 0 },
            abilities: []
        };
        const armorRetaliation: SpellEffect = {
            type: 'DAMAGE',
            trigger: {
                type: 'on_target_attack',
                frequency: 'every_time',
                consumption: 'unlimited'
            },
            condition: { type: 'always' },
            damage: { dice: '5', type: 'Cold' },
            description: 'A creature that hits the protected caster takes cold damage.'
        };

        // The executor spends the attacker's action first, then resolves the
        // reactive effect after the action log. Returning the attacker keeps
        // that post-spend identity stable for the reactive event pass.
        mockConsumeAction.mockReturnValue(attacker);
        mockHandleDamage.mockImplementation((character: CombatCharacter, amount: number) => ({
            ...character,
            currentHP: character.currentHP - amount
        }));

        const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.99);

        try {
            const { result } = renderHook(() => useActionExecutor({
                ...defaultProps,
                characters: [attacker, protectedCaster],
                reactiveTriggers: [{
                    id: 'armor-of-agathys-retaliation',
                    sourceEffect: armorRetaliation,
                    casterId: protectedCaster.id,
                    targetId: protectedCaster.id,
                    createdTurn: 1
                }]
            }));

            const action: CombatAction = {
                id: 'claw-protected-caster',
                characterId: attacker.id,
                type: 'ability',
                abilityId: meleeAttack.id,
                targetCharacterIds: [protectedCaster.id],
                targetPosition: protectedCaster.position,
                cost: { type: 'action' },
                timestamp: Date.now()
            };

            const success = await result.current.executeAction(action);

            expect(success).toBe(true);
            expect(mockHandleDamage).toHaveBeenCalledWith(
                expect.objectContaining({ id: attacker.id }),
                5,
                'reactive effect',
                'Cold'
            );
            expect(mockHandleDamage).not.toHaveBeenCalledWith(
                expect.objectContaining({ id: protectedCaster.id }),
                expect.any(Number),
                'reactive effect',
                'Cold'
            );
        } finally {
            randomSpy.mockRestore();
        }
    });

    it('should not trigger melee-filtered on-target-attack damage for a ranged attack', async () => {
        // Armor of Agathys only retaliates against melee attack rolls. This
        // ranged attack proves the reactive runtime reads the spell-data
        // attack filter instead of treating every attack-like ability the same.
        const rangedAttack: Ability = {
            id: 'shortbow',
            name: 'Shortbow',
            description: 'A ranged weapon attack used to test melee filtering.',
            type: 'attack',
            cost: { type: 'action' },
            targeting: 'single_enemy',
            range: 12,
            weapon: { id: 'shortbow_item', name: 'Shortbow', description: 'A shortbow', type: 'weapon', properties: ['ranged'] },
            effects: [{ type: 'damage', value: 1, damageType: 'physical', dice: '1' }]
        };
        const archer: CombatCharacter = {
            ...mockCharacter,
            id: 'ranged_attacker',
            name: 'Ranged Attacker',
            position: { x: 6, y: 0 },
            abilities: [rangedAttack]
        };
        const protectedCaster: CombatCharacter = {
            ...mockCharacter,
            id: 'protected_caster',
            name: 'Protected Caster',
            position: { x: 0, y: 0 },
            abilities: []
        };
        const meleeOnlyRetaliation: SpellEffect = {
            type: 'DAMAGE',
            trigger: {
                type: 'on_target_attack',
                frequency: 'every_time',
                consumption: 'unlimited',
                attackFilter: {
                    weaponType: 'melee',
                    attackType: 'any'
                }
            },
            condition: { type: 'always' },
            damage: { dice: '5', type: 'Cold' },
            description: 'Only melee attacks against the protected caster should cause cold retaliation.'
        };

        // The attack itself is still a valid action. The assertion below only
        // cares that the reactive retaliation path stays quiet for a ranged
        // trigger mismatch.
        mockConsumeAction.mockReturnValue(archer);

        const { result } = renderHook(() => useActionExecutor({
            ...defaultProps,
            characters: [archer, protectedCaster],
            reactiveTriggers: [{
                id: 'armor-of-agathys-melee-filter',
                sourceEffect: meleeOnlyRetaliation,
                casterId: protectedCaster.id,
                targetId: protectedCaster.id,
                createdTurn: 1
            }]
        }));

        const action: CombatAction = {
            id: 'shortbow-protected-caster',
            characterId: archer.id,
            type: 'ability',
            abilityId: rangedAttack.id,
            targetCharacterIds: [protectedCaster.id],
            targetPosition: protectedCaster.position,
            cost: { type: 'action' },
            timestamp: Date.now()
        };

        const success = await result.current.executeAction(action);

        expect(success).toBe(true);
        expect(mockHandleDamage).not.toHaveBeenCalled();
        expect(mockAddDamageNumber).not.toHaveBeenCalled();
    });

    it('should not trigger weapon-filtered on-target-attack damage for a spell attack', async () => {
        // Some reactive effects are weapon-only riders. This spell attack uses
        // the same action-executor event path as attack-roll spells, proving
        // the runtime can reject spell-vs-weapon mismatches before applying
        // reactive damage.
        const spellAttack: Ability = {
            id: 'frost_ray',
            name: 'Frost Ray',
            description: 'A spell attack used to test weapon-only filtering.',
            type: 'spell',
            cost: { type: 'action', spellSlotLevel: 1 },
            targeting: 'single_enemy',
            range: 12,
            spell: {
                id: 'frost_ray',
                name: 'Frost Ray',
                description: 'A ranged spell attack.',
                attackType: 'ranged'
            } as NonNullable<Ability['spell']>,
            effects: [{ type: 'damage', value: 1, damageType: 'cold', dice: '1' }]
        };
        const spellAttacker: CombatCharacter = {
            ...mockCharacter,
            id: 'spell_attacker',
            name: 'Spell Attacker',
            position: { x: 6, y: 0 },
            abilities: [spellAttack]
        };
        const protectedCaster: CombatCharacter = {
            ...mockCharacter,
            id: 'protected_caster',
            name: 'Protected Caster',
            position: { x: 0, y: 0 },
            abilities: []
        };
        const weaponOnlyRetaliation: SpellEffect = {
            type: 'DAMAGE',
            trigger: {
                type: 'on_target_attack',
                frequency: 'every_time',
                consumption: 'unlimited',
                attackFilter: {
                    weaponType: 'any',
                    attackType: 'weapon'
                }
            },
            condition: { type: 'always' },
            damage: { dice: '5', type: 'Cold' },
            description: 'Only weapon attacks against the protected caster should cause retaliation.'
        };

        // The action remains valid and should still be recorded; only the
        // weapon-filtered reactive damage should be suppressed.
        mockConsumeAction.mockReturnValue(spellAttacker);

        const { result } = renderHook(() => useActionExecutor({
            ...defaultProps,
            characters: [spellAttacker, protectedCaster],
            reactiveTriggers: [{
                id: 'weapon-only-reactive-filter',
                sourceEffect: weaponOnlyRetaliation,
                casterId: protectedCaster.id,
                targetId: protectedCaster.id,
                createdTurn: 1
            }]
        }));

        const action: CombatAction = {
            id: 'frost-ray-protected-caster',
            characterId: spellAttacker.id,
            type: 'ability',
            abilityId: spellAttack.id,
            targetCharacterIds: [protectedCaster.id],
            targetPosition: protectedCaster.position,
            cost: { type: 'action', spellSlotLevel: 1 },
            timestamp: Date.now()
        };

        const success = await result.current.executeAction(action);

        expect(success).toBe(true);
        expect(mockHandleDamage).not.toHaveBeenCalled();
        expect(mockAddDamageNumber).not.toHaveBeenCalled();
    });

    it('should not trigger temp-HP-bound retaliation when the protected target only has unrelated temp HP', async () => {
        // Armor of Agathys ends when its own temporary HP is gone. This proof
        // prevents the runtime from using a generic tempHP number supplied by a
        // different feature as permission to keep the spell retaliation alive.
        const meleeAttack: Ability = {
            id: 'claw',
            name: 'Claw',
            description: 'A melee attack used against a target with unrelated temp HP.',
            type: 'attack',
            cost: { type: 'action' },
            targeting: 'single_enemy',
            range: 1,
            effects: [{ type: 'damage', value: 1, damageType: 'physical', dice: '1' }]
        };
        const attacker: CombatCharacter = {
            ...mockCharacter,
            id: 'temp_hp_attacker',
            name: 'Temp HP Attacker',
            position: { x: 1, y: 0 },
            abilities: [meleeAttack]
        };
        const protectedCaster: CombatCharacter = {
            ...mockCharacter,
            id: 'protected_caster',
            name: 'Protected Caster',
            position: { x: 0, y: 0 },
            tempHP: 4,
            temporaryHitPointSource: {
                spellId: 'heroism',
                spellName: 'Heroism',
                casterId: 'ally_bard'
            },
            abilities: []
        };
        const armorRetaliation: SpellEffect = {
            type: 'DAMAGE',
            trigger: {
                type: 'on_target_attack',
                frequency: 'every_time',
                consumption: 'unlimited',
                attackFilter: {
                    weaponType: 'melee',
                    attackType: 'weapon'
                }
            },
            condition: { type: 'always' },
            conditionalEndings: [{
                trigger: 'temporary_hit_points_depleted',
                scope: 'spell',
                description: 'The spell ends when its own temporary hit points are gone.'
            }],
            damage: { dice: '5', type: 'Cold' },
            description: 'The armor retaliates only while its own temporary HP remains.'
        };

        // The attack should still succeed as an action; only the expired
        // Armor-specific reactive damage should stay silent.
        mockConsumeAction.mockReturnValue(attacker);

        const { result } = renderHook(() => useActionExecutor({
            ...defaultProps,
            characters: [attacker, protectedCaster],
            reactiveTriggers: [{
                id: 'armor-retaliation-with-unrelated-temp-hp',
                sourceEffect: armorRetaliation,
                sourceSpellId: 'armor-of-agathys',
                sourceSpellName: 'Armor of Agathys',
                casterId: protectedCaster.id,
                targetId: protectedCaster.id,
                createdTurn: 1
            }]
        }));

        const action: CombatAction = {
            id: 'claw-protected-caster-with-other-temp-hp',
            characterId: attacker.id,
            type: 'ability',
            abilityId: meleeAttack.id,
            targetCharacterIds: [protectedCaster.id],
            targetPosition: protectedCaster.position,
            cost: { type: 'action' },
            timestamp: Date.now()
        };

        const success = await result.current.executeAction(action);

        expect(success).toBe(true);
        expect(mockHandleDamage).not.toHaveBeenCalled();
        expect(mockAddDamageNumber).not.toHaveBeenCalled();
    });

    it('should not trigger on-target-attack reactive damage when the attack result says the target was missed', async () => {
        // Armor of Agathys only retaliates after a creature hits the protected
        // caster. The action envelope can carry per-target attack results, and
        // an explicit miss must suppress the reactive damage for that target.
        const meleeAttack: Ability = {
            id: 'claw',
            name: 'Claw',
            description: 'A melee attack that misses the protected caster.',
            type: 'attack',
            cost: { type: 'action' },
            targeting: 'single_enemy',
            range: 1,
            effects: [{ type: 'damage', value: 1, damageType: 'physical', dice: '1' }]
        };
        const attacker: CombatCharacter = {
            ...mockCharacter,
            id: 'missing_attacker',
            name: 'Missing Attacker',
            position: { x: 1, y: 0 },
            abilities: [meleeAttack]
        };
        const protectedCaster: CombatCharacter = {
            ...mockCharacter,
            id: 'protected_caster',
            name: 'Protected Caster',
            position: { x: 0, y: 0 },
            tempHP: 5,
            temporaryHitPointSource: {
                spellId: 'armor-of-agathys',
                spellName: 'Armor of Agathys',
                casterId: 'protected_caster'
            },
            abilities: []
        };
        const armorRetaliation: SpellEffect = {
            type: 'DAMAGE',
            trigger: {
                type: 'on_target_attack',
                frequency: 'every_time',
                consumption: 'unlimited',
                attackFilter: {
                    weaponType: 'melee',
                    attackType: 'weapon'
                }
            },
            condition: { type: 'always' },
            conditionalEndings: [{
                trigger: 'temporary_hit_points_depleted',
                scope: 'spell',
                description: 'The spell ends when its own temporary hit points are gone.'
            }],
            damage: { dice: '5', type: 'Cold' },
            description: 'The armor retaliates only after a hit.'
        };

        // The action remains valid and spends the attacker's action, but the
        // reactive damage should see the explicit miss and stay silent.
        mockConsumeAction.mockReturnValue(attacker);

        const { result } = renderHook(() => useActionExecutor({
            ...defaultProps,
            characters: [attacker, protectedCaster],
            reactiveTriggers: [{
                id: 'armor-retaliation-on-missed-attack',
                sourceEffect: armorRetaliation,
                sourceSpellId: 'armor-of-agathys',
                sourceSpellName: 'Armor of Agathys',
                casterId: protectedCaster.id,
                targetId: protectedCaster.id,
                createdTurn: 1
            }]
        }));

        const action = {
            id: 'claw-misses-protected-caster',
            characterId: attacker.id,
            type: 'ability' as const,
            abilityId: meleeAttack.id,
            targetCharacterIds: [protectedCaster.id],
            targetPosition: protectedCaster.position,
            attackResults: [{
                targetId: protectedCaster.id,
                isHit: false
            }],
            cost: { type: 'action' as const },
            timestamp: Date.now()
        };

        const success = await result.current.executeAction(action);

        expect(success).toBe(true);
        expect(mockHandleDamage).not.toHaveBeenCalled();
        expect(mockAddDamageNumber).not.toHaveBeenCalled();
    });

    it('should synthesize hit metadata before resolving legacy ability attack reactions', async () => {
        // Older attack actions do not always arrive from the command system
        // with attackResults already filled in. This case proves the executor
        // still resolves a hit/miss fact before Armor-style reactions can fire,
        // instead of treating any attack-shaped action as a confirmed hit.
        const meleeAttack: Ability = {
            id: 'legacy_claw',
            name: 'Legacy Claw',
            description: 'A melee attack without command-provided hit metadata.',
            type: 'attack',
            cost: { type: 'action' },
            targeting: 'single_enemy',
            range: 1,
            effects: [{ type: 'damage', value: 1, damageType: 'physical', dice: '1' }]
        };
        const attacker: CombatCharacter = {
            ...mockCharacter,
            id: 'legacy_attacker',
            name: 'Legacy Attacker',
            position: { x: 1, y: 0 },
            abilities: [meleeAttack]
        };
        const protectedCaster: CombatCharacter = {
            ...mockCharacter,
            id: 'protected_caster',
            name: 'Protected Caster',
            position: { x: 0, y: 0 },
            armorClass: 30,
            tempHP: 5,
            temporaryHitPointSource: {
                spellId: 'armor-of-agathys',
                spellName: 'Armor of Agathys',
                casterId: 'protected_caster'
            },
            abilities: []
        };
        const armorRetaliation: SpellEffect = {
            type: 'DAMAGE',
            trigger: {
                type: 'on_target_attack',
                frequency: 'every_time',
                consumption: 'unlimited',
                attackFilter: {
                    weaponType: 'melee',
                    attackType: 'weapon'
                }
            },
            condition: { type: 'always' },
            conditionalEndings: [{
                trigger: 'temporary_hit_points_depleted',
                scope: 'spell',
                description: 'The spell ends when its own temporary hit points are gone.'
            }],
            damage: { dice: '5', type: 'Cold' },
            description: 'The armor retaliates only after a melee weapon hit.'
        };

        mockConsumeAction.mockReturnValue(attacker);
        const missRoll = vi.spyOn(Math, 'random').mockReturnValue(0);

        try {
            const { result } = renderHook(() => useActionExecutor({
                ...defaultProps,
                characters: [attacker, protectedCaster],
                reactiveTriggers: [{
                    id: 'armor-retaliation-legacy-miss',
                    sourceEffect: armorRetaliation,
                    sourceSpellId: 'armor-of-agathys',
                    sourceSpellName: 'Armor of Agathys',
                    casterId: protectedCaster.id,
                    targetId: protectedCaster.id,
                    createdTurn: 1
                }]
            }));

            const action: CombatAction = {
                id: 'legacy-claw-protected-caster',
                characterId: attacker.id,
                type: 'ability',
                abilityId: meleeAttack.id,
                targetCharacterIds: [protectedCaster.id],
                targetPosition: protectedCaster.position,
                cost: { type: 'action' },
                timestamp: Date.now()
            };

            const success = await result.current.executeAction(action);

            expect(success).toBe(true);
            expect(mockHandleDamage).not.toHaveBeenCalledWith(
                expect.objectContaining({ id: attacker.id }),
                5,
                'reactive effect',
                'Cold'
            );
        } finally {
            missRoll.mockRestore();
        }
    });

    it('should use attackResults weaponType before fallback ability range for reactive filters', async () => {
        // The command pipeline can now preserve the actual attack family on
        // attackResults after the roll resolves. If that payload says the hit
        // was ranged, melee-only Armor retaliation should stay silent even when
        // the legacy ability shape looks melee-like.
        const legacyMeleeLookingAttack: Ability = {
            id: 'legacy_attack',
            name: 'Legacy Attack',
            description: 'A legacy ability whose range is not the final attack classification.',
            type: 'attack',
            cost: { type: 'action' },
            targeting: 'single_enemy',
            range: 1,
            effects: [{ type: 'damage', value: 1, damageType: 'physical', dice: '1' }]
        };
        const attacker: CombatCharacter = {
            ...mockCharacter,
            id: 'ranged_result_attacker',
            name: 'Ranged Result Attacker',
            position: { x: 1, y: 0 },
            abilities: [legacyMeleeLookingAttack]
        };
        const protectedCaster: CombatCharacter = {
            ...mockCharacter,
            id: 'protected_caster',
            name: 'Protected Caster',
            position: { x: 0, y: 0 },
            tempHP: 5,
            temporaryHitPointSource: {
                spellId: 'armor-of-agathys',
                spellName: 'Armor of Agathys',
                casterId: 'protected_caster'
            },
            abilities: []
        };
        const armorRetaliation: SpellEffect = {
            type: 'DAMAGE',
            trigger: {
                type: 'on_target_attack',
                frequency: 'every_time',
                consumption: 'unlimited',
                attackFilter: {
                    weaponType: 'melee',
                    attackType: 'weapon'
                }
            },
            condition: { type: 'always' },
            conditionalEndings: [{
                trigger: 'temporary_hit_points_depleted',
                scope: 'spell',
                description: 'The spell ends when its own temporary hit points are gone.'
            }],
            damage: { dice: '5', type: 'Cold' },
            description: 'The armor retaliates only after a melee weapon hit.'
        };

        mockConsumeAction.mockReturnValue(attacker);

        const { result } = renderHook(() => useActionExecutor({
            ...defaultProps,
            characters: [attacker, protectedCaster],
            reactiveTriggers: [{
                id: 'armor-retaliation-on-ranged-result',
                sourceEffect: armorRetaliation,
                sourceSpellId: 'armor-of-agathys',
                sourceSpellName: 'Armor of Agathys',
                casterId: protectedCaster.id,
                targetId: protectedCaster.id,
                createdTurn: 1
            }]
        }));

        const action: CombatAction = {
            id: 'ranged-result-against-protected-caster',
            characterId: attacker.id,
            type: 'ability',
            abilityId: legacyMeleeLookingAttack.id,
            targetCharacterIds: [protectedCaster.id],
            targetPosition: protectedCaster.position,
            attackResults: [{
                targetId: protectedCaster.id,
                isHit: true,
                attackType: 'weapon',
                weaponType: 'ranged'
            }],
            cost: { type: 'action' },
            timestamp: Date.now()
        };

        const success = await result.current.executeAction(action);

        expect(success).toBe(true);
        expect(mockHandleDamage).not.toHaveBeenCalled();
        expect(mockAddDamageNumber).not.toHaveBeenCalled();
    });
});
