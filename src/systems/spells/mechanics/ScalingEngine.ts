// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 03/04/2026, 10:32:06
 * Dependents: systems/spells/mechanics/index.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { HigherLevelScaling, HigherLevelScalingRule, ScalingFormula } from '@/types/spells'

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
   * Resolve the newer spell-level higher-level scaling structure into readable
   * runtime facts for a specific cast.
   *
   * Why this exists:
   * the repo now has a dedicated `higherLevelScaling` field on spells so the
   * engine does not have to reverse-engineer scaling behavior from prose later.
   * This helper is intentionally descriptive first; it gives the runtime one
   * place to interpret those rules while preserving room for future mechanical
   * consumers that may want richer typed outputs instead of strings.
   */
  static describeHigherLevelScaling(
    scaling: HigherLevelScaling | undefined,
    castAtLevel: number,
    casterLevel: number,
  ): string[] {
    if (!scaling) return []

    if (scaling.type === 'multiple') {
      return scaling.rules.flatMap((rule) => this.describeHigherLevelScalingRule(rule, castAtLevel, casterLevel))
    }

    if (scaling.type === 'special_text_only') {
      return [scaling.referenceText]
    }

    return this.describeHigherLevelScalingRule(scaling, castAtLevel, casterLevel)
  }

  /**
   * Resolve one concrete higher-level scaling rule into a readable runtime note.
   *
   * This is deliberately conservative. If the engine cannot derive a stronger
   * numeric result safely, it still returns the structured rule as readable text
   * instead of guessing.
   */
  private static describeHigherLevelScalingRule(
    scaling: HigherLevelScalingRule,
    castAtLevel: number,
    casterLevel: number,
  ): string[] {
    if (scaling.type === 'character_level_tiers') {
      const resolved = this.resolveTierEntry(scaling.tiers, casterLevel)
      return resolved ? [`Character level ${casterLevel}: ${resolved}`] : []
    }

    if (scaling.type === 'slot_level_bonus') {
      const levelsAboveBase = Math.max(0, castAtLevel - scaling.baseSpellLevel)
      if (levelsAboveBase === 0) return []
      return [`Slot level ${castAtLevel}: ${scaling.bonusPerLevel} applied ${levelsAboveBase} time(s)`]
    }

    if (scaling.type === 'slot_level_table') {
      const resolved = this.resolveTierEntry(scaling.entries, castAtLevel)
      return resolved ? [`Slot level ${castAtLevel}: ${resolved}`] : []
    }

    if (scaling.type === 'target_count_bonus') {
      const levelsAboveBase = Math.max(0, castAtLevel - scaling.baseSpellLevel)
      if (levelsAboveBase === 0) return []
      const extraTargets = levelsAboveBase * scaling.additionalTargetsPerLevel
      const targetLabel = scaling.targetLabel ?? 'target'
      return [`Slot level ${castAtLevel}: +${extraTargets} ${targetLabel}${extraTargets === 1 ? '' : 's'}`]
    }

    const levelsAboveBase = Math.max(0, castAtLevel - scaling.baseSpellLevel)
    if (levelsAboveBase === 0) return []
    const totalIncrease = levelsAboveBase * scaling.increasePerLevel
    return [`Slot level ${castAtLevel}: +${totalIncrease} ${scaling.unit} ${scaling.dimension.replace(/_/g, ' ')}`]
  }

  /**
   * Pick the highest threshold entry that applies at the given level.
   *
   * This is used by both cantrip tiers and explicit slot-level breakpoint
   * tables so the two storage shapes behave consistently.
   */
  private static resolveTierEntry(
    entries: Record<string, string>,
    level: number,
  ): string | undefined {
    const thresholds = Object.keys(entries)
      .map(Number)
      .filter((threshold) => !Number.isNaN(threshold))
      .sort((a, b) => b - a)

    for (const threshold of thresholds) {
      if (level >= threshold) {
        return entries[String(threshold)]
      }
    }

    return undefined
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
