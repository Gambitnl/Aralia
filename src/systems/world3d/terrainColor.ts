/**
 * @file terrainColor.ts
 * Map a biome id (+ height) to an RGB color for per-vertex terrain tinting.
 * Matches worldSim biome families plus a few common ids. Height shading darkens
 * lowlands and lightens peaks so relief reads through tint as well as geometry.
 */
type RGB = [number, number, number];

const PALETTE: Record<string, RGB> = {
  ocean: [0.12, 0.28, 0.52],
  water: [0.16, 0.34, 0.58],
  desert: [0.82, 0.74, 0.48],
  plains: [0.46, 0.62, 0.34],
  grassland: [0.5, 0.66, 0.36],
  forest: [0.24, 0.44, 0.24],
  jungle: [0.18, 0.40, 0.20],
  tundra: [0.72, 0.74, 0.70],
  wetland: [0.34, 0.46, 0.34],
  swamp: [0.30, 0.40, 0.28],
  mountain: [0.46, 0.42, 0.40],
  // Glacier ice (Task 10 MOUNTAINS): a light, faintly-blue surface that kills
  // the brown-rock glacier bug — glacier windows now emit an `ice` material.
  ice: [0.86, 0.9, 0.95],
  // Packed earth (trails, taiga/tundra floor, shorelines): a distinct warm
  // brown so dirt no longer reads identical to grass (was aliased to plains).
  dirt: [0.50, 0.42, 0.30],
  // Worked stone paving: cool neutral grey, distinct from mountain's warm rock.
  paved: [0.55, 0.55, 0.57],
  // Interior floor boards.
  floor: [0.40, 0.32, 0.24],
};

const FALLBACK: RGB = [0.45, 0.5, 0.4];

/**
 * Height → brightness multiplier.
 *
 * The ground adapter keeps relief un-normalized (a meadow stays a meadow), so
 * typical local terrain occupies only the low end of the 0..100 height domain
 * (modest relief lands under ~10; see groundWorldAdapter unit contract). A
 * linear ramp over the full 0..100 domain therefore moved brightness by ~2%
 * across an entire local scene — imperceptible.
 *
 * We instead map a realistic LOCAL band (0..HEIGHT_SHADE_SPAN) into a wide
 * brightness swing and front-load the contrast with a sqrt so the common
 * low-relief band gets most of the gradient. Genuinely tall terrain clamps at
 * the top of the band, capping the lighten so cliffs brighten but meadows are
 * not turned into snow-capped Alps.
 */
const HEIGHT_SHADE_SPAN = 40; // height01 units mapped across the full shade range
const SHADE_MIN = 0.82; // darkest (lowest ground)
const SHADE_RANGE = 0.36; // → brightest = 1.18 at/above the span

function heightShade(height01: number): number {
  const t = Math.max(0, Math.min(1, height01 / HEIGHT_SHADE_SPAN));
  return SHADE_MIN + Math.sqrt(t) * SHADE_RANGE;
}

/**
 * Slope → rock blend.
 *
 * Flat-to-gentle ground keeps its biome tint; only genuinely steep faces pick up
 * exposed rock so cliffs read as stone rather than as vertical grass. `slope01`
 * is 0 on flat ground and 1 on a vertical face (derived from the face/vertex
 * normal: `1 - n·up`). Below SLOPE_ROCK_START nothing changes; from there to
 * SLOPE_ROCK_FULL we ramp linearly up to SLOPE_ROCK_MAX_BLEND toward the rock
 * tint, capping the blend so even sheer cliffs keep a hint of their biome.
 */
const SLOPE_ROCK_START = 0.35; // below this slope: pure biome tint (gentle ground)
const SLOPE_ROCK_FULL = 0.8; // at/above this slope: full rock blend
const SLOPE_ROCK_MAX_BLEND = 0.75; // cap so cliffs never go 100% rock
const ROCK_TINT: RGB = [0.42, 0.40, 0.38]; // exposed bare-rock grey

function slopeRockMix(slope01: number): number {
  const s = Math.max(0, Math.min(1, slope01));
  if (s <= SLOPE_ROCK_START) return 0;
  const t = (s - SLOPE_ROCK_START) / (SLOPE_ROCK_FULL - SLOPE_ROCK_START);
  return Math.max(0, Math.min(1, t)) * SLOPE_ROCK_MAX_BLEND;
}

/**
 * Tint for a terrain vertex.
 *
 * @param biomeId biome family id (see PALETTE)
 * @param height01 un-normalized local height (drives subtle relief shading)
 * @param slope01 optional steepness in [0,1] (0 flat, 1 vertical). When omitted
 *   (default 0) the result is identical to the pre-slope behavior, so existing
 *   callers that pass no slope are unaffected. Steep faces blend toward rock.
 */
export function biomeColor(biomeId: string, height01: number, slope01 = 0): RGB {
  const base = PALETTE[biomeId] ?? FALLBACK;
  const shade = heightShade(height01);
  const mix = slopeRockMix(slope01);
  // Shade the biome base, then lerp toward the (also shaded) rock tint by `mix`.
  const r = base[0] * shade * (1 - mix) + ROCK_TINT[0] * shade * mix;
  const g = base[1] * shade * (1 - mix) + ROCK_TINT[1] * shade * mix;
  const b = base[2] * shade * (1 - mix) + ROCK_TINT[2] * shade * mix;
  return [
    Math.max(0, Math.min(1, r)),
    Math.max(0, Math.min(1, g)),
    Math.max(0, Math.min(1, b)),
  ];
}
