import type { Spell } from '@/types/spells';
import type { CombatCharacter, CombatState } from '@/types/combat';
/**
 * Tracks concentration on spells
 *
 * D&D 5e concentration rules:
 * - Only one concentration spell active per character
 * - Broken by: taking damage, casting another concentration spell, being incapacitated, dying
 * - Concentration save DC = 10 or half damage taken (whichever is higher)
 */
export declare class ConcentrationTracker {
    /**
     * Check if character is concentrating on a spell
     *
     * @param character - Character to check
     * @param gameState - Current game state
     * @returns True if concentrating
     */
    static isConcentrating(character: CombatCharacter, _gameState: CombatState): boolean;
    /**
     * Start concentrating on a spell (breaks existing concentration)
     *
     * @param character - Character concentrating
     * @param spell - Spell to concentrate on
     * @param gameState - Current game state
     * @returns New game state with concentration started
     */
    static startConcentration(character: CombatCharacter, spell: Spell, gameState: CombatState): CombatState;
    /**
     * Break concentration (e.g., took damage, failed save, chose to drop)
     *
     * @param character - Character whose concentration breaks
     * @param gameState - Current game state
     * @returns New game state with concentration broken
     */
    static breakConcentration(character: CombatCharacter, gameState: CombatState): CombatState;
    /**
     * Roll concentration save after taking damage
     *
     * DC = 10 or half damage taken (whichever is higher)
     *
     * @param character - Character making the save
     * @param damage - Damage taken
     * @returns Save result
     */
    static rollConcentrationSave(character: CombatCharacter, damage: number): {
        success: boolean;
        dc: number;
        roll: number;
    };
}
