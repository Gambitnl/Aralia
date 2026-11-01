/**
 * @file scaling.ts
 * Scales complete effect payloads, including nested riders and created resources.
 *
 * Extracted from SpellCommandFactory without changing rule bodies or random
 * draws. The public factory still controls cast preparation and command order.
 * New spell behavior belongs with its family; broad rules changes remain separate.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 24/10/2026, 21:02:48
 * Dependents: commands/factory/SpellCommandFactory.ts, commands/factory/spell/fire.ts, commands/factory/spell/movement.ts, commands/factory/spell/utilityBridges.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { SpellEffect, isAttackRollModifierEffect, isDamageEffect, isHealingEffect, isUtilityEffect, resolveByLevelThreshold, countLevelThresholdsReached } from '@/types/spells'
import { addDice } from '@/utils/diceUtils'

/**
 * Apply scaling formulas to effect.
 *
 * Character-level (cantrip) scaling reads the same level-threshold tables as
 * target counts, so it goes through the shared `resolveByLevelThreshold` /
 * `countLevelThresholdsReached` helpers in `src/types/spellTargeting.ts`.
 * Slot-level scaling stays here: it adds dice per slot above the base level
 * and has no threshold table to share.
 */
export function applyScaling(
  effect: SpellEffect,
  baseSpellLevel: number,
  castAtLevel: number,
  casterLevel: number
): SpellEffect {
  if (!effect.scaling) return effect

  let scaled = { ...effect }

  if (effect.scaling.type === 'slot_level') {
    const levelsAbove = castAtLevel - baseSpellLevel
    if (levelsAbove > 0) {
      scaled = applySlotLevelScaling(scaled, levelsAbove)
    }
  }

  if (effect.scaling.type === 'character_level') {
    const tiers = [5, 11, 17]
    scaled = applyCharacterLevelScaling(scaled, casterLevel, tiers)
  }

  return scaled
}



/**
 * Apply slot level scaling (e.g., +1d6 per level)
 */
export function applySlotLevelScaling(
  effect: SpellEffect,
  levelsAbove: number
): SpellEffect {
  const bonusPerLevel = effect.scaling!.bonusPerLevel

  if (!bonusPerLevel) return effect

  const diceMatch = bonusPerLevel.match(/\+(\d+)d(\d+)/)

  if (diceMatch && (isDamageEffect(effect) || (isAttackRollModifierEffect(effect) && effect.damage))) {
    const [, count, size] = diceMatch
    const originalDice = effect.damage?.dice || '0d0'
    const newDice = addDice(originalDice, `${count}d${size}`, levelsAbove)

    return applyScaledDamageDice(effect, newDice)
  }

  if (diceMatch && isHealingEffect(effect)) {
    const [, count, size] = diceMatch
    const originalDice = effect.healing.dice || '0d0'
    const newDice = addDice(originalDice, `${count}d${size}`, levelsAbove)
    return {
      ...effect,
      healing: { ...effect.healing, dice: newDice }
    }
  }

  if (isUtilityEffect(effect) && effect.createdObjects?.length) {
    // Creation spells can scale resources rather than dice. Scale those
    // explicit created-object fields before UtilityCommand emits inventory so
    // upcast water/food supplies reach the same runtime path as base casts.
    return {
      ...effect,
      createdObjects: effect.createdObjects.map(createdObject => ({
        ...createdObject,
        count: createdObject.countScaling?.type === 'slot_level'
          ? (createdObject.count ?? 1) + (createdObject.countScaling.bonusPerLevel * levelsAbove)
          : createdObject.count,
        levels: createdObject.levelScaling?.type === 'slot_level'
          ? (createdObject.levels ?? 0) + (createdObject.levelScaling.bonusPerLevel * levelsAbove)
          : createdObject.levels,
        inventoryQuantity: createdObject.inventoryQuantityScaling?.type === 'slot_level'
          ? ((createdObject.inventoryQuantity ?? createdObject.count) ?? 1) + (createdObject.inventoryQuantityScaling.bonusPerLevel * levelsAbove)
          : createdObject.inventoryQuantity
      }))
    }
  }

  return effect
}



/**
 * Apply character level scaling (cantrips)
 */
export function applyCharacterLevelScaling(
  effect: SpellEffect,
  casterLevel: number,
  scalingLevels: number[]
): SpellEffect {
  const tier = countLevelThresholdsReached(scalingLevels, casterLevel)

  if (tier === 0 || !effect.scaling) return effect

  const scalingTiers = effect.scaling.scalingTiers
  if (scalingTiers) {
    const tierDice = resolveByLevelThreshold(scalingTiers, casterLevel)
    if (tierDice && /^\d+d\d+$/.test(tierDice)) {
      return applyScaledDamageDice(effect, tierDice)
    }
  }

  const bonusPerLevel = effect.scaling.bonusPerLevel
  if (!bonusPerLevel) return effect

  const diceMatch = bonusPerLevel.match(/\+(\d+)d(\d+)/)

  if (diceMatch && (isDamageEffect(effect) || (isAttackRollModifierEffect(effect) && effect.damage))) {
    const [, count, size] = diceMatch
    const originalDice = effect.damage?.dice || '0d0'
    const newDice = addDice(originalDice, `${count}d${size}`, tier)
    return applyScaledDamageDice(effect, newDice)
  }

  return effect
}



/**
 * Preserve Frostbite-style nested damage riders when scaling cantrips.
 * Top-level damage rows still scale the same way, but attack-roll modifier
 * rows can carry their own damage payload and should not be left behind.
 */
export function applyScaledDamageDice(effect: SpellEffect, dice: string): SpellEffect {
  if (isDamageEffect(effect)) {
    return {
      ...effect,
      damage: {
        ...effect.damage,
        dice,
        type: effect.damage.type
      }
    }
  }

  if (isAttackRollModifierEffect(effect) && effect.damage) {
    return {
      ...effect,
      damage: {
        ...effect.damage,
        dice,
        type: effect.damage.type
      }
    }
  }

  return effect
}
