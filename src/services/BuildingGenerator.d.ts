import { RNG, NoiseGenerator } from '../utils/realmsmithRng';
import { Tile, TileType, Building, DoodadType, TownOptions } from '../types/realmsmith';
import { BiomeConfig } from '../data/realmsmithBiomes';
export declare class BuildingGenerator {
    private rng;
    private noise;
    private options;
    private biomeConfig;
    constructor(rng: RNG, noise: NoiseGenerator, options: TownOptions, biomeConfig: BiomeConfig);
    placeBuildings(tiles: Tile[][], center: {
        x: number;
        y: number;
    }): Building[];
    canBuild(tiles: Tile[][], x: number, y: number, w: number, h: number): boolean;
    private createBuilding;
    attachFieldsToFarms(tiles: Tile[][], buildings: Building[]): void;
    private canPlaceFarm;
    private createFarmField;
    placeWorkshopHut(tiles: Tile[][], buildings: Building[], cx: number, cy: number): void;
    scatterDoodads(tiles: Tile[][], cx: number, cy: number, radius: number, types: DoodadType[], count: number): void;
    createClearing(tiles: Tile[][], cx: number, cy: number, radius: number, type: TileType): void;
}
