
import { Building, BuildingType, DoodadType, Tile, TileType, BiomeType, RoofStyle, WallTexture } from '../types/realmsmith';

const TILE_SIZE = 32;

export interface DrawOptions {
    isNight: boolean;
    showGrid: boolean;
}

export class AssetPainter {
    private ctx: CanvasRenderingContext2D;

    constructor(ctx: CanvasRenderingContext2D) {
        this.ctx = ctx;
    }

    // Robust rounded rect implementation
    private roundedRect(x: number, y: number, w: number, h: number, r: number) {
        if (w < 0) { x += w; w = Math.abs(w); }
        if (h < 0) { y += h; h = Math.abs(h); }
        if (r < 0) r = 0;
        // Clamp radius
        r = Math.min(r, w / 2, h / 2);

        // Try native first if available, but catch errors (Safari 16 bug etc)
        if (typeof this.ctx.roundRect === 'function') {
            try {
                this.ctx.roundRect(x, y, w, h, r);
                return;
            } catch (e) {
                // fall through to manual
            }
        }

        // Manual path fallback
        this.ctx.moveTo(x + r, y);
        this.ctx.lineTo(x + w - r, y);
        this.ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        this.ctx.lineTo(x + w, y + h - r);
        this.ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        this.ctx.lineTo(x + r, y + h);
        this.ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        this.ctx.lineTo(x, y + r);
        this.ctx.quadraticCurveTo(x, y, x + r, y);
    }

    public drawMap(tiles: Tile[][], buildings: Building[], biome: BiomeType, options: DrawOptions) {
        if (!tiles || tiles.length === 0) return;

        const width = tiles.length;
        const height = tiles[0].length;

        // 1. Ground Pass
        for (let x = 0; x < width; x++) {
            for (let y = 0; y < height; y++) {
                this.drawTileBase(tiles[x][y], x, y, tiles, biome);
            }
        }

        // 2. Entrances Pass (Doorsteps & Paths)
        buildings.forEach(b => this.drawEntrance(b, tiles));

        // 3. Shadow Pass
        this.ctx.globalAlpha = 0.25;
        this.ctx.fillStyle = '#000000';
        buildings.forEach(b => {
            this.ctx.beginPath();
            this.roundedRect(
                b.x * TILE_SIZE + 4,
                b.y * TILE_SIZE + 8,
                b.width * TILE_SIZE + 2,
                b.height * TILE_SIZE,
                4
            );
            this.ctx.fill();
        });
        this.ctx.globalAlpha = 1.0;

        // 4. Structure Pass
        buildings.forEach(b => this.drawBuildingStructure(b, biome));

        // 5. Walls Pass (drawn after ground, before doodads/roofs)
        for (let x = 0; x < width; x++) {
            for (let y = 0; y < height; y++) {
                if (tiles[x][y].type === TileType.WALL) {
                    this.drawWall(x * TILE_SIZE, y * TILE_SIZE, tiles, x, y);
                }
            }
        }

        // 6. Doodad Pass
        for (let x = 0; x < width; x++) {
            for (let y = 0; y < height; y++) {
                if (tiles[x][y].doodad) {
                    this.drawDoodad(tiles[x][y], x, y, biome);
                }
            }
        }

        // 7. Roof Pass
        const sortedBuildings = [...buildings].sort((a, b) => (a.y + a.height) - (b.y + b.height));
        sortedBuildings.forEach(b => this.drawBuildingRoof(b, biome));

        // 8. Night Mode / Lighting Pass
        if (options.isNight) {
            this.drawNightOverlay(width, height, tiles, buildings);
        }

        // 9. Grid Pass
        if (options.showGrid) {
            this.drawGrid(width, height);
        }
    }

    private drawEntrance(b: Building, tiles: Tile[][]) {
        // Determine entrance tile
        let tx = b.x + b.doorX;
        let ty = b.y + b.doorY;

        // Adjust to neighbor outside the building
        if (b.doorY === 0) ty--;
        else if (b.doorY === b.height - 1) ty++;
        else if (b.doorX === 0) tx--;
        else if (b.doorX === b.width - 1) tx++;

        if (tx < 0 || tx >= tiles.length || ty < 0 || ty >= tiles[0].length) return;

        // Don't draw path on water/lava
        const t = tiles[tx][ty].type;
        if (t === TileType.WATER_DEEP || t === TileType.WATER_SHALLOW || t === TileType.LAVA || t === TileType.ICE) return;

        const cx = tx * TILE_SIZE;
        const cy = ty * TILE_SIZE;

        // 1. Draw Path Patch (Dirt/worn ground)
        this.ctx.fillStyle = '#78350f'; // Dirt color
        this.ctx.globalAlpha = 0.5;
        this.ctx.beginPath();
        // Irregular patch
        this.ctx.ellipse(cx + TILE_SIZE / 2, cy + TILE_SIZE / 2, 10, 10, 0, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.globalAlpha = 1.0;

        // 2. Draw Doorstep
        const isStone = b.wallTexture === WallTexture.STONE || b.wallTexture === WallTexture.STUCCO;
        this.ctx.fillStyle = isStone ? '#57534e' : '#78350f'; // Stone or Wood

        this.ctx.beginPath();
        if (b.doorY === b.height - 1) {
            // South door - step at top of tile
            this.roundedRect(cx + 8, cy - 4, 16, 6, 1);
        } else if (b.doorY === 0) {
            // North door - step at bottom of tile
            this.roundedRect(cx + 8, cy + TILE_SIZE - 2, 16, 6, 1);
        } else if (b.doorX === 0) {
            // West door - step at right of tile
            this.roundedRect(cx + TILE_SIZE - 2, cy + 8, 6, 16, 1);
        } else {
            // East door - step at left of tile
            this.roundedRect(cx - 4, cy + 8, 6, 16, 1);
        }
        this.ctx.fill();

        // 3. Draw Signpost for Shops
        const shops = [
            BuildingType.TAVERN, BuildingType.BLACKSMITH, BuildingType.MARKET_STALL,
            BuildingType.ALCHEMIST, BuildingType.LIBRARY, BuildingType.BAKERY,
            BuildingType.TAILOR, BuildingType.JEWELER
        ];
        if (shops.includes(b.type)) {
            // Place sign offset from path
            const signX = cx + TILE_SIZE - 4;
            const signY = cy + 4;

            // Post
            this.ctx.fillStyle = '#451a03';
            this.ctx.fillRect(signX, signY, 2, 12);

            // Sign board
            if (b.type === BuildingType.TAVERN) this.ctx.fillStyle = '#fbbf24'; // Gold
            else if (b.type === BuildingType.BLACKSMITH) this.ctx.fillStyle = '#94a3b8'; // Grey
            else if (b.type === BuildingType.ALCHEMIST) this.ctx.fillStyle = '#e879f9'; // Pink/Purple
            else if (b.type === BuildingType.LIBRARY) this.ctx.fillStyle = '#3b82f6'; // Blue
            else if (b.type === BuildingType.BAKERY) this.ctx.fillStyle = '#d97706'; // Orange
            else if (b.type === BuildingType.TAILOR) this.ctx.fillStyle = '#c084fc'; // Lavender
            else if (b.type === BuildingType.JEWELER) this.ctx.fillStyle = '#22d3ee'; // Cyan
            else this.ctx.fillStyle = '#d4d4d8'; // Generic

            this.ctx.fillRect(signX - 6, signY + 1, 12, 7);

            // Border
            this.ctx.strokeStyle = '#451a03';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(signX - 6, signY + 1, 12, 7);
        }
    }

    private drawNightOverlay(width: number, height: number, tiles: Tile[][], buildings: Building[]) {
        // 1. Dark Ambient
        this.ctx.fillStyle = 'rgba(11, 15, 25, 0.75)';
        this.ctx.fillRect(0, 0, width * TILE_SIZE, height * TILE_SIZE);

        // 2. Additive Lighting
        this.ctx.globalCompositeOperation = 'screen'; // Makes lights glow

        // Helper for light glow
        const drawLight = (cx: number, cy: number, r: number, color: string, intensity = 0.6) => {
            const grad = this.ctx.createRadialGradient(cx, cy, 1, cx, cy, r);
            grad.addColorStop(0, color);
            grad.addColorStop(1, 'rgba(0,0,0,0)');
            this.ctx.fillStyle = grad;
            this.ctx.globalAlpha = intensity;
            this.ctx.beginPath();
            this.ctx.arc(cx, cy, r, 0, Math.PI * 2);
            this.ctx.fill();
        };

        // Window Lights
        buildings.forEach(b => {
            const cx = (b.x + b.width / 2) * TILE_SIZE;
            const cy = (b.y + b.height / 2) * TILE_SIZE;

            if (b.type === BuildingType.CHURCH || b.type === BuildingType.SHRINE) {
                // Blue magical windows / cool white
                drawLight(cx, cy, TILE_SIZE * 3, '#3b82f6', 0.4);
            } else if (b.type === BuildingType.TEMPLE) {
                // Golden holy light
                drawLight(cx, cy, TILE_SIZE * 3, '#facc15', 0.5);
            } else if (b.type === BuildingType.ALCHEMIST) {
                // Purple arcane light
                drawLight(cx, cy, TILE_SIZE * 2.5, '#d8b4fe', 0.5);
            } else if (b.type === BuildingType.LIBRARY || b.type === BuildingType.JEWELER) {
                // Cool reading light / bright diamond light
                drawLight(cx, cy, TILE_SIZE * 2, '#e0f2fe', 0.4);
            } else if (b.type === BuildingType.BAKERY) {
                // Very warm hearth light
                drawLight(cx, cy, TILE_SIZE * 2, '#f97316', 0.6);
            } else if (b.type !== BuildingType.MARKET_STALL && b.type !== BuildingType.FARM_HOUSE && b.type !== BuildingType.WINDMILL && b.type !== BuildingType.STABLE) {
                // Standard Warm windows
                drawLight(cx, cy, TILE_SIZE * 1.5, '#f59e0b', 0.5);
            }
        });

        // Environmental Lights
        for (let x = 0; x < width; x++) {
            for (let y = 0; y < height; y++) {
                const cx = x * TILE_SIZE + TILE_SIZE / 2;
                const cy = y * TILE_SIZE + TILE_SIZE / 2;
                const t = tiles[x][y];

                if (t.type === TileType.LAVA) {
                    drawLight(cx, cy, TILE_SIZE * 1.5, '#ef4444', 0.4);
                }
                else if (t.type === TileType.CRYSTAL_FLOOR) {
                    drawLight(cx, cy, TILE_SIZE, '#06b6d4', 0.2);
                }

                if (t.doodad) {
                    if (t.doodad.type === DoodadType.STREET_LAMP) {
                        drawLight(cx, cy - 10, TILE_SIZE * 2.5, '#fbbf24', 0.7); // Strong warm light
                    } else if (t.doodad.type === DoodadType.CRYSTAL) {
                        drawLight(cx, cy, TILE_SIZE * 1.5, '#22d3ee', 0.5);
                    }
                }
            }
        }

        this.ctx.globalAlpha = 1.0;
        this.ctx.globalCompositeOperation = 'source-over';
    }

    private drawGrid(width: number, height: number) {
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();

        for (let x = 0; x <= width; x++) {
            this.ctx.moveTo(x * TILE_SIZE, 0);
            this.ctx.lineTo(x * TILE_SIZE, height * TILE_SIZE);
        }
        for (let y = 0; y <= height; y++) {
            this.ctx.moveTo(0, y * TILE_SIZE);
            this.ctx.lineTo(width * TILE_SIZE, y * TILE_SIZE);
        }
        this.ctx.stroke();
    }

    private getBiomeColors(biome: BiomeType) {
        // Default palette
        let grassHue = 100; // Green
        let waterColor = '#3b82f6';
        let waterDeepColor = '#1e3a8a';
        let roofOverride: string | null = null;
        let wallOverride: string | null = null;

        switch (biome) {
            case BiomeType.SWAMP: grassHue = 60; waterColor = '#4d7c0f'; waterDeepColor = '#3f6212'; roofOverride = '#365314'; break; // Yellow-green, murky
            case BiomeType.SAVANNA: grassHue = 45; break; // Gold/Yellow
            case BiomeType.AUTUMN_FOREST: grassHue = 30; break; // Orange
            case BiomeType.JUNGLE: grassHue = 130; waterColor = '#06b6d4'; break; // Deep Green, Cyan water
            case BiomeType.MUSHROOM_FOREST: grassHue = 260; waterColor = '#8b5cf6'; waterDeepColor = '#5b21b6'; break; // Purple
            case BiomeType.BADLANDS: grassHue = 20; break; // Reddish
            case BiomeType.CHERRY_BLOSSOM: grassHue = 90; break; // Fresh green
            case BiomeType.HIGHLANDS: grassHue = 110; break;
            case BiomeType.VOLCANIC: waterColor = '#ef4444'; waterDeepColor = '#7f1d1d'; break; // Lava colors handled in renderer usually, but fallback
            case BiomeType.CRYSTAL_WASTES: waterColor = '#67e8f9'; waterDeepColor = '#0e7490'; break;
            case BiomeType.DEAD_LANDS: grassHue = 30; waterColor = '#57534e'; waterDeepColor = '#292524'; break; // Desaturated brown
        }
        return { grassHue, waterColor, waterDeepColor, roofOverride, wallOverride };
    }

    private drawTileBase(tile: Tile, x: number, y: number, grid: Tile[][], biome: BiomeType) {
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;
        const colors = this.getBiomeColors(biome);

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
                this.drawGrass(px, py, tile, colors.grassHue, biome === BiomeType.SAVANNA || biome === BiomeType.AUTUMN_FOREST ? 25 : 40); // Lower saturation for some
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
                // Draw base ground first so we don't see void
                this.drawDirt(px, py, tile);
                break;
            default:
                this.ctx.fillStyle = '#0f172a';
                this.ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        }

        this.ctx.restore();
    }

    private drawFarm(x: number, y: number, tile: Tile) {
        // Rich soil color
        this.ctx.fillStyle = '#3f2e21';
        this.ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

        // Furrows
        this.ctx.fillStyle = '#291d16';
        // Slight texture variation
        for (let i = 4; i < TILE_SIZE; i += 8) {
            this.ctx.fillRect(x, y + i, TILE_SIZE, 2);
        }
    }

    private drawWall(x: number, y: number, grid: Tile[][], gx: number, gy: number) {
        // Simple "Stone" texture
        const h = TILE_SIZE;
        const w = TILE_SIZE;

        // Check if wall below to decide if we draw the "face" or just "top"
        let hasWallBelow = false;
        if (gy < grid[0].length - 1 && grid[gx][gy + 1].type === TileType.WALL) {
            hasWallBelow = true;
        }

        // Top
        this.ctx.fillStyle = '#57534e'; // Stone 600
        this.ctx.fillRect(x, y, w, h);

        // 3D Effect - Light top edge
        this.ctx.fillStyle = '#78716c'; // Stone 500
        this.ctx.fillRect(x, y, w, 4);

        // Stones pattern
        this.ctx.fillStyle = '#44403c';
        this.ctx.globalAlpha = 0.3;
        this.ctx.fillRect(x + 4, y + 4, 6, 6);
        this.ctx.fillRect(x + 16, y + 12, 8, 6);
        this.ctx.globalAlpha = 1.0;

        // Crenelations (if no wall above)
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

    private drawWater(x: number, y: number, tile: Tile, gx: number, gy: number, grid: Tile[][], shallowColor: string, deepColor: string) {
        const isDeep = tile.type === TileType.WATER_DEEP;

        this.ctx.fillStyle = isDeep ? deepColor : shallowColor;
        this.ctx.fillRect(x, y, TILE_SIZE + 1, TILE_SIZE + 1);

        // Texture
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

        // Glow
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

        // Crust
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

    private drawIce(x: number, y: number, tile: Tile) {
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

    private drawCrystalFloor(x: number, y: number, tile: Tile) {
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
                this.roundedRect(x + cx + offset, y + cy, 8, 6, 2);
                this.ctx.fill();
            }
        }
    }

    private drawDirtRoad(x: number, y: number, tile: Tile) {
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

    private drawDock(x: number, y: number, tile: Tile) {
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
            // Vertical planks
            for (let i = 2; i < TILE_SIZE; i += 6) {
                this.ctx.fillRect(x + i, y, 4, TILE_SIZE);
            }
            // Rails
            this.ctx.fillStyle = '#431407';
            this.ctx.fillRect(x, y, 4, TILE_SIZE);
            this.ctx.fillRect(x + TILE_SIZE - 4, y, 4, TILE_SIZE);
        } else {
            // Horizontal planks
            for (let i = 2; i < TILE_SIZE; i += 6) {
                this.ctx.fillRect(x, y + i, TILE_SIZE, 4);
            }
            // Rails
            this.ctx.fillStyle = '#431407';
            this.ctx.fillRect(x, y, TILE_SIZE, 4);
            this.ctx.fillRect(x, y + TILE_SIZE - 4, TILE_SIZE, 4);
        }
    }

    private drawBuildingStructure(b: Building, biome: BiomeType) {
        const x = b.x * TILE_SIZE;
        const y = b.y * TILE_SIZE;
        const w = b.width * TILE_SIZE;
        const h = b.height * TILE_SIZE;

        const colors = this.getBiomeColors(biome);
        const wallColor = colors.wallOverride || b.color;

        // Shadow
        this.ctx.fillStyle = 'rgba(0,0,0,0.2)';
        this.ctx.fillRect(x + 4, y + h, w, 6);

        // Walls
        this.ctx.fillStyle = wallColor;
        this.ctx.fillRect(x, y, w, h);

        // Texture Overlay
        if (b.wallTexture === WallTexture.STONE) {
            this.ctx.fillStyle = 'rgba(0,0,0,0.1)';
            for (let i = 0; i < w; i += 12) {
                for (let j = 0; j < h; j += 8) {
                    if ((i + j) % 3 === 0) this.ctx.fillRect(x + i, y + j, 4, 3);
                }
            }
        } else if (b.wallTexture === WallTexture.TIMBER_FRAME) {
            this.ctx.fillStyle = '#3f2e21'; // Dark wood
            this.ctx.fillRect(x, y, 4, h); // Left post
            this.ctx.fillRect(x + w - 4, y, 4, h); // Right post
            this.ctx.fillRect(x, y, w, 4); // Top beam
            this.ctx.fillRect(x, y + h - 4, w, 4); // Bottom beam

            // Cross beams
            for (let i = 32; i < w; i += 32) {
                this.ctx.fillRect(x + i, y, 4, h);
            }
        } else if (b.wallTexture === WallTexture.WOOD) {
            this.ctx.fillStyle = 'rgba(0,0,0,0.1)';
            for (let i = 0; i < w; i += 8) {
                this.ctx.fillRect(x + i, y, 1, h);
            }
        }

        // Door
        const dx = b.x * TILE_SIZE + b.doorX * TILE_SIZE;
        const dy = b.y * TILE_SIZE + b.doorY * TILE_SIZE;

        this.ctx.fillStyle = '#271c19'; // Door color

        if (b.doorY === b.height - 1) { // South
            this.ctx.fillRect(dx + 10, dy + TILE_SIZE - 4, 12, 4);
        } else if (b.doorY === 0) { // North
            // Usually hidden by roof, but draw anyway
            this.ctx.fillRect(dx + 10, dy, 12, 4);
        } else if (b.doorX === 0) { // West
            this.ctx.fillRect(dx, dy + 10, 4, 12);
        } else { // East
            this.ctx.fillRect(dx + TILE_SIZE - 4, dy + 10, 4, 12);
        }
    }

    private drawBuildingRoof(b: Building, biome: BiomeType) {
        const x = b.x * TILE_SIZE;
        const y = b.y * TILE_SIZE;
        const w = b.width * TILE_SIZE;
        const h = b.height * TILE_SIZE;

        const colors = this.getBiomeColors(biome);
        const roofColor = colors.roofOverride || b.roofColor;

        // Overhang
        const oh = 4;

        if (b.type === BuildingType.TOWER || b.type === BuildingType.WINDMILL) {
            this.drawTowerRoof(x - oh, y - oh, w + oh * 2, h + oh * 2, roofColor, b.roofStyle);
            if (b.type === BuildingType.WINDMILL) {
                // Draw blades
                this.ctx.save();
                this.ctx.translate(x + w / 2, y + h / 2 - 10);
                this.ctx.rotate(Date.now() * 0.001); // Simple animation if we were re-rendering constantly
                this.ctx.fillStyle = '#fef3c7'; // Sail color
                this.ctx.fillRect(-40, -4, 80, 8);
                this.ctx.fillRect(-4, -40, 8, 80);
                this.ctx.restore();
            }
            return;
        }

        // Simple logic: Rectangular buildings get Gable, Square/Large get Hip
        if (b.width === b.height && b.width > 2) {
            this.drawHipRoof(x - oh, y - oh, w + oh * 2, h + oh * 2, roofColor, b.roofStyle);
        } else {
            // Determine axis
            const axis = b.width > b.height ? 'horizontal' : 'vertical';
            this.drawGableRoof(x - oh, y - oh, w + oh * 2, h + oh * 2, roofColor, b.roofStyle, axis);
        }
    }

    private drawRoofTexture(x: number, y: number, w: number, h: number, style: RoofStyle) {
        this.ctx.fillStyle = 'rgba(0,0,0,0.15)';

        if (style === RoofStyle.TILED) {
            for (let i = 0; i < w; i += 6) {
                for (let j = 0; j < h; j += 6) {
                    if ((i + j) % 2 === 0) this.ctx.fillRect(x + i, y + j, 3, 3);
                }
            }
        } else if (style === RoofStyle.SLATE) {
            for (let i = 0; i < w; i += 8) {
                this.ctx.fillRect(x + i, y, 1, h);
            }
        } else {
            // Thatched - noisy
            for (let i = 0; i < 20; i++) {
                const rx = Math.random() * w;
                const ry = Math.random() * h;
                this.ctx.fillRect(x + rx, y + ry, 2, 2);
            }
        }
    }

    private drawGableRoof(x: number, y: number, w: number, h: number, color: string, style: RoofStyle, axis: 'horizontal' | 'vertical') {
        this.ctx.fillStyle = color;

        // Main roof rect
        this.ctx.fillRect(x, y, w, h);

        // Ridge
        this.ctx.fillStyle = 'rgba(255,255,255,0.2)';
        if (axis === 'horizontal') {
            this.ctx.fillRect(x, y + h / 2 - 2, w, 4);
            // Shading
            this.ctx.fillStyle = 'rgba(0,0,0,0.2)';
            this.ctx.fillRect(x, y + h / 2 + 2, w, h / 2 - 2);
        } else {
            this.ctx.fillRect(x + w / 2 - 2, y, 4, h);
            // Shading
            this.ctx.fillStyle = 'rgba(0,0,0,0.2)';
            this.ctx.fillRect(x + w / 2 + 2, y, w / 2 - 2, h);
        }

        this.drawRoofTexture(x, y, w, h, style);
    }

    private drawHipRoof(x: number, y: number, w: number, h: number, color: string, style: RoofStyle) {
        this.ctx.fillStyle = color;
        this.ctx.fillRect(x, y, w, h);

        // Ridge (center square for hip)
        const ridgeSize = Math.min(w, h) * 0.4;
        const cx = x + w / 2;
        const cy = y + h / 2;

        this.ctx.fillStyle = 'rgba(255,255,255,0.2)';
        this.ctx.fillRect(cx - ridgeSize / 2, cy - ridgeSize / 2, ridgeSize, ridgeSize);

        // Diagonals
        this.ctx.beginPath();
        this.ctx.moveTo(x, y);
        this.ctx.lineTo(cx - ridgeSize / 2, cy - ridgeSize / 2);
        this.ctx.moveTo(x + w, y);
        this.ctx.lineTo(cx + ridgeSize / 2, cy - ridgeSize / 2);
        this.ctx.moveTo(x, y + h);
        this.ctx.lineTo(cx - ridgeSize / 2, cy + ridgeSize / 2);
        this.ctx.moveTo(x + w, y + h);
        this.ctx.lineTo(cx + ridgeSize / 2, cy + ridgeSize / 2);
        this.ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        this.ctx.stroke();

        this.drawRoofTexture(x, y, w, h, style);
    }

    private drawTowerRoof(x: number, y: number, w: number, h: number, color: string, style: RoofStyle) {
        // Conical roof approximation (circle)
        const cx = x + w / 2;
        const cy = y + h / 2;
        const r = Math.min(w, h) / 2;

        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.arc(cx, cy, r, 0, Math.PI * 2);
        this.ctx.fill();

        // Shading
        const grad = this.ctx.createRadialGradient(cx - r / 3, cy - r / 3, 0, cx, cy, r);
        grad.addColorStop(0, 'rgba(255,255,255,0.3)');
        grad.addColorStop(1, 'rgba(0,0,0,0.3)');
        this.ctx.fillStyle = grad;
        this.ctx.beginPath();
        this.ctx.arc(cx, cy, r, 0, Math.PI * 2);
        this.ctx.fill();
    }

    private drawDoodad(tile: Tile, x: number, y: number, biome: BiomeType) {
        if (!tile.doodad) return;

        const px = x * TILE_SIZE + tile.doodad.offsetX;
        const py = y * TILE_SIZE + tile.doodad.offsetY;

        const type = tile.doodad.type;

        switch (type) {
            case DoodadType.TREE_OAK: this.drawTree(px, py, '#166534', '#15803d'); break;
            case DoodadType.TREE_PINE: this.drawPine(px, py, '#064e3b', '#065f46'); break;
            case DoodadType.TREE_WILLOW: this.drawWillow(px, py); break;
            case DoodadType.TREE_PALM: this.drawPalm(px, py); break;
            case DoodadType.TREE_DEAD: this.drawDeadTree(px, py); break;
            case DoodadType.TREE_CHERRY: this.drawTree(px, py, '#be185d', '#db2777'); break; // Pink
            case DoodadType.TREE_AUTUMN: this.drawTree(px, py, '#c2410c', '#ea580c'); break; // Orange
            case DoodadType.TREE_MUSHROOM: this.drawMushroomTree(px, py); break;
            case DoodadType.CACTUS: this.drawCactus(px, py); break;
            case DoodadType.BUSH: this.drawBush(px, py, '#166534'); break;
            case DoodadType.ROCK: this.drawRock(px, py); break;
            case DoodadType.STUMP: this.drawStump(px, py); break;
            case DoodadType.WELL: this.drawWell(px, py); break;
            case DoodadType.CRATE: this.drawCrate(px, py); break;
            case DoodadType.BARREL: this.drawBarrel(px, py); break;
            case DoodadType.STREET_LAMP: this.drawLamp(px, py); break;
            case DoodadType.TOMBSTONE: this.drawTombstone(px, py); break;
            case DoodadType.CRYSTAL: this.drawCrystal(px, py); break;
            case DoodadType.CROP_WHEAT: this.drawCrop(px, py, '#facc15'); break;
            case DoodadType.CROP_CORN: this.drawCrop(px, py, '#16a34a'); break;
            case DoodadType.CROP_PUMPKIN: this.drawPumpkin(px, py); break;
        }
    }

    private drawTree(x: number, y: number, dark: string, light: string) {
        // Trunk
        this.ctx.fillStyle = '#451a03';
        this.ctx.fillRect(x + 12, y + 16, 8, 14);

        // Leaves (3 circles)
        this.ctx.fillStyle = dark;
        this.ctx.beginPath();
        this.ctx.arc(x + 8, y + 12, 10, 0, Math.PI * 2);
        this.ctx.arc(x + 24, y + 12, 10, 0, Math.PI * 2);
        this.ctx.arc(x + 16, y + 4, 12, 0, Math.PI * 2);
        this.ctx.fill();

        // Highlight
        this.ctx.fillStyle = light;
        this.ctx.beginPath();
        this.ctx.arc(x + 16, y + 4, 8, 0, Math.PI * 2);
        this.ctx.fill();
    }

    private drawPine(x: number, y: number, dark: string, light: string) {
        // Trunk
        this.ctx.fillStyle = '#451a03';
        this.ctx.fillRect(x + 14, y + 20, 4, 10);

        // Layers
        this.ctx.fillStyle = dark;
        this.ctx.beginPath();
        this.ctx.moveTo(x + 2, y + 24);
        this.ctx.lineTo(x + 16, y + 4);
        this.ctx.lineTo(x + 30, y + 24);
        this.ctx.fill();

        this.ctx.fillStyle = light;
        this.ctx.beginPath();
        this.ctx.moveTo(x + 6, y + 16);
        this.ctx.lineTo(x + 16, y - 2);
        this.ctx.lineTo(x + 26, y + 16);
        this.ctx.fill();
    }

    private drawWillow(x: number, y: number) {
        // Trunk
        this.ctx.fillStyle = '#57534e';
        this.ctx.fillRect(x + 12, y + 14, 8, 16);

        // Drooping leaves
        this.ctx.fillStyle = '#3f6212'; // Olive
        this.ctx.beginPath();
        this.ctx.ellipse(x + 16, y + 10, 14, 10, 0, 0, Math.PI * 2);
        this.ctx.fill();

        // Strands
        this.ctx.strokeStyle = '#4d7c0f';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        for (let i = 4; i <= 28; i += 4) {
            this.ctx.moveTo(x + i, y + 10);
            this.ctx.quadraticCurveTo(x + i + (Math.random() * 4 - 2), y + 20, x + i, y + 28);
        }
        this.ctx.stroke();
    }

    private drawPalm(x: number, y: number) {
        // Trunk (curved)
        this.ctx.strokeStyle = '#a16207';
        this.ctx.lineWidth = 4;
        this.ctx.beginPath();
        this.ctx.moveTo(x + 16, y + 28);
        this.ctx.quadraticCurveTo(x + 20, y + 16, x + 10, y + 6);
        this.ctx.stroke();

        // Leaves
        this.ctx.strokeStyle = '#15803d';
        this.ctx.lineWidth = 2;
        const cx = x + 10;
        const cy = y + 6;
        for (let i = 0; i < 5; i++) {
            const angle = (i / 5) * Math.PI * 2;
            this.ctx.beginPath();
            this.ctx.moveTo(cx, cy);
            this.ctx.quadraticCurveTo(cx + Math.cos(angle) * 10, cy + Math.sin(angle) * 10 - 5, cx + Math.cos(angle) * 16, cy + Math.sin(angle) * 16);
            this.ctx.stroke();
        }
    }

    private drawDeadTree(x: number, y: number) {
        this.ctx.strokeStyle = '#44403c';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.moveTo(x + 16, y + 28);
        this.ctx.lineTo(x + 16, y + 10);
        this.ctx.lineTo(x + 10, y + 2);
        this.ctx.moveTo(x + 16, y + 16);
        this.ctx.lineTo(x + 24, y + 8);
        this.ctx.stroke();
    }

    private drawMushroomTree(x: number, y: number) {
        // Stalk
        this.ctx.fillStyle = '#e5e5e5';
        this.ctx.fillRect(x + 14, y + 16, 4, 14);

        // Cap
        this.ctx.fillStyle = '#a855f7'; // Purple
        this.ctx.beginPath();
        this.ctx.arc(x + 16, y + 12, 12, Math.PI, 0);
        this.ctx.fill();

        // Spots
        this.ctx.fillStyle = '#f3e8ff';
        this.ctx.beginPath();
        this.ctx.arc(x + 12, y + 8, 2, 0, Math.PI * 2);
        this.ctx.arc(x + 20, y + 10, 3, 0, Math.PI * 2);
        this.ctx.fill();
    }

    private drawCactus(x: number, y: number) {
        this.ctx.fillStyle = '#15803d';
        this.ctx.beginPath();
        this.roundedRect(x + 14, y + 10, 4, 20, 2); // Main
        this.roundedRect(x + 8, y + 14, 4, 8, 2); // Arm L
        this.roundedRect(x + 20, y + 12, 4, 8, 2); // Arm R
        this.ctx.fill();
    }

    private drawBush(x: number, y: number, color: string) {
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.arc(x + 10, y + 20, 6, 0, Math.PI * 2);
        this.ctx.arc(x + 22, y + 20, 6, 0, Math.PI * 2);
        this.ctx.arc(x + 16, y + 14, 7, 0, Math.PI * 2);
        this.ctx.fill();
    }

    private drawRock(x: number, y: number) {
        this.ctx.fillStyle = '#78716c';
        this.ctx.beginPath();
        this.ctx.moveTo(x + 8, y + 24);
        this.ctx.lineTo(x + 12, y + 16);
        this.ctx.lineTo(x + 20, y + 14);
        this.ctx.lineTo(x + 26, y + 20);
        this.ctx.lineTo(x + 24, y + 28);
        this.ctx.lineTo(x + 6, y + 28);
        this.ctx.fill();
    }

    private drawStump(x: number, y: number) {
        this.ctx.fillStyle = '#57534e';
        this.ctx.fillRect(x + 10, y + 20, 12, 8);
        this.ctx.fillStyle = '#a8a29e'; // Top
        this.ctx.beginPath();
        this.ctx.ellipse(x + 16, y + 20, 6, 3, 0, 0, Math.PI * 2);
        this.ctx.fill();
    }

    private drawWell(x: number, y: number) {
        // Base
        this.ctx.fillStyle = '#57534e';
        this.ctx.beginPath();
        this.ctx.arc(x + 16, y + 20, 8, 0, Math.PI * 2);
        this.ctx.fill();

        // Water
        this.ctx.fillStyle = '#3b82f6';
        this.ctx.beginPath();
        this.ctx.arc(x + 16, y + 20, 5, 0, Math.PI * 2);
        this.ctx.fill();

        // Roof
        this.ctx.fillStyle = '#78350f';
        this.ctx.fillRect(x + 10, y + 4, 2, 16); // Post L
        this.ctx.fillRect(x + 20, y + 4, 2, 16); // Post R
        this.ctx.fillStyle = '#92400e';
        this.ctx.beginPath();
        this.ctx.moveTo(x + 6, y + 8);
        this.ctx.lineTo(x + 16, y + 2);
        this.ctx.lineTo(x + 26, y + 8);
        this.ctx.fill();
    }

    private drawCrate(x: number, y: number) {
        this.ctx.fillStyle = '#d97706';
        this.ctx.fillRect(x + 8, y + 12, 16, 16);
        this.ctx.strokeStyle = '#92400e';
        this.ctx.strokeRect(x + 8, y + 12, 16, 16);
        this.ctx.beginPath();
        this.ctx.moveTo(x + 8, y + 12);
        this.ctx.lineTo(x + 24, y + 28);
        this.ctx.moveTo(x + 24, y + 12);
        this.ctx.lineTo(x + 8, y + 28);
        this.ctx.stroke();
    }

    private drawBarrel(x: number, y: number) {
        this.ctx.fillStyle = '#92400e';
        this.ctx.beginPath();
        this.ctx.ellipse(x + 16, y + 20, 6, 8, 0, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.fillStyle = '#451a03'; // Hoops
        this.ctx.fillRect(x + 10, y + 16, 12, 2);
        this.ctx.fillRect(x + 10, y + 24, 12, 2);
    }

    private drawLamp(x: number, y: number) {
        this.ctx.fillStyle = '#1f2937'; // Post
        this.ctx.fillRect(x + 14, y + 10, 4, 22);

        this.ctx.fillStyle = '#fbbf24'; // Light
        this.ctx.fillRect(x + 12, y + 4, 8, 8);
        this.ctx.strokeStyle = '#1f2937';
        this.ctx.strokeRect(x + 12, y + 4, 8, 8);
    }

    private drawTombstone(x: number, y: number) {
        this.ctx.fillStyle = '#9ca3af';
        this.ctx.beginPath();
        this.roundedRect(x + 12, y + 12, 8, 16, 4);
        this.ctx.fill();
    }

    private drawCrystal(x: number, y: number) {
        this.ctx.fillStyle = '#22d3ee';
        this.ctx.beginPath();
        this.ctx.moveTo(x + 16, y + 28);
        this.ctx.lineTo(x + 8, y + 16);
        this.ctx.lineTo(x + 16, y + 4);
        this.ctx.lineTo(x + 24, y + 16);
        this.ctx.fill();
        this.ctx.fillStyle = 'rgba(255,255,255,0.4)';
        this.ctx.beginPath();
        this.ctx.moveTo(x + 16, y + 28);
        this.ctx.lineTo(x + 12, y + 16);
        this.ctx.lineTo(x + 16, y + 4);
        this.ctx.fill();
    }

    private drawCrop(x: number, y: number, color: string) {
        this.ctx.fillStyle = color;
        for (let i = 0; i < 5; i++) {
            const rx = Math.random() * 20 + 6;
            const ry = Math.random() * 20 + 6;
            this.ctx.fillRect(x + rx, y + ry, 2, 6);
        }
    }

    private drawPumpkin(x: number, y: number) {
        this.ctx.fillStyle = '#ea580c';
        this.ctx.beginPath();
        this.ctx.arc(x + 16, y + 20, 6, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.fillStyle = '#166534'; // Stem
        this.ctx.fillRect(x + 15, y + 12, 2, 4);
    }
}
