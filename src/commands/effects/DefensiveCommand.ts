import { BaseEffectCommand } from '../base/BaseEffectCommand'
import { CommandContext } from '../base/SpellCommand'
import { DefensiveEffect } from '@/types/spells'
import { CombatState, CombatCharacter } from '@/types/combat'

export class DefensiveCommand extends BaseEffectCommand {
    constructor(
        effect: DefensiveEffect,
        context: CommandContext
    ) {
        super(effect, context)
    }

    execute(state: CombatState): CombatState {
        const effect = this.effect as DefensiveEffect
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
        // TODO: Character needs AC tracking separate from stats
        // For now, log to combat log

        return this.addLogEntry(state, {
            type: 'status',
            message: `${target.name} gains +${effect.value} AC bonus`,
            characterId: target.id,
            data: { defensiveEffect: effect }
        })
    }

    private applyResistance(state: CombatState, target: CombatCharacter, effect: DefensiveEffect): CombatState {
        // TODO: Character needs resistance array
        // CombatCharacter interface needs: resistances?: DamageType[]

        return this.addLogEntry(state, {
            type: 'status',
            message: `${target.name} gains resistance to ${effect.damageType?.join(', ')}`,
            characterId: target.id,
            data: { defensiveEffect: effect }
        })
    }

    private applyImmunity(state: CombatState, target: CombatCharacter, effect: DefensiveEffect): CombatState {
        // Similar to resistance
        return this.addLogEntry(state, {
            type: 'status',
            message: `${target.name} gains immunity to ${effect.damageType?.join(', ')}`,
            characterId: target.id,
            data: { defensiveEffect: effect }
        })
    }

    private applyTemporaryHP(state: CombatState, target: CombatCharacter, effect: DefensiveEffect): CombatState {
        // TODO: Character needs tempHP field
        // CombatCharacter interface needs: tempHP?: number

        return this.addLogEntry(state, {
            type: 'heal',
            message: `${target.name} gains ${effect.value} temporary HP`,
            characterId: target.id
        })
    }

    private applyAdvantageOnSaves(state: CombatState, target: CombatCharacter, effect: DefensiveEffect): CombatState {
        // TODO: Character needs active effect tracking for advantage
        return this.addLogEntry(state, {
            type: 'status',
            message: `${target.name} gains advantage on ${effect.savingThrow?.join(', ')} saves`,
            characterId: target.id,
            data: { defensiveEffect: effect }
        })
    }

    get description(): string {
        const effect = this.effect as DefensiveEffect
        return `${this.context.caster.name} grants ${effect.defenseType} defense`
    }
}
