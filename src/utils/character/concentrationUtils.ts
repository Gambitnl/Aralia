import { CombatCharacter } from '../../types/combat'
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
 * Uses the centralized saving throw logic to respect proficiency, bonuses, and centralized RNG.
 */
export function rollConcentrationSave(character: CombatCharacter): number {
    // Constitution saving throw
    const result = rollSavingThrow(character, 'Constitution', 0); // DC 0 as we just want the total
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
    const result = rollSavingThrow(character, 'Constitution', dc)

    return {
        success: result.success,
        dc,
        roll: result.total
    }
}
