import { CreatureType } from '../../types/creatures';
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
export declare class CreatureTaxonomy {
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
    static isValidTarget(targetTypes: string[], filter: TargetConditionFilter): boolean;
    /**
     * Retrieves the standard traits for a given creature type.
     * Useful for UI tooltips or logic checks (e.g., "Is this type generally immune to poison?").
     */
    static getTraits(type: CreatureType): import("../../types").TypeTraits;
    /**
     * Validates if a string is a known CreatureType.
     * Useful for validating external data (JSONs).
     */
    static isKnownType(type: string): boolean;
    /**
     * Normalizes a string to the proper CreatureType enum case.
     * @returns The Enum value (e.g. "Undead") or null if invalid.
     */
    static normalize(type: string): CreatureType | null;
}
