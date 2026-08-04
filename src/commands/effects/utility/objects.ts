// Per-spell-category slice of UtilityCommand: objects behaviors.
// Extracted mechanically from src/commands/effects/UtilityCommand.ts (see
// .agent/scratch/utility-split/analyze.mjs). Method bodies are byte-identical
// to the original; only visibility was promoted to protected where the
// dispatch (execute) or sibling slices call across slice boundaries.

import { UtilityCommandSenses } from './senses'
import type { UtilityEffect, RepairState } from '@/types/spells'
import type { CombatState, SelectedSpellTarget, SpellObjectRepair, SpellObjectAccessChange } from '@/types/combat'
import { generateId } from '../../../utils/idGenerator'



export abstract class UtilityCommandObjects extends UtilityCommandSenses {
    protected applyObjectRepair(state: CombatState, effect: UtilityEffect): CombatState {
        const repairState = effect.repairState as RepairState | undefined
        if (!repairState) {
            return state
        }

        const selectedObject = this.resolveObjectTarget()
        if (!selectedObject) {
            return this.addLogEntry(state, {
                type: 'status',
                message: `${this.context.spellName || 'The spell'} needs an object target to repair.`,
                characterId: this.context.caster.id,
                data: {
                    sourceSpellId: this.context.spellId,
                    rejectedRepairState: 'missing_object_target'
                }
            })
        }

        const damageState = selectedObject.object?.damageState
        const damageDimensionFeet = damageState?.breakOrTearDimensionFeet
        const objectWasMagical = selectedObject.object?.isMagical ?? false

        if (typeof damageDimensionFeet !== 'number' || Number.isNaN(damageDimensionFeet) || damageDimensionFeet <= 0) {
            return this.recordObjectRepair(state, selectedObject, repairState, {
                outcome: 'no_damage',
                damageState,
                objectWasMagical
            })
        }

        if (damageDimensionFeet > repairState.maxDamageDimensionFeet) {
            return this.recordObjectRepair(state, selectedObject, repairState, {
                outcome: 'too_large',
                damageState,
                objectWasMagical
            })
        }

        return this.recordObjectRepair(state, selectedObject, repairState, {
            outcome: 'repaired',
            damageState,
            objectWasMagical
        })
    }

    private recordObjectRepair(
        state: CombatState,
        selectedObject: Extract<SelectedSpellTarget, { kind: 'object' }>,
        repairState: RepairState,
        details: {
            outcome: SpellObjectRepair['outcome'];
            damageState?: SpellObjectRepair['damageState'];
            objectWasMagical?: boolean;
        }
    ): CombatState {
        const repair: SpellObjectRepair = {
            id: generateId(),
            objectId: selectedObject.id,
            objectName: selectedObject.object?.name ?? selectedObject.name,
            position: selectedObject.position,
            sourceSpellId: this.context.spellId,
            sourceSpellName: this.context.spellName,
            casterId: this.context.caster.id,
            createdTurn: state.turnState.currentTurn,
            outcome: details.outcome,
            repairState: {
                targetKind: repairState.targetKind,
                repairLimit: repairState.repairLimit,
                maxDamageDimensionFeet: repairState.maxDamageDimensionFeet,
                leavesNoTrace: repairState.leavesNoTrace,
                canPhysicallyRepairMagicItem: repairState.canPhysicallyRepairMagicItem,
                restoresMagicToMagicItem: repairState.restoresMagicToMagicItem
            },
            damageState: details.damageState ? {
                kind: details.damageState.kind,
                breakOrTearDimensionFeet: details.damageState.breakOrTearDimensionFeet
            } : selectedObject.object?.damageState,
            objectWasMagical: details.objectWasMagical
        }

        const nextState: CombatState = {
            ...state,
            spellObjectRepairs: [
                ...(state.spellObjectRepairs || []),
                repair
            ]
        }

        const message = details.outcome === 'repaired'
            ? `${selectedObject.object?.name ?? selectedObject.name ?? selectedObject.id} is mended by ${this.context.spellName || 'the spell'}.`
            : details.outcome === 'too_large'
                ? `${this.context.spellName || 'The spell'} cannot repair ${selectedObject.object?.name ?? selectedObject.name ?? selectedObject.id} because the break or tear is too large.`
                : `${this.context.spellName || 'The spell'} finds no recorded break or tear to repair on ${selectedObject.object?.name ?? selectedObject.name ?? selectedObject.id}.`

        return this.addLogEntry(nextState, {
            type: 'status',
            message,
            characterId: this.context.caster.id,
            targetIds: [selectedObject.id],
            data: {
                sourceSpellId: this.context.spellId,
                objectRepair: repair,
                rejectedRepairState: details.outcome === 'repaired' ? undefined : details.outcome
            }
        })
    }

    protected applyObjectAccessChange(state: CombatState, effect: UtilityEffect): CombatState {
        const accessChange = effect.objectAccessChange
        if (!accessChange) {
            return state
        }

        const selectedObject = this.resolveObjectTarget()
        if (!selectedObject) {
            return this.addLogEntry(state, {
                type: 'status',
                message: `${this.context.spellName || 'The spell'} needs an object target to change access.`,
                characterId: this.context.caster.id,
                data: {
                    sourceSpellId: this.context.spellId,
                    rejectedObjectAccessChange: 'missing_object_target'
                }
            })
        }

        const record: SpellObjectAccessChange = {
            id: generateId(),
            objectId: selectedObject.id,
            objectName: selectedObject.object?.name ?? selectedObject.name,
            position: selectedObject.position,
            sourceSpellId: this.context.spellId,
            sourceSpellName: this.context.spellName,
            casterId: this.context.caster.id,
            createdTurn: state.turnState.currentTurn,
            outcome: this.resolveObjectAccessOutcome(accessChange),
            mundaneStateChanges: accessChange.mundaneStateChanges,
            suppressesMagicalClosure: accessChange.suppressesMagicalClosure,
            suppressionDuration: accessChange.suppressionDuration,
            targetOperableDuringSuppression: accessChange.targetOperableDuringSuppression,
            soundEmission: accessChange.soundEmission,
            nonmagicalUnlockBlocked: accessChange.nonmagicalUnlockBlocked,
            allowedOpeners: accessChange.allowedOpeners,
            optionalPassword: accessChange.optionalPassword,
            passwordRangeFeet: accessChange.passwordRangeFeet,
            passwordUnlockDuration: accessChange.passwordUnlockDuration,
            expiresWithSpell: accessChange.expiresWithSpell,
            notes: accessChange.notes
        }

        const nextState: CombatState = {
            ...state,
            spellObjectAccessChanges: [
                ...(state.spellObjectAccessChanges || []),
                record
            ]
        }

        return this.addLogEntry(nextState, {
            type: 'status',
            message: this.describeObjectAccessChange(record),
            characterId: this.context.caster.id,
            targetIds: [selectedObject.id],
            data: {
                sourceSpellId: this.context.spellId,
                objectAccessChange: record
            }
        })
    }

    private resolveObjectAccessOutcome(accessChange: NonNullable<UtilityEffect['objectAccessChange']>): SpellObjectAccessChange['outcome'] {
        if (accessChange.suppressesMagicalClosure) {
            return 'suppressed_magical_lock'
        }
        if (accessChange.newState === 'magically_locked' || accessChange.nonmagicalUnlockBlocked) {
            return 'magically_locked'
        }

        const mundaneState = accessChange.mundaneStateChanges?.[0]
        if (mundaneState === 'unlock') return 'unlocked'
        if (mundaneState === 'unstick') return 'unstuck'
        if (mundaneState === 'unbar') return 'unbarred'
        return 'access_changed'
    }

    private describeObjectAccessChange(record: SpellObjectAccessChange): string {
        const objectName = record.objectName ?? record.objectId
        const spellName = record.sourceSpellName || 'The spell'
        if (record.outcome === 'magically_locked') {
            return `${spellName} magically locks ${objectName}.`
        }
        if (record.outcome === 'suppressed_magical_lock') {
            return `${spellName} suppresses ${record.suppressesMagicalClosure || 'the magical lock'} on ${objectName}.`
        }
        return `${spellName} changes access on ${objectName}: ${record.outcome.replace(/_/g, ' ')}.`
    }

}
