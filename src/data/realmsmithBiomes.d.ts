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
export declare const BIOME_DATA: Record<BiomeType, BiomeConfig>;
