import { describe, it, expect } from 'vitest'
import { StartConcentrationCommand, BreakConcentrationCommand } from '../effects/ConcentrationCommands'
import { DamageCommand } from '../effects/DamageCommand'
import { SpellCommandFactory } from '../factory/SpellCommandFactory'
import { calculateConcentrationDC, checkConcentration } from '../../utils/concentrationUtils'
import { createMockSpell, createMockCombatCharacter, createMockCombatState, createMockGameState, createMockPlayerCharacter } from '../../utils/factories'
import type { DamageEffect } from '@/types/spells'
import type { PlayerCharacter } from '@/types'

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
                // TODO: keep combat + narrative characters in sync when we wire real data through the spell flow.
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
                // TODO: mirror concentration state into the player model when combat ↔ narrative models converge.
            });
            const mockGameState = createMockGameState({ party: [concentratingPlayer] });

            const commands = await SpellCommandFactory.createCommands(spell, casterConcentrating, [], 1, mockGameState);

            expect(commands[0]).toBeInstanceOf(BreakConcentrationCommand);
            const startCmd = commands.find(c => c instanceof StartConcentrationCommand);
            expect(startCmd).toBeDefined();
        })
    })

    describe('DamageCommand & Saves', () => {
        it('triggers concentration check on damage', () => {
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
            const mockGameState = createMockGameState({ party: mockPlayers, currentEnemies: [mockTarget], currentLocationId: 'arena', subMapCoordinates: { x: 0, y: 0 }, mapData: null });

            const command = new DamageCommand(damageEffect, {
                spellId: spell.id,
                spellName: spell.name,
                castAtLevel: 1,
                caster: mockCaster,
                targets: [mockTarget],
                gameState: mockGameState
            });

            const newState = command.execute(mockState);

            // Check if log contains concentration check message
            const logMessages = newState.combatLog.map((entry) => entry.message).join(' ');
            expect(logMessages).toContain('concentration');
        })
    })

    describe('Commands', () => {
        it('StartConcentrationCommand sets state', () => {
            const spell = createMockSpell();
            const mockCaster = createMockCombatCharacter();
            const mockPlayer: PlayerCharacter = createMockPlayerCharacter({
                id: mockCaster.id,
                name: mockCaster.name,
                // TODO: thread combat-specific fields like concentratingOn into the campaign character state for parity.
            });
            const baseTurnState = createMockCombatState().turnState;
            const mockState = createMockCombatState({
                characters: [mockCaster],
                turnState: { ...baseTurnState, currentTurn: 5 },
                combatLog: []
            });
            const mockGameState = createMockGameState({ party: [mockPlayer], currentLocationId: 'arena', subMapCoordinates: { x: 0, y: 0 }, mapData: null });

            const command = new StartConcentrationCommand(spell, {
                spellId: spell.id,
                spellName: spell.name,
                castAtLevel: 1,
                caster: mockCaster,
                targets: [],
                gameState: mockGameState
            });

            const newState = command.execute(mockState);

            expect(newState.characters[0].concentratingOn).toBeDefined();
            expect(newState.characters[0].concentratingOn!.spellId).toBe(spell.id);
            expect(newState.characters[0].concentratingOn!.startedTurn).toBe(5);
        })

        it('BreakConcentrationCommand clears state', () => {
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
                // TODO: maintain concentration flags in both combat + overworld models when we dedupe them.
            });
            const mockGameState = createMockGameState({ party: [mockPlayer], currentLocationId: 'arena', subMapCoordinates: { x: 0, y: 0 }, mapData: null });

            const command = new BreakConcentrationCommand({
                spellId: 'any',
                spellName: 'any',
                castAtLevel: 1,
                caster: mockTarget,
                targets: [],
                gameState: mockGameState
            });

            const newState = command.execute(mockState);

            expect(newState.characters[0].concentratingOn).toBeUndefined();
            const logMessages = newState.combatLog.map((entry) => entry.message).join(' ');
            expect(logMessages).toContain('stops concentrating');
        })
    })
})
