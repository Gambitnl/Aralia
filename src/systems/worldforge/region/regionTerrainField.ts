/**
 * @file regionTerrainField.ts — the region's terrain as POINT SAMPLERS rather
 * than a grid.
 *
 * `generateHeightfield` rasterizes exactly this math onto a window grid. River
 * routing needs the same surface at arbitrary world points and with no window
 * at all, because a course must be generated from the FULL unclipped river and
 * only clipped afterward (seam purity — see generateRegion.ts:865). Extracting
 * the math here means the grid and the router cannot drift apart.
 *
 * Everything here is a pure function of WORLD position and the WORLD seed. The
 * settlement dry-land floor is deliberately NOT included: it is a per-window
 * town pad, and a river must not route around it. The post-noise water
 * re-clamp is likewise excluded — it is a rendering discipline for the grid,
 * not a statement about where the land surface sits.
 */
import type { Feet } from '../units';
import { makeWorldFeetNoise } from '../local/worldFeetNoise';
import { makeMountainRidgeField, computeIdwRadiusFt } from './generateRegion';

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
 * Macro-landform wavelength in heightfield lattice cells. `generateHeightfield`
 * uses this same 80-cell base span, so river and terrain read one field.
 */
const NOISE_BASE_CELLS = 80;

/** Soft-knee clamp start, mirroring generateHeightfield's summit knee. */
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
  return (x, y) => {
    let weightSum = 0;
    let valueSum = 0;
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      const dx = x - c.x;
      const dy = y - c.y;
      const distSq = dx * dx + dy * dy;
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
 * not from the untouched base. That is what the grid does: `generateHeightfield`
 * accumulates every octave into `samples` in place, so octave N reads a proxy
 * that already carries octaves 0..N-1. Holding the base fixed here would make
 * the sampler and the grid disagree.
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
