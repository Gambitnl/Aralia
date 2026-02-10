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

const clampToSeededRandomRange = (value: number): number => {
  // SeededRandom uses modulus 2147483647 and requires seed > 0.
  const mod = 2147483646;
  const normalized = Math.abs(Math.trunc(value)) % mod;
  return normalized + 1;
};

// SplitMix-inspired mixing step on 32-bit values.
const mixU32 = (x: number): number => {
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  x = (x ^ (x >>> 16)) >>> 0;
  return x;
};

export const generateWorldSeed = (): number => {
  const now = Date.now();
  const timeLo = now | 0;
  const timeHi = ((now / 0x100000000) | 0) >>> 0;

  let r0 = 0;
  let r1 = 0;

  const cryptoObj = (globalThis as unknown as { crypto?: Crypto }).crypto;
  if (cryptoObj?.getRandomValues) {
    const arr = new Uint32Array(2);
    cryptoObj.getRandomValues(arr);
    r0 = arr[0] >>> 0;
    r1 = arr[1] >>> 0;
  } else {
    // Fallback for non-browser/test environments.
    r0 = (Math.random() * 0x100000000) >>> 0;
    r1 = (Math.random() * 0x100000000) >>> 0;
  }

  // Combine time + random and avalanche to reduce structure.
  const combined = (timeLo ^ timeHi ^ r0 ^ ((r1 << 1) >>> 0)) >>> 0;
  const mixed = mixU32(combined);
  return clampToSeededRandomRange(mixed);
};

