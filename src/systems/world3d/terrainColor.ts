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

export function biomeColor(biomeId: string, height01: number): RGB {
  const base = PALETTE[biomeId] ?? FALLBACK;
  const shade = heightShade(height01);
  return [
    Math.max(0, Math.min(1, base[0] * shade)),
    Math.max(0, Math.min(1, base[1] * shade)),
    Math.max(0, Math.min(1, base[2] * shade)),
  ];
}
