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
}