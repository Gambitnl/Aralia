import { BiomeType } from '../../types/realmsmith';

export const TOWN_TILE_SIZE_PX = 32;
export const MOVEMENT_DURATION_MS = 150;
export const CAMERA_LERP_FACTOR = 0.15;
export const DRAG_THRESHOLD_PX = 3;

export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const mapTownBiome = (biome: string): BiomeType => {
    switch (biome) {
        case 'plains':
            return BiomeType.PLAINS;
        case 'forest':
            return BiomeType.FOREST;
        case 'mountain':
            return BiomeType.MOUNTAIN;
        case 'hills':
            return BiomeType.HIGHLANDS;
        case 'desert':
            return BiomeType.DESERT;
        case 'swamp':
            return BiomeType.SWAMP;
        case 'ocean':
            return BiomeType.COASTAL;
        case 'cave':
            return BiomeType.CRYSTAL_WASTES;
        case 'dungeon':
            return BiomeType.DEAD_LANDS;
        default:
            return BiomeType.PLAINS;
    }
};
