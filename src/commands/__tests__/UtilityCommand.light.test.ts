import { describe, it, expect } from 'vitest'
import { mockCaster, mockTarget, mockContext, mockState, createMockCombatState, UtilityCommand, GrantedActionCommand, StartConcentrationCommand, BreakConcentrationCommand } from './UtilityCommand.testHelpers'
import type { Spell, UtilityEffect, SelectedSpellTarget } from './UtilityCommand.testHelpers'
import produceFlameJson from '../../../public/data/spells/level-0/produce-flame.json'
import dancingLightsJson from '../../../public/data/spells/level-0/dancing-lights.json'

describe('UtilityCommand', () => {
    describe('Produce Flame light bridge', () => {
        const produceFlameEffect = (produceFlameJson as Spell).effects[0] as UtilityEffect
        const produceFlameContext: CommandContext = {
            ...mockContext,
            spellId: 'produce-flame',
            spellName: 'Produce Flame',
            targets: [mockCaster]
        }

        const runProduceFlame = (state: CombatState = mockState) => {
            const command = new UtilityCommand(produceFlameEffect, produceFlameContext)
            return command.execute(state)
        }

        it('keeps the held flame attached to the caster when Produce Flame is cast', async () => {
            const newState = await runProduceFlame()
            const source = newState.activeLightSources[0]

            expect(newState.activeLightSources).toHaveLength(1)
            expect(source).toMatchObject({
                sourceSpellId: 'produce-flame',
                casterId: mockCaster.id,
                attachedTo: 'caster',
                attachedToCharacterId: mockCaster.id,
                brightRadius: 20,
                dimRadius: 20,
                opaqueCoverBlocks: false
            })
        })

        it('replaces the previous carried flame when Produce Flame is recast', async () => {
            const previousLight = {
                id: 'produce-flame-light-old',
                sourceSpellId: 'produce-flame',
                casterId: mockCaster.id,
                brightRadius: 20,
                dimRadius: 20,
                attachedTo: 'caster' as const,
                attachedToCharacterId: mockCaster.id,
                createdTurn: 1
            }
            const seededState = createMockCombatState({
                ...mockState,
                activeLightSources: [previousLight]
            })

            const newState = await runProduceFlame(seededState)
            const currentLights = newState.activeLightSources.filter(light =>
                light.sourceSpellId === 'produce-flame' &&
                light.casterId === mockCaster.id
            )

            expect(currentLights).toHaveLength(1)
            expect(currentLights[0].id).not.toBe(previousLight.id)
            expect(newState.combatLog.at(-1)?.data?.removedRecastLightSources).toBe(1)
        })
    })

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

        it('should create a Starry Wisp-style dim light and anti-Invisible rider from a hit utility payload', async () => {
            const effect: UtilityEffect = {
                type: 'UTILITY',
                utilityType: 'sensory',
                description: 'The target sheds Dim Light and cannot benefit from Invisible.',
                light: {
                    brightRadius: 0,
                    dimRadius: 10,
                    attachedTo: 'target',
                    color: 'starry radiance'
                },
                invisibilitySuppression: {
                    suppressesConditionBenefit: 'Invisible',
                    scope: 'target',
                    duration: 'until_end_of_caster_next_turn',
                    description: 'The target cannot benefit from Invisible while glowing.'
                },
                trigger: { type: 'immediate' },
                condition: { type: 'hit' }
            }
            const command = new UtilityCommand(effect, {
                ...mockContext,
                spellId: 'starry-wisp',
                spellName: 'Starry Wisp'
            })

            const newState = await command.execute(mockState)
            const source = newState.activeLightSources[0]
            const targetInState = newState.characters.find(c => c.id === mockTarget.id)
            const suppression = targetInState?.statusEffects.find(status =>
                status.source === 'Starry Wisp' &&
                status.suppressedConditionBenefit === 'Invisible'
            )

            // Starry Wisp is not a generic Light spell, but its hit rider must
            // still create a target-attached dim-light artifact and a combat
            // marker that tells later attacks to ignore Invisible's benefit.
            expect(source).toMatchObject({
                sourceSpellId: 'starry-wisp',
                casterId: mockCaster.id,
                brightRadius: 0,
                dimRadius: 10,
                attachedTo: 'target',
                attachedToCharacterId: mockTarget.id,
                color: 'starry radiance',
                expiresAtRound: mockState.turnState.currentTurn + 1
            })
            expect(suppression).toMatchObject({
                source: 'Starry Wisp',
                sourceCasterId: mockCaster.id,
                suppressedConditionBenefit: 'Invisible',
                duration: 1
            })
        })

        it('materializes Dancing Lights separate mode as four linked point-light artifacts', async () => {
            const pointTarget: SelectedSpellTarget = {
                kind: 'point',
                position: { x: 10, y: 10 },
                purpose: 'area_origin'
            }
            const command = new UtilityCommand(dancingLightsJson.effects[0] as UtilityEffect, {
                ...mockContext,
                spellId: 'dancing-lights',
                spellName: 'Dancing Lights',
                playerInput: 'Separate Lights',
                selectedSpellTargets: [pointTarget]
            })

            const newState = await command.execute(mockState)
            const dancingLights = newState.activeLightSources.filter(source => source.sourceSpellId === 'dancing-lights')

            // Dancing Lights is not a single generic Light spell. Each created
            // orb needs its own position plus shared movement/leash metadata so
            // later bonus-action movement can operate on the cluster.
            expect(dancingLights).toHaveLength(4)
            expect(dancingLights.map(source => source.position)).toEqual([
                { x: 10, y: 10 },
                { x: 11, y: 10 },
                { x: 10, y: 11 },
                { x: 11, y: 11 }
            ])
            expect(dancingLights.every(source => (
                source.attachedTo === 'point' &&
                source.attachedToCharacterId === undefined &&
                source.dimRadius === 10 &&
                source.presentation === 'cluster_member' &&
                source.clusterSize === 4 &&
                source.hover === true &&
                source.maxMoveDistanceFeet === 60 &&
                source.leashDistanceFeet === 20 &&
                source.vanishesBeyondRangeFeet === 120 &&
                source.movementCost === 'bonus_action'
            ))).toBe(true)
            expect(new Set(dancingLights.map(source => source.clusterId)).size).toBe(1)
        })

        it('materializes Dancing Lights humanoid mode as one combined Medium form', async () => {
            const pointTarget: SelectedSpellTarget = {
                kind: 'point',
                position: { x: 8, y: 8 },
                purpose: 'area_origin'
            }
            const command = new UtilityCommand(dancingLightsJson.effects[0] as UtilityEffect, {
                ...mockContext,
                spellId: 'dancing-lights',
                spellName: 'Dancing Lights',
                playerInput: 'Humanoid Form',
                selectedSpellTargets: [pointTarget]
            })

            const newState = await command.execute(mockState)
            const dancingLights = newState.activeLightSources.filter(source => source.sourceSpellId === 'dancing-lights')

            expect(dancingLights).toHaveLength(1)
            expect(dancingLights[0]).toMatchObject({
                attachedTo: 'point',
                position: { x: 8, y: 8 },
                dimRadius: 10,
                presentation: 'combined_humanoid',
                clusterIndex: 0,
                clusterSize: 4,
                maxMoveDistanceFeet: 60,
                leashDistanceFeet: 20,
                vanishesBeyondRangeFeet: 120
            })
        })

        it('removes all Dancing Lights artifacts when concentration breaks', async () => {
            const pointTarget: SelectedSpellTarget = {
                kind: 'point',
                position: { x: 10, y: 10 },
                purpose: 'area_origin'
            }
            const context = {
                ...mockContext,
                spellId: 'dancing-lights',
                spellName: 'Dancing Lights',
                playerInput: 'Separate Lights',
                selectedSpellTargets: [pointTarget]
            }
            const castState = await new UtilityCommand(dancingLightsJson.effects[0] as UtilityEffect, context).execute(mockState)
            const concentratedState = new StartConcentrationCommand(dancingLightsJson as unknown as Spell, context).execute(castState)
            const endedState = new BreakConcentrationCommand(context).execute(concentratedState)

            // The concentration scan records every light-source log entry, and
            // the break path also removes by source spell id. Either way, the
            // four Dancing Lights artifacts should not outlive the spell.
            expect(concentratedState.activeLightSources.filter(source => source.sourceSpellId === 'dancing-lights')).toHaveLength(4)
            expect(endedState.activeLightSources.filter(source => source.sourceSpellId === 'dancing-lights')).toHaveLength(0)
        })

        it('moves Dancing Lights as a linked bonus-action cluster', async () => {
            const castState = await new UtilityCommand(dancingLightsJson.effects[0] as UtilityEffect, {
                ...mockContext,
                spellId: 'dancing-lights',
                spellName: 'Dancing Lights',
                playerInput: 'Separate Lights',
                selectedSpellTargets: [{ kind: 'point', position: { x: 10, y: 10 } }]
            }).execute(mockState)
            const moveCommand = new GrantedActionCommand({
                ...mockContext,
                spellId: 'dancing-lights',
                spellName: 'Dancing Lights',
                selectedSpellTargets: [{ kind: 'point', position: { x: 12, y: 10 } }]
            }, {
                actionLabel: 'Move',
                actionCost: 'bonus_action',
                frequency: 'each_turn',
                rangeLimit: 60
            })

            const movedState = await moveCommand.execute(castState)
            const dancingLights = movedState.activeLightSources.filter(source => source.sourceSpellId === 'dancing-lights')

            expect(dancingLights.map(source => source.position)).toEqual([
                { x: 12, y: 10 },
                { x: 13, y: 10 },
                { x: 12, y: 11 },
                { x: 13, y: 11 }
            ])
            expect(movedState.combatLog.some(entry => entry.data?.movedDancingLights)).toBe(true)
        })

        it('rejects Dancing Lights movement that breaks the 20-foot leash', async () => {
            const castState = await new UtilityCommand(dancingLightsJson.effects[0] as UtilityEffect, {
                ...mockContext,
                spellId: 'dancing-lights',
                spellName: 'Dancing Lights',
                playerInput: 'Separate Lights',
                selectedSpellTargets: [{ kind: 'point', position: { x: 10, y: 10 } }]
            }).execute(mockState)
            const moveCommand = new GrantedActionCommand({
                ...mockContext,
                spellId: 'dancing-lights',
                spellName: 'Dancing Lights',
                selectedSpellTargets: [
                    { kind: 'point', position: { x: 10, y: 10 } },
                    { kind: 'point', position: { x: 18, y: 10 } },
                    { kind: 'point', position: { x: 10, y: 18 } },
                    { kind: 'point', position: { x: 18, y: 18 } }
                ]
            }, {
                actionLabel: 'Move',
                actionCost: 'bonus_action',
                frequency: 'each_turn',
                rangeLimit: 60
            })

            const rejectedState = await moveCommand.execute(castState)

            expect(rejectedState.activeLightSources.map(source => source.position)).toEqual(castState.activeLightSources.map(source => source.position))
            expect(rejectedState.combatLog.some(entry => entry.data?.rejectedDancingLightsMove === 'leash')).toBe(true)
        })

        it('rejects Dancing Lights movement beyond the 60-foot bonus-action limit', async () => {
            const castState = await new UtilityCommand(dancingLightsJson.effects[0] as UtilityEffect, {
                ...mockContext,
                spellId: 'dancing-lights',
                spellName: 'Dancing Lights',
                playerInput: 'Separate Lights',
                selectedSpellTargets: [{ kind: 'point', position: { x: 10, y: 10 } }]
            }).execute(mockState)
            const moveCommand = new GrantedActionCommand({
                ...mockContext,
                spellId: 'dancing-lights',
                spellName: 'Dancing Lights',
                selectedSpellTargets: [{ kind: 'point', position: { x: 30, y: 10 } }]
            }, {
                actionLabel: 'Move',
                actionCost: 'bonus_action',
                frequency: 'each_turn',
                rangeLimit: 60
            })

            const rejectedState = await moveCommand.execute(castState)

            expect(rejectedState.activeLightSources.map(source => source.position)).toEqual(castState.activeLightSources.map(source => source.position))
            expect(rejectedState.combatLog.some(entry => entry.data?.rejectedDancingLightsMove === 'move_distance')).toBe(true)
        })

        it('vanishes Dancing Lights that move beyond the spell range from the caster', async () => {
            const castState = await new UtilityCommand(dancingLightsJson.effects[0] as UtilityEffect, {
                ...mockContext,
                spellId: 'dancing-lights',
                spellName: 'Dancing Lights',
                playerInput: 'Separate Lights',
                selectedSpellTargets: [{ kind: 'point', position: { x: 25, y: 5 } }]
            }).execute(mockState)
            const moveCommand = new GrantedActionCommand({
                ...mockContext,
                spellId: 'dancing-lights',
                spellName: 'Dancing Lights',
                selectedSpellTargets: [{ kind: 'point', position: { x: 30, y: 5 } }]
            }, {
                actionLabel: 'Move',
                actionCost: 'bonus_action',
                frequency: 'each_turn',
                rangeLimit: 60
            })

            const movedState = await moveCommand.execute(castState)

            expect(movedState.activeLightSources.filter(source => source.sourceSpellId === 'dancing-lights')).toHaveLength(0)
            expect(movedState.combatLog.some(entry => entry.data?.vanishedDancingLights === 4)).toBe(true)
        })
    });
})
