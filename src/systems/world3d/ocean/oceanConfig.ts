// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 26/08/2026, 14:23:02
 * Dependents: components/DesignPreview/steps/sidebyside/SideBySideOcean.tsx, systems/world3d/ocean/index.ts, systems/world3d/ocean/oceanCompute.ts, systems/world3d/ocean/oceanField.ts, systems/world3d/ocean/oceanSpectrum.ts, systems/world3d/ocean/oceanSurface.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file oceanConfig.ts — the open-ocean wave field's parameters and unit rule.
 *
 * WHAT THIS IS
 *
 * Aralia's maritime travel had no open-ocean surface. The volumetric solvers
 * in `src/systems/worldforge/terrain/` (SPH, FLIP, droplet, shallow water)
 * answer a different question: what does a finite body of water DO when you
 * disturb it. A ship at sea needs a wave FIELD — an unbounded, statistically
 * correct sea state that never runs out and never repeats visibly.
 *
 * That is a spectral problem, not a particle problem. Nothing here imports
 * from the volumetric solvers, on purpose.
 *
 * THE UNIT RULE
 *
 * Worldforge canon is feet (SPEC §4). Oceanography is metric: every published
 * constant in the JONSWAP spectrum assumes meters, seconds and m/s.
 *
 * So this module draws ONE boundary and states it plainly:
 *
 *   - The PUBLIC surface of the ocean module speaks FEET. Patch sizes, wave
 *     heights and ship positions cross the boundary in feet.
 *   - The INTERNAL spectrum and transform speak METERS. Every constant below
 *     is metric and is documented as metric.
 *   - `oceanUnits.ts` holds the only conversion, and it uses the canonical
 *     `FEET_PER_METER` from `src/systems/worldforge/units.ts`. There is no
 *     second conversion anywhere in this module.
 *
 * A caller who reads a wave height in feet and a caller who reads it in
 * meters must never both exist. The feet reader is the supported one.
 */

/** Standard gravity, m/s^2. Metric — internal only. */
export const GRAVITY_MS2 = 9.81;

/**
 * A distance roll-off for one cascade's contribution.
 *
 * A cascade holds a fixed band of wavelengths. Past some range the mesh cannot
 * carry that band, and drawing it anyway produces aliasing rather than detail.
 * So each cascade fades out over its own range, and each may keep a floor.
 *
 * `floor` is what remains at infinite range. The swell keeps most of itself
 * because a 126 m wave is still resolvable at 3 km; the ripple keeps nothing
 * because a 0.4 m wave is not resolvable at 50 m.
 */
export interface CascadeLod {
  /** Range where the roll-off begins, METERS from the patch center. */
  readonly startM: number;
  /** Range where the roll-off has reached `floor`, METERS. */
  readonly endM: number;
  /** Fraction kept past `endM`, 0 to 1. */
  readonly floor: number;
}

/**
 * One cascade of the sea. Metric — internal only.
 *
 * A cascade is one full FFT patch with its own band. THREE of them are summed.
 *
 * ONE IS NOT ENOUGH: a single patch of a single spectrum reads as one
 * repeating swell rolling in one direction, which the eye reads as corduroy.
 * A real sea is a local wind sea riding on a swell that arrived from a storm
 * somewhere else, travelling a different way.
 *
 * TWO WAS NOT ENOUGH EITHER, and this was found by looking rather than by
 * arguing. Two cascades reach a finest wavelength of 0.76 m on a 0.38 m texel.
 * From a deck 9 m up that is fine. From an eye 1.6 m above the water it is
 * not: the near surface has no structure smaller than a meter, so it reads as
 * a smooth hill with a shine on it. The third cascade puts a 0.05 m texel
 * under the near water, which is where the eye actually looks.
 */
export interface CascadeParams {
  /** Human label, for probes and debug overlays. */
  readonly name: string;
  /**
   * Patch size in METERS. The FFT is periodic over this distance, so this is
   * also the tiling period. Every cascade uses a deliberately incommensurate
   * patch size so their tiling periods do not line up.
   */
  readonly patchM: number;
  /** Wind speed at 10 m, METERS PER SECOND. Drives the JONSWAP peak. */
  readonly windSpeedMs: number;
  /** Fetch — the distance the wind has blown over water, METERS. */
  readonly fetchM: number;
  /** Wind direction, RADIANS, measured from +X toward +Z. */
  readonly windDirRad: number;
  /**
   * Water depth, METERS. Feeds the TMA shallow-water correction and the
   * finite-depth dispersion relation. Open ocean is effectively infinite;
   * 1000 m is deep enough that TMA is a no-op there.
   */
  readonly depthM: number;
  /**
   * Wavelengths shorter than this (METERS) are cut from this cascade.
   * Wavelengths longer than this are cut from the NEXT cascade. Without the
   * cut, two cascades double-count the band they share and the sea gains
   * energy it should not have.
   */
  readonly cutoffLowM: number;
  /** Wavelengths longer than this (METERS) are cut from this cascade. */
  readonly cutoffHighM: number;
  /**
   * Horizontal choppiness. 0 gives round swell; ~1.2 gives the sharp crest
   * and broad trough of a real sea. Where it self-intersects depends on the
   * band: a short steep band folds at a lower setting than a long one, so
   * the limit is measured per cascade (the `<0` Jacobian fraction must stay
   * at zero), not assumed.
   *
   * POSITIVE MEANS THE CREST SHARPENS. The kernels apply this value with a
   * negative sign to Tessendorf's displacement formula, because under this
   * pipeline's transform convention his sign moves surface points away from
   * the crest and cusps the trough instead. That was measured, not argued:
   * see the pack kernel in oceanCompute.ts. Callers never see the sign.
   */
  readonly choppiness: number;
  /** Distance roll-off applied to this cascade's DISPLACEMENT (geometry). */
  readonly dispLod: CascadeLod;
  /** Distance roll-off applied to this cascade's NORMAL (shading). */
  readonly normalLod: CascadeLod;
  /**
   * True on a cascade whose folding Jacobian feeds foam.
   *
   * Only a steep cascade can fold. The swell provably cannot: its measured
   * Jacobian minimum is 0.82 at any choppiness. Including it would only
   * dilute the signal that means something.
   *
   * The flagged cascades combine by ADDING THEIR DEFICITS, not by
   * multiplying: det(I + A + B) is approximately jacA + jacB - 1 for
   * deformations this size. That claim was measured, not assumed — both bands
   * were realized on one shared 97 m grid so the exact determinant of the
   * summed gradient could be formed. The approximation tracks it to an RMS
   * error of 0.010 and a worst case of 0.078.
   */
  readonly drivesFoam: boolean;
  /**
   * Directional spreading model.
   *
   * `mitsuyasu` is cosine-2s with the Mitsuyasu power, the shipped form.
   * `donelan` is the Donelan-Banner sech^2 form: narrower at the peak, so
   * the dominant crests run three to five wavelengths, and wider in the
   * chop, so short waves cross those crests at an angle. `donelanBeta` in
   * oceanSpectrum.ts carries the measurement. `ewans` is the Ewans (1998)
   * bimodal form: above the peak the energy splits into two lobes on
   * either side of the wind, separated by an angle that grows with
   * frequency, so the chop arrives as two crossing families rather than
   * one broad fan. `ewansLobeRad` in oceanSpectrum.ts carries the fit.
   * `hasselmann` is cosine-2s with the Hasselmann, Dunckel and Ewing (1980)
   * power: 9.77 at the peak for every wave age (30 degrees half-width,
   * between Donelan's 22 and Mitsuyasu's 56 at this wave age), falling
   * faster above the peak the younger the sea. `hasselmannPower` in
   * oceanSpectrum.ts carries it.
   * Absent means `mitsuyasu`, so every existing sea state keeps its shape.
   */
  readonly spreading?: 'mitsuyasu' | 'donelan' | 'ewans' | 'hasselmann';
  /**
   * Fraction of the JONSWAP variance this cascade keeps; 1 when absent.
   *
   * JONSWAP describes a sea under the wind that made it. A swell that has
   * left its storm keeps the storm's peak period but not its energy:
   * Snodgrass et al. (1966) tracked swell across the Pacific and measured
   * the loss, and a swell a few thousand kilometers from its source keeps a
   * tenth or less. A distant swell is therefore a JONSWAP peak with a
   * fraction of its energy, and this is that fraction. It scales VARIANCE,
   * so the wave height goes as its square root.
   */
  readonly energyScale?: number;
  /**
   * Exponent of the spectral tail above the peak; 5 when absent.
   *
   * 5 is JONSWAP's omega^-5, Phillips's 1958 saturation range. 4 is the
   * equilibrium range Toba (1973), Donelan et al. (1985) and Phillips (1985)
   * measured in the field: twice JONSWAP's energy one octave above the
   * peak, four times two octaves above. It changes the short waves only
   * (the low side and the peak are untouched), so it is the lever for the
   * mean-square slope of the chop: with 5 the `waterpro` layout resolves
   * 0.039 of Cox and Munk's 0.080 at 15 m/s. See `jonswapS`.
   */
  readonly tailPower?: number;
  /**
   * True to taper the tail above the peak by Elfouhaily et al. (1997):
   * exp(-(U10 / cp) / sqrt(10) (omega / omegaP - 1)). Off when absent. It is
   * meant for an omega^-4 band: it keeps the peak and brings the equilibrium
   * range back toward JONSWAP's level a few peak frequencies up, so the band
   * meets a shorter omega^-5 band without a step. `elfouhailyTaper` in
   * oceanSpectrum.ts carries the measurement.
   */
  readonly tailTaper?: boolean;
}

/**
 * The FFT grid edge. 256 is the point where the sea stops looking like a
 * lattice, and it costs 2 * log2(256) = 16 transform dispatches per frame.
 * Must be a power of two: the Stockham transform is radix-2.
 */
export const OCEAN_FFT_N = 256;

/** Fields produced per cascade: 4 complex spectra -> 8 real fields. */
export const FIELDS_PER_CASCADE = 4;

/**
 * The shipped sea state: a moderate wind sea on a long swell, with the wind
 * sea's own short tail resolved separately.
 *
 * Cascade 0 is the RIPPLE. 13 m patch, 0.10 m to 13 m. This is NOT a second
 * wind sea. It carries the SAME JONSWAP spectrum as cascade 1, band-limited to
 * the short end, on a patch fine enough to resolve it. Total sea energy is
 * therefore unchanged by adding it — the band moved, it did not appear.
 *
 * Cascade 1 is the LOCAL WIND SEA. 97 m patch, 13 m to 97 m, the chop you see
 * beside the hull.
 *
 * Cascade 2 is the SWELL. Big patch, long fetch, a different heading. This is
 * the one that gives the horizon its slow lift.
 *
 * THE PATCH SIZES ARE ALL PRIME: 13, 97, 1291. The summed field therefore
 * repeats only at their product, 1,629 km, which no horizon reaches. Two
 * cascades already gave 125 km; the third does not spend that property.
 *
 * The wind-sea and swell headings differ by ~50 degrees on purpose. Aligned
 * cascades re-collapse into a single direction and the corduroy comes back.
 * The ripple keeps the wind sea's heading, because short waves really do
 * follow the local wind.
 *
 * WHAT THE OCEAN GAUNTLET FOUND IN THIS LAYOUT (2026-09-23), kept here so
 * the next pass on it starts from the measurement and not from taste:
 *
 *   - A 97 m patch holds its 44.6 m peak only twice, so from 600 m up the
 *     wind sea repeats in a visible lattice.
 *   - The ripple band's longest waves (13 m) are exactly one patch long, so
 *     the ripple's folds tile at 13 m. From straight above the Jacobian
 *     channel shows the tiles; at eye level they are a diagonal streak
 *     texture at one density and one scale.
 *   - Mitsuyasu spreading collapses to isotropic in the ripple (its power
 *     clamps at 0.1), so the combined along-wind to cross-wind slope
 *     variance ratio is 1.04 against Cox and Munk's 1.45 at this wind: the
 *     fine texture reads as speckle, not as wind-blown water.
 *
 * The `waterpro` state in oceanSeaStates.ts is the layout that fixes all
 * three (13 / 89 / 421 m patches, every band at least three waves per patch,
 * Donelan-Banner spreading). This default was NOT re-banded in that pass
 * because the `storm` state spreads these cascades and its measured numbers
 * assume these bands; re-banding the default means re-measuring the storm
 * on the new bands in the same change.
 */
export const DEFAULT_CASCADES: readonly CascadeParams[] = [
  {
    name: 'ripple',
    // 13 m patch, 256 grid -> wavelengths 0.10 m to 13 m at a 0.051 m texel.
    // The two-cascade sea reached 0.76 m at a 0.38 m texel, which is why the
    // water read as a smooth hill from a meter above it.
    patchM: 13,
    // The SAME wind and fetch as the wind sea. This is one spectrum split
    // across two patches, not a new sea state invented to add sparkle.
    windSpeedMs: 11.5,
    fetchM: 60_000,
    windDirRad: 0.35,
    depthM: 1000,
    cutoffLowM: 0,
    cutoffHighM: 13,
    // 1.1, and it is a FOAM setting as much as a shape setting.
    //
    // Splitting the band cost the wind-sea cascade its short steep waves, and
    // those waves were carrying most of the folding. Measured on a 256 grid:
    // the old single 0-97 m band folded under 0.60 across 4.25% of the
    // surface; the 13-97 m band alone manages 0.38%. Foam would have all but
    // vanished, which is a regression the eye would catch and the spectrum
    // tests would not.
    //
    // The energy did not disappear, it moved here, so the folding comes back
    // here. At 1.1 the combined ripple + wind-sea Jacobian falls under 0.60
    // across 2.33% of the surface and under 0.70 across 7.31%, which is the
    // statistic the shipped 0.60-to-0.38 foam ramp was calibrated against.
    choppiness: 1.1,
    // Geometry cannot carry a 0.4 m wave past ~45 m out on this mesh: the
    // warped grid is already at 0.9 m spacing there. Fade the displacement
    // out before it aliases.
    dispLod: { startM: 14, endM: 48, floor: 0 },
    // The NORMAL is a per-fragment read, so it survives much further than the
    // geometry does. It is what makes the near water read as a textured
    // surface rather than as a shiny hill. Faded out by 400 m, past which one
    // pixel covers many ripples and the honest answer is their average.
    normalLod: { startM: 60, endM: 400, floor: 0 },
    drivesFoam: true,
  },
  {
    name: 'wind-sea',
    // 97 m patch, carrying 13 m to 97 m. The JONSWAP peak for this wind and
    // fetch lands at 44.6 m, comfortably inside the band.
    patchM: 97,
    windSpeedMs: 11.5,
    fetchM: 60_000,
    windDirRad: 0.35,
    depthM: 1000,
    cutoffLowM: 13,
    cutoffHighM: 97,
    // 1.6, chosen by measurement rather than taste. The folding Jacobian of
    // this cascade was swept on the CPU: at 1.25 its minimum never falls below
    // 0.36, so a fold-driven foam mask can never fire. At 1.6 the Jacobian
    // drops under 0.7 across 7.4% of the surface and under 0.6 across 2.1%,
    // which brackets the 3-5% whitecap coverage a Beaufort 6 sea shows.
    // Past ~2.2 the surface self-intersects visibly.
    choppiness: 1.6,
    dispLod: { startM: 350, endM: 3200, floor: 0 },
    normalLod: { startM: 350, endM: 3200, floor: 0 },
    drivesFoam: true,
  },
  {
    name: 'swell',
    // 1291 m patch, carrying 97 m to 1291 m. Its JONSWAP peak is at 126 m.
    patchM: 1291,
    windSpeedMs: 11.0,
    fetchM: 300_000,
    windDirRad: 0.35 + 0.88,
    depthM: 1000,
    cutoffLowM: 97,
    cutoffHighM: 1291,
    // Swell is not choppy. Its measured Jacobian minimum is 0.82 at any
    // setting, because a 126 m wave 3 m high is nowhere near steep enough to
    // fold. Foam is therefore driven by the wind sea alone.
    choppiness: 0.85,
    // The swell keeps most of its amplitude at range: it is long enough for
    // the far mesh to carry it.
    dispLod: { startM: 350, endM: 3200, floor: 0.6 },
    normalLod: { startM: 350, endM: 3200, floor: 1 },
    drivesFoam: false,
  },
];

/** Total complex fields across every cascade. */
export function totalFieldCount(cascades: readonly CascadeParams[]): number {
  return cascades.length * FIELDS_PER_CASCADE;
}

/** log2 of a power of two. Throws on anything else — the FFT needs radix-2. */
export function log2Exact(n: number): number {
  const l = Math.log2(n);
  if (!Number.isInteger(l)) {
    throw new Error(`[ocean] FFT size must be a power of two, got ${n}`);
  }
  return l;
}
