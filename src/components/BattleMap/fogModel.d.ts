/**
 * @file fogModel.ts
 * Shared fog-of-war / lighting math for the 2D battle board.
 *
 * Both the DOM fog canvas (BattleMapFogCanvas) and the PixiJS prototype paint
 * the exact same night-blue fog. This module is the single source of that
 * math: how dark a tile paints given its visibility and light level, the ink
 * color, and a row-major alpha grid the renderers upscale.
 */
import type { BattleMapData, LightLevel } from '../../types/combat';
/** How dark a tile paints: 0 = fully lit, up to 0.55 = unseen. */
export declare const fogAlpha: (visible: boolean, light: LightLevel) => number;
/**
 * The fog ink color, as data so both renderers use the same night-blue.
 * Deliberately BLUE, not near-black: over green or brown terrain a near-black
 * veil reads as painted dirt/shadow smears; a slate-blue veil reads as
 * "outside your sight" — a vision statement, not a terrain feature.
 */
export declare const FOG_TINT: {
    readonly r: 22;
    readonly g: 34;
    readonly b: 64;
};
/**
 * Fog ink over WATER tiles. The slate ink that works on grass muddies blue
 * water into gray-green murk; staying in the water's own hue family makes
 * hidden water read as "darker water you can't see", not a stain on it.
 */
export declare const FOG_TINT_WATER: {
    readonly r: 8;
    readonly g: 20;
    readonly b: 58;
};
export interface FogAlphaGrid {
    width: number;
    height: number;
    /** Row-major: alphas[y * width + x]. Exact JS doubles so 0.6 reads back as 0.6. */
    alphas: number[];
}
export declare const buildFogAlphaGrid: (mapData: BattleMapData, visibleTiles: Set<string>, getLightLevel: (tileId: string) => LightLevel) => FogAlphaGrid;
/**
 * Blur the fog grid before upscaling. The raw grid is tile-exact, so any
 * diagonal visibility boundary (a sightline breaking over a rising crest) is
 * a one-tile staircase — bilinear upscale feathers each step but cannot
 * remove the teeth. A 3×3 weighted blur (repeatable) melts the steps into
 * one continuous penumbra while staying close to the referee's truth:
 * fully-lit and fully-hidden interiors keep their exact values.
 *
 * Honesty bound (2 passes, measured by fogModel.test.ts "blur honesty bound"):
 * a fully-hidden cell's alpha (exact 0.55) is pulled by more than 0.05 only
 * within 1 tile of a straight sight boundary, and within at most 2 tiles at a
 * concave boundary corner (light wrapping the cell on two sides). Beyond 2
 * tiles from any lit cell the fog is exactly the referee's value. Raising the
 * pass count widens this bound — the test guards the <=2 promise.
 */
export declare const blurFogAlphaGrid: (grid: FogAlphaGrid, passes?: number) => FogAlphaGrid;
