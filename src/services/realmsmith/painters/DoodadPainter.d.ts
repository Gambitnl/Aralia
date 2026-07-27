import { BiomeType, Tile } from '../../../types/realmsmith';
export declare class DoodadPainter {
    private ctx;
    constructor(ctx: CanvasRenderingContext2D);
    drawDoodad(tile: Tile, x: number, y: number, _biome: BiomeType): void;
    private drawTree;
    private drawPine;
    private drawWillow;
    private drawPalm;
    private drawDeadTree;
    private drawMushroomTree;
    private drawCactus;
    private drawBush;
    private drawRock;
    private drawStump;
    private drawWell;
    private drawCrate;
    private drawBarrel;
    private drawLamp;
    private drawTombstone;
    private drawCrystal;
    private drawCrop;
    private drawPumpkin;
}
