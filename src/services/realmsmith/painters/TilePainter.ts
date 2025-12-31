import { BiomeType, Tile, TileType } from '../../../types/realmsmith';
import { getBiomeColors } from './BiomePalette';
import { TILE_SIZE, roundedRect } from './shared';

export class TilePainter {
    constructor(private ctx: CanvasRenderingContext2D) {}

    public drawTileBase(tile: Tile, x: number, y: number, grid: Tile[][], biome: BiomeType) {
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;
        const colors = getBiomeColors(biome);

        this.ctx.save();

        switch (tile.type) {
            case TileType.WATER_DEEP:
            case TileType.WATER_SHALLOW:
                this.drawWater(px, py, tile, x, y, grid, colors.waterColor, colors.waterDeepColor);
                break;
            case TileType.LAVA:
                this.drawLava(px, py, tile);
                break;
            case TileType.GRASS:
                this.drawGrass(px, py, tile, colors.grassHue, biome === BiomeType.SAVANNA || biome === BiomeType.AUTUMN_FOREST ? 25 : 40);
                break;
            case TileType.SAND:
                this.drawSand(px, py, tile);
                break;
            case TileType.DIRT:
                this.drawDirt(px, py, tile);
                break;
            case TileType.MUD:
                this.drawMud(px, py, tile);
                break;
            case TileType.SNOW:
                this.drawSnow(px, py, tile);
                break;
            case TileType.ICE:
                this.drawIce(px, py, tile);
                break;
            case TileType.ASH:
                this.drawAsh(px, py, tile);
                break;
            case TileType.ROCK_GROUND:
                this.drawRockGround(px, py, tile);
                break;
            case TileType.CRYSTAL_FLOOR:
                this.drawCrystalFloor(px, py, tile);
                break;
            case TileType.ROAD_MAIN:
                this.drawCobblestone(px, py, tile);
                break;
            case TileType.ROAD_DIRT:
                this.drawDirtRoad(px, py, tile);
                break;
            case TileType.DOCK:
                this.drawWater(px, py, tile, x, y, grid, colors.waterColor, colors.waterDeepColor);
                this.drawDock(px, py, tile);
                break;
            case TileType.BRIDGE:
                this.drawWater(px, py, tile, x, y, grid, colors.waterColor, colors.waterDeepColor);
                this.drawBridge(px, py, tile, x, y, grid);
                break;
            case TileType.FARM:
                this.drawFarm(px, py, tile);
                break;
            case TileType.BUILDING_FLOOR:
                this.ctx.fillStyle = '#292524'; // Dark floor
                this.ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                break;
            case TileType.WALL:
                this.drawDirt(px, py, tile); // Draw base ground first so we don't see void
                break;
            default:
                this.ctx.fillStyle = '#0f172a';
                this.ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        }

        this.ctx.restore();
    }

    public drawWall(x: number, y: number, grid: Tile[][], gx: number, gy: number) {
        const h = TILE_SIZE;
        const w = TILE_SIZE;

        let _hasWallBelow = false;
        if (gy < grid[0].length - 1 && grid[gx][gy + 1].type === TileType.WALL) {
            // TODO(lint-intent): '_hasWallBelow' is declared but unused, suggesting an unfinished state/behavior hook in this block.
            // TODO(lint-intent): If the intent is still active, connect it to the nearby render/dispatch/condition so it matters.
            // TODO(lint-intent): Otherwise remove it or prefix with an underscore to record intentional unused state.
            _hasWallBelow = true;
        }

        this.ctx.fillStyle = '#57534e'; // Stone 600
        this.ctx.fillRect(x, y, w, h);

        this.ctx.fillStyle = '#78716c'; // Stone 500
        this.ctx.fillRect(x, y, w, 4);

        this.ctx.fillStyle = '#44403c';
        this.ctx.globalAlpha = 0.3;
        this.ctx.fillRect(x + 4, y + 4, 6, 6);
        this.ctx.fillRect(x + 16, y + 12, 8, 6);
        this.ctx.globalAlpha = 1.0;

        let hasWallAbove = false;
        if (gy > 0 && grid[gx][gy - 1].type === TileType.WALL) {
            hasWallAbove = true;
        }
        if (!hasWallAbove) {
            this.ctx.fillStyle = '#292524'; // Darker
            this.ctx.fillRect(x + 4, y + 4, 8, 8); // Merlon shadow

            this.ctx.fillStyle = '#78716c';
            this.ctx.fillRect(x, y - 4, 10, 4); // Merlon 1
            this.ctx.fillRect(x + 20, y - 4, 10, 4); // Merlon 2
        }
    }
    // TODO(lint-intent): 'tile' is an unused parameter, which suggests a planned input for this flow.
    // TODO(lint-intent): If the contract should consume it, thread it into the decision/transform path or document why it exists.
    // TODO(lint-intent): Otherwise rename it with a leading underscore or remove it if the signature can change.
    private drawFarm(x: number, y: number, _tile: Tile) {
        this.ctx.fillStyle = '#3f2e21';
        this.ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

        this.ctx.fillStyle = '#291d16';
        for (let i = 4; i < TILE_SIZE; i += 8) {
            this.ctx.fillRect(x, y + i, TILE_SIZE, 2);
        }
    }

    private drawWater(x: number, y: number, tile: Tile, gx: number, gy: number, grid: Tile[][], shallowColor: string, deepColor: string) {
        const isDeep = tile.type === TileType.WATER_DEEP;

        this.ctx.fillStyle = isDeep ? deepColor : shallowColor;
        this.ctx.fillRect(x, y, TILE_SIZE + 1, TILE_SIZE + 1);

        this.ctx.fillStyle = 'rgba(255,255,255,0.1)';
        if (tile.variation > 0.5) {
            this.ctx.fillRect(x + 2, y + 8, 12, 2);
        } else {
            this.ctx.fillRect(x + 10, y + 20, 14, 2);
        }
    }

    private drawLava(x: number, y: number, tile: Tile) {
        this.ctx.fillStyle = '#b91c1c'; // Red 700
        this.ctx.fillRect(x, y, TILE_SIZE + 1, TILE_SIZE + 1);

        this.ctx.fillStyle = '#ef4444'; // Red 500
        if (tile.variation > 0.5) {
            this.ctx.beginPath();
            this.ctx.arc(x + 8, y + 8, 6, 0, Math.PI * 2);
            this.ctx.fill();
        } else {
            this.ctx.beginPath();
            this.ctx.arc(x + 20, y + 20, 8, 0, Math.PI * 2);
            this.ctx.fill();
        }

        this.ctx.fillStyle = '#450a0a'; // Red 950
        this.ctx.globalAlpha = 0.6;
        this.ctx.fillRect(x + 2, y + 2, 4, 4);
        this.ctx.fillRect(x + 18, y + 12, 6, 4);
        this.ctx.globalAlpha = 1.0;
    }

    private drawGrass(x: number, y: number, tile: Tile, hue: number, sat: number) {
        const light = 35 + (tile.elevation * 10);
        this.ctx.fillStyle = `hsl(${hue}, ${sat}%, ${light}%)`;
        this.ctx.fillRect(x, y, TILE_SIZE + 1, TILE_SIZE + 1);

        if (tile.variation > 0.6) {
            this.ctx.strokeStyle = `hsl(${hue}, ${sat}%, ${light - 10}%)`;
            this.ctx.beginPath();
            this.ctx.moveTo(x + 8, y + 12);
            this.ctx.lineTo(x + 8, y + 8);
            this.ctx.stroke();
        }
    }

    private drawSand(x: number, y: number, tile: Tile) {
        this.ctx.fillStyle = '#fde68a';
        this.ctx.fillRect(x, y, TILE_SIZE + 1, TILE_SIZE + 1);
        this.ctx.fillStyle = '#d97706';
        this.ctx.globalAlpha = 0.2;
        if (tile.variation > 0.5) this.ctx.fillRect(x + 5, y + 5, 2, 2);
        this.ctx.globalAlpha = 1.0;
    }

    private drawDirt(x: number, y: number, tile: Tile) {
        this.ctx.fillStyle = '#92400e'; // Amber 800
        this.ctx.fillRect(x, y, TILE_SIZE + 1, TILE_SIZE + 1);
        this.ctx.fillStyle = '#78350f';
        this.ctx.globalAlpha = 0.3;
        if (tile.variation > 0.5) this.ctx.fillRect(x + 10, y + 10, 4, 4);
        this.ctx.globalAlpha = 1.0;
    }

    private drawMud(x: number, y: number, tile: Tile) {
        this.ctx.fillStyle = '#451a03'; // Amber 950
        this.ctx.fillRect(x, y, TILE_SIZE + 1, TILE_SIZE + 1);
        this.ctx.fillStyle = '#78350f';
        this.ctx.globalAlpha = 0.5;
        if (tile.variation > 0.5) this.ctx.fillRect(x + 5, y + 15, 6, 6);
        this.ctx.globalAlpha = 1.0;
    }

    private drawSnow(x: number, y: number, tile: Tile) {
        this.ctx.fillStyle = '#f1f5f9'; // Slate 100
        this.ctx.fillRect(x, y, TILE_SIZE + 1, TILE_SIZE + 1);
        this.ctx.fillStyle = '#cbd5e1';
        if (tile.variation > 0.7) this.ctx.fillRect(x + 5, y + 5, 2, 2);
    }
    // TODO(lint-intent): 'tile' is an unused parameter, which suggests a planned input for this flow.
    // TODO(lint-intent): If the contract should consume it, thread it into the decision/transform path or document why it exists.
    // TODO(lint-intent): Otherwise rename it with a leading underscore or remove it if the signature can change.
    private drawIce(x: number, y: number, _tile: Tile) {
        this.ctx.fillStyle = '#cffafe'; // Cyan 100
        this.ctx.fillRect(x, y, TILE_SIZE + 1, TILE_SIZE + 1);
        this.ctx.strokeStyle = '#22d3ee'; // Cyan 400
        this.ctx.globalAlpha = 0.4;
        this.ctx.beginPath();
        this.ctx.moveTo(x, y + TILE_SIZE);
        this.ctx.lineTo(x + TILE_SIZE, y);
        this.ctx.stroke();
        this.ctx.globalAlpha = 1.0;
    }

    private drawAsh(x: number, y: number, tile: Tile) {
        this.ctx.fillStyle = '#4b5563'; // Gray 600
        this.ctx.fillRect(x, y, TILE_SIZE + 1, TILE_SIZE + 1);
        this.ctx.fillStyle = '#1f2937'; // Gray 800
        if (tile.variation > 0.5) this.ctx.fillRect(x + 8, y + 12, 3, 3);
    }

    private drawRockGround(x: number, y: number, tile: Tile) {
        this.ctx.fillStyle = '#57534e'; // Stone 600
        this.ctx.fillRect(x, y, TILE_SIZE + 1, TILE_SIZE + 1);
        this.ctx.fillStyle = '#292524'; // Stone 800
        if (tile.variation > 0.4) this.ctx.fillRect(x + 4, y + 20, 5, 5);
    }
    // TODO(lint-intent): 'tile' is an unused parameter, which suggests a planned input for this flow.
    // TODO(lint-intent): If the contract should consume it, thread it into the decision/transform path or document why it exists.
    // TODO(lint-intent): Otherwise rename it with a leading underscore or remove it if the signature can change.
    private drawCrystalFloor(x: number, y: number, _tile: Tile) {
        this.ctx.fillStyle = '#ecfeff'; // Cyan 50
        this.ctx.fillRect(x, y, TILE_SIZE + 1, TILE_SIZE + 1);
        this.ctx.fillStyle = '#a5f3fc';
        this.ctx.beginPath();
        this.ctx.moveTo(x, y + 10);
        this.ctx.lineTo(x + 10, y);
        this.ctx.lineTo(x + 20, y + 10);
        this.ctx.fill();
    }

    private drawCobblestone(x: number, y: number, tile: Tile) {
        this.ctx.fillStyle = '#57534e';
        this.ctx.fillRect(x, y, TILE_SIZE + 1, TILE_SIZE + 1);

        for (let cy = 2; cy < TILE_SIZE; cy += 8) {
            const offset = (cy % 16) === 2 ? 0 : 4;
            for (let cx = -2; cx < TILE_SIZE; cx += 10) {
                this.ctx.fillStyle = (tile.variation + cx + cy) % 2 > 0.5 ? '#a8a29e' : '#78716c';
                this.ctx.beginPath();
                roundedRect(this.ctx, x + cx + offset, y + cy, 8, 6, 2);
                this.ctx.fill();
            }
        }
    }
    // TODO(lint-intent): 'tile' is an unused parameter, which suggests a planned input for this flow.
    // TODO(lint-intent): If the contract should consume it, thread it into the decision/transform path or document why it exists.
    // TODO(lint-intent): Otherwise rename it with a leading underscore or remove it if the signature can change.
    private drawDirtRoad(x: number, y: number, _tile: Tile) {
        this.ctx.fillStyle = '#78350f';
        this.ctx.fillRect(x, y, TILE_SIZE + 1, TILE_SIZE + 1);

        this.ctx.fillStyle = '#451a03';
        this.ctx.globalAlpha = 0.2;
        if ((x + y) % 3 === 0) this.ctx.fillRect(x + 4, y + 4, 4, 4);
        if ((x * y) % 5 === 0) this.ctx.fillRect(x + 20, y + 20, 3, 3);
        if ((x + y * 2) % 7 === 0) this.ctx.fillRect(x + 15, y + 5, 2, 2);
        if ((x * 3 + y) % 4 === 0) this.ctx.fillRect(x + 5, y + 20, 4, 4);
        this.ctx.globalAlpha = 1.0;
    }
    // TODO(lint-intent): 'tile' is an unused parameter, which suggests a planned input for this flow.
    // TODO(lint-intent): If the contract should consume it, thread it into the decision/transform path or document why it exists.
    // TODO(lint-intent): Otherwise rename it with a leading underscore or remove it if the signature can change.
    private drawDock(x: number, y: number, _tile: Tile) {
        this.ctx.fillStyle = '#5D4037';
        this.ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        this.ctx.fillStyle = '#3E2723';
        for (let i = 4; i < TILE_SIZE; i += 8) {
            this.ctx.fillRect(x, y + i, TILE_SIZE, 1);
        }
        this.ctx.fillStyle = '#2d1b15';
        const posts = [[2, 2], [26, 2], [2, 26], [26, 26]];
        posts.forEach(p => {
            this.ctx.beginPath();
            this.ctx.arc(x + p[0], y + p[1], 3, 0, Math.PI * 2);
            this.ctx.fill();
        });
        this.ctx.fillStyle = 'rgba(0,0,0,0.3)';
        this.ctx.fillRect(x, y + TILE_SIZE - 4, TILE_SIZE, 4);
    }

    private drawBridge(x: number, y: number, tile: Tile, gx: number, gy: number, grid: Tile[][]) {
        const hasWaterY = (gy > 0 && (grid[gx][gy - 1].type === TileType.WATER_DEEP || grid[gx][gy - 1].type === TileType.WATER_SHALLOW)) ||
            (gy < grid[0].length - 1 && (grid[gx][gy + 1].type === TileType.WATER_DEEP || grid[gx][gy + 1].type === TileType.WATER_SHALLOW));

        const isVertical = !hasWaterY;

        this.ctx.fillStyle = '#7c2d12'; // Wood dark
        this.ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

        this.ctx.fillStyle = '#9a3412'; // Wood light
        if (isVertical) {
            for (let i = 2; i < TILE_SIZE; i += 6) {
                this.ctx.fillRect(x + i, y, 4, TILE_SIZE);
            }
            this.ctx.fillStyle = '#431407';
            this.ctx.fillRect(x, y, 4, TILE_SIZE);
            this.ctx.fillRect(x + TILE_SIZE - 4, y, 4, TILE_SIZE);
        } else {
            for (let i = 2; i < TILE_SIZE; i += 6) {
                this.ctx.fillRect(x, y + i, TILE_SIZE, 4);
            }
            this.ctx.fillStyle = '#431407';
            this.ctx.fillRect(x, y, TILE_SIZE, 4);
            this.ctx.fillRect(x, y + TILE_SIZE - 4, TILE_SIZE, 4);
        }
    }
}
