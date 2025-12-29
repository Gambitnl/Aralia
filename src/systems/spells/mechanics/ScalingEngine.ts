import type { ScalingFormula } from '@/types/spells'

/**
 * [SCRIBE] Handles spell upscaling calculations for D&D 5e
 *
 * ## D&D 5e Spell Scaling Mechanics
 *
 * Spells in 5e scale damage/effects in two distinct ways:
 *
 * ### 1. Slot-Level Scaling (Leveled Spells)
 * When casting a spell using a higher-level spell slot than required:
 * - Base damage is calculated at the spell's minimum level
 * - Bonus damage is added per slot level above minimum
 *
 * **Example: Fireball (3rd-level)**
 * - Base: 8d6 fire damage
 * - At 4th level: 8d6 + 1d6 = 9d6
 * - At 5th level: 8d6 + 2d6 = 10d6
 * - Formula: `baseDice + (bonusPerLevel × (castLevel - baseLevel))`
 *
 * ### 2. Character-Level Scaling (Cantrips)
 * Cantrips scale with the caster's total character level, NOT class level.
 * Multiclass characters use their total level for cantrip scaling.
 *
 * **Standard Cantrip Scaling Tiers:**
 * | Caster Level | Dice Multiplier |
 * |--------------|-----------------|
 * | 1-4          | 1x (base)       |
 * | 5-10         | 2x              |
 * | 11-16        | 3x              |
 * | 17+          | 4x              |
 *
 * **Example: Fire Bolt**
 * - Level 1: 1d10
 * - Level 5: 2d10
 * - Level 11: 3d10
 * - Level 17: 4d10
 *
 * ### Implementation Notes
 *
 * This engine supports both scaling types and prefers explicit tier definitions
 * (via `scalingTiers` in spell data) over calculated values for accuracy.
 *
 * @see {@link ScalingFormula} for the spell data structure
 * @see PHB p.201 for official scaling rules
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
