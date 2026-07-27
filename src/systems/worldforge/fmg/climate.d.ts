import type { Grid } from "./utils/graphUtils";
/** Upstream global `mapCoordinates` — map position on the globe. */
export interface MapCoordinates {
    latT: number;
    latN: number;
    latS: number;
    lonT: number;
    lonW: number;
    lonE: number;
}
/**
 * Define map size and position based on template and random factor.
 * Exact port of `defineMapSize`/`getSizeAndLatitude` from upstream
 * public/main.js, returning the [size, latitude, longitude] triple instead of
 * writing DOM inputs. The caller applies "locked" overrides (upstream:
 * `locked("mapSize")` etc.) AFTER the draws, exactly like upstream.
 */
export declare function defineMapSize(template: string, grid: Grid): [number, number, number];
/**
 * Calculate map position on the globe.
 * Exact port of `calculateMapCoordinates` from upstream public/main.js.
 * @param mapSize - map size in % (upstream byId("mapSizeOutput").value)
 * @param latitude - latitude shift in % (upstream byId("latitudeOutput").value)
 * @param longitude - longitude shift in % (upstream byId("longitudeOutput").value)
 */
export declare function calculateMapCoordinates(mapSize: number, latitude: number, longitude: number, graphWidth: number, graphHeight: number): MapCoordinates;
export interface TemperatureOptions {
    temperatureEquator: number;
    temperatureNorthPole: number;
    temperatureSouthPole: number;
    heightExponent: number;
}
/**
 * Temperature model, trying to follow real-world data.
 * Exact port of `calculateTemperatures` from upstream public/main.js
 * (based on http://www-das.uwyo.edu/~geerts/cwx/notes/chap16/Image64.gif).
 * No RNG draws.
 */
export declare function calculateTemperatures(grid: Grid, mapCoordinates: MapCoordinates, graphHeight: number, options: TemperatureOptions): void;
export interface PrecipitationOptions {
    winds: number[];
    cellsDesired: number;
    precipitationModifier: number;
}
/**
 * Simplest precipitation model.
 * Exact port of `generatePrecipitation` from upstream public/main.js, minus
 * the SVG wind-arrow rendering (`prec.selectAll(...)`/`drawWindDirection`),
 * which draws no RNG. The `rand(10, 20)` coastal draws consume the global
 * Math.random stream in exactly the upstream order.
 */
export declare function generatePrecipitation(grid: Grid, mapCoordinates: MapCoordinates, options: PrecipitationOptions): void;
