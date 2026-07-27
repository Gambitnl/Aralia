/**
 * @file src/systems/underdark/UnderdarkMechanics.ts
 * Implements core Underdark mechanics: light source consumption, sanity decay, and madness.
 */
import { GameState, GameMessage } from '../../types';
import { UnderdarkState } from '../../types/underdark';
export declare class UnderdarkMechanics {
    /**
     * Processes time advancement for Underdark systems.
     * @param state The current GameState.
     * @param seconds The number of seconds to advance.
     * @returns An object containing the updated UnderdarkState and any generated GameMessages.
     */
    static processTime(state: GameState, seconds: number): {
        underdark: UnderdarkState;
        messages: GameMessage[];
    };
}
