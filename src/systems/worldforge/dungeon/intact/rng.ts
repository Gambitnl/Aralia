/**
 * @file intact/rng.ts
 * @description RNG helpers (shared substrate) — extracted VERBATIM from
 * buildIntact.ts as part of the module split (packet W1-P6). Move-only: the
 * bodies are byte-identical to the originals, so the seeded call order (and every
 * golden that depends on it) is unchanged. Re-exported by `../buildIntact`.
 */

import { rngFromPath, type SeedPath } from '../../seedPath';

// ─── RNG helpers (shared substrate) ──────────────────────────────────────────

/** Thin, allocation-light wrapper over the worldforge `SeededRandom` stream. */
export interface Rng {
  /** [a, b) */
  float(a: number, b: number): number;
  /** integer in [a, b] INCLUSIVE (guards the max-exclusive nextInt trap). */
  int(a: number, b: number): number;
  pick<T>(arr: readonly T[]): T;
  chance(p: number): boolean;
}

export function makeRng(path: SeedPath): Rng {
  const sr = rngFromPath(path);
  return {
    float: (a, b) => a + sr.next() * (b - a),
    int: (a, b) => sr.nextInt(a, b + 1),
    // min() guards the (conventional, not contractual) next() < 1 promise —
    // floor(1.0 * len) would index one past the end.
    pick: (arr) => arr[Math.min(arr.length - 1, Math.floor(sr.next() * arr.length))],
    chance: (p) => sr.next() < p,
  };
}
