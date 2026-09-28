/**
 * @file src/rendering2d/lightPool.ts
 * The 2D night pass. It dims the map and then adds light pools.
 *
 * Salvaged from the RealmSmith OverlayPainter (retired 2026-09-14).
 * The source read RealmSmith tiles and buildings. This file does not.
 * The caller collects the lights. This file only draws them.
 *
 * Intended consumer: the next-gen 2D combat map (Pixi prototype, ?pixiboard=1).
 */

/** The part of CanvasRenderingContext2D that the night pass uses. */
export interface LightPool2DContext {
    fillStyle: string | CanvasGradient | CanvasPattern;
    globalAlpha: number;
    globalCompositeOperation: string;
    fillRect(x: number, y: number, w: number, h: number): void;
    beginPath(): void;
    arc(x: number, y: number, r: number, start: number, end: number): void;
    fill(): void;
    createRadialGradient(
        x0: number,
        y0: number,
        r0: number,
        x1: number,
        y1: number,
        r1: number
    ): CanvasGradient;
}

/** One light pool on the map. All values are in pixels. */
export interface LightSource {
    /** The center of the pool on the x axis. */
    x: number;
    /** The center of the pool on the y axis. */
    y: number;
    /** The radius of the pool. */
    radius: number;
    /** The color at the center of the pool. */
    color: string;
    /** The strength of the pool, from 0 to 1. The default is 0.6. */
    intensity?: number;
}

/** The dark tint that covers the map at night. */
export const NIGHT_TINT = 'rgba(11, 15, 25, 0.75)';

/**
 * The light that each known source gives off.
 * The values come from the retired RealmSmith night pass.
 * A caller maps its own object types onto these preset names.
 * The radius is a multiple of the tile size.
 */
export const LIGHT_PRESETS: Record<
    string,
    { radiusInTiles: number; color: string; intensity: number }
> = {
    /** A church or a shrine. Cool blue light. */
    holy_blue: { radiusInTiles: 3, color: '#3b82f6', intensity: 0.4 },
    /** A temple. Warm gold light. */
    holy_gold: { radiusInTiles: 3, color: '#facc15', intensity: 0.5 },
    /** An alchemist. Pale violet light. */
    alchemy: { radiusInTiles: 2.5, color: '#d8b4fe', intensity: 0.5 },
    /** A library or a jeweler. Cold white light. */
    study: { radiusInTiles: 2, color: '#e0f2fe', intensity: 0.4 },
    /** A bakery oven. Strong orange light. */
    oven: { radiusInTiles: 2, color: '#f97316', intensity: 0.6 },
    /** A plain lit window. The default building light. */
    window: { radiusInTiles: 1.5, color: '#f59e0b', intensity: 0.5 },
    /** A lava tile. Red ground light. */
    lava: { radiusInTiles: 1.5, color: '#ef4444', intensity: 0.4 },
    /** A crystal floor tile. Faint cyan ground light. */
    crystal_floor: { radiusInTiles: 1, color: '#06b6d4', intensity: 0.2 },
    /** A street lamp. The brightest pool on the map. */
    street_lamp: { radiusInTiles: 2.5, color: '#fbbf24', intensity: 0.7 },
    /** A crystal doodad. Bright cyan light. */
    crystal: { radiusInTiles: 1.5, color: '#22d3ee', intensity: 0.5 },
};

/** The name of every light preset. */
export type LightPresetName = keyof typeof LIGHT_PRESETS;

/**
 * Builds one light source from a preset.
 *
 * @param preset    The preset name.
 * @param x         The center of the pool on the x axis, in pixels.
 * @param y         The center of the pool on the y axis, in pixels.
 * @param tileSize  The tile size in pixels. The preset radius scales with it.
 */
export function lightFromPreset(
    preset: string,
    x: number,
    y: number,
    tileSize: number
): LightSource | null {
    const spec = LIGHT_PRESETS[preset];
    if (!spec) return null;
    return {
        x,
        y,
        radius: spec.radiusInTiles * tileSize,
        color: spec.color,
        intensity: spec.intensity,
    };
}

/**
 * Draws one light pool.
 * The pool is a radial gradient. It fades to full transparency at the edge.
 * The caller must set the composite mode before the call.
 */
export function drawLight(ctx: LightPool2DContext, light: LightSource): void {
    const grad = ctx.createRadialGradient(
        light.x,
        light.y,
        1,
        light.x,
        light.y,
        light.radius
    );
    grad.addColorStop(0, light.color);
    grad.addColorStop(1, 'rgba(0,0,0,0)');

    ctx.fillStyle = grad;
    ctx.globalAlpha = light.intensity ?? 0.6;
    ctx.beginPath();
    ctx.arc(light.x, light.y, light.radius, 0, Math.PI * 2);
    ctx.fill();
}

/** The settings of one night pass. */
export interface NightOverlayOptions {
    /** The width of the map in pixels. */
    width: number;
    /** The height of the map in pixels. */
    height: number;
    /** Every light pool on the map. */
    lights: LightSource[];
    /** The dark tint. The default is NIGHT_TINT. */
    tint?: string;
}

/**
 * Draws the night pass.
 * The pass first covers the map with a dark tint.
 * The pass then adds every light pool in screen blend mode.
 * The pass restores the alpha and the composite mode at the end.
 */
export function drawNightOverlay(
    ctx: LightPool2DContext,
    options: NightOverlayOptions
): void {
    ctx.fillStyle = options.tint ?? NIGHT_TINT;
    ctx.fillRect(0, 0, options.width, options.height);

    ctx.globalCompositeOperation = 'screen';
    for (const light of options.lights) {
        drawLight(ctx, light);
    }

    ctx.globalAlpha = 1.0;
    ctx.globalCompositeOperation = 'source-over';
}
