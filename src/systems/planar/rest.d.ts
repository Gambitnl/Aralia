import { GameState } from '../../types';
export interface RestOutcome {
    deniedCharacterIds: string[];
    messages: string[];
}
/**
 * Checks planar rules for resting and determines which characters
 * are denied benefits or suffer consequences.
 */
export declare function checkPlanarRestRules(gameState: GameState): RestOutcome;
