import { Building, Tile } from '../../../types/realmsmith';
export declare class OverlayPainter {
    private ctx;
    constructor(ctx: CanvasRenderingContext2D);
    drawNightOverlay(width: number, height: number, tiles: Tile[][], buildings: Building[]): void;
    drawGrid(width: number, height: number): void;
}
