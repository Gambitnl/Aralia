// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 01/05/2026, 17:10:59
 * Dependents: commands/factory/AbilityCommandFactory.ts, commands/factory/SpellCommandFactory.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { BaseEffectCommand } from '../base/BaseEffectCommand'
import { CombatState } from '@/types/combat'
import { isHealingEffect } from '../../types/spells'
import { rollDamage as rollFormula } from '../../utils/combatUtils'

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

      // 2. Calculate new HP (capped at maxHP) or Temp HP
      if (this.effect.healing?.isTemporaryHp) {
        // Temporary HP rules:
        // 1. Temp HP does not stack.
        // 2. If you have Temp HP and gain more, you choose whether to keep the old or take the new.
        //    (In this automated system, we default to "keep highest" which is the standard optimal play)
        const currentTemp = target.tempHP || 0

        if (healingRoll > currentTemp) {
          currentState = this.updateCharacter(currentState, target.id, {
            tempHP: healingRoll
          })

          currentState = this.addLogEntry(currentState, {
            type: 'heal',
            message: `${target.name} gains ${healingRoll} Temporary HP (replacing ${currentTemp})`,
            characterId: target.id,
            data: { value: healingRoll, type: 'temporary' }
          })
        } else {
           currentState = this.addLogEntry(currentState, {
            type: 'heal',
            message: `${target.name} gains ${healingRoll} Temporary HP but already has ${currentTemp} (No change)`,
            characterId: target.id,
            data: { value: 0, type: 'temporary' }
          })
        }
      } else {
        // Standard Healing
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
   * Helper to parse dice or flat-number healing formulas.
   *
   * Simple battle-map abilities such as Second Wind can arrive as a flat value
   * while spell data usually arrives as dice. Reusing the shared formula roller
   * keeps both shapes working through the same command pipeline.
   *
   * @param diceString The dice notation string.
   * @returns The total calculated healing.
   */
  private rollHealing(diceString: string): number {
    return rollFormula(diceString, false)
  }
}
