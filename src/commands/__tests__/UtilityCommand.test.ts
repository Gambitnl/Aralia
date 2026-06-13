import { describe, it, expect } from 'vitest'
import { UtilityCommand } from '../effects/UtilityCommand'
import { SpellEffect, UtilityEffect } from '@/types/spells'
import { CombatCharacter, CombatState } from '@/types/combat'
import { CommandContext } from '../base/SpellCommand'
import { createMockCombatCharacter, createMockCombatState, createMockGameState } from '@/utils/factories'

/**
 * This file proves the utility-command spell effects that do not fit cleanly
 * into damage, healing, or status-only commands.
 *
 * Command-style spells use these tests to show that a selected control option
 * actually drives combat behavior, while light, taunt, and save-penalty effects
 * remain covered as separate utility families.
 *
 * Called by: Vitest focused command checks.
 * Depends on: UtilityCommand, shared combat factories, and CommandContext.
 */

describe('UtilityCommand', () => {
    // --- Mock Data Setup ---
    const mockCaster: CombatCharacter = createMockCombatCharacter({
        id: 'caster-1',
        name: 'Wizard',
        position: { x: 5, y: 5 },
        stats: { ...createMockCombatCharacter().stats, speed: 30 },
    })

    const mockTarget: CombatCharacter = createMockCombatCharacter({
        id: 'target-1',
        name: 'Goblin',
        position: { x: 7, y: 7 }, // 2 tiles away (approx 10-14ft)
        stats: { ...createMockCombatCharacter().stats, speed: 30 },
        statusEffects: [],
    })

    const mockState: CombatState = createMockCombatState({
        characters: [mockCaster, mockTarget],
        turnState: { currentTurn: 1, turnOrder: [mockCaster.id, mockTarget.id], currentCharacterId: mockCaster.id, phase: 'action', actionsThisTurn: [] },
        combatLog: [],
        activeLightSources: [],
    })

    const mockContext: CommandContext = {
        spellId: 'spell-1',
        spellName: 'Test Spell',
        castAtLevel: 1,
        caster: mockCaster,
        targets: [mockTarget],
        gameState: createMockGameState()
    }

    // --- Tests ---

    describe('Light Utility', () => {
        it('should create a light source attached to the caster', async () => {
            const effect: UtilityEffect = {
                type: 'UTILITY',
                utilityType: 'light',
                description: 'Let there be light',
                light: {
                    brightRadius: 20,
                    dimRadius: 20,
                    attachedTo: 'caster',
                    color: '#FFCC00'
                },
                trigger: { type: 'immediate' },
                condition: { type: 'always' }
            }

            const command = new UtilityCommand(effect, mockContext)
            const newState = await command.execute(mockState)

            expect(newState.activeLightSources).toHaveLength(1)
            const source = newState.activeLightSources[0]
            expect(source.casterId).toBe(mockCaster.id)
            expect(source.attachedToCharacterId).toBe(mockCaster.id)
            expect(source.brightRadius).toBe(20)
            expect(source.color).toBe('#FFCC00')
            expect(newState.combatLog).toHaveLength(2) // 1 generic action, 1 status for light
        })

        it('should create a light source attached to a target', async () => {
            const effect: UtilityEffect = {
                type: 'UTILITY',
                utilityType: 'light',
                description: 'Glowing target',
                light: {
                    brightRadius: 10,
                    attachedTo: 'target'
                },
                trigger: { type: 'immediate' },
                condition: { type: 'always' }
            }

            const command = new UtilityCommand(effect, mockContext)
            const newState = await command.execute(mockState)

            expect(newState.activeLightSources).toHaveLength(1)
            const source = newState.activeLightSources[0]
            expect(source.attachedToCharacterId).toBe(mockTarget.id)
        })
    });

    describe('Control Options (Command Spell)', () => {
        it('should apply "grovel" command (prone status)', async () => {
            const effect: UtilityEffect = {
                type: 'UTILITY',
                utilityType: 'control',
                description: 'Kneel!',
                controlOptions: [
                    { name: 'Grovel', effect: 'grovel' }
                ],
                trigger: { type: 'immediate' },
                condition: { type: 'always' }
            }

            const command = new UtilityCommand(effect, mockContext)
            const newState = await command.execute(mockState)

            // UtilityCommand automatically applies the FIRST option in the list as a fallback logic.
            // This legacy proof still verifies Prone, while the newer directive
            // test below verifies the additional Command: Grovel turn marker.
            const targetInState = newState.characters.find(c => c.id === mockTarget.id)
            expect(targetInState?.statusEffects).toEqual(expect.arrayContaining([
                expect.objectContaining({ name: 'Prone' })
            ]))

            // Should verify logging
            const logEntry = newState.combatLog.find(l => l.message.includes('falls prone'))
            expect(logEntry).toBeDefined()
        })

        it('should apply "flee" command (movement)', async () => {
            // Mock target close to caster
            const closeState = {
                ...mockState,
                characters: [mockCaster, { ...mockTarget, position: { x: 6, y: 5 } }] // adjacent
            } as CombatState

            const effect: UtilityEffect = {
                type: 'UTILITY',
                utilityType: 'control',
                description: 'Run away!',
                controlOptions: [
                    { name: 'Flee', effect: 'flee' }
                ],
                trigger: { type: 'immediate' },
                condition: { type: 'always' }
            }

            const command = new UtilityCommand(effect, mockContext)
            const newState = await command.execute(closeState)

            // Character should have moved AWAY from caster (x=5 -> x=6, so move to x=7+)
            const newTarget = newState.characters.find(c => c.id === mockTarget.id)
            expect(newTarget?.position.x).toBeGreaterThan(6)
            expect(newTarget?.statusEffects).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    name: 'Command: Flee',
                    source: mockContext.spellName,
                    sourceCasterId: mockCaster.id
                })
            ]))
        })

        it('should leave a movement directive marker for selected "approach" command', async () => {
            const closeState = {
                ...mockState,
                characters: [mockCaster, { ...mockTarget, position: { x: 6, y: 5 } }]
            } as CombatState

            const effect: UtilityEffect = {
                type: 'UTILITY',
                utilityType: 'control',
                description: 'Come here!',
                controlOptions: [
                    { name: 'Approach', effect: 'approach' },
                    { name: 'Flee', effect: 'flee' }
                ],
                trigger: { type: 'immediate' },
                condition: { type: 'always' }
            }

            const selectedContext: CommandContext & { playerInput: string } = {
                ...mockContext,
                playerInput: 'Approach'
            }

            const command = new UtilityCommand(effect, selectedContext)
            const newState = await command.execute(closeState)
            const newTarget = newState.characters.find(c => c.id === mockTarget.id)

            // Approach keeps the current immediate movement fallback and also
            // records the next-turn directive so AI-controlled targets do not
            // ignore the command after the first command-side movement.
            expect(newTarget?.position.x).toBeLessThan(6)
            expect(newTarget?.statusEffects).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    name: 'Command: Approach',
                    source: mockContext.spellName,
                    sourceCasterId: mockCaster.id
                })
            ]))
        })

        it('should leave a turn directive marker for selected "drop" command', async () => {
            const effect: UtilityEffect = {
                type: 'UTILITY',
                utilityType: 'control',
                description: 'Drop it!',
                controlOptions: [
                    { name: 'Approach', effect: 'approach' },
                    { name: 'Drop', effect: 'drop' }
                ],
                trigger: { type: 'immediate' },
                condition: { type: 'always' }
            }

            const selectedContext: CommandContext & { playerInput: string } = {
                ...mockContext,
                playerInput: 'Drop'
            }

            const command = new UtilityCommand(effect, selectedContext)
            const newState = await command.execute(mockState)

            // Drop is still log-only for held-item mutation, but the command
            // should also leave a next-turn directive so AI does not ignore
            // the command and choose a normal attack.
            const targetInState = newState.characters.find(c => c.id === mockTarget.id)
            expect(newState.combatLog.some(entry => entry.message.includes('drops what it is holding'))).toBe(true)
            expect(targetInState?.statusEffects).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    name: 'Command: Drop',
                    source: mockContext.spellName,
                    sourceCasterId: mockCaster.id,
                    effect: { type: 'skip_turn' }
                })
            ]))
        })

        it('should use selected player input instead of the first command option', async () => {
            // This reproduces the real Command spell shape: Approach is listed
            // before Flee, but the player can choose Flee from the control menu.
            const closeState = {
                ...mockState,
                characters: [mockCaster, { ...mockTarget, position: { x: 6, y: 5 } }]
            } as CombatState

            const effect: UtilityEffect = {
                type: 'UTILITY',
                utilityType: 'control',
                description: 'Choose a command option.',
                controlOptions: [
                    { name: 'Approach', effect: 'approach' },
                    { name: 'Flee', effect: 'flee' },
                    { name: 'Grovel', effect: 'grovel' }
                ],
                trigger: { type: 'immediate' },
                condition: { type: 'always' }
            }

            // The factory already receives playerInput from the spell UI. This
            // test passes that same selected label through the command context
            // so UtilityCommand can execute the selected option rather than the
            // first option in spell data order.
            const selectedContext: CommandContext & { playerInput: string } = {
                ...mockContext,
                playerInput: 'Flee'
            }

            const command = new UtilityCommand(effect, selectedContext)
            const newState = await command.execute(closeState)

            // Flee moves the target away from the caster. If UtilityCommand
            // incorrectly auto-picks Approach, this x value moves below 6.
            const newTarget = newState.characters.find(c => c.id === mockTarget.id)
            expect(newTarget?.position.x).toBeGreaterThan(6)
        })

        it('should leave a turn directive marker for selected "halt" command', async () => {
            const effect: UtilityEffect = {
                type: 'UTILITY',
                utilityType: 'control',
                description: 'Stop!',
                controlOptions: [
                    { name: 'Approach', effect: 'approach' },
                    { name: 'Halt', effect: 'halt' }
                ],
                trigger: { type: 'immediate' },
                condition: { type: 'always' }
            }

            const selectedContext: CommandContext & { playerInput: string } = {
                ...mockContext,
                playerInput: 'Halt'
            }

            const command = new UtilityCommand(effect, selectedContext)
            const newState = await command.execute(mockState)

            // Halt affects the creature's next turn. A durable status marker
            // gives the AI planner and turn systems something parsable instead
            // of leaving only a combat-log sentence behind.
            const targetInState = newState.characters.find(c => c.id === mockTarget.id)
            expect(targetInState?.statusEffects).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    name: 'Command: Halt',
                    source: mockContext.spellName,
                    sourceCasterId: mockCaster.id,
                    effect: { type: 'skip_turn' }
                })
            ]))
        })

        it('should leave prone and a turn directive marker for selected "grovel" command', async () => {
            const effect: UtilityEffect = {
                type: 'UTILITY',
                utilityType: 'control',
                description: 'Grovel!',
                controlOptions: [
                    { name: 'Approach', effect: 'approach' },
                    { name: 'Grovel', effect: 'grovel' }
                ],
                trigger: { type: 'immediate' },
                condition: { type: 'always' }
            }

            const selectedContext: CommandContext & { playerInput: string } = {
                ...mockContext,
                playerInput: 'Grovel'
            }

            const command = new UtilityCommand(effect, selectedContext)
            const newState = await command.execute(mockState)

            // Grovel has two visible consequences: the target becomes Prone,
            // and its next AI turn should end instead of selecting a normal
            // attack. The directive marker gives the planner that second fact.
            const targetInState = newState.characters.find(c => c.id === mockTarget.id)
            expect(targetInState?.statusEffects).toEqual(expect.arrayContaining([
                expect.objectContaining({ name: 'Prone' }),
                expect.objectContaining({
                    name: 'Command: Grovel',
                    source: mockContext.spellName,
                    sourceCasterId: mockCaster.id,
                    effect: { type: 'skip_turn' }
                })
            ]))
        })

        it('should apply area movement damage when flee movement crosses a spell zone', async () => {
            const closeTarget = {
                ...mockTarget,
                position: { x: 6, y: 5 },
                currentHP: 20,
                maxHP: 20
            }
            const zoneEffect: SpellEffect = {
                type: 'DAMAGE',
                trigger: { type: 'on_move_in_area' },
                condition: { type: 'always' },
                damage: { dice: '1d1', type: 'Piercing' }
            } as unknown as SpellEffect
            const zoneState = {
                ...mockState,
                characters: [mockCaster, closeTarget],
                spellZones: [{
                    id: 'command-flee-zone',
                    spellId: 'command-flee-zone',
                    casterId: 'zone-caster',
                    position: { x: 8, y: 5 },
                    areaOfEffect: { shape: 'cube', size: 30 },
                    effects: [zoneEffect],
                    triggeredThisTurn: new Set(),
                    triggeredEver: new Set()
                } as any]
            } as CombatState

            const effect: UtilityEffect = {
                type: 'UTILITY',
                utilityType: 'control',
                description: 'Run through the hazard!',
                controlOptions: [
                    { name: 'Flee', effect: 'flee' }
                ],
                trigger: { type: 'immediate' },
                condition: { type: 'always' }
            }

            const command = new UtilityCommand(effect, mockContext)
            const newState = await command.execute(zoneState)
            const newTarget = newState.characters.find(c => c.id === mockTarget.id)

            expect(newTarget?.position.x).toBeGreaterThan(6)
            expect(newTarget?.currentHP).toBeLessThan(closeTarget.currentHP)
            expect(newState.combatLog.some(entry => entry.message.includes('zone effect'))).toBe(true)
        })
    });

    describe('Taunt Mechanics', () => {
        it('should apply taunt status marker', async () => {
            const effect: UtilityEffect = {
                type: 'UTILITY',
                utilityType: 'other',
                description: 'Compelled Duel',
                taunt: {
                    disadvantageAgainstOthers: true,
                    leashRangeFeet: 30
                },
                trigger: { type: 'immediate' },
                condition: { type: 'always' }
            }

            const command = new UtilityCommand(effect, mockContext)
            const newState = await command.execute(mockState)

            const targetInState = newState.characters.find(c => c.id === mockTarget.id)
            const tauntEffect = targetInState?.statusEffects.find(e => e.name === 'Taunted')
            expect(tauntEffect).toBeDefined()

            const logEntry = newState.combatLog.find(l => l.message.includes('is taunted'))
            expect(logEntry).toBeDefined()
        })
    });

    describe('Save Penalty Registration (Mind Sliver)', () => {
        it('should register a save penalty rider on the target', async () => {
            const effect: UtilityEffect = {
                type: 'UTILITY',
                utilityType: 'other',
                description: 'Subtract 1d4 from next save',
                savePenalty: {
                    dice: '1d4',
                    applies: 'next_save',
                    duration: { type: 'rounds', value: 1 }
                },
                trigger: { type: 'immediate' },
                condition: { type: 'always' }
            }

            const command = new UtilityCommand(effect, mockContext)
            const newState = await command.execute(mockState)

            const targetInState = newState.characters.find(c => c.id === mockTarget.id)
            expect(targetInState?.savePenaltyRiders).toHaveLength(1)
            expect(targetInState?.savePenaltyRiders?.[0]).toMatchObject({
                dice: '1d4',
                applies: 'next_save',
                sourceName: mockContext.spellName
            })
        })
    });
});
