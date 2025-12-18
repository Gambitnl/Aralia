import type { ScalingFormula } from '@/types/spells'

/**
 * Handles spell upscaling calculations
 *
 * D&D 5e spells scale in two ways:
 * 1. Slot level: Casting at higher spell slot (e.g., Fireball at 4th level)
 * 2. Character level: Cantrips scale with character level
 */
export class ScalingEngine {
  /**
   * Calculate scaled value for a spell effect
   *
   * @param baseValue - Base dice/value (e.g., "3d6", "10")
   * @param scaling - Scaling formula from spell definition
   * @param castAtLevel - Spell slot level used
   * @param casterLevel - Character level (for cantrips)
   * @param baseSpellLevel - The base level of the spell (default 0 for cantrips)
   * @returns Scaled value (e.g., "5d6")
   */
  static scaleEffect(
    baseValue: string,
    scaling: ScalingFormula | undefined,
    castAtLevel: number,
    casterLevel: number,
    baseSpellLevel: number = 0
  ): string {
    if (!scaling) return baseValue

    // Check for explicit tier-based scaling first (preferred for cantrips)
    if (scaling.scalingTiers) {
      // Find the highest threshold <= relevant level
      // For cantrips (character_level), use casterLevel
      // For slotted spells (slot_level), use castAtLevel
      // (Though tiers are mostly for cantrips/character_level)
      const level = scaling.type === 'character_level' ? casterLevel : castAtLevel
      return this.scaleByTiers(baseValue, scaling.scalingTiers, level)
    }

    if (scaling.type === 'slot_level') {
      return this.scaleBySlotLevel(baseValue, scaling, castAtLevel, baseSpellLevel)
    }

    if (scaling.type === 'character_level') {
      return this.scaleByCharacterLevel(baseValue, scaling, casterLevel)
    }

    return baseValue
  }

  /**
   * Scale using explicit tiers defined in the spell data
   */
  private static scaleByTiers(
    baseValue: string,
    tiers: Record<string, string>,
    level: number
  ): string {
    const thresholds = Object.keys(tiers)
      .map(Number)
      .sort((a, b) => b - a) // Descending order

    for (const threshold of thresholds) {
      if (level >= threshold) {
        return tiers[String(threshold)]
      }
    }

    return baseValue
  }

  /**
   * Scale by spell slot level (e.g., Fireball)
   */
  private static scaleBySlotLevel(
    baseValue: string,
    scaling: ScalingFormula,
    castAtLevel: number,
    baseSpellLevel: number
  ): string {
    // Check if bonusPerLevel exists
    if (!scaling.bonusPerLevel) return baseValue

    // Parse bonusPerLevel (e.g., "+1d6", "+5")
    const bonusMatch = scaling.bonusPerLevel.match(/([+-]?\d+)(d\d+)?/)
    if (!bonusMatch) return baseValue

    const bonusCount = parseInt(bonusMatch[1])
    const bonusDice = bonusMatch[2] // e.g., "d6"

    const levelsAboveBase = Math.max(0, castAtLevel - baseSpellLevel)

    if (levelsAboveBase === 0) return baseValue

    if (bonusDice) {
      // Dice scaling (e.g., "8d6" + "+1d6" per level)
      const baseMatch = baseValue.match(/(\d+)(d\d+)/)
      if (baseMatch) {
        const baseDiceCount = parseInt(baseMatch[1])
        const diceType = baseMatch[2]
        const newDiceCount = baseDiceCount + (bonusCount * levelsAboveBase)
        return `${newDiceCount}${diceType}`
      }
    } else {
      // Flat scaling (e.g., "10" + "+5" per level)
      const baseNumber = parseInt(baseValue)
      if (!isNaN(baseNumber)) {
        return String(baseNumber + (bonusCount * levelsAboveBase))
      }
    }

    return baseValue
  }

  /**
   * Scale by character level (e.g., cantrips)
   *
   * Cantrips scale at levels 5, 11, 17
   */
  private static scaleByCharacterLevel(
    baseValue: string,
    scaling: ScalingFormula,
    casterLevel: number
  ): string {
    // Determine tier
    let tier = 1
    if (casterLevel >= 17) tier = 4
    else if (casterLevel >= 11) tier = 3
    else if (casterLevel >= 5) tier = 2

    // Parse base dice
    const baseMatch = baseValue.match(/(\d+)(d\d+)/)
    if (baseMatch) {
      const baseDiceCount = parseInt(baseMatch[1])
      const diceType = baseMatch[2]
      const newDiceCount = baseDiceCount * tier
      return `${newDiceCount}${diceType}`
    }

    return baseValue
  }
}
