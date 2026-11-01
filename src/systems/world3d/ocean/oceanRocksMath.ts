/**
 * @file oceanRocksMath.ts — waves against rocks: the model and its numbers.
 *
 * WHAT THIS IS. Low rocks stand in the surf. The FFT sea does not know they
 * are there: its waves pass through them. This module is the part of the
 * sea that DOES know. At each rock face it reads the incoming water (its
 * height, its speed, whether its crest breaks), and from that it computes
 * what the water does against the face:
 *
 *   1. RUN-UP. The water rises up the struck face: the incoming crest, plus
 *      the part of the wave the face sends back (a standing wave at a steep
 *      face), plus the velocity head of the water that runs into the face.
 *   2. THE BURST. A fast, high crest that meets a steep face turns upward
 *      in a jet that breaks into a plume of spray. Its launch speed scales
 *      with the impact speed, so the plume's height scales with the wave's
 *      speed and height.
 *   3. WASH-OVER AND CASCADE. Where the run-up passes the face's top edge,
 *      water flows over it as over a weir onto the rock's top. That sheet
 *      then drains off EVERY face at once, in streaks and falls.
 *   4. FOAM. Water that falls back into the sea (the plume, the cascade)
 *      and the breaking crest itself lay foam in the water round the base.
 *      The foam drifts off downwind with the surface film and ages.
 *   5. WETNESS. The face is wet below the highest recent run-up and dries
 *      above it; the faces stream with water for a few seconds after each
 *      wave.
 *
 * WHAT IT IS NOT. It is not a fluid solver. The flow over and round the
 * rock is a set of closed-form engineering relations applied per face
 * sector, driven by the FFT sea's own water at the face. Each relation
 * names its source.
 *
 * PURE AND DETERMINISTIC. No three.js import, no clock, no Math.random.
 * The simulation steps at a fixed dt from a known start with its own
 * seeded generator, so a pinned time replays to the same state (the unit
 * tests hold this). The GPU side (`oceanRocks.ts`) reads the sea, hands the
 * samples here, and draws what this module computes.
 *
 * Added by the rocks piece of the ocean gauntlet (round 1, 2026-09-29).
 *
 * C5 OWNERSHIP: Original shape, physics, top-water and running-surf concerns live in oceanRocksShape, oceanRocksPhysics, oceanRocksTopWater and oceanRocksSurf. The existing facade preserves every legacy public name.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * RE-EXPORT BRIDGE / MIDDLEMAN: Forwards exports to another file.
 *
 * Last Sync: 25/10/2026, 03:09:18
 * Dependents: components/DesignPreview/steps/sidebyside/oceanExtras/rocks.ts, systems/world3d/ocean/oceanRocks.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

// Compatibility exports preserve existing consumers while each concern has one owner.
export { valueNoise3, fbm3, ridged3, RockRng, smoothstep, type RockSpec, type RockLobe, ROCK_LEDGE_M, ROCK_FACETS, rockSurfacePoint, ROCK_PLATE_M, ROCK_PLATE_INSET_M, ROCK_PLATE_GROOVE_M, rockPlates, type RockMesh, buildRockMesh, checkRockLobes, ROCK_SECTORS, ROCK_PROFILE_LEVELS, type RockFaceTable, rockRadiusAt, rockSectorOf, rockSkinAt, rockTopAt, type RockTopRaster, rockTopRaster, rockTopRasterAt, rockFaceTable, ROCK_QUERY_OUT_M, rockQueryPoints, ROCK_REEF_DEPTH_M } from './oceanRocksShape';
export { type RockSeaParams, rockSeaParams, ROCK_REFLECT_A, ROCK_REFLECT_B, rockIribarren, rockReflection, ROCK_ROUGH_GAMMA, ROCK_BREAK_FRONT_SHARE, ROCK_BREAK_START, ROCK_BREAK_FULL, ROCK_SURF_BREAK_START, ROCK_SURF_BREAK_FULL, ROCK_CREST_TO_HEIGHT, ROCK_SHELF_INNER_M, ROCK_SHELF_OUTER_M, ROCK_SHELF_FAR_DEPTH_M, rockShelves, rockBoreWaterSpeed, ROCK_JET_U_START_MS, ROCK_JET_U_FULL_MS, ROCK_JET_H_START_M, ROCK_JET_H_FULL_M, ROCK_JET_MAX_MS, ROCK_FRONT_SLOPE_RAD, rockFlipThroughSpeed, rockJetMassShare, rockApexClosingSpeed, rockCrestAirShare, rockAeratedJetSpeed, rockFrontClimbSpeed, type RockWedge, rockWedge, ROCK_SHEET_PARCELS_PER_S, ROCK_ROLLER_VOID, ROCK_ROLLER_BUBBLE_M, ROCK_WEIR_C, type RockFaceWater, type RockFaceImpact, ROCK_STRUCK_START, ROCK_STRUCK_FULL, ROCK_FACING_START, ROCK_FACING_FULL, rockFaceImpact, ROCK_SAMPLE_STRIDE, RockSeaHistory, rockHistoryRow, ROCK_DT_S, ROCK_SAMPLE_HZ, ROCK_PRIME_S, ROCK_SWASH_DRAIN_MS, ROCK_DRY_MS, ROCK_STREAM_LIFE_S, ROCK_MICRO_ROUGH_M, ROCK_STONE_ROUGHNESS, ROCK_WATER_NU_M2S, rockNusseltFilmM, rockDrainingFilmM, ROCK_FILM_CONTACT_RAD, ROCK_WATER_MU_PAS, ROCK_WATER_SIGMA_NM, rockFilmMinThicknessM, rockFilmMinFlowM2s, rockDrainRivuletShare, rockFingerWavelengthM, ROCK_ROLLER_PER_H, rockRollerLengthM, rockFaceBreakerShare, rockFaceRollerReachM, rockCrestSpeedMs, rockFaceBreakerCover, ROCK_ROLLER_BUBBLE_RISE_MS, ROCK_SWASH_FRONT_SHARE, rockRollerAirStep, ROCK_ROLLER_AREA_PER_L2, ROCK_AIR_C90 } from './oceanRocksPhysics';
export { rockAirProfileC, rockAirMeanC, rockAirDiffusivity, ROCK_ROLLER_DPRIME, type RockAirColumn, rockAirColumn, ROCK_ROLLER_COLUMN, rockRollerThicknessM, rockCollarRollerReachM, rockBodyAirStep, ROCK_BODY_LAY_M, ROCK_BODY_SIGMA_M, ROCK_BODY_MAX, rockBodyKindsOn, rockBodyCensus, ROCK_TOP_CELL_M, ROCK_TOP_MANNING_N, ROCK_TOP_PARCELS, ROCK_TOP_INFLOW_AIR, type RockTopNet, rockTopNet, RockTopSheet } from './oceanRocksTopWater';
export { rockRollerBodies, ROCK_FLOW_SAMPLE_S, ROCK_FLOW_SLOTS, rockBackwashSpeed, rockFlowAt, ROCK_GRAIN_RA_M, ROCK_GRAIN_RQ_M, rockFilmLevel, rockFilmMirrorShare, ROCK_FILM_RE_LAMINAR, ROCK_FILM_RE_TURBULENT, rockFilmLaminarShare, ROCK_MIRROR_FIT_A, ROCK_MIRROR_FIT_B, rockFilmMirrorShareFit, ROCK_SPLASH_POOL, ROCK_JET_FAN_RAD, ROCK_JET_BACK_RAD, ROCK_JET_BACK_SPREAD_RAD, ROCK_JET_ALONG_RAD, ROCK_FALL_RATE, ROCK_CHURN_PER_M_S, ROCK_CHURN_LEE_SHARE, ROCK_CHURN_REACH_M, ROCK_CHURN_SIZE_M, ROCK_FALL_START_M2S, ROCK_FALL_SIZE_M, ROCK_AIR_SHARE, ROCK_STAGNANT_SHARE, ROCK_STAGNANT_OVER_M, ROCK_STAGNANT_REACH_M, ROCK_FILM_DRIFT_SHARE, ROCK_FOAM_N, ROCK_FOAM_CELL_M, ROCK_FOAM_LIFE_S, ROCK_FOAM_MAX, ROCK_FOAM_PER_LANDING, ROCK_FOAM_PER_JET, ROCK_FOAM_PER_BACKWASH, ROCK_COLLAR_HEAD_M, ROCK_COLLAR_REACH_M, ROCK_COLLAR_HEAD0_M, ROCK_FOAM_PER_BREAK, ROCK_FOAM_PER_CASCADE, ROCK_BREAK_FOAM_REACH_M, ROCK_SHEET_MAX_M, ROCK_WATER_PER_LANDING, ROCK_EVENT_BIN_S, ROCK_EVENT_CELL_M, ROCK_EVENT_R_M, ROCK_EVENT_SOFT, ROCK_EVENT_KEEP_S, ROCK_FIELD_PRODUCTION_PER_S, ROCK_FIELD_SHARE, ROCK_DISC_S_MAX, type RockFoamSource, type RockSectorState, ROCK_REFLECT_RING, ROCK_REFLECT_SLOT_STEPS, ROCK_REFLECT_TAPER, ROCK_REFLECT_SKIN_M, rockReflectHoldM, rockReflectInside, rockReflectSpeed, rockBandLambda, rockLeeHalfWidth, rockErf, ROCK_LEE_ENDS, ROCK_LEE_WALK, type RockLee, rockLeeOf, rockLeeScatter, rockLeeEndAt, rockLeeShare, rockReflectedWave, type RockSimOptions, type RockState, RockSurf, rockFoamSources, rockPrimeTimes } from './oceanRocksSurf';
