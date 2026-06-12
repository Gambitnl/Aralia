/**
 * @file worldGenOptions.ts — Worldforge world-generation options contract.
 *
 * Spec: docs/projects/worldforge/SPEC.md §11 (options exposed at creation,
 * frozen in artifact, read-only in play). The interface mirrors every
 * explicit option accepted by `generateFmgAtlas` / `generateFmgBase` today;
 * defaults match upstream FMG so a default Worldforge world is a default
 * Azgaar world.
 *
 * What changed: new module (B1).
 * Why: SPEC §11 requires a typed, frozen options object recorded verbatim in
 * the AtlasArtifact — previously options were untyped call-site literals.
 * Preserved: no spine/fmg files touched; this module only aggregates the
 * option surfaces already documented in generateBase.ts / generateAtlas.ts.
 */

/**
 * All world-generation options that govern FMG atlas generation.
 * These are the values the world-creation UI exposes; once the world is
 * created they are recorded verbatim in the AtlasArtifact and are
 * IMMUTABLE — no option may be mutated during play (SPEC §11).
 *
 * Each field lists its upstream default in the JSDoc.
 */
export interface WorldGenOptions {
  // ---- generateFmgBase options ----

  /**
   * Map canvas width in FMG graph units (upstream: browser window width).
   * @default 960
   */
  width: number;

  /**
   * Map canvas height in FMG graph units (upstream: browser window height).
   * @default 540
   */
  height: number;

  /**
   * Desired cell count before jittering (upstream "points" / density 4 ⇒
   * 10 000 cells). Must be one of FMG's supported densities (1000–100000).
   * @default 10000
   */
  cellsDesired: number;

  /**
   * Heightmap template key (upstream randomizes via template probabilities;
   * explicit here). Valid keys are those in ./fmg/heightmap-templates.ts.
   * @default "continents"
   */
  template: string;

  /**
   * Depression depth threshold for adding lakes. 80 disables the step.
   * Upstream DOM input `lakeElevationLimitOutput`.
   * @default 20
   */
  lakeElevationLimit: number;

  // ---- generateFmgAtlas options ----

  /**
   * Map size as % of the globe (upstream `mapSizeOutput`). When set,
   * defineMapSize still draws its random value (RNG stream is identical)
   * but the drawn value is discarded in favour of this one.
   * Default: the value defineMapSize draws for the seed/template.
   * Stored as `null` to mean "use drawn value" — the adapter records the
   * actually-used value after generation.
   * @default null  (use drawn value; recorded as the resolved value post-gen)
   */
  mapSize: number | null;

  /**
   * Latitude shift as % (upstream `latitudeOutput`). Same locked-input
   * semantics as mapSize.
   * @default null  (use drawn value)
   */
  latitude: number | null;

  /**
   * Longitude shift as % (upstream `longitudeOutput`). Same locked-input
   * semantics as mapSize.
   * @default null  (use drawn value)
   */
  longitude: number | null;

  /**
   * Equator temperature in °C.
   * Upstream `options.temperatureEquator`.
   * @default 27
   */
  temperatureEquator: number;

  /**
   * North pole temperature in °C.
   * Upstream `options.temperatureNorthPole`.
   * @default -30
   */
  temperatureNorthPole: number;

  /**
   * South pole temperature in °C.
   * Upstream `options.temperatureSouthPole`.
   * @default -15
   */
  temperatureSouthPole: number;

  /**
   * Prevailing wind angles per 30° latitude tier (6 tiers from south pole
   * to north pole). Upstream `options.winds`.
   * @default [225, 45, 225, 315, 135, 315]
   */
  winds: number[];

  /**
   * Altitude-change sharpness exponent. Upstream `heightExponentInput`.
   * @default 2
   */
  heightExponent: number;

  /**
   * Precipitation modifier in % of the baseline. Upstream `precInput`; the
   * distribution centre is 100 (gauss(100,40,5,500)) so 100 is the default.
   * @default 100
   */
  precipitationModifier: number;

  /**
   * Maximum depression-filling iterations. Upstream
   * `resolveDepressionsStepsOutput`.
   * @default 250
   */
  resolveDepressionsSteps: number;

  /**
   * Apply river erosion to pack cell heights. Upstream
   * `Rivers.generate(allowErosion)`.
   * @default true
   */
  allowErosion: boolean;
}

/**
 * Default options matching upstream FMG defaults exactly so a default
 * Worldforge world is a default Azgaar world (SPEC §11).
 *
 * `mapSize`, `latitude`, `longitude` are null — meaning "use the value
 * defineMapSize draws for this seed/template", consistent with FMG's unlocked
 * UI state. The adapter records the resolved values after generation.
 */
export const DEFAULT_WORLD_GEN_OPTIONS: WorldGenOptions = {
  width: 960,
  height: 540,
  cellsDesired: 10000,
  template: 'continents',
  lakeElevationLimit: 20,
  mapSize: null,
  latitude: null,
  longitude: null,
  temperatureEquator: 27,
  temperatureNorthPole: -30,
  temperatureSouthPole: -15,
  winds: [225, 45, 225, 315, 135, 315],
  heightExponent: 2,
  precipitationModifier: 100,
  resolveDepressionsSteps: 250,
  allowErosion: true,
};

/**
 * Return a deeply Object.freeze'd copy of `opts`, ensuring the artifact's
 * options are truly immutable at runtime (SPEC §11: "no option may mutate
 * during gameplay").
 *
 * `winds` is the only nested array; all other fields are primitives.
 */
export function freezeWorldGenOptions(opts: WorldGenOptions): Readonly<WorldGenOptions> {
  return Object.freeze({
    ...opts,
    winds: Object.freeze([...opts.winds]),
  }) as Readonly<WorldGenOptions>;
}
