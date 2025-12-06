import { CombatCharacter } from '../types/combat'

/**
 * Calculates the DC for a concentration saving throw based on damage taken.
 * Rule: DC is 10 or half the damage taken, whichever is higher.
 */
export function calculateConcentrationDC(damageDealt: number): number {
    return Math.max(10, Math.floor(damageDealt / 2))
}

/**
 * Rolls a Constitution saving throw for the character.
 */
export function rollConcentrationSave(character: CombatCharacter): number {
    // Constitution saving throw
    const constitutionMod = Math.floor((character.stats.constitution - 10) / 2)
    const roll = Math.floor(Math.random() * 20) + 1
    return roll + constitutionMod
}

/**
 * Checks if a character passes their concentration check after taking damage.
 */
export function checkConcentration(
    character: CombatCharacter,
    damageDealt: number
): { success: boolean; dc: number; roll: number } {
    const dc = calculateConcentrationDC(damageDealt)
    const roll = rollConcentrationSave(character)

    return {
        success: roll >= dc,
        dc,
        roll
    }
}
