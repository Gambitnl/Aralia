import { describe, it, expect } from 'vitest'
import { mockCaster, mockTarget, mockContext, mockState, createMockCombatState, UtilityCommand } from './UtilityCommand.testHelpers'
import type { Spell, UtilityEffect, SelectedSpellTarget } from './UtilityCommand.testHelpers'
import prestidigitationJson from '../../../public/data/spells/level-0/prestidigitation.json'
import druidcraftJson from '../../../public/data/spells/level-0/druidcraft.json'
import elementalismJson from '../../../public/data/spells/level-0/elementalism.json'

describe('UtilityCommand', () => {
    const prestidigitationEffect = (prestidigitationJson as Spell).effects[0] as UtilityEffect

    describe('Prestidigitation utility bridge', () => {
        const prestidigitationTarget = {
            kind: 'object' as const,
            id: 'torch-1',
            name: 'Torch',
            position: { x: 8, y: 4 }
        }

        const prestidigitationState = createMockCombatState({
            characters: [mockCaster, mockTarget],
            turnState: { currentTurn: 10, turnOrder: [mockCaster.id, mockTarget.id], currentCharacterId: mockCaster.id, phase: 'action', actionsThisTurn: [] },
            combatLog: [],
            activeLightSources: [],
            activeMinorUtilityEffects: []
        })

        const runPrestidigitation = (playerInput: string, state: CombatState = prestidigitationState) => {
            const command = new UtilityCommand(prestidigitationEffect, {
                ...mockContext,
                spellId: 'prestidigitation',
                spellName: 'Prestidigitation',
                playerInput,
                selectedSpellTargets: [prestidigitationTarget]
            })

            return command.execute(state)
        }

        it.each([
            ['Sensory Effect', 'Harmless Magical Sensory Effect', true, undefined],
            ['Fire Play', 'Small Flame Toggle', true, undefined],
            ['Clean Or Soil', 'Cleaned Or Soiled Object', true, undefined],
            ['Minor Sensation', 'Chilled Warmed Or Flavored Material', false, prestidigitationState.turnState.currentTurn + 600],
            ['Magic Mark', 'Magic Mark', false, prestidigitationState.turnState.currentTurn + 600],
            ['Minor Creation', 'Hand-Sized Minor Creation', false, prestidigitationState.turnState.currentTurn + 1]
        ])('creates the %s artifact as %s', async (mode, objectName, instantaneous, expiresAtRound) => {
            const newState = await runPrestidigitation(mode)
            const artifact = newState.activeMinorUtilityEffects?.[0]

            expect(artifact).toMatchObject({
                spellId: 'prestidigitation',
                spellName: 'Prestidigitation',
                casterId: mockCaster.id,
                mode,
                position: prestidigitationTarget.position,
                targetObjectId: prestidigitationTarget.id,
                targetObjectName: prestidigitationTarget.name,
                createdTurn: prestidigitationState.turnState.currentTurn,
                instantaneous,
                harmless: true,
                expiresAtRound,
                createdObject: expect.objectContaining({
                    name: objectName
                })
            })
        })

        it('prunes expired Prestidigitation effects before enforcing the three-effect cap', async () => {
            const expiredEffect = {
                id: 'prestidigitation-expired',
                spellId: 'prestidigitation',
                spellName: 'Prestidigitation',
                casterId: mockCaster.id,
                mode: 'Minor Sensation',
                position: prestidigitationTarget.position,
                targetObjectId: prestidigitationTarget.id,
                targetObjectName: prestidigitationTarget.name,
                createdTurn: 1,
                expiresAtRound: 9,
                instantaneous: false,
                harmless: true,
                createdObject: (prestidigitationJson as Spell).effects[0].createdObjects?.[3] as NonNullable<UtilityEffect['createdObjects']>[number]
            }

            const seededState = createMockCombatState({
                characters: [mockCaster, mockTarget],
                turnState: { currentTurn: 10, turnOrder: [mockCaster.id, mockTarget.id], currentCharacterId: mockCaster.id, phase: 'action', actionsThisTurn: [] },
                combatLog: [],
                activeLightSources: [],
                activeMinorUtilityEffects: [
                    expiredEffect,
                    {
                        ...expiredEffect,
                        id: 'prestidigitation-active-1',
                        createdTurn: 8,
                        expiresAtRound: 610
                    },
                    {
                        ...expiredEffect,
                        id: 'prestidigitation-active-2',
                        createdTurn: 8,
                        expiresAtRound: 610
                    },
                    {
                        ...expiredEffect,
                        id: 'prestidigitation-active-3',
                        createdTurn: 8,
                        expiresAtRound: 610
                    }
                ]
            })

            const newState = await runPrestidigitation('Minor Sensation', seededState)

            expect(newState.activeMinorUtilityEffects?.some(effect => effect.id === 'prestidigitation-expired')).toBe(false)
            expect(newState.activeMinorUtilityEffects?.filter(effect => effect.spellId === 'prestidigitation' && !effect.instantaneous)).toHaveLength(3)
            expect(newState.combatLog.some(entry => entry.data?.rejectedPrestidigitationMode === 'active_effect_cap')).toBe(true)
        })
    })

    describe('Minor utility mode artifacts', () => {
        const pointTarget: SelectedSpellTarget = {
            kind: 'point',
            position: { x: 6, y: 6 },
            purpose: 'area_origin'
        }

        it.each([
            ['druidcraft', 'Druidcraft', druidcraftJson, 'Weather Sensor', 'Weather Omen'],
            ['druidcraft', 'Druidcraft', druidcraftJson, 'Bloom', 'Bloomed Plant Part'],
            ['druidcraft', 'Druidcraft', druidcraftJson, 'Sensory Effect', 'Harmless Nature Sensory Effect'],
            ['druidcraft', 'Druidcraft', druidcraftJson, 'Fire Play', 'Small Flame Toggle'],
            ['elementalism', 'Elementalism', elementalismJson, 'Beckon Air', 'Elemental Breeze'],
            ['elementalism', 'Elementalism', elementalismJson, 'Beckon Earth', 'Dust Or Sand Shroud'],
            ['elementalism', 'Elementalism', elementalismJson, 'Beckon Fire', 'Harmless Embers And Smoke'],
            ['elementalism', 'Elementalism', elementalismJson, 'Beckon Water', 'Cool Mist Or Clean Water'],
            ['elementalism', 'Elementalism', elementalismJson, 'Sculpt Element', 'Crude Elemental Shape']
        ])('creates a selected %s artifact for %s', async (spellId, spellName, spellJson, mode, objectName) => {
            const command = new UtilityCommand(spellJson.effects[0] as UtilityEffect, {
                ...mockContext,
                spellId,
                spellName,
                playerInput: mode,
                selectedSpellTargets: [pointTarget]
            })

            const newState = await command.execute(mockState)
            const artifact = newState.activeMinorUtilityEffects?.find(effect => effect.spellId === spellId)

            // These cantrips are harmless, but the chosen environmental result
            // still needs a durable state record that renderer/exploration
            // surfaces can inspect without parsing combat-log prose.
            expect(artifact).toMatchObject({
                spellId,
                spellName,
                mode,
                position: pointTarget.position,
                harmless: true,
                createdObject: expect.objectContaining({ name: objectName })
            })
        })

        it('records Druidcraft Weather Sensor as a one-round omen with weather prediction metadata', async () => {
            const command = new UtilityCommand(druidcraftJson.effects[0] as UtilityEffect, {
                ...mockContext,
                spellId: 'druidcraft',
                spellName: 'Druidcraft',
                playerInput: 'Weather Sensor',
                selectedSpellTargets: [pointTarget]
            })

            const newState = await command.execute(mockState)
            const artifact = newState.activeMinorUtilityEffects?.[0]

            expect(artifact).toMatchObject({
                mode: 'Weather Sensor',
                expiresAtRound: mockState.turnState.currentTurn + 1,
                instantaneous: false,
                createdObject: expect.objectContaining({
                    objectType: 'sensory_effect',
                    affectedVolumeShape: 'Tiny',
                    manipulationOptions: expect.arrayContaining([
                        'predict_local_weather_next_24_hours',
                        'manifest_weather_symbol'
                    ])
                }),
                sensorState: expect.objectContaining({
                    kind: 'local_weather_prediction'
                })
            })
        })

        it('records Druidcraft Bloom against the selected plant object', async () => {
            const plantTarget: SelectedSpellTarget = {
                kind: 'object',
                id: 'rose-bush',
                name: 'Rose Bush',
                position: { x: 7, y: 6 }
            }
            const command = new UtilityCommand(druidcraftJson.effects[0] as UtilityEffect, {
                ...mockContext,
                spellId: 'druidcraft',
                spellName: 'Druidcraft',
                playerInput: 'Bloom',
                selectedSpellTargets: [plantTarget]
            })

            const newState = await command.execute(mockState)
            const artifact = newState.activeMinorUtilityEffects?.[0]

            expect(artifact).toMatchObject({
                mode: 'Bloom',
                targetObjectId: 'rose-bush',
                targetObjectName: 'Rose Bush',
                instantaneous: true,
                createdObject: expect.objectContaining({
                    objectType: 'plant_effect',
                    manipulationOptions: expect.arrayContaining([
                        'flower_blossoms',
                        'seed_pod_opens',
                        'leaf_bud_blooms'
                    ])
                })
            })
        })

        it('records Elementalism Beckon Fire as harmless embers and one-minute scented smoke', async () => {
            const command = new UtilityCommand(elementalismJson.effects[0] as UtilityEffect, {
                ...mockContext,
                spellId: 'elementalism',
                spellName: 'Elementalism',
                playerInput: 'Beckon Fire',
                selectedSpellTargets: [pointTarget]
            })

            const newState = await command.execute(mockState)
            const artifact = newState.activeMinorUtilityEffects?.[0]

            expect(artifact).toMatchObject({
                mode: 'Beckon Fire',
                expiresAtRound: mockState.turnState.currentTurn + 10,
                createdObject: expect.objectContaining({
                    name: 'Harmless Embers And Smoke',
                    affectedVolumeShape: 'Cube',
                    affectedVolumeSizeFeet: 5,
                    canChangeColorOrOpacity: true,
                    ignitesTouchedObjects: true,
                    manipulationOptions: expect.arrayContaining([
                        'choose_smoke_color',
                        'choose_smoke_scent',
                        'light_small_flames'
                    ])
                }),
                aftermathState: expect.objectContaining({
                    kind: 'minor_element_lingering_cleanup'
                })
            })
        })

        it('records Elementalism Sculpt Element as a one-hour crude elemental shape', async () => {
            const command = new UtilityCommand(elementalismJson.effects[0] as UtilityEffect, {
                ...mockContext,
                spellId: 'elementalism',
                spellName: 'Elementalism',
                playerInput: 'Sculpt Element',
                selectedSpellTargets: [pointTarget]
            })

            const newState = await command.execute(mockState)
            const artifact = newState.activeMinorUtilityEffects?.[0]

            expect(artifact).toMatchObject({
                mode: 'Sculpt Element',
                expiresAtRound: mockState.turnState.currentTurn + 600,
                createdObject: expect.objectContaining({
                    name: 'Crude Elemental Shape',
                    affectedVolumeSizeFeet: 1,
                    shapeOptions: expect.arrayContaining(['dirt', 'sand', 'fire', 'smoke', 'mist', 'water']),
                    manipulationOptions: ['assume_crude_shape']
                })
            })
        })
    });
})
