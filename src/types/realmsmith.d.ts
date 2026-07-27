export declare enum TileType {
    WATER_DEEP = "WATER_DEEP",
    WATER_SHALLOW = "WATER_SHALLOW",
    GRASS = "GRASS",
    SAND = "SAND",
    DIRT = "DIRT",
    MUD = "MUD",
    SNOW = "SNOW",
    ICE = "ICE",
    ASH = "ASH",
    LAVA = "LAVA",
    ROCK_GROUND = "ROCK_GROUND",
    CRYSTAL_FLOOR = "CRYSTAL_FLOOR",
    ROAD_MAIN = "ROAD_MAIN",
    ROAD_DIRT = "ROAD_DIRT",
    BRIDGE = "BRIDGE",
    BUILDING_FLOOR = "BUILDING_FLOOR",
    WALL = "WALL",
    EMPTY = "EMPTY",
    DOCK = "DOCK",
    FARM = "FARM"
}
export declare enum BuildingType {
    HOUSE_SMALL = "HOUSE_SMALL",
    HOUSE_LARGE = "HOUSE_LARGE",
    TAVERN = "TAVERN",
    BLACKSMITH = "BLACKSMITH",
    MARKET_STALL = "MARKET_STALL",
    CHURCH = "CHURCH",
    TEMPLE = "TEMPLE",
    TOWER = "TOWER",
    MANOR = "MANOR",
    FARM_HOUSE = "FARM_HOUSE",
    LIBRARY = "LIBRARY",
    ALCHEMIST = "ALCHEMIST",
    BARRACKS = "BARRACKS",
    WINDMILL = "WINDMILL",
    LUMBER_MILL = "LUMBER_MILL",
    GUILD_HALL = "GUILD_HALL",
    STABLE = "STABLE",
    GRANARY = "GRANARY",
    SHRINE = "SHRINE",
    SCHOOL = "SCHOOL",
    BAKERY = "BAKERY",
    TAILOR = "TAILOR",
    JEWELER = "JEWELER"
}
export declare enum DoodadType {
    TREE_OAK = "TREE_OAK",
    TREE_PINE = "TREE_PINE",
    TREE_PALM = "TREE_PALM",
    TREE_DEAD = "TREE_DEAD",
    BUSH = "BUSH",
    ROCK = "ROCK",
    WELL = "WELL",
    CRATE = "CRATE",
    CACTUS = "CACTUS",
    MUSHROOM = "MUSHROOM",
    CRYSTAL = "CRYSTAL",
    STUMP = "STUMP",
    CROP_WHEAT = "CROP_WHEAT",
    CROP_CORN = "CROP_CORN",
    CROP_PUMPKIN = "CROP_PUMPKIN",
    TREE_WILLOW = "TREE_WILLOW",
    TREE_CHERRY = "TREE_CHERRY",
    TREE_AUTUMN = "TREE_AUTUMN",
    TREE_MUSHROOM = "TREE_MUSHROOM",
    BARREL = "BARREL",
    STREET_LAMP = "STREET_LAMP",
    TOMBSTONE = "TOMBSTONE"
}
export declare enum BiomeType {
    PLAINS = "PLAINS",
    FOREST = "FOREST",
    DESERT = "DESERT",
    TUNDRA = "TUNDRA",
    TAIGA = "TAIGA",
    SWAMP = "SWAMP",
    JUNGLE = "JUNGLE",
    SAVANNA = "SAVANNA",
    BADLANDS = "BADLANDS",
    MOUNTAIN = "MOUNTAIN",
    VOLCANIC = "VOLCANIC",
    OASIS = "OASIS",
    COASTAL = "COASTAL",
    MUSHROOM_FOREST = "MUSHROOM_FOREST",
    CRYSTAL_WASTES = "CRYSTAL_WASTES",
    AUTUMN_FOREST = "AUTUMN_FOREST",
    CHERRY_BLOSSOM = "CHERRY_BLOSSOM",
    GLACIER = "GLACIER",
    DEAD_LANDS = "DEAD_LANDS",
    HIGHLANDS = "HIGHLANDS"
}
export declare enum TownDensity {
    VERY_SPARSE = "VERY_SPARSE",
    SPARSE = "SPARSE",
    MEDIUM = "MEDIUM",
    HIGH = "HIGH",
    EXTREME = "EXTREME"
}
export declare enum RoofStyle {
    THATCHED = "THATCHED",
    TILED = "TILED",
    SLATE = "SLATE",
    METAL = "METAL"
}
export declare enum WallTexture {
    TIMBER_FRAME = "TIMBER_FRAME",
    STONE = "STONE",
    STUCCO = "STUCCO",
    WOOD = "WOOD"
}
export interface TownOptions {
    seed: number;
    biome: BiomeType;
    density: TownDensity;
    connections: {
        north: boolean;
        east: boolean;
        south: boolean;
        west: boolean;
    };
}
export interface Tile {
    x: number;
    y: number;
    type: TileType;
    variation: number;
    elevation: number;
    roadConnections?: number;
    buildingId?: string;
    doodad?: {
        type: DoodadType;
        id: string;
        offsetX: number;
        offsetY: number;
    };
}
export interface Building {
    id: string;
    type: BuildingType;
    x: number;
    y: number;
    width: number;
    height: number;
    doorX: number;
    doorY: number;
    color: string;
    roofColor: string;
    roofStyle: RoofStyle;
    wallTexture: WallTexture;
}
export interface TownMap {
    width: number;
    height: number;
    tiles: Tile[][];
    buildings: Building[];
    seed: number;
    biome: BiomeType;
}
