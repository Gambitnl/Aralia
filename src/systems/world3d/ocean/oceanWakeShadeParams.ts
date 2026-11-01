/**
 * @file Original wake shading parameters and their scientific notes.
 * Shared internally; values and old public exports are unchanged.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 25/10/2026, 03:57:03
 * Dependents: systems/world3d/ocean/oceanWake.ts, systems/world3d/ocean/oceanWakeReader.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import * as THREE from 'three/webgpu';

/**
 * THE LACE, SOFT: half-width of the threshold's ramp, in rank. 0.16: a
 * hole's edge fades over about a fifth of a small hole's width. Round 1
 * cut it over 1 / 3.5 of rank on one side only, and both critics saw holes
 * punched in a sheet.
 */
export const LACE_SOFT = 0.16;

/**
 * The amounts over which the lace's ramp is gated in (see the read), and
 * the core's streak floor.
 */
export const THIN_GATE_LO = 0.06;
export const THIN_GATE_HI = 0.32;
export const CORE_STREAK_LO = 0.5;
/**
 * The core's pocket tile, meters, and the amounts over which the pockets
 * phase in (see THE CORE CHURNS). The alpha a pocket keeps and the rank it
 * opens over are the look's `corePocketLo` and `corePocketRamp`.
 */
export const CORE_FROM = 0.55;
export const CORE_FULL = 1.2;
export const CORE_TILE_M = 3.1;
/**
 * Round 3's bubble speckle (the look's `coreGrain`): its tile, meters, the
 * alpha its gaps keep, and the footprint past which it is off (half of it
 * at full). Off in round 2.
 */
export const BUBBLE_TILE_M = 1.1;
export const CORE_GRAIN_LO = 0.55;
export const GRAIN_FOOT_M = 0.1;

/**
 * THIN FOAM IS SEE-THROUGH: the opacity of foam just over the threshold,
 * and the rank over it by which it is opaque. Water Pro's trail is mostly
 * film: its foam pixels near the stern are 150 to 235 sRGB over water at 60
 * to 90 (boat-w-23.png, rows 600 to 900), and the water's ripples show
 * through all of it.
 */
export const OP_THIN = 0.4;
export const OP_RANGE = 0.6;

/**
 * THICK AND THIN: the alpha at the clumps' low end. Piled foam is brighter
 * than one layer of it.
 */
export const FOAM_THIN = 0.6;

/**
 * FOAM UNDER THE SURFACE: how far under the threshold, in rank, the lace
 * still shows as submerged bubbles. Their weight in the bubble cloud is
 * the look's `subGain`.
 */
export const SUB_REACH = 0.22;

/**
 * FOAM GATHERS WHERE THE WATER CONVERGES: the cover goes as J^-JAC_POWER,
 * J clamped to [JAC_GATHER_MIN, the look's jacGatherMax]. JAC_POWER 1 is a
 * film's area conservation. The clamp keeps a fold (J near 0) from
 * painting the crest solid: at most 1.8 times the cover (round 2), at
 * least 0.6 times.
 */
export const JAC_POWER = 1;
export const JAC_GATHER_MIN = 0.6;

/**
 * Pixel footprints, meters, between which the lace's ramp widens back from
 * its sharpened width (the look's laceSharp and coreSharp) to the soft one:
 * under 0.12 m a pixel resolves the popped cells (0.18 m and up at the 12 m
 * tile), and by 0.3 m the mip has begun to average them, where a sharp
 * threshold of the average is a gray (the foam piece's round-8 finding).
 * The sharpened ramp's half-width in rank, LACE_SHARP_MIN, 0.03: a hole's
 * edge over a few centimeters.
 */
export const SHARP_FOOT_LO_M = 0.12;
export const SHARP_FOOT_HI_M = 0.3;
export const LACE_SHARP_MIN = 0.03;

/**
 * Pixel footprints, meters, over which the lace hands over to its mean.
 * The finest holes are 13 cm; by a 30 cm footprint the mip has begun to
 * average them, and by 2 m every channel but the patches is sub-pixel.
 */
export const LACE_FAR_START_M = 0.3;
export const LACE_FAR_END_M = 2;

/**
 * THE CHURN'S RELIEF. The clumps channel's gradient over 0.5 m tilts the
 * foam's normal by up to LACE_BUMP_GAIN, weighted by the foam's alpha: a
 * heap of white water a meter across stands 10 to 20 cm, slopes of 0.2 to
 * 0.4. (Round 1 had 0.8 and a rim on every hole; see the read.)
 */
export const LACE_BUMP_STEP = 0.5;
export const LACE_BUMP_GAIN = 0.4;

/**
 * How much a slant view fills the lace's holes: see FOAM HAS THICKNESS in
 * the read. 0.08 per unit of footprint aspect: the view of the V3 video's
 * wake card (about 12 degrees of grazing, aspect 4.8) covers
 * 1 - (1 - a)^1.3. At 0.35 that view was one solid sheet edge to edge.
 */
export const SLANT_FILL = 0.08;

// How far the holes and the streaks are drawn out along the flow: the
// look's `holeStretch` and `streakStretch` (round 2: 1.8 and 3; round 3 cut
// them to 1.3 and 2 for the quarter view's "parallel, evenly spaced
// diagonal streaks" and lost the chase view).

/**
 * The most of the lace the threshold ever covers (THE LACE NEVER CLOSES):
 * 0.82, so a sixth of the densest churn is pockets, which the submerged
 * bubbles light a pale turquoise (FOAM UNDER THE SURFACE). At 0.9 the boil
 * behind the transom was a smooth white sheet, "paint".
 */
export const LACE_MAX_COVER = 0.82;

/**
 * The most amount the back slope of the wake's own waves keeps before the
 * look's backSlope cuts it (round 6): the lace's full cover, so the cut
 * opens windows even in the churn.
 */
export const BACK_CAP = LACE_MAX_COVER;

/**
 * How far the slow fields bend the lace's coordinate, meters: see THE FLOW
 * TWISTS. 6 m over 24 m features keeps the warp's slope under about 0.4.
 */
export const LACE_WARP_M = 6;

/**
 * THE BUBBLE CLOUD'S LIGHT, scene-linear radiance per unit of bubble
 * weight, lit by the sun. Bubbles 1 to 2 m down scatter the light that
 * reaches them back up through a short path of water, so the lane is the
 * body's green-blue raised by a pale, greener glow: at full weight about
 * twice the near body's own radiance (0.03, 0.14, 0.17 seen steeply;
 * oceanSurface.ts). Under a deck: the storm body's grey-green, raised the
 * same way.
 *
 * IT IS ADDED TO THE BODY, UNDER THE FRESNEL. The glow comes up out of the
 * water, so the surface's reflection lies over it and the lane keeps the
 * waves' light and shade. Mixed toward a flat color after the reflection
 * (an earlier build, to make the lane show at a grazing view), it washed
 * the reflection out, and every guidance critic of those frames read the
 * trail's center as "a flat milky haze, fog floating above the water".
 */
export const BUBBLE_FAIR = new THREE.Vector3(0.07, 0.24, 0.24);
export const BUBBLE_STORM = new THREE.Vector3(0.015, 0.04, 0.045);
/**
 * The milky end of the fair-weather glow (round 7, the look's aerate): a
 * dense bubble cloud scatters all colors about alike, so its light is
 * whiter than a thin one's. At full weight it lifts the near body (0.03,
 * 0.14, 0.17) to about (0.16, 0.36, 0.38), a paler and whiter turquoise
 * than BUBBLE_FAIR's (0.10, 0.38, 0.41). (The reference's boat-mode water
 * beside the trail is its open sea, about 40, 130, 135 sRGB in
 * boat-w-23.png: this glow answers the critics, not that frame.)
 */
export const BUBBLE_MILK = new THREE.Vector3(0.13, 0.22, 0.21);

/**
 * The bubble weight at a lane's densest: the clumps channel modulates it
 * between 0.75 and 1.25 of this, so the glow is patchy as the cloud is.
 */
export const BUBBLE_MIX = 0.75;

/**
 * FOAM HAS VOLUME (round 3, the look's `foamVolume`; see the read): the
 * shade of the thinnest foam, the most a heap's slope lights or shades it,
 * and the step over which that slope is read. 0.7 and 0.22: the reference's
 * foam at the quarter view runs from 150 to 235 sRGB inside the trail
 * (t0027.png), a thinner range than white on white; 0.35 m, a heap's flank.
 */
export const FOAM_EDGE_SHADE = 0.7;
export const FOAM_LUMP_SHADE = 0.22;
export const RAFT_SHADE_STEP_M = 0.35;

// NO FACET TURNS ITS BACK TO THE EYE: the share of the view ray's elevation
// (tan e) at which the wake's slope away from the camera saturates is the
// look's `backfaceCap` (round 3: 0.7, a facet the wake tilts is still a
// front face seen at a third of its grazing angle; round 2: off).

/**
 * The foam mass's fine read is turned this far off the trail's axis
 * (round 12, the look's mass): 0.61 rad, 35 degrees. Along the axis its
 * 3.7 m tile, drawn out 1.4 times, repeated every 5.2 m down the trail,
 * a tiled look a judge would name; turned, its lattice meets the trail's
 * axis at no short period.
 */
export const MASS_TURN_C = Math.cos(0.61);
export const MASS_TURN_S = Math.sin(0.61);

/**
 * The trail's second field is read turned this far off the trail's axis
 * (round 14, the look's trail): 0.52 rad, 30 degrees, after its stretch
 * along the flow (so its features are drawn out along the flow like the
 * first field's, but its lattice meets neither the axis nor the first
 * field's lattice at a short period). Two fields at one angle share a tile
 * repeat, which the eye reads as a tiled pattern.
 */
export const TRAIL_TURN_C = Math.cos(0.52);
export const TRAIL_TURN_S = Math.sin(0.52);
/**
 * Round 15's streak read is turned the other way, -0.37 rad (21 degrees),
 * so its lattice meets neither the first field's nor the fine read's.
 */
export const TRAIL_TURN2_C = Math.cos(-0.37);
export const TRAIL_TURN2_S = Math.sin(-0.37);

/**
 * THE WHITER MILK (round 15, the look's trailMilkGlow): a dense cloud of
 * fine bubbles just under the surface scatters every color about alike, so
 * the young churn's glow is paler and whiter than BUBBLE_MILK. At full
 * weight it lifts the near body (0.03, 0.14, 0.17) to about (0.22, 0.38,
 * 0.41): the references' water inside the trail is 38 to 53 levels of
 * luma over the open sea beside it at about 0.4 less saturation
 * (`wake/r15/measure.py`).
 */
export const BUBBLE_WHITE = new THREE.Vector3(0.19, 0.24, 0.24);

/** Range fade of the mesh's wake height, meters from the camera. */
export const LIFT_FADE_START_M = 140;
export const LIFT_FADE_END_M = 260;

/**
 * Pixel footprints over which the wake's slope fades out, meters. The
 * shortest waves the patch makes are 4 to 6 m long; a pixel wider than a
 * quarter of that averages them away, so the slope goes 1 to 0 between
 * footprints of 1.5 and 6 m.
 */
export const SLOPE_FOOT_START_M = 1.5;
export const SLOPE_FOOT_END_M = 6;
