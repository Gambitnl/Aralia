import { Position, GameState, MapTile } from '../../../types';
import { getSubmapTileInfo } from '../../../utils/submapUtils';
import { SUBMAP_DIMENSIONS } from '../../../config/mapConfig';

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
        // Try to locate the player's current world map tile to get the correct seed/biome context
        let currentWorldTile: MapTile | null = null;
        if (gameState.mapData) {
            for (const row of gameState.mapData.tiles) {
                const found = row.find(t => t.isPlayerCurrent);
                if (found) {
                    currentWorldTile = found;
                    break;
                }
            }
        }

        // If we found the world tile, we can generate the specific submap tile data
        if (currentWorldTile && gameState.mapData) {
            const { x: worldX, y: worldY } = currentWorldTile;

            // Check if the requested position is within bounds of the submap
            if (position.x >= 0 && position.x < SUBMAP_DIMENSIONS.cols &&
                position.y >= 0 && position.y < SUBMAP_DIMENSIONS.rows) {

                const tileInfo = getSubmapTileInfo(
                    gameState.worldSeed,
                    { x: worldX, y: worldY },
                    currentWorldTile.biomeId,
                    SUBMAP_DIMENSIONS,
                    { x: position.x, y: position.y }
                );

                const materials = this.getMaterialsFromTerrainType(tileInfo.effectiveTerrainType, currentWorldTile.biomeId);
                return `Biome: ${currentWorldTile.biomeId}. Terrain: ${tileInfo.effectiveTerrainType}. Materials: ${materials.join(', ')}.`;
            }
        }

        // Fallback: Use global location context + biome if specific tile data is unavailable
        const biomeId = gameState.currentLocationId?.split('_')[0] || 'plains';
        const materials = this.inferMaterialsFromBiome(biomeId);

        return `Biome: ${biomeId} (Fallback). Likely materials: ${materials.join(', ')}.`;
    }

    private static getMaterialsFromTerrainType(terrainType: string, biomeId: string): string[] {
        // Specific terrain overrides
        switch (terrainType) {
            case 'water':
            case 'ocean':
            case 'pond':
            case 'murky_pool':
            case 'oasis':
                return ['Water'];
            case 'dense_forest':
            case 'small_copse':
            case 'small_forest_patch':
                return ['Wood', 'Plant Matter', 'Dirt'];
            case 'stone_area':
            case 'rocky_terrain':
            case 'mineral_area':
            case 'scattered_boulders':
            case 'rock_outcrop':
            case 'boulder_field':
            case 'rocky_mesa':
            case 'wall': // CA generated wall
                return ['Stone', 'Rock', 'Mineral'];
            case 'snowy_patch':
                return ['Snow', 'Ice', 'Water'];
            case 'village_area':
                return ['Wood', 'Stone', 'Processed Timber', 'Glass'];
            case 'campsite':
                return ['Dirt', 'Ash', 'Cloth', 'Wood'];
            case 'dense_reeds':
                return ['Plant Matter', 'Mud', 'Water'];
            case 'ruin_fragment':
            case 'ancient_stone_circle':
            case 'lone_monolith':
                return ['Stone', 'Ancient Masonry'];
            case 'dunes':
                return ['Sand'];
            case 'kelp':
                return ['Water', 'Plant Matter'];
            case 'reef':
                return ['Water', 'Coral', 'Stone'];
            case 'island':
                return ['Sand', 'Dirt', 'Stone'];
            case 'path':
            case 'path_adj':
                return ['Packed Dirt', 'Gravel'];
            case 'floor': // CA generated floor
                if (biomeId === 'cave') return ['Stone', 'Dust', 'Rock'];
                if (biomeId === 'dungeon') return ['Worked Stone', 'Flagstone'];
                break;
        }

        // If no specific terrain match, fall back to biome defaults
        return this.inferMaterialsFromBiome(biomeId);
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
