import { RNG, NoiseGenerator } from '../utils/realmsmithRng';
import { Tile, TownOptions } from '../types/realmsmith';
export declare class RoadGenerator {
    private rng;
    private noise;
    private options;
    constructor(rng: RNG, noise: NoiseGenerator, options: TownOptions);
    generatePlaza(tiles: Tile[][], center: {
        x: number;
        y: number;
    }): void;
    generateRoads(tiles: Tile[][], center: {
        x: number;
        y: number;
    }): void;
    private setRoadTile;
    private tryBuildBridge;
    private createRingRoad;
    private createDock;
    private createStreet;
}
