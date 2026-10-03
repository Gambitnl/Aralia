/**
 * @file src/rendering2d/biomePalette.ts
 * The biome color table for the 2D map painters.
 *
 * Salvaged from the RealmSmith BiomePalette (retired 2026-09-14).
 * The source used a switch statement. This file uses a plain table.
 * A table is easier to read. A table is also easier to extend.
 *
 * Intended consumer: the next-gen 2D combat map (Pixi prototype, ?pixiboard=1).
 */

/** The colors that one biome gives to the 2D painters. */
export interface BiomeColors {
    /** The hue of the ground grass, in degrees from 0 to 360. */
    grassHue: number;
    /** The color of shallow water. */
    waterColor: string;
    /** The color of deep water. */
    waterDeepColor: string;
    /** A roof color that replaces the building roof color. Null keeps the building color. */
    roofOverride: string | null;
    /** A wall color that replaces the building wall color. Null keeps the building color. */
    wallOverride: string | null;
}

/** The colors for a biome that the table does not name. */
export const DEFAULT_BIOME_COLORS: BiomeColors = {
    grassHue: 100,
    waterColor: '#3b82f6',
    waterDeepColor: '#1e3a8a',
    roofOverride: null,
    wallOverride: null,
};

/** The name of every biome in the table. */
export type BiomeName =
    | 'PLAINS'
    | 'FOREST'
    | 'DESERT'
    | 'TUNDRA'
    | 'TAIGA'
    | 'SWAMP'
    | 'JUNGLE'
    | 'SAVANNA'
    | 'BADLANDS'
    | 'MOUNTAIN'
    | 'VOLCANIC'
    | 'OASIS'
    | 'COASTAL'
    | 'MUSHROOM_FOREST'
    | 'CRYSTAL_WASTES'
    | 'AUTUMN_FOREST'
    | 'CHERRY_BLOSSOM'
    | 'GLACIER'
    | 'DEAD_LANDS'
    | 'HIGHLANDS';

/**
 * The color of every biome.
 * A biome that uses the default colors still has a row.
 * An explicit row makes the table complete and self-documenting.
 */
export const BIOME_PALETTE: Record<BiomeName, BiomeColors> = {
    PLAINS: { ...DEFAULT_BIOME_COLORS },
    FOREST: { ...DEFAULT_BIOME_COLORS },
    DESERT: { ...DEFAULT_BIOME_COLORS },
    TUNDRA: { ...DEFAULT_BIOME_COLORS },
    TAIGA: { ...DEFAULT_BIOME_COLORS },
    OASIS: { ...DEFAULT_BIOME_COLORS },
    COASTAL: { ...DEFAULT_BIOME_COLORS },
    MOUNTAIN: { ...DEFAULT_BIOME_COLORS },
    GLACIER: { ...DEFAULT_BIOME_COLORS },

    // Murky yellow-green water and dark roofs.
    SWAMP: {
        grassHue: 60,
        waterColor: '#4d7c0f',
        waterDeepColor: '#3f6212',
        roofOverride: '#365314',
        wallOverride: null,
    },
    // Dry gold grass.
    SAVANNA: { ...DEFAULT_BIOME_COLORS, grassHue: 45 },
    // Orange leaf litter.
    AUTUMN_FOREST: { ...DEFAULT_BIOME_COLORS, grassHue: 30 },
    // Deep green ground and cyan water.
    JUNGLE: { ...DEFAULT_BIOME_COLORS, grassHue: 130, waterColor: '#06b6d4' },
    // Purple ground and purple water.
    MUSHROOM_FOREST: {
        grassHue: 260,
        waterColor: '#8b5cf6',
        waterDeepColor: '#5b21b6',
        roofOverride: null,
        wallOverride: null,
    },
    // Red rock dust.
    BADLANDS: { ...DEFAULT_BIOME_COLORS, grassHue: 20 },
    // Fresh spring green.
    CHERRY_BLOSSOM: { ...DEFAULT_BIOME_COLORS, grassHue: 90 },
    // Cool upland green.
    HIGHLANDS: { ...DEFAULT_BIOME_COLORS, grassHue: 110 },
    // Lava stands in for water.
    VOLCANIC: { ...DEFAULT_BIOME_COLORS, waterColor: '#ef4444', waterDeepColor: '#7f1d1d' },
    // Bright crystal water.
    CRYSTAL_WASTES: { ...DEFAULT_BIOME_COLORS, waterColor: '#67e8f9', waterDeepColor: '#0e7490' },
    // Gray-brown ground and gray water.
    DEAD_LANDS: {
        grassHue: 30,
        waterColor: '#57534e',
        waterDeepColor: '#292524',
        roofOverride: null,
        wallOverride: null,
    },
};

/** The names of every biome, in table order. */
export const BIOME_NAMES = Object.keys(BIOME_PALETTE) as BiomeName[];

/**
 * Returns the colors of one biome.
 * Returns the default colors if the table does not have the biome.
 */
export function getBiomeColors(biome: string): BiomeColors {
    return BIOME_PALETTE[biome as BiomeName] ?? DEFAULT_BIOME_COLORS;
}
