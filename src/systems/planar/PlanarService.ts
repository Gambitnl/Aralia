
import {
    getPlane,
    PLANES,
    MATERIAL_PLANE
} from '../../data/planes';
import { Plane, PlanarEffect } from '../../types/planes';
import { GameState } from '../../types/index';
import { logger } from '../../utils/logger';

/**
 * Service to manage planar mechanics, effect retrieval, and plane transitions.
 */
export class PlanarService {

    /**
     * Retrieves the current plane definition based on the GameState.
     * Defaults to Material Plane if not found.
     */
    static getCurrentPlane(gameState: GameState): Plane {
        // Look for the plane ID in the current location
        // Assuming gameState.currentLocationId -> lookup Location -> check .planeId
        // Since we don't have the Location object here, we rely on a property we might add to GameState
        // or a utility that resolves it.

        // For now, let's assume GameState might track `location.planeId` in the future.
        // As a fallback, we default to Material.

        // If we want to be robust, we'd need access to the location map.
        // Let's implement a heuristic: check if any location ID starts with 'fey_', 'shadow_', etc.
        // Or better, assume GameState has a helper or we just use Material for now until we integrate location data.

        // TODO: Integrate with Location system properly.
        // For this task, we will allow an explicit override or default.

        // Temporary: check if we are in a known planar ID directly (if stored in locationId for simple maps)
        if (gameState.currentLocationId.startsWith('feywild_')) return PLANES['feywild'] || MATERIAL_PLANE;
        if (gameState.currentLocationId.startsWith('shadowfell_')) return PLANES['shadowfell'] || MATERIAL_PLANE;
        if (gameState.currentLocationId.startsWith('hell_')) return PLANES['nine_hells'] || MATERIAL_PLANE;

        return getPlane('material') || MATERIAL_PLANE;
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
