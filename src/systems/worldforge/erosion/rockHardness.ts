/**
 * @file rockHardness.ts — per-atlas-cell rock hardness, derived from the atlas.
 *
 * This file calculates the mechanical resistance and slope stability of bedrock across the world map.
 *
 * When terrain erodes under uniform hardness, it produces unnatural repeating textures ("brain coral").
 * In the real world, hard crystalline rock resists water cutting and holds steep cliffs, while soft
 * sedimentary fill carves easily into wide valleys. This file determines the rock strength of every
 * atlas cell from geologic cues: continental shields (cratons), mountain roots (orogens), surface
 * climate biomes, and river silt accumulations.
 *
 * Called by: atlasErosionBake.ts, dendriticDrainageNetwork.ts, regionCompositeField.ts
 * Depends on: FMG atlas cell graph, elevation, distance to coast, biome, and water flux.
 */

// ============================================================================
// Types and Interfaces
// ============================================================================
// The input graph structure required from the FMG atlas mesh to compute rock hardness.
// ============================================================================

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

// ============================================================================
// Geologic Constants and Weightings
// ============================================================================
// Dimensionless scaling constants derived from geomorphological laws.
// Hardness is indexed from 0 (very soft alluvium) to 1 (competent crystalline bedrock),
// where 0.5 represents standard reference rock.
// ============================================================================

/** How strongly hardness resists water incision. */
export const HARD_ERODIBILITY_STR = 1.2;

/** How strongly hardness steepens the angle of stable mountain slopes. */
export const HARD_TALUS_STR = 0.6;

/** Hardness of standard reference rock. Gives erodibility 1.0 and talus scale 1.0. */
export const REFERENCE_HARDNESS = 0.5;

// Weightings for geologic terms. CRATON is weighted highest because continental interiors
// expose ancient crystalline basements independent of simple elevation.
const W_CRATON = 0.18;
const W_OROGEN = 0.16;
const W_ROCK_CLASS = 0.10;
const W_ALLUVIAL = 0.08;

/** Ring count from the coastline at which an interior cell reaches full continental shield hardness. */
const CRATON_SATURATION_RINGS = 7;

/** Local relief difference in FMG height units where mountain root hardness saturates. */
const OROGEN_RELIEF_SCALE = 8;

/** Baseline elevation that represents neutral mountain uplift. */
const OROGEN_NEUTRAL_H = 40;

/** River water flux scale at which alluvial sediment completely softens the bedrock. */
const ALLUVIAL_FLUX_SCALE = 120;

/**
 * Rock-class hardness shift per biome id [-1 to +1].
 * Cold/dry climates leave resistant bare bedrock (glacier, tundra, taiga),
 * while hot/wet climates generate deep soft saprolite and alluvium (rainforest, wetland).
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

/** Clamp a value to the [-1, 1] range. */
function unit(v: number): number {
  return v < -1 ? -1 : v > 1 ? 1 : v;
}

// ============================================================================
// Core Hardness Calculation
// ============================================================================
// Evaluates the four physical terms (Craton, Orogen, Biome Class, Alluvium)
// to produce a normalized hardness scalar for every cell in the atlas.
// ============================================================================

/**
 * Compute rock hardness for every cell of an atlas.
 *
 * @param atlas - Atlas mesh topology, heights, biomes, and river flux.
 * @returns Array of rock hardness values in [0, 1] aligned with atlas cell indices.
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
    // CRATON: Distance from coast in rings. Interior cells expose old hard basement rock.
    const rings = t[i] > 0 ? t[i] : 0;
    const craton = unit((rings - 1) / (CRATON_SATURATION_RINGS - 1)) * 2 - 1;

    // OROGEN: Relative elevation above neighbors. Resistant bedrock holds up tall peaks.
    const nbrs = c[i];
    let nbrSum = 0;
    for (let k = 0; k < nbrs.length; k++) nbrSum += h[nbrs[k]];
    const nbrMean = nbrs.length > 0 ? nbrSum / nbrs.length : h[i];
    const localRelief = unit((h[i] - nbrMean) / OROGEN_RELIEF_SCALE);
    const absolute = unit((h[i] - OROGEN_NEUTRAL_H) / OROGEN_NEUTRAL_H);
    const orogen = 0.5 * localRelief + 0.5 * absolute;

    // ROCK CLASS: Climate-based weathering regimes from biomes.
    const b = biome ? biome[i] : 0;
    const rockClass = b >= 0 && b < ROCK_CLASS.length ? ROCK_CLASS[b] : 0;

    // ALLUVIAL: High water flux deposits thick layers of soft sediment.
    const flux = fl ? fl[i] : 0;
    const alluvial = -unit(flux / ALLUVIAL_FLUX_SCALE);

    // Sum weighted contributions around standard reference rock.
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

// ============================================================================
// Physical Scaling Laws
// ============================================================================
// Functions to convert dimensionless rock hardness into physical multipliers
// for channel incision and hillside repose angles.
// ============================================================================

/**
 * Calculates the erodibility multiplier for a given rock hardness.
 * Harder rock reduces incision rate; softer rock accelerates incision.
 *
 * @param hardness - Dimensionless rock hardness in [0, 1].
 * @returns Multiplier for stream incision (1.0 for reference rock 0.5).
 */
export function erodibilityOf(hardness: number): number {
  return 1 + HARD_ERODIBILITY_STR * (REFERENCE_HARDNESS - hardness);
}

/**
 * Calculates the talus slope multiplier for a given rock hardness.
 * Harder rock supports steeper cliff faces before shedding loose scree.
 *
 * @param hardness - Dimensionless rock hardness in [0, 1].
 * @returns Multiplier for maximum held slope angle (1.0 for reference rock 0.5).
 */
export function talusScaleOf(hardness: number): number {
  return 1 + HARD_TALUS_STR * (hardness - REFERENCE_HARDNESS);
}
