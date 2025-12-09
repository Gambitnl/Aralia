/**
 * Dice rolling utilities
 */
export class DiceRoller {
  /**
   * Roll a d20 (1-20)
   */
  static rollD20(): number {
    return Math.floor(Math.random() * 20) + 1
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
  static roll(formula: string): number {
    const match = formula.match(/(\d+)d(\d+)(?:([+-]\d+))?/)
    if (!match) {
      // Flat number (e.g., "5")
      const flat = parseInt(formula)
      return isNaN(flat) ? 0 : flat
    }

    const numDice = parseInt(match[1])
    const diceSize = parseInt(match[2])
    const bonus = match[3] ? parseInt(match[3]) : 0

    let total = bonus

    for (let i = 0; i < numDice; i++) {
      total += Math.floor(Math.random() * diceSize) + 1
    }

    return total
  }

  /**
   * Roll with advantage (roll twice, take higher)
   */
  static rollD20Advantage(): { roll: number; rolls: [number, number] } {
    const roll1 = this.rollD20()
    const roll2 = this.rollD20()
    return {
      roll: Math.max(roll1, roll2),
      rolls: [roll1, roll2]
    }
  }

  /**
   * Roll with disadvantage (roll twice, take lower)
   */
  static rollD20Disadvantage(): { roll: number; rolls: [number, number] } {
    const roll1 = this.rollD20()
    const roll2 = this.rollD20()
    return {
      roll: Math.min(roll1, roll2),
      rolls: [roll1, roll2]
    }
  }
}
