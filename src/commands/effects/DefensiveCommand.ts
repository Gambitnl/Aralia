import { BaseEffectCommand } from '../base/BaseEffectCommand'
import { CommandContext } from '../base/SpellCommand'
import { DefensiveEffect, isDefensiveEffect } from '@/types/spells'
import { CombatState, CombatCharacter, ActiveEffect, DamageType } from '@/types/combat'

/**
 * Command to apply defensive effects to targets.
 * Handles AC bonuses, resistances, immunities, temporary HP, and advantage on saves.
 */
export class DefensiveCommand extends BaseEffectCommand {
    constructor(
        effect: DefensiveEffect,
        context: CommandContext
    ) {
        super(effect, context)
    }

    execute(state: CombatState): CombatState {
        if (!isDefensiveEffect(this.effect)) {
            console.warn('DefensiveCommand received non-defensive effect')
            return state
        }

        const effect = this.effect
        const targets = this.getTargets(state)
        let newState = state

        for (const target of targets) {
            switch (effect.defenseType) {
                case 'ac_bonus':
                    newState = this.applyACBonus(newState, target, effect)
                    break
                case 'resistance':
                    newState = this.applyResistance(newState, target, effect)
                    break
                case 'immunity':
                    newState = this.applyImmunity(newState, target, effect)
                    break
                case 'temporary_hp':
                    newState = this.applyTemporaryHP(newState, target, effect)
                    break
                case 'advantage_on_saves':
                    newState = this.applyAdvantageOnSaves(newState, target, effect)
                    break
            }
        }

        return newState
    }

    private applyACBonus(state: CombatState, target: CombatCharacter, effect: DefensiveEffect): CombatState {
        const bonus = effect.value || 0
        const currentAC = target.armorClass || 10

        // Create active effect for tracking
        const activeEffect: ActiveEffect = {
            type: 'ac_bonus',
            name: `AC Bonus from ${this.context.spellName}`,
            value: bonus,
            duration: effect.duration || { type: 'rounds', value: 1 },
            appliedTurn: state.turnState.currentTurn,
            source: this.context.spellName || this.context.spellId || 'Unknown'
        }

        // Update character state
        const updatedState = this.updateCharacter(state, target.id, {
            armorClass: currentAC + bonus,
            activeEffects: [...(target.activeEffects || []), activeEffect]
        })

        // Log entry
        return this.addLogEntry(updatedState, {
            type: 'status',
            message: `${target.name} gains +${bonus} AC (${currentAC} → ${currentAC + bonus})`,
            characterId: target.id,
            data: { defensiveEffect: effect }
        })
    }

    private applyResistance(state: CombatState, target: CombatCharacter, effect: DefensiveEffect): CombatState {
        const damageTypes = effect.damageType || []
        const currentResistances = target.resistances || []

        // Add new resistances (avoid duplicates)
        const newResistances = [...currentResistances]
        for (const type of damageTypes) {
            if (!newResistances.includes(type)) {
                newResistances.push(type)
            }
        }

        // Update character
        const updatedState = this.updateCharacter(state, target.id, {
            resistances: newResistances
        })

        // Log entry
        return this.addLogEntry(updatedState, {
            type: 'status',
            message: `${target.name} gains resistance to ${damageTypes.join(', ')}`,
            characterId: target.id,
            data: { defensiveEffect: effect }
        })
    }

    private applyImmunity(state: CombatState, target: CombatCharacter, effect: DefensiveEffect): CombatState {
        const damageTypes = effect.damageType || []
        const currentImmunities = target.immunities || []

        // Add new immunities (avoid duplicates)
        const newImmunities = [...currentImmunities]
        for (const type of damageTypes) {
            if (!newImmunities.includes(type)) {
                newImmunities.push(type)
            }
        }

        const updatedState = this.updateCharacter(state, target.id, {
            immunities: newImmunities
        })

        return this.addLogEntry(updatedState, {
            type: 'status',
            message: `${target.name} gains immunity to ${damageTypes.join(', ')}`,
            characterId: target.id,
            data: { defensiveEffect: effect }
        })
    }

    private applyTemporaryHP(state: CombatState, target: CombatCharacter, effect: DefensiveEffect): CombatState {
        const tempHPValue = effect.value || 0
        const currentTempHP = target.tempHP || 0

        // D&D Rule: Temporary HP doesn't stack, take the higher value
        const newTempHP = Math.max(currentTempHP, tempHPValue)

        const updatedState = this.updateCharacter(state, target.id, {
            tempHP: newTempHP
        })

        return this.addLogEntry(updatedState, {
            type: 'status',
            message: `${target.name} gains ${newTempHP} temporary HP`,
            characterId: target.id,
            data: { defensiveEffect: effect }
        })
    }

    private applyAdvantageOnSaves(state: CombatState, target: CombatCharacter, effect: DefensiveEffect): CombatState {
        const activeEffect: ActiveEffect = {
            type: 'advantage_on_saves',
            name: `Advantage on saves from ${this.context.spellName}`,
            duration: effect.duration || { type: 'rounds', value: 1 },
            appliedTurn: state.turnState.currentTurn,
            source: this.context.spellName || this.context.spellId || 'Unknown',
            description: effect.description || 'Advantage on saving throws',
            savingThrows: effect.savingThrow
        }

        const updatedState = this.updateCharacter(state, target.id, {
            activeEffects: [...(target.activeEffects || []), activeEffect]
        })

        const saveTypes = effect.savingThrow?.join(', ') || 'all'
        return this.addLogEntry(updatedState, {
            type: 'status',
            message: `${target.name} gains advantage on ${saveTypes} saving throws`,
            characterId: target.id,
            data: { defensiveEffect: effect }
        })
    }

    get description(): string {
        if (isDefensiveEffect(this.effect)) {
            const effect = this.effect
            switch (effect.defenseType) {
                case 'ac_bonus':
                    return `Grants +${effect.value || 0} AC`
                case 'resistance':
                    return `Grants resistance to ${effect.damageType?.join(', ')}`
                case 'immunity':
                    return `Grants immunity to ${effect.damageType?.join(', ')}`
                case 'temporary_hp':
                    return `Grants ${effect.value || 0} temporary HP`
                case 'advantage_on_saves':
                    return `Grants advantage on ${effect.savingThrow?.join(', ') || 'all'} saves`
            }
        }
        return 'Grants defensive effect'
    }
}
