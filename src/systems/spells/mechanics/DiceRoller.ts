// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 08/06/2026, 23:31:43
 * Dependents: systems/spells/mechanics/SavingThrowResolver.ts, systems/spells/mechanics/index.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * Dice rolling utilities
 */
import { rollDamage, rollD20 as rollD20Core } from '@/utils/combat/combatUtils'

export class DiceRoller {
  /**
   * Roll a d20 (1-20)
   */
  static rollD20(rng?: () => number): number {
    return rollD20Core({ rng })
  }

  /**
   * Roll dice from a string formula
   *
   * @param formula - Dice formula (e.g., "3d6", "1d8+2")
   * @returns Total rolled
   *
   * @example
   * const damage = DiceRoller.roll("3d6+2")
   * // Returns 5-20 (3d6 + 2)
   */
  static roll(formula: string, rng?: () => number): number {
    return rollDamage(formula, false, 1, rng)
  }

  /**
   * Roll with advantage (roll twice, take higher)
   */
  static rollD20Advantage(rng?: () => number): { roll: number; rolls: [number, number] } {
    const roll1 = this.rollD20(rng)
    const roll2 = this.rollD20(rng)
    return {
      roll: Math.max(roll1, roll2),
      rolls: [roll1, roll2]
    }
  }

  /**
   * Roll with disadvantage (roll twice, take lower)
   */
  static rollD20Disadvantage(rng?: () => number): { roll: number; rolls: [number, number] } {
    const roll1 = this.rollD20(rng)
    const roll2 = this.rollD20(rng)
    return {
      roll: Math.min(roll1, roll2),
      rolls: [roll1, roll2]
    }
  }
}
