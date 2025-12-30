/**
 * @file src/components/Submap/painters/TextureAtlasManager.ts
 * Manages texture generation and caching for the PixiJS submap renderer.
 * Generates terrain textures on demand and caches them for performance.
 */

import 'pixi.js/unsafe-eval'; // CSP patch
import * as PIXI from 'pixi.js';
import {
    TILE_SIZE,
    createOffscreenCanvas,
    getBiomePalette,
    rgbToHexString,
    adjustBrightness,
    lerpColor,
    noise2D,
    initNoise,
    simpleHash,
    type RGB,
} from './shared';

// ============================================================================
// Types
// ============================================================================

export type TerrainType =
    | 'grass'
    | 'water'
    | 'water_deep'
    | 'rock'
    | 'path'
    | 'sand'
    | 'dirt'
    | 'mud'
    | 'snow'
    | 'ice'
    | 'cave_floor'
    | 'cave_wall'
    | 'dungeon_floor'
    | 'dungeon_wall'
    | 'default';

export interface TextureCacheKey {
    terrainType: TerrainType;
    biomeId: string;
    variation: number; // 0-3 for variety
}

export interface DoodadTextureKey {
    doodadType: string;
    biomeId: string;
    variation: number;
}

// ============================================================================
// TextureAtlasManager Class
// ============================================================================

export class TextureAtlasManager {
    private terrainCache: Map<string, PIXI.Texture> = new Map();
    private doodadCache: Map<string, PIXI.Texture> = new Map();
    private blendCache: Map<string, PIXI.Texture> = new Map();
    private maxCacheSize: number = 500;

    constructor(seed: number = 12345) {
        initNoise(seed);
    }

    /**
     * Clear all cached textures.
     */
    public clear(): void {
        this.terrainCache.forEach(tex => tex.destroy(true));
        this.terrainCache.clear();

        this.doodadCache.forEach(tex => tex.destroy(true));
        this.doodadCache.clear();

        this.blendCache.forEach(tex => tex.destroy(true));
        this.blendCache.clear();
    }

    /**
     * Get or create a terrain texture.
     */
    public getTerrainTexture(
        terrainType: TerrainType,
        biomeId: string,
        variation: number = 0
    ): PIXI.Texture {
        const key = `${terrainType}:${biomeId}:${variation}`;

        if (this.terrainCache.has(key)) {
            return this.terrainCache.get(key)!;
        }

        // Enforce cache limit
        if (this.terrainCache.size >= this.maxCacheSize) {
            this.evictOldest(this.terrainCache);
        }

        const texture = this.generateTerrainTexture(terrainType, biomeId, variation);
        this.terrainCache.set(key, texture);
        return texture;
    }

    /**
     * Generate a terrain texture using canvas.
     */
    private generateTerrainTexture(
        terrainType: TerrainType,
        biomeId: string,
        variation: number
    ): PIXI.Texture {
        const { canvas, ctx } = createOffscreenCanvas(TILE_SIZE, TILE_SIZE);
        const palette = getBiomePalette(biomeId);

        switch (terrainType) {
            case 'grass':
                this.drawGrass(ctx, palette.grass, palette.grassDark, variation);
                break;
            case 'water':
                this.drawWater(ctx, palette.water, palette.waterDeep, false, variation);
                break;
            case 'water_deep':
                this.drawWater(ctx, palette.water, palette.waterDeep, true, variation);
                break;
            case 'rock':
                this.drawRock(ctx, palette.rock, variation);
                break;
            case 'path':
                this.drawPath(ctx, palette.path, palette.dirt, variation);
                break;
            case 'sand':
                this.drawSand(ctx, palette.sand, variation);
                break;
            case 'dirt':
                this.drawDirt(ctx, palette.dirt, variation);
                break;
            case 'mud':
                this.drawMud(ctx, palette.dirt, variation);
                break;
            case 'snow':
                this.drawSnow(ctx, variation);
                break;
            case 'ice':
                this.drawIce(ctx, variation);
                break;
            case 'cave_floor':
                this.drawCaveFloor(ctx, palette.grass, variation);
                break;
            case 'cave_wall':
                this.drawCaveWall(ctx, palette.rock, variation);
                break;
            case 'dungeon_floor':
                this.drawDungeonFloor(ctx, variation);
                break;
            case 'dungeon_wall':
                this.drawDungeonWall(ctx, variation);
                break;
            default:
                this.drawDefault(ctx, variation);
        }

        return PIXI.Texture.from(canvas as HTMLCanvasElement);
    }

    // ========================================================================
    // Terrain Drawing Methods
    // ========================================================================

    private drawGrass(
        ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
        baseColor: RGB,
        darkColor: RGB,
        variation: number
    ): void {
        // Base fill with slight variation
        const lightMod = 0.95 + variation * 0.05;
        const base = adjustBrightness(baseColor, lightMod);
        ctx.fillStyle = rgbToHexString(base);
        ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

        // Add noise-based color variation
        for (let y = 0; y < TILE_SIZE; y += 4) {
            for (let x = 0; x < TILE_SIZE; x += 4) {
                const n = noise2D(x * 0.1 + variation, y * 0.1);
                if (n > 0.3) {
                    const brightness = 0.9 + n * 0.15;
                    ctx.fillStyle = rgbToHexString(adjustBrightness(base, brightness));
                    ctx.fillRect(x, y, 4, 4);
                }
            }
        }

        // Draw grass blades
        ctx.strokeStyle = rgbToHexString(darkColor);
        ctx.lineWidth = 1;

        const bladeCount = 3 + variation;
        for (let i = 0; i < bladeCount; i++) {
            const bx = simpleHash(i, variation, 1) * TILE_SIZE;
            const by = simpleHash(i, variation, 2) * TILE_SIZE * 0.6 + TILE_SIZE * 0.4;
            const height = 4 + simpleHash(i, variation, 3) * 6;

            ctx.beginPath();
            ctx.moveTo(bx, by);
            ctx.lineTo(bx + (simpleHash(i, variation, 4) - 0.5) * 3, by - height);
            ctx.stroke();
        }

        // Add subtle highlights
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        const highlightX = simpleHash(variation, 0, 5) * (TILE_SIZE - 8);
        const highlightY = simpleHash(variation, 0, 6) * (TILE_SIZE - 8);
        ctx.fillRect(highlightX, highlightY, 8, 8);
    }

    private drawWater(
        ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
        shallowColor: RGB,
        deepColor: RGB,
        isDeep: boolean,
        variation: number
    ): void {
        // Base color
        const base = isDeep ? deepColor : shallowColor;
        ctx.fillStyle = rgbToHexString(base);
        ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

        // Depth gradient (deeper toward center for shallow)
        if (!isDeep) {
            const gradient = ctx.createRadialGradient(
                TILE_SIZE / 2, TILE_SIZE / 2, 0,
                TILE_SIZE / 2, TILE_SIZE / 2, TILE_SIZE * 0.7
            );
            gradient.addColorStop(0, rgbToHexString(lerpColor(shallowColor, deepColor, 0.3)));
            gradient.addColorStop(1, rgbToHexString(shallowColor));
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
        }

        // Wave highlights
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        const waveY = 8 + variation * 5;
        const waveWidth = 12 + variation * 4;
        ctx.fillRect(4 + variation * 2, waveY, waveWidth, 2);

        // Secondary wave
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.fillRect(10 - variation, waveY + 10, waveWidth - 4, 2);

        // Dark ripples
        ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
        ctx.beginPath();
        ctx.arc(
            TILE_SIZE * 0.3 + variation * 3,
            TILE_SIZE * 0.7 - variation * 2,
            3,
            0,
            Math.PI * 2
        );
        ctx.fill();
    }

    private drawRock(
        ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
        baseColor: RGB,
        variation: number
    ): void {
        // Base fill
        ctx.fillStyle = rgbToHexString(baseColor);
        ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

        // Add cracks and texture
        const crackColor = rgbToHexString(adjustBrightness(baseColor, 0.7));
        const highlightColor = rgbToHexString(adjustBrightness(baseColor, 1.2));

        ctx.strokeStyle = crackColor;
        ctx.lineWidth = 1;

        // Draw 2-3 cracks
        const crackCount = 2 + (variation % 2);
        for (let i = 0; i < crackCount; i++) {
            ctx.beginPath();
            const startX = simpleHash(i, variation, 10) * TILE_SIZE;
            const startY = simpleHash(i, variation, 11) * TILE_SIZE * 0.3;
            ctx.moveTo(startX, startY);

            const midX = startX + (simpleHash(i, variation, 12) - 0.5) * 10;
            const midY = startY + TILE_SIZE * 0.4;
            ctx.lineTo(midX, midY);

            const endX = midX + (simpleHash(i, variation, 13) - 0.5) * 8;
            const endY = midY + TILE_SIZE * 0.3;
            ctx.lineTo(endX, endY);
            ctx.stroke();
        }

        // Add pebbles/bumps
        for (let i = 0; i < 3; i++) {
            const px = simpleHash(i, variation, 20) * (TILE_SIZE - 6) + 3;
            const py = simpleHash(i, variation, 21) * (TILE_SIZE - 6) + 3;
            const size = 2 + simpleHash(i, variation, 22) * 3;

            ctx.fillStyle = i % 2 === 0 ? crackColor : highlightColor;
            ctx.beginPath();
            ctx.arc(px, py, size, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    private drawPath(
        ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
        pathColor: RGB,
        dirtColor: RGB,
        variation: number
    ): void {
        // Base dirt
        ctx.fillStyle = rgbToHexString(dirtColor);
        ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

        // Packed earth pattern (cobblestone-like)
        // TODO(lint-intent): 'stoneColor' is declared but unused, suggesting an unfinished state/behavior hook in this block.
        // TODO(lint-intent): If the intent is still active, connect it to the nearby render/dispatch/condition so it matters.
        // TODO(lint-intent): Otherwise remove it or prefix with an underscore to record intentional unused state.
        const _stoneColor = rgbToHexString(adjustBrightness(pathColor, 1.1));
        // TODO(lint-intent): 'gapColor' is declared but unused, suggesting an unfinished state/behavior hook in this block.
        // TODO(lint-intent): If the intent is still active, connect it to the nearby render/dispatch/condition so it matters.
        // TODO(lint-intent): Otherwise remove it or prefix with an underscore to record intentional unused state.
        const _gapColor = rgbToHexString(adjustBrightness(pathColor, 0.8));

        // Draw cobblestone pattern
        for (let row = 0; row < 4; row++) {
            const offset = (row % 2) * 4;
            for (let col = 0; col < 5; col++) {
                const x = col * 8 - 2 + offset;
                const y = row * 8 + 2;
                const width = 6 + simpleHash(col, row + variation, 30) * 2;
                const height = 5 + simpleHash(col, row + variation, 31);

                const brightness = 0.9 + simpleHash(col, row + variation, 32) * 0.3;
                ctx.fillStyle = rgbToHexString(adjustBrightness(pathColor, brightness));

                ctx.beginPath();
                ctx.moveTo(x + 2, y);
                ctx.lineTo(x + width - 2, y);
                ctx.lineTo(x + width, y + 2);
                ctx.lineTo(x + width, y + height - 2);
                ctx.lineTo(x + width - 2, y + height);
                ctx.lineTo(x + 2, y + height);
                ctx.lineTo(x, y + height - 2);
                ctx.lineTo(x, y + 2);
                ctx.closePath();
                ctx.fill();
            }
        }
    }

    private drawSand(
        ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
        baseColor: RGB,
        variation: number
    ): void {
        // Base fill
        ctx.fillStyle = rgbToHexString(baseColor);
        ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

        // Sand ripple pattern
        ctx.strokeStyle = rgbToHexString(adjustBrightness(baseColor, 0.9));
        ctx.lineWidth = 1;

        const rippleCount = 3 + variation;
        for (let i = 0; i < rippleCount; i++) {
            const y = 4 + i * (TILE_SIZE / rippleCount);
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.bezierCurveTo(
                TILE_SIZE * 0.25, y - 2 + variation,
                TILE_SIZE * 0.75, y + 2 - variation,
                TILE_SIZE, y
            );
            ctx.stroke();
        }

        // Small grain details
        ctx.fillStyle = rgbToHexString(adjustBrightness(baseColor, 1.15));
        for (let i = 0; i < 5; i++) {
            const gx = simpleHash(i, variation, 40) * TILE_SIZE;
            const gy = simpleHash(i, variation, 41) * TILE_SIZE;
            ctx.fillRect(gx, gy, 1, 1);
        }
    }

    private drawDirt(
        ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
        baseColor: RGB,
        variation: number
    ): void {
        ctx.fillStyle = rgbToHexString(baseColor);
        ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

        // Darker patches
        ctx.fillStyle = rgbToHexString(adjustBrightness(baseColor, 0.8));
        for (let i = 0; i < 3; i++) {
            const px = simpleHash(i, variation, 50) * (TILE_SIZE - 8);
            const py = simpleHash(i, variation, 51) * (TILE_SIZE - 8);
            ctx.fillRect(px, py, 4 + variation, 4 + variation);
        }

        // Small pebbles
        ctx.fillStyle = rgbToHexString(adjustBrightness(baseColor, 1.2));
        for (let i = 0; i < 4; i++) {
            const px = simpleHash(i, variation, 52) * TILE_SIZE;
            const py = simpleHash(i, variation, 53) * TILE_SIZE;
            ctx.beginPath();
            ctx.arc(px, py, 1.5, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    private drawMud(
        ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
        baseColor: RGB,
        variation: number
    ): void {
        // Darker, wetter version of dirt
        const mudColor = adjustBrightness(baseColor, 0.6);
        ctx.fillStyle = rgbToHexString(mudColor);
        ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

        // Wet shine spots
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        for (let i = 0; i < 2; i++) {
            const px = simpleHash(i, variation, 60) * (TILE_SIZE - 10) + 5;
            const py = simpleHash(i, variation, 61) * (TILE_SIZE - 10) + 5;
            ctx.beginPath();
            ctx.ellipse(px, py, 5, 3, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        // Darker puddles
        ctx.fillStyle = rgbToHexString(adjustBrightness(mudColor, 0.7));
        const puddleX = 8 + variation * 4;
        const puddleY = 12 + variation * 2;
        ctx.beginPath();
        ctx.ellipse(puddleX, puddleY, 6, 4, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    private drawSnow(
        ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
        variation: number
    ): void {
        // White base with subtle blue tint
        ctx.fillStyle = '#f1f5f9';
        ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

        // Snow drifts/shadows
        ctx.fillStyle = '#cbd5e1';
        for (let i = 0; i < 2; i++) {
            const dx = simpleHash(i, variation, 70) * (TILE_SIZE - 12);
            const dy = simpleHash(i, variation, 71) * (TILE_SIZE - 8) + 4;
            ctx.beginPath();
            ctx.ellipse(dx + 6, dy, 8, 3, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        // Sparkle highlights
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        for (let i = 0; i < 3; i++) {
            const sx = simpleHash(i, variation, 72) * TILE_SIZE;
            const sy = simpleHash(i, variation, 73) * TILE_SIZE;
            ctx.fillRect(sx, sy, 2, 2);
        }
    }

    private drawIce(
        ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
        variation: number
    ): void {
        // Cyan-tinted base
        ctx.fillStyle = '#cffafe';
        ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

        // Crack lines
        ctx.strokeStyle = '#22d3ee';
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 1;

        ctx.beginPath();
        ctx.moveTo(0, TILE_SIZE * (0.3 + variation * 0.1));
        ctx.lineTo(TILE_SIZE, TILE_SIZE * (0.7 - variation * 0.1));
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(TILE_SIZE * 0.5, 0);
        ctx.lineTo(TILE_SIZE * (0.4 + variation * 0.1), TILE_SIZE);
        ctx.stroke();

        ctx.globalAlpha = 1.0;

        // Reflection highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.fillRect(4 + variation * 2, 4, 8, 4);
    }

    private drawCaveFloor(
        ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
        baseColor: RGB,
        variation: number
    ): void {
        ctx.fillStyle = rgbToHexString(baseColor);
        ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

        // Rocky texture
        ctx.fillStyle = rgbToHexString(adjustBrightness(baseColor, 0.8));
        for (let i = 0; i < 4; i++) {
            const rx = simpleHash(i, variation, 80) * TILE_SIZE;
            const ry = simpleHash(i, variation, 81) * TILE_SIZE;
            const rw = 3 + simpleHash(i, variation, 82) * 5;
            const rh = 2 + simpleHash(i, variation, 83) * 4;
            ctx.fillRect(rx, ry, rw, rh);
        }

        // Occasional shimmer (minerals)
        if (variation === 0) {
            ctx.fillStyle = 'rgba(200, 200, 255, 0.2)';
            ctx.fillRect(12, 8, 3, 3);
        }
    }

    private drawCaveWall(
        ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
        baseColor: RGB,
        variation: number
    ): void {
        // Dark base
        const wallColor = adjustBrightness(baseColor, 0.5);
        ctx.fillStyle = rgbToHexString(wallColor);
        ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

        // Rough texture
        ctx.fillStyle = rgbToHexString(adjustBrightness(wallColor, 1.3));
        for (let i = 0; i < 5; i++) {
            const rx = simpleHash(i, variation, 90) * TILE_SIZE;
            const ry = simpleHash(i, variation, 91) * TILE_SIZE;
            ctx.fillRect(rx, ry, 4, 4);
        }

        // Top highlight (3D effect)
        ctx.fillStyle = rgbToHexString(adjustBrightness(wallColor, 1.5));
        ctx.fillRect(0, 0, TILE_SIZE, 4);
    }

    private drawDungeonFloor(
        ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
        // TODO(lint-intent): 'variation' is an unused parameter, which suggests a planned input for this flow.
        // TODO(lint-intent): If the contract should consume it, thread it into the decision/transform path or document why it exists.
        // TODO(lint-intent): Otherwise rename it with a leading underscore or remove it if the signature can change.
        _variation: number
    ): void {
        // Stone tile pattern
        ctx.fillStyle = '#525252';
        ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

        // Tile grid lines
        ctx.strokeStyle = '#404040';
        ctx.lineWidth = 1;

        // Vertical
        ctx.beginPath();
        ctx.moveTo(TILE_SIZE / 2, 0);
        ctx.lineTo(TILE_SIZE / 2, TILE_SIZE);
        ctx.stroke();

        // Horizontal
        ctx.beginPath();
        ctx.moveTo(0, TILE_SIZE / 2);
        ctx.lineTo(TILE_SIZE, TILE_SIZE / 2);
        ctx.stroke();

        // Corner accent
        ctx.fillStyle = '#3f3f46';
        ctx.fillRect(0, 0, 3, 3);
        ctx.fillRect(TILE_SIZE - 3, 0, 3, 3);
        ctx.fillRect(0, TILE_SIZE - 3, 3, 3);
        ctx.fillRect(TILE_SIZE - 3, TILE_SIZE - 3, 3, 3);
    }

    private drawDungeonWall(
        ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
        variation: number
    ): void {
        // Brick pattern
        ctx.fillStyle = '#3f3f46';
        ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

        // Brick rows
        const brickHeight = 8;
        const brickWidth = 16;

        for (let row = 0; row < 4; row++) {
            const offset = (row % 2) * (brickWidth / 2);
            for (let col = -1; col < 3; col++) {
                const x = col * brickWidth + offset;
                const y = row * brickHeight;

                const brightness = 0.9 + simpleHash(col, row + variation, 100) * 0.2;
                ctx.fillStyle = `rgba(87, 83, 78, ${brightness})`;
                ctx.fillRect(x + 1, y + 1, brickWidth - 2, brickHeight - 2);
            }
        }

        // Mortar highlight on top
        ctx.fillStyle = '#52525b';
        ctx.fillRect(0, 0, TILE_SIZE, 2);
    }

    private drawDefault(
        ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
        // TODO(lint-intent): 'variation' is an unused parameter, which suggests a planned input for this flow.
        // TODO(lint-intent): If the contract should consume it, thread it into the decision/transform path or document why it exists.
        // TODO(lint-intent): Otherwise rename it with a leading underscore or remove it if the signature can change.
        _variation: number
    ): void {
        ctx.fillStyle = '#374151';
        ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

        // Question mark for unknown terrain
        ctx.fillStyle = '#6b7280';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('?', TILE_SIZE / 2, TILE_SIZE / 2);
    }

    // ========================================================================
    // Cache Management
    // ========================================================================

    private evictOldest(cache: Map<string, PIXI.Texture>): void {
        const firstKey = cache.keys().next().value;
        if (firstKey) {
            const tex = cache.get(firstKey);
            tex?.destroy(true);
            cache.delete(firstKey);
        }
    }

    /**
     * Get cache statistics for debugging.
     */
    public getStats(): { terrain: number; doodad: number; blend: number } {
        return {
            terrain: this.terrainCache.size,
            doodad: this.doodadCache.size,
            blend: this.blendCache.size,
        };
    }
}

// Default singleton instance
let defaultManager: TextureAtlasManager | null = null;

export function getTextureManager(seed?: number): TextureAtlasManager {
    if (!defaultManager || seed !== undefined) {
        defaultManager = new TextureAtlasManager(seed);
    }
    return defaultManager;
}
