import { CombatCharacter } from '../types/combat'
import { rollSavingThrow } from './savingThrowUtils'

/**
 * Calculates the DC for a concentration saving throw based on damage taken.
 * Rule: DC is 10 or half the damage taken, whichever is higher.
 */
export function calculateConcentrationDC(damageDealt: number): number {
    return Math.max(10, Math.floor(damageDealt / 2))
}

/**
 * Rolls a Constitution saving throw for the character.
 * @deprecated Use checkConcentration which uses rollSavingThrow internally.
 * This is kept for backward compatibility but now delegates to the standard saving throw logic.
 */
export function rollConcentrationSave(character: CombatCharacter): number {
    // Delegate to the robust saving throw logic
    // This ensures proficiency is included if applicable
    const result = rollSavingThrow(character, 'Constitution', 10); // DC doesn't matter for getting the total
    return result.total;
}

/**
 * Checks if a character passes their concentration check after taking damage.
 * 
 * @param character The character taking damage who is currently concentrating.
 * @param damageDealt The amount of damage taken (determines DC).
 * @returns Object containing success status, the calculated DC, and the actual roll total.
 */
export function checkConcentration(
    character: CombatCharacter,
    damageDealt: number
): { success: boolean; dc: number; roll: number } {
    const dc = calculateConcentrationDC(damageDealt)

    // Use the standard saving throw utility to ensure proficiency and modifiers are handled correctly
    const result = rollSavingThrow(character, 'Constitution', dc)

    return {
        success: result.success,
        dc,
        roll: result.total
    }
}
