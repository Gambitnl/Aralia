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
import { Position, GameState } from '../../../types';
/**
 * Service for tagging tiles/objects with materials based on biome and terrain.
 * Used by AISpellArbitrator to provide context for spells (e.g., "Meld into Stone").
 *
 * The wording returned by this service is part of the AI safety boundary for
 * spells: concrete submap tiles can be described as local facts, but biome-only
 * fallback must stay clearly uncertain so an AI ruling does not overclaim that
 * a guessed material is actually present under the caster.
 */
export declare class MaterialTagService {
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
    static describeNearbyMaterials(position: Position, gameState: GameState): string;
    /**
     * Map a cell-native `LocalTerrain` material to a spell terrain-type key that
     * {@link getMaterialsFromTerrainType} understands. `grass`/`dirt` have no
     * specific override there, so they resolve to biome-appropriate defaults.
     */
    private static terrainTypeFromLocalMaterial;
    private static getMaterialsFromTerrainType;
    private static inferMaterialsFromBiome;
}
