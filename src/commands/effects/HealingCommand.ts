import { BaseEffectCommand } from '../base/BaseEffectCommand'
import { CombatState } from '@/types/combat'
import { isHealingEffect } from '../../types/spells'

/**
 * Command to apply healing to targets.
 * Handles healing calculation, HP restoration (capped at maxHP), and combat log entries.
 */
export class HealingCommand extends BaseEffectCommand {
  execute(state: CombatState): CombatState {
    if (!isHealingEffect(this.effect)) {
      console.warn('HealingCommand received non-healing effect')
      return state
    }

    let currentState = state

    for (const target of this.getTargets(currentState)) {
      // 1. Roll healing
      const healingRoll = this.rollHealing(this.effect.healing.dice)

      // 2. Calculate new HP (capped at maxHP)
      // TODO: Honor healing.isTemporaryHp by granting temp HP (respect higher-value rule) instead of normal healing when flagged (see docs/tasks/spell-system-overhaul/COMPLETE-STUB-COMMANDS.md; if this block is moved/refactored/modularized, update the COMPLETE-STUB-COMMANDS entry path).
      const newHP = Math.min(target.maxHP, target.currentHP + healingRoll)
      const actualHealing = newHP - target.currentHP

      // 3. Update character
      currentState = this.updateCharacter(currentState, target.id, {
        currentHP: newHP
      })

      // 4. Add combat log entry
      currentState = this.addLogEntry(currentState, {
        type: 'heal',
        message: `${target.name} is healed for ${actualHealing} HP (${target.currentHP} → ${newHP})`,
        characterId: target.id,
        data: { value: actualHealing }
      })
    }

    return currentState
  }

  get description(): string {
    if (isHealingEffect(this.effect)) {
      return `Heals ${this.effect.healing.dice} HP`
    }
    return 'Heals HP'
  }

  /**
   * Helper to parse dice string (e.g., "2d8+3") and roll healing.
   * @param diceString The dice notation string.
   * @returns The total calculated healing.
   */
  private rollHealing(diceString: string): number {
    const match = diceString.match(/(\d+)d(\d+)(?:\+(\d+))?/)
    if (!match) {
      console.warn(`Invalid dice string for healing: ${diceString}`)
      return 0
    }

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
