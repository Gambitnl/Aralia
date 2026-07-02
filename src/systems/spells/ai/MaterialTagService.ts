// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/06/2026, 11:30:55
 * Dependents: systems/spells/ai/AISpellArbitrator.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { Position, GameState } from '../../../types';
import { BATTLE_MAP_DIMENSIONS } from '../../../config/mapConfig';
import { biomeIdForCell } from '../../worldforge/local/biomeForCell';
import { getWorldforgeLocalForCell } from '../../worldforge/bridge/legacySubmapBridge';
import { LOCALE_CELL_FT } from '../../worldforge/local/localePosition';
import type { TerrainMaterial } from '../../worldforge/artifacts';

/**
 * Service for tagging tiles/objects with materials based on biome and terrain.
 * Used by AISpellArbitrator to provide context for spells (e.g., "Meld into Stone").
 *
 * The wording returned by this service is part of the AI safety boundary for
 * spells: concrete submap tiles can be described as local facts, but biome-only
 * fallback must stay clearly uncertain so an AI ruling does not overclaim that
 * a guessed material is actually present under the caster.
 */
export class MaterialTagService {
    /**
     * Describes materials within a 5ft radius (1 tile) of the position.
     *
     * Grid retirement (slice 4b): the caster's local material is sampled from the
     * CELL-NATIVE local terrain — `getWorldforgeLocalForCell` builds the parent-cell
     * -inheriting `LocalTerrain.materialIndex` (height from the region heightfield +
     * biome-driven surface classification) on demand from just (worldSeed, cellId),
     * both in GameState. This replaces the retired 30x20 `SUBMAP_DIMENSIONS` grid +
     * `getSubmapTileInfo`. The caster's Locale-feet position (`playerCell.localeCoords`,
     * feet from the ground window's NW origin, 5ft cells) locates them in that
     * terrain; their tactical battle-map offset (also 5ft cells, relative to the map
     * centre) refines it per-combatant.
     */
    static describeNearbyMaterials(
        position: Position,
        gameState: GameState
    ): string {
        const cellId = gameState.playerCell?.cellId;
        if (cellId != null) {
            const biomeId = biomeIdForCell(gameState.worldSeed ?? 0, cellId) ?? 'plains';
            const { local } = getWorldforgeLocalForCell(gameState.worldSeed ?? 0, cellId);
            const { widthCells, heightCells, materialIndex, materials } = local.terrain;

            // Base cell: the caster's Locale-feet position (feet from the window's
            // NW origin, LOCALE_CELL_FT per cell). Null before a ground session
            // engages → sample the window centre (the cell the window frames).
            const feet = gameState.playerCell?.localeCoords;
            let cx = feet ? Math.floor(feet.x / LOCALE_CELL_FT) : Math.floor(widthCells / 2);
            let cy = feet ? Math.floor(feet.y / LOCALE_CELL_FT) : Math.floor(heightCells / 2);

            // Tactical offset: a battle-map tile is 5ft = one local cell, so a
            // combatant's position relative to the map centre nudges the sample so
            // casters standing on different ground read different materials.
            if (position) {
                cx += position.x - Math.floor(BATTLE_MAP_DIMENSIONS.width / 2);
                cy += position.y - Math.floor(BATTLE_MAP_DIMENSIONS.height / 2);
            }
            cx = Math.max(0, Math.min(widthCells - 1, cx));
            cy = Math.max(0, Math.min(heightCells - 1, cy));

            const material = materials[materialIndex[cy * widthCells + cx]];
            const terrainType = MaterialTagService.terrainTypeFromLocalMaterial(material);
            const mats = this.getMaterialsFromTerrainType(terrainType, biomeId);
            return `Verified local material context. Biome: ${biomeId}. Terrain: ${material}. Materials present here: ${mats.join(', ')}.`;
        }

        // Fallback: global location context + biome when no cell is resolved (e.g.
        // pre-spawn / menu). Stays clearly uncertain — part of the AI safety boundary.
        const biomeId = gameState.currentLocationId?.split('_')[0] || 'plains';
        const materials = this.inferMaterialsFromBiome(biomeId);

        return `Inferred biome fallback only; no verified local tile material is available. Biome guess: ${biomeId}. Possible materials nearby, not confirmed at the target point: ${materials.join(', ')}.`;
    }

    /**
     * Map a cell-native `LocalTerrain` material to a spell terrain-type key that
     * {@link getMaterialsFromTerrainType} understands. `grass`/`dirt` have no
     * specific override there, so they resolve to biome-appropriate defaults.
     */
    private static terrainTypeFromLocalMaterial(material: TerrainMaterial): string {
        switch (material) {
            case 'water': return 'water';
            case 'rock': return 'rocky_terrain';
            case 'sand': return 'dunes';
            case 'wetland': return 'dense_reeds';
            case 'paved': return 'path';
            case 'floor': return 'floor';
            case 'grass':
            case 'dirt':
            default: return material;
        }
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

        // Glacier before mountain: 'mountain_glacier' should read icy, not rocky.
        if (normalizedId.includes('glacier') || normalizedId.includes('snow') || normalizedId.includes('ice')) {
            return ['Ice', 'Snow', 'Stone'];
        }
        if (normalizedId.includes('mountain') || normalizedId.includes('cave') || normalizedId.includes('dungeon')) {
            return ['Stone', 'Rock', 'Mineral', 'Dirt'];
        }
        if (normalizedId.includes('tundra') || normalizedId.includes('permafrost')) {
            return ['Frozen Earth', 'Stone', 'Lichen', 'Ice'];
        }
        if (normalizedId.includes('jungle')) {
            return ['Wood', 'Plant Matter', 'Vines', 'Dirt'];
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
