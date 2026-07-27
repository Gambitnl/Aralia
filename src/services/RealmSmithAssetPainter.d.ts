import { Building, BiomeType, Tile } from '../types/realmsmith';
import { TownDirection } from '../types/town';
import { CharacterVisualConfig } from './CharacterAssetService';
export interface DrawOptions {
    isNight: boolean;
    showGrid: boolean;
    /** Player position for rendering (can include fractional values for animation) */
    playerPosition?: {
        x: number;
        y: number;
    };
    /** Direction the player is facing */
    playerFacing?: TownDirection;
    /** Whether the player is currently moving (for walk animation) */
    isMoving?: boolean;
    /** Visual customization for the player character */
    playerVisuals?: CharacterVisualConfig;
    /** Ambient NPCs to render */
    npcs?: Array<{
        x: number;
        y: number;
        facing: TownDirection;
        isMoving: boolean;
        colors: {
            skin: string;
            hair: string;
            clothing: string;
        };
    }>;
}
export declare class AssetPainter {
    private ctx;
    private tilePainter;
    private buildingPainter;
    private doodadPainter;
    private overlayPainter;
    private playerPainter;
    constructor(ctx: CanvasRenderingContext2D);
    drawMap(tiles: Tile[][], buildings: Building[], biome: BiomeType, options: DrawOptions): void;
    private drawBuildingShadows;
}
