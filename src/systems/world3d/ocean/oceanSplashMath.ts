/**
 * @file oceanSplashMath.ts
 * Public entry for the shared thrown-water model.
 * Original laws live in oceanSplashLaws, the intact particle pool in oceanSplashPool and volume/light readers in oceanSplashVolume. This facade retains every former public name.
 * The original scientific notes are retained verbatim with the extracted laws.
 * Equations, state, random draw order and all legacy public names are preserved.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * RE-EXPORT BRIDGE / MIDDLEMAN: Forwards exports to another file.
 *
 * Last Sync: 25/10/2026, 03:00:50
 * Dependents: systems/world3d/ocean/oceanRocks.ts, systems/world3d/ocean/oceanRocksMath.ts, systems/world3d/ocean/oceanSplash.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

// Compatibility exports preserve existing consumers while each concern has one owner.
export { SPLASH_WATER_RHO, SPLASH_AIR_RHO, SPLASH_AIR_MU, SPLASH_WATER_SIGMA, SPLASH_WE_CRIT, SPLASH_GAMMA_N, SPLASH_Q_EXT, SPLASH_CAUCHY, splashBodyEfficiency, splashSpriteColumnMean, SPLASH_GAUSS_STRAIGHT_MEAN, SPLASH_GAUSS_DISC_MEAN, splashGaussColumnMean, SPLASH_TRAIN_MAX, SPLASH_TRAIN_BUDGET, splashTrainCount, splashTrainOffset, SPLASH_TAU_EPS, splashGaussReach, splashEin, splashClumpedCrossSection, type SplashTrainPlan, splashTrainPlan, type SplashSpriteSplit, splashSpriteSplit, SPLASH_RP_WAVELENGTH, splashCapillarySpeed, splashLigamentDiameter, splashSauterDiameter, splashStokesDiameter, splashGammaVolumeBelow, splashAsymmetry, SPLASH_G, SPLASH_DIFFUSION_Z0, splashTwoFlux, splashDomeVisibility, SPLASH_DELTA_F, SPLASH_DELTA_G, SPLASH_DOME_N, splashDomeDirections, splashDomeSource, splashDragPerSpeed, SPLASH_BUBBLE_HINZE_M, SPLASH_SHEET_GONE_X, SPLASH_RIM_PIECES, splashSpanningHoles, type SplashSheetLedger, SPLASH_BREAK_RING_SHARE, SPLASH_BREAK_RING_D, SPLASH_BREAK_BAG_D, SPLASH_BREAK_MIN_SHARE, splashTerminalSpeedMs, SPLASH_NEWTON_CD, SPLASH_STABLE_DROP_M, SPLASH_AIR_CELL_M, splashCoupledShare, splashCoupledStableDrop, splashGammaP, type SplashCappedLaw, splashCappedDropLaw, splashBreakupTstar, splashBreakupTimeS, SPLASH_JET_DROPS_PER_BUBBLE, SPLASH_JET_DROP_SHARE, SPLASH_JET_DROP_MS, splashBubbleMist, splashBubbleRaftM2, SPLASH_DROP_MAX_S, SPLASH_SHEET, SPLASH_LIGAMENT, SPLASH_DROP, SPLASH_MIST, SPLASH_FALL, type SplashKindSpec, SPLASH_KINDS, SPLASH_SHEET_SHED_LIGAMENTS_PER_S, SPLASH_SHEET_SHED_DROPS_PER_S, SPLASH_SHEET_END_DROPS, SPLASH_SHEET_END_MIST, SPLASH_LIGAMENT_END_DROPS, SPLASH_CHILD_JITTER, SPLASH_LIGAMENT_SIZE_M, SPLASH_DROP_SIZE_M, SPLASH_MIST_SIZE_M, type SplashShedSpec, SPLASH_SHED_DEFAULT, SPLASH_JET_SPREAD, SPLASH_JET_TURB_SHARE, splashTurbulentSigma, SPLASH_TURB_OCTAVES, SPLASH_TURB_AXIS_I, splashTurbHash, splashTurbNoise, SPLASH_TURB_NOISE_VAR, splashTurbAmplitudes, splashTurbField, splashTurbIntensity, splashTurbMultiplier, sunThroughAir } from './oceanSplashLaws';
export { type SplashPoolOptions, SplashRng, type SplashEnv, SplashPool } from './oceanSplashPool';
export { SPLASH_SORT_RES_M, SPLASH_SORT_BUCKETS, SplashDepthSort, splashSheetStats, SPLASH_LIGHT_N, SPLASH_LIGHT_MAX_M, splashLight, SPLASH_VOLUME_SIGMA_MAX, splashDrawnAlpha, SPLASH_VOLUME_LAY_MAX_CELLS, SPLASH_BODY_STRIDE, type SplashVolumeSpec, splashDropCount, type SplashLayCache, splashVolumeCellFor, SplashVolume } from './oceanSplashVolume';
