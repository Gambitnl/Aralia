// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 02/06/2026, 15:48:55
 * Dependents: commands/effects/DamageCommand.ts, utils/combat/combatUtils.ts, utils/combat/index.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
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
    source?: CombatCharacter | null,
    isMagical?: boolean
  ): number {
    let finalDamage = Math.max(0, baseDamage);

    // 1. Immunity (Damage -> 0)
    if (this.isImmune(target, damageType, isMagical)) {
      return 0;
    }

    // Determine effective resistance (accounting for feats like Elemental Adept)
    const hasResistance = this.isResistant(target, damageType, isMagical);
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
   * Check if character is immune to damage type.
   * When isMagical is explicitly false, also checks nonMagicalImmunities
   * (e.g. lycanthropes are immune to nonmagical bludgeoning/piercing/slashing).
   * 
   * WHAT CHANGED: Added status effect and active effect modifiers check for immunities.
   * WHY IT CHANGED: Both status effects and active spell effects (such as Protection
   * from Energy or temporary spell shielding) can grant temporary damage immunities,
   * which are registered under statusEffects[].modifiers.immunity and activeEffects[].mechanics.damageImmunity.
   */
  private static isImmune(
    character: CombatCharacter,
    damageType: DamageType,
    isMagical?: boolean
  ): boolean {
    const lowerType = damageType.toLowerCase();
    if (character.immunities?.some(dt => dt.toLowerCase() === lowerType)) return true;
    if (isMagical === false && character.nonMagicalImmunities?.some(dt => dt.toLowerCase() === lowerType)) return true;
    
    // Check for temporary immunity modifiers applied by active status effects
    if (character.statusEffects?.some(se => se.modifiers?.immunity?.some(dt => dt.toLowerCase() === lowerType))) return true;
    
    // Check for temporary immunity modifiers applied by active spell effects (activeEffects)
    if (character.activeEffects?.some(ae => ae.mechanics?.damageImmunity?.some(dt => dt.toLowerCase() === lowerType))) return true;

    return false;
  }

  /**
   * Check if character is resistant to damage type.
   * When isMagical is explicitly false, also checks nonMagicalResistances.
   * 
   * WHAT CHANGED: Added status effect and active effect modifiers check for resistances.
   * WHY IT CHANGED: Active status effects (like Barbarian Rage) and active spell
   * effects (like Warding or Resist Elements) can grant temporary damage resistances,
   * registered in statusEffects[].modifiers.resistance or activeEffects[].mechanics.damageResistance.
   */
  private static isResistant(
    character: CombatCharacter,
    damageType: DamageType,
    isMagical?: boolean
  ): boolean {
    const lowerType = damageType.toLowerCase();
    if (character.resistances?.some(dt => dt.toLowerCase() === lowerType)) return true;
    if (isMagical === false && character.nonMagicalResistances?.some(dt => dt.toLowerCase() === lowerType)) return true;
    
    // Check for temporary resistance modifiers applied by active status effects (e.g., Rage)
    if (character.statusEffects?.some(se => se.modifiers?.resistance?.some(dt => dt.toLowerCase() === lowerType))) return true;
    
    // Check for temporary resistance modifiers applied by active spell effects (activeEffects)
    if (character.activeEffects?.some(ae => ae.mechanics?.damageResistance?.some(dt => dt.toLowerCase() === lowerType))) return true;

    return false;
  }

  /**
   * Check if character is vulnerable to damage type.
   * 
   * WHAT CHANGED: Added status effect and active effect modifiers check for vulnerabilities.
   * WHY IT CHANGED: Active status effects and active spell effects can impose temporary damage vulnerabilities
   * registered in statusEffects[].modifiers.vulnerability or activeEffects[].mechanics.damageVulnerability.
   */
  private static isVulnerable(
    character: CombatCharacter,
    damageType: DamageType
  ): boolean {
    const lowerType = damageType.toLowerCase();
    if (character.vulnerabilities?.some(dt => dt.toLowerCase() === lowerType)) return true;
    
    // Check for temporary vulnerability modifiers applied by active status effects
    if (character.statusEffects?.some(se => se.modifiers?.vulnerability?.some(dt => dt.toLowerCase() === lowerType))) return true;
    
    // Check for temporary vulnerability modifiers applied by active spell effects (activeEffects)
    if (character.activeEffects?.some(ae => ae.mechanics?.damageVulnerability?.some(dt => dt.toLowerCase() === lowerType))) return true;

    return false;
  }
}
