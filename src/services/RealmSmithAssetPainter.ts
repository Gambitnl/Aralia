import { Building, BiomeType, Tile, TileType } from '../types/realmsmith';
import { TownDirection } from '../types/town';
import { BuildingPainter } from './realmsmith/painters/BuildingPainter';
import { DoodadPainter } from './realmsmith/painters/DoodadPainter';
import { OverlayPainter } from './realmsmith/painters/OverlayPainter';
import { PlayerPainter } from './realmsmith/painters/PlayerPainter';
import { TilePainter } from './realmsmith/painters/TilePainter';
import { TILE_SIZE, roundedRect } from './realmsmith/painters/shared';

import { CharacterVisualConfig } from './CharacterAssetService';

export interface DrawOptions {
    isNight: boolean;
    showGrid: boolean;
    /** Player position for rendering (can include fractional values for animation) */
    playerPosition?: { x: number; y: number };
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
        colors: { skin: string; hair: string; clothing: string };
    }>;
}

export class AssetPainter {
    private ctx: CanvasRenderingContext2D;
    private tilePainter: TilePainter;
    private buildingPainter: BuildingPainter;
    private doodadPainter: DoodadPainter;
    private overlayPainter: OverlayPainter;
    private playerPainter: PlayerPainter;

    constructor(ctx: CanvasRenderingContext2D) {
        this.ctx = ctx;
        this.tilePainter = new TilePainter(ctx);
        this.buildingPainter = new BuildingPainter(ctx);
        this.doodadPainter = new DoodadPainter(ctx);
        this.overlayPainter = new OverlayPainter(ctx);
        this.playerPainter = new PlayerPainter(ctx);
    }

    public drawMap(tiles: Tile[][], buildings: Building[], biome: BiomeType, options: DrawOptions) {
        if (!tiles || tiles.length === 0) return;

        const width = tiles.length;
        const height = tiles[0].length;

        // TODO: Add a canvas render smoke test (e.g., node-canvas) to lock in pass ordering (ground→entrance→shadow→structure→walls→doodads→player→roof→lighting→grid) after the modular split.
        for (let x = 0; x < width; x++) {
            for (let y = 0; y < height; y++) {
                this.tilePainter.drawTileBase(tiles[x][y], x, y, tiles, biome);
            }
        }

        buildings.forEach(b => this.buildingPainter.drawEntrance(b, tiles));

        this.drawBuildingShadows(buildings);

        buildings.forEach(b => this.buildingPainter.drawBuildingStructure(b, biome));

        for (let x = 0; x < width; x++) {
            for (let y = 0; y < height; y++) {
                if (tiles[x][y].type === TileType.WALL) {
                    this.tilePainter.drawWall(x * TILE_SIZE, y * TILE_SIZE, tiles, x, y);
                }
            }
        }

        for (let x = 0; x < width; x++) {
            for (let y = 0; y < height; y++) {
                if (tiles[x][y].doodad) {
                    this.doodadPainter.drawDoodad(tiles[x][y], x, y, biome);
                }
            }
        }

        if (options.npcs) {
            options.npcs.forEach(npc => {
                const px = npc.x * TILE_SIZE;
                const py = npc.y * TILE_SIZE;
                this.playerPainter.drawPlayer(
                    px,
                    py,
                    npc.facing,
                    npc.isMoving,
                    undefined,
                    npc.colors
                );
            });
        }

        if (options.playerPosition) {
            const px = options.playerPosition.x * TILE_SIZE;
            const py = options.playerPosition.y * TILE_SIZE;
            this.playerPainter.drawPlayer(
                px,
                py,
                options.playerFacing || 'south',
                options.isMoving || false,
                options.playerVisuals
            );
        }

        const sortedBuildings = [...buildings].sort((a, b) => (a.y + a.height) - (b.y + b.height));
        sortedBuildings.forEach(b => this.buildingPainter.drawBuildingRoof(b, biome));

        if (options.isNight) {
            this.overlayPainter.drawNightOverlay(width, height, tiles, buildings);
        }

        if (options.showGrid) {
            this.overlayPainter.drawGrid(width, height);
        }
    }

    private drawBuildingShadows(buildings: Building[]) {
        this.ctx.globalAlpha = 0.25;
        this.ctx.fillStyle = '#000000';
        buildings.forEach(b => {
            this.ctx.beginPath();
            roundedRect(
                this.ctx,
                b.x * TILE_SIZE + 4,
                b.y * TILE_SIZE + 8,
                b.width * TILE_SIZE + 2,
                b.height * TILE_SIZE,
                4
            );
            this.ctx.fill();
        });
        this.ctx.globalAlpha = 1.0;
    }
}
