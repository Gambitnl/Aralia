
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useActionExecutor } from '../useActionExecutor';
import { CombatCharacter, CombatAction, TurnState, Ability, Position } from '../../../types/combat';
import type { ActiveSpellZone } from '../../../systems/spells/effects/triggerHandler';
import type { SpellEffect } from '../../../types/spells';

/**
 * This file protects the combat action executor, which is the runtime path that
 * spends turn resources, moves characters, resolves opportunity attacks, and
 * reports combat log entries.
 *
 * The hook sits between the turn manager and lower-level combat utilities, so
 * these tests focus on small rules slices where a regression would change live
 * gameplay. New coverage for Sentinel keeps the opportunity-attack stop effect
 * tied to a successful hit without widening into the battle-map renderer, and
 * Armor of Agathys coverage protects the retaliation target contract for
 * reactive spell damage.
 *
 * Called by: Vitest combat hook checks
 * Depends on: useActionExecutor.ts and shared combat types
 */

describe('useActionExecutor', () => {
    // Mocks
    const mockEndTurn = vi.fn();
    const mockCanAfford = vi.fn();
    const mockConsumeAction = vi.fn();
    const mockRecordAction = vi.fn();
    const mockAddDamageNumber = vi.fn();
    const mockQueueAnimation = vi.fn();
    const mockHandleDamage = vi.fn();
    const mockProcessRepeatSaves = vi.fn();
    const mockProcessTileEffects = vi.fn();
    const mockOnCharacterUpdate = vi.fn();
    const mockOnLogEntry = vi.fn();
    const mockSetMovementDebuffs = vi.fn();
    const mockExecuteReactionSpell = vi.fn().mockResolvedValue(undefined);

    // Test Data
    const mockCharacter: CombatCharacter = {
        id: 'char1',
        name: 'Hero',
        level: 1,
        class: {
            id: 'fighter',
            name: 'Fighter',
            description: '',
            hitDie: 10,
            primaryAbility: ['Strength'],
            savingThrowProficiencies: [],
            skillProficienciesAvailable: [],
            numberOfSkillProficiencies: 0,
            armorProficiencies: [],
            weaponProficiencies: [],
            features: []
        } as any,
        stats: {
            strength: 16,
            dexterity: 14,
            constitution: 14,
            intelligence: 10,
            wisdom: 10,
            charisma: 10,
            baseInitiative: 0,
            speed: 30,
            cr: '1'
        },
        currentHP: 10,
        maxHP: 10,
        position: { x: 0, y: 0 },
        initiative: 10,
        abilities: [],
        statusEffects: [],
        team: 'player',
        actionEconomy: {
            action: { used: false, remaining: 1 },
            bonusAction: { used: false, remaining: 1 },
            reaction: { used: false, remaining: 1 },
            movement: { used: 0, total: 30 },
            freeActions: 1,
            legendary: { used: 0, total: 0 }
        }
    };

    const mockTurnState: TurnState = {
        currentTurn: 1,
        turnOrder: ['char1'],
        currentCharacterId: 'char1',
        phase: 'action',
        actionsThisTurn: []
    };

    const defaultProps = {
        characters: [mockCharacter],
        turnState: mockTurnState,
        mapData: null,
        onCharacterUpdate: mockOnCharacterUpdate,
        onLogEntry: mockOnLogEntry,
        endTurn: mockEndTurn,
        canAfford: mockCanAfford,
        consumeAction: mockConsumeAction,
        recordAction: mockRecordAction,
        addDamageNumber: mockAddDamageNumber,
        queueAnimation: mockQueueAnimation,
        handleDamage: mockHandleDamage,
        processRepeatSaves: mockProcessRepeatSaves,
        processTileEffects: mockProcessTileEffects,
        spellZones: [],
        movementDebuffs: [],
        reactiveTriggers: [],
        setMovementDebuffs: mockSetMovementDebuffs
    };

    beforeEach(() => {
        vi.clearAllMocks();
        // Default behavior: Can afford action
        mockCanAfford.mockReturnValue(true);
        mockConsumeAction.mockReturnValue(mockCharacter);
        mockProcessTileEffects.mockReturnValue(mockCharacter);
        mockHandleDamage.mockReturnValue(mockCharacter);
        mockProcessRepeatSaves.mockReturnValue(mockCharacter);
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

    it('should handle end_turn action', async () => {
        const { result } = renderHook(() => useActionExecutor(defaultProps));

        const action: CombatAction = {
            id: 'action1',
            characterId: 'char1',
            type: 'end_turn',
            cost: { type: 'free' },
            timestamp: Date.now()
        };

        const success = await result.current.executeAction(action);

        expect(success).toBe(true);
        expect(mockEndTurn).toHaveBeenCalled();
    });

    it('should fail if character cannot afford action', async () => {
        mockCanAfford.mockReturnValue(false);
        const { result } = renderHook(() => useActionExecutor(defaultProps));

        const action: CombatAction = {
            id: 'action1',
            characterId: 'char1',
            type: 'move' as const,
            targetPosition: { x: 1, y: 1 },
            cost: { type: 'movement-only' as const, movementCost: 5 },
            timestamp: Date.now()
        };

        const success = await result.current.executeAction(action);

        expect(success).toBe(false);
        expect(mockOnLogEntry).toHaveBeenCalledWith(expect.objectContaining({
            message: expect.stringContaining('cannot perform this action')
        }));
    });

    it('should consume resources and update character position on move', async () => {
        // Setup updated character returned by consumeAction
        const movedCharacter = { ...mockCharacter, position: { x: 1, y: 1 } };
        mockConsumeAction.mockReturnValue(movedCharacter);
        // processTileEffects returns the character passed to it
        mockProcessTileEffects.mockImplementation((char) => char);

        const { result } = renderHook(() => useActionExecutor(defaultProps));

        const action: CombatAction = {
            id: 'action1',
            characterId: 'char1',
            type: 'move' as const,
            targetPosition: { x: 1, y: 1 },
            cost: { type: 'movement-only' as const, movementCost: 5 },
            timestamp: Date.now()
        };

        const success = await result.current.executeAction(action);

        expect(success).toBe(true);
        expect(mockConsumeAction).toHaveBeenCalledWith(expect.objectContaining({ id: 'char1' }), action.cost);

        // Check that onCharacterUpdate was called with the updated position
        // Note: The hook logic is:
        // 1. updatedCharacter = consumeAction(...) -> returns movedCharacter (pos {1,1} because we mocked it so? No wait.)
        // Actually consumeAction typically just updates economy.
        // The move logic in executeAction EXPLICITLY sets the position:
        // updatedCharacter = { ...updatedCharacter, position: action.targetPosition };

        // So even if consumeAction returns original position, the hook updates it.
        // Let's reset mockConsumeAction to return character with just economy changes (original position)
        mockConsumeAction.mockReturnValue({ ...mockCharacter, actionEconomy: { ...mockCharacter.actionEconomy, movement: { used: 5, total: 30 } } });

        expect(mockOnCharacterUpdate).toHaveBeenCalledWith(expect.objectContaining({
            position: { x: 1, y: 1 }
        }));

        expect(mockRecordAction).toHaveBeenCalledWith(action);
    });

    it('should reject movement onto an occupied combatant tile before spending movement', async () => {
        const blocker: CombatCharacter = {
            ...mockCharacter,
            id: 'blocker',
            name: 'Blocker',
            position: { x: 1, y: 1 },
            team: 'enemy'
        };

        const { result } = renderHook(() => useActionExecutor({
            ...defaultProps,
            characters: [mockCharacter, blocker]
        }));

        const action: CombatAction = {
            id: 'blocked-move',
            characterId: mockCharacter.id,
            type: 'move' as const,
            targetPosition: blocker.position,
            cost: { type: 'movement-only' as const, movementCost: 5 },
            timestamp: Date.now()
        };

        const success = await result.current.executeAction(action);

        expect(success).toBe(false);
        expect(mockConsumeAction).not.toHaveBeenCalled();
        expect(mockOnLogEntry).toHaveBeenCalledWith(expect.objectContaining({
            message: expect.stringContaining('Blocker is in the way')
        }));
    });

    it('should pass explicit movement paths to spell-zone movement triggers', async () => {
        const spikeGrowthStyleEffect: SpellEffect = {
            type: 'DAMAGE',
            trigger: { type: 'on_move_in_area' },
            condition: { type: 'always' },
            damage: { dice: '1d1', type: 'Piercing' }
        } as unknown as SpellEffect;
        const zone: ActiveSpellZone = {
            id: 'zone-spike-growth',
            spellId: 'spike-growth-style-zone',
            casterId: 'caster',
            position: { x: 0, y: 0 },
            areaOfEffect: { shape: 'cube', size: 30 },
            effects: [spikeGrowthStyleEffect],
            triggeredThisTurn: new Set(),
            triggeredEver: new Set()
        };
        const movementPath: Position[] = [
            { x: -7, y: 0 },
            { x: -6, y: 0 },
            { x: -5, y: 0 },
            { x: -4, y: 0 },
            { x: -3, y: 0 },
            { x: -2, y: 0 },
            { x: -1, y: 0 },
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 2, y: 0 },
            { x: 3, y: 0 },
            { x: 4, y: 0 },
            { x: 5, y: 0 },
            { x: 6, y: 0 },
            { x: 7, y: 0 }
        ];
        const pathingMover = { ...mockCharacter, position: movementPath[0] };
        mockConsumeAction.mockReturnValue(pathingMover);
        mockProcessTileEffects.mockImplementation((char) => char);
        mockHandleDamage.mockImplementation((char) => char);

        const { result } = renderHook(() => useActionExecutor({
            ...defaultProps,
            characters: [pathingMover],
            spellZones: [zone]
        }));

        // The move starts and ends outside the zone, so endpoint-only area
        // checks miss it. The explicit path records the walked tiles that
        // passed through the zone interior.
        const action = {
            id: 'move-through-zone',
            characterId: pathingMover.id,
            type: 'move' as const,
            targetPosition: movementPath[movementPath.length - 1],
            movementPath,
            cost: { type: 'movement-only' as const, movementCost: 70 },
            timestamp: Date.now()
        } as CombatAction;

        const success = await result.current.executeAction(action);

        expect(success).toBe(true);
        expect(mockHandleDamage).toHaveBeenCalledWith(
            expect.objectContaining({ id: pathingMover.id }),
            expect.any(Number),
            'zone effect',
            'Piercing'
        );
    });

    it('should let Dash spend an action and add current-turn movement without making an attack', async () => {
        const dash: Ability = {
            id: 'dash',
            name: 'Dash',
            description: 'Gain extra movement for the turn.',
            type: 'movement',
            cost: { type: 'action' as const },
            targeting: 'self',
            range: 0,
            effects: [{ type: 'movement', value: 30 }]
        };
        const characterWithDash = { ...mockCharacter, abilities: [dash] };
        const afterActionCost = {
            ...characterWithDash,
            actionEconomy: {
                ...characterWithDash.actionEconomy,
                action: { used: true, remaining: 1 }
            }
        };
        mockConsumeAction.mockReturnValue(afterActionCost);

        const { result } = renderHook(() => useActionExecutor({
            ...defaultProps,
            characters: [characterWithDash]
        }));

        const action: CombatAction = {
            id: 'dash-action',
            characterId: characterWithDash.id,
            type: 'ability',
            abilityId: 'dash',
            cost: dash.cost,
            targetPosition: characterWithDash.position,
            targetCharacterIds: [characterWithDash.id],
            timestamp: Date.now()
        };

        const success = await result.current.executeAction(action);

        expect(success).toBe(true);
        expect(mockOnCharacterUpdate).toHaveBeenCalledWith(expect.objectContaining({
            actionEconomy: expect.objectContaining({
                action: expect.objectContaining({ used: true }),
                movement: expect.objectContaining({ total: 60, used: 0 })
            })
        }));
        expect(mockOnLogEntry).toHaveBeenCalledWith(expect.objectContaining({
            message: expect.stringContaining('gains 30 ft of movement from Dash')
        }));
        expect(mockOnLogEntry).not.toHaveBeenCalledWith(expect.objectContaining({
            message: expect.stringContaining('attacks Hero')
        }));
    });

    it('should spend an enemy reaction and log an opportunity attack when movement leaves reach', async () => {
        const scimitar: Ability = {
            id: 'scimitar',
            name: 'Scimitar',
            description: 'A close melee attack.',
            type: 'attack' as const,
            cost: { type: 'action' as const },
            targeting: 'single_enemy' as const,
            range: 1,
            effects: [{ type: 'damage' as const, value: 4, damageType: 'physical' as const }]
        };
        const mover = { ...mockCharacter, position: { x: 0, y: 1 } };
        const attacker: CombatCharacter = {
            ...mockCharacter,
            id: 'orc',
            name: 'Orc',
            team: 'enemy' as const,
            position: { x: 0, y: 0 },
            abilities: [scimitar],
            actionEconomy: {
                ...mockCharacter.actionEconomy,
                reaction: { used: false, remaining: 1 }
            }
        };
        mockConsumeAction.mockReturnValue(mover);
        mockProcessTileEffects.mockImplementation((char) => char);
        mockHandleDamage.mockImplementation((char) => char);

        const { result } = renderHook(() => useActionExecutor({
            ...defaultProps,
            characters: [mover, attacker]
        }));

        const action: CombatAction = {
            id: 'leave-reach',
            characterId: mover.id,
            type: 'move' as const,
            targetPosition: { x: 0, y: 2 },
            cost: { type: 'movement-only' as const, movementCost: 5 },
            timestamp: Date.now()
        };

        const success = await result.current.executeAction(action);

        expect(success).toBe(true);
        expect(mockOnCharacterUpdate).toHaveBeenCalledWith(expect.objectContaining({
            id: 'orc',
            actionEconomy: expect.objectContaining({
                reaction: expect.objectContaining({ used: true })
            })
        }));
        expect(mockOnLogEntry).toHaveBeenCalledWith(expect.objectContaining({
            message: expect.stringContaining('Opportunity Attack')
        }));
    });

    it('should omit proficiency bonus from opportunity attacks with non-proficient weapons', async () => {
        const unproficientWeapon = {
            id: 'unproficient_weapon',
            name: 'Heavy Club',
            description: 'A heavy melee attack.',
            type: 'attack' as const,
            cost: { type: 'action' as const },
            targeting: 'single_enemy' as const,
            range: 1,
            isProficient: false,
            effects: [{ type: 'damage' as const, value: 4, damageType: 'physical' as const }]
        };
        const mover = { ...mockCharacter, position: { x: 0, y: 1 } };
        const attacker = {
            ...mockCharacter,
            id: 'orc',
            name: 'Orc',
            level: 1,
            stats: {
                ...mockCharacter.stats,
                strength: 14 // +2 mod
            },
            team: 'enemy' as const,
            position: { x: 0, y: 0 },
            abilities: [unproficientWeapon],
            actionEconomy: {
                ...mockCharacter.actionEconomy,
                reaction: { used: false, remaining: 1 }
            }
        };
        mockConsumeAction.mockReturnValue(mover);
        mockProcessTileEffects.mockImplementation((char) => char);
        mockHandleDamage.mockImplementation((char) => char);

        const { result } = renderHook(() => useActionExecutor({
            ...defaultProps,
            characters: [mover, attacker]
        }));

        const action = {
            id: 'leave-reach',
            characterId: mover.id,
            type: 'move' as const,
            targetPosition: { x: 0, y: 2 },
            cost: { type: 'movement-only' as const, movementCost: 5 },
            timestamp: Date.now()
        };

        const success = await result.current.executeAction(action);

        expect(success).toBe(true);
        expect(mockOnLogEntry).toHaveBeenCalledWith(expect.objectContaining({
            message: expect.stringMatching(/\+\s*2\s*=\s*\d+ vs AC/)
        }));
    });

    it('should stop a target in place when a Sentinel character hits with an Opportunity Attack', async () => {
        const spear: Ability = {
            id: 'spear',
            name: 'Spear',
            description: 'A close melee attack.',
            type: 'attack' as const,
            cost: { type: 'action' as const },
            targeting: 'single_enemy' as const,
            weapon: { id: 'spear_item', name: 'Spear', description: 'A spear', type: 'weapon', properties: ['versatile'] },
            range: 1,
            effects: [{ type: 'damage' as const, value: 4, damageType: 'physical' as const, dice: '1d6' }]
        };
        const mover = {
            ...mockCharacter,
            id: 'runner',
            name: 'Runner',
            team: 'player' as const,
            position: { x: 0, y: 1 }
        };
        const sentinelAttacker: CombatCharacter = {
            ...mockCharacter,
            id: 'sentinel_guard',
            name: 'Sentinel Guard',
            team: 'enemy' as const,
            position: { x: 0, y: 0 },
            abilities: [spear],
            feats: ['Sentinel'],
            actionEconomy: {
                ...mockCharacter.actionEconomy,
                reaction: { used: false, remaining: 1 }
            }
        };
        mockConsumeAction.mockReturnValue({
            ...mover,
            actionEconomy: {
                ...mover.actionEconomy,
                movement: { used: 5, total: 30 }
            }
        });
        mockProcessTileEffects.mockImplementation((char) => char);
        mockHandleDamage.mockImplementation((char) => char);

        const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.99);

        try {
            const { result } = renderHook(() => useActionExecutor({
                ...defaultProps,
                characters: [mover, sentinelAttacker]
            }));

            const action: CombatAction = {
                id: 'runner-leaves-reach',
                characterId: mover.id,
                type: 'move' as const,
                targetPosition: { x: 0, y: 2 },
                cost: { type: 'movement-only' as const, movementCost: 5 },
                timestamp: Date.now()
            };

            const success = await result.current.executeAction(action);

            expect(success).toBe(true);

            const movedUpdate = mockOnCharacterUpdate.mock.calls
                .map(call => call[0] as CombatCharacter)
                .find(character => character.id === mover.id);

            expect(movedUpdate).toBeDefined();
            expect(movedUpdate?.statusEffects).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    name: 'Sentinel Stop',
                    effect: expect.objectContaining({
                        type: 'stat_modifier',
                        stat: 'speed',
                        value: -30
                    })
                })
            ]));
            expect(movedUpdate?.actionEconomy.movement).toEqual({ used: 0, total: 0 });
            expect(mockOnLogEntry).toHaveBeenCalledWith(expect.objectContaining({
                message: expect.stringContaining('Sentinel feat stops Runner in place')
            }));
        } finally {
            randomSpy.mockRestore();
        }
    });

    it('should prompt player for Opportunity Attack weapon choice and execute swing with selected weapon properties', async () => {
        const rapier: Ability = {
            id: 'rapier',
            name: 'Rapier',
            description: 'A finesse melee attack.',
            type: 'attack' as const,
            cost: { type: 'action' as const },
            targeting: 'single_enemy' as const,
            weapon: { id: 'rapier_item', name: 'Rapier', description: 'A rapier', type: 'weapon', properties: ['finesse'] },
            range: 1,
            effects: [{ type: 'damage' as const, value: 8, damageType: 'physical' as const, dice: '1d8' }]
        };
        const mover = { ...mockCharacter, id: 'goblin', team: 'enemy' as const, position: { x: 0, y: 1 } };
        const playerAttacker: CombatCharacter = {
            ...mockCharacter,
            id: 'player_hero',
            team: 'player' as const,
            position: { x: 0, y: 0 },
            abilities: [rapier],
            actionEconomy: {
                ...mockCharacter.actionEconomy,
                reaction: { used: false, remaining: 1 }
            }
        };
        mockConsumeAction.mockReturnValue(mover);
        mockProcessTileEffects.mockImplementation((char) => char);
        mockHandleDamage.mockImplementation((char) => char);

        const mockRequestReaction = vi.fn().mockResolvedValue('rapier');

        const { result } = renderHook(() => useActionExecutor({
            ...defaultProps,
            characters: [mover, playerAttacker],
            requestReaction: mockRequestReaction
        }));

        const action = {
            id: 'mover-leaves-reach',
            characterId: mover.id,
            type: 'move' as const,
            targetPosition: { x: 0, y: 2 },
            cost: { type: 'movement-only' as const, movementCost: 5 },
            timestamp: Date.now()
        };

        const success = await result.current.executeAction(action);

        expect(success).toBe(true);
        expect(mockRequestReaction).toHaveBeenCalledWith(
            playerAttacker.id,
            mover.id,
            'opportunity_attack',
            [],
            expect.arrayContaining([expect.objectContaining({ id: 'rapier' })])
        );
        expect(mockOnCharacterUpdate).toHaveBeenCalledWith(expect.objectContaining({
            id: 'player_hero',
            actionEconomy: expect.objectContaining({
                reaction: expect.objectContaining({ used: true })
            })
        }));
        // The opportunity attack roll is intentionally allowed to hit or miss in this
        // test. What matters for this branch is that the selected reaction weapon
        // drives the log entry and carries structured hit metadata for downstream
        // combat-message adapters.
        expect(mockOnLogEntry).toHaveBeenCalledWith(expect.objectContaining({
            message: expect.stringContaining('using Rapier'),
            data: expect.objectContaining({
                isHit: expect.any(Boolean),
                isCrit: expect.any(Boolean)
            })
        }));
    });

    it('should log and not spend reaction if player declines the Opportunity Attack reaction prompt', async () => {
        const rapier: Ability = {
            id: 'rapier',
            name: 'Rapier',
            description: 'A finesse melee attack.',
            type: 'attack' as const,
            cost: { type: 'action' as const },
            targeting: 'single_enemy' as const,
            weapon: { id: 'rapier_item', name: 'Rapier', description: 'A rapier', type: 'weapon', properties: ['finesse'] },
            range: 1,
            effects: [{ type: 'damage' as const, value: 8, damageType: 'physical' as const, dice: '1d8' }]
        };
        const mover = { ...mockCharacter, id: 'goblin', team: 'enemy' as const, position: { x: 0, y: 1 } };
        const playerAttacker: CombatCharacter = {
            ...mockCharacter,
            id: 'player_hero',
            team: 'player' as const,
            position: { x: 0, y: 0 },
            abilities: [rapier],
            actionEconomy: {
                ...mockCharacter.actionEconomy,
                reaction: { used: false, remaining: 1 }
            }
        };
        mockConsumeAction.mockReturnValue(mover);
        mockProcessTileEffects.mockImplementation((char) => char);

        const mockRequestReaction = vi.fn().mockResolvedValue(null); // declines

        const { result } = renderHook(() => useActionExecutor({
            ...defaultProps,
            characters: [mover, playerAttacker],
            requestReaction: mockRequestReaction
        }));

        const action = {
            id: 'mover-leaves-reach',
            characterId: mover.id,
            type: 'move' as const,
            targetPosition: { x: 0, y: 2 },
            cost: { type: 'movement-only' as const, movementCost: 5 },
            timestamp: Date.now()
        };

        const success = await result.current.executeAction(action);

        expect(success).toBe(true);
        expect(mockRequestReaction).toHaveBeenCalled();
        expect(mockOnCharacterUpdate).not.toHaveBeenCalledWith(expect.objectContaining({
            id: 'player_hero',
            actionEconomy: expect.objectContaining({
                reaction: expect.objectContaining({ used: true })
            })
        }));
        expect(mockOnLogEntry).toHaveBeenCalledWith(expect.objectContaining({
            message: expect.stringContaining('declines the Opportunity Attack reaction')
        }));
    });

    it('should offer War Caster-eligible spells in the Opportunity Attack prompt and cast the chosen spell', async () => {
        const spellStrike: Ability = {
            id: 'spell_strike',
            name: 'Spell Strike',
            description: 'A single-target spell attack.',
            type: 'spell' as const,
            cost: { type: 'action' as const, spellSlotLevel: 1 },
            targeting: 'single_enemy' as const,
            range: 6,
            spell: {
                id: 'spell_strike',
                name: 'Spell Strike',
                description: 'A single-target spell attack.'
            } as any,
            effects: [{ type: 'damage' as const, value: 6, damageType: 'force' as const, dice: '1d6' }]
        };
        const rapier: Ability = {
            id: 'rapier',
            name: 'Rapier',
            description: 'A finesse melee attack.',
            type: 'attack' as const,
            cost: { type: 'action' as const },
            targeting: 'single_enemy' as const,
            weapon: { id: 'rapier_item', name: 'Rapier', description: 'A rapier', type: 'weapon', properties: ['finesse'] },
            range: 1,
            effects: [{ type: 'damage' as const, value: 8, damageType: 'physical' as const, dice: '1d8' }]
        };
        const mover = { ...mockCharacter, id: 'goblin', team: 'enemy' as const, position: { x: 0, y: 1 } };
        const warCasterAttacker: CombatCharacter = {
            ...mockCharacter,
            id: 'war_caster_hero',
            team: 'player' as const,
            feats: ['War Caster'],
            position: { x: 0, y: 0 },
            abilities: [spellStrike, rapier],
            actionEconomy: {
                ...mockCharacter.actionEconomy,
                reaction: { used: false, remaining: 1 }
            }
        };
        mockConsumeAction.mockReturnValue(mover);
        mockProcessTileEffects.mockImplementation((char) => char);
        mockHandleDamage.mockImplementation((char) => char);

        const mockRequestReaction = vi.fn().mockResolvedValue('spell_strike');

        const { result } = renderHook(() => useActionExecutor({
            ...defaultProps,
            characters: [mover, warCasterAttacker],
            requestReaction: mockRequestReaction,
            executeReactionSpell: mockExecuteReactionSpell
        } as any));

        const action = {
            id: 'mover-leaves-reach',
            characterId: mover.id,
            type: 'move' as const,
            targetPosition: { x: 0, y: 2 },
            cost: { type: 'movement-only' as const, movementCost: 5 },
            timestamp: Date.now()
        };

        const success = await result.current.executeAction(action);

        expect(success).toBe(true);
        expect(mockRequestReaction).toHaveBeenCalledWith(
            warCasterAttacker.id,
            mover.id,
            'opportunity_attack',
            expect.arrayContaining([expect.objectContaining({ id: 'spell_strike' })]),
            expect.arrayContaining([expect.objectContaining({ id: 'rapier' })])
        );
        expect(mockExecuteReactionSpell).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'war_caster_hero' }),
            expect.objectContaining({ id: 'goblin' }),
            expect.objectContaining({ id: 'spell_strike' })
        );
    });
});
