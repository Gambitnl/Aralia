/**
 * @file oceanMouthLaws.ts
 * Shared hydraulic, jet and sediment laws for the river mouth.
 * These are the original constants and rating-curve equations from oceanMouthMath.
 * The facade keeps every old import path; no physical inputs or arithmetic change.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 25/10/2026, 02:09:29
 * Dependents: systems/world3d/ocean/oceanMouthMath.ts, systems/world3d/ocean/oceanMouthOptics.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { type V3 } from './oceanSeabedMath';


/* ------------------------------------------------------------------ */
/* The laws and their constants                                          */
/* ------------------------------------------------------------------ */

/**
 * HYDRAULIC GEOMETRY. Leopold and Maddock (1953) found that a river's width,
 * depth and speed each grow as a power of its discharge: w = a Q^b,
 * d = c Q^f, v = k Q^m, with b about 0.5 and f about 0.4 downstream. Their
 * coefficients were for Midwest rivers in feet; Moody and Troutman (2002)
 * fitted the same exponents (b = 0.50, f = 0.39) to rivers worldwide in SI:
 * a = 7.2 and c = 0.27 (Q in m^3/s, w and d in m). The exponents here are
 * Leopold and Maddock's 0.5 and 0.4, as the brief names them.
 */
export const HG_WIDTH_A = 7.2;
export const HG_WIDTH_B = 0.5;
export const HG_DEPTH_C = 0.27;
export const HG_DEPTH_F = 0.4;

/**
 * THE BANKS stand at the angle of repose of the cay's medium sand: 30 to 35
 * degrees for loose quartz sand (Bagnold 1941; Allen 1970); 32 degrees.
 */
export const SAND_REPOSE_RAD = (32 * Math.PI) / 180;

/**
 * THE RIVER'S OWN REACH: the judged reach's last reach, below the outlet sill
 * (`riverReach.ts` course keys at s = 300 and 420): its bed slope, its
 * cross-section power and its Manning roughness are the mouth channel's.
 */
export const RIVER_OUTLET_S: readonly [number, number] = [300, 420];

/**
 * THE JET (Albertson, Dai, Jensen and Rouse 1950). A jet keeps its outlet
 * speed along a core of 6.2 outlet sizes (the zone of flow establishment);
 * past it the centerline speed falls as 1 / x. Its edge spreads at about 1 in
 * 5 (their Gaussian exp(-77 r^2 / x^2) falls to 5% at r = 0.198 x). The
 * outlet's size is the mouth's width (the ADR's "a core of about six
 * widths").
 */
export const JET_CORE_SIZES = 6.2;
export const JET_EDGE_SPREAD = 0.2;
/** The 5% point of a Gaussian, in its sigmas: sqrt(2 ln 20). */
export const JET_EDGE_SIGMAS = Math.sqrt(2 * Math.log(20));
/**
 * A scalar spreads wider than the speed in a jet: its profile's width is
 * about 1.2 times the velocity's (Fischer, List, Koh, Imberger and Brooks
 * 1979, section 9.1).
 */
export const JET_SCALAR_SPREAD = 1.2;
/**
 * The jet's entrainment coefficient (Morton, Taylor and Turner 1956; 0.057
 * for a jet, Fischer et al. 1979): the sea water flows in at its edge at
 * this share of the centerline speed. It sets the front's foam (`jetAt`).
 */
export const JET_ENTRAINMENT = 0.057;

/**
 * WAVES ON AN OPPOSING CURRENT (Bretherton and Garrett 1968): wave action
 * E / sigma is conserved, so a wave that meets a current U against it grows
 * as (1 - r)^(-1/2), r = -U.k / cg, and is blocked where r reaches 1 (U =
 * -cg): no energy passes. Laboratory waves on a blocking current break well
 * before the blocking point; most of the energy is lost from about r = 0.5
 * (Chawla and Kirby 2002). The share falls from there to 0 at r = 1.
 */
export const BLOCK_BREAK_R = 0.5;

/**
 * THE TURBID RIVER WATER'S OPTICS. A stated load: 40 g/m^3 of suspended
 * mineral sediment, inside the 10 to 1000 g/m^3 of rivers at mean flow
 * (Milliman and Meade 1983). Per unit load (Kirk 1994, chapter 3, for
 * mineral suspensoids): specific scattering 0.5 m^2/g; the backscatter ratio
 * 0.019 of Petzold's (1972) turbid harbor water; specific absorption 0.04
 * m^2/g at 443 nm falling as exp(-0.0123 (lambda - 443)) (Babin and
 * Stramski 2004). Pure water's absorption at 600, 550 and 450 nm (the
 * render's red, green and blue): 0.2224, 0.0565 and 0.0092 1/m (Pope and Fry
 * 1997).
 */
export const RIVER_SEDIMENT_G_M3 = 40;

/**
 * THE SUSPENDED LOAD FROM THE DISCHARGE (river mouth round 2; the lead's
 * point 1). Round 1 stated 40 g/m^3, and the bed showed through 0.3 m of
 * river water. The load now follows a SEDIMENT RATING CURVE, C = a Q^b
 * (Asselman 2000; Syvitski, Morehead, Bahr and Mulder 2000), with its
 * coefficient set at the river's mean flow by the long-term mean
 * concentration that its catchment's yield and runoff give:
 *   C_mean = Y / R,   a = C_mean / Q_mean^b,   so C(Q) = C_mean (Q / Q_mean)^b.
 * Y / R is the mass of sediment the catchment sheds per volume of water it
 * sheds; it does not need the catchment's area.
 *   - THE YIELD Y: 1000 t/km^2/yr. Milliman and Syvitski (1992) put small
 *     mountainous rivers of the wet tropics and the oceanic islands at the
 *     top of the world's yields, 1000 t/km^2/yr and more; this is the low
 *     end of that class (a STATED input, not a measure of the Sarcelle).
 *   - THE RUNOFF R: 2.0 m/yr, the wet windward side of a Lesser Antilles
 *     island (rain 2.5 to 4 m/yr less the evaporation; a STATED input).
 *   - THE EXPONENT b: 1.5, the low end of the brief's 1.5 to 2 (Asselman
 *     2000 fitted 1 to 2 for the Rhine's tributaries; Syvitski et al. 2000
 *     found b rises with the basin's temperature and relief).
 *   - THE MEAN FLOW Q_mean: the flow the channel's width was made by. The
 *     hydraulic geometry this file sizes the channel with (Moody and Troutman
 *     2002) is a fit at the mean annual flow, so the Sarcelle's 40 m width
 *     gives Q_mean = 31 m^3/s, the flow of the place. So at the place's own
 *     flow C = Y / R = 500 g/m^3; the curve gives the load at any other flow
 *     of the same river (a flood, a dry season).
 */
export const CATCHMENT_YIELD_T_KM2_YR = 1000;
export const CATCHMENT_RUNOFF_M_YR = 2.0;
export const RATING_EXPONENT_B = 1.5;

/** The catchment's long-term mean concentration, g/m^3: Y / R (t/km^2/yr over m/yr is g/m^3). */
export function meanSedimentGM3(yieldTKm2Yr = CATCHMENT_YIELD_T_KM2_YR, runoffMYr = CATCHMENT_RUNOFF_M_YR): number {
  // 1 t/km^2 = 1e6 g / 1e6 m^2 = 1 g/m^2; over a runoff depth in m it is g/m^3.
  return yieldTKm2Yr / runoffMYr;
}

/** THE RATING CURVE: the suspended load at discharge q of a river whose mean flow is qMean, g/m^3. */
export function ratingCurveGM3(q: number, qMean: number, b = RATING_EXPONENT_B, cMean = meanSedimentGM3()): number {
  return cMean * (q / qMean) ** b;
}

export const SED_SCATTER_M2_G = 0.5;
export const SED_BACKSCATTER_RATIO = 0.019;
export const SED_ABSORB_443_M2_G = 0.04;
export const SED_ABSORB_SLOPE_NM = 0.0123;
export const WATER_ABSORB_RGB: V3 = [0.2224, 0.0565, 0.0092];
export const RGB_NM: V3 = [600, 550, 450];
/**
 * The radiance a water body sends up through the surface per unit of its
 * irradiance reflectance R: R E / Q with Q = pi for a Lambertian field, times
 * the water-to-air radiance transmittance t / n^2 = 0.54 (Austin 1974).
 */
export const WATER_TO_AIR_RADIANCE = 0.54;
