/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 15/07/2026, 01:59:56
 * Dependents: components/Worldforge/AtlasDemo.tsx, systems/worldforge/bridge/legacySubmapBridge.ts, systems/worldforge/bridge/seamProbe.ts
 * Imports: 10 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file generateRegion.ts — L1 Region generator (Worldforge build-order item 3).
 *
 * Spec: docs/projects/worldforge/SPEC.md §4 (L1 REGION), §11 (cells canonical).
 * Given an atlas and an anchor cell id, produces a RegionArtifact: a refined
 * heightfield over the cell's neighborhood plus river banks widened from atlas
 * rivers. This is the first slice of generation BELOW Azgaar's deepest zoom.
 *
 * What changed: WF-G4 — bounds are now an anchor-centered REGION_SIZE_FT
 * square (scale-invariant); membership always includes the anchor's 1-ring;
 * rivers/roads are clipped to the window; town sites outside it are dropped.
 * Why: at canonical FEET_PER_FMG_PIXEL the old member-extent bounds collapsed
 * to 0×0 (black demo canvas); at test scales they overshot the spec size.
 * Preserved: spine/artifacts.ts, seedPath.ts, units.ts consumed read-only;
 * IDW + FBM heightfield pipeline and C2 civ extraction logic unchanged.
 *
 * ── Region membership heuristic ─────────────────────────────────────────────
 * Start from the anchor cell and expand outward via true cell adjacency
 * (`pack.cells.c`). Each ring adds all neighbors of current members. Expand
 * until the covered area roughly matches REGION_SIZE_FT × REGION_SIZE_FT
 * (documented in units.ts as 25,000 ft). The heuristic: stop when the bounds
 * of member cells exceed ~1.2× REGION_SIZE_FT on both axes (overshoot slightly
 * to ensure full coverage). This honors SPEC §11: true Voronoi adjacency, not
 * square windows.
 *
 * WF-G4 (2026-06-11, orchestrator): membership is SAMPLING CONTEXT, not the
 * region window. At the canonical scale (FEET_PER_FMG_PIXEL ≈ 9,842.52) a
 * 25,000 ft region is SMALLER than one atlas cell, so the WF-G3 distance
 * clamp admitted nothing beyond the anchor and IDW had a single sample (flat
 * field). The anchor's direct neighbors (1-ring) are therefore ALWAYS
 * admitted regardless of distance — interpolation needs surrounding context
 * at every scale. At test scale (1,000 ft/px) the 1-ring already passed the
 * clamp, so this changes nothing there.
 *
 * ── Region bounds ───────────────────────────────────────────────────────────
 * WF-G4: bounds are an anchor-centered REGION_SIZE_FT square — SCALE-INVARIANT
 * and independent of membership. The previous member-extent-derived bounds
 * collapsed to 0×0 ft at canonical scale (single member point has no extent),
 * which was the true root cause of the demo's black region canvas. A region
 * is now always exactly 25,000 ft per side (SPEC §4), at any feetPerPixel.
 * Rivers/roads are clipped to this window; town sites outside it are dropped.
 *
 * ── Heightfield interpolation ───────────────────────────────────────────────
 * Base surface: Inverse Distance Weighting (IDW) over pack cell heights
 * (`pack.cells.h` normalized 0..1). IDW chosen for simplicity and determinism;
 * power=2 is standard. Sample points are pack cell centers (`pack.cells.p`)
 * converted to feet. For each grid sample, compute weighted average of all
 * member cell heights, weight = 1/distance². This is O(samples × cells) but
 * the region is small enough (~250×250 grid, ~100-200 cells) to be fast.
 *
 * ── Multi-octave value noise ────────────────────────────────────────────────
 * After IDW base, add deterministic value noise to break up the smooth
 * interpolation. Amplitude scales with local relief: flat coast stays flat,
 * mountains get rugged. Noise seeded via `rngFromPath(streamPath(regionPath,
 * 'relief'))`. Three octaves, lacunarity=2, persistence=0.5, amplitude scaled
 * by local height variance.
 *
 * ── Water discipline ────────────────────────────────────────────────────────
 * Cells that are water in the atlas (h<20) must remain below water height in
 * the refined field. After IDW + noise, clamp all samples in water cells to
 * max 0.19 (just below the 0.2 water threshold). This prevents noise islands
 * from popping out of the sea.
 *
 * ── River banks ─────────────────────────────────────────────────────────────
 * For each `pack.rivers` entry passing through member cells, produce a
 * RegionRiverBank: centerline polyline through the member cell points (feet),
 * widthFt derived from river flux (discharge proxy). Width mapping:
 * widthFt = 50 + sqrt(flux) * 20 (documented heuristic; flux is m³/s from
 * Rivers.generate, so sqrt dampens the range). Carve the heightfield down
 * along the centerline: for each river point, reduce nearby samples by a
 * modest depth (0.02 normalized) within half the river width, creating a
 * channel.
 *
 * ── Town sites (C2) ────────────────────────────────────────────────────────
 * For each burg in member cells (via pack.cells.burg lookup), produce a
 * RegionTownSite. Envelope sizing: sqrt(population) × 80 ft half-extent,
 * clamped to [400, 4000] ft (small hamlet → large city). The town generator
 * (SPEC §6 pass 1) builds inside this envelope later. Gates are computed
 * where roads enter the envelope boundary.
 *
 * ── Roads (C2) ─────────────────────────────────────────────────────────────
 * For each route passing through member cells (searoutes skipped), produce a
 * RegionRoad. Centerline is built from route point [x,y] coords converted to
 * feet, then Chaikin-smoothed (3 iterations). Width mapping by kind:
 *   highway → 44 ft (capital trunk)
 *   road    → 40 ft (main trade routes)
 *   trail   → 20 ft (local paths)
 *   path    →  8 ft (forest spur, Task 7)
 * Heightfield is gently flattened under town envelopes (build sites).
 */
import { type RegionArtifact, type RegionCrossing, type RegionRiverBank, type RegionRoad } from '../artifacts';
import { type SeedPath } from '../seedPath';
import { BoundsFt } from '../units';
import type { FmgAtlasResult } from '../fmg/generateAtlas';
import type { FmgWorldResult } from '../fmg/generateWorld';
export interface GenerateRegionOptions {
    /** Feet per FMG pixel (Lane B's canonical converter; pass any plausible value for tests). */
    feetPerPixel: number;
    /** Heightfield sample spacing, feet. Default 100 (SPEC §4 L1 target). */
    resolutionFt?: number;
    /**
     * Optional full world result (from generateFmgWorld). When provided,
     * civilization data (burgs, routes) is used to populate townSites and roads.
     * When omitted, these arrays remain empty (atlas-only mode, C1 compat).
     */
    world?: FmgWorldResult;
    /**
     * Optional window center override, in atlas/graph PIXELS. Used when entering a
     * settlement: the burg sits anywhere within its (far larger) cell, so the
     * Locale window is centered on the burg's position rather than the cell site.
     * Defaults to the anchor cell's Voronoi site.
     */
    windowCenterPx?: readonly [number, number];
}
/**
 * Generate a RegionArtifact: refined heightfield + river banks for the
 * neighborhood of the anchor cell.
 *
 * @param atlas - The FMG atlas result (pack cells, rivers, grid).
 * @param anchorCellId - Pack cell id to center the region on.
 * @param worldSeedPath - Root seed path for the world (e.g. `wf:1337`).
 * @param opts - Conversion + resolution options.
 */
export declare function generateRegion(atlas: FmgAtlasResult, anchorCellId: number, worldSeedPath: SeedPath, opts: GenerateRegionOptions): RegionArtifact;
/**
 * Expand region membership from anchor cell via BFS over true cell adjacency.
 * Stop when bounds exceed ~1.2× REGION_SIZE_FT on both axes.
 * Exported for use by proof renderers and tests.
 */
export declare function expandRegionMembership(adjacency: number[][], anchorCellId: number, cellPoints: Array<[number, number]>, feetPerPixel: number): number[];
/**
 * Compute the region window: an anchor-centered square of REGION_SIZE_FT per
 * side (WF-G4). Scale-invariant by design — a region is always 25,000 ft
 * regardless of feetPerPixel, so the canonical scale (where one atlas cell is
 * far larger than the window) and test scales behave identically.
 * Exported for proof renderers and tests.
 */
export declare function computeRegionBounds(anchorCellId: number, cellPoints: Array<[number, number]>, feetPerPixel: number, centerPx?: readonly [number, number], resolutionFt?: number): BoundsFt;
/**
 * IDW neighborhood radius, world feet — a WORLD-level constant (depends only
 * on the atlas point layout and feetPerPixel, never on the anchor or window),
 * so every region computes the exact same per-sample neighborhood. Estimated
 * as 4× the mean cell spacing: dense enough that every sample sees ~50
 * surrounding cells (comparable context to the old BFS membership), and
 * guaranteed non-empty (nearest cell is always ≤ ~1 spacing away).
 * Exported for tests.
 */
export declare function computeIdwRadiusFt(cellPoints: Array<[number, number]>, feetPerPixel: number): number;
/**
 * Build the MOUNTAIN RIDGE field (Task 11): a domain-warped, ridged world-feet
 * noise that adds real peaks to high country, returning the feet-normalized
 * height delta to ADD to a heightfield sample.
 *
 * `(fx, fy, baseH) => delta`, where:
 *  - `ridgeBoost = smoothstep01((baseH − RIDGE_START_N) / (1 − RIDGE_START_N))`
 *    ramps the effect in above RIDGE_START_N. For `baseH ≤ RIDGE_START_N` the
 *    boost is EXACTLY 0, so the delta is EXACTLY 0 and the sample is unchanged —
 *    the lowland-invariance hard gate, true by construction (no float drift).
 *  - the ridged component is `1 − 2|n|` of a world-feet noise sampled at
 *    coordinates domain-warped by two aux world-feet noises (±0.35·RIDGE_SPAN_FT),
 *    exactly mirroring the octave loop's ridge transform.
 *
 * Keyed off the WORLD seed (`worldSeed ^ constants`) and indexed by WORLD FEET,
 * never the region path/grid — so two adjacent regions add the identical delta
 * at a shared world point and the relief meets seamlessly across region borders,
 * the same construction the octave loop already relies on. Pure.
 */
export declare function makeMountainRidgeField(worldSeed: number): (fx: number, fy: number, baseH: number) => number;
/** Derive deterministic physical crossings from final Region run geometry. */
export declare function deriveRegionCrossings(roads: RegionRoad[], rivers: RegionRiverBank[]): RegionCrossing[];
