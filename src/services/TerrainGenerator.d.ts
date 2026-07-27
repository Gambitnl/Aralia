import { NoiseGenerator } from '../utils/realmsmithRng';
import { Tile } from '../types/realmsmith';
import { BiomeConfig } from '../data/realmsmithBiomes';
export declare class TerrainGenerator {
    private noise;
    private biomeConfig;
    constructor(noise: NoiseGenerator, biomeConfig: BiomeConfig);
    generate(tiles: Tile[][]): void;
}
