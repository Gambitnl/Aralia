/**
 * @file oceanWakeMath.ts — the wake of a moving hull: the model, every
 * constant, and the CPU mirror of the GPU kernels in oceanWake.ts.
 *
 * WHAT THE WAKE IS. A hull that moves through deep water pushes the surface
 * down with a pressure (the water it displaces) and leaves two things behind:
 *
 *   1. WAVES. Linear deep-water waves forced by that moving pressure. Every
 *      wave the hull makes travels at its own phase speed, and the ones that
 *      keep station with the hull add up. For a hull on a straight course at
 *      speed U they add up inside a wedge of half-angle asin(1/3) = 19.47
 *      degrees (Kelvin 1887), with transverse waves across the track and
 *      diverging waves along the wedge. No angle is put in: it comes out of
 *      the dispersion relation, and the tests measure it.
 *   2. WHITE WATER. The churn behind the transom (the propeller and the
 *      broken flow off the stern), the foam the wake's own steep crests
 *      spill (the bow shoulders, the stern wave, the first diverging
 *      crests), and the bubble cloud under them, all left in the water and
 *      fading with age.
 *
 * THE WAVES ARE A CLOSED FORM, NOT A SIMULATION. In Fourier space each mode
 * of the surface is a forced oscillator,
 *
 *     d2(eta_k)/dt2 + omega^2 eta_k = -(k / rho) p_k(t),   omega^2 = g k,
 *
 * and the pressure of a hull at X(tau) is p_k = P f(k) e^{-i k.X(tau)}. From
 * rest, the solution is an integral over the hull's past course:
 *
 *     eta_k(t) = -(k g / omega) f(k) INT_0^S e^{-s/T} sin(omega s)
 *                e^{-i k.(X(t - s) - C0)} ds
 *
 * with s the age of the pressure. The course is a polyline of straight
 * pieces at constant speed, and on a straight piece the integrand is a sum
 * of two complex exponentials in s, so each piece integrates EXACTLY
 * (`wakeSegmentIntegral`). The GPU sums the pieces per mode and runs one
 * inverse FFT. So the wake is a pure function of (course, time): there is
 * no state, no warm-up and no step, and a pinned capture reproduces bit for
 * bit. A turn, a speed change and a start from rest are all handled by the
 * same sum.
 *
 * THE FIELD LIVES ON A WINDOW THAT FOLLOWS THE HULL: a rectangle 512 m long
 * and 256 m wide at 1 m, turned to the hull's heading, with the hull near
 * its front edge. The transform is periodic over the window, so the course
 * history is cut where the oldest piece would leave it (S), and the waves
 * lose coherence with a time T = S / 3 (`wakeHistoryFor`). T stands for the
 * ambient sea scrambling an old wake; it is set by the window, and it is
 * stated as that choice.
 *
 * THE WHITE WATER is a function of where a point of water lies against the
 * course: how far behind the transom, how far to the side, and how long ago
 * the hull passed (`wakeFoamAt`). Foam is left at rest in the water; it does
 * not travel with the hull.
 *
 * UNITS. Meters, seconds, radians. The ocean's unit rule holds: internal
 * meters, and only oceanUnits.ts converts to feet.
 *
 * WHAT IS STILL OPEN. The hull is a pressure patch, not a body: linear
 * theory, no sinkage or trim; the waves' breaking is read off their linear
 * slope (`wakeBreaking`) and does not take energy out of them. The wake's
 * foam is not fed into the persistent foam field of oceanFoam.ts; see the
 * wake report.
 *
 * C5 OWNERSHIP: Original wake waves, foam, textures and look controls live in oceanWakeWaves, oceanWakeFoam, oceanWakeTextures and oceanWakeLook. The existing facade preserves every legacy public name.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * RE-EXPORT BRIDGE / MIDDLEMAN: Forwards exports to another file.
 *
 * Last Sync: 25/10/2026, 03:15:52
 * Dependents: components/DesignPreview/steps/sidebyside/oceanExtras/wake.ts, systems/world3d/ocean/oceanBeach.ts, systems/world3d/ocean/oceanBeachWorker.ts, systems/world3d/ocean/oceanRocks.ts, systems/world3d/ocean/oceanWake.ts, systems/world3d/ocean/oceanWakeBoat.ts, systems/world3d/ocean/oceanWakeTrail.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

// Compatibility exports preserve existing consumers while each concern has one owner.
export { type WakeHull, WAKE_TRAWLER, WAKE_TRAWLER_SPEED_MS, wakeFroude, hullHalfBreadth, type WakePressure, WAKE_WAVE_MAKING, wakePressureForHull, WAKE_PRESSURE_CUT, wakePressureCutK, sinc, wakePressureTransform, type WakeCourseSpec, WAKE_COURSE, type WakeCoursePoint, type WakeVertex, type WakeCourse, createWakeCourse, type WakeGrid, WAKE_GRID, WAKE_WINDOW_AHEAD_M, WAKE_WINDOW_REAR_FADE_M, WAKE_WINDOW_SIDE_FADE_M, type WakeWindow, WAKE_WINDOW_CHORD_SHARE, wakeWindowFor, wakeWindowAt, wakeWorldToWindow, wakeHistoryFor, wakeEdgeFade, wakeWindowMask, smoothstep, type WakeSegment, type WakeSegmentSet, WAKE_MAX_SEGMENTS, WAKE_TAPER_STEPS, WAKE_TAPER_SHARE, wakeSegments, type WakeTouch, WAKE_TOUCH_DEFAULT, WAKE_MAX_TOUCHES, type WakeTouchPiece, wakeTouchPieces, expm1OverZ, wakeSegmentIntegral, wakeModeAmplitude, WAKE_VERTEX_SMOOTH_M, wakeKOf, type WakeFieldCpu, realizeWakeCpu, measureWakeHalfAngleDeg } from './oceanWakeWaves';
export { WAKE_STERN_FOAM_PEAK, WAKE_STERN_BOIL, WAKE_STERN_BOIL_M, WAKE_STERN_BOIL_WIDTH, WAKE_STERN_FOAM_TAU_S, WAKE_STERN_HALF_WIDTH, WAKE_STERN_GROWTH, WAKE_STERN_GROWTH_M, WAKE_BREAK_SLOPE_LO, WAKE_BREAK_SLOPE_HI, WAKE_BREAK_FOAM_PER_S, WAKE_BREAK_COVER_MAX, WAKE_BREAK_TAU_S, WAKE_BREAK_ACTIVE, WAKE_BREAK_BUBBLE_TAU_S, WAKE_BREAK_REACH_S, WAKE_BREAK_HULL_MARGIN_M, WAKE_BOW_BAND_M, WAKE_BOW_FORE_SHARE, wakeBowBreaking, WAKE_BUBBLE_TAU_S, WAKE_BUBBLE_WIDTH, type WakeFoamSample, wakeFoamAt, wakeBreaking, WAKE_BREAK_REACH_L, wakeBreakingReach, hullEnvelope, wakeDepositCpu, wakeSideRatio, wakeMixUniformCdf, wakeCapAlong } from './oceanWakeFoam';
export { wakeHash01, wakeLaceImage, WAKE_LACE_TILE_M, WAKE_LACE_WEIGHTS, WAKE_LACE_CDF_KNOTS, wakeLaceCdfTable, wakeLaceRank, wakeNetImage, WAKE_NET_TILE_M, WAKE_NET_WEIGHTS, PeriodicGradientFbm, type WakeMassImage, wakeMassImage } from './oceanWakeTextures';
export { type WakeLook, WAKE_LOOK_ROUND2, WAKE_LOOK_ROUND3, WAKE_LOOK_ROUND4, WAKE_LOOK_ROUND5, WAKE_LOOK_ROUND6, WAKE_LOOK_ROUND7, WAKE_LOOK_ROUND8, WAKE_LOOK_ROUND9, WAKE_LOOK_ROUND10, WAKE_LOOK_ROUND11, WAKE_LOOK_ROUND12, WAKE_LOOK_ROUND13, WAKE_LOOK_ROUND14, WAKE_LOOK_ROUND15, WAKE_LOOK_ROUND16, WAKE_LOOK_ROUND17, WAKE_LOOK_DEFAULT, WAKE_LOOK_PRESETS, parseWakeLook } from './oceanWakeLook';
