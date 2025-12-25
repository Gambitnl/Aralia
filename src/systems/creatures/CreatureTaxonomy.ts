import { CreatureType, CreatureTypeTraits } from '../../types/creatures';
import { TargetConditionFilter } from '../../types/spells';

/**
 * Service for handling creature type classifications, validations, and interactions.
 * Centralizes logic that was previously scattered across targeting utils and spell validators.
 *
 * Used by:
 * - Spell targeting (e.g., Hold Person targets Humanoids)
 * - Defensive auras (e.g., Protection from Evil and Good)
 * - Ranger Favored Enemy logic
 * - Paladin Divine Sense
 */
export class CreatureTaxonomy {

  /**
   * Checks if a creature type matches a given filter (whitelist and blacklist).
   *
   * @param targetTypes - The creature types of the target (e.g., ['Humanoid', 'Shapechanger'])
   * @param filter - The filter criteria from a spell or ability
   * @returns true if the target is valid according to the filter
   *
   * @example
   * // Hold Person: allowed=['Humanoid']
   * isValidTarget(['Humanoid'], { creatureTypes: ['Humanoid'] }) // true
   * isValidTarget(['Undead'], { creatureTypes: ['Humanoid'] }) // false
   *
   * @example
   * // Sleep: excluded=['Undead', 'Construct']
   * isValidTarget(['Undead'], { excludeCreatureTypes: ['Undead'] }) // false
   */
  static isValidTarget(targetTypes: string[], filter: TargetConditionFilter): boolean {
    // Normalize input types to ensure case-insensitivity matches
    const normalizedTargetTypes = targetTypes.map(t => t.toLowerCase());

    // 1. Check Exclusion (Blacklist)
    if (filter.excludeCreatureTypes && filter.excludeCreatureTypes.length > 0) {
      const isExcluded = filter.excludeCreatureTypes.some(excluded =>
        normalizedTargetTypes.includes(excluded.toLowerCase())
      );
      if (isExcluded) return false;
    }

    // 2. Check Inclusion (Whitelist)
    // If specific types are required, the target MUST match at least one.
    // Note: 'creatureTypes' is the V2 standard, 'creatureType' is legacy but supported.
    let requiredTypes = filter.creatureTypes || filter.creatureType;

    // Defensive check: Ensure requiredTypes is an array before iterating
    if (requiredTypes && !Array.isArray(requiredTypes)) {
       // If it's a single string, wrap it in an array
       requiredTypes = [requiredTypes];
    }

    if (requiredTypes && requiredTypes.length > 0) {
      const hasRequiredType = requiredTypes.some(required =>
        normalizedTargetTypes.includes(required.toLowerCase())
      );
      if (!hasRequiredType) return false;
    }

    return true;
  }

  /**
   * Retrieves the standard traits for a given creature type.
   * Useful for UI tooltips or logic checks (e.g., "Is this type generally immune to poison?").
   */
  static getTraits(type: CreatureType) {
    return CreatureTypeTraits[type];
  }

  /**
   * Validates if a string is a known CreatureType.
   * Useful for validating external data (JSONs).
   */
  static isKnownType(type: string): boolean {
    return Object.values(CreatureType).some(t => t.toLowerCase() === type.toLowerCase());
  }

  /**
   * Normalizes a string to the proper CreatureType enum case.
   * @returns The Enum value (e.g. "Undead") or null if invalid.
   */
  static normalize(type: string): CreatureType | null {
    const entry = Object.entries(CreatureType).find(([_, val]) => val.toLowerCase() === type.toLowerCase());
    return entry ? entry[1] : null;
  }
}
