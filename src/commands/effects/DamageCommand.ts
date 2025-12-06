import { BaseEffectCommand } from '../base/BaseEffectCommand'
import { CombatState } from '../../types/combat'
import { isDamageEffect } from '../../types/spells'
import { checkConcentration } from '../../utils/concentrationUtils'
import { BreakConcentrationCommand } from './ConcentrationCommands'

export class DamageCommand extends BaseEffectCommand {
  execute(state: CombatState): CombatState {
    if (!isDamageEffect(this.effect)) {
      console.warn('DamageCommand received non-damage effect')
      return state
    }

    let currentState = state

    for (const target of this.getTargets(currentState)) {
      // 1. Calculate Damage
      const damageRoll = this.rollDamage(this.effect.damage.dice)

      // 2. Apply Damage
      const newHP = Math.max(0, target.currentHP - damageRoll)
      currentState = this.updateCharacter(currentState, target.id, {
        currentHP: newHP
      })

      currentState = this.addLogEntry(currentState, {
        type: 'damage',
        message: `${target.name} takes ${damageRoll} ${this.effect.damage.type.toLowerCase()} damage`,
        characterId: target.id,
        targetIds: [target.id],
        data: { value: damageRoll, type: this.effect.damage.type }
      })

      // 3. Check Concentration
      if (target.concentratingOn && damageRoll > 0) {
        const check = checkConcentration(target, damageRoll)

        if (!check.success) {
          // Break concentration
          const breakCommand = new BreakConcentrationCommand({
            // We need a context for the break command. 
            // Ideally we'd have the original caster of the concentrated spell, 
            // but here 'caster' in context refers to the one dealing damage.
            // However, BreakConcentrationCommand uses getCaster(state) which looks up context.caster.id.
            // So we must pass the target (who is concentrating) as the 'caster' in this new context.
            ...this.context,
            caster: target,
            spellId: target.concentratingOn.spellId,
            spellName: target.concentratingOn.spellName,
            targets: [] // Self logic is handled by getCaster
          })

          currentState = breakCommand.execute(currentState)

          currentState = this.addLogEntry(currentState, {
            type: 'status',
            message: `${target.name} fails concentration save (${check.roll} vs DC ${check.dc})`,
            characterId: target.id
          })
        } else {
          currentState = this.addLogEntry(currentState, {
            type: 'status',
            message: `${target.name} maintains concentration (${check.roll} vs DC ${check.dc})`,
            characterId: target.id
          })
        }
      }
    }

    return currentState
  }

  get description(): string {
    if (isDamageEffect(this.effect)) {
      return `Deals ${this.effect.damage.dice} ${this.effect.damage.type} damage`
    }
    return 'Deals damage'
  }

  private rollDamage(diceString: string): number {
    const match = diceString.match(/(\d+)d(\d+)(?:\+(\d+))?/)
    if (!match) return 0

    const [, countStr, sizeStr, modStr] = match
    const count = parseInt(countStr)
    const size = parseInt(sizeStr)
    const mod = modStr ? parseInt(modStr) : 0

    let total = 0
    for (let i = 0; i < count; i++) {
      total += Math.floor(Math.random() * size) + 1
    }
    return total + mod
  }
}
