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

/**
 * This file proves the mounted action executor discovers and resolves Opportunity Attacks.
 *
 * The cases cover reaction payment, weapon and spell choice, hit metadata,
 * Sentinel, and replay safety. The replay case deliberately delivers one
 * movement event twice while its first prompt is still in flight, protecting
 * the production acceptance/payment seam from duplicate side effects.
 *
 * Called by: the focused combat-hook Vitest gate.
 * Depends on: useActionExecutor and the shared mounted hook fixtures.
 */

describe('useActionExecutor', () => {
    beforeEach(() => {
        resetActionExecutorMocks();
    });

    // Movement is a turn-owned production action. Every fixture names its
    // mover explicitly, so the turn state must name the same actor before the
    // Opportunity Attack reaction window can legally open.
    const turnFor = (characterId: string): TurnState => ({
        ...mockTurnState,
        currentCharacterId: characterId,
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
            characters: [mover, attacker],
            turnState: turnFor(mover.id),
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
                reaction: expect.objectContaining({ used: true, remaining: 0 })
            })
        }));
        expect(mockOnLogEntry).toHaveBeenCalledWith(expect.objectContaining({
            message: expect.stringContaining('Opportunity Attack')
        }));
    });

    it('claims one movement event before prompting so replay cannot spend or attack twice', async () => {
        const rapier: Ability = {
            id: 'replay-rapier',
            name: 'Replay Rapier',
            description: 'A melee weapon used to prove one accepted reaction per movement event.',
            type: 'attack',
            cost: { type: 'action' },
            targeting: 'single_enemy',
            weapon: {
                id: 'replay-rapier-item',
                name: 'Replay Rapier',
                description: 'A finesse weapon.',
                type: 'weapon',
                properties: ['finesse']
            },
            range: 1,
            effects: [{ type: 'damage', value: 4, damageType: 'piercing', dice: '1d6' }]
        };
        const mover = {
            ...mockCharacter,
            id: 'replayed-mover',
            team: 'enemy' as const,
            position: { x: 0, y: 1 }
        };
        const attacker: CombatCharacter = {
            ...mockCharacter,
            id: 'replay-defender',
            team: 'player',
            position: { x: 0, y: 0 },
            abilities: [rapier],
            actionEconomy: {
                ...mockCharacter.actionEconomy,
                reaction: { used: false, remaining: 1 }
            }
        };
        const requestReaction = vi.fn().mockResolvedValue(rapier.id);
        mockConsumeAction.mockReturnValue(mover);
        mockProcessTileEffects.mockImplementation(character => character);
        mockHandleDamage.mockImplementation(character => character);

        const { result } = renderHook(() => useActionExecutor({
            ...defaultProps,
            characters: [mover, attacker],
            turnState: turnFor(mover.id),
            requestReaction
        }));
        const action: CombatAction = {
            id: 'same-movement-event',
            characterId: mover.id,
            type: 'move',
            targetPosition: { x: 0, y: 2 },
            cost: { type: 'movement-only', movementCost: 5 },
            timestamp: 52
        };

        await Promise.all([
            result.current.executeAction(action),
            result.current.executeAction(action),
        ]);

        const defenderUpdates = mockOnCharacterUpdate.mock.calls
            .map(call => call[0] as CombatCharacter)
            .filter(character => character.id === attacker.id);
        const opportunityLogs = mockOnLogEntry.mock.calls
            .map(call => call[0].message as string)
            .filter(message => message.includes('Opportunity Attack'));
        expect(requestReaction).toHaveBeenCalledTimes(1);
        expect(mockConsumeAction).toHaveBeenCalledTimes(1);
        expect(defenderUpdates).toHaveLength(1);
        expect(defenderUpdates[0].actionEconomy.reaction.used).toBe(true);
        expect(opportunityLogs).toHaveLength(1);

        // A new combat/reset clears only execution receipts. The same authored
        // fixture can then run again and pay exactly once in the fresh combat.
        result.current.resetActionReceipts();
        await result.current.executeAction(action);
        expect(mockConsumeAction).toHaveBeenCalledTimes(2);
        expect(requestReaction).toHaveBeenCalledTimes(2);
    });

    it('honors an explicit enemy decline without spending its Reaction', async () => {
        const scimitar: Ability = {
            id: 'decline-scimitar',
            name: 'Decline Scimitar',
            description: 'A melee weapon offered to a deterministic enemy controller.',
            type: 'attack',
            cost: { type: 'action' },
            targeting: 'single_enemy',
            weapon: {
                id: 'decline-scimitar-item',
                name: 'Decline Scimitar',
                description: 'A scenario melee weapon.',
                type: 'weapon',
                properties: [],
            },
            range: 1,
            effects: [{ type: 'damage', value: 1, damageType: 'slashing', dice: '1d4' }],
        };
        const mover = {
            ...mockCharacter,
            id: 'decline-mover',
            team: 'player' as const,
            position: { x: 0, y: 1 },
        };
        const guard = {
            ...mockCharacter,
            id: 'declining-guard',
            team: 'enemy' as const,
            position: { x: 0, y: 0 },
            abilities: [scimitar],
        };
        mockConsumeAction.mockImplementation(character => character);
        mockProcessTileEffects.mockImplementation(character => character);

        const { result } = renderHook(() => useActionExecutor({
            ...defaultProps,
            characters: [mover, guard],
            turnState: turnFor(mover.id),
        }));

        await result.current.executeAction({
            id: 'enemy-declines-leave-reach',
            characterId: mover.id,
            type: 'move',
            targetPosition: { x: 0, y: 2 },
            cost: { type: 'movement-only', movementCost: 5 },
            timestamp: 54,
            opportunityAttackDecisions: {
                [guard.id]: { decision: 'decline' },
            },
        });

        expect(mockOnCharacterUpdate).not.toHaveBeenCalledWith(expect.objectContaining({
            id: guard.id,
            actionEconomy: expect.objectContaining({
                reaction: expect.objectContaining({ used: true }),
            }),
        }));
        expect(mockOnLogEntry).toHaveBeenCalledWith(expect.objectContaining({
            message: 'Hero declines the Opportunity Attack reaction.',
        }));
    });

    it('resolves accepted damage before publishing the completed movement state', async () => {
        const sword: Ability = {
            id: 'timing-sword',
            name: 'Timing Sword',
            description: 'A deterministic melee weapon for movement timing proof.',
            type: 'attack',
            cost: { type: 'action' },
            targeting: 'single_enemy',
            weapon: {
                id: 'timing-sword-item',
                name: 'Timing Sword',
                description: 'A timing fixture.',
                type: 'weapon',
                properties: [],
            },
            range: 1,
            effects: [{ type: 'damage', value: 1, damageType: 'slashing', dice: '1d8' }],
            isProficient: true,
        };
        const mover = {
            ...mockCharacter,
            id: 'timing-mover',
            team: 'player' as const,
            position: { x: 0, y: 1 },
            currentHP: 20,
            maxHP: 20,
        };
        const guard = {
            ...mockCharacter,
            id: 'timing-guard',
            team: 'enemy' as const,
            position: { x: 0, y: 0 },
            abilities: [sword],
        };
        mockConsumeAction.mockImplementation(character => ({
            ...character,
            actionEconomy: {
                ...character.actionEconomy,
                movement: { ...character.actionEconomy.movement, used: 5 },
            },
        }));
        mockProcessTileEffects.mockImplementation(character => character);
        mockHandleDamage.mockImplementation((character: CombatCharacter, amount: number) => ({
            ...character,
            currentHP: character.currentHP - amount,
        }));

        const { result } = renderHook(() => useActionExecutor({
            ...defaultProps,
            characters: [mover, guard],
            turnState: turnFor(mover.id),
        }));

        await result.current.executeAction({
            id: 'timed-leave-reach',
            characterId: mover.id,
            type: 'move',
            targetPosition: { x: 0, y: 2 },
            movementPath: [{ x: 0, y: 1 }, { x: 0, y: 2 }],
            cost: { type: 'movement-only', movementCost: 5 },
            timestamp: 55,
            opportunityAttackDecisions: {
                [guard.id]: {
                    decision: 'accept',
                    abilityId: sword.id,
                    attackRoll: 14,
                    damageRoll: 6,
                },
            },
        });

        const guardUpdate = mockOnCharacterUpdate.mock.calls
            .map(call => call[0] as CombatCharacter)
            .find(character => character.id === guard.id);
        const moverUpdate = mockOnCharacterUpdate.mock.calls
            .map(call => call[0] as CombatCharacter)
            .find(character => character.id === mover.id);
        expect(guardUpdate?.actionEconomy.reaction).toMatchObject({ used: true, remaining: 0 });
        expect(moverUpdate).toMatchObject({
            currentHP: 14,
            position: { x: 0, y: 2 },
            actionEconomy: { movement: { used: 5, total: 30 } },
        });
        expect(mockHandleDamage).toHaveBeenCalledWith(
            expect.objectContaining({ id: mover.id }),
            6,
            'Hero (Opportunity Attack)',
            'slashing',
            mockTurnState.currentTurn,
        );
        const messages = mockOnLogEntry.mock.calls.map(call => call[0].message as string);
        expect(messages.findIndex(message => message.includes('Opportunity Attack')))
            .toBeLessThan(messages.findIndex(message => message.includes('moves')));
    });

    it('claims an unaffordable movement rejection before any payment and keeps its replay atomic', async () => {
        const mover = {
            ...mockCharacter,
            id: 'rejected-mover',
            position: { x: 0, y: 1 },
        };
        mockCanAfford.mockReturnValue(false);
        const { result } = renderHook(() => useActionExecutor({
            ...defaultProps,
            characters: [mover],
            turnState: turnFor(mover.id),
        }));
        const rejectedAction: CombatAction = {
            id: 'unaffordable-stable-move',
            characterId: mover.id,
            type: 'move',
            targetPosition: { x: 0, y: 2 },
            cost: { type: 'movement-only', movementCost: 35 },
            timestamp: 56,
        };

        expect(await result.current.executeAction(rejectedAction)).toBe(false);
        mockCanAfford.mockReturnValue(true);
        expect(await result.current.executeAction(rejectedAction)).toBe(true);

        expect(mockConsumeAction).not.toHaveBeenCalled();
        expect(mockOnCharacterUpdate).not.toHaveBeenCalled();
        expect(mockOnLogEntry).toHaveBeenCalledTimes(1);
        expect(mockOnLogEntry).toHaveBeenCalledWith(expect.objectContaining({
            message: expect.stringContaining('not enough resources'),
        }));
    });

    it('prompts multiple eligible responders in initiative order instead of roster order', async () => {
        const weapon = (id: string): Ability => ({
            id,
            name: id,
            description: 'A melee weapon used to prove deterministic responder order.',
            type: 'attack',
            cost: { type: 'action' },
            targeting: 'single_enemy',
            weapon: {
                id: `${id}-item`,
                name: id,
                description: 'A scenario sword.',
                type: 'weapon',
                properties: [],
            },
            range: 1,
            effects: [{ type: 'damage', value: 1, damageType: 'slashing', dice: '1d4' }],
        });
        const mover = {
            ...mockCharacter,
            id: 'ordered-mover',
            team: 'enemy' as const,
            position: { x: 0, y: 1 },
        };
        const firstResponder = {
            ...mockCharacter,
            id: 'first-responder',
            team: 'player' as const,
            position: { x: 0, y: 0 },
            abilities: [weapon('first-sword')],
        };
        const secondResponder = {
            ...mockCharacter,
            id: 'second-responder',
            team: 'player' as const,
            position: { x: 1, y: 0 },
            abilities: [weapon('second-sword')],
        };
        const requestReaction = vi.fn().mockResolvedValue(null);
        mockConsumeAction.mockImplementation(character => character);
        mockProcessTileEffects.mockImplementation(character => character);

        const { result } = renderHook(() => useActionExecutor({
            ...defaultProps,
            // Roster order is the opposite of initiative order on purpose.
            characters: [mover, secondResponder, firstResponder],
            turnState: {
                ...turnFor(mover.id),
                turnOrder: [mover.id, firstResponder.id, secondResponder.id],
            },
            requestReaction,
        }));

        await result.current.executeAction({
            id: 'ordered-leave-reach',
            characterId: mover.id,
            type: 'move',
            targetPosition: { x: 0, y: 2 },
            cost: { type: 'movement-only', movementCost: 5 },
            timestamp: 53,
        });

        expect(requestReaction.mock.calls.map(call => call[0])).toEqual([
            firstResponder.id,
            secondResponder.id,
        ]);
        expect(mockOnCharacterUpdate).not.toHaveBeenCalledWith(expect.objectContaining({
            id: firstResponder.id,
            actionEconomy: expect.objectContaining({
                reaction: expect.objectContaining({ used: true }),
            }),
        }));
    });

    it('should trigger Armor-style retaliation from a hit Opportunity Attack and suppress it on a miss', async () => {
        // Armor of Agathys-style effects are on-target-attack reactions, not
        // normal attack commands. This protects the movement/OA producer so it
        // sends the same explicit hit/miss payload that command-backed attacks
        // now replay through CombatAction.attackResults.
        const scimitar: Ability = {
            id: 'scimitar',
            name: 'Scimitar',
            description: 'A close melee attack.',
            type: 'attack' as const,
            cost: { type: 'action' as const },
            targeting: 'single_enemy' as const,
            weapon: { id: 'scimitar_item', name: 'Scimitar', description: 'A scimitar', type: 'weapon', properties: ['finesse'] },
            range: 1,
            effects: [{ type: 'damage' as const, value: 4, damageType: 'physical' as const, dice: '1d6' }]
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
        const protectedMover = {
            ...mockCharacter,
            id: 'protected_mover',
            name: 'Protected Mover',
            position: { x: 0, y: 1 },
            tempHP: 5,
            temporaryHitPointSource: {
                spellId: 'armor-of-agathys',
                spellName: 'Armor of Agathys',
                casterId: 'protected_mover'
            }
        };
        const attacker: CombatCharacter = {
            ...mockCharacter,
            id: 'oa_attacker',
            name: 'Opportunity Attacker',
            position: { x: 0, y: 0 },
            team: 'enemy',
            abilities: [scimitar]
        };
        const moveAction: CombatAction = {
            id: 'protected-mover-leaves-reach',
            characterId: protectedMover.id,
            type: 'move',
            targetPosition: { x: 0, y: 3 },
            cost: { type: 'movement-only', movementCost: 10 },
            timestamp: Date.now()
        };

        // Opportunity-attack proof needs the moving protected target to keep
        // its Armor of Agathys temporary-HP source while the movement helper
        // checks tile effects. The default mock returns the generic fixture,
        // which would erase that spell-owned temp-HP state before the reactive
        // trigger can evaluate the hit.
        mockProcessTileEffects.mockImplementation((character) => character);
        mockProcessRepeatSaves.mockImplementation((character) => character);
        mockConsumeAction.mockImplementation((character) => character);
        mockHandleDamage.mockImplementation((character: CombatCharacter, amount: number) => ({
            ...character,
            currentHP: character.currentHP - amount
        }));

        const hitRoll = vi.spyOn(Math, 'random').mockReturnValue(0.95);
        const hitHarness = renderHook(() => useActionExecutor({
            ...defaultProps,
            characters: [protectedMover, attacker],
            turnState: turnFor(protectedMover.id),
            reactiveTriggers: [{
                id: 'armor-retaliation-opportunity-hit',
                sourceEffect: armorRetaliation,
                sourceSpellId: 'armor-of-agathys',
                sourceSpellName: 'Armor of Agathys',
                casterId: protectedMover.id,
                targetId: protectedMover.id,
                createdTurn: 1
            }]
        }));

        expect(await hitHarness.result.current.executeAction(moveAction)).toBe(true);
        expect(mockHandleDamage).toHaveBeenCalledWith(
            expect.objectContaining({ id: attacker.id }),
            5,
            'reactive effect',
            'Cold',
            mockTurnState.currentTurn,
        );
        hitRoll.mockRestore();

        vi.clearAllMocks();
        mockCanAfford.mockReturnValue(true);
        mockConsumeAction.mockImplementation((character) => character);
        mockProcessTileEffects.mockImplementation((character) => character);
        mockProcessRepeatSaves.mockReturnValue(mockCharacter);

        const missRoll = vi.spyOn(Math, 'random').mockReturnValue(0);
        const missHarness = renderHook(() => useActionExecutor({
            ...defaultProps,
            characters: [protectedMover, attacker],
            turnState: turnFor(protectedMover.id),
            reactiveTriggers: [{
                id: 'armor-retaliation-opportunity-miss',
                sourceEffect: armorRetaliation,
                sourceSpellId: 'armor-of-agathys',
                sourceSpellName: 'Armor of Agathys',
                casterId: protectedMover.id,
                targetId: protectedMover.id,
                createdTurn: 1
            }]
        }));

        expect(await missHarness.result.current.executeAction(moveAction)).toBe(true);
        expect(mockHandleDamage).not.toHaveBeenCalledWith(
            expect.objectContaining({ id: attacker.id }),
            5,
            'reactive effect',
            'Cold',
            mockTurnState.currentTurn,
        );
        missRoll.mockRestore();
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
            characters: [mover, attacker],
            turnState: turnFor(mover.id),
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
                characters: [mover, sentinelAttacker],
                turnState: turnFor(mover.id),
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
            turnState: turnFor(mover.id),
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
            turnState: turnFor(mover.id),
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
            turnState: turnFor(mover.id),
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
