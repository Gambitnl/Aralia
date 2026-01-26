// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file is part of a complex dependency web.
 * 
 * Last Sync: 26/01/2026, 01:38:20
 * Dependents: DamageCommand.ts, combat/index.ts, combatUtils.ts
 * Imports: 2 files
 * 
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx scripts/codebase-visualizer-server.ts --sync [this-file-path]
 * See scripts/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { DamageType } from '@/types/spells';
import type { CombatCharacter } from '@/types';

/**
 * Applies damage resistance/vulnerability/immunity logic based on D&D 5e rules.
 * This centralized utility ensures consistent application of rules like:
 * - Immunity > Resistance/Vulnerability
 * - Resistance and Vulnerability cancelling out (XGtE)
 * - Elemental Adept feat bypassing resistance
 */
export class ResistanceCalculator {
  /**
   * Calculate final damage after resistances, vulnerabilities, and immunities.
   *
   * @param baseDamage - Damage before resistances
   * @param damageType - Type of damage
   * @param target - Character taking damage
   * @param source - Source of damage (optional, for checking feats like Elemental Adept)
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
    target: CombatCharacter,
    source?: CombatCharacter | null
  ): number {
    let finalDamage = Math.max(0, baseDamage);

    // 1. Immunity (Damage -> 0)
    if (this.isImmune(target, damageType)) {
      return 0;
    }

    // Determine effective resistance (accounting for feats like Elemental Adept)
    const hasResistance = this.isResistant(target, damageType);
    const hasVulnerability = this.isVulnerable(target, damageType);

    // Check for Elemental Adept feat on the source
    // Feat ID is 'elemental_adept', structure is { selectedDamageType: string }
    // We check both the new array-based structure (featChoices[]) and the legacy record-based structure if present.
    let elementalAdeptChoice: string | undefined;

    if (source?.featChoices) {
      if (Array.isArray(source.featChoices)) {
         // New structure: Array of objects
         // eslint-disable-next-line @typescript-eslint/no-explicit-any
         const feat = source.featChoices.find((f: any) => f.featId === 'elemental_adept');
         elementalAdeptChoice = feat?.selection?.selectedDamageType;
      } else {
         // Legacy structure: Record<string, any>
         const legacy = (source.featChoices as Record<string, any>)['elemental_adept'];
         elementalAdeptChoice = legacy?.selectedDamageType;
      }
    }

    const ignoresResistance = elementalAdeptChoice &&
                              String(elementalAdeptChoice).toLowerCase() === damageType.toLowerCase();

    const effectiveResistance = hasResistance && !ignoresResistance;

    // 2. Interaction: Resistance and Vulnerability cancel each other out (XGtE p.77)
    if (effectiveResistance && hasVulnerability) {
      return finalDamage;
    }

    // 3. Resistance (Damage -> floor(Damage / 2))
    if (effectiveResistance) {
      finalDamage = Math.floor(finalDamage / 2);
    }

    // 4. Vulnerability (Damage -> Damage * 2)
    if (hasVulnerability) {
      finalDamage = finalDamage * 2;
    }

    return finalDamage;
  }

  /**
   * Check if character is immune to damage type
   */
  private static isImmune(
    character: CombatCharacter,
    damageType: DamageType
  ): boolean {
    return character.immunities?.includes(damageType) ?? false;
  }

  /**
   * Check if character is resistant to damage type
   */
  private static isResistant(
    character: CombatCharacter,
    damageType: DamageType
  ): boolean {
    return character.resistances?.includes(damageType) ?? false;
  }

  /**
   * Check if character is vulnerable to damage type
   */
  private static isVulnerable(
    character: CombatCharacter,
    damageType: DamageType
  ): boolean {
    return character.vulnerabilities?.includes(damageType) ?? false;
  }
}
