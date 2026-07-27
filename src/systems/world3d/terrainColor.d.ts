/**
 * @file terrainColor.ts
 * Map a biome id (+ height) to an RGB color for per-vertex terrain tinting.
 * Matches worldSim biome families plus a few common ids. Height shading darkens
 * lowlands and lightens peaks so relief reads through tint as well as geometry.
 */
type RGB = [number, number, number];
/**
 * Tint for a terrain vertex.
 *
 * @param biomeId biome family id (see PALETTE)
 * @param height01 un-normalized local height (drives subtle relief shading)
 * @param slope01 optional steepness in [0,1] (0 flat, 1 vertical). When omitted
 *   (default 0) the result is identical to the pre-slope behavior, so existing
 *   callers that pass no slope are unaffected. Steep faces blend toward rock.
 */
export declare function biomeColor(biomeId: string, height01: number, slope01?: number): RGB;
export {};
