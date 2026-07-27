import { BiomeType, Building, Tile } from '../../../types/realmsmith';
export declare class BuildingPainter {
    private ctx;
    constructor(ctx: CanvasRenderingContext2D);
    drawEntrance(b: Building, tiles: Tile[][]): void;
    drawBuildingStructure(b: Building, biome: BiomeType): void;
    drawBuildingRoof(b: Building, biome: BiomeType): void;
    private drawRoofTexture;
    private drawGableRoof;
    private drawHipRoof;
    private drawTowerRoof;
}
