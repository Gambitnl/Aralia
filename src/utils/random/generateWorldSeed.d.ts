/**
 * @file src/utils/random/generateWorldSeed.ts
 * Generates a fresh world seed for "New Game" flows.
 *
 * Design intent:
 * - New Game: choose a new seed (time + randomness) so the world changes each run.
 * - In-game / save-load: the stored worldSeed keeps procedural content deterministic.
 *
 * The returned seed is clamped to the range expected by SeededRandom (1..2147483646).
 */
export declare const generateWorldSeed: () => number;
