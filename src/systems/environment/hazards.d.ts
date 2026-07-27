/**
 * @file src/systems/environment/hazards.ts
 * Defines natural hazards (Lava, Ice, etc.) and the logic to resolve their interactions.
 * This system allows adding mechanical danger to terrain.
 */
import { EnvironmentalHazard } from '../../types/environment';
import { CombatCharacter } from '../../types/combat';
import { DamageType } from '../../types/spells';
/**
 * Result of a hazard interaction.
 */
export interface HazardResult {
    triggered: boolean;
    damage?: {
        amount: number;
        dice: string;
        type: DamageType;
    };
    statusEffect?: {
        name: string;
        duration: number;
        saveDC?: number;
        saveType?: 'str' | 'dex' | 'con' | 'wis' | 'int' | 'cha';
    };
    message?: string;
}
/**
 * Standard registry of Natural Hazards.
 */
export declare const NATURAL_HAZARDS: Record<string, EnvironmentalHazard>;
/**
 * Evaluates a hazard trigger against a character.
 * Note: This function returns the *potential* effect.
 * The consumer (Combat Engine) is responsible for rolling saves and applying damage.
 *
 * @param hazard The hazard definition.
 * @param character The character interacting with the hazard.
 * @param triggerType The event type (e.g. 'enter', 'start_turn').
 */
export declare function evaluateHazard(hazard: EnvironmentalHazard, character: CombatCharacter, triggerType: 'enter' | 'start_turn' | 'end_turn'): HazardResult;
