import { BaseEffectCommand } from '../base/BaseEffectCommand'
import { CommandContext } from '../base/SpellCommand'
import { SummoningEffect } from '@/types/spells'
import { CombatState } from '@/types/combat'

export class SummoningCommand extends BaseEffectCommand {
    constructor(
        effect: SummoningEffect,
        context: CommandContext
    ) {
        super(effect, context)
    }

    execute(state: CombatState): CombatState {
        const effect = this.effect as SummoningEffect
        const caster = this.getCaster(state)

        // TODO: This requires creature database and enemy/ally spawning system
        // For now, add a placeholder to combat log

        return this.addLogEntry(state, {
            type: 'action',
            message: `${caster.name} summons ${effect.count} ${effect.summonType}(s)`,
            characterId: caster.id,
            data: { summonEffect: effect }
        })
    }

    get description(): string {
        const effect = this.effect as SummoningEffect
        return `${this.context.caster.name} summons ${effect.count} ${effect.summonType}(s)`
    }
}
