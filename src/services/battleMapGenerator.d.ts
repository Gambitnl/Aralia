/**
 * @file battleMapGenerator.ts
 * Service for procedurally generating battle maps.
 */
import { BattleMapData, BattleMapBiome } from '../types/combat';
export declare class BattleMapGenerator {
    private width;
    private height;
    private tiles;
    private targetableObjects;
    private random;
    private elevationNoise;
    constructor(width: number, height: number);
    generate(biome: BattleMapBiome, seed: number): BattleMapData;
    private generateBaseTerrain;
    private createBaseTile;
    private placeObstacles;
    private addObstacle;
    private registerGeneratedObstacleTarget;
    private removeGeneratedObstacleTarget;
    private ensureConnectivity;
    private getWalkableComponents;
    private carvePassage;
    private carveTile;
    private findClosestTiles;
}
