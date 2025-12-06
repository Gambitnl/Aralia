import { BaseEffectCommand } from '../base/BaseEffectCommand'
import { CommandContext } from '../base/SpellCommand'
import { UtilityEffect } from '@/types/spells'
import { CombatState } from '@/types/combat'

export class UtilityCommand extends BaseEffectCommand {
    constructor(
        effect: UtilityEffect,
        context: CommandContext
    ) {
        super(effect, context)
    }

    execute(state: CombatState): CombatState {
        const effect = this.effect as UtilityEffect

        // Most utility effects are narrative or UI-based
        // Log to combat log for now

        let message = ''
        switch (effect.utilityType) {
            case 'light':
                message = `${this.context.caster.name} creates a source of light: ${effect.description}`
                break
            case 'communication':
                message = `${this.context.caster.name} establishes communication: ${effect.description}`
                break
            case 'detection': // Maps to "sensory" or "information" broadly, but if utilityType has a specific match
                // The type def has "sensory", "information". "detection" was in the prompt example but not in type def?
                // Let's check type def again.
                // type: "UTILITY"; utilityType: "light" | "communication" | "creation" | "information" | "control" | "sensory" | "other";
                // Prompt used 'detection' in switch but 'information' or 'sensory' is likely what it maps to.
                // I will stick to what the type definition supports to avoid TS errors.
                if (effect.utilityType === 'information') {
                    message = `${this.context.caster.name} gains information: ${effect.description}`
                } else if (effect.utilityType === 'sensory') {
                    message = `${this.context.caster.name} detects: ${effect.description}`
                } else {
                    message = `${this.context.caster.name}: ${effect.description}`
                }
                break
            case 'information':
                message = `${this.context.caster.name} gains information: ${effect.description}`
                break
            case 'sensory':
                message = `${this.context.caster.name} senses: ${effect.description}`
                break
            default:
                message = `${this.context.caster.name}: ${effect.description}`
        }

        return this.addLogEntry(state, {
            type: 'action',
            message,
            characterId: this.context.caster.id,
            data: { utilityEffect: effect }
        })
    }

    get description(): string {
        const effect = this.effect as UtilityEffect
        return `${this.context.caster.name} uses ${effect.utilityType} utility`
    }
}
