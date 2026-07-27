import type { SavingThrowAbility } from '@/types/spells';
import type { CombatCharacter } from '@/types';
/**
 * Result of a saving throw
 */
export interface SavingThrowResult {
    /** Whether the save succeeded */
    success: boolean;
    /** Raw d20 roll (1-20) */
    roll: number;
    /** Total after modifiers */
    total: number;
    /** DC that was rolled against */
    dc: number;
}
/**
 * Resolves saving throw outcomes
 */
export declare class SavingThrowResolver {
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
     * logger.debug('Save result', { success: result.success }) // true if rolled >= 15
     */
    static resolveSave(character: CombatCharacter, saveType: SavingThrowAbility, dc: number): SavingThrowResult;
    /**
     * Get saving throw modifier for a character
     *
     * Modifier = ability modifier + proficiency (if proficient)
     */
    private static getSaveModifier;
    /**
     * Calculate proficiency bonus based on level
     * Formula: ceil(level / 4) + 1
     * Level 1-4: +2
     * Level 5-8: +3
     * ...
     * Level 17-20: +6
     */
    private static getProficiencyBonus;
    /**
     * Get ability score for save type
     */
    private static getAbilityScore;
}
