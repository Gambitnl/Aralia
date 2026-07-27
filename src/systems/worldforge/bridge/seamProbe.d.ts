/**
 * @file seamProbe.ts — the open-region SEAM-FIRST vertical slice (2026-07-01).
 *
 * Purpose: render a real region→region boundary as one walkable ground
 * surface so the seam-continuity fix in generateRegion (relief noise as a
 * pure function of world position) can be SEEN in-engine, not just proven
 * numerically (`generateRegion — cross-region seam continuity`).
 *
 * Recipe (the handover's "easiest first proof"): pick two ADJACENT atlas land
 * cells, generate each cell's OWN region (own IDW membership, own window) at
 * a scale where the two 25,000 ft windows overlap, place one 3,000 ft locale
 * per region flanking the shared boundary line, and stitch them into a single
 * LocalArtifact for the existing ground loader. The join sits mid-array, so
 * no edge fall-off masks it — any cliff at the boundary is generator truth.
 *
 * Region-window tiling at CANONICAL scale (windows smaller than one cell, so
 * they don't tile) is the follow-up decision tracked in the open-region spec;
 * this probe deliberately runs at an overlap scale, matching the offline
 * before/after proof and the frozen numeric test.
 */
import type { FmgAtlasResult } from '../fmg/generateAtlas';
import type { LocalArtifact, RegionArtifact } from '../artifacts';
export interface SeamCellPair {
    cellA: number;
    cellB: number;
}
/**
 * Pick a deterministic east-west adjacent LAND cell pair whose sites are
 * close enough (at the given scale) that each side's locale fits inside its
 * own region window. Of all qualifying pairs, returns the HILLIEST one
 * (max over pairs of min(h_a, h_b)): relief noise amplitude scales with
 * height, so the hilliest pair makes the seam continuity visibly testable —
 * a flat coastal pair would "pass" trivially with nothing to disagree about.
 */
export declare function pickSeamCellPair(atlas: FmgAtlasResult, feetPerPixel: number): SeamCellPair;
export interface SeamStitchOptions {
    feetPerPixel: number;
    cellA: number;
    cellB: number;
}
export interface SeamStitchResult {
    stitched: LocalArtifact;
    regionA: RegionArtifact;
    regionB: RegionArtifact;
    cellA: number;
    cellB: number;
    /** The region→region boundary line, world feet (x = const). */
    seamWorldXFt: number;
    /**
     * Empirical handoff residual: max |regionA − regionB| height (feet) sampled
     * at identical world points along the boundary. The seam fix removed the
     * dominant (noise) term; what remains is the coarse IDW membership delta.
     */
    maxJoinDeltaFt: number;
}
/**
 * Build the stitched two-region locale straddling the cellA|cellB boundary.
 * Throws (no-fallback) if either locale would leave its region window — a
 * clamped sample would silently flatten the seam and fake the proof.
 */
export declare function buildSeamStitchedLocal(atlas: FmgAtlasResult, worldSeed: number, opts: SeamStitchOptions): SeamStitchResult;
