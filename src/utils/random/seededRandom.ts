// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * CRITICAL CORE SYSTEM: Changes here ripple across the entire city.
 * 
 * Last Sync: 26/01/2026, 01:39:49
 * Dependents: LabGrass.tsx, LabRocks.tsx, PropField.tsx, PropsLayer.tsx, Scene3D.tsx, marketEvents.ts, nobleHouseGenerator.ts, perlinNoise.ts, random/index.ts, secretGenerator.ts, templeUtils.ts
 * Imports: None
 * 
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx scripts/codebase-visualizer-server.ts --sync [this-file-path]
 * See scripts/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file seededRandom.ts
 * A simple seeded pseudo-random number generator (PRNG).
 */
export class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed % 2147483647;
    if (this.seed <= 0) {
      this.seed += 2147483646;
    }
  }

  /**
   * Returns a pseudo-random value between 0 (inclusive) and 1 (exclusive).
   */
  public next(): number {
    this.seed = (this.seed * 16807) % 2147483647;
    return (this.seed - 1) / 2147483646;
  }

  /**
   * Returns a pseudo-random integer between min (inclusive) and max (exclusive).
   */
  public nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min)) + min;
  }

  /**
   * Picks a random element from an array.
   */
  public pick<T>(array: T[]): T {
    const index = Math.floor(this.next() * array.length);
    return array[index];
  }
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
export const createSeededRandom = (seed: number, coords?: { x: number, y: number }, contextString?: string, salt?: string) => {
    let s = seed;

    // Mix in coordinates
    if (coords) {
        s = (s * 9301 + 49297) % 233280;
        s = (s + coords.x * 123 + coords.y * 456) % 233280;
    }

    // Mix in context string hash
    if (contextString) {
        for (let i = 0; i < contextString.length; i++) {
            s = ((s << 5) - s) + contextString.charCodeAt(i);
            s |= 0;
        }
    }

    if (salt) {
         for (let i = 0; i < salt.length; i++) {
            s = ((s << 5) - s) + salt.charCodeAt(i);
            s |= 0;
        }
    }

    // Ensure positive
    s = Math.abs(s);

    // Simple Linear Congruential Generator
    return () => {
        s = (s * 9301 + 49297) % 233280;
        return s / 233280;
    };
};
