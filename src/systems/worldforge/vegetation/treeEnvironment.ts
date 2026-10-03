/**
 * ============================================================================
 * TREE ENVIRONMENT ADAPTATION MODEL
 * ============================================================================
 *
 * WHAT THIS FILE DOES:
 * This file translates in-game biomes and geography (like elevation, latitude, and moisture)
 * into five fundamental environmental axes that dictate how trees grow: light, wind,
 * aridity, chill, and vigor.
 *
 * WHY IT EXISTS:
 * Rather than using static tree models, Aralia uses procedural tree genomes that adapt
 * to their climate. Trees growing on high, cold ridges grow short and sturdy against
 * strong winds, while trees in sheltered tropical rainforests grow tall and broad to reach
 * sunlight. This file calculates those environmental stress factors.
 *
 * SAFETY INVARIANTS:
 * - Treeless biomes (like 'Marine', 'Glacier', 'ocean', 'water') intentionally THROW errors.
 *   There is no silent fallback to default trees on open ocean or glaciers.
 * - Standard terrestrial biomes (both FMG names and ground IDs) map cleanly to environmental axes.
 *
 * HOW IT CONNECTS:
 * - Called by: grownTreeVariants.ts and grownTreeWiring.ts to supply climate parameters to growTree().
 * ============================================================================
 */

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/** The five environmental axes a tree genome is biased against. All values are clamped between 0 and 1. */
export interface TreeEnvironment {
  /** Canopy light reaching the sapling. 1 = bright open ground, 0 = dense dark understory. */
  light: number;
  /** Sustained wind exposure. 1 = an unsheltered high mountain ridge, 0 = calm valley. */
  wind: number;
  /** Water stress. 0 = standing wetland water, 1 = arid desert sand dune. */
  aridity: number;
  /** Cold temperature stress. 1 = arctic permafrost, 0 = equatorial warmth. */
  chill: number;
  /** Growing-season length and soil richness. 1 = lush rainforest, 0 = barren rock. */
  vigor: number;
}

/** Atlas and geographic site conditions that callers can optionally supply on top of biome names. */
export interface TreeSiteInputs {
  /**
   * Ground elevation in FEET (feet are canon in Worldforge).
   * Higher elevation raises wind and chill, and lowers vigor.
   */
  elevationFt?: number;
  /**
   * Latitude in degrees (0 = equator, 90 = pole). Sign is ignored.
   * Higher latitude raises chill and exposure.
   */
  latitudeDeg?: number;
  /**
   * Cell moisture (0 = bone dry, 1 = saturated).
   * Overrides the default biome aridity when supplied.
   */
  moisture01?: number;
}

// ============================================================================
// BIOME BASE CLIMATE TABLES
// ============================================================================

/**
 * Base environmental axes per Fantasy Map Generator (FMG) biome name.
 *
 * Marine (0) and Glacier (11) are intentionally omitted: asking to grow trees on
 * open water or ice sheets is invalid and must throw.
 */
const BIOME_BASE: Readonly<Record<string, TreeEnvironment>> = {
  'Hot desert': { light: 0.95, wind: 0.55, aridity: 0.95, chill: 0.05, vigor: 0.12 },
  'Cold desert': { light: 0.88, wind: 0.60, aridity: 0.85, chill: 0.55, vigor: 0.15 },
  Savanna: { light: 0.90, wind: 0.45, aridity: 0.62, chill: 0.08, vigor: 0.42 },
  Grassland: { light: 0.85, wind: 0.42, aridity: 0.45, chill: 0.25, vigor: 0.55 },
  'Tropical seasonal forest': { light: 0.45, wind: 0.22, aridity: 0.35, chill: 0.03, vigor: 0.80 },
  'Temperate deciduous forest': { light: 0.40, wind: 0.20, aridity: 0.25, chill: 0.32, vigor: 0.82 },
  'Tropical rainforest': { light: 0.16, wind: 0.10, aridity: 0.05, chill: 0.00, vigor: 1.00 },
  'Temperate rainforest': { light: 0.22, wind: 0.15, aridity: 0.08, chill: 0.28, vigor: 0.95 },
  Taiga: { light: 0.55, wind: 0.50, aridity: 0.30, chill: 0.82, vigor: 0.38 },
  Tundra: { light: 0.92, wind: 0.85, aridity: 0.55, chill: 0.95, vigor: 0.10 },
  Wetland: { light: 0.50, wind: 0.25, aridity: 0.02, chill: 0.30, vigor: 0.70 },
};

/**
 * Aliases mapping 3D ground world IDs onto canonical FMG biome names.
 * Water, ocean, ice, and pavement are omitted on purpose.
 */
const GROUND_ALIAS: Readonly<Record<string, string>> = {
  desert: 'Hot desert',
  plains: 'Grassland',
  grassland: 'Grassland',
  forest: 'Temperate deciduous forest',
  forest_floor: 'Temperate deciduous forest',
  jungle: 'Tropical rainforest',
  tundra: 'Tundra',
  wetland: 'Wetland',
  swamp: 'Wetland',
};

/** Every valid biome key recognized by this module (atlas names and ground IDs). */
export const TREE_BIOME_KEYS: readonly string[] = [
  ...Object.keys(BIOME_BASE),
  ...Object.keys(GROUND_ALIAS),
];

// ============================================================================
// ENVIRONMENTAL CONSTANTS & CALCULATIONS
// ============================================================================

/** Clamps a numeric value to the standard 0.0 to 1.0 range. */
function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Elevation reference heights in feet for environmental calculations. */
const WIND_SATURATION_FT = 6000;
const VIGOR_SATURATION_FT = 12000;
const CHILL_SATURATION_FT = 10000;

/** Latitude thresholds in degrees where cooling and wind exposure begin. */
const CHILL_LATITUDE_START_DEG = 30;
const CHILL_LATITUDE_SPAN_DEG = 60;
const WIND_LATITUDE_START_DEG = 40;
const WIND_LATITUDE_SPAN_DEG = 50;

/** How strongly supplied moisture readings influence final aridity (60% authority). */
const MOISTURE_AUTHORITY = 0.6;

// ============================================================================
// ENVIRONMENT RESOLUTION EXPORTS
// ============================================================================

/**
 * Resolves the 5-axis growing environment for a specific biome and location.
 *
 * THROWS an error on an unmapped or treeless biome by design (e.g. 'Marine').
 *
 * @param biome An FMG biome name ('Taiga') or ground ID ('jungle')
 * @param site Optional local geographic facts (elevation, latitude, moisture)
 * @returns Clamped TreeEnvironment axes
 */
export function environmentForBiome(biome: string, site: TreeSiteInputs = {}): TreeEnvironment {
  // Resolve alias if needed
  const canonical = BIOME_BASE[biome] ? biome : GROUND_ALIAS[biome];
  const base = canonical ? BIOME_BASE[canonical] : undefined;

  // Enforce safety invariant: fail loudly on treeless biomes
  if (!base) {
    throw new Error(
      `treeEnvironment: no environment mapped for biome "${biome}". `
      + `Known: ${TREE_BIOME_KEYS.join(', ')}. `
      + `Marine, Glacier and other treeless surfaces are excluded on purpose.`,
    );
  }

  const elevationFt = Math.max(0, site.elevationFt ?? 0);
  const absLat = Math.abs(site.latitudeDeg ?? 0);

  // Compute elevation modifiers: higher elevation increases wind and cold, decreases vigor
  const windFromElevation = clamp01(elevationFt / WIND_SATURATION_FT) * 0.35;
  const windFromLatitude =
    clamp01((absLat - WIND_LATITUDE_START_DEG) / WIND_LATITUDE_SPAN_DEG) * 0.20;
  const chillFromElevation = clamp01(elevationFt / CHILL_SATURATION_FT) * 0.50;
  const chillFromLatitude =
    clamp01((absLat - CHILL_LATITUDE_START_DEG) / CHILL_LATITUDE_SPAN_DEG) * 0.45;
  const vigorLoss = clamp01(elevationFt / VIGOR_SATURATION_FT) * 0.55;

  // Blend moisture reading with biome baseline aridity
  const aridity = site.moisture01 === undefined
    ? base.aridity
    : base.aridity * (1 - MOISTURE_AUTHORITY)
      + (1 - clamp01(site.moisture01)) * MOISTURE_AUTHORITY;

  return {
    light: clamp01(base.light),
    wind: clamp01(base.wind + windFromElevation + windFromLatitude),
    aridity: clamp01(aridity),
    chill: clamp01(base.chill + chillFromElevation + chillFromLatitude),
    vigor: clamp01(base.vigor * (1 - vigorLoss)),
  };
}

/**
 * Checks whether a given biome key can support tree growth at all.
 *
 * @param biome Biome name or ground ID to test
 * @returns True if trees can grow in this biome, false for water/glaciers/etc.
 */
export function biomeGrowsTrees(biome: string): boolean {
  return Boolean(BIOME_BASE[biome] ?? (GROUND_ALIAS[biome] && BIOME_BASE[GROUND_ALIAS[biome]]));
}
