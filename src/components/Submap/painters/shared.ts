/**
 * @file src/components/Submap/painters/shared.ts
 * Shared constants, utilities, and helper functions for submap painters.
 */

// import { createNoise2D, type NoiseFunction2D } from 'simplex-noise';
import { PerlinNoise } from '../../../utils/perlinNoise';

// ============================================================================
// Constants
// ============================================================================

/** Tile size in pixels for the PixiJS renderer (matches DOM's 1.75rem ≈ 28px) */
export const TILE_SIZE = 28;

/** Default submap grid dimensions */
export const DEFAULT_GRID_SIZE = { rows: 25, cols: 25 };

// ============================================================================
// Noise Functions
// ============================================================================

/** Cached noise function instance for deterministic generation */
let noiseInstance: PerlinNoise | null = null;
let currentSeed: number | null = null;

/**
 * Initialize or reinitialize the noise generator with a seed.
 * Uses the internal PerlinNoise utility.
 */
export function initNoise(seed: number): void {
    if (currentSeed !== seed) {
        noiseInstance = new PerlinNoise(seed);
        currentSeed = seed;
    }
}

/**
 * Get 2D Perlin noise value at coordinates.
 * Returns value in range [-1, 1].
 */
export function noise2D(x: number, y: number): number {
    if (!noiseInstance) {
        initNoise(12345); // Default seed if not initialized
    }
    return noiseInstance!.get(x, y);
}

/**
 * Get fractal Brownian motion noise (multi-octave).
 * Produces more natural-looking terrain variation.
 */
export function fbmNoise(
    x: number,
    y: number,
    octaves: number = 4,
    lacunarity: number = 2.0,
    persistence: number = 0.5
): number {
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
        value += noise2D(x * frequency, y * frequency) * amplitude;
        maxValue += amplitude;
        amplitude *= persistence;
        frequency *= lacunarity;
    }

    return value / maxValue;
}

/**
 * Get noise value normalized to [0, 1] range.
 */
export function noise2DNormalized(x: number, y: number): number {
    return (noise2D(x, y) + 1) * 0.5;
}

// ============================================================================
// Color Utilities
// ============================================================================

export interface RGB {
    r: number;
    g: number;
    b: number;
}

export interface RGBA extends RGB {
    a: number;
}

export interface HSL {
    h: number;
    s: number;
    l: number;
}

/**
 * Parse a hex color string to RGB object.
 * Supports #RGB, #RRGGBB, and 0xRRGGBB formats.
 */
export function hexToRgb(hex: string | number): RGB {
    if (typeof hex === 'number') {
        return {
            r: (hex >> 16) & 0xff,
            g: (hex >> 8) & 0xff,
            b: hex & 0xff,
        };
    }

    const cleanHex = hex.replace('#', '');
    const fullHex = cleanHex.length === 3
        ? cleanHex.split('').map(c => c + c).join('')
        : cleanHex;

    const num = parseInt(fullHex, 16);
    return {
        r: (num >> 16) & 0xff,
        g: (num >> 8) & 0xff,
        b: num & 0xff,
    };
}

/**
 * Convert RGB to hex number (for PixiJS).
 */
export function rgbToHex(rgb: RGB): number {
    return (rgb.r << 16) | (rgb.g << 8) | rgb.b;
}

/**
 * Convert RGB to CSS hex string.
 */
export function rgbToHexString(rgb: RGB): string {
    return `#${((1 << 24) + (rgb.r << 16) + (rgb.g << 8) + rgb.b).toString(16).slice(1)}`;
}

/**
 * Parse rgba() CSS string to RGBA object.
 */
export function parseRgba(rgba: string): RGBA {
    const match = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (!match) {
        return { r: 128, g: 128, b: 128, a: 1 };
    }
    return {
        r: parseInt(match[1], 10),
        g: parseInt(match[2], 10),
        b: parseInt(match[3], 10),
        a: match[4] !== undefined ? parseFloat(match[4]) : 1,
    };
}

/**
 * Convert RGB to HSL.
 */
export function rgbToHsl(rgb: RGB): HSL {
    const r = rgb.r / 255;
    const g = rgb.g / 255;
    const b = rgb.b / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;

    if (max === min) {
        return { h: 0, s: 0, l };
    }

    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    let h = 0;
    switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
    }

    return { h, s, l };
}

/**
 * Convert HSL to RGB.
 */
export function hslToRgb(hsl: HSL): RGB {
    const { h, s, l } = hsl;

    if (s === 0) {
        const gray = Math.round(l * 255);
        return { r: gray, g: gray, b: gray };
    }

    const hue2rgb = (p: number, q: number, t: number): number => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    return {
        r: Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
        g: Math.round(hue2rgb(p, q, h) * 255),
        b: Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
    };
}

/**
 * Linearly interpolate between two RGB colors.
 */
export function lerpColor(color1: RGB, color2: RGB, t: number): RGB {
    const clampedT = Math.max(0, Math.min(1, t));
    return {
        r: Math.round(color1.r + (color2.r - color1.r) * clampedT),
        g: Math.round(color1.g + (color2.g - color1.g) * clampedT),
        b: Math.round(color1.b + (color2.b - color1.b) * clampedT),
    };
}

/**
 * Blend two hex colors with a factor (for PixiJS).
 */
export function blendHex(baseColor: number, tintColor: number, factor: number): number {
    const base = hexToRgb(baseColor);
    const tint = hexToRgb(tintColor);
    const result = lerpColor(base, tint, factor);
    return rgbToHex(result);
}

/**
 * Adjust color brightness.
 * factor > 1 brightens, factor < 1 darkens.
 */
export function adjustBrightness(color: RGB, factor: number): RGB {
    return {
        r: Math.min(255, Math.max(0, Math.round(color.r * factor))),
        g: Math.min(255, Math.max(0, Math.round(color.g * factor))),
        b: Math.min(255, Math.max(0, Math.round(color.b * factor))),
    };
}

/**
 * Create a color palette by varying lightness.
 */
export function createPalette(baseColor: RGB, variations: number = 4): RGB[] {
    const hsl = rgbToHsl(baseColor);
    const palette: RGB[] = [];

    for (let i = 0; i < variations; i++) {
        const lightnessMod = -0.1 + (i / (variations - 1)) * 0.2;
        palette.push(hslToRgb({
            ...hsl,
            l: Math.max(0, Math.min(1, hsl.l + lightnessMod)),
        }));
    }

    return palette;
}

// ============================================================================
// Canvas Drawing Utilities
// ============================================================================

/**
 * Draw a rounded rectangle path.
 * Ported from RealmSmith painters/shared.ts with Safari fallback.
 */
export function roundedRect(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
): void {
    if (w < 0) { x += w; w = Math.abs(w); }
    if (h < 0) { y += h; h = Math.abs(h); }
    if (r < 0) r = 0;
    const radius = Math.min(r, w / 2, h / 2);

    if (typeof ctx.roundRect === 'function') {
        try {
            ctx.roundRect(x, y, w, h, radius);
            return;
        } catch {
            // Fall through to manual path (Safari 16 bug)
        }
    }

    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
}

/**
 * Create an offscreen canvas for texture generation.
 */
export function createOffscreenCanvas(width: number, height: number): {
    canvas: HTMLCanvasElement | OffscreenCanvas;
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
} {
    if (typeof OffscreenCanvas !== 'undefined') {
        const canvas = new OffscreenCanvas(width, height);
        const ctx = canvas.getContext('2d')!;
        return { canvas, ctx };
    } else {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        return { canvas, ctx };
    }
}

// ============================================================================
// Biome Color Palettes
// ============================================================================

/**
 * Biome-specific base colors for terrain.
 * Matches the biomes in submapVisualsConfig.ts
 */
export const BIOME_PALETTES: Record<string, {
    grass: RGB;
    grassDark: RGB;
    dirt: RGB;
    water: RGB;
    waterDeep: RGB;
    rock: RGB;
    path: RGB;
    sand: RGB;
}> = {
    forest: {
        grass: { r: 34, g: 139, b: 34 },      // Forest green
        grassDark: { r: 20, g: 83, b: 45 },
        dirt: { r: 101, g: 67, b: 33 },
        water: { r: 56, g: 120, b: 180 },
        waterDeep: { r: 30, g: 80, b: 140 },
        rock: { r: 105, g: 105, b: 105 },
        path: { r: 139, g: 90, b: 43 },
        sand: { r: 194, g: 178, b: 128 },
    },
    plains: {
        grass: { r: 154, g: 205, b: 50 },     // Yellow-green
        grassDark: { r: 130, g: 180, b: 90 },
        dirt: { r: 160, g: 120, b: 70 },
        water: { r: 100, g: 149, b: 237 },
        waterDeep: { r: 65, g: 105, b: 225 },
        rock: { r: 128, g: 128, b: 128 },
        path: { r: 180, g: 140, b: 90 },
        sand: { r: 238, g: 214, b: 175 },
    },
    mountain: {
        grass: { r: 85, g: 107, b: 47 },      // Dark olive
        grassDark: { r: 60, g: 80, b: 35 },
        dirt: { r: 90, g: 90, b: 90 },
        water: { r: 70, g: 130, b: 180 },
        waterDeep: { r: 25, g: 70, b: 135 },
        rock: { r: 107, g: 114, b: 128 },
        path: { r: 90, g: 90, b: 90 },
        sand: { r: 169, g: 169, b: 169 },
    },
    hills: {
        grass: { r: 124, g: 185, b: 24 },     // Lime green
        grassDark: { r: 101, g: 163, b: 13 },
        dirt: { r: 139, g: 90, b: 43 },
        water: { r: 64, g: 164, b: 223 },
        waterDeep: { r: 30, g: 120, b: 180 },
        rock: { r: 140, g: 130, b: 120 },
        path: { r: 160, g: 120, b: 70 },
        sand: { r: 210, g: 180, b: 140 },
    },
    desert: {
        grass: { r: 210, g: 180, b: 140 },    // Tan (sparse)
        grassDark: { r: 180, g: 150, b: 110 },
        dirt: { r: 194, g: 154, b: 108 },
        water: { r: 64, g: 224, b: 208 },     // Turquoise oasis
        waterDeep: { r: 0, g: 139, b: 139 },
        rock: { r: 205, g: 133, b: 63 },      // Sandy rock
        path: { r: 210, g: 180, b: 140 },
        sand: { r: 250, g: 204, b: 21 },
    },
    swamp: {
        grass: { r: 46, g: 79, b: 79 },       // Dark slate
        grassDark: { r: 19, g: 78, b: 74 },
        dirt: { r: 70, g: 50, b: 30 },
        water: { r: 10, g: 40, b: 38 },       // Murky
        waterDeep: { r: 5, g: 25, b: 23 },
        rock: { r: 60, g: 70, b: 65 },
        path: { r: 70, g: 50, b: 30 },
        sand: { r: 80, g: 70, b: 60 },
    },
    ocean: {
        grass: { r: 144, g: 238, b: 144 },    // Light green (island)
        grassDark: { r: 60, g: 179, b: 113 },
        dirt: { r: 210, g: 180, b: 140 },     // Sandy
        water: { r: 29, g: 78, b: 216 },
        waterDeep: { r: 30, g: 64, b: 175 },
        rock: { r: 119, g: 136, b: 153 },
        path: { r: 194, g: 178, b: 128 },
        sand: { r: 230, g: 190, b: 130 },
    },
    cave: {
        grass: { r: 60, g: 55, b: 50 },       // Cave floor
        grassDark: { r: 40, g: 35, b: 30 },
        dirt: { r: 50, g: 45, b: 40 },
        water: { r: 20, g: 40, b: 60 },       // Underground pool
        waterDeep: { r: 10, g: 20, b: 40 },
        rock: { r: 20, g: 15, b: 10 },        // Cave wall
        path: { r: 60, g: 55, b: 50 },
        sand: { r: 70, g: 65, b: 60 },
    },
    dungeon: {
        grass: { r: 80, g: 80, b: 85 },       // Stone floor
        grassDark: { r: 60, g: 60, b: 65 },
        dirt: { r: 50, g: 50, b: 55 },
        water: { r: 30, g: 30, b: 50 },
        waterDeep: { r: 15, g: 15, b: 30 },
        rock: { r: 40, g: 40, b: 45 },        // Dungeon wall
        path: { r: 80, g: 80, b: 85 },
        sand: { r: 90, g: 90, b: 95 },
    },
};

/**
 * Get biome palette with fallback to forest.
 */
export function getBiomePalette(biomeId: string): typeof BIOME_PALETTES['forest'] {
    return BIOME_PALETTES[biomeId] || BIOME_PALETTES.forest;
}

// ============================================================================
// Utility Types
// ============================================================================

export interface TileCoord {
    x: number;
    y: number;
}

export interface NeighborInfo {
    north: string | null;
    south: string | null;
    east: string | null;
    west: string | null;
    northEast: string | null;
    northWest: string | null;
    southEast: string | null;
    southWest: string | null;
}

/**
 * Get neighboring tile types from a grid.
 */
export function getNeighbors(
    grid: string[][],
    x: number,
    y: number
): NeighborInfo {
    const rows = grid.length;
    const cols = grid[0]?.length ?? 0;

    return {
        north: y > 0 ? grid[y - 1][x] : null,
        south: y < rows - 1 ? grid[y + 1][x] : null,
        east: x < cols - 1 ? grid[y][x + 1] : null,
        west: x > 0 ? grid[y][x - 1] : null,
        northEast: y > 0 && x < cols - 1 ? grid[y - 1][x + 1] : null,
        northWest: y > 0 && x > 0 ? grid[y - 1][x - 1] : null,
        southEast: y < rows - 1 && x < cols - 1 ? grid[y + 1][x + 1] : null,
        southWest: y < rows - 1 && x > 0 ? grid[y + 1][x - 1] : null,
    };
}

/**
 * Simple deterministic hash for consistent procedural generation.
 */
export function simpleHash(x: number, y: number, seed: number = 0): number {
    let h = seed;
    h = Math.imul(h ^ (x * 374761393), 1103515245);
    h = Math.imul(h ^ (y * 668265263), 1103515245);
    h ^= h >>> 15;
    return Math.abs(h) / 2147483647; // Normalize to [0, 1]
}
