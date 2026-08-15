/**
 * @file rockHardness.ts — per-atlas-cell rock hardness, derived from the atlas.
 *
 * WHY HARDNESS EXISTS. Uniform rock erodes uniformly, and a uniform erosion
 * rate prints a repeating texture. That is the "brain coral" half of the open
 * `region-terrain` verdict. Real ridges persist because the rock under them is
 * harder than the rock beside them, and hard rock does TWO things at once:
 *
 *   1. It RESISTS INCISION.   erodibility = 1 + 1.2 * (0.5 - hardness)
 *   2. It HOLDS A STEEPER SLOPE. talus = talus * (1 + 0.6 * (hardness - 0.5))
 *
 * One field, two effects. That coupling is what makes a ridge read as rock
 * instead of as noise. The laws are published geomorphology (stream power for
 * the first, hillslope threshold-angle theory for the second).
 *
 * WHERE HARDNESS COMES FROM. Not from a fresh noise field. A free noise field
 * puts hard rock in meaningless places, which only trades one repeating texture
 * for another. Every term below reads something the atlas already knows, and
 * every term states the geology it stands for.
 *
 *   CRATON       `cells.t`, the distance-to-coast ring count. Continental
 *                interiors expose old crystalline shield. Passive margins carry
 *                young, weak sedimentary fill. This is the single strongest
 *                real first-order control on continental rock strength, and it
 *                is the one term that is nearly INDEPENDENT of elevation, so it
 *                is weighted highest.
 *   OROGEN       Cell height above the mean of its Voronoi neighbors, plus
 *                absolute height. Orogenic cores expose resistant basement and
 *                intrusives; basins hold weak fill.
 *   ROCK CLASS   `cells.biome`. Glacier and tundra mean scoured bedrock.
 *                Wetland means alluvium. Rainforest means deep saprolite.
 *   ALLUVIAL     `cells.fl`, the atlas flux. Large rivers sit on their own
 *                alluvium, and rivers preferentially exploit weak rock. Both
 *                make a high-flux cell softer.
 *
 * UNITS. None. Hardness is a dimensionless 0..1 index. 0.5 is the REFERENCE
 * ROCK: it gives erodibility exactly 1 and talus scale exactly 1, so a caller
 * with no hardness data gets the unmodified operator.
 *
 * DETERMINISM. A pure function of the atlas pack, which is itself a pure
 * function of the world seed. No RNG, no noise, no iteration order dependence.
 */

/** The subset of the FMG pack graph this module reads. */
export interface HardnessAtlasInput {
  /** Cell height, FMG 0..100. */
  h: ArrayLike<number>;
  /** Distance-to-coast rings. Land is >= 1, water is <= -1. */
  t: ArrayLike<number>;
  /** FMG biome id, 0..12. */
  biome: ArrayLike<number> | undefined;
  /** Water flux from the atlas river generator. */
  fl: ArrayLike<number> | undefined;
  /** Voronoi adjacency, one neighbor list per cell. */
  c: ReadonlyArray<ReadonlyArray<number>>;
}

/** `HARD_ERODIBILITY_STR` — how strongly hardness resists incision. */
export const HARD_ERODIBILITY_STR = 1.2;
/** `HARD_TALUS_STR` — how strongly hardness steepens the held slope. */
export const HARD_TALUS_STR = 0.6;

/** Hardness of the reference rock. Gives erodibility 1 and talus scale 1. */
export const REFERENCE_HARDNESS = 0.5;

/**
 * Term weights. Each term returns [-1, 1]; the weights are the maximum shift
 * each one may make to hardness. They sum to 0.52, so the raw index spans
 * roughly [-0.02, 1.02] before the clamp, which uses the full 0..1 range
 * without pinning most cells at an end.
 *
 * CRATON is the heaviest because it is the one term that does not simply
 * restate elevation. If elevation dominated, hardness would be a re-scaled copy
 * of the height field and would add no new structure at all.
 */
const W_CRATON = 0.18;
const W_OROGEN = 0.16;
const W_ROCK_CLASS = 0.10;
const W_ALLUVIAL = 0.08;

/** Ring count at which a cell counts as fully cratonic interior. */
const CRATON_SATURATION_RINGS = 7;
/** Local-relief scale, FMG height units, at which the orogen term saturates. */
const OROGEN_RELIEF_SCALE = 8;
/** Absolute height, FMG units, that reads as neutral for the orogen term. */
const OROGEN_NEUTRAL_H = 40;
/** Flux at which the alluvial softening saturates. */
const ALLUVIAL_FLUX_SCALE = 120;

/**
 * Rock-class shift per FMG biome id, in [-1, 1].
 *
 * Positive is competent rock. Negative is weak cover. The values follow the
 * weathering-regime ordering: cold and dry climates leave bedrock at the
 * surface, hot and wet climates bury it under tens of feet of saprolite.
 */
const ROCK_CLASS: readonly number[] = [
  -0.30, //  0 Marine — sea-floor sediment
  0.20, //  1 Hot desert — indurated, little chemical weathering
  0.20, //  2 Cold desert
  0.00, //  3 Savanna
  0.00, //  4 Grassland
  -0.10, //  5 Tropical seasonal forest
  0.00, //  6 Temperate deciduous forest
  -0.80, //  7 Tropical rainforest — deep saprolite
  -0.40, //  8 Temperate rainforest
  0.10, //  9 Taiga
  0.60, // 10 Tundra — frost-shattered but bedrock-floored
  0.80, // 11 Glacier — scoured to fresh bedrock
  -1.00, // 12 Wetland — alluvium
];

/** Clamp to [-1, 1]. */
function unit(v: number): number {
  return v < -1 ? -1 : v > 1 ? 1 : v;
}

/**
 * Compute rock hardness for every cell of an atlas.
 *
 * @returns One hardness in [0,1] per cell, index-aligned with the pack cells.
 */
export function computeRockHardness(atlas: HardnessAtlasInput): Float64Array {
  const { h, t, biome, fl, c } = atlas;
  const n = h.length;
  if (c.length !== n || t.length !== n) {
    throw new Error(
      `[rockHardness] atlas arrays disagree: h=${n} t=${t.length} c=${c.length}`,
    );
  }
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    // CRATON. Rings from the coast, saturating in the interior. Water cells
    // have t <= -1; they take the coastal (weakest) end, which is right — the
    // shelf is young sediment.
    const rings = t[i] > 0 ? t[i] : 0;
    const craton = unit((rings - 1) / (CRATON_SATURATION_RINGS - 1)) * 2 - 1;

    // OROGEN. Standing high above your neighbors means resistant rock is
    // holding you up. Absolute height carries the same signal more weakly.
    const nbrs = c[i];
    let nbrSum = 0;
    for (let k = 0; k < nbrs.length; k++) nbrSum += h[nbrs[k]];
    const nbrMean = nbrs.length > 0 ? nbrSum / nbrs.length : h[i];
    const localRelief = unit((h[i] - nbrMean) / OROGEN_RELIEF_SCALE);
    const absolute = unit((h[i] - OROGEN_NEUTRAL_H) / OROGEN_NEUTRAL_H);
    const orogen = 0.5 * localRelief + 0.5 * absolute;

    // ROCK CLASS.
    const b = biome ? biome[i] : 0;
    const rockClass = b >= 0 && b < ROCK_CLASS.length ? ROCK_CLASS[b] : 0;

    // ALLUVIAL. Only ever softens.
    const flux = fl ? fl[i] : 0;
    const alluvial = -unit(flux / ALLUVIAL_FLUX_SCALE);

    const raw =
      REFERENCE_HARDNESS +
      W_CRATON * craton +
      W_OROGEN * orogen +
      W_ROCK_CLASS * rockClass +
      W_ALLUVIAL * alluvial;
    out[i] = raw < 0 ? 0 : raw > 1 ? 1 : raw;
  }
  return out;
}

/** `erodibility` — the incision-resistance effect of hardness. */
export function erodibilityOf(hardness: number): number {
  return 1 + HARD_ERODIBILITY_STR * (REFERENCE_HARDNESS - hardness);
}

/** `talusScale` — the held-slope effect of hardness. Multiplies a talus angle. */
export function talusScaleOf(hardness: number): number {
  return 1 + HARD_TALUS_STR * (hardness - REFERENCE_HARDNESS);
}
