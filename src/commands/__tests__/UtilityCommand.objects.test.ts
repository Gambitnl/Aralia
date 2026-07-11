import { describe, it, expect } from 'vitest'
import { mockCaster, mockContext, mockState, UtilityCommand } from './UtilityCommand.testHelpers'
import type { UtilityEffect, SelectedSpellTarget } from './UtilityCommand.testHelpers'

describe('UtilityCommand', () => {
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

    describe('object access bridge', () => {
        it('records Knock access suppression against the selected map object', async () => {
            const lockedDoor: SelectedSpellTarget = {
                kind: 'object',
                id: 'locked-door',
                name: 'Locked Door',
                position: { x: 7, y: 2 },
                object: {
                    id: 'locked-door',
                    name: 'Locked Door',
                    position: { x: 7, y: 2 },
                    size: 'Medium',
                    isWornOrCarried: false,
                    isMagical: true,
                    isFixedToSurface: true
                }
            }
            const knockEffect: UtilityEffect = {
                type: 'UTILITY',
                utilityType: 'control',
                description: 'Unlocks, unsticks, unbars, or suppresses a magical closure.',
                objectAccessChange: {
                    eligibleObjectTypes: ['door'],
                    mundaneStateChanges: ['unlock', 'unstick', 'unbar'],
                    maxLocksAffected: 1,
                    suppressesMagicalClosure: 'arcane-lock',
                    suppressionDuration: { type: 'minutes', value: 10 },
                    targetOperableDuringSuppression: true,
                    soundEmission: {
                        audibleRadius: 300,
                        radiusUnit: 'feet',
                        source: 'target_object',
                        trigger: 'on_cast',
                        description: 'A loud knock emanates from the target object.'
                    }
                },
                trigger: { type: 'immediate' },
                condition: { type: 'always' }
            }

            const command = new UtilityCommand(knockEffect, {
                ...mockContext,
                spellId: 'knock',
                spellName: 'Knock',
                selectedSpellTargets: [lockedDoor]
            })

            const newState = await command.execute(mockState)
            const accessChange = newState.spellObjectAccessChanges?.[0]

            expect(accessChange).toMatchObject({
                objectId: 'locked-door',
                objectName: 'Locked Door',
                position: { x: 7, y: 2 },
                sourceSpellId: 'knock',
                sourceSpellName: 'Knock',
                casterId: mockCaster.id,
                createdTurn: mockState.turnState.currentTurn,
                outcome: 'suppressed_magical_lock',
                suppressesMagicalClosure: 'arcane-lock',
                targetOperableDuringSuppression: true
            })
            expect(newState.combatLog.some(entry => (
                entry.data?.sourceSpellId === 'knock' &&
                entry.data?.objectAccessChange?.outcome === 'suppressed_magical_lock'
            ))).toBe(true)
        })

        it('records Arcane Lock as a persistent object-access marker', async () => {
            const vaultDoor: SelectedSpellTarget = {
                kind: 'object',
                id: 'vault-door',
                name: 'Vault Door',
                position: { x: 8, y: 2 },
                object: {
                    id: 'vault-door',
                    name: 'Vault Door',
                    position: { x: 8, y: 2 },
                    size: 'Large',
                    isWornOrCarried: false,
                    isMagical: false,
                    isFixedToSurface: true
                }
            }
            const arcaneLockEffect: UtilityEffect = {
                type: 'UTILITY',
                utilityType: 'control',
                description: 'Magically locks the target object.',
                objectAccessChange: {
                    eligibleObjectTypes: ['closed_door'],
                    mundaneStateChanges: [],
                    maxLocksAffected: 0,
                    newState: 'magically_locked',
                    nonmagicalUnlockBlocked: true,
                    allowedOpeners: 'caster_and_designated_creatures',
                    optionalPassword: true,
                    passwordRangeFeet: 5,
                    passwordUnlockDuration: '1 minute',
                    expiresWithSpell: true
                },
                trigger: { type: 'immediate' },
                condition: { type: 'always' }
            } as UtilityEffect

            const command = new UtilityCommand(arcaneLockEffect, {
                ...mockContext,
                spellId: 'arcane-lock',
                spellName: 'Arcane Lock',
                selectedSpellTargets: [vaultDoor]
            })

            const newState = await command.execute(mockState)
            const accessChange = newState.spellObjectAccessChanges?.[0]

            expect(accessChange).toMatchObject({
                objectId: 'vault-door',
                objectName: 'Vault Door',
                position: { x: 8, y: 2 },
                sourceSpellId: 'arcane-lock',
                sourceSpellName: 'Arcane Lock',
                outcome: 'magically_locked',
                nonmagicalUnlockBlocked: true,
                allowedOpeners: 'caster_and_designated_creatures',
                optionalPassword: true
            })
            expect(newState.combatLog.some(entry => (
                entry.data?.sourceSpellId === 'arcane-lock' &&
                entry.data?.objectAccessChange?.outcome === 'magically_locked'
            ))).toBe(true)
        })
    });
})
