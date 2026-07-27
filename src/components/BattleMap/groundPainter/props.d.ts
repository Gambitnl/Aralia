/**
 * @file groundPainter/props.ts
 * Deterministic hash + sprite-stamp helpers and the hand-drawn top-down prop
 * drawers (trees, bushes, tufts, logs, rocks, cacti, stalagmites, pillars,
 * pines, crystals, mangroves) with their per-biome palettes.
 *
 * Extracted verbatim from groundPainter.ts so both the DOM <canvas> renderer
 * and the PixiJS prototype share the exact same procedural art. The paint
 * pipeline composes these; nothing here reaches outside the 2D canvas context.
 */
export declare const rand: (x: number, y: number, salt: number) => number;
export declare const stamp: (ctx: CanvasRenderingContext2D, img: HTMLImageElement, cx: number, cy: number, targetW: number, rot: number) => void;
export declare const pick: (arr: HTMLImageElement[] | undefined, x: number, y: number, salt: number) => HTMLImageElement | null;
export declare const drawTree: (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, seed: number) => void;
interface BushPalette {
    dark: string;
    mid: string;
    light: string;
}
export declare const BUSH_FOREST: BushPalette;
export declare const BUSH_SWAMP: BushPalette;
export declare const BUSH_DESERT: BushPalette;
export declare const drawBush: (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, seed: number, pal?: BushPalette) => void;
export declare const drawTuft: (ctx: CanvasRenderingContext2D, tile: {
    coordinates: {
        x: number;
        y: number;
    };
}, tileSize: number, seed: number, light: string, dark: string, chance: number) => void;
export declare const drawLog: (ctx: CanvasRenderingContext2D, cx: number, cy: number, len: number, seed: number) => void;
interface RockPalette {
    body: string;
    light: string;
}
export declare const ROCK_GRAY: RockPalette;
export declare const ROCK_SAND: RockPalette;
export declare const ROCK_DARK: RockPalette;
export declare const drawRock: (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, seed: number, pal?: RockPalette) => void;
export declare const drawCactus: (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, seed: number) => void;
export declare const drawStalagmite: (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, seed: number) => void;
export declare const drawPillar: (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, seed: number) => void;
export declare const drawPine: (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, seed: number) => void;
export declare const drawCrystal: (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, seed: number) => void;
export declare const drawMangrove: (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, seed: number) => void;
export {};
