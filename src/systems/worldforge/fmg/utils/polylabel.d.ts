/**
 * @file utils/polylabel.ts — pole-of-inaccessibility finder, vendored.
 * Upstream FMG (TS branch) imports the npm package `polylabel` 2.0.1 (ISC,
 * Mapbox) in `src/utils/pathUtils.ts`; this is a verbatim port of that
 * version, with its `tinyqueue` dependency (ISC, Vladimir Agafonkin) inlined.
 *
 * Faithfulness: probe order and the `precision` cut-off reproduce the exact
 * label point upstream computes — States.getPoles / Provinces.getPoles store
 * these coordinates in the pack. No RNG.
 */
type Ring = ArrayLike<number>[];
type Polygon = Ring[];
export declare function polylabel(polygon: Polygon, precision?: number): [number, number];
export {};
