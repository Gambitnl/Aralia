import { BaseEffectCommand } from '../base/BaseEffectCommand'
import { CommandContext } from '../base/SpellCommand'
import { CombatState, ConcentrationState } from '../../types/combat'
import { Spell } from '../../types/spells'
import { generateId } from '../../utils/idGenerator'

export class StartConcentrationCommand extends BaseEffectCommand {
    constructor(
        private spell: Spell,
        protected context: CommandContext
    ) {
        // Utility effect type is used for concentration tracking
        super({
            type: 'UTILITY',
            utilityType: 'other',
            description: 'Maintains concentration on spell',
            trigger: { type: 'immediate' },
            condition: { type: 'always' }
        } as any, context)
    }

    execute(state: CombatState): CombatState {
        const caster = this.getCaster(state)

        const concentrationState: ConcentrationState = {
            spellId: this.spell.id,
            spellName: this.spell.name,
            spellLevel: this.context.castAtLevel,
            startedTurn: state.turnState.currentTurn,
            effectIds: [], // TODO: Track which effects are tied to concentration. This will be linked when effects are created.
            canDropAsFreeAction: true
        }

        const updatedState = this.updateCharacter(state, caster.id, {
            concentratingOn: concentrationState
        })

        return this.addLogEntry(updatedState, {
            type: 'status',
            message: `${caster.name} begins concentrating on ${this.spell.name}`,
            characterId: caster.id
        })
    }

    get description(): string {
        return `${this.context.caster.name} starts concentrating on ${this.spell.name}`
    }
}

export class BreakConcentrationCommand extends BaseEffectCommand {
    constructor(
        protected context: CommandContext
    ) {
        // Using a dummy utility effect for the base command
        super({
            type: 'UTILITY',
            utilityType: 'other',
            description: 'Breaks concentration',
            trigger: { type: 'immediate' },
            condition: { type: 'always' }
        } as any, context)
    }

    execute(state: CombatState): CombatState {
        const caster = this.getCaster(state)

        if (!caster.concentratingOn) {
            return state // Nothing to break
        }

        const previousSpell = caster.concentratingOn.spellName

        // In a full implementation, we would remove effects tied to this concentration here.
        // For now, we just clear the state.

        const updatedState = this.updateCharacter(state, caster.id, {
            concentratingOn: undefined
        })

        return this.addLogEntry(updatedState, {
            type: 'status',
            message: `${caster.name} stops concentrating on ${previousSpell}`,
            characterId: caster.id
        })
    }

    get description(): string {
        return `${this.context.caster.name} breaks concentration`
    }
}
