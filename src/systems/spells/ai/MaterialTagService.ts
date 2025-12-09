import { Position } from '../../../types/map';
import { GameState } from '../../../types';
import { BIOME_DATA } from '../../../constants';

/**
 * Service for tagging tiles/objects with materials based on biome and terrain.
 * Used by AISpellArbitrator to provide context for spells (e.g., "Meld into Stone").
 */
export class MaterialTagService {
    /**
     * Describes materials within a 5ft radius (1 tile) of the position.
     */
    static describeNearbyMaterials(
        position: Position,
        gameState: GameState
    ): string {
        // If we have a submap active, try to use its specific tile data
        // For now, we fallback to a heuristic based on the current Biome ID

        // Note: In a full implementation, this would look up `gameState.submap.tiles[x][y].terrainType`
        // Since we don't have direct access to the complex submap grid here easily without more imports,
        // we will use the global location context + biome.

        // TODO: Hook into actual Submap tile data when available in GameState
        const biomeId = gameState.currentLocation?.split('_')[0] || 'plains';
        const materials = this.inferMaterialsFromBiome(biomeId);

        return `Biome: ${biomeId}. Likely materials: ${materials.join(', ')}.`;
    }

    private static inferMaterialsFromBiome(biomeId: string): string[] {
        const normalizedId = biomeId.toLowerCase();

        if (normalizedId.includes('mountain') || normalizedId.includes('cave') || normalizedId.includes('dungeon')) {
            return ['Stone', 'Rock', 'Mineral', 'Dirt'];
        }
        if (normalizedId.includes('forest') || normalizedId.includes('woods')) {
            return ['Wood', 'Dirt', 'Plant Matter', 'Leaves'];
        }
        if (normalizedId.includes('ocean') || normalizedId.includes('lake') || normalizedId.includes('river')) {
            return ['Water', 'Sand', 'Mud'];
        }
        if (normalizedId.includes('desert')) {
            return ['Sand', 'Rock', 'Bone'];
        }
        if (normalizedId.includes('city') || normalizedId.includes('village')) {
            return ['Wood', 'Stone', 'Metal', 'Glass', 'Dirt'];
        }
        if (normalizedId.includes('swamp')) {
            return ['Mud', 'Water', 'Plant Matter', 'Rotting Wood'];
        }

        // Default
        return ['Dirt', 'Grass', 'Wood'];
    }
}
