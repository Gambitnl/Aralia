import { describe, it, expect } from 'vitest'
import { mockCaster, mockContext, mockState, UtilityCommand } from './UtilityCommand.testHelpers'
import type { Spell, UtilityEffect, SelectedSpellTarget, CommandContext, CombatState } from './UtilityCommand.testHelpers'
import minorIllusionJson from '../../../public/data/spells/level-0/minor-illusion.json'

describe('UtilityCommand', () => {
    const minorIllusionEffect = (minorIllusionJson as Spell).effects[0] as UtilityEffect

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
})
