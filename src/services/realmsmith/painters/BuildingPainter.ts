import { BiomeType, Building, BuildingType, RoofStyle, Tile, TileType, WallTexture } from '../../../types/realmsmith';
import { getBiomeColors } from './BiomePalette';
import { TILE_SIZE, roundedRect } from './shared';

export class BuildingPainter {
    constructor(private ctx: CanvasRenderingContext2D) {}

    public drawEntrance(b: Building, tiles: Tile[][]) {
        let tx = b.x + b.doorX;
        let ty = b.y + b.doorY;

        if (b.doorY === 0) ty--;
        else if (b.doorY === b.height - 1) ty++;
        else if (b.doorX === 0) tx--;
        else if (b.doorX === b.width - 1) tx++;

        if (tx < 0 || tx >= tiles.length || ty < 0 || ty >= tiles[0].length) return;

        const t = tiles[tx][ty].type;
        if (t === TileType.WATER_DEEP || t === TileType.WATER_SHALLOW || t === TileType.LAVA || t === TileType.ICE) return;

        const cx = tx * TILE_SIZE;
        const cy = ty * TILE_SIZE;

        this.ctx.fillStyle = '#78350f';
        this.ctx.globalAlpha = 0.5;
        this.ctx.beginPath();
        this.ctx.ellipse(cx + TILE_SIZE / 2, cy + TILE_SIZE / 2, 10, 10, 0, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.globalAlpha = 1.0;

        const isStone = b.wallTexture === WallTexture.STONE || b.wallTexture === WallTexture.STUCCO;
        this.ctx.fillStyle = isStone ? '#57534e' : '#78350f';

        this.ctx.beginPath();
        if (b.doorY === b.height - 1) {
            roundedRect(this.ctx, cx + 8, cy - 4, 16, 6, 1);
        } else if (b.doorY === 0) {
            roundedRect(this.ctx, cx + 8, cy + TILE_SIZE - 2, 16, 6, 1);
        } else if (b.doorX === 0) {
            roundedRect(this.ctx, cx + TILE_SIZE - 2, cy + 8, 6, 16, 1);
        } else {
            roundedRect(this.ctx, cx - 4, cy + 8, 6, 16, 1);
        }
        this.ctx.fill();

        const shops = [
            BuildingType.TAVERN, BuildingType.BLACKSMITH, BuildingType.MARKET_STALL,
            BuildingType.ALCHEMIST, BuildingType.LIBRARY, BuildingType.BAKERY,
            BuildingType.TAILOR, BuildingType.JEWELER
        ];
        if (shops.includes(b.type)) {
            const signX = cx + TILE_SIZE - 4;
            const signY = cy + 4;

            this.ctx.fillStyle = '#451a03';
            this.ctx.fillRect(signX, signY, 2, 12);

            if (b.type === BuildingType.TAVERN) this.ctx.fillStyle = '#fbbf24';
            else if (b.type === BuildingType.BLACKSMITH) this.ctx.fillStyle = '#94a3b8';
            else if (b.type === BuildingType.ALCHEMIST) this.ctx.fillStyle = '#e879f9';
            else if (b.type === BuildingType.LIBRARY) this.ctx.fillStyle = '#3b82f6';
            else if (b.type === BuildingType.BAKERY) this.ctx.fillStyle = '#d97706';
            else if (b.type === BuildingType.TAILOR) this.ctx.fillStyle = '#c084fc';
            else if (b.type === BuildingType.JEWELER) this.ctx.fillStyle = '#22d3ee';
            else this.ctx.fillStyle = '#d4d4d8';

            this.ctx.fillRect(signX - 6, signY + 1, 12, 7);

            this.ctx.strokeStyle = '#451a03';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(signX - 6, signY + 1, 12, 7);
        }
    }

    public drawBuildingStructure(b: Building, biome: BiomeType) {
        const x = b.x * TILE_SIZE;
        const y = b.y * TILE_SIZE;
        const w = b.width * TILE_SIZE;
        const h = b.height * TILE_SIZE;

        const colors = getBiomeColors(biome);
        const wallColor = colors.wallOverride || b.color;

        this.ctx.fillStyle = 'rgba(0,0,0,0.2)';
        this.ctx.fillRect(x + 4, y + h, w, 6);

        this.ctx.fillStyle = wallColor;
        this.ctx.fillRect(x, y, w, h);

        if (b.wallTexture === WallTexture.STONE) {
            this.ctx.fillStyle = 'rgba(0,0,0,0.1)';
            for (let i = 0; i < w; i += 12) {
                for (let j = 0; j < h; j += 8) {
                    if ((i + j) % 3 === 0) this.ctx.fillRect(x + i, y + j, 4, 3);
                }
            }
        } else if (b.wallTexture === WallTexture.TIMBER_FRAME) {
            this.ctx.fillStyle = '#3f2e21';
            this.ctx.fillRect(x, y, 4, h);
            this.ctx.fillRect(x + w - 4, y, 4, h);
            this.ctx.fillRect(x, y, w, 4);
            this.ctx.fillRect(x, y + h - 4, w, 4);

            for (let i = 32; i < w; i += 32) {
                this.ctx.fillRect(x + i, y, 4, h);
            }
        } else if (b.wallTexture === WallTexture.WOOD) {
            this.ctx.fillStyle = 'rgba(0,0,0,0.1)';
            for (let i = 0; i < w; i += 8) {
                this.ctx.fillRect(x + i, y, 1, h);
            }
        }

        const dx = b.x * TILE_SIZE + b.doorX * TILE_SIZE;
        const dy = b.y * TILE_SIZE + b.doorY * TILE_SIZE;

        this.ctx.fillStyle = '#271c19';

        if (b.doorY === b.height - 1) {
            this.ctx.fillRect(dx + 10, dy + TILE_SIZE - 4, 12, 4);
        } else if (b.doorY === 0) {
            this.ctx.fillRect(dx + 10, dy, 12, 4);
        } else if (b.doorX === 0) {
            this.ctx.fillRect(dx, dy + 10, 4, 12);
        } else {
            this.ctx.fillRect(dx + TILE_SIZE - 4, dy + 10, 4, 12);
        }
    }

    public drawBuildingRoof(b: Building, biome: BiomeType) {
        const x = b.x * TILE_SIZE;
        const y = b.y * TILE_SIZE;
        const w = b.width * TILE_SIZE;
        const h = b.height * TILE_SIZE;

        const colors = getBiomeColors(biome);
        const roofColor = colors.roofOverride || b.roofColor;
        const overhang = 4;

        if (b.type === BuildingType.TOWER || b.type === BuildingType.WINDMILL) {
            this.drawTowerRoof(x - overhang, y - overhang, w + overhang * 2, h + overhang * 2, roofColor, b.roofStyle);
            if (b.type === BuildingType.WINDMILL) {
                // TODO: Drive windmill blade rotation via a passed-in time delta instead of Date.now() so renders stay deterministic and testable.
                this.ctx.save();
                this.ctx.translate(x + w / 2, y + h / 2 - 10);
                this.ctx.rotate(Date.now() * 0.001);
                this.ctx.fillStyle = '#fef3c7';
                this.ctx.fillRect(-40, -4, 80, 8);
                this.ctx.fillRect(-4, -40, 8, 80);
                this.ctx.restore();
            }
            return;
        }

        if (b.width === b.height && b.width > 2) {
            this.drawHipRoof(x - overhang, y - overhang, w + overhang * 2, h + overhang * 2, roofColor, b.roofStyle);
        } else {
            const axis: 'horizontal' | 'vertical' = b.width > b.height ? 'horizontal' : 'vertical';
            this.drawGableRoof(x - overhang, y - overhang, w + overhang * 2, h + overhang * 2, roofColor, b.roofStyle, axis);
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
            // TODO: Swap Math.random for a seeded roof variation (tile-based) to avoid texture flicker on rerender.
            for (let i = 0; i < 20; i++) {
                const rx = Math.random() * w;
                const ry = Math.random() * h;
                this.ctx.fillRect(x + rx, y + ry, 2, 2);
            }
        }
    }

    private drawGableRoof(x: number, y: number, w: number, h: number, color: string, style: RoofStyle, axis: 'horizontal' | 'vertical') {
        this.ctx.fillStyle = color;
        this.ctx.fillRect(x, y, w, h);

        this.ctx.fillStyle = 'rgba(255,255,255,0.2)';
        if (axis === 'horizontal') {
            this.ctx.fillRect(x, y + h / 2 - 2, w, 4);
            this.ctx.fillStyle = 'rgba(0,0,0,0.2)';
            this.ctx.fillRect(x, y + h / 2 + 2, w, h / 2 - 2);
        } else {
            this.ctx.fillRect(x + w / 2 - 2, y, 4, h);
            this.ctx.fillStyle = 'rgba(0,0,0,0.2)';
            this.ctx.fillRect(x + w / 2 + 2, y, w / 2 - 2, h);
        }

        this.drawRoofTexture(x, y, w, h, style);
    }

    private drawHipRoof(x: number, y: number, w: number, h: number, color: string, style: RoofStyle) {
        this.ctx.fillStyle = color;
        this.ctx.fillRect(x, y, w, h);

        const ridgeSize = Math.min(w, h) * 0.4;
        const cx = x + w / 2;
        const cy = y + h / 2;

        this.ctx.fillStyle = 'rgba(255,255,255,0.2)';
        this.ctx.fillRect(cx - ridgeSize / 2, cy - ridgeSize / 2, ridgeSize, ridgeSize);

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
        const cx = x + w / 2;
        const cy = y + h / 2;
        const r = Math.min(w, h) / 2;

        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.arc(cx, cy, r, 0, Math.PI * 2);
        this.ctx.fill();

        const grad = this.ctx.createRadialGradient(cx - r / 3, cy - r / 3, 0, cx, cy, r);
        grad.addColorStop(0, 'rgba(255,255,255,0.3)');
        grad.addColorStop(1, 'rgba(0,0,0,0.3)');
        this.ctx.fillStyle = grad;
        this.ctx.beginPath();
        this.ctx.arc(cx, cy, r, 0, Math.PI * 2);
        this.ctx.fill();
    }
}
