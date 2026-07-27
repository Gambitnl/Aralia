import { Plane, PlanarEffect } from '../../types/planes';
import { GameState } from '../../types/index';
/**
 * Service to manage planar mechanics, effect retrieval, and plane transitions.
 */
export declare class PlanarService {
    /**
     * Resolves the authoritative Location record for the current location id,
     * preferring runtime-generated locations over the static world map.
     */
    private static resolveCurrentLocation;
    /**
     * Retrieves the current plane definition based on the GameState.
     *
     * Resolves the plane from authoritative location data (the location's
     * `planeId`), looking up the runtime `dynamicLocations` registry first and
     * then the static `LOCATIONS` map. Falls back to the Material Plane only
     * when the location, its `planeId`, or the referenced plane is genuinely
     * unknown.
     */
    static getCurrentPlane(gameState: GameState): Plane;
    /**
     * Gets the mechanical effects active on the current plane.
     */
    static getCurrentPlanarEffects(gameState: GameState): PlanarEffect | undefined;
    /**
     * Checks if a specific magic school is modified on the current plane.
     */
    static getMagicModifier(gameState: GameState, school: string): import("../../types/planes").MagicModifier;
    /**
     * Returns a description of the atmosphere for the current plane.
     * Useful for UI or flavor text.
     */
    static getAtmosphere(gameState: GameState): string;
    /**
     * Returns the time flow rate for the current plane.
     */
    static getTimeFlow(gameState: GameState): string;
}
