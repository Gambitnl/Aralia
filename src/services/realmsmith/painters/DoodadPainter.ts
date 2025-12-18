import { BiomeType, DoodadType, Tile } from '../../../types/realmsmith';
import { TILE_SIZE, roundedRect } from './shared';

export class DoodadPainter {
    constructor(private ctx: CanvasRenderingContext2D) {}

    public drawDoodad(tile: Tile, x: number, y: number, biome: BiomeType) {
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
            case DoodadType.TREE_CHERRY: this.drawTree(px, py, '#be185d', '#db2777'); break;
            case DoodadType.TREE_AUTUMN: this.drawTree(px, py, '#c2410c', '#ea580c'); break;
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
        this.ctx.fillStyle = '#451a03';
        this.ctx.fillRect(x + 12, y + 16, 8, 14);

        this.ctx.fillStyle = dark;
        this.ctx.beginPath();
        this.ctx.arc(x + 8, y + 12, 10, 0, Math.PI * 2);
        this.ctx.arc(x + 24, y + 12, 10, 0, Math.PI * 2);
        this.ctx.arc(x + 16, y + 4, 12, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.fillStyle = light;
        this.ctx.beginPath();
        this.ctx.arc(x + 16, y + 4, 8, 0, Math.PI * 2);
        this.ctx.fill();
    }

    private drawPine(x: number, y: number, dark: string, light: string) {
        this.ctx.fillStyle = '#451a03';
        this.ctx.fillRect(x + 14, y + 20, 4, 10);

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
        this.ctx.fillStyle = '#57534e';
        this.ctx.fillRect(x + 12, y + 14, 8, 16);

        this.ctx.fillStyle = '#3f6212';
        this.ctx.beginPath();
        this.ctx.ellipse(x + 16, y + 10, 14, 10, 0, 0, Math.PI * 2);
        this.ctx.fill();

        // TODO: Seed doodad randomness (willow strands, crop clusters) off tile variation so repeated renders don't redraw different shapes.
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
        this.ctx.strokeStyle = '#a16207';
        this.ctx.lineWidth = 4;
        this.ctx.beginPath();
        this.ctx.moveTo(x + 16, y + 28);
        this.ctx.quadraticCurveTo(x + 20, y + 16, x + 10, y + 6);
        this.ctx.stroke();

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
        this.ctx.fillStyle = '#e5e5e5';
        this.ctx.fillRect(x + 14, y + 16, 4, 14);

        this.ctx.fillStyle = '#a855f7';
        this.ctx.beginPath();
        this.ctx.arc(x + 16, y + 12, 12, Math.PI, 0);
        this.ctx.fill();

        this.ctx.fillStyle = '#f3e8ff';
        this.ctx.beginPath();
        this.ctx.arc(x + 12, y + 8, 2, 0, Math.PI * 2);
        this.ctx.arc(x + 20, y + 10, 3, 0, Math.PI * 2);
        this.ctx.fill();
    }

    private drawCactus(x: number, y: number) {
        this.ctx.fillStyle = '#15803d';
        this.ctx.beginPath();
        roundedRect(this.ctx, x + 14, y + 10, 4, 20, 2);
        roundedRect(this.ctx, x + 8, y + 14, 4, 8, 2);
        roundedRect(this.ctx, x + 20, y + 12, 4, 8, 2);
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
        this.ctx.fillStyle = '#a8a29e';
        this.ctx.beginPath();
        this.ctx.ellipse(x + 16, y + 20, 6, 3, 0, 0, Math.PI * 2);
        this.ctx.fill();
    }

    private drawWell(x: number, y: number) {
        this.ctx.fillStyle = '#57534e';
        this.ctx.beginPath();
        this.ctx.arc(x + 16, y + 20, 8, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.fillStyle = '#3b82f6';
        this.ctx.beginPath();
        this.ctx.arc(x + 16, y + 20, 5, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.fillStyle = '#78350f';
        this.ctx.fillRect(x + 10, y + 4, 2, 16);
        this.ctx.fillRect(x + 20, y + 4, 2, 16);
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
        this.ctx.fillStyle = '#451a03';
        this.ctx.fillRect(x + 10, y + 16, 12, 2);
        this.ctx.fillRect(x + 10, y + 24, 12, 2);
    }

    private drawLamp(x: number, y: number) {
        this.ctx.fillStyle = '#1f2937';
        this.ctx.fillRect(x + 14, y + 10, 4, 22);

        this.ctx.fillStyle = '#fbbf24';
        this.ctx.fillRect(x + 12, y + 4, 8, 8);
        this.ctx.strokeStyle = '#1f2937';
        this.ctx.strokeRect(x + 12, y + 4, 8, 8);
    }

    private drawTombstone(x: number, y: number) {
        this.ctx.fillStyle = '#9ca3af';
        this.ctx.beginPath();
        roundedRect(this.ctx, x + 12, y + 12, 8, 16, 4);
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
        this.ctx.fillStyle = '#166534';
        this.ctx.fillRect(x + 15, y + 12, 2, 4);
    }
}
