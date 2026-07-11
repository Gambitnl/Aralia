import { describe, it, expect } from 'vitest'
import { mockCaster, mockTarget, mockContext, createMockCombatState, UtilityCommand } from './UtilityCommand.testHelpers'
import type { Spell, UtilityEffect, CombatState } from './UtilityCommand.testHelpers'
import identifyJson from '../../../public/data/spells/level-1/identify.json'

describe('UtilityCommand', () => {
    const identifyEffect = (identifyJson as Spell).effects[0] as UtilityEffect

    const mapArtifactFields: Array<keyof CombatState> = [
        'spellZones',
        'activeLightSources',
        'spellObjectImpacts',
        'spellObjectRepairs',
        'activeIllusionEffects',
        'activeFireEffects',
        'activeShapeWaterEffects',
        'activeThaumaturgyEffects',
        'activeMinorUtilityEffects',
        'activeSpellHelpers',
        'activeSpellForces',
        'activeSpellGuardians',
        'activeSpellEmanations',
        'activeEnvironmentalControls',
        'activeExtradimensionalSpaces',
        'activeSpellStructures',
        'activeSpellWards',
        'activeAnimatedObjects',
        'activeAwakenedCreatures',
        'activeTruePolymorphTransformations',
        'activeMoldEarthSurfaceMarks'
    ]

    describe('No-map informational utility bridge', () => {
        it('resolves Identify as an information log without creating phantom map artifacts', async () => {
            const cleanNoMapState = createMockCombatState({
                characters: [mockCaster, mockTarget],
                turnState: { currentTurn: 12, turnOrder: [mockCaster.id, mockTarget.id], currentCharacterId: mockCaster.id, phase: 'action', actionsThisTurn: [] },
                combatLog: [],
                activeLightSources: [],
                spellZones: [],
                spellObjectImpacts: [],
                spellObjectRepairs: [],
                activeIllusionEffects: [],
                activeFireEffects: [],
                activeShapeWaterEffects: [],
                activeThaumaturgyEffects: [],
                activeMinorUtilityEffects: [],
                activeSpellHelpers: [],
                activeSpellForces: [],
                activeSpellGuardians: [],
                activeSpellEmanations: [],
                activeEnvironmentalControls: [],
                activeExtradimensionalSpaces: [],
                activeSpellStructures: [],
                activeSpellWards: [],
                activeAnimatedObjects: [],
                activeAwakenedCreatures: [],
                activeTruePolymorphTransformations: [],
                activeMoldEarthSurfaceMarks: []
            })

            const command = new UtilityCommand(identifyEffect, {
                ...mockContext,
                spellId: 'identify',
                spellName: 'Identify',
                targets: [],
                selectedSpellTargets: [{
                    kind: 'object',
                    id: 'wand-1',
                    name: 'Silver Wand',
                    position: { x: 6, y: 5 }
                }],
                effectDuration: (identifyJson as Spell).duration
            })

            const newState = await command.execute(cleanNoMapState)

            expect(newState.combatLog).toHaveLength(1)
            expect(newState.combatLog[0]).toMatchObject({
                type: 'action',
                characterId: mockCaster.id
            })
            expect(newState.combatLog[0].message).toContain('Wizard gains information')
            expect(newState.combatLog[0].data?.utilityEffect).toMatchObject({
                type: 'UTILITY',
                utilityType: 'information'
            })

            // Identify's ritual/material metadata must not invent a tactical
            // token, zone, light, summon, structure, or other map artifact.
            for (const field of mapArtifactFields) {
                expect(newState[field], field).toEqual([])
            }
        })
    })
})
