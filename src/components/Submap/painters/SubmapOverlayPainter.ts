/**
 * @file src/components/Submap/painters/SubmapOverlayPainter.ts
 * Handles overlay effects for the submap: day/night cycle, fog, vignette.
 */

import 'pixi.js/unsafe-eval'; // CSP patch
import * as PIXI from 'pixi.js';
// TODO(lint-intent): 'TILE_SIZE' is imported but unused; it hints at a helper/type the module was meant to use.
// TODO(lint-intent): If the planned feature is still relevant, wire it into the data flow or typing in this file.
// TODO(lint-intent): Otherwise drop the import to keep the module surface intentional.
import { TILE_SIZE as _TILE_SIZE, getBiomePalette as _getBiomePalette, rgbToHex as _rgbToHex } from './shared';

// ============================================================================
// Types
// ============================================================================

export type TimeOfDay = 'dawn' | 'day' | 'dusk' | 'night';

export interface OverlayConfig {
    timeOfDay: TimeOfDay;
    biomeId: string;
    enableVignette?: boolean;
    enableFog?: boolean;
    fogDensity?: number;
}

// Blend mode type for PixiJS v8
type BlendModeValue = 'normal' | 'multiply' | 'screen' | 'overlay' | 'soft-light';

// ============================================================================
// SubmapOverlayPainter Class
// ============================================================================

export class SubmapOverlayPainter {
    private overlayContainer: PIXI.Container | null = null;
    private dayNightOverlay: PIXI.Graphics | null = null;
    private vignetteOverlay: PIXI.Graphics | null = null;
    private fogOverlay: PIXI.Graphics | null = null;

    constructor() { }

    /**
     * Create all overlay layers.
     */
    public createOverlays(
        width: number,
        height: number,
        config: OverlayConfig
    ): PIXI.Container {
        this.overlayContainer = new PIXI.Container();

        // Day/night overlay
        this.dayNightOverlay = this.createDayNightOverlay(width, height, config.timeOfDay, config.biomeId);
        this.overlayContainer.addChild(this.dayNightOverlay);

        // Fog overlay (optional)
        if (config.enableFog && config.fogDensity) {
            this.fogOverlay = this.createFogOverlay(width, height, config.fogDensity);
            this.overlayContainer.addChild(this.fogOverlay);
        }

        // Vignette overlay (optional)
        if (config.enableVignette) {
            this.vignetteOverlay = this.createVignetteOverlay(width, height);
            this.overlayContainer.addChild(this.vignetteOverlay);
        }

        return this.overlayContainer;
    }

    /**
     * Update overlays for time of day change.
     */
    public updateTimeOfDay(
        width: number,
        height: number,
        timeOfDay: TimeOfDay,
        biomeId: string
    ): void {
        if (this.dayNightOverlay) {
            this.dayNightOverlay.clear();
            this.drawDayNightOverlay(this.dayNightOverlay, width, height, timeOfDay, biomeId);
        }
    }

    // ========================================================================
    // Day/Night Overlay
    // ========================================================================

    private createDayNightOverlay(
        width: number,
        height: number,
        timeOfDay: TimeOfDay,
        biomeId: string
    ): PIXI.Graphics {
        const graphics = new PIXI.Graphics();
        this.drawDayNightOverlay(graphics, width, height, timeOfDay, biomeId);
        return graphics;
    }

    private drawDayNightOverlay(
        graphics: PIXI.Graphics,
        width: number,
        height: number,
        timeOfDay: TimeOfDay,
        biomeId: string
    ): void {
        const config = this.getTimeConfig(timeOfDay);
        const biomeAdjustment = this.getBiomeColorAdjustment(biomeId);

        if (config.alpha === 0) {
            return; // Day - no overlay
        }

        // Apply biome-specific color adjustment
        const adjustedColor = this.blendColors(config.color, biomeAdjustment.color, biomeAdjustment.strength);

        graphics.rect(0, 0, width, height);
        graphics.fill({ color: adjustedColor, alpha: config.alpha });

        // Set blend mode based on time (PixiJS v8 uses string values)
        graphics.blendMode = config.blendMode;
    }

    private getTimeConfig(timeOfDay: TimeOfDay): {
        color: number;
        alpha: number;
        blendMode: BlendModeValue;
    } {
        switch (timeOfDay) {
            case 'dawn':
                return {
                    color: 0xffcc88, // Warm orange
                    alpha: 0.15,
                    blendMode: 'soft-light',
                };
            case 'day':
                return {
                    color: 0xffffff,
                    alpha: 0,
                    blendMode: 'normal',
                };
            case 'dusk':
                return {
                    color: 0xb45309, // Deep amber
                    alpha: 0.25,
                    blendMode: 'overlay',
                };
            case 'night':
                return {
                    color: 0x1e1b4b, // Deep indigo
                    alpha: 0.45,
                    blendMode: 'multiply',
                };
            default:
                return {
                    color: 0xffffff,
                    alpha: 0,
                    blendMode: 'normal',
                };
        }
    }

    private getBiomeColorAdjustment(biomeId: string): {
        color: number;
        strength: number;
    } {
        switch (biomeId) {
            case 'swamp':
                return { color: 0x2d4a3e, strength: 0.2 }; // Murky green
            case 'desert':
                return { color: 0xffd699, strength: 0.1 }; // Warm sand
            case 'cave':
            case 'dungeon':
                return { color: 0x1a1a2e, strength: 0.3 }; // Dark blue-gray
            case 'ocean':
                return { color: 0x1e3a5f, strength: 0.15 }; // Ocean blue
            case 'mountain':
                return { color: 0x9ca3af, strength: 0.1 }; // Cool gray
            default:
                return { color: 0xffffff, strength: 0 };
        }
    }

    private blendColors(color1: number, color2: number, factor: number): number {
        if (factor === 0) return color1;

        const r1 = (color1 >> 16) & 0xff;
        const g1 = (color1 >> 8) & 0xff;
        const b1 = color1 & 0xff;

        const r2 = (color2 >> 16) & 0xff;
        const g2 = (color2 >> 8) & 0xff;
        const b2 = color2 & 0xff;

        const r = Math.round(r1 + (r2 - r1) * factor);
        const g = Math.round(g1 + (g2 - g1) * factor);
        const b = Math.round(b1 + (b2 - b1) * factor);

        return (r << 16) | (g << 8) | b;
    }

    // ========================================================================
    // Vignette Overlay
    // ========================================================================

    private createVignetteOverlay(width: number, height: number): PIXI.Graphics {
        const graphics = new PIXI.Graphics();

        // Create radial gradient-like effect using concentric shapes
        const cx = width / 2;
        const cy = height / 2;
        const maxRadius = Math.sqrt(cx * cx + cy * cy);

        const steps = 10;
        for (let i = steps; i >= 0; i--) {
            const t = i / steps;
            const radius = maxRadius * (0.6 + t * 0.4);
            const alpha = (1 - t) * 0.3;

            graphics.ellipse(cx, cy, radius, radius * (height / width));
            graphics.fill({ color: 0x000000, alpha });
        }

        // Note: PixiJS v8 doesn't support beginHole/endHole in the same way
        // The layered approach above creates a similar effect

        return graphics;
    }

    // ========================================================================
    // Fog Overlay
    // ========================================================================

    private createFogOverlay(width: number, height: number, density: number): PIXI.Graphics {
        const graphics = new PIXI.Graphics();

        // Simple fog using semi-transparent white patches
        const patchCount = Math.floor(density * 20);

        for (let i = 0; i < patchCount; i++) {
            const x = Math.random() * width;
            const y = Math.random() * height;
            const size = 30 + Math.random() * 60;
            const alpha = 0.1 + Math.random() * 0.2 * density;

            graphics.ellipse(x, y, size, size * 0.5);
            graphics.fill({ color: 0xffffff, alpha });
        }

        graphics.blendMode = 'screen';
        return graphics;
    }

    // ========================================================================
    // Cleanup
    // ========================================================================

    public destroy(): void {
        this.overlayContainer?.destroy({ children: true });
        this.overlayContainer = null;
        this.dayNightOverlay = null;
        this.vignetteOverlay = null;
        this.fogOverlay = null;
    }
}
