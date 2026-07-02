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
import { generateRegion } from '../region/generateRegion';
import { generateLocal } from '../local/generateLocal';
import { stitchLocalsEastWest } from '../local/stitchLocalArtifacts';
import { rootSeedPath } from '../seedPath';
import { LOCAL_SIZE_FT, REGION_SIZE_FT, type BoundsFt } from '../units';

/** True when `inner` lies fully inside `outer`. */
function rectInside(outer: BoundsFt, inner: BoundsFt): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}

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
export function pickSeamCellPair(
  atlas: FmgAtlasResult,
  feetPerPixel: number,
): SeamCellPair {
  const { cells } = atlas.pack;
  // Locale must fit its own window: dx/2 + LOCAL ≤ REGION/2 (east-west) and
  // dy/2 + LOCAL/2 ≤ REGION/2 (rows). Generous margins keep the pick robust.
  const maxDxFt = REGION_SIZE_FT - 2 * LOCAL_SIZE_FT; // 19,000 ft
  const maxDyFt = REGION_SIZE_FT / 2 - 2 * LOCAL_SIZE_FT; // 6,500 ft
  let best: SeamCellPair | null = null;
  let bestMinH = -1;
  for (let a = 0; a < cells.h.length; a++) {
    if (cells.h[a] < 20) continue;
    const pa = cells.p[a];
    if (!pa) continue;
    for (const b of cells.c[a] ?? []) {
      if (cells.h[b] < 20) continue;
      const pb = cells.p[b];
      if (!pb) continue;
      const dxFt = (pb[0] - pa[0]) * feetPerPixel;
      const dyFt = Math.abs(pb[1] - pa[1]) * feetPerPixel;
      // Strictly eastward, dominantly horizontal, and window-containable.
      if (dxFt > LOCAL_SIZE_FT && dxFt <= maxDxFt && dyFt <= maxDyFt && dyFt < dxFt) {
        const minH = Math.min(cells.h[a], cells.h[b]);
        if (minH > bestMinH) {
          bestMinH = minH;
          best = { cellA: a, cellB: b };
        }
      }
    }
  }
  if (!best) throw new Error('[seamProbe] atlas has no suitable east-west land cell pair');
  return best;
}

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

/** Bilinear sample of a region's normalized heightfield at a world point. */
function sampleRegionAt(region: RegionArtifact, fx: number, fy: number): number {
  const hf = region.heightfield;
  const gx = Math.min(Math.max((fx - region.bounds.x) / hf.resolutionFt, 0), hf.width - 1.001);
  const gy = Math.min(Math.max((fy - region.bounds.y) / hf.resolutionFt, 0), hf.height - 1.001);
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const tx = gx - x0;
  const ty = gy - y0;
  const s = (xi: number, yi: number) => hf.samples[yi * hf.width + xi];
  const a = s(x0, y0) * (1 - tx) + s(Math.min(x0 + 1, hf.width - 1), y0) * tx;
  const b =
    s(x0, Math.min(y0 + 1, hf.height - 1)) * (1 - tx) +
    s(Math.min(x0 + 1, hf.width - 1), Math.min(y0 + 1, hf.height - 1)) * tx;
  return a * (1 - ty) + b * ty;
}

/** Normalized region height → feet (generateLocal's fixed vertical scale). */
const NORMALIZED_TO_FT = 2000;

/**
 * Build the stitched two-region locale straddling the cellA|cellB boundary.
 * Throws (no-fallback) if either locale would leave its region window — a
 * clamped sample would silently flatten the seam and fake the proof.
 */
export function buildSeamStitchedLocal(
  atlas: FmgAtlasResult,
  worldSeed: number,
  opts: SeamStitchOptions,
): SeamStitchResult {
  const { feetPerPixel, cellA, cellB } = opts;
  const { cells } = atlas.pack;
  const worldPath = rootSeedPath(worldSeed);

  const regionA = generateRegion(atlas, cellA, worldPath, { feetPerPixel, resolutionFt: 100 });
  const regionB = generateRegion(atlas, cellB, worldPath, { feetPerPixel, resolutionFt: 100 });

  // Boundary line: midway between the two sites; locales flank it exactly.
  const seamWorldXFt = ((cells.p[cellA][0] + cells.p[cellB][0]) / 2) * feetPerPixel;
  const centerYFt = ((cells.p[cellA][1] + cells.p[cellB][1]) / 2) * feetPerPixel;
  const half = LOCAL_SIZE_FT / 2;

  const localeBounds = (centerX: number) => ({
    x: centerX - half,
    y: centerYFt - half,
    width: LOCAL_SIZE_FT,
    height: LOCAL_SIZE_FT,
  });
  if (!rectInside(regionA.bounds, localeBounds(seamWorldXFt - half))) {
    throw new Error('[seamProbe] west locale leaves region A window — pick closer cells');
  }
  if (!rectInside(regionB.bounds, localeBounds(seamWorldXFt + half))) {
    throw new Error('[seamProbe] east locale leaves region B window — pick closer cells');
  }

  const biomeOf = (cell: number) =>
    Number((cells as unknown as { biome?: ArrayLike<number> }).biome?.[cell] ?? 6);
  const localeA = generateLocal(
    regionA,
    { x: seamWorldXFt - half, y: centerYFt },
    regionA.seedPath,
    { biomeId: biomeOf(cellA) },
  );
  const localeB = generateLocal(
    regionB,
    { x: seamWorldXFt + half, y: centerYFt },
    regionB.seedPath,
    { biomeId: biomeOf(cellB) },
  );

  const stitched = stitchLocalsEastWest(localeA, localeB);

  // Empirical residual along the boundary (identical world points, both fields).
  let maxJoinDelta = 0;
  const SAMPLES = 121;
  for (let i = 0; i < SAMPLES; i++) {
    const fy = centerYFt - half + (i / (SAMPLES - 1)) * LOCAL_SIZE_FT;
    const d = Math.abs(
      sampleRegionAt(regionA, seamWorldXFt, fy) - sampleRegionAt(regionB, seamWorldXFt, fy),
    );
    if (d > maxJoinDelta) maxJoinDelta = d;
  }

  return {
    stitched,
    regionA,
    regionB,
    cellA,
    cellB,
    seamWorldXFt,
    maxJoinDeltaFt: maxJoinDelta * NORMALIZED_TO_FT,
  };
}
