import { BiomeType, Tile } from '../../../types/realmsmith';
export declare class TilePainter {
    private ctx;
    constructor(ctx: CanvasRenderingContext2D);
    drawTileBase(tile: Tile, x: number, y: number, grid: Tile[][], biome: BiomeType): void;
    drawWall(x: number, y: number, grid: Tile[][], gx: number, gy: number): void;
    private drawFarm;
    private drawWater;
    private drawLava;
    private drawGrass;
    private drawSand;
    private drawDirt;
    private drawMud;
    private drawSnow;
    private drawIce;
    private drawAsh;
    private drawRockGround;
    private drawCrystalFloor;
    private drawCobblestone;
    private drawDirtRoad;
    private drawDock;
    private drawBridge;
}
