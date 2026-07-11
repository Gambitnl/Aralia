import { describe, it, expect } from 'vitest'
import { mockCaster, mockTarget, mockContext, mockState, UtilityCommand } from './UtilityCommand.testHelpers'
import type { UtilityEffect, CommandContext } from './UtilityCommand.testHelpers'

describe('UtilityCommand', () => {
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
})
