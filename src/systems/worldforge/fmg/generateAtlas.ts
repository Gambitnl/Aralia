/**
 * @file generateAtlas.ts — headless entry for the ported FMG atlas, slice 2
 * (Worldforge build-order item 2b): everything generateBase produces, plus
 * climate (map coordinates, temperature, precipitation), the packed graph
 * (reGraph + Features.markupPack), rivers (with the lake climate/cleanup
 * steps) and biomes.
 *
 * Orchestration order is FMG's own (upstream public/main.js `generate()`),
 * continuing exactly where generateBase stops:
 *    ... openNearSeaLakes()            (slice 1, via generateFmgBase)
 *    7.  OceanLayers()                 — STRIPPED, render-only (see below)
 *    8.  defineMapSize()               (gauss/P draws from the seeded stream)
 *    9.  calculateMapCoordinates()
 *    10. calculateTemperatures()
 *    11. generatePrecipitation()       (rand draws continue the same stream)
 *    12. reGraph()
 *    13. Features.markupPack()
 *    14. createDefaultRuler()          — STRIPPED, UI-only, no RNG
 *    15. Rivers.generate()             (re-seeds Alea internally)
 *    16. Biomes.define()
 *    17. Features.defineGroups()
 * Later upstream stages (Ice, rankCells, Cultures, ...) belong to slice 3.
 *
 * RNG CONTRACT: upstream's last reseed before stage 8 is
 * `Math.random = Alea(seed)` inside Features.markupGrid, and none of
 * markupGrid / addLakesInDeepDepressions / openNearSeaLakes / OceanLayers
 * (with the default "-6,-3,-1" layers setting) draws from it. So the stream
 * upstream feeds into defineMapSize→generatePrecipitation is a FRESH
 * Alea(seed) — which is exactly what this runner re-creates after
 * generateFmgBase returns (generateFmgBase restores Math.random in its own
 * finally). Rivers.generate then re-seeds again, like upstream.
 *
 * STRIPPED OceanLayers (upstream stage between openNearSeaLakes and
 * defineMapSize): pure SVG rendering of ocean depth contours. With FMG's
 * default style ("layers" = "-6,-3,-1") it draws NO RNG; only the
 * non-default "random" outline mode would call P() up to 9 times — that mode
 * is not reproduced (it would shift the defineMapSize/precipitation stream).
 */
import Alea from "alea";
import {
  generateFmgBase,
  type FmgBaseOptions,
  type FmgBaseResult,
} from "./generateBase";
import {
  calculateMapCoordinates,
  calculateTemperatures,
  defineMapSize,
  generatePrecipitation,
  type MapCoordinates,
} from "./climate";
import { reGraph } from "./reGraph";
import { Features, type Pack } from "./features";
import { Rivers } from "./river-generator";
import { Biomes, type BiomesData } from "./biomes";
import type { Grid } from "./utils/graphUtils";

export interface FmgAtlasOptions extends FmgBaseOptions {
  /**
   * Map size in % of the globe (upstream `mapSizeOutput`). Like upstream's
   * "locked" input: when set, defineMapSize still DRAWS its random size (the
   * RNG stream must advance identically) but the drawn value is discarded.
   * Default: the value defineMapSize draws for the seed/template.
   */
  mapSize?: number;
  /** Latitude shift in % (upstream `latitudeOutput`). Locked-input semantics, see mapSize. */
  latitude?: number;
  /** Longitude shift in % (upstream `longitudeOutput`). Locked-input semantics, see mapSize. */
  longitude?: number;
  /** Equator temperature °C (upstream options.temperatureEquator). Default 27. */
  temperatureEquator?: number;
  /** North pole temperature °C (upstream options.temperatureNorthPole). Default -30. */
  temperatureNorthPole?: number;
  /** South pole temperature °C (upstream options.temperatureSouthPole). Default -15. */
  temperatureSouthPole?: number;
  /**
   * Prevailing wind angles per 30° tier (upstream options.winds).
   * Default [225, 45, 225, 315, 135, 315].
   */
  winds?: number[];
  /** Altitude-change sharpness exponent (upstream heightExponentInput, default 2). */
  heightExponent?: number;
  /**
   * Precipitation input in % (upstream precInput). Upstream randomizes this
   * per map via gauss(100, 40, 5, 500) on the UI-only aleaPRNG stream (not
   * reproduced, same stance as slice 1's template selection); default 100 is
   * that distribution's center. The static DOM fallback (50) is only ever
   * used with a locked input.
   */
  precipitationModifier?: number;
  /** Depression-filling iteration cap (upstream resolveDepressionsStepsOutput, default 250). */
  resolveDepressionsSteps?: number;
  /** Apply river erosion to pack heights (upstream Rivers.generate(allowErosion), default true). */
  allowErosion?: boolean;
}

export interface FmgAtlasResult extends FmgBaseResult {
  /** Map position on the globe (upstream global `mapCoordinates`). */
  mapCoordinates: MapCoordinates;
  /** Map size / latitude shift / longitude shift in % actually used. */
  mapSize: number;
  latitude: number;
  longitude: number;
  /**
   * The packed graph: cells (p/g/h/area/t/f/haven/harbor/fl/r/conf/biome),
   * vertices, features (index 0 is a literal 0 placeholder, as upstream)
   * and rivers.
   */
  pack: Pack;
  /** The biomes catalog used (upstream main.js `biomesData`). */
  biomesData: BiomesData;
}

/**
 * Generate the FMG atlas (slice 1 + slice 2 stages) headlessly.
 * Deterministic: the same seed + options always produce the same grid, pack,
 * rivers and biomes. `generateFmgBase` remains available and unchanged for
 * slice-1-only consumers.
 */
export function generateFmgAtlas(
  seed: string,
  options: FmgAtlasOptions = {},
): FmgAtlasResult {
  const {
    width = 960,
    height = 540,
    cellsDesired = 10000,
    template = "continents",
    lakeElevationLimit = 20,
    temperatureEquator = 27,
    temperatureNorthPole = -30,
    temperatureSouthPole = -15,
    winds = [225, 45, 225, 315, 135, 315],
    heightExponent = 2,
    precipitationModifier = 100,
    resolveDepressionsSteps = 250,
    allowErosion = true,
  } = options;

  // Slice 1 (manages its own Math.random override and restores it).
  const base = generateFmgBase(seed, {
    width,
    height,
    cellsDesired,
    template,
    lakeElevationLimit,
  });
  const grid: Grid = base.grid;

  const originalRandom = Math.random;
  try {
    // Re-create the exact stream state upstream has entering defineMapSize:
    // the last reseed was Alea(seed) in markupGrid and nothing has drawn
    // since (see file header), so a fresh Alea(seed) is bit-identical.
    Math.random = Alea(seed);

    // 8. defineMapSize — always draws, locked options discard the result
    const [drawnSize, drawnLatitude, drawnLongitude] = defineMapSize(
      template,
      grid,
    );
    const mapSize = options.mapSize ?? drawnSize;
    const latitude = options.latitude ?? drawnLatitude;
    const longitude = options.longitude ?? drawnLongitude;

    // 9-11. climate
    const mapCoordinates = calculateMapCoordinates(
      mapSize,
      latitude,
      longitude,
      width,
      height,
    );
    calculateTemperatures(grid, mapCoordinates, height, {
      temperatureEquator,
      temperatureNorthPole,
      temperatureSouthPole,
      heightExponent,
    });
    generatePrecipitation(grid, mapCoordinates, {
      winds,
      cellsDesired,
      precipitationModifier,
    });

    // 12-13. packed graph
    const pack = reGraph(grid);
    Features.markupPack(pack, width, height);

    // 15. rivers (re-seeds Alea(seed) internally, as upstream)
    Rivers.generate({
      seed,
      grid,
      pack,
      cellsDesired,
      graphWidth: width,
      graphHeight: height,
      resolveDepressionsSteps,
      lakeElevationLimit,
      heightExponent,
      allowErosion,
    });

    // 16-17. biomes + feature groups
    const biomesData = Biomes.getDefault();
    Biomes.define(grid, pack, biomesData);
    Features.defineGroups(grid, pack);

    return {
      ...base,
      mapCoordinates,
      mapSize,
      latitude,
      longitude,
      pack,
      biomesData,
    };
  } finally {
    Math.random = originalRandom;
  }
}
