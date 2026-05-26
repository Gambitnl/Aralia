import { describe, it, expect } from 'vitest'
import { UtilityCommand } from '../effects/UtilityCommand'
import { UtilityEffect, SoundEmission, SensoryManifestation } from '@/types/spells'
import { CommandContext } from '../base/SpellCommand'
import { createMockCombatCharacter, createMockCombatState, createMockGameState } from '@/utils/factories'

/**
 * This test file proves that newly structured sound and sensory spell metadata
 * can pass through the existing utility-command path without being dropped.
 *
 * Package 14 uses this as a narrow guard for spells such as Alarm,
 * Thaumaturgy, Silent Image, and Major Image. The test deliberately stays at
 * the command boundary: richer sound propagation, line-of-sight, and illusion
 * adjudication engines remain separate future systems.
 */
describe('Sensory Mechanics', () => {
    // A small caster and combat state are enough here because the package is
    // proving metadata preservation, not full battlefield targeting.
    const mockCaster = createMockCombatCharacter({
        id: 'caster-1',
        name: 'Bard',
        position: { x: 5, y: 5 },
    })

    const mockState = createMockCombatState({
        characters: [mockCaster],
        turnState: { currentTurn: 1, turnOrder: [mockCaster.id], currentCharacterId: mockCaster.id, phase: 'action', actionsThisTurn: [] },
        combatLog: [],
        activeLightSources: [],
    })

    // The command context mirrors a normal utility spell cast so the command
    // writes the same combat-log shape used by the live simulator.
    const mockContext: CommandContext = {
        spellId: 'spell-1',
        spellName: 'Sensory Spell',
        castAtLevel: 1,
        caster: mockCaster,
        targets: [],
        gameState: createMockGameState()
    }

    it('should process sound emission metadata without errors', () => {
        // Sound metadata records the audible footprint that later systems can
        // use for alarms, thunderous effects, and other noisy spell results.
        const sound: SoundEmission = {
            audibleRadius: 60,
            radiusUnit: 'feet',
            source: 'spell_area',
            trigger: 'on_trigger',
            description: 'A loud bell rings.'
        }
        // UtilityCommand is the existing runtime surface for non-damage spell
        // effects, so Package 14 proves the new sound shape survives there.
        const effect: UtilityEffect = {
            type: 'UTILITY',
            utilityType: 'sensory',
            description: 'Sound emission test',
            soundEmission: sound,
            trigger: { type: 'immediate' },
            condition: { type: 'always' }
        }

        const command = new UtilityCommand(effect, mockContext)
        const newState = command.execute(mockState)

        // The combat log is the current player-visible proof surface for
        // utility spell outcomes.
        expect(newState.combatLog).toHaveLength(1)
        expect(newState.combatLog[0].message).toContain('senses:')
        // The structured sound data must remain attached for future simulator
        // and arbitration layers to inspect.
        const logEffect = newState.combatLog[0].data?.utilityEffect as UtilityEffect
        expect(logEffect.soundEmission).toBeDefined()
        expect(logEffect.soundEmission?.audibleRadius).toBe(60)
    })

    it('should process sensory manifestation metadata without errors', () => {
        // Sensory manifestation metadata states which senses an illusion can
        // affect, while leaving actual illusion dispute handling to later work.
        const manifestation: SensoryManifestation = {
            modeSource: 'not_applicable',
            variants: [
                {
                    label: 'Visual Illusion',
                    allowedSenses: ['sight'],
                    excludedSenses: ['sound', 'smell']
                }
            ]
        }
        // Creation-style utility effects cover visual illusions and similar
        // spell outputs that produce something perceptible in the world.
        const effect: UtilityEffect = {
            type: 'UTILITY',
            utilityType: 'creation',
            description: 'Sensory manifestation test',
            sensoryManifestation: manifestation,
            trigger: { type: 'immediate' },
            condition: { type: 'always' }
        }

        const command = new UtilityCommand(effect, mockContext)
        const newState = command.execute(mockState)

        // The command should preserve the sight-only illusion limits exactly,
        // so the spellbook, simulator, and later AI arbitration can read them.
        expect(newState.combatLog).toHaveLength(1)
        const logEffect = newState.combatLog[0].data?.utilityEffect as UtilityEffect
        expect(logEffect.sensoryManifestation).toBeDefined()
        expect(logEffect.sensoryManifestation?.variants[0].allowedSenses).toContain('sight')
    })
})
