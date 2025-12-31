import { TownDirection } from '../../../types/town';
import { TILE_SIZE, roundedRect } from './shared';
import { characterAssetService, CharacterVisualConfig } from '../../CharacterAssetService';

export class PlayerPainter {
    constructor(private ctx: CanvasRenderingContext2D) { }

    public async drawPlayer(
        x: number,
        y: number,
        facing: TownDirection,
        isMoving: boolean,
        visuals?: CharacterVisualConfig
    ) {
        this.ctx.save();

        const centerX = x + TILE_SIZE / 2;
        const centerY = y + TILE_SIZE / 2;

        const shouldFlip = facing === 'east' || facing === 'northeast' || facing === 'southeast';
        const baseDirection = shouldFlip
            ? (facing === 'east' ? 'west' : facing === 'northeast' ? 'northwest' : 'southwest')
            : facing;

        if (shouldFlip) {
            this.ctx.translate(centerX, centerY);
            this.ctx.scale(-1, 1);
            this.ctx.translate(-centerX, -centerY);
        }

        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        this.ctx.beginPath();
        this.ctx.ellipse(centerX, y + 28, 8, 3, 0, 0, Math.PI * 2);
        this.ctx.fill();

        const walkOffset = isMoving ? Math.sin(Date.now() * 0.02) * 2 : 0;

        if (visuals) {
            await this.drawLayeredCharacter(centerX, centerY + walkOffset, visuals);
        } else {
            this.drawCharacterSprite(centerX, centerY + walkOffset, baseDirection, isMoving);
        }

        this.ctx.restore();
    }

    private async drawLayeredCharacter(cx: number, cy: number, visuals: CharacterVisualConfig) {
        const paths = characterAssetService.getLayerPaths(visuals);

        for (const path of paths) {
            try {
                const img = await characterAssetService.getImage(path);
                // Center and scale
                const scale = 1.5; // Guessing scale for now
                const w = img.width * scale;
                const h = img.height * scale;
                this.ctx.drawImage(img, cx - w / 2, cy - h / 2 - 4, w, h);
            // TODO(lint-intent): Capture load errors if we want to surface missing asset diagnostics.
            // TODO(lint-intent): Consider adding a fallback sprite once asset loading is expanded.
            } catch {
                // Silently fail if image not loaded yet or failed
            }
        }
    }

    private drawCharacterSprite(cx: number, cy: number, facing: TownDirection, isMoving: boolean) {
        const legSpread = isMoving ? Math.abs(Math.sin(Date.now() * 0.015)) * 4 : 0;

        const skinColor = '#d4a574';
        const cloakColor = '#374151';
        const cloakHighlight = '#4b5563';
        const accentColor = '#f59e0b';
        const bootColor = '#1f2937';
        const hairColor = '#451a03';

        const bodyWidth = 10;
        const bodyHeight = 12;

        let bodyOffsetY = 0;
        const headOffsetY = 0;

        if (facing === 'north' || facing === 'northwest' || facing === 'northeast') {
            bodyOffsetY = -1;
        } else if (facing === 'south' || facing === 'southwest' || facing === 'southeast') {
            bodyOffsetY = 1;
        }

        this.ctx.fillStyle = bootColor;
        this.ctx.fillRect(cx - 4 - legSpread / 2, cy + 4, 3, 8);
        this.ctx.fillRect(cx + 1 + legSpread / 2, cy + 4, 3, 8);

        this.ctx.fillStyle = cloakColor;
        this.ctx.beginPath();
        roundedRect(this.ctx, cx - bodyWidth / 2, cy - bodyHeight / 2 + bodyOffsetY, bodyWidth, bodyHeight, 2);
        this.ctx.fill();

        this.ctx.fillStyle = cloakHighlight;
        this.ctx.fillRect(cx - bodyWidth / 2 + 1, cy - bodyHeight / 2 + bodyOffsetY + 1, 2, bodyHeight - 2);

        this.ctx.fillStyle = accentColor;
        this.ctx.fillRect(cx - bodyWidth / 2, cy + 2 + bodyOffsetY, bodyWidth, 2);

        const headY = cy - bodyHeight / 2 - 6 + headOffsetY + bodyOffsetY;

        if (facing === 'north' || facing === 'northwest' || facing === 'northeast') {
            this.ctx.fillStyle = hairColor;
            this.ctx.beginPath();
            this.ctx.arc(cx, headY + 2, 6, 0, Math.PI * 2);
            this.ctx.fill();
        }

        this.ctx.fillStyle = skinColor;
        this.ctx.beginPath();
        this.ctx.arc(cx, headY, 5, 0, Math.PI * 2);
        this.ctx.fill();

        if (facing === 'south' || facing === 'southwest' || facing === 'southeast') {
            this.ctx.fillStyle = hairColor;
            this.ctx.beginPath();
            this.ctx.ellipse(cx, headY - 4, 4, 2, 0, 0, Math.PI * 2);
            this.ctx.fill();
        } else if (facing === 'west') {
            this.ctx.fillStyle = hairColor;
            this.ctx.beginPath();
            this.ctx.ellipse(cx - 2, headY - 3, 4, 3, -0.3, 0, Math.PI * 2);
            this.ctx.fill();
        }

        if (facing === 'south' || facing === 'southwest' || facing === 'southeast') {
            this.ctx.fillStyle = '#1f2937';
            this.ctx.fillRect(cx - 2, headY - 1, 1, 2);
            this.ctx.fillRect(cx + 1, headY - 1, 1, 2);
        } else if (facing === 'west') {
            this.ctx.fillStyle = '#1f2937';
            this.ctx.fillRect(cx - 2, headY - 1, 1, 2);
        }

        this.ctx.fillStyle = skinColor;
        if (facing === 'south' || facing === 'southwest' || facing === 'southeast') {
            this.ctx.fillRect(cx - bodyWidth / 2 - 2, cy - 2 + bodyOffsetY, 2, 6);
            this.ctx.fillRect(cx + bodyWidth / 2, cy - 2 + bodyOffsetY, 2, 6);
        } else if (facing === 'west') {
            this.ctx.fillRect(cx + bodyWidth / 2 - 1, cy - 2 + bodyOffsetY, 2, 6);
        } else {
            this.ctx.fillRect(cx - bodyWidth / 2 - 1, cy - 1 + bodyOffsetY, 2, 5);
            this.ctx.fillRect(cx + bodyWidth / 2 - 1, cy - 1 + bodyOffsetY, 2, 5);
        }
    }
}
