import { Building, BuildingType, DoodadType, Tile, TileType } from '../../../types/realmsmith';
import { TILE_SIZE } from './shared';

export class OverlayPainter {
    constructor(private ctx: CanvasRenderingContext2D) {}

    public drawNightOverlay(width: number, height: number, tiles: Tile[][], buildings: Building[]) {
        this.ctx.fillStyle = 'rgba(11, 15, 25, 0.75)';
        this.ctx.fillRect(0, 0, width * TILE_SIZE, height * TILE_SIZE);

        this.ctx.globalCompositeOperation = 'screen';

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

        buildings.forEach(b => {
            const cx = (b.x + b.width / 2) * TILE_SIZE;
            const cy = (b.y + b.height / 2) * TILE_SIZE;

            if (b.type === BuildingType.CHURCH || b.type === BuildingType.SHRINE) {
                drawLight(cx, cy, TILE_SIZE * 3, '#3b82f6', 0.4);
            } else if (b.type === BuildingType.TEMPLE) {
                drawLight(cx, cy, TILE_SIZE * 3, '#facc15', 0.5);
            } else if (b.type === BuildingType.ALCHEMIST) {
                drawLight(cx, cy, TILE_SIZE * 2.5, '#d8b4fe', 0.5);
            } else if (b.type === BuildingType.LIBRARY || b.type === BuildingType.JEWELER) {
                drawLight(cx, cy, TILE_SIZE * 2, '#e0f2fe', 0.4);
            } else if (b.type === BuildingType.BAKERY) {
                drawLight(cx, cy, TILE_SIZE * 2, '#f97316', 0.6);
            } else if (b.type !== BuildingType.MARKET_STALL && b.type !== BuildingType.FARM_HOUSE && b.type !== BuildingType.WINDMILL && b.type !== BuildingType.STABLE) {
                drawLight(cx, cy, TILE_SIZE * 1.5, '#f59e0b', 0.5);
            }
        });

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
                        drawLight(cx, cy - 10, TILE_SIZE * 2.5, '#fbbf24', 0.7);
                    } else if (t.doodad.type === DoodadType.CRYSTAL) {
                        drawLight(cx, cy, TILE_SIZE * 1.5, '#22d3ee', 0.5);
                    }
                }
            }
        }

        this.ctx.globalAlpha = 1.0;
        this.ctx.globalCompositeOperation = 'source-over';
    }

    public drawGrid(width: number, height: number) {
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
}
