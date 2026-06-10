
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useActionExecutor } from '../useActionExecutor';
import { CombatCharacter, CombatAction, TurnState, Ability } from '../../../types/combat';

/**
 * This file protects the combat action executor, which is the runtime path that
 * spends turn resources, moves characters, resolves opportunity attacks, and
 * reports combat log entries.
 *
 * The hook sits between the turn manager and lower-level combat utilities, so
 * these tests focus on small rules slices where a regression would change live
 * gameplay. New coverage for Sentinel keeps the opportunity-attack stop effect
 * tied to a successful hit without widening into the battle-map renderer.
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
