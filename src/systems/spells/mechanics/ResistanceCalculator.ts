import type { DamageType } from '@/types/spells'
import type { CombatCharacter } from '@/types'

/**
 * Applies damage resistance/vulnerability/immunity
 */
export class ResistanceCalculator {
  /**
   * Calculate final damage after resistances
   *
   * @param baseDamage - Damage before resistances
   * @param damageType - Type of damage
   * @param target - Character taking damage
   * @returns Final damage amount
   *
   * @example
   * // Fire Elemental takes cold damage
   * const finalDamage = ResistanceCalculator.applyResistances(
   *   20,
   *   'Cold',
   *   fireElemental
   * )
   * // Returns 40 (vulnerable to cold)
   */
  static applyResistances(
    baseDamage: number,
    damageType: DamageType,
    target: CombatCharacter
  ): number {
    let finalDamage = baseDamage

    // 1. Immunity (Damage -> 0)
    if (this.isImmune(target, damageType)) {
      return 0
    }

    // 2. Resistance (Damage -> floor(Damage / 2))
    if (this.isResistant(target, damageType)) {
      finalDamage = Math.floor(finalDamage / 2)
    }

    // 3. Vulnerability (Damage -> Damage * 2)
    if (this.isVulnerable(target, damageType)) {
      finalDamage = finalDamage * 2
    }

    return finalDamage
  }

  /**
   * Check if character is immune to damage type
   */
  private static isImmune(
    character: CombatCharacter,
    damageType: DamageType
  ): boolean {
    // TODO: Read from character.damageImmunities
    return false
  }

  /**
   * Check if character is resistant to damage type
   */
  private static isResistant(
    character: CombatCharacter,
    damageType: DamageType
  ): boolean {
    // TODO: Read from character.damageResistances
    return false
  }

  /**
   * Check if character is vulnerable to damage type
   */
  private static isVulnerable(
    character: CombatCharacter,
    damageType: DamageType
  ): boolean {
    // TODO: Read from character.damageVulnerabilities
    return false
  }
}
