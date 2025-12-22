import { describe, it, expect } from 'vitest'
import { UtilityCommand } from '../effects/UtilityCommand'
import { UtilityEffect } from '@/types/spells'
import { CombatCharacter, CombatState } from '@/types/combat'
import { CommandContext } from '../base/SpellCommand'
import { createMockGameState } from '@/utils/factories'

describe('UtilityCommand', () => {
    // --- Mock Data Setup ---
    const mockCaster: CombatCharacter = {
        id: 'caster-1',
        name: 'Wizard',
        position: { x: 5, y: 5 },
        stats: { speed: 30 },
        // Minimal required fields to satisfy type
    } as CombatCharacter

    const mockTarget: CombatCharacter = {
        id: 'target-1',
        name: 'Goblin',
        position: { x: 7, y: 7 }, // 2 tiles away (approx 10-14ft)
        stats: { speed: 30 },
        statusEffects: [],
    } as CombatCharacter

    const mockState: CombatState = {
        isActive: true,
        characters: [mockCaster, mockTarget],
        activeLightSources: [],
        turnState: { currentTurn: 1 },
        combatLog: [],
    } as unknown as CombatState

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
        it('should create a light source attached to the caster', () => {
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
            const newState = command.execute(mockState)

            expect(newState.activeLightSources).toHaveLength(1)
            const source = newState.activeLightSources[0]
            expect(source.casterId).toBe(mockCaster.id)
            expect(source.attachedToCharacterId).toBe(mockCaster.id)
            expect(source.brightRadius).toBe(20)
            expect(source.color).toBe('#FFCC00')
            expect(newState.combatLog).toHaveLength(2) // 1 generic action, 1 status for light
        })

        it('should create a light source attached to a target', () => {
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
            const newState = command.execute(mockState)

            expect(newState.activeLightSources).toHaveLength(1)
            const source = newState.activeLightSources[0]
            expect(source.attachedToCharacterId).toBe(mockTarget.id)
        })
    });

    describe('Control Options (Command Spell)', () => {
        it('should apply "grovel" command (prone status)', () => {
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
            const newState = command.execute(mockState)

            // UtilityCommand automatically applies the FIRST option in the list as a fallback logic
            const targetInState = newState.characters.find(c => c.id === mockTarget.id)
            expect(targetInState?.statusEffects).toHaveLength(1)
            expect(targetInState?.statusEffects[0].name).toBe('Prone')

            // Should verify logging
            const logEntry = newState.combatLog.find(l => l.message.includes('falls prone'))
            expect(logEntry).toBeDefined()
        })

        it('should apply "flee" command (movement)', () => {
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
            const newState = command.execute(closeState)

            // Character should have moved AWAY from caster (x=5 -> x=6, so move to x=7+)
            const newTarget = newState.characters.find(c => c.id === mockTarget.id)
            expect(newTarget?.position.x).toBeGreaterThan(6)
        })
    });

    describe('Taunt Mechanics', () => {
        it('should apply taunt status marker', () => {
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
            const newState = command.execute(mockState)

            const targetInState = newState.characters.find(c => c.id === mockTarget.id)
            const tauntEffect = targetInState?.statusEffects.find(e => e.name === 'Taunted')
            expect(tauntEffect).toBeDefined()

            const logEntry = newState.combatLog.find(l => l.message.includes('is taunted'))
            expect(logEntry).toBeDefined()
        })
    });
})
