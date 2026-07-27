import { PlayerCharacter, GameState } from '../../types/index';
export interface MemoryLossResult {
    lostMemory: boolean;
    saveRoll: number;
    dc: number;
    message: string;
}
export interface TimeWarpResult {
    originalMinutes: number;
    warpedMinutes: number;
    roll: number;
    description: string;
    message: string;
}
export declare class FeywildMechanics {
    static MEMORY_LOSS_DC: number;
    /**
     * Checks if a character loses their memory upon leaving the Feywild.
     * Rules: DC 15 Wisdom save.
     * On failure: Character remembers nothing of their time in the Feywild.
     * On success: Memories remain but might fade like a dream.
     */
    static checkMemoryLoss(character: PlayerCharacter): MemoryLossResult;
    /**
     * Applies the mechanical effect of memory loss.
     * Adds a notification to the game state and logs the event.
     */
    static applyMemoryLossEffect(gameState: GameState, characterId: string): void;
    /**
     * Calculates the time warp effect when leaving the Feywild.
     * Based on DMG 5e Variant Rule + Creative License.
     * @param durationMinutes The actual time spent in the Feywild (in minutes).
     */
    static calculateTimeWarp(durationMinutes: number): TimeWarpResult;
}
