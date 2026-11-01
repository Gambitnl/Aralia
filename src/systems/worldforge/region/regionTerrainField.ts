/**
 * @file regionTerrainField.ts — the region's terrain as POINT SAMPLERS rather
 * than a grid.
 *
 * This sampler exists for RIVER ROUTING. A course must be generated from the
 * FULL unclipped river and only clipped afterward (seam purity — see
 * generateRegion.ts), so routing needs the surface at arbitrary world points
 * with no window at all. Since 2026-08-18 the region's GRID terrain is the
 * region composite (`regionCompositeField.ts`), not the math here; this file
 * keeps its own relief stack so river courses stay window-independent and do
 * not drift from the composite's 8,000 ft macro wavelength (the composite's
 * band 0 deliberately matches it — see BAND_SPANS_FT).
 *
 * Shared IDW radius and ridge math live here; generateRegion forwards their
 * existing public exports. Their equations, seed keys and error text are unchanged.
 *
 * Everything here is a pure function of WORLD position and the WORLD seed. The
 * settlement dry-land floor is deliberately NOT included: it is a per-window
 * town pad, and a river must not route around it. The post-noise water
 * re-clamp is likewise excluded — it is a rendering discipline for the grid,
 * not a statement about where the land surface sits.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 24/10/2026, 20:32:10
 * Dependents: systems/worldforge/region/generateRegion.ts, systems/worldforge/town/townRiverCourse.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { Feet } from '../units';
import { makeWorldFeetNoise } from '../local/worldFeetNoise';
import { RIDGE_AMPLITUDE, RIDGE_SPAN_FT, RIDGE_START_N } from '../mountains/mountainTunables';

/** An FMG cell center in feet with its normalized 0..1 height. */
export interface HeightCandidate {
  x: Feet;
  y: Feet;
  h: number;
}

const OCTAVES = 5;
const LACUNARITY = 2;
const PERSISTENCE = 0.5;
const BASE_AMPLITUDE = 0.18;

/**
 * Macro-landform wavelength in lattice cells (80 @ 100 ft = 8,000 ft), the
 * same span as the composite's band 0, so the routing surface and the shipped
 * terrain read one world.
 */
const NOISE_BASE_CELLS = 80;

/** Soft-knee clamp start, mirroring the region composite's summit knee. */
const KNEE_START = 0.7;
const KNEE_SPAN = 1 - KNEE_START;

/**
 * Radius-limited IDW over cell heights — the base surface, before noise.
 * Weight is Franke-Little / local Shepard: ~1/d² near the cell and exactly 0 at
 * the radius, so the field stays continuous as cells cross the neighborhood
 * edge.
 */
export function makeRegionBaseField(
  candidates: HeightCandidate[],
  idwRadiusFt: number,
): (x: Feet, y: Feet) => number {
  const radiusSq = idwRadiusFt * idwRadiusFt;

  // Uniform bucket grid, one cell per IDW radius, so a query only visits the 3x3
  // block that can possibly hold a contributor instead of every cell in the
  // world. Routing one river runs ~12,000 queries, and against a whole atlas
  // (5,829 cells) the linear scan was slow enough to time a town preview out.
  //
  // This is an accelerator ONLY. Candidate indices are gathered from the buckets
  // and then SORTED ASCENDING before summing, because the result must not depend
  // on visit order: the sum is floating point, and the region heightfield's
  // seam-purity contract requires two different windows to compute byte-equal
  // values at a shared world point. Bucketing without the sort would reorder the
  // additions and change the last bits.
  const bucketSize = idwRadiusFt;
  // Numeric key rather than a template string: this runs on the hot path of
  // every river query, and building nine strings per sample cost more than the
  // scan it replaced. SPREAD is wider than any plausible bucket index range.
  const SPREAD = 1 << 20;
  const buckets = new Map<number, number[]>();
  const key = (bx: number, by: number): number => bx * SPREAD + by;
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const k = key(Math.floor(c.x / bucketSize), Math.floor(c.y / bucketSize));
    const list = buckets.get(k);
    if (list) list.push(i);
    else buckets.set(k, [i]);
  }

  // Per-bucket neighborhood, built once and reused. Gathering and sorting the
  // 3x3 union on every query was itself slower than the scan it replaced — the
  // comparator calls dominated. Queries along a river are spatially clustered,
  // so caching the merged list per bucket amortizes that away almost entirely.
  const neighborhoods = new Map<number, Int32Array>();
  const neighborhoodFor = (bx: number, by: number): Int32Array => {
    const k = key(bx, by);
    const hit = neighborhoods.get(k);
    if (hit) return hit;
    const gathered: number[] = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const list = buckets.get(key(bx + dx, by + dy));
        if (list) for (const i of list) gathered.push(i);
      }
    }
    // Each bucket list is ascending by construction, but nine of them
    // interleave, so restore the global ascending order the sum depends on.
    gathered.sort((a, b) => a - b);
    const built = Int32Array.from(gathered);
    neighborhoods.set(k, built);
    return built;
  };

  return (x, y) => {
    const near = neighborhoodFor(Math.floor(x / bucketSize), Math.floor(y / bucketSize));

    let weightSum = 0;
    let valueSum = 0;
    for (const i of near) {
      const c = candidates[i];
      const ddx = x - c.x;
      const ddy = y - c.y;
      const distSq = ddx * ddx + ddy * ddy;
      if (distSq >= radiusSq) continue;
      // Coincident with a cell center: take its height outright, matching the
      // grid's early break.
      if (distSq < 0.01) return c.h;
      const d = Math.sqrt(distSq);
      const t = (idwRadiusFt - d) / (idwRadiusFt * d);
      const weight = t * t;
      weightSum += weight;
      valueSum += weight * c.h;
    }
    // No-fallback: the radius is sized at 4x mean spacing, so an empty
    // neighborhood means the scale wiring is broken, not that this point is flat.
    if (weightSum <= 0) {
      throw new Error(
        `[regionTerrainField] no cells within IDW radius ${idwRadiusFt} ft of sample (${x}, ${y})`,
      );
    }
    return valueSum / weightSum;
  };
}

/**
 * The relief added on top of the base surface: five octaves of world-feet noise
 * (octave 0 ridged, so each region carries connected ridge-and-valley
 * landforms) plus the mountain ridge synthesis. Amplitude scales with local
 * relief, so flats stay flat and high country grows peaks.
 *
 * The relief scale is recomputed from the RUNNING height after each octave,
 * not from the untouched base: octave N reads a proxy that already carries
 * octaves 0..N-1, matching the sampler's own loop (the grid no longer shares
 * this stack since 2026-08-18 — it is the composite).
 */
export function makeRegionReliefField(
  worldSeed: number,
  baseSpanFt: number,
): (x: Feet, y: Feet, baseH: number) => number {
  const octaves = Array.from({ length: OCTAVES }, (_unused, octave) => {
    const freq = Math.pow(LACUNARITY, octave);
    const octaveSeed = (worldSeed ^ Math.imul(octave + 1, 0x9e3779b1)) >>> 0;
    return {
      noise: makeWorldFeetNoise(octaveSeed, baseSpanFt / freq),
      amp: BASE_AMPLITUDE * Math.pow(PERSISTENCE, octave),
      ridged: octave === 0,
    };
  });
  const ridgeField = makeMountainRidgeField(worldSeed);

  return (x, y, baseH) => {
    let running = baseH;
    for (const o of octaves) {
      // makeWorldFeetNoise returns [0,1]; map to [-1,1] so the ridge transform's
      // crests form on the lattice's zero-crossings.
      let n = o.noise(x, y) * 2 - 1;
      if (o.ridged) n = 1 - 2 * Math.abs(n);
      const reliefScale = Math.max(0.15, Math.min(1, (running - 0.15) / 0.55));
      running += n * o.amp * reliefScale;
    }
    // The ridge field reads the post-octave height, exactly as the grid does.
    running += ridgeField(x, y, running);
    return running - baseH;
  };
}

/** Natural terrain height at a world point, clamped 0..1. No settlement floor. */
export function makeRegionNaturalHeight(
  candidates: HeightCandidate[],
  idwRadiusFt: number,
  worldSeed: number,
  baseSpanFt: number,
): (x: Feet, y: Feet) => number {
  const base = makeRegionBaseField(candidates, idwRadiusFt);
  const relief = makeRegionReliefField(worldSeed, baseSpanFt);
  return (x, y) => {
    const b = base(x, y);
    let s = b + relief(x, y, b);
    // Soft knee above 0.7 so summits stay ordered rather than clipping into a
    // co-planar mesa — the same tail generateHeightfield applies before its clamp.
    if (s > KNEE_START) {
      s = KNEE_START + KNEE_SPAN * Math.tanh((s - KNEE_START) / KNEE_SPAN);
    }
    return Math.max(0, Math.min(1, s));
  };
}

/**
 * The natural-height sampler for a WHOLE ATLAS — candidates, IDW radius, seed
 * and noise wavelength all derived from world data in one place.
 *
 * The region tier and the town tier both route a river with this surface and
 * must get the identical line, so the wiring lives here rather than being
 * restated at each caller where a different radius or wavelength would silently
 * produce two different rivers.
 */
export function makeAtlasNaturalHeight(
  cellPoints: Array<[number, number]>,
  cellHeights: ArrayLike<number>,
  feetPerPixel: number,
  worldSeed: number,
  resolutionFt: number,
): (x: Feet, y: Feet) => number {
  const candidates: HeightCandidate[] = [];
  for (let id = 0; id < cellPoints.length; id++) {
    const p = cellPoints[id];
    if (!p) continue;
    candidates.push({
      x: p[0] * feetPerPixel,
      y: p[1] * feetPerPixel,
      h: cellHeights[id] / 100,
    });
  }
  return makeRegionNaturalHeight(
    candidates,
    computeIdwRadiusFt(cellPoints, feetPerPixel),
    worldSeed >>> 0,
    NOISE_BASE_CELLS * resolutionFt,
  );
}

/**
 * IDW neighborhood radius, world feet — a WORLD-level constant (depends only
 * on the atlas point layout and feetPerPixel, never on the anchor or window),
 * so every region computes the exact same per-sample neighborhood. Estimated
 * as 4× the mean cell spacing: dense enough that every sample sees ~50
 * surrounding cells (comparable context to the old BFS membership), and
 * guaranteed non-empty (nearest cell is always ≤ ~1 spacing away).
 * Exported for tests.
 */
export function computeIdwRadiusFt(
  cellPoints: Array<[number, number]>,
  feetPerPixel: number,
): number {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let n = 0;
  for (const p of cellPoints) {
    if (!p) continue;
    n++;
    if (p[0] < minX) minX = p[0];
    if (p[0] > maxX) maxX = p[0];
    if (p[1] < minY) minY = p[1];
    if (p[1] > maxY) maxY = p[1];
  }
  if (n === 0) throw new Error('[generateRegion] atlas has no cell points');
  // Mean spacing of an n-point layout over its extent (≥1 px floor for
  // degenerate single-point layouts).
  const spacingPx = Math.max(1, Math.sqrt(((maxX - minX) * (maxY - minY)) / n));
  return 4 * spacingPx * feetPerPixel;
}

/** Clamped smoothstep on [0,1]: 0 for t ≤ 0, 1 for t ≥ 1, C1 in between. The
 * `t ≤ 0 → 0` clamp is what makes the ridge boost EXACTLY 0 below the line. */
function smoothstep01(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t * t * (3 - 2 * t);
}

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
export function makeMountainRidgeField(
  worldSeed: number,
): (fx: number, fy: number, baseH: number) => number {
  const ridgeBase = makeWorldFeetNoise((worldSeed ^ 0x52444745) >>> 0, RIDGE_SPAN_FT); // 'RDGE'
  const warpX = makeWorldFeetNoise((worldSeed ^ 0x57727058) >>> 0, RIDGE_SPAN_FT); // 'WrpX'
  const warpY = makeWorldFeetNoise((worldSeed ^ 0x57727059) >>> 0, RIDGE_SPAN_FT); // 'WrpY'
  const WARP_FT = 0.7 * RIDGE_SPAN_FT; // (noise − 0.5) spans ±0.35·RIDGE_SPAN_FT
  const span = 1 - RIDGE_START_N;
  return (fx: number, fy: number, baseH: number): number => {
    const boost = smoothstep01((baseH - RIDGE_START_N) / span);
    if (boost === 0) return 0; // baseH ≤ RIDGE_START_N ⇒ lowland-invariant
    const dx = (warpX(fx, fy) - 0.5) * WARP_FT;
    const dy = (warpY(fx, fy) - 0.5) * WARP_FT;
    const n = ridgeBase(fx + dx, fy + dy) * 2 - 1; // [0,1] → [-1,1]
    const ridge = 1 - 2 * Math.abs(n); // ridge transform → crest lines
    return ridge * RIDGE_AMPLITUDE * boost;
  };
}
