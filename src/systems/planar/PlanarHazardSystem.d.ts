import { GameState } from '../../types';
export interface HazardEvent {
    characterId: string;
    hazardName: string;
    damage?: number;
    damageType?: string;
    statusEffect?: string;
    message: string;
}
export interface HazardOutcome {
    events: HazardEvent[];
    globalMessages: string[];
}
export declare class PlanarHazardSystem {
    /**
     * Processes active hazards for the current plane based on time passed.
     * This should be called periodically (e.g., every minute or every tick).
     * @param gameState Current game state.
     * @param minutesPassed Number of minutes passed since last check.
     */
    static processPeriodicHazards(gameState: GameState, minutesPassed: number): HazardOutcome;
    private static processSingleHazard;
}
