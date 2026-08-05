import { RNG, NoiseGenerator } from '../utils/random';
import { Tile, Building, TownOptions } from '../types/realmsmith';
import { BiomeConfig } from '../data/realmsmithBiomes';
export declare class DoodadGenerator {
    private rng;
    private noise;
    private options;
    private biomeConfig;
    constructor(rng: RNG, noise: NoiseGenerator, options: TownOptions, biomeConfig: BiomeConfig);
    generateWalls(tiles: Tile[][], buildings: Building[]): void;
    placeDoodads(tiles: Tile[][]): void;
    placeStreetLamps(tiles: Tile[][]): void;
    decorateDeadEnds(tiles: Tile[][], buildings: Building[]): void;
}
