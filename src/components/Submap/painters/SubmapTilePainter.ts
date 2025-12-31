/**
 * @file src/components/Submap/painters/SubmapTilePainter.ts
 * Paints terrain tiles for the PixiJS submap renderer.
 * Handles base terrain, edge blending, and terrain-specific effects.
 */

import 'pixi.js/unsafe-eval'; // CSP patch
import * as PIXI from 'pixi.js';
import {
    TILE_SIZE,
    getBiomePalette,
    getNeighbors,
    simpleHash,
    // TODO(lint-intent): 'noise2D' is declared but unused, suggesting an unfinished state/behavior hook in this block.
    // TODO(lint-intent): If the intent is still active, connect it to the nearby render/dispatch/condition so it matters.
    // TODO(lint-intent): Otherwise remove it or prefix with an underscore to record intentional unused state.
    noise2D as _noise2D,
    // TODO(lint-intent): 'lerpColor' is declared but unused, suggesting an unfinished state/behavior hook in this block.
    // TODO(lint-intent): If the intent is still active, connect it to the nearby render/dispatch/condition so it matters.
    // TODO(lint-intent): Otherwise remove it or prefix with an underscore to record intentional unused state.
    lerpColor as _lerpColor,
    rgbToHex,
    // TODO(lint-intent): 'hexToRgb' is declared but unused, suggesting an unfinished state/behavior hook in this block.
    // TODO(lint-intent): If the intent is still active, connect it to the nearby render/dispatch/condition so it matters.
    // TODO(lint-intent): Otherwise remove it or prefix with an underscore to record intentional unused state.
    hexToRgb as _hexToRgb,
    // TODO(lint-intent): 'RGB' is declared but unused, suggesting an unfinished state/behavior hook in this block.
    // TODO(lint-intent): If the intent is still active, connect it to the nearby render/dispatch/condition so it matters.
    // TODO(lint-intent): Otherwise remove it or prefix with an underscore to record intentional unused state.
    type RGB as _RGB,
    type NeighborInfo,
} from './shared';
import { TextureAtlasManager, TerrainType, getTextureManager } from './TextureAtlasManager';

// ============================================================================
// Types
// ============================================================================

export interface TileRenderData {
    x: number;
    y: number;
    terrainType: string;
    effectiveTerrainType: string;
    biomeId: string;
    variation: number;
    elevation: number;
    isPath: boolean;
}

export interface TileRenderResult {
    sprite: PIXI.Sprite;
    blendSprites?: PIXI.Sprite[];
}

// Mapping from semantic terrain types to render types
const TERRAIN_TYPE_MAP: Record<string, TerrainType> = {
    // WFC/CA terrain types
    'grass': 'grass',
    'path': 'path',
    'water': 'water',
    'rock': 'rock',
    'floor': 'cave_floor',
    'wall': 'cave_wall',

    // Effective terrain types from seeded features
    'water_shallow': 'water',
    'water_deep': 'water_deep',
    'dense_forest': 'grass',
    'sparse_forest': 'grass',
    'stone_area': 'rock',
    'rocky_terrain': 'rock',
    'village_area': 'path',
    'oasis': 'water',
    'kelp': 'water_deep',
    'reef': 'water',
    'island': 'sand',
    'snowy_patch': 'snow',
    'mineral_area': 'rock',
    'dense_reeds': 'grass',
    'ruin_fragment': 'rock',
    'campsite': 'dirt',
    'boulder_field': 'rock',
    'dunes': 'sand',

    // Biome-specific defaults
    'default': 'grass',
};

// ============================================================================
// SubmapTilePainter Class
// ============================================================================

export class SubmapTilePainter {
    private textureManager: TextureAtlasManager;
    private animationTime: number = 0;

    constructor(textureManager?: TextureAtlasManager) {
        this.textureManager = textureManager || getTextureManager();
    }

    /**
     * Render a single tile to a PIXI sprite.
     */
    public renderTile(data: TileRenderData): TileRenderResult {
        const renderType = this.getTerrainRenderType(data.terrainType, data.effectiveTerrainType, data.biomeId);
        const variation = Math.floor(simpleHash(data.x, data.y, 1234) * 4);

        const texture = this.textureManager.getTerrainTexture(renderType, data.biomeId, variation);
        const sprite = new PIXI.Sprite(texture);

        sprite.x = data.x * TILE_SIZE;
        sprite.y = data.y * TILE_SIZE;
        sprite.width = TILE_SIZE;
        sprite.height = TILE_SIZE;

        // Apply slight tint variation based on position
        const tintVariation = 0.95 + simpleHash(data.x, data.y, 5678) * 0.1;
        sprite.tint = this.applyTintVariation(0xffffff, tintVariation);

        return { sprite };
    }

    /**
     * Render an entire grid of tiles.
     */
    public renderGrid(
        grid: string[][],
        biomeId: string,
        container: PIXI.Container
    ): void {
        const rows = grid.length;
        const cols = grid[0]?.length ?? 0;

        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                const terrainType = grid[y][x];
                const result = this.renderTile({
                    x,
                    y,
                    terrainType,
                    effectiveTerrainType: terrainType,
                    biomeId,
                    variation: simpleHash(x, y, 111),
                    elevation: 0.5,
                    isPath: terrainType === 'path',
                });

                container.addChild(result.sprite);
            }
        }
    }

    /**
     * Render tiles with edge blending between different terrain types.
     */
    public renderGridWithBlending(
        grid: string[][],
        biomeId: string,
        baseContainer: PIXI.Container,
        blendContainer: PIXI.Container
    ): void {
        const rows = grid.length;
        const cols = grid[0]?.length ?? 0;

        // First pass: render base tiles
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                const terrainType = grid[y][x];
                const result = this.renderTile({
                    x,
                    y,
                    terrainType,
                    effectiveTerrainType: terrainType,
                    biomeId,
                    variation: simpleHash(x, y, 111),
                    elevation: 0.5,
                    isPath: terrainType === 'path',
                });

                baseContainer.addChild(result.sprite);
            }
        }

        // Second pass: render edge blending
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                const terrainType = grid[y][x];
                const neighbors = getNeighbors(grid, x, y);

                const blendSprites = this.createBlendEdges(
                    x, y,
                    terrainType,
                    neighbors,
                    biomeId
                );

                blendSprites.forEach(sprite => blendContainer.addChild(sprite));
            }
        }
    }

    /**
     * Create edge blend sprites for smooth transitions.
     */
    private createBlendEdges(
        x: number,
        y: number,
        currentType: string,
        neighbors: NeighborInfo,
        biomeId: string
    ): PIXI.Sprite[] {
        const sprites: PIXI.Sprite[] = [];
        const currentRender = this.getTerrainRenderType(currentType, currentType, biomeId);

        // Check each cardinal neighbor for blend needs
        const directions = [
            { key: 'north' as const, dx: 0, dy: -1 },
            { key: 'south' as const, dx: 0, dy: 1 },
            { key: 'east' as const, dx: 1, dy: 0 },
            { key: 'west' as const, dx: -1, dy: 0 },
        ];

        for (const dir of directions) {
            const neighborType = neighbors[dir.key];
            if (!neighborType) continue;

            const neighborRender = this.getTerrainRenderType(neighborType, neighborType, biomeId);

            // Only blend if different terrain types
            if (currentRender !== neighborRender && this.shouldBlend(currentRender, neighborRender)) {
                const blendSprite = this.createDirectionalBlend(
                    x, y,
                    dir.key,
                    currentRender,
                    neighborRender,
                    biomeId
                );
                if (blendSprite) {
                    sprites.push(blendSprite);
                }
            }
        }

        return sprites;
    }

    /**
     * Determine if two terrain types should blend.
     */
    private shouldBlend(type1: TerrainType, type2: TerrainType): boolean {
        // Water doesn't blend smoothly with most things
        const waterTypes = new Set(['water', 'water_deep']);
        const solidTypes = new Set(['rock', 'cave_wall', 'dungeon_wall']);

        if (waterTypes.has(type1) && waterTypes.has(type2)) {
            return true; // Water types blend
        }

        if (waterTypes.has(type1) !== waterTypes.has(type2)) {
            return true; // Water/land boundary - use shore effect
        }

        if (solidTypes.has(type1) || solidTypes.has(type2)) {
            return false; // Walls don't blend
        }

        return true;
    }

    /**
     * Create a directional blend sprite.
     */
    private createDirectionalBlend(
        x: number,
        y: number,
        direction: 'north' | 'south' | 'east' | 'west',
        currentType: TerrainType,
        neighborType: TerrainType,
        biomeId: string
    ): PIXI.Sprite | null {
        // TODO(lint-intent): 'palette' is declared but unused, suggesting an unfinished state/behavior hook in this block.
        // TODO(lint-intent): If the intent is still active, connect it to the nearby render/dispatch/condition so it matters.
        // TODO(lint-intent): Otherwise remove it or prefix with an underscore to record intentional unused state.
        const _palette = getBiomePalette(biomeId);

        // Create a gradient mask sprite
        const graphics = new PIXI.Graphics();
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;

        // Get the neighbor's color
        const neighborColor = this.getTerrainColor(neighborType, biomeId);

        // Draw a gradient from the edge
        const blendSize = 8; // How far the blend extends

        graphics.beginFill(neighborColor, 0.5);

        switch (direction) {
            case 'north':
                graphics.drawRect(px, py, TILE_SIZE, blendSize);
                break;
            case 'south':
                graphics.drawRect(px, py + TILE_SIZE - blendSize, TILE_SIZE, blendSize);
                break;
            case 'east':
                graphics.drawRect(px + TILE_SIZE - blendSize, py, blendSize, TILE_SIZE);
                break;
            case 'west':
                graphics.drawRect(px, py, blendSize, TILE_SIZE);
                break;
        }

        graphics.endFill();

        // Apply alpha gradient via mask or just return with lowered alpha
        // TODO(lint-intent): 'texture' is declared but unused, suggesting an unfinished state/behavior hook in this block.
        // TODO(lint-intent): If the intent is still active, connect it to the nearby render/dispatch/condition so it matters.
        // TODO(lint-intent): Otherwise remove it or prefix with an underscore to record intentional unused state.
        const _texture = PIXI.RenderTexture.create({ width: TILE_SIZE, height: TILE_SIZE });

        // For simplicity, use graphics directly with reduced alpha
        // In production, you'd use proper gradient masks
        graphics.alpha = 0.3;

        const sprite = new PIXI.Sprite(PIXI.Texture.WHITE);
        sprite.x = px;
        sprite.y = py;
        sprite.width = TILE_SIZE;
        sprite.height = TILE_SIZE;
        sprite.tint = neighborColor;
        sprite.alpha = 0;

        // Return the graphics as a "sprite" by converting
        // Actually return the graphics object cast appropriately
        return null; // Simplified - full blending would use render textures
    }

    /**
     * Get the primary color for a terrain type.
     */
    private getTerrainColor(type: TerrainType, biomeId: string): number {
        const palette = getBiomePalette(biomeId);

        switch (type) {
            case 'grass':
                return rgbToHex(palette.grass);
            case 'water':
            case 'water_deep':
                return rgbToHex(palette.water);
            case 'rock':
            case 'cave_wall':
            case 'dungeon_wall':
                return rgbToHex(palette.rock);
            case 'path':
            case 'dirt':
                return rgbToHex(palette.path);
            case 'sand':
                return rgbToHex(palette.sand);
            default:
                return 0x808080;
        }
    }

    /**
     * Map semantic terrain type to render type.
     */
    private getTerrainRenderType(
        gridType: string,
        effectiveType: string,
        biomeId: string
    ): TerrainType {
        // Check effective type first (from seeded features)
        if (TERRAIN_TYPE_MAP[effectiveType]) {
            return TERRAIN_TYPE_MAP[effectiveType];
        }

        // Then grid type
        if (TERRAIN_TYPE_MAP[gridType]) {
            return TERRAIN_TYPE_MAP[gridType];
        }

        // Biome-specific defaults
        if (biomeId === 'cave') {
            return gridType === 'wall' ? 'cave_wall' : 'cave_floor';
        }
        if (biomeId === 'dungeon') {
            return gridType === 'wall' ? 'dungeon_wall' : 'dungeon_floor';
        }
        if (biomeId === 'desert') {
            return 'sand';
        }
        if (biomeId === 'ocean') {
            return 'water';
        }

        return 'grass';
    }

    /**
     * Apply tint variation to a color.
     */
    private applyTintVariation(baseColor: number, factor: number): number {
        const r = Math.min(255, Math.floor(((baseColor >> 16) & 0xff) * factor));
        const g = Math.min(255, Math.floor(((baseColor >> 8) & 0xff) * factor));
        const b = Math.min(255, Math.floor((baseColor & 0xff) * factor));
        return (r << 16) | (g << 8) | b;
    }

    // ========================================================================
    // Animation Support
    // ========================================================================

    /**
     * Update water animation state.
     * Call this from the animation ticker.
     */
    public updateWaterAnimation(delta: number): void {
        this.animationTime += delta * 0.016; // Normalize to ~60fps
    }

    /**
     * Get water wave offset for a tile position.
     */
    public getWaterOffset(x: number, y: number): { x: number; y: number } {
        const waveSpeed = 2;
        const waveAmplitude = 1;

        const phase = (x + y) * 0.5 + this.animationTime * waveSpeed;
        return {
            x: Math.sin(phase) * waveAmplitude,
            y: Math.cos(phase * 0.7) * waveAmplitude * 0.5,
        };
    }

    /**
     * Apply water animation to a sprite.
     */
    public applyWaterAnimation(sprite: PIXI.Sprite, x: number, y: number): void {
        const offset = this.getWaterOffset(x, y);
        sprite.x = x * TILE_SIZE + offset.x;
        sprite.y = y * TILE_SIZE + offset.y;

        // Subtle alpha shimmer
        const shimmer = 0.9 + Math.sin(this.animationTime * 3 + x + y) * 0.1;
        sprite.alpha = shimmer;
    }

    // ========================================================================
    // Special Effects
    // ========================================================================

    /**
     * Create a water shore/foam effect sprite.
     */
    public createShoreEffect(
        x: number,
        y: number,
        direction: 'north' | 'south' | 'east' | 'west'
    ): PIXI.Graphics {
        const graphics = new PIXI.Graphics();
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;

        graphics.beginFill(0xffffff, 0.3);

        const foamWidth = 4;
        switch (direction) {
            case 'north':
                graphics.drawRect(px, py, TILE_SIZE, foamWidth);
                break;
            case 'south':
                graphics.drawRect(px, py + TILE_SIZE - foamWidth, TILE_SIZE, foamWidth);
                break;
            case 'east':
                graphics.drawRect(px + TILE_SIZE - foamWidth, py, foamWidth, TILE_SIZE);
                break;
            case 'west':
                graphics.drawRect(px, py, foamWidth, TILE_SIZE);
                break;
        }

        graphics.endFill();
        return graphics;
    }

    /**
     * Create path highlighting effect.
     */
    public createPathHighlight(x: number, y: number, color: number = 0xffd700): PIXI.Graphics {
        const graphics = new PIXI.Graphics();
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;

        graphics.beginFill(color, 0.3);
        graphics.drawRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4);
        graphics.endFill();

        graphics.lineStyle(2, color, 0.6);
        graphics.drawRect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2);

        return graphics;
    }
}
