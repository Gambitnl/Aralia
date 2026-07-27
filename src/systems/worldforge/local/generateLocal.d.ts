/**
 * @file generateLocal.ts — L2 LOCAL layer generation (wilderness-first slice).
 *
 * Spec: docs/projects/worldforge/SPEC.md §4 L2 + §9 item 4. THE handoff
 * artifact of the pipeline: the playable local area that replaces the legacy
 * submap (Decision Blitz D3). Both the 2D cartographic render and the 3D
 * ground mode consume this one dataset.
 *
 * Inputs: a RegionArtifact (L1, 100ft-resolution heightfield + river banks +
 * roads) and a center point; output: a LocalArtifact at the 5 ft atomic cell
 * (CELL_FT) — elevation upsampled from the region with fine coherent detail,
 * a terrain-material classification per cell, and placed features
 * (vegetation/boulders) with stable ids for the delta layer.
 *
 * Determinism: every random draw comes from named sub-streams of the local
 * seed path (seedPath.ts); same (region, center, seedPath, opts) → identical
 * artifact, forever.
 *
 * What changed: new module (build item 4, slice 1 — wilderness only).
 * Why: first playable-scale layer below L1; town interiors/streets land via
 * the town generator (SPEC §6) into the same artifact in a later slice.
 * Preserved: spine/fmg/region/adapter untouched (consumed read-only).
 */
import { type Feet } from '../units';
import { type SeedPath } from '../seedPath';
import { type LocalArtifact, type RegionArtifact } from '../artifacts';
export interface GenerateLocalOptions {
    /** Edge length of the local area in feet (default LOCAL_SIZE_FT = 3000). */
    sizeFt?: Feet;
    /**
     * Biome id of the anchoring atlas cell (FMG biome indices). The caller
     * resolves it (atlas pack.cells.biome at the anchor) — the local layer
     * deliberately doesn't reach back into the atlas itself.
     */
    biomeId: number;
}
/**
 * Map a normalized height `n` (0..1 ≙ FMG 0..100) to feet of local relief.
 *
 * Below n = 0.5 this is EXACTLY the legacy `n · 2000` mapping: `max(0, n − 0.5)`
 * is 0, so `Math.pow(0, 2.2)` is 0 and the high-country term drops out — every
 * lowland/town window is BYTE-IDENTICAL to the pre-mountains generator (the hard
 * invariance gate, Task 11). At and above n = 0.5 a `^2.2` ramp accelerates the
 * curve so high country reaches `MOUNTAIN_MAX_ELEV_FT` (7,000 ft) at n = 1 —
 * un-compressing the mountains the flat `× 2000` mapping squashed under ~610 m.
 *
 * The ramp span is written as `MOUNTAIN_MAX_ELEV_FT − 2000` so retuning the max
 * flows through. Monotonic increasing on [0,1]; C1-continuous at the 0.5 knot
 * (the ^2.2 exponent > 1 gives the ramp zero slope there, matching the linear
 * side's 2000 ft/unit). Pure.
 */
export declare function elevationCurveFt(n: number): number;
/**
 * Derivative of `elevationCurveFt` (ft per unit n). Exactly 2000 for n ≤ 0.5
 * (the legacy linear side); the high-country ramp steepens toward ~24,000 at
 * n = 1. Used to damp NORMALIZED-space micro-noise so its VERTICAL amplitude
 * stays constant through the curve (2026-07-21 look pass: undamped ±0.017 n
 * detail became ±235 ft needles at 25–60 ft wavelength in peak windows). Pure.
 */
export declare function elevationCurveSlopeFt(n: number): number;
export declare function generateLocal(region: RegionArtifact, centerFt: {
    x: Feet;
    y: Feet;
}, parentSeedPath: SeedPath, opts: GenerateLocalOptions): LocalArtifact;
