import { BiomeType } from '../../../types/realmsmith';

export interface BiomeColors {
    grassHue: number;
    waterColor: string;
    waterDeepColor: string;
    roofOverride: string | null;
    wallOverride: string | null;
}

export function getBiomeColors(biome: BiomeType): BiomeColors {
    // TODO: Move biome palette values into shared map config/data so painter and generator stay in sync and designers can tune in one place.
    // Default palette
    let grassHue = 100; // Green
    let waterColor = '#3b82f6';
    let waterDeepColor = '#1e3a8a';
    let roofOverride: string | null = null;
    let wallOverride: string | null = null;

    switch (biome) {
        case BiomeType.SWAMP: grassHue = 60; waterColor = '#4d7c0f'; waterDeepColor = '#3f6212'; roofOverride = '#365314'; break; // Yellow-green, murky
        case BiomeType.SAVANNA: grassHue = 45; break; // Gold/Yellow
        case BiomeType.AUTUMN_FOREST: grassHue = 30; break; // Orange
        case BiomeType.JUNGLE: grassHue = 130; waterColor = '#06b6d4'; break; // Deep Green, Cyan water
        case BiomeType.MUSHROOM_FOREST: grassHue = 260; waterColor = '#8b5cf6'; waterDeepColor = '#5b21b6'; break; // Purple
        case BiomeType.BADLANDS: grassHue = 20; break; // Reddish
        case BiomeType.CHERRY_BLOSSOM: grassHue = 90; break; // Fresh green
        case BiomeType.HIGHLANDS: grassHue = 110; break;
        case BiomeType.VOLCANIC: waterColor = '#ef4444'; waterDeepColor = '#7f1d1d'; break; // Lava colors handled in renderer usually, but fallback
        case BiomeType.CRYSTAL_WASTES: waterColor = '#67e8f9'; waterDeepColor = '#0e7490'; break;
        case BiomeType.DEAD_LANDS: grassHue = 30; waterColor = '#57534e'; waterDeepColor = '#292524'; break; // Desaturated brown
    }
    return { grassHue, waterColor, waterDeepColor, roofOverride, wallOverride };
}
