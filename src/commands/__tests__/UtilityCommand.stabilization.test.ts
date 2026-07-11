import { describe, it, expect } from 'vitest'
import { mockCaster, mockTarget, mockContext, mockState, UtilityCommand } from './UtilityCommand.testHelpers'
import type { UtilityEffect } from './UtilityCommand.testHelpers'

describe('UtilityCommand', () => {
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
})
