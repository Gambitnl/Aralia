/**
 * @file src/systems/underdark/UnderdarkFactionSystem.ts
 * System for handling Underdark faction logic, including depth checks,
 * hostility calculations, and mechanic application.
 */
import { UnderdarkFaction, DepthLayer, UnderdarkState } from '../../types/underdark';
export declare class UnderdarkFactionSystem {
    /**
     * Determines which DepthLayer corresponds to a given depth in feet.
     * @param depthFeet Depth in feet below surface
     */
    static getLayerFromDepth(depthFeet: number): DepthLayer;
    /**
     * Returns all factions that inhabit the current depth layer.
     * @param depthFeet Depth in feet
     */
    static getFactionsAtDepth(depthFeet: number): UnderdarkFaction[];
    /**
     * Calculates the effective hostility of a faction towards the player party.
     * @param faction The faction in question
     * @param playerRace The race of the lead character (e.g., 'Drow', 'Dwarf')
     * @param reputation Player's reputation with this faction (-100 to 100)
     */
    static calculateHostility(faction: UnderdarkFaction, playerRace: string, reputation: number): number;
    /**
     * Applies special faction mechanics to the Underdark state.
     * Use this when the player is in the faction's territory.
     *
     * @param state Current UnderdarkState
     * @param factionId ID of the faction whose territory we are in
     * @param minutesPassed Time elapsed for update
     */
    static applyTerritoryMechanics(state: UnderdarkState, factionId: string | undefined, minutesPassed: number): UnderdarkState;
    /**
     * Internal helper to apply a single mechanic.
     */
    private static applyMechanic;
}
