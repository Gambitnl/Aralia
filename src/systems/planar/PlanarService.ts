
import {
    getPlane,
    MATERIAL_PLANE
} from '../../data/planes';
import { LOCATIONS } from '../../data/world/locations';
import { Plane, PlanarEffect } from '../../types/planes';
import { Location } from '../../types/world';
import { GameState } from '../../types/index';

/**
 * Service to manage planar mechanics, effect retrieval, and plane transitions.
 */
export class PlanarService {

    /**
     * Resolves the authoritative Location record for the current location id,
     * preferring runtime-generated locations over the static world map.
     */
    private static resolveCurrentLocation(gameState: GameState): Location | undefined {
        const id = gameState.currentLocationId;
        if (!id) return undefined;
        // Dynamic locations (procedurally generated / mutated at runtime) take
        // precedence over the static authored world map.
        return gameState.dynamicLocations?.[id] ?? LOCATIONS[id];
    }

    /**
     * Retrieves the current plane definition based on the GameState.
     *
     * Resolves the plane from authoritative location data (the location's
     * `planeId`), looking up the runtime `dynamicLocations` registry first and
     * then the static `LOCATIONS` map. Falls back to the Material Plane only
     * when the location, its `planeId`, or the referenced plane is genuinely
     * unknown.
     */
    static getCurrentPlane(gameState: GameState): Plane {
        const location = this.resolveCurrentLocation(gameState);
        // Location.planeId defaults to the Material Plane when unset.
        const planeId = location?.planeId ?? 'material';
        return getPlane(planeId) || MATERIAL_PLANE;
    }

    /**
     * Gets the mechanical effects active on the current plane.
     */
    static getCurrentPlanarEffects(gameState: GameState): PlanarEffect | undefined {
        const plane = this.getCurrentPlane(gameState);
        return plane.effects;
    }

    /**
     * Checks if a specific magic school is modified on the current plane.
     */
    static getMagicModifier(gameState: GameState, school: string) {
        const effects = this.getCurrentPlanarEffects(gameState);
        if (!effects || !effects.affectsMagic) return null;

        return effects.affectsMagic.find(m => m.school === school);
    }

    /**
     * Returns a description of the atmosphere for the current plane.
     * Useful for UI or flavor text.
     */
    static getAtmosphere(gameState: GameState): string {
        const plane = this.getCurrentPlane(gameState);
        return plane.atmosphereDescription;
    }

    /**
     * Returns the time flow rate for the current plane.
     */
    static getTimeFlow(gameState: GameState): string {
        const plane = this.getCurrentPlane(gameState);
        return plane.timeFlow;
    }
}
