import { TileType, DoodadType, BiomeType } from '../types/realmsmith';

export interface BiomeConfig {
    ground: TileType;
    beach: TileType;
    waterDeep: TileType;
    waterShallow: TileType;
    treeDensity: number;
    rockDensity: number;
    trees: DoodadType[];
    secondaryDoodads: DoodadType[];
    elevationOffset: number;
}

// Configuration table for all 20 biomes
export const BIOME_DATA: Record<BiomeType, BiomeConfig> = {
    [BiomeType.PLAINS]: { ground: TileType.GRASS, beach: TileType.SAND, waterDeep: TileType.WATER_DEEP, waterShallow: TileType.WATER_SHALLOW, treeDensity: 0.4, rockDensity: 0.01, trees: [DoodadType.TREE_OAK], secondaryDoodads: [DoodadType.BUSH], elevationOffset: 0 },
    [BiomeType.FOREST]: { ground: TileType.GRASS, beach: TileType.SAND, waterDeep: TileType.WATER_DEEP, waterShallow: TileType.WATER_SHALLOW, treeDensity: 0.3, rockDensity: 0.02, trees: [DoodadType.TREE_OAK, DoodadType.TREE_PINE], secondaryDoodads: [DoodadType.BUSH, DoodadType.STUMP], elevationOffset: 0 },
    [BiomeType.DESERT]: { ground: TileType.SAND, beach: TileType.SAND, waterDeep: TileType.WATER_DEEP, waterShallow: TileType.WATER_SHALLOW, treeDensity: 0.95, rockDensity: 0.05, trees: [DoodadType.CACTUS], secondaryDoodads: [DoodadType.ROCK], elevationOffset: 0.05 },
    [BiomeType.TUNDRA]: { ground: TileType.SNOW, beach: TileType.DIRT, waterDeep: TileType.ICE, waterShallow: TileType.ICE, treeDensity: 0.7, rockDensity: 0.03, trees: [DoodadType.TREE_PINE], secondaryDoodads: [DoodadType.ROCK], elevationOffset: 0 },
    [BiomeType.TAIGA]: { ground: TileType.SNOW, beach: TileType.DIRT, waterDeep: TileType.WATER_DEEP, waterShallow: TileType.ICE, treeDensity: 0.25, rockDensity: 0.03, trees: [DoodadType.TREE_PINE], secondaryDoodads: [DoodadType.STUMP], elevationOffset: 0.1 },
    [BiomeType.SWAMP]: { ground: TileType.MUD, beach: TileType.MUD, waterDeep: TileType.WATER_DEEP, waterShallow: TileType.WATER_SHALLOW, treeDensity: 0.3, rockDensity: 0.02, trees: [DoodadType.TREE_OAK], secondaryDoodads: [DoodadType.BUSH], elevationOffset: -0.15 },
    [BiomeType.JUNGLE]: { ground: TileType.GRASS, beach: TileType.MUD, waterDeep: TileType.WATER_DEEP, waterShallow: TileType.WATER_SHALLOW, treeDensity: 0.2, rockDensity: 0.04, trees: [DoodadType.TREE_PALM, DoodadType.TREE_OAK], secondaryDoodads: [DoodadType.BUSH], elevationOffset: 0 },
    [BiomeType.SAVANNA]: { ground: TileType.GRASS, beach: TileType.DIRT, waterDeep: TileType.WATER_DEEP, waterShallow: TileType.WATER_SHALLOW, treeDensity: 0.7, rockDensity: 0.05, trees: [DoodadType.TREE_OAK], secondaryDoodads: [DoodadType.ROCK], elevationOffset: 0.05 },
    [BiomeType.BADLANDS]: { ground: TileType.DIRT, beach: TileType.SAND, waterDeep: TileType.WATER_DEEP, waterShallow: TileType.WATER_SHALLOW, treeDensity: 0.95, rockDensity: 0.15, trees: [DoodadType.TREE_DEAD], secondaryDoodads: [DoodadType.ROCK, DoodadType.CACTUS], elevationOffset: 0.1 },
    [BiomeType.MOUNTAIN]: { ground: TileType.ROCK_GROUND, beach: TileType.DIRT, waterDeep: TileType.WATER_DEEP, waterShallow: TileType.WATER_SHALLOW, treeDensity: 0.6, rockDensity: 0.2, trees: [DoodadType.TREE_PINE], secondaryDoodads: [DoodadType.ROCK], elevationOffset: 0.2 },
    [BiomeType.VOLCANIC]: { ground: TileType.ASH, beach: TileType.ROCK_GROUND, waterDeep: TileType.LAVA, waterShallow: TileType.LAVA, treeDensity: 0.9, rockDensity: 0.3, trees: [DoodadType.TREE_DEAD], secondaryDoodads: [DoodadType.ROCK], elevationOffset: 0.1 },
    [BiomeType.OASIS]: { ground: TileType.SAND, beach: TileType.GRASS, waterDeep: TileType.WATER_DEEP, waterShallow: TileType.WATER_SHALLOW, treeDensity: 0.8, rockDensity: 0.02, trees: [DoodadType.TREE_PALM], secondaryDoodads: [DoodadType.BUSH], elevationOffset: -0.1 }, // Bias to water
    [BiomeType.COASTAL]: { ground: TileType.SAND, beach: TileType.SAND, waterDeep: TileType.WATER_DEEP, waterShallow: TileType.WATER_SHALLOW, treeDensity: 0.6, rockDensity: 0.05, trees: [DoodadType.TREE_PALM], secondaryDoodads: [DoodadType.ROCK], elevationOffset: -0.15 },
    [BiomeType.MUSHROOM_FOREST]: { ground: TileType.MUD, beach: TileType.DIRT, waterDeep: TileType.WATER_DEEP, waterShallow: TileType.WATER_SHALLOW, treeDensity: 0.4, rockDensity: 0.05, trees: [DoodadType.MUSHROOM], secondaryDoodads: [DoodadType.CRYSTAL], elevationOffset: 0 },
    [BiomeType.CRYSTAL_WASTES]: { ground: TileType.CRYSTAL_FLOOR, beach: TileType.ROCK_GROUND, waterDeep: TileType.WATER_DEEP, waterShallow: TileType.ICE, treeDensity: 0.8, rockDensity: 0.3, trees: [DoodadType.CRYSTAL], secondaryDoodads: [DoodadType.ROCK], elevationOffset: 0 },
    [BiomeType.AUTUMN_FOREST]: { ground: TileType.GRASS, beach: TileType.DIRT, waterDeep: TileType.WATER_DEEP, waterShallow: TileType.WATER_SHALLOW, treeDensity: 0.3, rockDensity: 0.02, trees: [DoodadType.TREE_OAK], secondaryDoodads: [DoodadType.STUMP], elevationOffset: 0 },
    [BiomeType.CHERRY_BLOSSOM]: { ground: TileType.GRASS, beach: TileType.SAND, waterDeep: TileType.WATER_DEEP, waterShallow: TileType.WATER_SHALLOW, treeDensity: 0.35, rockDensity: 0.02, trees: [DoodadType.TREE_OAK], secondaryDoodads: [DoodadType.BUSH], elevationOffset: 0 },
    [BiomeType.GLACIER]: { ground: TileType.SNOW, beach: TileType.ICE, waterDeep: TileType.WATER_DEEP, waterShallow: TileType.ICE, treeDensity: 0.9, rockDensity: 0.1, trees: [DoodadType.ROCK], secondaryDoodads: [DoodadType.ROCK], elevationOffset: 0.05 },
    [BiomeType.DEAD_LANDS]: { ground: TileType.DIRT, beach: TileType.MUD, waterDeep: TileType.WATER_DEEP, waterShallow: TileType.WATER_SHALLOW, treeDensity: 0.5, rockDensity: 0.1, trees: [DoodadType.TREE_DEAD], secondaryDoodads: [DoodadType.STUMP], elevationOffset: 0 },
    [BiomeType.HIGHLANDS]: { ground: TileType.GRASS, beach: TileType.ROCK_GROUND, waterDeep: TileType.WATER_DEEP, waterShallow: TileType.WATER_SHALLOW, treeDensity: 0.8, rockDensity: 0.15, trees: [DoodadType.TREE_PINE], secondaryDoodads: [DoodadType.ROCK], elevationOffset: 0.2 },
};
