import { describe, it, expect } from 'vitest'
import { UtilityCommand } from '../effects/UtilityCommand'
import { GrantedActionCommand } from '../effects/GrantedActionCommand'
import { BreakConcentrationCommand, StartConcentrationCommand } from '../effects/ConcentrationCommands'
import { Spell, SpellEffect, UtilityEffect } from '@/types/spells'
import { CombatCharacter, CombatState, SelectedSpellTarget } from '@/types/combat'
import { CommandContext } from '../base/SpellCommand'
import { createMockCombatCharacter, createMockCombatState, createMockGameState } from '@/utils/factories'
import dancingLightsJson from '../../../public/data/spells/level-0/dancing-lights.json'
import druidcraftJson from '../../../public/data/spells/level-0/druidcraft.json'
import elementalismJson from '../../../public/data/spells/level-0/elementalism.json'
import messageJson from '../../../public/data/spells/level-0/message.json'
import minorIllusionJson from '../../../public/data/spells/level-0/minor-illusion.json'
import prestidigitationJson from '../../../public/data/spells/level-0/prestidigitation.json'
import produceFlameJson from '../../../public/data/spells/level-0/produce-flame.json'

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

    const messageEffect = (messageJson as Spell).effects[0] as UtilityEffect
    const minorIllusionEffect = (minorIllusionJson as Spell).effects[0] as UtilityEffect
    const prestidigitationEffect = (prestidigitationJson as Spell).effects[0] as UtilityEffect

    // --- Tests ---

    describe('Message communication bridge', () => {
        const listener = createMockCombatCharacter({
            id: 'listener-1',
            name: 'Guard',
            position: { x: 6, y: 6 },
            statusEffects: []
        })

        const messageState = createMockCombatState({
            characters: [mockCaster, mockTarget, listener],
            turnState: { currentTurn: 4, turnOrder: [mockCaster.id, mockTarget.id, listener.id], currentCharacterId: mockCaster.id, phase: 'action', actionsThisTurn: [] },
            combatLog: [],
            activeLightSources: [],
        })

        const runMessage = (playerInput: string, targets: CombatCharacter[] = [mockTarget]) => {
            const command = new UtilityCommand(messageEffect, {
                ...mockContext,
                spellId: 'message',
                spellName: 'Message',
                targets,
                playerInput
            })

            return command.execute(messageState)
        }

        it('records a private directed whisper and a private target reply', async () => {
            const newState = await runMessage('message=The east door is watched; reply=I understand')
            const exchange = newState.spellCommunicationExchanges?.[0]

            expect(exchange).toMatchObject({
                sourceSpellId: 'message',
                casterId: mockCaster.id,
                targetId: mockTarget.id,
                deliveredText: 'The east door is watched',
                replyText: 'I understand',
                privateRecipientIds: [mockTarget.id],
                replyRecipientIds: [mockCaster.id],
                outcome: 'delivered'
            })
            expect(newState.combatLog[0].targetIds).toEqual([mockTarget.id])
            expect(newState.combatLog[1].targetIds).toEqual([mockCaster.id])
        })

        it('keeps bystanders out of Message delivery and reply recipients', async () => {
            const newState = await runMessage('message=Only you hear this; reply=Only you hear me')
            const exchange = newState.spellCommunicationExchanges?.[0]

            expect(exchange?.privateRecipientIds).not.toContain(listener.id)
            expect(exchange?.replyRecipientIds).not.toContain(listener.id)
            expect(newState.combatLog.flatMap(entry => entry.targetIds || [])).not.toContain(listener.id)
        })

        it('records authored blocker rejection for lead or silence', async () => {
            const newState = await runMessage('message=Can you hear me; blocker=lead')
            const exchange = newState.spellCommunicationExchanges?.[0]

            expect(exchange).toMatchObject({
                outcome: 'blocked',
                blockerReason: 'thin sheet of lead',
                privateRecipientIds: [],
                replyRecipientIds: []
            })
            expect(newState.combatLog[0].data?.blockerReason).toBe('thin sheet of lead')
        })

        it('allows solid-object delivery only when familiarity and location knowledge are explicit', async () => {
            const allowed = await runMessage('message=Behind the door; throughBarrier=true; familiar=true; knowsBeyondBarrier=true')
            const rejected = await runMessage('message=Behind the door; throughBarrier=true; familiar=true')

            expect(allowed.spellCommunicationExchanges?.[0]).toMatchObject({
                outcome: 'delivered',
                throughBarrier: true,
                familiarWithTarget: true,
                knowsTargetBeyondBarrier: true
            })
            expect(rejected.spellCommunicationExchanges?.[0]).toMatchObject({
                outcome: 'blocked',
                blockerReason: 'solid_barrier_requires_familiar_known_target',
                throughBarrier: true,
                familiarWithTarget: true,
                knowsTargetBeyondBarrier: false
            })
        })

        it('rejects Message when no creature target reaches execution', async () => {
            const newState = await runMessage('message=Anyone there', [])
            const exchange = newState.spellCommunicationExchanges?.[0]

            expect(exchange).toMatchObject({
                outcome: 'missing_target',
                blockerReason: 'missing_target',
                privateRecipientIds: [],
                replyRecipientIds: []
            })
        })
    })

    describe('Minor Illusion artifact bridge', () => {
        const illusionPoint: SelectedSpellTarget = {
            kind: 'point',
            position: { x: 8, y: 4 },
            purpose: 'area_origin'
        }

        const illusionContext: CommandContext = {
            ...mockContext,
            spellId: 'minor-illusion',
            spellName: 'Minor Illusion',
            targets: [],
            selectedSpellTargets: [illusionPoint],
            effectDuration: { type: 'minutes', value: 1, concentration: false }
        }

        const runMinorIllusion = (playerInput: string, state: CombatState = mockState) => {
            const command = new UtilityCommand(minorIllusionEffect, {
                ...illusionContext,
                playerInput
            })

            return command.execute(state)
        }

        it('creates a sound illusion artifact at the selected point', async () => {
            const newState = await runMinorIllusion('mode=sound; description=whispering chains')
            const illusion = newState.activeIllusionEffects?.[0]

            expect(illusion).toMatchObject({
                spellId: 'minor-illusion',
                spellName: 'Minor Illusion',
                casterId: mockCaster.id,
                mode: 'sound',
                position: { x: 8, y: 4 },
                description: 'whispering chains',
                expiresAtRound: mockState.turnState.currentTurn + 10,
                endsOnRecast: true
            })
        })

        it('creates an image illusion with physical and Investigation reveal metadata', async () => {
            const newState = await runMinorIllusion('mode=image; description=a small chest')
            const illusion = newState.activeIllusionEffects?.[0]

            expect(illusion).toMatchObject({
                mode: 'image',
                physicalInteractionReveals: true,
                investigationReveal: {
                    actionCost: 'action',
                    ability: 'Intelligence',
                    skill: 'Investigation',
                    dc: 'spell_save_dc'
                },
                discernedState: 'faint_to_discerning_creature',
                discernedByCreatureIds: [],
                faintToCreatureIds: []
            })
            expect(illusion?.sensoryManifestation?.variants).toHaveLength(2)
            expect(illusion?.revealRules).toHaveLength(2)
        })

        it('replaces the caster previous Minor Illusion artifact on recast', async () => {
            const firstState = await runMinorIllusion('mode=sound; description=drums')
            const firstIllusion = firstState.activeIllusionEffects?.[0]
            const secondState = await runMinorIllusion('mode=image; description=muddy footprints', firstState)

            expect(secondState.activeIllusionEffects).toHaveLength(1)
            expect(secondState.activeIllusionEffects?.[0].id).not.toBe(firstIllusion?.id)
            expect(secondState.activeIllusionEffects?.[0]).toMatchObject({
                mode: 'image',
                description: 'muddy footprints'
            })
            expect(secondState.combatLog.at(-1)?.data?.removedRecastIllusions).toBe(1)
        })
    })

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

        it('should reject an invalid selected command option instead of falling back to the first option', async () => {
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
                    { name: 'Flee', effect: 'flee' }
                ],
                trigger: { type: 'immediate' },
                condition: { type: 'always' }
            }

            const selectedContext: CommandContext & { playerInput: string } = {
                ...mockContext,
                playerInput: 'Dance'
            }

            const command = new UtilityCommand(effect, selectedContext)
            const newState = await command.execute(closeState)

            // A stale or invalid UI choice should not quietly execute Approach,
            // which is first in the data. The target stays in place and the
            // log carries the rejection reason plus the valid choices.
            const newTarget = newState.characters.find(c => c.id === mockTarget.id)
            const rejectionLog = newState.combatLog.find(entry => entry.data?.rejectedControlOption === 'Dance')
            expect(newTarget?.position).toEqual({ x: 6, y: 5 })
            expect(rejectionLog?.message).toContain('cannot resolve the selected command option')
            expect(rejectionLog?.data).toMatchObject({
                rejectedControlOption: 'Dance',
                availableControlOptions: ['Approach', 'Flee']
            })
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

    describe('Ability Check Modifier Registration (Guidance)', () => {
        it('should register the chosen skill rider as a concentration-cleanable status effect', async () => {
            const effect: UtilityEffect = {
                type: 'UTILITY',
                utilityType: 'other',
                description: 'Add 1d4 to the chosen skill check.',
                abilityCheckModifier: {
                    appliesTo: 'ability_check',
                    bonusDice: '1d4',
                    skillSelection: 'chosen_skill',
                    skillChooser: 'caster',
                    skillPool: 'any_skill',
                    frequency: 'every_matching_check',
                    durationScope: 'while_active',
                    notes: 'The target receives the bonus only for checks using the chosen skill.'
                },
                trigger: { type: 'immediate' },
                condition: { type: 'always' }
            }

            const selectedContext: CommandContext & { playerInput: string } = {
                ...mockContext,
                spellId: 'guidance',
                spellName: 'Guidance',
                playerInput: 'Arcana'
            }

            const command = new UtilityCommand(effect, selectedContext)
            const newState = await command.execute(mockState)
            const targetInState = newState.characters.find(c => c.id === mockTarget.id)
            const guidanceStatus = targetInState?.statusEffects.find(status => status.name === 'Guidance (Arcana)')

            // Guidance must leave a real status marker, not just a combat-log
            // sentence, because later ability checks and concentration cleanup
            // both read this durable runtime record.
            expect(guidanceStatus).toMatchObject({
                source: 'Guidance',
                sourceCasterId: mockCaster.id,
                modifiers: { skill: 'Arcana' },
                abilityCheckModifier: expect.objectContaining({
                    appliesTo: 'ability_check',
                    bonusDice: '1d4',
                    skillSelection: 'chosen_skill'
                })
            })
            expect(newState.combatLog.some(entry => (
                entry.data?.statusId === guidanceStatus?.id &&
                entry.data?.sourceSpellId === 'guidance'
            ))).toBe(true)
        })
    });

    describe('Zero-HP Stabilization (Spare the Dying)', () => {
        const spareTheDyingEffect: UtilityEffect = {
            type: 'UTILITY',
            utilityType: 'other',
            description: 'The creature becomes Stable and is no longer dying.',
            hitPointState: {
                mode: 'zero_hit_point_stabilization',
                targetRequirement: 'creature within range has 0 Hit Points and is not dead',
                result: 'target becomes Stable and is no longer dying'
            },
            trigger: { type: 'immediate' },
            condition: { type: 'always' }
        }

        it('sets death-save stable state and Stable markers on a 0-HP creature', async () => {
            const dyingTarget = {
                ...mockTarget,
                currentHP: 0,
                deathSaves: { successes: 1, failures: 2, isStable: false },
                statusEffects: [],
                conditions: []
            }
            const state = {
                ...mockState,
                characters: [mockCaster, dyingTarget]
            }
            const command = new UtilityCommand(spareTheDyingEffect, {
                ...mockContext,
                spellId: 'spare-the-dying',
                spellName: 'Spare the Dying',
                targets: [dyingTarget]
            })

            const newState = await command.execute(state)
            const targetInState = newState.characters.find(c => c.id === mockTarget.id)

            // Spare the Dying must update the death-save tracker because the
            // turn manager uses this flag to decide whether a 0-HP creature
            // keeps rolling death saves on later turns.
            expect(targetInState?.deathSaves).toEqual({
                successes: 1,
                failures: 2,
                isStable: true
            })
            expect(targetInState?.statusEffects.filter(status => status.name === 'Stable')).toHaveLength(1)
            expect(targetInState?.conditions?.filter(condition => condition.name === 'Stable')).toHaveLength(1)
        })

        it('refreshes an already Stable 0-HP creature without stacking duplicate markers', async () => {
            const alreadyStableTarget = {
                ...mockTarget,
                currentHP: 0,
                deathSaves: { successes: 0, failures: 0, isStable: true },
                statusEffects: [{
                    id: 'old-stable',
                    name: 'Stable',
                    type: 'neutral' as const,
                    duration: 0,
                    effect: { type: 'condition' as const }
                }],
                conditions: [{
                    name: 'Stable',
                    duration: { type: 'special' as const, value: 0 },
                    appliedTurn: 0
                }]
            }
            const state = {
                ...mockState,
                characters: [mockCaster, alreadyStableTarget]
            }
            const command = new UtilityCommand(spareTheDyingEffect, {
                ...mockContext,
                spellId: 'spare-the-dying',
                spellName: 'Spare the Dying',
                targets: [alreadyStableTarget]
            })

            const newState = await command.execute(state)
            const targetInState = newState.characters.find(c => c.id === mockTarget.id)

            expect(targetInState?.deathSaves?.isStable).toBe(true)
            expect(targetInState?.statusEffects.filter(status => status.name === 'Stable')).toHaveLength(1)
            expect(targetInState?.conditions?.filter(condition => condition.name === 'Stable')).toHaveLength(1)
        })

        it('logs an explicit no-op when the chosen creature is above 0 HP', async () => {
            const healthyTarget = {
                ...mockTarget,
                currentHP: 7,
                deathSaves: { successes: 0, failures: 1, isStable: false },
                statusEffects: []
            }
            const state = {
                ...mockState,
                characters: [mockCaster, healthyTarget]
            }
            const command = new UtilityCommand(spareTheDyingEffect, {
                ...mockContext,
                spellId: 'spare-the-dying',
                spellName: 'Spare the Dying',
                targets: [healthyTarget]
            })

            const newState = await command.execute(state)
            const targetInState = newState.characters.find(c => c.id === mockTarget.id)

            expect(targetInState?.deathSaves?.isStable).toBe(false)
            expect(targetInState?.statusEffects.some(status => status.name === 'Stable')).toBe(false)
            expect(newState.combatLog.some(entry => (
                entry.data?.sourceSpellId === 'spare-the-dying' &&
                entry.data?.rejectedHitPointState === 'requires_zero_hit_points'
            ))).toBe(true)
        })
    });

    describe('Mending repair bridge', () => {
        const mendingEffect: UtilityEffect = {
            type: 'UTILITY',
            utilityType: 'other',
            description: 'Repairs a single break or tear in an object you touch.',
            repairState: {
                targetKind: 'object',
                repairLimit: 'single_break_or_tear',
                maxDamageDimensionFeet: 1,
                leavesNoTrace: true,
                canPhysicallyRepairMagicItem: true,
                restoresMagicToMagicItem: false,
                examples: ['broken_chain_link', 'torn_cloak'],
                notes: 'Repairs one break or tear no larger than 1 foot in any dimension.'
            },
            trigger: { type: 'immediate' },
            condition: { type: 'always' }
        }

        it('records a repair result for a damaged magic item and preserves selected object metadata', async () => {
            const damagedMagicObject: SelectedSpellTarget = {
                kind: 'object',
                id: 'broken-key',
                name: 'Broken Key',
                position: { x: 9, y: 4 },
                object: {
                    id: 'broken-key',
                    name: 'Broken Key',
                    position: { x: 9, y: 4 },
                    size: 'Tiny',
                    isWornOrCarried: false,
                    isMagical: true,
                    isFixedToSurface: false,
                    damageState: {
                        kind: 'broken',
                        breakOrTearDimensionFeet: 1
                    }
                }
            }

            const command = new UtilityCommand(mendingEffect, {
                ...mockContext,
                spellId: 'mending',
                spellName: 'Mending',
                selectedSpellTargets: [damagedMagicObject]
            })

            const newState = await command.execute(mockState)
            const repair = newState.spellObjectRepairs?.[0]

            expect(repair).toMatchObject({
                objectId: 'broken-key',
                objectName: 'Broken Key',
                position: { x: 9, y: 4 },
                sourceSpellId: 'mending',
                sourceSpellName: 'Mending',
                casterId: mockCaster.id,
                createdTurn: mockState.turnState.currentTurn,
                outcome: 'repaired',
                objectWasMagical: true,
                damageState: {
                    kind: 'broken',
                    breakOrTearDimensionFeet: 1
                },
                repairState: {
                    targetKind: 'object',
                    repairLimit: 'single_break_or_tear',
                    maxDamageDimensionFeet: 1,
                    leavesNoTrace: true,
                    canPhysicallyRepairMagicItem: true,
                    restoresMagicToMagicItem: false
                }
            })
            expect(newState.combatLog.some(entry => (
                entry.data?.sourceSpellId === 'mending' &&
                entry.data?.objectRepair?.outcome === 'repaired'
            ))).toBe(true)
        })

        it('records a no-damage rejection when the selected object has no break or tear metadata', async () => {
            const intactObject: SelectedSpellTarget = {
                kind: 'object',
                id: 'intact-lantern',
                name: 'Intact Lantern',
                position: { x: 6, y: 4 },
                object: {
                    id: 'intact-lantern',
                    name: 'Intact Lantern',
                    position: { x: 6, y: 4 },
                    size: 'Small',
                    isWornOrCarried: false,
                    isMagical: false,
                    isFixedToSurface: false
                }
            }

            const command = new UtilityCommand(mendingEffect, {
                ...mockContext,
                spellId: 'mending',
                spellName: 'Mending',
                selectedSpellTargets: [intactObject]
            })

            const newState = await command.execute(mockState)
            const repair = newState.spellObjectRepairs?.[0]

            expect(repair).toMatchObject({
                objectId: 'intact-lantern',
                outcome: 'no_damage',
                objectWasMagical: false,
                repairState: {
                    targetKind: 'object',
                    repairLimit: 'single_break_or_tear',
                    maxDamageDimensionFeet: 1,
                    leavesNoTrace: true,
                    canPhysicallyRepairMagicItem: true,
                    restoresMagicToMagicItem: false
                }
            })
            expect(newState.combatLog.some(entry => (
                entry.data?.sourceSpellId === 'mending' &&
                entry.data?.rejectedRepairState === 'no_damage'
            ))).toBe(true)
        })

        it('rejects a break or tear larger than one foot and records the limit breach', async () => {
            const oversizedDamageObject: SelectedSpellTarget = {
                kind: 'object',
                id: 'big-rip-cloak',
                name: 'Big Rip Cloak',
                position: { x: 4, y: 9 },
                object: {
                    id: 'big-rip-cloak',
                    name: 'Big Rip Cloak',
                    position: { x: 4, y: 9 },
                    size: 'Medium',
                    isWornOrCarried: false,
                    isMagical: false,
                    isFixedToSurface: false,
                    damageState: {
                        kind: 'torn',
                        breakOrTearDimensionFeet: 2
                    }
                }
            }

            const command = new UtilityCommand(mendingEffect, {
                ...mockContext,
                spellId: 'mending',
                spellName: 'Mending',
                selectedSpellTargets: [oversizedDamageObject]
            })

            const newState = await command.execute(mockState)
            const repair = newState.spellObjectRepairs?.[0]

            expect(repair).toMatchObject({
                objectId: 'big-rip-cloak',
                outcome: 'too_large',
                damageState: {
                    kind: 'torn',
                    breakOrTearDimensionFeet: 2
                }
            })
            expect(newState.combatLog.some(entry => (
                entry.data?.sourceSpellId === 'mending' &&
                entry.data?.rejectedRepairState === 'too_large'
            ))).toBe(true)
        })
    });
});
