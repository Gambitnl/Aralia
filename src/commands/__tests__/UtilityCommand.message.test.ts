import { describe, it, expect } from 'vitest'
import { mockCaster, mockTarget, mockContext, createMockCombatCharacter, createMockCombatState, UtilityCommand } from './UtilityCommand.testHelpers'
import type { CombatCharacter, Spell, UtilityEffect } from './UtilityCommand.testHelpers'
import messageJson from '../../../public/data/spells/level-0/message.json'

describe('UtilityCommand', () => {
    const messageEffect = (messageJson as Spell).effects[0] as UtilityEffect

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
})
