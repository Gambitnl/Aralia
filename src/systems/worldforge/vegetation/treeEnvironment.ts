/**
 * @file treeEnvironment.ts — the environment axes a tree grows against.
 *
 * WHY THIS EXISTS
 *
 * The world's trees come from ez-tree PRESETS. A preset is a fixed answer: the
 * same six silhouettes stand in a taiga, a rainforest and a dune field, and only
 * the canopy tint tells them apart. The forests campaign wants forests that
 * differ BY BIOME. A preset cannot give that.
 *
 * The method (published botany, written here from scratch — see
 * `docs/reports/owenyuwono-procgen-suite-eval.md` section 5) is that the
 * ENVIRONMENT BIASES A GENOME. The same seed then grows a different tree in a
 * different place. This file is the environment half.
 *
 * ARALIA IS NOT A PLANET SIMULATOR
 *
 * The evaluated method carries a planet envelope with a GRAVITY axis. Aralia has
 * one world and therefore one gravity, so a gravity input would be a dial that
 * is always set to the same number. It is a documented CONSTANT in the grower,
 * not an input here.
 *
 * Aralia's real inputs are the ones the atlas already carries: the FMG biome,
 * elevation, latitude and moisture. Those map onto five axes:
 *
 * - `light`    canopy light reaching a sapling. Open ground is bright, a
 *              rainforest understory is dim.
 * - `wind`     sustained exposure. Rises with elevation and latitude.
 * - `aridity`  water stress. 0 is standing water, 1 is a dune field.
 * - `chill`    cold stress. Rises with elevation and latitude.
 * - `vigor`    growing-season length and soil. Sets absolute size.
 *
 * NO FALLBACK
 *
 * An unmapped biome THROWS. A silent default preset is exactly the fault this
 * module removes, so it must never reappear as a silent default environment.
 * Marine and Glacier are absent on purpose: no tree grows there.
 */

/** The five axes a genome is biased against. All are clamped to 0..1. */
export interface TreeEnvironment {
  /** Canopy light reaching the sapling. 1 = open ground, 0 = deep understory. */
  light: number;
  /** Sustained wind exposure. 1 = an unsheltered ridge. */
  wind: number;
  /** Water stress. 0 = standing water, 1 = a dune field. */
  aridity: number;
  /** Cold stress. 1 = permafrost. */
  chill: number;
  /** Growing-season length and soil. 1 = rainforest, 0 = bare rock. */
  vigor: number;
}

/** The atlas facts a caller can supply on top of the biome. All optional. */
export interface TreeSiteInputs {
  /**
   * Ground elevation in FEET (feet are canon in Worldforge). Raises wind and
   * chill, lowers vigor.
   */
  elevationFt?: number;
  /**
   * Latitude in degrees, signed or not — only the magnitude is read. Raises
   * chill, and raises wind past the temperate belt.
   */
  latitudeDeg?: number;
  /**
   * Cell moisture, 0..1, as the atlas climate pass reports it. Overrides most
   * of the biome's own aridity when supplied.
   */
  moisture01?: number;
}

/**
 * Base axes per FMG biome name.
 *
 * The name list is the 13-entry vocabulary in `fmg/biomes.ts`. Marine (0) and
 * Glacier (11) are deliberately absent: asking for a tree there is a caller
 * fault, and it must fail loudly rather than grow an oak on an ice sheet.
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
 * The streamed ground world names biomes with a coarser vocabulary than the
 * atlas does (`chunkData.biomeIds` — see `world3d/vegetationScatter.ts`). These
 * are aliases onto the FMG names above, not a second table: one source of truth
 * for the axes, two names for the same place.
 *
 * Ground ids with no tree (`ocean`, `water`, `ice`, `paved`, `floor`) are absent
 * on purpose, for the same reason Marine and Glacier are.
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

/** Every biome key this module answers to, atlas names and ground ids alike. */
export const TREE_BIOME_KEYS: readonly string[] = [
  ...Object.keys(BIOME_BASE),
  ...Object.keys(GROUND_ALIAS),
];

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * Elevation reference heights, in feet.
 *
 * Wind saturates first, then vigor, then chill: a ridge is windy long before it
 * is cold, and it is barren before it is frozen.
 */
const WIND_SATURATION_FT = 6000;
const VIGOR_SATURATION_FT = 12000;
const CHILL_SATURATION_FT = 10000;
/** Latitude at which polar cooling starts, and where exposure starts. */
const CHILL_LATITUDE_START_DEG = 30;
const CHILL_LATITUDE_SPAN_DEG = 60;
const WIND_LATITUDE_START_DEG = 40;
const WIND_LATITUDE_SPAN_DEG = 50;
/** How much of the final aridity a supplied moisture reading owns. */
const MOISTURE_AUTHORITY = 0.6;

/**
 * Resolve the environment for one site. THROWS on an unmapped biome.
 *
 * @param biome An FMG biome name (`'Taiga'`) or a ground biome id (`'jungle'`).
 * @param site Optional atlas facts. Omit them and the biome base is returned.
 */
export function environmentForBiome(biome: string, site: TreeSiteInputs = {}): TreeEnvironment {
  const canonical = BIOME_BASE[biome] ? biome : GROUND_ALIAS[biome];
  const base = canonical ? BIOME_BASE[canonical] : undefined;
  if (!base) {
    // NO FALLBACK. A quiet default here would be the preset fault again, one
    // layer down: every unknown place would grow the same tree and nobody would
    // ever learn that the mapping is missing.
    throw new Error(
      `treeEnvironment: no environment mapped for biome "${biome}". `
      + `Known: ${TREE_BIOME_KEYS.join(', ')}. `
      + `Marine, Glacier and other treeless surfaces are excluded on purpose.`,
    );
  }

  const elevationFt = Math.max(0, site.elevationFt ?? 0);
  const absLat = Math.abs(site.latitudeDeg ?? 0);

  const windFromElevation = clamp01(elevationFt / WIND_SATURATION_FT) * 0.35;
  const windFromLatitude =
    clamp01((absLat - WIND_LATITUDE_START_DEG) / WIND_LATITUDE_SPAN_DEG) * 0.20;
  const chillFromElevation = clamp01(elevationFt / CHILL_SATURATION_FT) * 0.50;
  const chillFromLatitude =
    clamp01((absLat - CHILL_LATITUDE_START_DEG) / CHILL_LATITUDE_SPAN_DEG) * 0.45;
  const vigorLoss = clamp01(elevationFt / VIGOR_SATURATION_FT) * 0.55;

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

/** True when this biome can grow a tree at all. Cheap pre-check for callers. */
export function biomeGrowsTrees(biome: string): boolean {
  return Boolean(BIOME_BASE[biome] ?? (GROUND_ALIAS[biome] && BIOME_BASE[GROUND_ALIAS[biome]]));
}
