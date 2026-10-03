import { describe, it, expect } from 'vitest'
import { StartConcentrationCommand, BreakConcentrationCommand } from '../effects/ConcentrationCommands'
import { DamageCommand } from '../effects/DamageCommand'
import { StatusConditionCommand } from '../effects/StatusConditionCommand'
import { SpellCommandFactory } from '../factory/SpellCommandFactory'
import { calculateConcentrationDC, checkConcentration } from '../../utils/character'
import { createMockSpell, createMockCombatCharacter, createMockCombatState, createMockGameState, createMockPlayerCharacter } from '../../utils/core'
import type { DamageEffect, StatusConditionEffect } from '@/types/spells'
import type { PlayerCharacter } from '@/types'
import type { ActiveRider } from '@/types/combat'

/**
 * These tests protect the concentration command bridge.
 *
 * Concentration spells create effects in several different runtime places:
 * character statuses, structured conditions, map light sources, summons, and
 * attack riders. The command layer records enough IDs/source data to clean
 * those effects up when concentration ends. These tests keep that cleanup
 * behavior visible so future refactors do not leave stale spell artifacts on
 * the combat map or character sheets.
 */

describe('Concentration System', () => {

    describe('Utils', () => {
        it('calculates correct DC', () => {
            expect(calculateConcentrationDC(5)).toBe(10) // Minimum 10
            expect(calculateConcentrationDC(19)).toBe(10) // 19/2 = 9.5 -> 10
            expect(calculateConcentrationDC(20)).toBe(10) // 20/2 = 10
            expect(calculateConcentrationDC(22)).toBe(11) // 22/2 = 11
        })

        it('checks concentration success', () => {
            const mockTarget = createMockCombatCharacter();
            mockTarget.stats.constitution = 10;

            const result = checkConcentration(mockTarget, 10);
            expect(result.dc).toBe(10);
            expect(result.roll).toBeGreaterThanOrEqual(1);
            expect(result.roll).toBeLessThanOrEqual(21); // 20 + 0
        })
    })

    describe('SpellCommandFactory', () => {
        it('adds StartConcentrationCommand for concentration spells', async () => {
            const spell = createMockSpell({
                duration: { type: 'timed', value: 1, unit: 'minute', concentration: true }
            });
            const mockCaster = createMockCombatCharacter({ name: 'Caster' });
            const mockPlayer: PlayerCharacter = createMockPlayerCharacter({
                id: mockCaster.id,
                name: mockCaster.name,
            });
            const mockGameState = createMockGameState({ party: [mockPlayer] });

            const commands = await SpellCommandFactory.createCommands(spell, mockCaster, [], 1, mockGameState);
            const startCmd = commands.find(c => c instanceof StartConcentrationCommand);
            expect(startCmd).toBeDefined();
        })

        it('adds BreakConcentrationCommand if caster is already concentrating', async () => {
            const spell = createMockSpell({
                duration: { type: 'timed', value: 1, unit: 'minute', concentration: true }
            });

            const casterConcentrating = createMockCombatCharacter({
                name: 'Caster',
                concentratingOn: {
                    spellId: 'old',
                    spellName: 'Old',
                    spellLevel: 1,
                    startedTurn: 0,
                    effectIds: [],
                    canDropAsFreeAction: true
                }
            });
            const concentratingPlayer: PlayerCharacter = createMockPlayerCharacter({
                id: casterConcentrating.id,
                name: casterConcentrating.name,
            });
            const mockGameState = createMockGameState({ party: [concentratingPlayer] });

            const commands = await SpellCommandFactory.createCommands(spell, casterConcentrating, [], 1, mockGameState);

            expect(commands[0]).toBeInstanceOf(BreakConcentrationCommand);
            const startCmd = commands.find(c => c instanceof StartConcentrationCommand);
            expect(startCmd).toBeDefined();
        })
    })

    describe('DamageCommand & Saves', () => {
        it('triggers concentration check on damage', async () => {
            const spell = createMockSpell();
            const mockCaster = createMockCombatCharacter({ id: 'c1', name: 'Caster' });
            const mockTarget = createMockCombatCharacter({
                id: 't1',
                name: 'Target',
                concentratingOn: {
                    spellId: 'spell1',
                    spellName: 'Bless',
                    spellLevel: 1,
                    startedTurn: 1,
                    effectIds: [],
                    canDropAsFreeAction: true
                }
            });
            mockTarget.stats.constitution = 10;

            const damageEffect: DamageEffect = {
                type: 'DAMAGE',
                damage: { dice: '10d1', type: 'Force' }, // Fixed heavy damage: 10 damage
                trigger: { type: 'immediate' },
                condition: { type: 'hit' }
            };

            const mockState = createMockCombatState({
                characters: [mockCaster, mockTarget],
                combatLog: []
            });
            const mockPlayers: PlayerCharacter[] = [
                createMockPlayerCharacter({ id: mockCaster.id, name: mockCaster.name }),
                createMockPlayerCharacter({ id: mockTarget.id, name: mockTarget.name }),
            ];
            const mockGameState = createMockGameState({ party: mockPlayers, currentEnemies: [mockTarget], currentLocationId: 'arena' });

            const command = new DamageCommand(damageEffect, {
                spellId: spell.id,
                spellName: spell.name,
                castAtLevel: 1,
                caster: mockCaster,
                targets: [mockTarget],
                gameState: mockGameState
            });

            const newState = await command.execute(mockState);

            // Check if log contains concentration check message
            const logMessages = newState.combatLog.map((entry) => entry.message).join(' ');
            expect(logMessages).toContain('concentration');
        })

        it('uses delivered damage for the save DC and skips a fully immune packet', async () => {
            const attacker = createMockCombatCharacter({ id: 'attacker', name: 'Attacker' });
            const concentratingTarget = createMockCombatCharacter({
                id: 'target',
                name: 'Target',
                currentHP: 60,
                maxHP: 60,
                resistances: ['Piercing'],
                concentratingOn: {
                    spellId: 'bless',
                    spellName: 'Bless',
                    spellLevel: 1,
                    startedTurn: 1,
                    effectIds: [],
                    canDropAsFreeAction: true
                }
            });
            // A large bonus makes the assertion deterministic without replacing
            // the canonical Constitution-save helper used by DamageCommand.
            concentratingTarget.stats.constitution = 30;
            concentratingTarget.stats.saveBonuses = {
                ...concentratingTarget.stats.saveBonuses,
                con: 20
            };
            const damageEffect: DamageEffect = {
                type: 'DAMAGE',
                damage: { dice: '22d1', type: 'Piercing' },
                trigger: { type: 'immediate' },
                condition: { type: 'hit' }
            };
            const gameState = createMockGameState();
            const context = {
                spellId: 'test-hit',
                spellName: 'Test Hit',
                castAtLevel: 1,
                caster: attacker,
                targets: [concentratingTarget],
                gameState
            };

            const resisted = await new DamageCommand(damageEffect, context).execute(createMockCombatState({
                characters: [attacker, concentratingTarget],
                combatLog: []
            }));
            const resistedTarget = resisted.characters.find(character => character.id === concentratingTarget.id)!;
            const resistedLog = resisted.combatLog.map(entry => entry.message).join(' ');

            // Raw 22 becomes delivered 11 after resistance, so the minimum DC
            // remains 10. Using raw damage here would incorrectly expose DC 11.
            expect(resistedTarget.currentHP).toBe(49);
            expect(resistedTarget.concentratingOn?.spellId).toBe('bless');
            expect(resistedLog).toMatch(/concentration.*DC 10/i);

            const immuneTarget = createMockCombatCharacter({
                ...concentratingTarget,
                immunities: ['Piercing'],
                resistances: []
            });
            const immune = await new DamageCommand(damageEffect, {
                ...context,
                targets: [immuneTarget]
            }).execute(createMockCombatState({
                characters: [attacker, immuneTarget],
                combatLog: []
            }));
            const immuneResult = immune.characters.find(character => character.id === immuneTarget.id)!;

            expect(immuneResult.currentHP).toBe(60);
            expect(immuneResult.concentratingOn?.spellId).toBe('bless');
            expect(immune.combatLog.map(entry => entry.message).join(' ')).not.toMatch(/concentration.*DC/i);
        })
    })

    describe('Commands', () => {
        it('StartConcentrationCommand sets state', async () => {
            const spell = createMockSpell();
            const mockCaster = createMockCombatCharacter();
            const mockPlayer: PlayerCharacter = createMockPlayerCharacter({
                id: mockCaster.id,
                name: mockCaster.name,
            });
            const baseTurnState = createMockCombatState().turnState;
            const mockState = createMockCombatState({
                characters: [mockCaster],
                turnState: { ...baseTurnState, currentTurn: 5 },
                combatLog: []
            });
            const mockGameState = createMockGameState({ party: [mockPlayer], currentLocationId: 'arena' });

            const command = new StartConcentrationCommand(spell, {
                spellId: spell.id,
                spellName: spell.name,
                castAtLevel: 1,
                caster: mockCaster,
                targets: [],
                gameState: mockGameState
            });

            const newState = await command.execute(mockState);

            expect(newState.characters[0].concentratingOn).toBeDefined();
            expect(newState.characters[0].concentratingOn!.spellId).toBe(spell.id);
            expect(newState.characters[0].concentratingOn!.startedTurn).toBe(5);
        })

        it('replaces only the caster-owned prior effect when started directly', async () => {
            const oldSpell = createMockSpell({ id: 'bless', name: 'Bless' });
            const newSpell = createMockSpell({ id: 'protection', name: 'Protection' });
            const caster = createMockCombatCharacter({
                id: 'caster',
                name: 'Caster',
                concentratingOn: {
                    spellId: oldSpell.id,
                    spellName: oldSpell.name,
                    spellLevel: 1,
                    startedTurn: 1,
                    effectIds: ['owned-bless'],
                    canDropAsFreeAction: true
                }
            });
            const ownedTarget = createMockCombatCharacter({
                id: 'owned-target',
                statusEffects: [{
                    id: 'owned-bless',
                    name: 'Blessed',
                    type: 'buff',
                    duration: 10,
                    source: oldSpell.name,
                    sourceSpellId: oldSpell.id,
                    sourceCasterId: caster.id,
                    effect: { type: 'condition' }
                }]
            });
            const unrelatedTarget = createMockCombatCharacter({
                id: 'unrelated-target',
                statusEffects: [{
                    id: 'other-bless',
                    name: 'Blessed',
                    type: 'buff',
                    duration: 10,
                    source: oldSpell.name,
                    sourceSpellId: oldSpell.id,
                    sourceCasterId: 'other-caster',
                    effect: { type: 'condition' }
                }]
            });
            const state = createMockCombatState({
                characters: [caster, ownedTarget, unrelatedTarget],
                combatLog: []
            });
            const gameState = createMockGameState();

            const result = await new StartConcentrationCommand(newSpell, {
                spellId: newSpell.id,
                spellName: newSpell.name,
                castAtLevel: 1,
                caster,
                targets: [],
                gameState
            }).execute(state);

            expect(result.characters.find(character => character.id === caster.id)?.concentratingOn?.spellId).toBe(newSpell.id);
            expect(result.characters.find(character => character.id === ownedTarget.id)?.statusEffects).toEqual([]);
            expect(result.characters.find(character => character.id === unrelatedTarget.id)?.statusEffects.map(effect => effect.id)).toEqual(['other-bless']);
            expect(result.combatLog.map(entry => entry.message).join(' ')).toMatch(/stops concentrating.*begins concentrating/i);
        })

        it('ends concentration once when a status command applies incapacitated', async () => {
            const source = createMockCombatCharacter({ id: 'source', name: 'Source' });
            const target = createMockCombatCharacter({
                id: 'target',
                name: 'Target',
                concentratingOn: {
                    spellId: 'bless',
                    spellName: 'Bless',
                    spellLevel: 1,
                    startedTurn: 1,
                    effectIds: ['owned-bless'],
                    canDropAsFreeAction: true
                },
                statusEffects: [{
                    id: 'owned-bless',
                    name: 'Blessed',
                    type: 'buff',
                    duration: 10,
                    source: 'Bless',
                    sourceSpellId: 'bless',
                    sourceCasterId: 'target',
                    effect: { type: 'condition' }
                }]
            });
            const effect: StatusConditionEffect = {
                type: 'STATUS_CONDITION',
                statusCondition: {
                    name: 'Incapacitated',
                    duration: { type: 'rounds', value: 1 },
                    level: 0
                },
                condition: { type: 'always' } as never,
                trigger: { type: 'immediate' } as never
            };
            const state = createMockCombatState({ characters: [source, target], combatLog: [] });

            const result = await new StatusConditionCommand(effect, {
                spellId: 'incapacitating-effect',
                spellName: 'Incapacitating Effect',
                castAtLevel: 1,
                caster: source,
                targets: [target],
                gameState: createMockGameState()
            }).execute(state);
            const updatedTarget = result.characters.find(character => character.id === target.id)!;
            const stopMessages = result.combatLog.filter(entry => entry.message.includes('stops concentrating'));

            expect(updatedTarget.conditions?.some(condition => condition.name === 'Incapacitated')).toBe(true);
            expect(updatedTarget.concentratingOn).toBeUndefined();
            expect(updatedTarget.statusEffects.some(status => status.id === 'owned-bless')).toBe(false);
            expect(stopMessages).toHaveLength(1);
        })

        it('BreakConcentrationCommand clears state', async () => {
            const mockTarget = createMockCombatCharacter({
                 concentratingOn: {
                    spellId: 'spell1',
                    spellName: 'Bless',
                    spellLevel: 1,
                    startedTurn: 1,
                    effectIds: [],
                    canDropAsFreeAction: true
                }
            });
            const mockState = createMockCombatState({
                characters: [mockTarget],
                combatLog: []
            });
            const mockPlayer: PlayerCharacter = createMockPlayerCharacter({
                id: mockTarget.id,
                name: mockTarget.name,
            });
            const mockGameState = createMockGameState({ party: [mockPlayer], currentLocationId: 'arena' });

            const command = new BreakConcentrationCommand({
                spellId: 'any',
                spellName: 'any',
                castAtLevel: 1,
                caster: mockTarget,
                targets: [],
                gameState: mockGameState
            });

            const newState = await command.execute(mockState);

            expect(newState.characters[0].concentratingOn).toBeUndefined();
            const logMessages = newState.combatLog.map((entry) => entry.message).join(' ');
            expect(logMessages).toContain('stops concentrating');
        })

        it('BreakConcentrationCommand removes linked statuses, conditions, lights, and summons', async () => {
            const mockCaster = createMockCombatCharacter({
                id: 'caster',
                name: 'Caster',
                concentratingOn: {
                    spellId: 'summon-light-spell',
                    spellName: 'Summon Light Spell',
                    spellLevel: 2,
                    startedTurn: 3,
                    effectIds: ['linked-status', 'linked-light', 'linked-summon'],
                    canDropAsFreeAction: true
                }
            });
            const affectedTarget = createMockCombatCharacter({
                id: 'target',
                name: 'Target',
                statusEffects: [
                    {
                        id: 'linked-status',
                        name: 'Restrained',
                        type: 'debuff',
                        duration: 10,
                        source: 'Summon Light Spell',
                        sourceCasterId: mockCaster.id,
                        effect: { type: 'condition' }
                    },
                    {
                        id: 'unrelated-status',
                        name: 'Blessed',
                        type: 'buff',
                        duration: 10,
                        source: 'Other Spell',
                        effect: { type: 'condition' }
                    }
                ],
                conditions: [
                    {
                        name: 'Restrained',
                        duration: { type: 'rounds', value: 10 },
                        appliedTurn: 3,
                        source: 'summon-light-spell',
                        sourceCasterId: mockCaster.id
                    },
                    {
                        name: 'Blessed',
                        duration: { type: 'rounds', value: 10 },
                        appliedTurn: 3,
                        source: 'other-spell'
                    }
                ]
            });
            const linkedSummon = createMockCombatCharacter({
                id: 'linked-summon',
                name: 'Linked Summon'
            });
            const metadataLinkedSummon = createMockCombatCharacter({
                id: 'metadata-linked-summon',
                name: 'Metadata Linked Summon',
                isSummon: true,
                summonMetadata: {
                    casterId: mockCaster.id,
                    spellId: 'summon-light-spell',
                    entityType: 'familiar',
                    dismissable: true
                }
            });
            const unrelatedSummon = createMockCombatCharacter({
                id: 'unrelated-summon',
                name: 'Unrelated Summon',
                isSummon: true,
                summonMetadata: {
                    casterId: 'other-caster',
                    spellId: 'other-spell',
                    entityType: 'beast',
                    dismissable: true
                }
            });
            const pocketedFamiliar = createMockCombatCharacter({
                id: 'pocketed-familiar',
                name: 'Pocketed Familiar',
                isSummon: true,
                summonMetadata: {
                    casterId: mockCaster.id,
                    spellId: 'summon-light-spell',
                    entityType: 'familiar',
                    dismissable: true
                }
            });
            const unrelatedPocketedFamiliar = createMockCombatCharacter({
                id: 'unrelated-pocketed-familiar',
                name: 'Unrelated Pocketed Familiar',
                isSummon: true,
                summonMetadata: {
                    casterId: 'other-caster',
                    spellId: 'other-spell',
                    entityType: 'familiar',
                    dismissable: true
                }
            });
            const mockState = createMockCombatState({
                characters: [mockCaster, affectedTarget, linkedSummon, metadataLinkedSummon, unrelatedSummon],
                pocketedSummons: [
                    {
                        summon: pocketedFamiliar,
                        casterId: mockCaster.id,
                        spellId: 'summon-light-spell',
                        dismissedTurn: 4,
                        lastKnownPosition: { x: 2, y: 2 },
                        reason: 'familiar_pocket'
                    },
                    {
                        summon: unrelatedPocketedFamiliar,
                        casterId: 'other-caster',
                        spellId: 'other-spell',
                        dismissedTurn: 4,
                        lastKnownPosition: { x: 4, y: 4 },
                        reason: 'familiar_pocket'
                    }
                ],
                activeLightSources: [
                    {
                        id: 'linked-light',
                        sourceSpellId: 'summon-light-spell',
                        casterId: mockCaster.id,
                        brightRadius: 20,
                        dimRadius: 20,
                        attachedTo: 'caster'
                    },
                    {
                        id: 'unrelated-light',
                        sourceSpellId: 'other-spell',
                        casterId: 'other-caster',
                        brightRadius: 10,
                        dimRadius: 10,
                        attachedTo: 'point'
                    }
                ] as any,
                combatLog: []
            });
            const mockGameState = createMockGameState();

            const command = new BreakConcentrationCommand({
                spellId: 'summon-light-spell',
                spellName: 'Summon Light Spell',
                castAtLevel: 2,
                caster: mockCaster,
                targets: [],
                gameState: mockGameState
            });

            const newState = await command.execute(mockState);
            const updatedCaster = newState.characters.find(character => character.id === mockCaster.id)!;
            const updatedTarget = newState.characters.find(character => character.id === affectedTarget.id)!;

            // Ending concentration must clear the caster pointer and remove only
            // artifacts linked to that spell. Summons can be linked by the
            // original tracked effect ID or by summonMetadata when the startup
            // scan did not capture the actor ID.
            expect(updatedCaster.concentratingOn).toBeUndefined();
            expect(updatedTarget.statusEffects.map(effect => effect.id)).toEqual(['unrelated-status']);
            expect(updatedTarget.conditions?.map(condition => condition.name)).toEqual(['Blessed']);
            expect(newState.activeLightSources.map(source => source.id)).toEqual(['unrelated-light']);
            expect(newState.characters.some(character => character.id === linkedSummon.id)).toBe(false);
            expect(newState.characters.some(character => character.id === metadataLinkedSummon.id)).toBe(false);
            expect(newState.characters.some(character => character.id === unrelatedSummon.id)).toBe(true);
            expect(newState.pocketedSummons?.map(entry => entry.summon.id)).toEqual([unrelatedPocketedFamiliar.id]);
            expect(newState.combatLog.map(entry => entry.message)).toContain('Linked Summon disappears');
            expect(newState.combatLog.map(entry => entry.message)).toContain('Metadata Linked Summon disappears');
        })

        it('BreakConcentrationCommand removes linked riders from the concentrating caster', async () => {
            // Riders are attack add-ons such as Hex or Hunter's Mark. They live on
            // the caster, not on the target, so this guard protects a different
            // cleanup branch from the status/light/summon test above.
            const riderEffect: DamageEffect = {
                type: 'DAMAGE',
                damage: { dice: '1d6', type: 'Necrotic' },
                trigger: { type: 'immediate' },
                condition: { type: 'hit' }
            };
            const linkedRider: ActiveRider = {
                id: 'linked-rider',
                spellId: 'hex',
                casterId: 'caster',
                sourceName: 'Hex',
                targetId: 'target',
                effect: riderEffect,
                consumption: 'unlimited',
                attackFilter: { attackType: 'weapon', weaponType: 'any' },
                usedThisTurn: false,
                duration: { type: 'minutes', value: 60 }
            };
            const unrelatedRider: ActiveRider = {
                id: 'unrelated-rider',
                spellId: 'hunters-mark',
                casterId: 'caster',
                sourceName: "Hunter's Mark",
                targetId: 'target',
                effect: riderEffect,
                consumption: 'unlimited',
                attackFilter: { attackType: 'weapon', weaponType: 'any' },
                usedThisTurn: false,
                duration: { type: 'minutes', value: 60 }
            };
            const mockCaster = createMockCombatCharacter({
                id: 'caster',
                name: 'Caster',
                riders: [linkedRider, unrelatedRider],
                concentratingOn: {
                    spellId: 'hex',
                    spellName: 'Hex',
                    spellLevel: 1,
                    startedTurn: 4,
                    effectIds: ['linked-rider'],
                    canDropAsFreeAction: true
                }
            });
            const mockState = createMockCombatState({
                characters: [mockCaster],
                combatLog: []
            });
            const mockGameState = createMockGameState();

            const command = new BreakConcentrationCommand({
                spellId: 'hex',
                spellName: 'Hex',
                castAtLevel: 1,
                caster: mockCaster,
                targets: [],
                gameState: mockGameState
            });

            const newState = await command.execute(mockState);
            const updatedCaster = newState.characters.find(character => character.id === mockCaster.id)!;

            // Ending Hex should remove only Hex's attack rider. Other rider-based
            // spells remain active so concentration cleanup does not become a broad
            // purge of every attack add-on on the caster.
            expect(updatedCaster.concentratingOn).toBeUndefined();
            expect(updatedCaster.riders?.map(rider => rider.id)).toEqual(['unrelated-rider']);
        })
    })
})
