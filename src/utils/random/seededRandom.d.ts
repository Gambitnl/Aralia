/**
 * ARCHITECTURAL ADVISORY:
 * CRITICAL CORE SYSTEM: Changes here ripple across the entire city.
 *
 * Last Sync: 27/02/2026, 09:33:31
 * Dependents: LabGrass.tsx, LabRocks.tsx, PropField.tsx, PropsLayer.tsx, Scene3D.tsx, marketEvents.ts, nobleHouseGenerator.ts, perlinNoise.ts, random/index.ts, secretGenerator.ts, templeUtils.ts, terrainUtils.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file seededRandom.ts
 * A simple seeded pseudo-random number generator (PRNG).
 */
export declare class SeededRandom {
    private seed;
    constructor(seed: number);
    /**
     * Returns a pseudo-random value between 0 (inclusive) and 1 (exclusive).
     */
    next(): number;
    /**
     * Returns a pseudo-random integer between min (inclusive) and max (exclusive).
     */
    nextInt(min: number, max: number): number;
    /**
     * Picks a random element from an array.
     */
    pick<T>(array: T[]): T;
}
/**
 * Creates a simple deterministic RNG function for use in procedural generation.
 * This is a lighter wrapper than the class if you just need a next() function.
 *
 * @param seed The base seed
 * @param coords Optional coordinates to vary the seed
 * @param contextString Optional context (e.g., 'village', 'temple')
 * @returns A function that returns a number between 0 and 1
 */
export declare const createSeededRandom: (seed: number, coords?: {
    x: number;
    y: number;
}, contextString?: string, salt?: string) => () => number;
