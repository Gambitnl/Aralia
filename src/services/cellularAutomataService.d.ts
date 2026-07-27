export type CaTileType = 'floor' | 'wall';
export declare class CellularAutomataGenerator {
    private random;
    private width;
    private height;
    private grid;
    constructor(width: number, height: number, seed: number);
    private initializeGrid;
    private getNeighborWallCount;
    private doSimulationStep;
    private getRegions;
    private ensureConnectivity;
    private connectRegions;
    private createPassage;
    generateMap(fillProbability?: number, simulationSteps?: number, wallThreshold?: number): CaTileType[][];
}
