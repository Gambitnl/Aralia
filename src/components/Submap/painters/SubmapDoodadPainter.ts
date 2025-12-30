/**
 * @file src/components/Submap/painters/SubmapDoodadPainter.ts
 * Paints decorative objects (trees, rocks, flowers, creatures) for the submap.
 * Replaces emoji-based scatter features with canvas-drawn elements.
 */

import 'pixi.js/unsafe-eval'; // CSP patch
import * as PIXI from 'pixi.js';
import {
    TILE_SIZE,
    getBiomePalette,
    // TODO(lint-intent): 'simpleHash' is declared but unused, suggesting an unfinished state/behavior hook in this block.
    // TODO(lint-intent): If the intent is still active, connect it to the nearby render/dispatch/condition so it matters.
    // TODO(lint-intent): Otherwise remove it or prefix with an underscore to record intentional unused state.
    simpleHash as _simpleHash,
    createOffscreenCanvas,
    adjustBrightness,
    rgbToHexString,
    roundedRect,
    type RGB,
} from './shared';

// ============================================================================
// Types
// ============================================================================

export type DoodadType =
    | 'tree_deciduous'
    | 'tree_conifer'
    | 'tree_palm'
    | 'tree_willow'
    | 'tree_dead'
    | 'tree_cherry'
    | 'tree_mushroom'
    | 'bush'
    | 'bush_flower'
    | 'rock_small'
    | 'rock_large'
    | 'flower_single'
    | 'flower_cluster'
    | 'mushroom'
    | 'grass_tuft'
    | 'reeds'
    | 'cactus'
    | 'crystal'
    | 'creature_small'
    | 'creature_water'
    | 'creature_flying';

export interface DoodadRenderData {
    type: DoodadType;
    x: number;
    y: number;
    biomeId: string;
    variation: number;
    scale?: number;
}

// Emoji to doodad type mapping
const EMOJI_TO_DOODAD: Record<string, DoodadType> = {
    // Trees
    '🌲': 'tree_conifer',
    '🌳': 'tree_deciduous',
    '🌴': 'tree_palm',
    '🌸': 'tree_cherry',
    // Plants
    '🍄': 'mushroom',
    '🌿': 'grass_tuft',
    '🌾': 'reeds',
    '🌵': 'cactus',
    '🌱': 'grass_tuft',
    // Rocks/Minerals
    '🪨': 'rock_large',
    '💎': 'crystal',
    // Flowers
    '🌼': 'flower_single',
    '🌷': 'flower_single',
    // Flying creatures
    '🦋': 'creature_flying',
    '🦅': 'creature_flying',
    '🦟': 'creature_flying',
    '🦇': 'creature_flying',
    // Small creatures
    '🐿️': 'creature_small',
    '🐇': 'creature_small',
    '🐐': 'creature_small',
    '🐑': 'creature_small',
    '🦂': 'creature_small',
    '🐍': 'creature_small',
    '🐜': 'creature_small',
    '🦗': 'creature_small',
    '🐞': 'creature_small',
    '🪱': 'creature_small',
    // Water creatures
    '🐸': 'creature_water',
    '🐟': 'creature_water',
    '🐠': 'creature_water',
    '🐊': 'creature_water',
    '🐬': 'creature_water',
    '🐙': 'creature_water',
    '🐡': 'creature_water',
    // Dungeon/Cave items (render as rock variants)
    '💀': 'rock_small',
    '🕯️': 'flower_single',
    '💧': 'flower_single',
    '✨': 'crystal',
    '⛓️': 'rock_small',
    '🕸️': 'grass_tuft',
    '🏺': 'rock_large',
    '🦴': 'rock_small',
    // Ocean/Desert misc
    '🚢': 'rock_large',
    '⭐': 'crystal',
    '🌄': 'rock_large',
    '🥥': 'rock_small',
    '🌊': 'creature_water',
    '🏜️': 'rock_large',
};

// ============================================================================
// SubmapDoodadPainter Class
// ============================================================================

export class SubmapDoodadPainter {
    private textureCache: Map<string, PIXI.Texture> = new Map();
    private animationTime: number = 0;

    constructor() { }

    /**
     * Clear texture cache.
     */
    public clear(): void {
        this.textureCache.forEach(tex => tex.destroy(true));
        this.textureCache.clear();
    }

    /**
     * Convert emoji icon to doodad type.
     */
    public emojiToDoodadType(emoji: string): DoodadType | null {
        return EMOJI_TO_DOODAD[emoji] || null;
    }

    /**
     * Render a doodad to a PIXI sprite.
     */
    public renderDoodad(data: DoodadRenderData): PIXI.Sprite {
        const cacheKey = `${data.type}:${data.biomeId}:${data.variation}`;

        let texture = this.textureCache.get(cacheKey);
        if (!texture) {
            texture = this.generateDoodadTexture(data.type, data.biomeId, data.variation);
            this.textureCache.set(cacheKey, texture);
        }

        const sprite = new PIXI.Sprite(texture);
        sprite.anchor.set(0.5, 1); // Bottom-center anchor for Y-sorting
        sprite.x = data.x * TILE_SIZE + TILE_SIZE / 2;
        sprite.y = (data.y + 1) * TILE_SIZE;

        if (data.scale) {
            sprite.scale.set(data.scale);
        }

        return sprite;
    }

    /**
     * Generate doodad texture using canvas.
     */
    private generateDoodadTexture(
        type: DoodadType,
        biomeId: string,
        variation: number
    ): PIXI.Texture {
        const { canvas, ctx } = createOffscreenCanvas(TILE_SIZE, TILE_SIZE);
        const palette = getBiomePalette(biomeId);

        switch (type) {
            case 'tree_deciduous':
                this.drawDeciduousTree(ctx, palette.grass, variation);
                break;
            case 'tree_conifer':
                this.drawConiferTree(ctx, palette.grass, variation);
                break;
            case 'tree_palm':
                this.drawPalmTree(ctx, variation);
                break;
            case 'tree_willow':
                this.drawWillowTree(ctx, variation);
                break;
            case 'tree_dead':
                this.drawDeadTree(ctx, variation);
                break;
            case 'tree_cherry':
                this.drawCherryTree(ctx, variation);
                break;
            case 'tree_mushroom':
                this.drawMushroomTree(ctx, variation);
                break;
            case 'bush':
                this.drawBush(ctx, palette.grass, variation);
                break;
            case 'bush_flower':
                this.drawFloweringBush(ctx, variation);
                break;
            case 'rock_small':
                this.drawRockSmall(ctx, palette.rock, variation);
                break;
            case 'rock_large':
                this.drawRockLarge(ctx, palette.rock, variation);
                break;
            case 'flower_single':
                this.drawFlower(ctx, variation);
                break;
            case 'flower_cluster':
                this.drawFlowerCluster(ctx, variation);
                break;
            case 'mushroom':
                this.drawMushroom(ctx, variation);
                break;
            case 'grass_tuft':
                this.drawGrassTuft(ctx, palette.grass, variation);
                break;
            case 'reeds':
                this.drawReeds(ctx, variation);
                break;
            case 'cactus':
                this.drawCactus(ctx as CanvasRenderingContext2D, variation);
                break;
            case 'crystal':
                this.drawCrystal(ctx as CanvasRenderingContext2D, variation);
                break;
            case 'creature_small':
                this.drawSmallCreature(ctx, variation);
                break;
            case 'creature_water':
                this.drawWaterCreature(ctx, variation);
                break;
            case 'creature_flying':
                this.drawFlyingCreature(ctx, variation);
                break;
        }

        return PIXI.Texture.from(canvas as HTMLCanvasElement);
    }

    // ========================================================================
    // Tree Drawing Methods
    // ========================================================================

    private drawDeciduousTree(
        ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
        leafColor: RGB,
        // TODO(lint-intent): 'variation' is an unused parameter, which suggests a planned input for this flow.
        // TODO(lint-intent): If the contract should consume it, thread it into the decision/transform path or document why it exists.
        // TODO(lint-intent): Otherwise rename it with a leading underscore or remove it if the signature can change.
        _variation: number
    ): void {
        const cx = TILE_SIZE / 2;

        // Trunk
        ctx.fillStyle = '#451a03';
        ctx.fillRect(cx - 3, TILE_SIZE - 14, 6, 14);

        // Foliage - multiple overlapping circles
        const darkLeaf = rgbToHexString(adjustBrightness(leafColor, 0.8));
        const lightLeaf = rgbToHexString(adjustBrightness(leafColor, 1.1));

        ctx.fillStyle = darkLeaf;
        ctx.beginPath();
        ctx.arc(cx - 5, TILE_SIZE - 18, 8, 0, Math.PI * 2);
        ctx.arc(cx + 5, TILE_SIZE - 18, 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = lightLeaf;
        ctx.beginPath();
        ctx.arc(cx, TILE_SIZE - 22, 9, 0, Math.PI * 2);
        ctx.fill();

        // Highlight
        ctx.fillStyle = rgbToHexString(adjustBrightness(leafColor, 1.3));
        ctx.beginPath();
        ctx.arc(cx, TILE_SIZE - 24, 4, 0, Math.PI * 2);
        ctx.fill();
    }

    private drawConiferTree(
        ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
        leafColor: RGB,
        // TODO(lint-intent): 'variation' is an unused parameter, which suggests a planned input for this flow.
        // TODO(lint-intent): If the contract should consume it, thread it into the decision/transform path or document why it exists.
        // TODO(lint-intent): Otherwise rename it with a leading underscore or remove it if the signature can change.
        _variation: number
    ): void {
        const cx = TILE_SIZE / 2;

        // Trunk
        ctx.fillStyle = '#451a03';
        ctx.fillRect(cx - 2, TILE_SIZE - 10, 4, 10);

        // Triangular foliage layers
        const darkGreen = rgbToHexString(adjustBrightness(leafColor, 0.7));
        const midGreen = rgbToHexString(leafColor);
        const lightGreen = rgbToHexString(adjustBrightness(leafColor, 1.2));

        // Bottom layer
        ctx.fillStyle = darkGreen;
        ctx.beginPath();
        ctx.moveTo(cx - 10, TILE_SIZE - 10);
        ctx.lineTo(cx, TILE_SIZE - 20);
        ctx.lineTo(cx + 10, TILE_SIZE - 10);
        ctx.fill();

        // Middle layer
        ctx.fillStyle = midGreen;
        ctx.beginPath();
        ctx.moveTo(cx - 8, TILE_SIZE - 16);
        ctx.lineTo(cx, TILE_SIZE - 26);
        ctx.lineTo(cx + 8, TILE_SIZE - 16);
        ctx.fill();

        // Top layer
        ctx.fillStyle = lightGreen;
        ctx.beginPath();
        ctx.moveTo(cx - 5, TILE_SIZE - 22);
        ctx.lineTo(cx, TILE_SIZE - 30);
        ctx.lineTo(cx + 5, TILE_SIZE - 22);
        ctx.fill();
    }

    private drawPalmTree(
        ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
        // TODO(lint-intent): 'variation' is an unused parameter, which suggests a planned input for this flow.
        // TODO(lint-intent): If the contract should consume it, thread it into the decision/transform path or document why it exists.
        // TODO(lint-intent): Otherwise rename it with a leading underscore or remove it if the signature can change.
        _variation: number
    ): void {
        const cx = TILE_SIZE / 2;

        // Curved trunk
        ctx.strokeStyle = '#a16207';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(cx, TILE_SIZE);
        ctx.quadraticCurveTo(cx + 4, TILE_SIZE - 15, cx - 2, TILE_SIZE - 24);
        ctx.stroke();

        // Palm fronds
        ctx.strokeStyle = '#15803d';
        ctx.lineWidth = 2;
        const frondAngles = [-0.8, -0.4, 0, 0.4, 0.8];
        // TODO(lint-intent): 'i' is an unused parameter, which suggests a planned input for this flow.
        // TODO(lint-intent): If the contract should consume it, thread it into the decision/transform path or document why it exists.
        // TODO(lint-intent): Otherwise rename it with a leading underscore or remove it if the signature can change.
        frondAngles.forEach((angle, _i) => {
            ctx.beginPath();
            const startX = cx - 2;
            const startY = TILE_SIZE - 24;
            const endX = startX + Math.cos(angle - Math.PI / 2) * 12;
            const endY = startY + Math.sin(angle - Math.PI / 2) * 12 + 4;

            ctx.moveTo(startX, startY);
            ctx.quadraticCurveTo(
                startX + Math.cos(angle - Math.PI / 2) * 8,
                startY - 6,
                endX,
                endY
            );
            ctx.stroke();
        });
    }

    private drawWillowTree(
        ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
        // TODO(lint-intent): 'variation' is an unused parameter, which suggests a planned input for this flow.
        // TODO(lint-intent): If the contract should consume it, thread it into the decision/transform path or document why it exists.
        // TODO(lint-intent): Otherwise rename it with a leading underscore or remove it if the signature can change.
        _variation: number
    ): void {
        const cx = TILE_SIZE / 2;

        // Trunk
        ctx.fillStyle = '#57534e';
        ctx.fillRect(cx - 3, TILE_SIZE - 12, 6, 12);

        // Canopy
        ctx.fillStyle = '#3f6212';
        ctx.beginPath();
        ctx.ellipse(cx, TILE_SIZE - 18, 10, 7, 0, 0, Math.PI * 2);
        ctx.fill();

        // Hanging branches
        ctx.strokeStyle = '#4d7c0f';
        ctx.lineWidth = 1;
        for (let i = 0; i < 7; i++) {
            const x = cx - 8 + i * 2.5;
            ctx.beginPath();
            ctx.moveTo(x, TILE_SIZE - 14);
            ctx.quadraticCurveTo(x + 1, TILE_SIZE - 6, x - 1, TILE_SIZE - 2);
            ctx.stroke();
        }
    }

    private drawDeadTree(
        ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
        // TODO(lint-intent): 'variation' is an unused parameter, which suggests a planned input for this flow.
        // TODO(lint-intent): If the contract should consume it, thread it into the decision/transform path or document why it exists.
        // TODO(lint-intent): Otherwise rename it with a leading underscore or remove it if the signature can change.
        _variation: number
    ): void {
        const cx = TILE_SIZE / 2;

        ctx.strokeStyle = '#44403c';
        ctx.lineWidth = 3;

        // Main trunk
        ctx.beginPath();
        ctx.moveTo(cx, TILE_SIZE);
        ctx.lineTo(cx, TILE_SIZE - 18);
        ctx.stroke();

        // Branches
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx, TILE_SIZE - 14);
        ctx.lineTo(cx - 8, TILE_SIZE - 22);
        ctx.moveTo(cx, TILE_SIZE - 10);
        ctx.lineTo(cx + 7, TILE_SIZE - 16);
        ctx.stroke();
    }

    private drawCherryTree(
        ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
        // TODO(lint-intent): 'variation' is an unused parameter, which suggests a planned input for this flow.
        // TODO(lint-intent): If the contract should consume it, thread it into the decision/transform path or document why it exists.
        // TODO(lint-intent): Otherwise rename it with a leading underscore or remove it if the signature can change.
        _variation: number
    ): void {
        const cx = TILE_SIZE / 2;

        // Trunk
        ctx.fillStyle = '#451a03';
        ctx.fillRect(cx - 3, TILE_SIZE - 14, 6, 14);

        // Pink foliage
        ctx.fillStyle = '#be185d';
        ctx.beginPath();
        ctx.arc(cx - 5, TILE_SIZE - 18, 7, 0, Math.PI * 2);
        ctx.arc(cx + 5, TILE_SIZE - 18, 7, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#db2777';
        ctx.beginPath();
        ctx.arc(cx, TILE_SIZE - 22, 8, 0, Math.PI * 2);
        ctx.fill();

        // Highlight
        ctx.fillStyle = '#f472b6';
        ctx.beginPath();
        ctx.arc(cx + 2, TILE_SIZE - 24, 3, 0, Math.PI * 2);
        ctx.fill();
    }

    private drawMushroomTree(
        ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
        // TODO(lint-intent): 'variation' is an unused parameter, which suggests a planned input for this flow.
        // TODO(lint-intent): If the contract should consume it, thread it into the decision/transform path or document why it exists.
        // TODO(lint-intent): Otherwise rename it with a leading underscore or remove it if the signature can change.
        _variation: number
    ): void {
        const cx = TILE_SIZE / 2;

        // Stalk
        ctx.fillStyle = '#e5e5e5';
        ctx.fillRect(cx - 2, TILE_SIZE - 12, 4, 12);

        // Cap
        ctx.fillStyle = '#a855f7';
        ctx.beginPath();
        ctx.arc(cx, TILE_SIZE - 14, 10, Math.PI, 0);
        ctx.fill();

        // Spots
        ctx.fillStyle = '#f3e8ff';
        ctx.beginPath();
        ctx.arc(cx - 4, TILE_SIZE - 16, 2, 0, Math.PI * 2);
        ctx.arc(cx + 4, TILE_SIZE - 18, 2.5, 0, Math.PI * 2);
        ctx.fill();
    }

    // ========================================================================
    // Ground Feature Drawing Methods
    // ========================================================================

    private drawBush(
        ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
        color: RGB,
        // TODO(lint-intent): 'variation' is an unused parameter, which suggests a planned input for this flow.
        // TODO(lint-intent): If the contract should consume it, thread it into the decision/transform path or document why it exists.
        // TODO(lint-intent): Otherwise rename it with a leading underscore or remove it if the signature can change.
        _variation: number
    ): void {
        const cx = TILE_SIZE / 2;
        const dark = rgbToHexString(adjustBrightness(color, 0.8));
        const light = rgbToHexString(adjustBrightness(color, 1.1));

        ctx.fillStyle = dark;
        ctx.beginPath();
        ctx.arc(cx - 4, TILE_SIZE - 6, 5, 0, Math.PI * 2);
        ctx.arc(cx + 4, TILE_SIZE - 6, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = light;
        ctx.beginPath();
        ctx.arc(cx, TILE_SIZE - 9, 6, 0, Math.PI * 2);
        ctx.fill();
    }

    private drawFloweringBush(
        ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
        // TODO(lint-intent): 'variation' is an unused parameter, which suggests a planned input for this flow.
        // TODO(lint-intent): If the contract should consume it, thread it into the decision/transform path or document why it exists.
        // TODO(lint-intent): Otherwise rename it with a leading underscore or remove it if the signature can change.
        _variation: number
    ): void {
        const cx = TILE_SIZE / 2;

        // Bush base
        ctx.fillStyle = '#166534';
        ctx.beginPath();
        ctx.arc(cx - 4, TILE_SIZE - 6, 5, 0, Math.PI * 2);
        ctx.arc(cx + 4, TILE_SIZE - 6, 5, 0, Math.PI * 2);
        ctx.arc(cx, TILE_SIZE - 9, 6, 0, Math.PI * 2);
        ctx.fill();

        // Flowers
        const colors = ['#f472b6', '#fbbf24', '#f87171'];
        colors.forEach((color, i) => {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(cx - 4 + i * 4, TILE_SIZE - 10 - (i % 2) * 3, 2, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    private drawRockSmall(
        ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
        color: RGB,
        // TODO(lint-intent): 'variation' is an unused parameter, which suggests a planned input for this flow.
        // TODO(lint-intent): If the contract should consume it, thread it into the decision/transform path or document why it exists.
        // TODO(lint-intent): Otherwise rename it with a leading underscore or remove it if the signature can change.
        _variation: number
    ): void {
        const cx = TILE_SIZE / 2;
        // TODO(lint-intent): 'dark' is declared but unused, suggesting an unfinished state/behavior hook in this block.
        // TODO(lint-intent): If the intent is still active, connect it to the nearby render/dispatch/condition so it matters.
        // TODO(lint-intent): Otherwise remove it or prefix with an underscore to record intentional unused state.
        const _dark = rgbToHexString(adjustBrightness(color, 0.7));
        const light = rgbToHexString(adjustBrightness(color, 1.2));

        ctx.fillStyle = rgbToHexString(color);
        ctx.beginPath();
        ctx.moveTo(cx - 5, TILE_SIZE - 2);
        ctx.lineTo(cx - 3, TILE_SIZE - 7);
        ctx.lineTo(cx + 4, TILE_SIZE - 6);
        ctx.lineTo(cx + 6, TILE_SIZE - 2);
        ctx.closePath();
        ctx.fill();

        // Highlight
        ctx.fillStyle = light;
        ctx.beginPath();
        ctx.moveTo(cx - 2, TILE_SIZE - 6);
        ctx.lineTo(cx, TILE_SIZE - 4);
        ctx.lineTo(cx + 2, TILE_SIZE - 5);
        ctx.closePath();
        ctx.fill();
    }

    private drawRockLarge(
        ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
        color: RGB,
        // TODO(lint-intent): 'variation' is an unused parameter, which suggests a planned input for this flow.
        // TODO(lint-intent): If the contract should consume it, thread it into the decision/transform path or document why it exists.
        // TODO(lint-intent): Otherwise rename it with a leading underscore or remove it if the signature can change.
        _variation: number
    ): void {
        const cx = TILE_SIZE / 2;

        ctx.fillStyle = rgbToHexString(color);
        ctx.beginPath();
        ctx.moveTo(cx - 8, TILE_SIZE - 2);
        ctx.lineTo(cx - 6, TILE_SIZE - 10);
        ctx.lineTo(cx + 2, TILE_SIZE - 12);
        ctx.lineTo(cx + 9, TILE_SIZE - 8);
        ctx.lineTo(cx + 8, TILE_SIZE - 2);
        ctx.closePath();
        ctx.fill();

        // Shading
        ctx.fillStyle = rgbToHexString(adjustBrightness(color, 0.7));
        ctx.beginPath();
        ctx.moveTo(cx - 8, TILE_SIZE - 2);
        ctx.lineTo(cx - 6, TILE_SIZE - 10);
        ctx.lineTo(cx - 2, TILE_SIZE - 8);
        ctx.lineTo(cx - 4, TILE_SIZE - 2);
        ctx.closePath();
        ctx.fill();
    }

    private drawFlower(
        ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
        variation: number
    ): void {
        const cx = TILE_SIZE / 2;
        const colors = ['#f472b6', '#fbbf24', '#60a5fa', '#f87171', '#a78bfa'];
        const color = colors[variation % colors.length];

        // Stem
        ctx.strokeStyle = '#15803d';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx, TILE_SIZE - 2);
        ctx.lineTo(cx, TILE_SIZE - 8);
        ctx.stroke();

        // Petals
        ctx.fillStyle = color;
        for (let i = 0; i < 5; i++) {
            const angle = (i / 5) * Math.PI * 2;
            ctx.beginPath();
            ctx.arc(
                cx + Math.cos(angle) * 3,
                TILE_SIZE - 10 + Math.sin(angle) * 3,
                2,
                0,
                Math.PI * 2
            );
            ctx.fill();
        }

        // Center
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(cx, TILE_SIZE - 10, 1.5, 0, Math.PI * 2);
        ctx.fill();
    }

    private drawFlowerCluster(
        ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
        // TODO(lint-intent): 'variation' is an unused parameter, which suggests a planned input for this flow.
        // TODO(lint-intent): If the contract should consume it, thread it into the decision/transform path or document why it exists.
        // TODO(lint-intent): Otherwise rename it with a leading underscore or remove it if the signature can change.
        _variation: number
    ): void {
        for (let i = 0; i < 3; i++) {
            const ox = (i - 1) * 6 + TILE_SIZE / 2;
            const oy = TILE_SIZE - 4 - (i % 2) * 4;

            ctx.strokeStyle = '#15803d';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(ox, TILE_SIZE);
            ctx.lineTo(ox, oy);
            ctx.stroke();

            const colors = ['#f472b6', '#fbbf24', '#60a5fa'];
            ctx.fillStyle = colors[i];
            ctx.beginPath();
            ctx.arc(ox, oy - 2, 3, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    private drawMushroom(
        ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
        variation: number
    ): void {
        const cx = TILE_SIZE / 2;

        // Stalk
        ctx.fillStyle = '#fef3c7';
        ctx.fillRect(cx - 2, TILE_SIZE - 6, 4, 6);

        // Cap
        ctx.fillStyle = variation % 2 === 0 ? '#ef4444' : '#92400e';
        ctx.beginPath();
        ctx.arc(cx, TILE_SIZE - 6, 5, Math.PI, 0);
        ctx.fill();

        // Spots (for red mushroom)
        if (variation % 2 === 0) {
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(cx - 2, TILE_SIZE - 8, 1, 0, Math.PI * 2);
            ctx.arc(cx + 2, TILE_SIZE - 7, 1.5, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    private drawGrassTuft(
        ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
        color: RGB,
        variation: number
    ): void {
        const cx = TILE_SIZE / 2;

        ctx.strokeStyle = rgbToHexString(adjustBrightness(color, 0.9));
        ctx.lineWidth = 1;

        const blades = 5 + variation;
        for (let i = 0; i < blades; i++) {
            const x = cx - 5 + i * 2;
            const height = 6 + (i % 3) * 2;
            const bend = (i - blades / 2) * 0.5;

            ctx.beginPath();
            ctx.moveTo(x, TILE_SIZE - 2);
            ctx.quadraticCurveTo(x + bend, TILE_SIZE - height / 2, x + bend * 2, TILE_SIZE - height);
            ctx.stroke();
        }
    }

    private drawReeds(
        ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
        // TODO(lint-intent): 'variation' is an unused parameter, which suggests a planned input for this flow.
        // TODO(lint-intent): If the contract should consume it, thread it into the decision/transform path or document why it exists.
        // TODO(lint-intent): Otherwise rename it with a leading underscore or remove it if the signature can change.
        _variation: number
    ): void {
        const cx = TILE_SIZE / 2;

        for (let i = 0; i < 4; i++) {
            const x = cx - 6 + i * 4;
            const height = 10 + (i % 2) * 4;

            // Stalk
            ctx.strokeStyle = '#365314';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x, TILE_SIZE - 2);
            ctx.lineTo(x, TILE_SIZE - height);
            ctx.stroke();

            // Seed head
            ctx.fillStyle = '#713f12';
            ctx.beginPath();
            ctx.ellipse(x, TILE_SIZE - height - 2, 1.5, 3, 0, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    private drawCactus(
        ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
        // TODO(lint-intent): 'variation' is an unused parameter, which suggests a planned input for this flow.
        // TODO(lint-intent): If the contract should consume it, thread it into the decision/transform path or document why it exists.
        // TODO(lint-intent): Otherwise rename it with a leading underscore or remove it if the signature can change.
        _variation: number
    ): void {
        const cx = TILE_SIZE / 2;

        ctx.fillStyle = '#15803d';

        // Main body
        ctx.beginPath();
        roundedRect(ctx, cx - 3, TILE_SIZE - 14, 6, 14, 3);
        ctx.fill();

        // Arms
        ctx.beginPath();
        roundedRect(ctx, cx - 8, TILE_SIZE - 10, 5, 4, 2);
        ctx.fill();
        ctx.beginPath();
        roundedRect(ctx, cx + 3, TILE_SIZE - 8, 5, 4, 2);
        ctx.fill();

        // Spines (dots)
        ctx.fillStyle = '#fef3c7';
        for (let i = 0; i < 6; i++) {
            ctx.fillRect(cx - 1 + (i % 2) * 2, TILE_SIZE - 12 + i * 2, 1, 1);
        }
    }

    private drawCrystal(
        ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
        variation: number
    ): void {
        const cx = TILE_SIZE / 2;
        const colors = ['#22d3ee', '#a855f7', '#f472b6', '#4ade80'];
        const color = colors[variation % colors.length];

        // Main crystal
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(cx, TILE_SIZE - 14);
        ctx.lineTo(cx - 5, TILE_SIZE - 2);
        ctx.lineTo(cx + 5, TILE_SIZE - 2);
        ctx.closePath();
        ctx.fill();

        // Highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.beginPath();
        ctx.moveTo(cx, TILE_SIZE - 14);
        ctx.lineTo(cx - 2, TILE_SIZE - 6);
        ctx.lineTo(cx, TILE_SIZE - 8);
        ctx.closePath();
        ctx.fill();

        // Small crystal
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(cx + 5, TILE_SIZE - 8);
        ctx.lineTo(cx + 3, TILE_SIZE - 2);
        ctx.lineTo(cx + 7, TILE_SIZE - 2);
        ctx.closePath();
        ctx.fill();
    }

    // ========================================================================
    // Creature Drawing Methods
    // ========================================================================

    private drawSmallCreature(
        ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
        variation: number
    ): void {
        const cx = TILE_SIZE / 2;
        const colors = ['#92400e', '#6b7280', '#78716c'];
        const color = colors[variation % colors.length];

        // Body
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(cx, TILE_SIZE - 4, 4, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        // Head
        ctx.beginPath();
        ctx.arc(cx - 3, TILE_SIZE - 6, 2, 0, Math.PI * 2);
        ctx.fill();

        // Eyes
        ctx.fillStyle = '#000000';
        ctx.fillRect(cx - 4, TILE_SIZE - 7, 1, 1);
    }

    private drawWaterCreature(
        ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
        variation: number
    ): void {
        const cx = TILE_SIZE / 2;
        const colors = ['#fb923c', '#38bdf8', '#22c55e'];
        const color = colors[variation % colors.length];

        // Fish body
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(cx, TILE_SIZE - 6, 5, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        // Tail
        ctx.beginPath();
        ctx.moveTo(cx + 5, TILE_SIZE - 6);
        ctx.lineTo(cx + 9, TILE_SIZE - 9);
        ctx.lineTo(cx + 9, TILE_SIZE - 3);
        ctx.closePath();
        ctx.fill();

        // Eye
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(cx - 3, TILE_SIZE - 6, 1, 0, Math.PI * 2);
        ctx.fill();
    }

    private drawFlyingCreature(
        ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
        variation: number
    ): void {
        const cx = TILE_SIZE / 2;

        // Body
        ctx.fillStyle = '#1f2937';
        ctx.beginPath();
        ctx.ellipse(cx, TILE_SIZE - 12, 2, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        // Wings
        const wingColors = ['#f472b6', '#60a5fa', '#fbbf24'];
        ctx.fillStyle = wingColors[variation % wingColors.length];
        ctx.beginPath();
        ctx.ellipse(cx - 4, TILE_SIZE - 13, 4, 2, -0.3, 0, Math.PI * 2);
        ctx.ellipse(cx + 4, TILE_SIZE - 13, 4, 2, 0.3, 0, Math.PI * 2);
        ctx.fill();
    }

    // ========================================================================
    // Animation Support
    // ========================================================================

    /**
     * Update animation time.
     */
    public updateAnimation(delta: number): void {
        this.animationTime += delta * 0.016;
    }

    /**
     * Get sway offset for vegetation.
     */
    public getSwayOffset(x: number, y: number): number {
        const phase = x * 0.5 + y * 0.3 + this.animationTime * 2;
        return Math.sin(phase) * 2;
    }

    /**
     * Apply sway animation to a sprite.
     */
    public applySwayAnimation(sprite: PIXI.Sprite, x: number, y: number): void {
        const sway = this.getSwayOffset(x, y);
        sprite.rotation = sway * 0.05;
    }
}
