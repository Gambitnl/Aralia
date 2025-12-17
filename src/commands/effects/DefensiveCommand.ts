import { BaseEffectCommand } from '../base/BaseEffectCommand'
import { CommandContext } from '../base/SpellCommand'
import { DefensiveEffect, isDefensiveEffect } from '@/types/spells'
import { CombatState, CombatCharacter, ActiveEffect } from '@/types/combat'
import { getAbilityModifierValue, calculateFinalAC, ACComponents } from '@/utils/statUtils';

/**
 * Calculates AC for a CombatCharacter using the shared statUtils logic.
 */
/**
 * Resolves the base AC of a character.
 * If baseAC is not explicitly set, derives it from current armorClass by stripping known bonuses to prevent double-counting.
 */
function resolveBaseAC(target: CombatCharacter): number {
    if (target.baseAC !== undefined) return target.baseAC;

    let base = target.armorClass ?? 10;
    // Strip additive bonuses to find "raw" base
    if (target.activeEffects) {
        for (const e of target.activeEffects) {
            if (e.type === 'ac_bonus' && typeof e.value === 'number') {
                base -= e.value;
            }
        }
    }
    return base;
}


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
                case 'set_base_ac':
                    newState = this.applySetBaseAC(newState, target, effect)
                    break
                case 'ac_minimum':
                    newState = this.applyACMinimum(newState, target, effect)
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
                case 'disadvantage_on_attacks':
                    newState = this.applyDisadvantageOnAttacks(newState, target, effect)
                    break
            }
        }

        return newState
    }

    private applyACBonus(state: CombatState, target: CombatCharacter, effect: DefensiveEffect): CombatState {
        // Use acBonus preferred, fallback to value
        const bonus = effect.acBonus ?? effect.value ?? 0

        // Create active effect for tracking
        const activeEffect: ActiveEffect = {
            type: 'ac_bonus',
            name: `AC Bonus from ${this.context.spellName}`,
            value: bonus,
            duration: effect.duration || { type: 'rounds', value: 1 },
            appliedTurn: state.turnState.currentTurn,
            source: this.context.spellName || this.context.spellId || 'Unknown',
            attackerFilter: effect.attackerFilter
        }

        // Add effect to character first
        const updatedEffects = [...(target.activeEffects || []), activeEffect];

        // Recalculate AC
        const newAC = calculateFinalAC({
            baseAC: resolveBaseAC(target),
            dexMod: Math.floor((target.stats.dexterity - 10) / 2),
            activeEffects: updatedEffects,
            stdBaseIncludesDex: true // baseAC usually comes from sheet which includes Dex
        });

        // Update character state
        const updatedState = this.updateCharacter(state, target.id, {
            armorClass: newAC,
            activeEffects: updatedEffects
        })

        // Log entry
        return this.addLogEntry(updatedState, {
            type: 'status',
            message: `${target.name} gains +${bonus} AC (${target.armorClass} → ${newAC})`,
            characterId: target.id,
            data: { defensiveEffect: effect }
        })
    }

    private applySetBaseAC(state: CombatState, target: CombatCharacter, effect: DefensiveEffect): CombatState {
        // e.g. "13 + dex_mod". We currently only support fixed base values in value/acBonus + dex.
        // Logic in statUtils expects 'value' to be the base number (e.g. 13).
        // If we provided a formula string, we'd need to parse it, but let's stick to the 'value' convention for now as per statUtils implementation.
        // However, schema has `baseACFormula`. 
        // For now we will check if `baseACFormula` is "13 + dex_mod" and set value to 13?
        // Or relies on 'value' being set in JSON.

        // Let's rely on 'value' or 'acBonus' being the base number (13).
        const baseValue = effect.value ?? effect.acBonus ?? 10;

        const activeEffect: ActiveEffect = {
            type: 'set_base_ac',
            name: `Base AC set by ${this.context.spellName}`,
            value: baseValue,
            duration: effect.duration || { type: 'rounds', value: 1, concentration: true },
            appliedTurn: state.turnState.currentTurn,
            source: this.context.spellName || this.context.spellId || 'Unknown'
        }

        const updatedEffects = [...(target.activeEffects || []), activeEffect];
        const newAC = calculateFinalAC({
            baseAC: resolveBaseAC(target),
            dexMod: Math.floor((target.stats.dexterity - 10) / 2),
            activeEffects: updatedEffects,
            stdBaseIncludesDex: true
        });

        const updatedState = this.updateCharacter(state, target.id, {
            armorClass: newAC,
            activeEffects: updatedEffects
        })

        return this.addLogEntry(updatedState, {
            type: 'status',
            message: `${target.name}'s base AC becomes ${baseValue} + Dex (${target.armorClass} → ${newAC})`,
            characterId: target.id,
            data: { defensiveEffect: effect }
        })
    }

    private applyACMinimum(state: CombatState, target: CombatCharacter, effect: DefensiveEffect): CombatState {
        const minVal = effect.acMinimum ?? effect.value ?? 16;

        const activeEffect: ActiveEffect = {
            type: 'ac_minimum',
            name: `AC Minimum from ${this.context.spellName}`,
            value: minVal,
            duration: effect.duration || { type: 'rounds', value: 1, concentration: true },
            appliedTurn: state.turnState.currentTurn,
            source: this.context.spellName || this.context.spellId || 'Unknown'
        }

        const updatedEffects = [...(target.activeEffects || []), activeEffect];
        const newAC = calculateFinalAC({
            baseAC: resolveBaseAC(target),
            dexMod: Math.floor((target.stats.dexterity - 10) / 2),
            activeEffects: updatedEffects,
            stdBaseIncludesDex: true
        });

        const updatedState = this.updateCharacter(state, target.id, {
            armorClass: newAC,
            activeEffects: updatedEffects
        })

        return this.addLogEntry(updatedState, {
            type: 'status',
            message: `${target.name}'s AC cannot be less than ${minVal} (${target.armorClass} → ${newAC})`,
            characterId: target.id,
            data: { defensiveEffect: effect }
        })
    }

    private applyResistance(state: CombatState, target: CombatCharacter, effect: DefensiveEffect): CombatState {
        const damageTypes = effect.damageType || []
        const currentResistances = target.resistances || []

        // Add new resistances (avoid duplicates)
        // TODO: Track duration and remove expired resistances/immunities so later spells recalc AC/mitigation correctly.
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
        // TODO: Track immunity duration and clean up expired entries to prevent permanent immunity when the buff ends.
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
        // TODO: Drop temp HP when the defensive effect duration ends and avoid reapplying weaker values on refresh cycles.
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
            description: 'Advantage on saving throws',
            savingThrows: effect.savingThrow,
            attackerFilter: effect.attackerFilter
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

    private applyDisadvantageOnAttacks(state: CombatState, target: CombatCharacter, effect: DefensiveEffect): CombatState {
        const activeEffect: ActiveEffect = {
            type: 'disadvantage_on_attacks',
            name: `Disadvantage to attackers from ${this.context.spellName}`,
            duration: effect.duration || { type: 'rounds', value: 1 },
            appliedTurn: state.turnState.currentTurn,
            source: this.context.spellName || this.context.spellId || 'Unknown',
            description: 'Attackers have disadvantage',
            attackerFilter: effect.attackerFilter
        }

        const updatedState = this.updateCharacter(state, target.id, {
            activeEffects: [...(target.activeEffects || []), activeEffect]
        })

        return this.addLogEntry(updatedState, {
            type: 'status',
            message: `Attacks against ${target.name} result in disadvantage`,
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
                case 'disadvantage_on_attacks':
                    return `Attackers have disadvantage`
            }
        }
        return 'Grants defensive effect'
    }
}
