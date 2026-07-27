import { TownMap, TownOptions } from '../types/realmsmith';
export declare class TownGenerator {
    private rng;
    private noise;
    private options;
    private biomeConfig;
    constructor(options: TownOptions);
    generate(): TownMap;
    private generateTerrain;
    private generatePlaza;
    private generateRoads;
    private placeBuildings;
    private attachFieldsToFarms;
    private generateWalls;
    private placeDoodads;
    private placeStreetLamps;
    private decorateDeadEnds;
}
