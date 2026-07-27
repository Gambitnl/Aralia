export type { VillagePersonality, VillageIntegrationProfile };
/**
 * Deterministic village generation pipeline.
 *
 * Steps:
 * 1. Seed an RNG using world coords + biome so the same tile always yields the same layout.
 * 2. Roll a "personality" profile that influences population and wealth distributions.
 * 3. Carve axial roads and winding side streets to avoid a strict grid.
 * 4. Stamp civic core (plaza + well + market + guard posts) near the centre.
 * 5. Place shops around the plaza with soft collision checks to keep lanes clear.
 * 6. Scatter houses outward with distance bias so outskirts feel residential.
 * 7. Return both a tile matrix and building footprints for hit-testing.
 */
type TerrainTileType = 'grass' | 'path' | 'dirt' | 'stone' | 'water' | 'trees';
type CivicTileType = 'plaza' | 'market' | 'well' | 'fountain' | 'statue' | 'guard_post' | 'watchtower' | 'gatehouse';
type ResidentialTileType = 'house_small' | 'house_medium' | 'house_large' | 'apartment' | 'manor' | 'estate';
type CommercialTileType = 'shop_blacksmith' | 'shop_general' | 'shop_tavern' | 'shop_temple' | 'inn' | 'bank' | 'guildhall' | 'stable';
type CulturalTileType = 'treehouse_small' | 'treehouse_large' | 'ancient_circle' | 'weaver_hall' | 'stone_hall_small' | 'stone_hall_large' | 'forge_temple' | 'underground_entrance' | 'hide_tent' | 'longhouse' | 'totem_pole' | 'war_memorial' | 'dock' | 'lighthouse' | 'shipwright' | 'fish_market' | 'magic_academy' | 'arcane_tower' | 'healers_hut' | 'alchemist_shop' | 'caravan_stop' | 'nomad_yurt' | 'trading_post' | 'shrine';
export type VillageTileType = TerrainTileType | CivicTileType | ResidentialTileType | CommercialTileType | CulturalTileType;
export interface VillageBuildingFootprint {
    id: string;
    type: VillageTileType;
    footprint: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    fill: string;
    accent: string;
    pattern?: 'stripe' | 'check' | 'dot';
}
import { VillagePersonality, VillageIntegrationProfile } from '../types';
export interface VillageLayout {
    width: number;
    height: number;
    tiles: VillageTileType[][];
    buildings: VillageBuildingFootprint[];
    personality: VillagePersonality;
    integrationProfile: VillageIntegrationProfile;
}
interface GenerationOptions {
    worldSeed: number;
    worldX: number;
    worldY: number;
    biomeId: string;
}
interface ExtendedGenerationOptions extends GenerationOptions {
    dominantRace?: string;
    isStartingSettlement?: boolean;
}
export declare const generateVillageLayout: ({ worldSeed, worldX, worldY, biomeId, dominantRace, isStartingSettlement }: ExtendedGenerationOptions) => VillageLayout;
/**
 * Helper that produces a building info object for UI layers based on tile
 * content. Canvas hit-testing in the VillageScene asks the generator for the
 * top-most building that occupies a tile so interactions stay deterministic.
 */
export declare const findBuildingAt: (layout: VillageLayout, x: number, y: number) => VillageBuildingFootprint | undefined;
/**
 * Simple deterministic utility for choosing a description string without
 * requiring any additional type imports. This keeps the generator entirely
 * self-contained and usable by both UI and gameplay hooks.
 */
export declare const describeBuilding: (building: VillageBuildingFootprint, personality: VillagePersonality) => string;
