/**
 * @file intact/rng.ts
 * @description RNG helpers (shared substrate) — extracted VERBATIM from
 * buildIntact.ts as part of the module split (packet W1-P6). Move-only: the
 * bodies are byte-identical to the originals, so the seeded call order (and every
 * golden that depends on it) is unchanged. Re-exported by `../buildIntact`.
 */
import { type SeedPath } from '../../seedPath';
/** Thin, allocation-light wrapper over the worldforge `SeededRandom` stream. */
export interface Rng {
    /** [a, b) */
    float(a: number, b: number): number;
    /** integer in [a, b] INCLUSIVE (guards the max-exclusive nextInt trap). */
    int(a: number, b: number): number;
    pick<T>(arr: readonly T[]): T;
    chance(p: number): boolean;
}
export declare function makeRng(path: SeedPath): Rng;
