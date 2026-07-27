import { GameState } from '../../types/index';
export type PsychicWindEffectType = 'none' | 'damage' | 'location_displacement' | 'mental_disorientation';
export interface PsychicWindResult {
    encountered: boolean;
    roll: number;
    effectType: PsychicWindEffectType;
    description: string;
    damage?: string;
    displacementLocation?: string;
    saveDC?: number;
}
export declare class AstralMechanics {
    static PSYCHIC_WIND_CHANCE_DC: number;
    static INT_SAVE_DC: number;
    /**
     * Calculates a creature's movement speed in the Astral Plane.
     * On the Astral Plane, you move by thought.
     * Speed = 3 * Intelligence Score.
     */
    static calculateAstralSpeed(intelligenceScore: number): number;
    /**
     * Checks for a Psychic Wind encounter.
     * Usually checked once per "travel interval" or "rest".
     */
    static checkForPsychicWind(): PsychicWindResult;
    /**
     * Applies the mechanical results of a Psychic Wind encounter to the GameState.
     * Note: This function logs and notifies, but damage application/teleportation
     * would typically happen in the game loop. This helper facilitates that integration.
     */
    static processPsychicWind(gameState: GameState, result: PsychicWindResult): void;
}
