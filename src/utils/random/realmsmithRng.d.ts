/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:33:29
 * Dependents: random/index.ts, realmsmithRng.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * Mulberry32 seeded random number generator.
 * Fast and sufficient for procedural generation visual consistency.
 */
export declare class RNG {
    private state;
    constructor(seed: number);
    next(): number;
    range(min: number, max: number): number;
    rangeInt(min: number, max: number): number;
    chance(probability: number): boolean;
    pick<T>(array: T[]): T;
}
/**
 * Perlin Noise Generator
 * Uses a seeded permutation table to generate smooth 2D noise.
 */
export declare class NoiseGenerator {
    private perm;
    private p;
    constructor(seed: number);
    private fade;
    private lerp;
    private grad;
    noise(x: number, y: number): number;
}
