import { type FmgBaseOptions, type FmgBaseResult } from "./generateBase";
import { type MapCoordinates } from "./climate";
import { type Pack } from "./features";
import { type BiomesData } from "./biomes";
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
export declare function generateFmgAtlas(seed: string, options?: FmgAtlasOptions): FmgAtlasResult;
