import type { SavingThrowAbility } from '@/types/spells'
import type { CombatCharacter } from '@/types'
import { DiceRoller } from './DiceRoller'

/**
 * Result of a saving throw
 */
export interface SavingThrowResult {
  /** Whether the save succeeded */
  success: boolean
  /** Raw d20 roll (1-20) */
  roll: number
  /** Total after modifiers */
  total: number
  /** DC that was rolled against */
  dc: number
}

/**
 * Resolves saving throw outcomes
 */
export class SavingThrowResolver {
  /**
   * Roll a saving throw for a character
   *
   * @param character - Target making the save
   * @param saveType - Ability to save with (e.g., "Dexterity")
   * @param dc - Difficulty class
   * @returns Save result with success/failure
   *
   * @example
   * const result = SavingThrowResolver.resolveSave(
   *   goblin,
   *   'Dexterity',
   *   15
   * )
   * console.log(result.success) // true if rolled >= 15
   */
  static resolveSave(
    character: CombatCharacter,
    saveType: SavingThrowAbility,
    dc: number
  ): SavingThrowResult {
    const roll = DiceRoller.rollD20()
    const modifier = this.getSaveModifier(character, saveType)
    const total = roll + modifier

    return {
      success: total >= dc,
      roll,
      total,
      dc
    }
  }

  /**
   * Get saving throw modifier for a character
   *
   * Modifier = ability modifier + proficiency (if proficient)
   */
  private static getSaveModifier(
    character: CombatCharacter,
    saveType: SavingThrowAbility
  ): number {
    const abilityScore = this.getAbilityScore(character, saveType)
    const abilityModifier = Math.floor((abilityScore - 10) / 2)

    // TODO: Check if proficient in this save
    // For now, assume not proficient
    const proficiency = 0

    return abilityModifier + proficiency
  }

  /**
   * Get ability score for save type
   */
  private static getAbilityScore(
    character: CombatCharacter,
    saveType: SavingThrowAbility
  ): number {
    switch (saveType) {
      case 'Strength':
        return character.stats.strength ?? 10
      case 'Dexterity':
        return character.stats.dexterity ?? 10
      case 'Constitution':
        return character.stats.constitution ?? 10
      case 'Intelligence':
        return character.stats.intelligence ?? 10
      case 'Wisdom':
        return character.stats.wisdom ?? 10
      case 'Charisma':
        return character.stats.charisma ?? 10
      default:
        const exhaustive: never = saveType
        throw new Error(`Unknown save type: ${exhaustive}`)
    }
  }
}
