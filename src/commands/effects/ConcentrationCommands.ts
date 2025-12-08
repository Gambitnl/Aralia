import { BaseEffectCommand } from '../base/BaseEffectCommand'
import { CommandContext } from '../base/SpellCommand'
import { CombatState, ConcentrationState } from '../../types/combat'
import { Spell } from '../../types/spells'
import { generateId } from '../../utils/idGenerator'
import { AttackRiderSystem } from '../../systems/combat/AttackRiderSystem'

/**
 * Command to initiate concentration on a spell.
 * Sets the 'concentratingOn' state on the caster.
 */
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

    /**
     * Executes the command:
     * 1. Creates the concentration state object.
     * 2. Updates the caster's character record.
     * 3. Logs the event.
     */
    execute(state: CombatState): CombatState {
        const caster = this.getCaster(state)

        // Initialize the new concentration state
        const concentrationState: ConcentrationState = {
            spellId: this.spell.id,
            spellName: this.spell.name,
            spellLevel: this.context.castAtLevel,
            startedTurn: state.turnState.currentTurn,
            effectIds: [], // TODO: Future integration points for tracking specific effect IDs (buffs/debuffs)
            canDropAsFreeAction: true,
            sustainCost: this.spell.effects.find(e => e.trigger?.sustainCost)?.trigger.sustainCost,
            sustainedThisTurn: true // Initially sustained on cast turn
        }

        // Apply the state change to the character
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

/**
 * Command to break existing concentration.
 * Clears the 'concentratingOn' state and should eventually remove linked effects.
 */
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

    /**
     * Executes the command:
     * 1. Checks if the caster is actually concentrating.
     * 2. Clears the concentration state.
     * 3. Logs the event.
     */
    execute(state: CombatState): CombatState {
        const caster = this.getCaster(state)

        if (!caster.concentratingOn) {
            return state // Nothing to break
        }

        const previousSpell = caster.concentratingOn.spellName
        const previousSpellId = caster.concentratingOn.spellId

        // Remove active riders associated with this spell
        const riderSystem = new AttackRiderSystem();
        let updatedState = riderSystem.removeRidersBySpell(state, previousSpellId, caster.id);

        // Clear concentration pointer
        updatedState = this.updateCharacter(updatedState, caster.id, {
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
