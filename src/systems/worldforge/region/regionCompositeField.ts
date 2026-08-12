/**
 * @file regionCompositeField.ts — the region-weighted composite height field.
 *
 * Method (adapted from the WorldClaw region-composition rule, arXiv 2608.05248).
 * No code, data, or text from that project is used here. Only the composition
 * rule below is taken:
 *
 *     H(x) = SUM_r  m~_r(x) * [ h_r + SUM_k w_rk*N_k(x) + SUM_j a_rj*G_j(x) ]
 *
 * where
 *   - `m~_r(x)` is the mask of region r, softened at its boundary, then
 *     NORMALIZED so every mask at a point sums to exactly 1. The normalization
 *     is the load-bearing step. It is what removes the seam. Regions are never
 *     blended in pairs. The whole set is normalized at once.
 *   - `h_r` is the base elevation of region r (the atlas cell height).
 *   - `N_k` are noise bands at fixed spatial frequencies, weighted per region.
 *   - `G_j` are the geomorphic operators: peak, dune, terrace, erosion.
 *
 * WHAT A "REGION" IS HERE. One region = one FMG atlas cell. An L1 window
 * (25,000 ft, 250x250 samples at 100 ft) covers an anchor cell and its
 * neighbors, so a window mixes ~10-60 regions. The mask set is derived from the
 * cell centers alone, so it is a pure function of world position.
 *
 * SEAM PURITY. Every term is a pure function of WORLD FEET and the WORLD seed.
 * Nothing reads the window origin, the window size, or a per-region seed path.
 * Two adjacent windows therefore compute bit-identical values at a shared world
 * point. Cell contributions are summed in ascending cell id, because floating
 * point addition is not associative and the seam contract is bit-equality.
 *
 * ATLAS AUTHORITY. The atlas owns the mean elevation of a cell. The region owns
 * only the variation inside it. Each region's variation term is zero-meaned
 * over a deterministic sample lattice before composition, so the composite mean
 * over a cell returns the atlas height. The correction is per REGION, never per
 * WINDOW. A per-window correction would reintroduce the seam it is meant to
 * fix.
 *
 * The one documented exception is the summit knee. Above 0.7 the soft tanh
 * knee compresses, so a window over very high country reads slightly BELOW its
 * atlas mean. `generateHeightfield` does the same thing for the same reason:
 * a hard clamp turns every big peak into one co-planar mesa. Below 0.7 the
 * composite is unbiased.
 *
 * NOISE. `makeWorldFeetNoise` is a stateless hash lattice. It is used for every
 * band and operator on purpose. The repo's `SimplexNoise` keeps MODULE-LEVEL
 * permutation tables, so two live instances corrupt each other. This file
 * creates no `SimplexNoise`.
 *
 * UNITS. Feet only. Heights are the atlas-normalized 0..1 scale, the same scale
 * `generateHeightfield` and `regionTerrainField` use.
 */
import type { Feet } from '../units';
import { makeWorldFeetNoise } from '../local/worldFeetNoise';

/** One region: an atlas cell center in feet, its height class, and its biome. */
export interface RegionSource {
  /** Atlas pack cell id. Contributions are summed in ascending id. */
  id: number;
  x: Feet;
  y: Feet;
  /** Normalized atlas height, 0..1 (FMG `cells.h` / 100). */
  h: number;
  /** FMG biome id, 0..12. 0 is Marine. */
  biomeId: number;
}

/** The four geomorphic operators named by the method. */
export type GeomorphOperator = 'peak' | 'dune' | 'terrace' | 'erosion';

/** Per-region terrain profile: base elevation, noise band weights, operators. */
export interface RegionProfile {
  /** `h_r` — base elevation, 0..1. */
  baseElevation: number;
  /** `w_rk` — one weight per noise band, in band order. */
  bandWeights: number[];
  /** `a_rj` — operator weights. Absent means the operator does not apply. */
  operatorWeights: Partial<Record<GeomorphOperator, number>>;
}

/**
 * Noise band wavelengths in FEET, coarse to fine. Three bands: macro landform,
 * meso relief, micro texture. Band 0 matches the 8,000 ft macro wavelength the
 * existing region heightfield already uses, so the two fields read as one world.
 */
export const BAND_SPANS_FT: readonly number[] = [8000, 2200, 700];

/** Height class of a cell — the second axis of the profile, after biome. */
export type HeightClass = 'water' | 'lowland' | 'upland' | 'highland' | 'alpine';

/** Waterline, matching `generateRegion`'s WATER_THRESHOLD. */
const WATER_THRESHOLD = 0.2;

/** Classify a normalized atlas height. Pure, and the only place the cuts live. */
export function heightClassOf(h: number): HeightClass {
  if (h < WATER_THRESHOLD) return 'water';
  if (h < 0.35) return 'lowland';
  if (h < 0.55) return 'upland';
  if (h < 0.72) return 'highland';
  return 'alpine';
}

/** FMG biome ids that read as arid, so they carry dunes. */
const DESERT_BIOMES = new Set([1, 2]); // Hot desert, Cold desert
/** FMG biome ids that read as wet, so they carry more erosion. */
const WET_BIOMES = new Set([7, 8, 12]); // Tropical rainforest, Temperate rainforest, Wetland
/** FMG biome ids that read as frozen, so they carry terraces and hard peaks. */
const FROZEN_BIOMES = new Set([10, 11]); // Tundra, Glacier

/**
 * Build the terrain profile of one region from its biome and height class.
 *
 * The rule is deliberately small and readable. A desert lowland gets dunes and
 * almost no erosion. A wet upland gets erosion and no dunes. Alpine country
 * gets peaks. Frozen or very high country gets terraces, which read as benches
 * and cirque steps.
 */
export function regionProfileFor(biomeId: number, h: number): RegionProfile {
  const cls = heightClassOf(h);
  const operatorWeights: Partial<Record<GeomorphOperator, number>> = {};

  // Noise band weights. Higher country carries more relief at every band.
  // Water carries almost none, so the sea floor stays readable.
  let macro: number;
  let meso: number;
  let micro: number;
  switch (cls) {
    case 'water':
      macro = 0.010; meso = 0.006; micro = 0.002; break;
    case 'lowland':
      macro = 0.030; meso = 0.014; micro = 0.005; break;
    case 'upland':
      macro = 0.070; meso = 0.030; micro = 0.010; break;
    case 'highland':
      macro = 0.100; meso = 0.038; micro = 0.009; break;
    case 'alpine':
      macro = 0.130; meso = 0.050; micro = 0.011; break;
  }

  // Peaks: high country only. This mirrors the existing ridge field's gate.
  if (cls === 'highland') operatorWeights.peak = 0.090;
  if (cls === 'alpine') operatorWeights.peak = 0.190;
  if (FROZEN_BIOMES.has(biomeId) && (cls === 'highland' || cls === 'alpine')) {
    operatorWeights.peak = (operatorWeights.peak ?? 0) * 1.25;
  }

  // Dunes: arid land only, and strongest where it is flat.
  if (DESERT_BIOMES.has(biomeId) && cls !== 'water') {
    operatorWeights.dune = cls === 'lowland' ? 0.045 : 0.020;
    // Dunes replace fine noise. Real dune fields are smooth between crests.
    micro *= 0.35;
  }

  // Terraces: glaciated benches and stepped high country.
  if (cls === 'alpine' || FROZEN_BIOMES.has(biomeId)) {
    operatorWeights.terrace = 0.018;
  }

  // Erosion: everywhere on land, strongest where it is wet and steep.
  if (cls !== 'water') {
    let erosion = cls === 'lowland' ? 0.020 : cls === 'upland' ? 0.045 : 0.075;
    if (WET_BIOMES.has(biomeId)) erosion *= 1.6;
    if (DESERT_BIOMES.has(biomeId)) erosion *= 0.5;
    operatorWeights.erosion = erosion;
  }

  return { baseElevation: h, bandWeights: [macro, meso, micro], operatorWeights };
}

// ── Noise bands ───────────────────────────────────────────────────────────────

/**
 * Wrap a world-feet noise so it is sampled on a ROTATED frame.
 *
 * `makeWorldFeetNoise` is bilinear value noise on an axis-aligned lattice. Its
 * artifacts are therefore axis-aligned too, and stacking several bands on the
 * same lattice orientation lines those artifacts up: the first mountain render
 * came out as rectilinear stair-steps, not ridges. Giving each band and each
 * operator its own rotation breaks the alignment. Rotation is a pure function
 * of world position, so it costs nothing in seam purity.
 */
function rotated(
  noise: (x: number, y: number) => number,
  angleRad: number,
): (x: Feet, y: Feet) => number {
  const c = Math.cos(angleRad);
  const s = Math.sin(angleRad);
  return (x, y) => noise(x * c - y * s, x * s + y * c);
}

/** Lattice rotation per noise band, radians. Chosen off any axis or diagonal. */
const BAND_ANGLES: readonly number[] = [0.37, 1.21, 2.09];

/** `N_k(x)` in [-1,1]. One field per band, built once and shared by all regions. */
function makeNoiseBands(worldSeed: number): Array<(x: Feet, y: Feet) => number> {
  return BAND_SPANS_FT.map((spanFt, k) => {
    const seed = (worldSeed ^ Math.imul(k + 1, 0x9e3779b1)) >>> 0;
    const n = rotated(makeWorldFeetNoise(seed, spanFt), BAND_ANGLES[k]);
    return (x, y) => n(x, y) * 2 - 1;
  });
}

// ── Geomorphic operators ──────────────────────────────────────────────────────

/**
 * An operator reads world position and the region's RUNNING height at that
 * point. Terrace and erosion are shape operators: they cannot act without
 * knowing where the surface currently sits. Both stay pure functions of
 * `(x, y, running)`, so the window plays no part.
 */
export type OperatorField = (x: Feet, y: Feet, running: number) => number;

/** Ridge span in feet for the peak operator's crest lattice. */
const PEAK_SPAN_FT = 11000;
/**
 * Along-strike coordinate compression for the peak operator. Below 1 the ridge
 * features stretch along the local range grain. 0.3 gives ridges about three
 * times longer than they are wide, which is what a range looks like from above.
 */
const STRIKE_SQUASH = 0.34;

/** The two range grains, radians. Two directions is enough to avoid a combed world. */
const GRAIN_ANGLES: readonly number[] = [0.42, 1.68];
const GRAIN_COS = GRAIN_ANGLES.map((a) => Math.cos(a));
const GRAIN_SIN = GRAIN_ANGLES.map((a) => Math.sin(a));
/** Dune wavelength in feet — crest-to-crest spacing of a dune train. */
const DUNE_SPAN_FT = 900;
/**
 * Terrace step height on the normalized 0..1 scale.
 *
 * 0.04 read as a stair-stepped foil across the whole alpine window, because the
 * step was finer than the relief it was cutting. 0.075 puts a bench roughly
 * every 750 ft of relief, which reads as a glaciated shelf.
 */
export const TERRACE_STEP = 0.075;
/** Finite-difference arm for the erosion slope probe, feet. */
const EROSION_PROBE_FT = 120;

/**
 * The POSITION-ONLY part of every operator, evaluated once per sample point and
 * shared by every region that overlaps it.
 *
 * This split exists for speed, and it is not cosmetic. A window mixes tens of
 * regions. Evaluating peak, dune and the erosion probe inside the per-region
 * loop repeated the same noise reads once per region and made a 250x250 window
 * take minutes. The values do not depend on the region, only on the point, so
 * they are hoisted. The arithmetic is unchanged, so the composite and the
 * standalone operators below return the same numbers.
 */
export interface PositionalOperators {
  /** `G_peak(x)` in [-1,1]. */
  peakAt: (x: Feet, y: Feet) => number;
  /** `G_dune(x)` in [-1,1]. */
  duneAt: (x: Feet, y: Feet) => number;
  /** The position part of `G_erosion(x)` in [-1,0]; scale by relief(running). */
  erosionCutAt: (x: Feet, y: Feet) => number;
}

/** Clamped smoothstep on [0,1]. */
function smoothstep01(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t * t * (3 - 2 * t);
}

/** Relief gate of the erosion operator: nothing is cut below the waterline. */
function erosionRelief(running: number): number {
  return Math.max(0, Math.min(1, (running - WATER_THRESHOLD) / 0.5));
}

/** The terrace pull, pure arithmetic on the running height. */
function terracePull(running: number): number {
  const q = running / TERRACE_STEP;
  const frac = q - Math.floor(q);
  // A smoothstep from 0 to 1 across the step, minus the linear ramp: the
  // difference is the amount the surface must move to land on a bench.
  const pulled = frac * frac * (3 - 2 * frac);
  return (pulled - frac) * 2;
}

/** Build the position-only operator parts for a world seed. */
export function makePositionalOperators(worldSeed: number): PositionalOperators {
  // Peak: domain-warped ridged noise. Warping bends the crest lattice, so
  // ridges curve and branch instead of running as a grid.
  // Every field gets its own lattice rotation, so no two share an axis.
  //
  // Peak is a three-octave RIDGED MULTIFRACTAL, not one ridged octave. One
  // octave produced broad rounded lobes that read as a lava lamp, because the
  // underlying value noise is smoothstep-interpolated and has no sharp crest.
  // The multifractal squares each ridge (sharpening the crest) and gates the
  // next octave by the previous one, so detail only grows ON the ridges. That
  // is what makes the lines branch and the flanks stay clean.
  const PEAK_OCTAVES = 2;
  const PEAK_LACUNARITY = 2.37; // irrational-ish, so octaves never re-align
  const peakOctaves = Array.from({ length: PEAK_OCTAVES }, (_u, o) => ({
    noise: rotated(
      makeWorldFeetNoise(
        (worldSeed ^ 0x5045414b ^ Math.imul(o + 1, 0x85ebca6b)) >>> 0,
        PEAK_SPAN_FT / Math.pow(PEAK_LACUNARITY, o),
      ),
      0.61 + o * 1.17,
    ),
    amp: Math.pow(0.5, o),
  }));
  const peakNorm = peakOctaves.reduce((a, o) => a + o.amp, 0);
  // Range grain. 60,000 ft wavelength, so the strike holds over several
  // windows and a range reads as one range rather than turning every mile.
  const grainBlend = rotated(makeWorldFeetNoise((worldSeed ^ 0x53545249) >>> 0, 90000), 0.44);
  const warpX = rotated(makeWorldFeetNoise((worldSeed ^ 0x57415850) >>> 0, PEAK_SPAN_FT), 1.53);
  const warpY = rotated(makeWorldFeetNoise((worldSeed ^ 0x57415950) >>> 0, PEAK_SPAN_FT), 2.41);
  const WARP_FT = 0.22 * PEAK_SPAN_FT;

  // Dune: a low-frequency noise steers the wind, a second jitters the phase.
  const windField = rotated(makeWorldFeetNoise((worldSeed ^ 0x57494e44) >>> 0, 12000), 0.83);
  const phase = rotated(makeWorldFeetNoise((worldSeed ^ 0x50484153) >>> 0, 4000), 2.77);

  // Erosion: a valley network plus a slope probe on a rough field.
  const valley = rotated(makeWorldFeetNoise((worldSeed ^ 0x56414c4c) >>> 0, 3000), 1.94);
  const rough = rotated(makeWorldFeetNoise((worldSeed ^ 0x524f5547) >>> 0, 1400), 0.29);

  return {
    peakAt: (x, y) => {
      // Domain warp bends the crest lattice, so ridges curve instead of
      // running as a grid.
      const wx = x + (warpX(x, y) - 0.5) * WARP_FT;
      const wy = y + (warpY(x, y) - 0.5) * WARP_FT;
      // STRIKE. A real range runs in a direction; isotropic ridged noise does
      // not, and it rendered as cauliflower. The grain comes from sampling the
      // ridge stack in a frame that is ROTATED and COMPRESSED along the strike,
      // so features stretch into ridge lines with spurs.
      //
      // The strike angle is CONSTANT per grain, never a function of position.
      // A position-varying rotation is an error that grows with distance from
      // the origin: at world coordinates of ~2e5 ft, an angle that turns over
      // 60,000 ft moves the rotated coordinate about 10 ft per foot travelled,
      // which shredded the whole window into hair. Instead TWO constant-angle
      // grains are blended by a slowly varying weight. Each grain is an exact
      // linear map, so nothing amplifies, and the world still shows more than
      // one range direction.
      const blend = smoothstep01(grainBlend(x, y) * 1.6 - 0.3);
      let sum = 0;
      for (let g = 0; g < 2; g++) {
        const weight = g === 0 ? 1 - blend : blend;
        if (weight <= 0) continue;
        const ct = GRAIN_COS[g];
        const st = GRAIN_SIN[g];
        const along = (wx * ct + wy * st) * STRIKE_SQUASH;
        const across = -wx * st + wy * ct;
        let acc = 0;
        let gate = 1;
        for (let o = 0; o < peakOctaves.length; o++) {
          const n = peakOctaves[o].noise(along, across) * 2 - 1;
          let r = 1 - Math.abs(n);   // [0,1], 1 on a crest line
          r = r * r * (3 - 2 * r);   // smoothstep: firm the crest, clean the flank
          r *= gate;                 // detail grows only on the previous ridge
          gate = Math.max(0, Math.min(1, r * 1.4));
          acc += r * peakOctaves[o].amp;
        }
        sum += weight * acc;
      }
      return (sum / peakNorm) * 2 - 1; // [-1,1]
    },
    duneAt: (x, y) => {
      // Wind bearing turns slowly across the world, so dune trains fan.
      const theta = windField(x, y) * Math.PI;
      const along = x * Math.cos(theta) + y * Math.sin(theta);
      const t = along / DUNE_SPAN_FT + phase(x, y) * 2;
      const s = Math.sin(t * Math.PI * 2);
      // Skew: steep near the trough, round at the crest — the dune profile.
      return Math.sign(s) * Math.pow(Math.abs(s), 0.6);
    },
    erosionCutAt: (x, y) => {
      // Slope by central difference on a coherent field. The running height
      // alone carries no gradient, so the probe reads the field that shapes it.
      const gx = rough(x + EROSION_PROBE_FT, y) - rough(x - EROSION_PROBE_FT, y);
      const gy = rough(x, y + EROSION_PROBE_FT) - rough(x, y - EROSION_PROBE_FT);
      const slope = Math.min(1, Math.hypot(gx, gy) * 3);
      // Inverted ridges give BRANCHING lows, not round pits.
      const v = 1 - 2 * Math.abs(valley(x, y) * 2 - 1);
      const network = Math.pow(Math.max(0, v), 1.6); // thin the lines
      return -(0.55 * slope + 0.45 * network);
    },
  };
}

/**
 * `G_peak` — domain-warped ridged noise. Output is in [-1,1], peaking at +1 on
 * a crest line. Standalone form, for callers and tests.
 */
export function makePeakOperator(worldSeed: number): OperatorField {
  const { peakAt } = makePositionalOperators(worldSeed);
  return (x, y) => peakAt(x, y);
}

/**
 * `G_dune` — an anisotropic crescent train with a skewed crest profile.
 * Output is [-1,1].
 */
export function makeDuneOperator(worldSeed: number): OperatorField {
  const { duneAt } = makePositionalOperators(worldSeed);
  return (x, y) => duneAt(x, y);
}

/**
 * `G_terrace` — a quantizing operator. It returns the signed pull toward the
 * nearest step of a staircase, so slopes break into benches and risers. The
 * pull is smooth, so the surface never gains a vertical wall. Output is in
 * [-1,1].
 */
export function makeTerraceOperator(): OperatorField {
  return (_x, _y, running) => terracePull(running);
}

/**
 * `G_erosion` — slope-driven incision plus a valley network. Steep ground is
 * cut, flat ground is left alone. The operator only ever removes height, so its
 * output is in [-1,0].
 */
export function makeErosionOperator(worldSeed: number): OperatorField {
  const { erosionCutAt } = makePositionalOperators(worldSeed);
  return (x, y, running) => erosionCutAt(x, y) * erosionRelief(running);
}

/** The full operator set, built once per world seed. */
export function makeOperators(worldSeed: number): Record<GeomorphOperator, OperatorField> {
  return {
    peak: makePeakOperator(worldSeed),
    dune: makeDuneOperator(worldSeed),
    terrace: makeTerraceOperator(),
    erosion: makeErosionOperator(worldSeed),
  };
}

// ── Masks ─────────────────────────────────────────────────────────────────────

/**
 * The result of a mask evaluation: the ids that are nonzero at the point, and
 * their NORMALIZED weights, in ascending id order.
 */
export interface MaskWeights {
  index: Int32Array;
  weight: Float64Array;
}

/**
 * Build the normalized region-mask sampler.
 *
 * The unnormalized mask is a Franke-Little / local Shepard kernel:
 * `((R - d) / (R * d))^2`. It behaves like 1/d^2 near the region center and is
 * EXACTLY 0 at the radius, so a region entering or leaving the neighborhood
 * adds nothing at the moment it crosses. That is the boundary softening.
 *
 * Normalization then divides by the sum of all masks at the point, so the set
 * is a partition of unity: `SUM_r m~_r(x) = 1` at every sample. Because the
 * masks are a partition of unity and each region's bracket is continuous, the
 * composite is continuous. No pairwise blend is ever computed.
 *
 * `sources` MUST be sorted by ascending `id`. The summation order is part of
 * the bit-equality contract.
 */
export function makeNormalizedMasks(
  sources: readonly RegionSource[],
  maskRadiusFt: number,
): (x: Feet, y: Feet) => MaskWeights {
  const radiusSq = maskRadiusFt * maskRadiusFt;
  for (let i = 1; i < sources.length; i++) {
    if (sources[i].id <= sources[i - 1].id) {
      throw new Error('[regionCompositeField] region sources must be sorted by ascending id');
    }
  }
  return (x, y) => {
    const index: number[] = [];
    const raw: number[] = [];
    let sum = 0;
    for (let i = 0; i < sources.length; i++) {
      const s = sources[i];
      const dx = x - s.x;
      const dy = y - s.y;
      const dSq = dx * dx + dy * dy;
      if (dSq >= radiusSq) continue;
      if (dSq < 0.01) {
        // On a region center the mask is a delta. Anything else would make the
        // center of a cell read as a blend of its neighbors.
        return { index: Int32Array.of(i), weight: Float64Array.of(1) };
      }
      const d = Math.sqrt(dSq);
      const t = (maskRadiusFt - d) / (maskRadiusFt * d);
      const w = t * t;
      index.push(i);
      raw.push(w);
      sum += w;
    }
    // No-fallback: the radius is sized above the mean region spacing, so an
    // empty set means the scale wiring is broken, not that the point is flat.
    if (sum <= 0) {
      throw new Error(
        `[regionCompositeField] no region within mask radius ${maskRadiusFt} ft of (${x}, ${y})`,
      );
    }
    const weight = new Float64Array(raw.length);
    for (let i = 0; i < raw.length; i++) weight[i] = raw[i] / sum;
    return { index: Int32Array.from(index), weight };
  };
}

// ── Composition ───────────────────────────────────────────────────────────────

/** The zero-mean sample lattice used to make the atlas authoritative. */
const MEAN_LATTICE = 5; // 5x5 = 25 deterministic probes per region
const MEAN_LATTICE_REACH = 0.5; // probes span +-0.5 * mask radius

/** A built composite field, plus the pieces a caller may want to inspect. */
export interface CompositeHeightField {
  /** `H(x)` — normalized height, 0..1. */
  sample: (x: Feet, y: Feet) => number;
  /** The normalized mask sampler, for diagnostics and seam probes. */
  masks: (x: Feet, y: Feet) => MaskWeights;
  /** Per-region profile, index-aligned with the sorted source list. */
  profiles: RegionProfile[];
  /** Per-region mean of the variation term, subtracted to keep the atlas mean. */
  meanVariation: Float64Array;
}

/** Soft knee start, matching `generateHeightfield` so summits stay ordered. */
const KNEE_START = 0.7;
const KNEE_SPAN = 1 - KNEE_START;

/**
 * Build the composite height field over a set of regions.
 *
 * @param sources - Region cells, SORTED BY ASCENDING ID.
 * @param maskRadiusFt - Mask support radius in feet. Size it above the mean
 *   region spacing so every point sees several regions.
 * @param worldSeed - The WORLD seed. Never a per-region or per-window seed.
 */
export function makeCompositeHeightField(
  sources: readonly RegionSource[],
  maskRadiusFt: number,
  worldSeed: number,
): CompositeHeightField {
  const masks = makeNormalizedMasks(sources, maskRadiusFt);
  const bands = makeNoiseBands(worldSeed);
  const pos = makePositionalOperators(worldSeed);
  const profiles = sources.map((s) => regionProfileFor(s.biomeId, s.h));

  // Flattened per-region weights. The composite runs 62,500 samples per window
  // over tens of regions, so the inner loop reads plain arrays and never a
  // `Partial<Record<...>>` (whose key iteration order is also not a thing the
  // seam contract should depend on).
  const n = sources.length;
  const wBand = new Float64Array(n * BAND_SPANS_FT.length);
  const aPeak = new Float64Array(n);
  const aDune = new Float64Array(n);
  const aTerrace = new Float64Array(n);
  const aErosion = new Float64Array(n);
  const baseH = new Float64Array(n);
  for (let r = 0; r < n; r++) {
    const p = profiles[r];
    baseH[r] = p.baseElevation;
    for (let k = 0; k < BAND_SPANS_FT.length; k++) {
      wBand[r * BAND_SPANS_FT.length + k] = p.bandWeights[k];
    }
    aPeak[r] = p.operatorWeights.peak ?? 0;
    aDune[r] = p.operatorWeights.dune ?? 0;
    aTerrace[r] = p.operatorWeights.terrace ?? 0;
    aErosion[r] = p.operatorWeights.erosion ?? 0;
  }

  /** The position-only terms, evaluated once per point and reused per region. */
  const bandScratch = new Float64Array(BAND_SPANS_FT.length);
  let cacheX = NaN;
  let cacheY = NaN;
  let cachePeak = 0;
  let cacheDune = 0;
  let cacheErosion = 0;
  const loadPoint = (x: Feet, y: Feet): void => {
    if (x === cacheX && y === cacheY) return;
    for (let k = 0; k < bands.length; k++) bandScratch[k] = bands[k](x, y);
    cachePeak = pos.peakAt(x, y);
    cacheDune = pos.duneAt(x, y);
    cacheErosion = pos.erosionCutAt(x, y);
    cacheX = x;
    cacheY = y;
  };

  /**
   * The bracketed per-region variation, WITHOUT the zero-mean correction:
   * `SUM_k w_rk*N_k(x) + SUM_j a_rj*G_j(x)`. Operators apply in a fixed order:
   * peak builds relief, dune adds bedforms, terrace steps the result, erosion
   * cuts it. Terrace and erosion read the RUNNING height, so they act on a real
   * surface rather than on nothing.
   *
   * `loadPoint(x, y)` must have run for this point.
   */
  const variationLoaded = (r: number): number => {
    let running = baseH[r];
    const off = r * BAND_SPANS_FT.length;
    for (let k = 0; k < BAND_SPANS_FT.length; k++) {
      running += wBand[off + k] * bandScratch[k];
    }
    if (aPeak[r] !== 0) running += aPeak[r] * cachePeak;
    if (aDune[r] !== 0) running += aDune[r] * cacheDune;
    if (aTerrace[r] !== 0) running += aTerrace[r] * terracePull(running);
    if (aErosion[r] !== 0) running += aErosion[r] * cacheErosion * erosionRelief(running);
    return running - baseH[r];
  };

  const variationAt = (r: number, x: Feet, y: Feet): number => {
    loadPoint(x, y);
    return variationLoaded(r);
  };

  // Atlas authority: zero-mean each region's variation over a fixed lattice
  // around its center. The lattice is per REGION, not per WINDOW, so the
  // correction is a property of the atlas cell and cannot create a seam.
  const meanVariation = new Float64Array(sources.length);
  const step = (2 * MEAN_LATTICE_REACH * maskRadiusFt) / (MEAN_LATTICE - 1);
  for (let r = 0; r < sources.length; r++) {
    const s = sources[r];
    let acc = 0;
    for (let iy = 0; iy < MEAN_LATTICE; iy++) {
      const py = s.y - MEAN_LATTICE_REACH * maskRadiusFt + iy * step;
      for (let ix = 0; ix < MEAN_LATTICE; ix++) {
        const px = s.x - MEAN_LATTICE_REACH * maskRadiusFt + ix * step;
        acc += variationAt(r, px, py);
      }
    }
    meanVariation[r] = acc / (MEAN_LATTICE * MEAN_LATTICE);
  }

  // Allocation-free mask scratch for the hot path. The public `masks` sampler
  // still allocates, because callers hold its result.
  const hitIndex = new Int32Array(n);
  const hitWeight = new Float64Array(n);
  const radiusSq = maskRadiusFt * maskRadiusFt;

  // Uniform bucket index, one bucket per mask radius, so a sample visits only
  // the 3x3 block that can hold a contributor. This is an ACCELERATOR ONLY:
  // gathered ids are restored to ASCENDING order, because the seam contract is
  // bit-equality and floating point addition is not associative.
  const SPREAD = 1 << 20;
  const bucketKey = (bx: number, by: number): number => bx * SPREAD + by;
  const buckets = new Map<number, number[]>();
  for (let r = 0; r < n; r++) {
    const k = bucketKey(
      Math.floor(sources[r].x / maskRadiusFt),
      Math.floor(sources[r].y / maskRadiusFt),
    );
    const list = buckets.get(k);
    if (list) list.push(r);
    else buckets.set(k, [r]);
  }
  const neighborhoods = new Map<number, Int32Array>();
  const neighborhoodFor = (bx: number, by: number): Int32Array => {
    const k = bucketKey(bx, by);
    const hit = neighborhoods.get(k);
    if (hit) return hit;
    const gathered: number[] = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const list = buckets.get(bucketKey(bx + dx, by + dy));
        if (list) for (const r of list) gathered.push(r);
      }
    }
    gathered.sort((a, b) => a - b);
    const built = Int32Array.from(gathered);
    neighborhoods.set(k, built);
    return built;
  };

  const sample = (x: Feet, y: Feet): number => {
    // Normalized masks, summed in ascending region id (the source order).
    const near = neighborhoodFor(
      Math.floor(x / maskRadiusFt),
      Math.floor(y / maskRadiusFt),
    );
    let hits = 0;
    let wSum = 0;
    let onCenter = -1;
    for (let ni = 0; ni < near.length; ni++) {
      const r = near[ni];
      const dx = x - sources[r].x;
      const dy = y - sources[r].y;
      const dSq = dx * dx + dy * dy;
      if (dSq >= radiusSq) continue;
      if (dSq < 0.01) { onCenter = r; break; }
      const d = Math.sqrt(dSq);
      const t = (maskRadiusFt - d) / (maskRadiusFt * d);
      const w = t * t;
      hitIndex[hits] = r;
      hitWeight[hits] = w;
      hits++;
      wSum += w;
    }
    loadPoint(x, y);
    let h: number;
    if (onCenter >= 0) {
      h = baseH[onCenter] + variationLoaded(onCenter) - meanVariation[onCenter];
    } else {
      if (wSum <= 0) {
        throw new Error(
          `[regionCompositeField] no region within mask radius ${maskRadiusFt} ft of (${x}, ${y})`,
        );
      }
      h = 0;
      for (let i = 0; i < hits; i++) {
        const r = hitIndex[i];
        const bracket = baseH[r] + variationLoaded(r) - meanVariation[r];
        h += (hitWeight[i] / wSum) * bracket;
      }
    }
    // Soft knee, matching the existing region field, so summits stay ordered
    // instead of clipping into one co-planar mesa.
    if (h > KNEE_START) {
      h = KNEE_START + KNEE_SPAN * Math.tanh((h - KNEE_START) / KNEE_SPAN);
    }
    return Math.max(0, Math.min(1, h));
  };

  return { sample, masks, profiles, meanVariation };
}

// ── Window rasterizer ─────────────────────────────────────────────────────────

/** Axis-aligned window in world feet. Mirrors `BoundsFt`. */
export interface WindowFt {
  x: Feet;
  y: Feet;
  width: Feet;
  height: Feet;
}

/** A rasterized window. Same shape as `RegionHeightfield`. */
export interface CompositeHeightfield {
  width: number;
  height: number;
  resolutionFt: number;
  samples: Float32Array;
}

/**
 * Rasterize the composite onto an L1 window. At the SPEC default (25,000 ft,
 * 100 ft resolution) this is the 250x250 grid the region tier already uses.
 *
 * The window origin must already be snapped to the global lattice by
 * `computeRegionBounds`. This function reads the bounds and nothing else, so it
 * adds no window dependence of its own.
 */
export function rasterizeComposite(
  field: CompositeHeightField,
  bounds: WindowFt,
  resolutionFt = 100,
): CompositeHeightfield {
  const width = Math.ceil(bounds.width / resolutionFt);
  const height = Math.ceil(bounds.height / resolutionFt);
  const samples = new Float32Array(width * height);
  for (let row = 0; row < height; row++) {
    const fy = bounds.y + row * resolutionFt;
    for (let col = 0; col < width; col++) {
      samples[row * width + col] = field.sample(bounds.x + col * resolutionFt, fy);
    }
  }
  return { width, height, resolutionFt, samples };
}

/**
 * Select the regions that can reach any sample of a window, in ascending id.
 *
 * Culling is safe because the mask is EXACTLY 0 at the radius. A region outside
 * the expanded window contributes nothing, so two different windows that both
 * contain a point sum the identical nonzero terms in the identical order.
 */
export function selectRegionsForWindow(
  cellPoints: ReadonlyArray<[number, number] | undefined>,
  cellHeights: ArrayLike<number>,
  cellBiomes: ArrayLike<number> | undefined,
  feetPerPixel: number,
  bounds: WindowFt,
  maskRadiusFt: number,
): RegionSource[] {
  const out: RegionSource[] = [];
  for (let id = 0; id < cellPoints.length; id++) {
    const p = cellPoints[id];
    if (!p) continue;
    const x = p[0] * feetPerPixel;
    const y = p[1] * feetPerPixel;
    if (
      x < bounds.x - maskRadiusFt || x > bounds.x + bounds.width + maskRadiusFt ||
      y < bounds.y - maskRadiusFt || y > bounds.y + bounds.height + maskRadiusFt
    ) continue;
    out.push({ id, x, y, h: cellHeights[id] / 100, biomeId: cellBiomes ? cellBiomes[id] : 0 });
  }
  return out;
}

/**
 * Mean spacing of the atlas point layout, in feet. The mask radius is derived
 * from this so it is a WORLD constant, never a per-window quantity.
 */
export function computeRegionSpacingFt(
  cellPoints: ReadonlyArray<[number, number] | undefined>,
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
  if (n === 0) throw new Error('[regionCompositeField] atlas has no cell points');
  const spacingPx = Math.max(1, Math.sqrt(((maxX - minX) * (maxY - minY)) / n));
  return spacingPx * feetPerPixel;
}

/**
 * Mask radius as a multiple of mean region spacing.
 *
 * 2x is the smallest value that still guarantees a non-empty mask set: the
 * nearest region center is at most about one spacing away. It is deliberately
 * TIGHTER than the IDW base field's 4x. A region must dominate its own ground,
 * or every profile washes out into the average of its neighbors and the biome
 * distinctions the method exists to express disappear.
 */
export const MASK_RADIUS_SPACINGS = 2;

/**
 * Build and rasterize the composite for one L1 window of an atlas — the single
 * entry point a caller should use. Every scale constant is derived here, in one
 * place, so two callers cannot silently pick different radii and produce two
 * different worlds.
 */
export function buildWindowComposite(
  cellPoints: ReadonlyArray<[number, number] | undefined>,
  cellHeights: ArrayLike<number>,
  cellBiomes: ArrayLike<number> | undefined,
  feetPerPixel: number,
  worldSeed: number,
  bounds: WindowFt,
  resolutionFt = 100,
): { field: CompositeHeightField; heightfield: CompositeHeightfield } {
  const maskRadiusFt = MASK_RADIUS_SPACINGS * computeRegionSpacingFt(cellPoints, feetPerPixel);
  const sources = selectRegionsForWindow(
    cellPoints, cellHeights, cellBiomes, feetPerPixel, bounds, maskRadiusFt,
  );
  const field = makeCompositeHeightField(sources, maskRadiusFt, worldSeed >>> 0);
  return { field, heightfield: rasterizeComposite(field, bounds, resolutionFt) };
}
