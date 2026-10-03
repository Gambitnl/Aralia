/**
 * @file oceanSpray.ts — sea spray: the spume the wind tears off breaking crests.
 *
 * WHAT IT IS. A GPU particle system on top of the FFT sea. Each particle is
 * one STRAND of a spray plume: a camera-facing ribbon from its ROOT, a point
 * on a whitecap the surface draws, to its TIP, where the drops that left
 * that root are now, bowed up by the lip updraft those drops rode. The drops
 * ride the near-surface wind, fall at their terminal speed, and land again;
 * the root stays on its whitecap while the whitecap is drawn. Many strands
 * a whitecap, each with its own drop size, eddy and share of drops, make
 * its plume: dense and white-gray at the lip, thinning downwind.
 *
 * THE ROOT IS ON THE FOAM THE EYE SEES (round 3). Two rounds of blind
 * critics named the same fault: mist over the sea that no whitecap feeds,
 * and whitecaps with no plume. The cause was measured, not guessed. The
 * spray chose its births and held its roots on the RAW fold of every foam
 * cascade, but the surface does not draw the raw fold at range. It fades
 * each cascade by the pixel's footprint (`fit` in oceanSurface.ts) and reads
 * the MEAN Jacobian under the footprint (the normal mip). From a 12 m deck
 * the ripple's fold is drawn at 93% at 50 m, 37% at 100 m and 7% at 150 m,
 * and it is averaged over 0.2 to 2 m, so most of the ripple folds the
 * spray was born on are not drawn at all past 70 m. Now the births and the
 * roots read `seenDeficit`: the same fade and the same footprint mean, from
 * the same normal planes, as the surface's foam mask. See SPRAY_SEEN_HOLD.
 *
 * HOW LONG A ROOT HOLDS. Measured on the CPU reference of the storm sea
 * (`.agent/scratch/ocean-gauntlet/spray/rootTrack.ts`): of the points that
 * are a deep drawn fold at one moment, a root that stays where it is and
 * hops to foam within 1 m when its own point clears is still on drawn foam
 * for 76 to 96% of them a quarter second later, 57 to 75% at half a second,
 * and 6 to 16% at one second, at 40, 70 and 100 m. A root that moves with the
 * peak wave (9.7 m/s) holds worse at every range. The drawn whitecap of
 * this sea is the instantaneous fold, which lives about half a second; a
 * foam that lingers where a crest broke is the shading piece's work. So a
 * strand lives as long as its whitecap is drawn, then fades over
 * SPRAY_ORPHAN_S: no mist floats on with no foam under its root.
 *
 * THE WIND IS THE SEA STATE'S WIND. The wind-sea cascade carries U10, the
 * 10 m wind. The spray uses that same wind: for whether spray exists at all
 * (the Beaufort scale puts "some airborne spray" at force 6 and "large amounts
 * of airborne spray" at force 9), for how fast a drop is carried, and for the
 * speed of the crest it leaves. A calm sea with `?extras=spray` shows almost
 * nothing, and that is the honest result, not a failure.
 *
 * DETERMINISM. The sea is a pure function of (seed, time). Spray integrates,
 * so it cannot be, but it can be the next best thing: a pure function of
 * (seed, time, viewpoint) reached by a FIXED-STEP integration from a known
 * start. The system keeps an integer step cursor. When a caller asks for a
 * time the cursor cannot reach at all — a pinned capture time, a jump
 * backward, a gap longer than the warm-up, or a camera that has moved or
 * turned far — the particles are cleared and the system re-integrates from
 * `SPRAY_WARMUP_S` before the target. When the gap is merely long (a hitch),
 * it is integrated whole. In both cases the SEA is stepped along with the
 * spray, every `SPRAY_SEA_RESTEP_EVERY` steps, so every spawn read a crest of
 * its own moment and not the crest of the frame's end. A capture at a pinned
 * time then reproduces exactly, as `shootOurs.mjs` needs. During ordinary
 * live frames of one or two steps the sea is already at the frame's time and
 * is not re-stepped; the spray is at most two 1/60 s steps behind it.
 *
 * REGISTERED TSL HAZARDS, and what this file does about each (see
 * `oceanCompute.ts` for the list):
 *   - No scatter writes. The update kernel writes ONLY its own particle.
 *   - No integer `.mod()`. Indices are power-of-two masks (oceanSampler.ts).
 *   - No per-frame uniform shared across dispatches in one submit. Each step
 *     is its own `renderer.compute()` call, and three submits one command
 *     buffer per call, so each step's `uStep` and the sea's `uTime` land
 *     before that step runs. `field.step` follows the same rule.
 *
 * WHAT WAS KEPT from round 2: the strand from root to tip, the drop sizes and
 * their drag, the log wind profile, the gust field, the lip updraft, the
 * fixed-step plan and every probe a capture script reads.
 *
 * WHAT IS STILL OPEN. The seen deficit is a MIRROR of the surface's foam
 * mask (its footprint fade, footprint mean and range stretch), because
 * `oceanSurface.ts` exports none of them (GG-281); it reads about 0.02 under
 * the surface's and leaves out the mip's across-view average. The drawn
 * whitecap lives half a second, so a plume cannot outlive it (GG-279). The
 * sea body colors are copied from `oceanSurface.ts`, which does not export
 * them. At eye level (5.5 m) the nearest whitecaps, 5 to 20 m off, carry
 * plumes large enough on screen to read as a sheet.
 */
import * as THREE from 'three/webgpu';
import {
  Fn,
  If,
  abs,
  cameraPosition,
  ceil,
  clamp,
  cos,
  cross,
  dot,
  exp,
  exp2,
  float,
  floor,
  fract,
  hash,
  instanceIndex,
  instancedArray,
  log,
  log2,
  max,
  min,
  mix,
  mx_noise_vec3,
  normalize,
  positionGeometry,
  pow,
  select,
  sin,
  smoothstep,
  sqrt,
  uint,
  uniform,
  uv,
  varying,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import { GRAVITY_MS2, log2Exact, type CascadeParams } from './oceanConfig';
import type { OceanField } from './oceanField';
import { createOceanSampler } from './oceanSampler';
import { jonswapPeakOmega } from './oceanSpectrum';
import { OCEAN_SUN_DIR, oceanSkyRadiance } from './oceanSky';

/** A TSL node expression. See `oceanSurface.ts` for why this is `any`. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TslNode = any;

/* ------------------------------------------------------------------ */
/* Constants, each with its measurement                                */
/* ------------------------------------------------------------------ */

/** The fixed integration step, seconds. One display frame at 60 Hz. */
export const SPRAY_DT_S = 1 / 60;

/**
 * How far before a target time a restart integrates from, seconds. It must
 * exceed the longest particle life (`SPRAY_LIFE_MAX_S`, 4.0 s) so that the
 * spray field is in steady state by the target: every particle alive at the
 * target was born inside the warm-up, and none carries state from before it.
 */
export const SPRAY_WARMUP_S = 4.5;

/**
 * A frame that runs this many steps or fewer takes the sea as the viewer
 * left it, at the frame's time: the spray is then at most two steps (33 ms)
 * behind the surface, under one frame. A frame that must run more than this
 * is a catch-up (a hitch, a restart, a pinned capture), and during a catch-up
 * the sea is re-stepped along the way, below.
 */
export const SPRAY_FRAME_STEPS_MAX = 2;

/**
 * During a catch-up the sea is re-stepped every this many spray steps, so a
 * spawn reads a crest at most 3 steps (50 ms) old: the crest has moved half
 * a meter and its height has barely changed. Re-stepping every step would be
 * exact, and it is what the first build did, and it made a restart cost
 * more wall time than the gap it closed: 180 steps of 18 sea dispatches plus
 * one spray dispatch is 3,420 `renderer.compute` calls at roughly half a
 * millisecond each, 1.6 s, after which the live clock had jumped 1.6 s and
 * the next frame restarted again, forever. The stall was the restart itself.
 *
 * At every fourth step a second of sea time costs 60 spray plus 15 x 18 sea
 * calls, 330 calls, about 0.16 s of wall time: each catch-up closes six
 * times more gap than it opens, so the loop converges in a few frames.
 */
export const SPRAY_SEA_RESTEP_EVERY = 4;

/**
 * How far the emission may move between steps before the system restarts,
 * meters. It is measured as the largest of the camera's forward point
 * moving, the far edge of the emission wedge swinging, and the pixel
 * footprint changing (`sprayViewJumpM`): a camera cut does one of them, a
 * ship under way or a slow pan does none. 25 m is a ninth of the wedge's
 * 230 m reach.
 */
export const SPRAY_RECENTER_M = 25;

/**
 * Drag relaxation time of a spume drop, seconds. Gunn and Kinzer (1949)
 * measured terminal fall speeds of water drops in air: 2.06 m/s at 0.5 mm
 * diameter, 4.03 m/s at 1.0 mm. A 0.7 mm drop, the middle of the spume range
 * that stays visible as mist, falls at about 2.9 m/s, and its relaxation time
 * is that speed over g: 0.30 s. The same constant sets how fast a drop takes
 * up the wind and how fast it falls, because both are the same drag. Each
 * particle draws its own size from the range below.
 */
export const SPRAY_DROP_TAU_S = 0.30;

/**
 * The range of drop sizes as drag relaxation times, seconds, one per
 * particle. Gunn and Kinzer again: a 0.1 mm drop falls at 0.27 m/s, tau
 * 0.027 s; a 1.0 mm drop at 4.03 m/s, tau 0.41 s. The fine end takes up the
 * wind within one step and stays airborne; the coarse end lags the air for
 * half a second and is back on the water in one. That split is what makes a
 * plume dense at its root and thin at its tail.
 */
export const SPRAY_DROP_TAU_MIN_S = 0.027;
export const SPRAY_DROP_TAU_MAX_S = 0.41;

/**
 * Particle life, seconds, set by drop size: the coarsest drops get the
 * minimum, the finest the maximum. Coarse spume lifted a meter and falling
 * at 4 m/s is down within a second. Fine mist at 0.3 m/s could stay up for
 * ten; 4 s is where its strand has thinned below what the eye picks out.
 * The root hold (SPRAY_SEEN_HOLD) almost always ends a strand first: the
 * drawn whitecap lives about half a second (see the file header).
 */
export const SPRAY_LIFE_MIN_S = 0.7;
export const SPRAY_LIFE_MAX_S = 4.0;

/**
 * How long a strand outlives the drawn foam under its root, seconds. When
 * the whitecap clears, the drops already in the air spread and fall over
 * about one coarse-drop drag time, 0.3 s, and after that they are part of
 * the general mist the eye does not pick out. The strand fades over this
 * time and then dies. A strand whose tip lands on the water fades the same
 * way: its drops are back in the foam.
 */
export const SPRAY_ORPHAN_S = 0.30;

/**
 * How fast a strand regains its strength when the drawn foam comes back
 * under its root, seconds from 0 to 1. The drawn fold flickers with the
 * ripple (a 1 m ripple has a 0.8 s period, so its fold comes and goes
 * within a few tenths of a second); a strand that lost its foam for a tenth
 * of a second and found it again is the same plume.
 */
export const SPRAY_REGAIN_S = 0.10;

/**
 * How far a root may hop to drawn foam when the foam under it clears,
 * meters, and how many points of a ring at that radius it tries. Measured
 * (rootTrack.ts, a stationary root): with no hop 25 to 64% of roots still
 * hold at 0.25 s and 4 to 9% at 0.5 s; with a 0.9 m hop, 76 to 96% and 57 to
 * 75%; a 1.5 m hop adds under 10 points and moves the root further on
 * screen, 32 px at 40 m. 1.0 m is the knee. Six points is the ring the
 * measurement used.
 */
export const SPRAY_REROOT_M = 1.0;
export const SPRAY_REROOT_TAPS = 6;

/**
 * The most a hop may change the root's height, meters. A ripple a meter
 * long on a storm crest rises and falls 0.2 to 0.3 m over the hop's reach;
 * a hop past that is onto another wave's face. A young strand whose root
 * hopped 0.55 m down stood at 36 degrees on screen (capture r3j).
 */
export const SPRAY_REROOT_DH_M = 0.25;

/**
 * How fast the root moves along the wind by itself, m/s: not at all. The
 * same measurement at 5 and 9.7 m/s (the peak wave's phase speed) held
 * fewer roots at every range and every time than a root that stays and
 * hops: the drawn fold of this sea is where several wave crests meet, and
 * that meeting point does not travel with any one of them.
 */
export const SPRAY_ROOT_SPEED_MS = 0;

/**
 * The longest a strand's root feeds it, seconds: one break. The root may hop
 * onto foam within SPRAY_REROOT_M while its whitecap flickers, but in the
 * dense ripple foam near the camera the hops chained from fleck to fleck
 * and a strand fed for its whole 4 s life, 12 to 21 m long, and hundreds of
 * them merged into a flat gray sheet (capture r3a). The cap is the drawn
 * whitecap's own median life: in rootTrack.ts half the roots that hop hold
 * for 0.5 to 0.6 s at 40 to 100 m. After it the strand fades as an orphan.
 * With the tip 12 m/s downwind of a still root, a strand fed for 0.6 s is
 * about 7 m long, a streamer "a wavelength or two" of the short waves the
 * critics see.
 */
export const SPRAY_BREAK_MAX_S = 0.6;

/**
 * The vertical turbulence the drops ride, as an rms fraction of U10, for
 * EACH of two eddy sizes. The vertical rms of a neutral surface layer is
 * 1.25 u* (Panofsky and Dutton), and u* over the sea at this wind is 0.04
 * U10 (drag coefficient 1.6e-3): 0.05 U10 in all. Half its variance is put
 * in the 33 m eddies of the gust field, which move a whole plume together,
 * and half in eddies the size of the drops' height, about a meter, which
 * move each strand its own way: 0.035 U10 each, and sqrt(2) x 0.035 = 0.05.
 * A meter eddy near the water lives z / u* = 1.2 s at this wind, about a
 * strand's life, so a strand holds its one small-eddy speed. That fans the
 * strands of a plume a few degrees up and down; the ones fanned down reach
 * the water and fade (a landed tip), so the plume that is left trails
 * slightly upward, as the critics asked. Round 2 had only the plume-wide
 * gusts, and every strand of a plume lay on one line: a smear, no fibers.
 */
export const SPRAY_EDDY_W = 0.035;

/**
 * The height under which the vertical eddies are damped, meters, in
 * proportion to height down to a quarter. Undamped, a fine drop a hand
 * above the crest took 1.2 m/s of eddy on top of the 1.8 m/s lip updraft
 * while the gust held it back along the wind, and its young strand stood up
 * at 36 degrees on screen: a bright tick across the plume (capture r3f).
 */
export const SPRAY_EDDY_FLOOR_M = 1.0;

/**
 * The lateral small eddies, across the wind, rms as a fraction of U10. The
 * lateral rms of a neutral surface layer is about 1.9 u* (Panofsky and
 * Dutton), 0.076 U10 here; half its variance in the meter eddies is 0.054.
 * It fans a plume's strands a few degrees to either side of the wind, and
 * from the deck a fan across the wind is a fan up and down the screen: the
 * strands of one whitecap stop lying on one line. Round 3 before it drew
 * every strand of a plume parallel, and both preview critics named it
 * combed hair (capture r3k).
 */
export const SPRAY_EDDY_V = 0.054;

/**
 * The lee rise: a steady updraft as a fraction of the air speed, on the
 * drops downwind of the lip. The separated shear layer spreads at 0.17 of
 * the distance (Brown and Roshko 1974), its upper edge at about half that;
 * drops mixed through it whose lower half the water takes (a landed tip)
 * leave a centroid that climbs at roughly 0.04 to 0.06 of the distance.
 * Round 2 tried 0.08 and put a fifth of the fine mist above 3 m, but its
 * strands lived 2.6 s; a strand here ends with its whitecap in under a
 * second, so the rise lifts the tip about half a meter: the plume stands
 * off the water instead of lying on it, the critics' "decal" fault
 * (capture r3k). 0.045, the low end of the estimate, was tried against
 * the slashes a critic saw across the plume (r3s); it flattened the plume
 * and did not remove them (r3u), because the slashes are the few strands
 * that climb far, which the steep dilution handles. At 0.06 both round-2
 * critics still saw plumes that "lie flat at one height, nothing lifts or
 * curls". 0.09, the upper edge's half-rate (0.17 / 2), moved the median
 * strand to 2 degrees UP on screen and still read flat (r5f); 0.15, near
 * the upper edge's own climb, puts the median strand at 9 degrees of rise
 * and 6 on screen (angles.py, r5g), and in a blind A/B against 0.09 two
 * preview critics of two picked it (low). The tip end fades from 2.5 m
 * over the water, so the few strands that climb far do not stand as poles.
 */
export const SPRAY_LEE_RISE = 0.15;

/**
 * The side of the cell of water that shares a plume seed, meters: about one
 * whitecap. Every strand born in the cell gets the same break length (0.55
 * to 1.45 of SPRAY_BREAK_MAX_S) and the same density (0.7 to 1.15), so one
 * whitecap's plume is long and dense and the next one's short and thin. Both
 * preview critics called the plumes one brush shape repeated (capture r3n).
 */
export const SPRAY_PLUME_CELL_M = 4;

/** The root is drawn this far above the crest, meters: a hand. */
export const SPRAY_ROOT_LIFT_M = 0.10;

/**
 * How high above that the spume cloud at the lip stands, meters. A
 * strand's root is drawn at a height drawn from 0 to this (squared, so most
 * roots are low): the plume leaves the whole height of the cloud over its
 * whitecap, and the head has the thickness every preview critic found
 * missing ("glued to the water plane like smeared decals, no lift or
 * thickness", capture r3q). All roots at a hand over the foam made the
 * head a line a few pixels tall. The lip updraft's whole rise, slope x
 * reach = 0.7 m, was tried first and lifted the drawn roots 5 to 10 px off
 * their whitecaps from the deck: 62% of roots sat on drawn foam against
 * 82% before, and a critic saw streaks "with no crest feeding them"
 * (capture r3s). 0.4 m is the jet's own throw at its top speed plus the
 * first part of the updraft.
 */
export const SPRAY_LIP_THROW_M = 0.4;

/**
 * The updraft at the crest lip, as a fraction of the air speed there: the
 * slope the airflow leaves the crest at. The air follows the windward face
 * up to the crest and separates there, so it leaves at the face's slope,
 * and a wave breaks when its steepness ak reaches about 0.3 (the Stokes
 * limit is 0.44; observed onset is near 0.3, Banner and Peregrine 1993).
 * The updraft then dies away exponentially over the air's run from the lip
 * (air speed times age), on a reach of one wave height (SPRAY_LIP_MIN_M),
 * so a drop that rides the air rises slope x reach = 0.7 m in all, and the
 * fine mist then settles at 0.3 to 1 m/s: a 7 m streamer ends a few tenths
 * of a meter over its root, a slight upward trail. At 11 m/s of air a hand
 * above the crest the updraft starts at 3.3 m/s.
 *
 * Round 2 used half the slope, 0.15, because at 0.3 its strands stood up at
 * 45 degrees as tufts (capture sp19); but there the decay ran on the drop's
 * distance from a root that itself moved downwind at the peak's phase
 * speed, so a drop stayed "at the lip" for most of a second. On the run
 * since birth the rise is bounded; at 0.15 the strands aged over a quarter
 * second rose 1.3 degrees at the median and trailed 3.6 degrees DOWN on
 * screen (capture r3i), since the wind blows 20 degrees toward the camera.
 */
export const SPRAY_LIP_SLOPE = 0.3;

/**
 * The least reach of the lip updraft, meters: one wave height. The
 * separated streamline levels off within about a wave height, trough to
 * crest, and the storm wind sea's significant height is 2.3 m. The crest's
 * height over the mean (about 1 m) was used first, which is half of that
 * span; with it the strands trailed 2 degrees DOWN on screen at the median
 * from the deck (r3h), since the wind blows 20 degrees toward the camera.
 */
export const SPRAY_LIP_MIN_M = 2.3;

/**
 * The emission wedge: every dead slot draws a candidate point on the water
 * at a bearing within HALF_ANGLE of the camera's heading and a range from
 * NEAR to FAR, uniform over the wedge's AREA. The camera's horizontal field
 * at 50 degrees vertical and 16:9 is 79 degrees, +-40; 50 degrees keeps the
 * strands that blow into the frame from its sides. FAR, 230 m, is the top of
 * the judged crop from the storm deck; a 10 m strand there is 40 px long.
 * Uniform over area gives every square meter of whitecap the same birth
 * rate, so a whitecap carries strands in proportion to its size at any
 * range. Uniform in RANGE was tried first: it gave a square meter at 10 m
 * twenty times the candidates of one at 230 m, and the dense ripple foam
 * under the deck took 7,200 of 9,700 live strands inside 20 m, below the
 * bottom of the frame (capture r3a). A disc around the camera (round 2)
 * spent most of its candidates behind the camera and beside it.
 */
export const SPRAY_EMIT_NEAR_M = 4;
export const SPRAY_EMIT_FAR_M = 230;
export const SPRAY_EMIT_HALF_ANGLE_RAD = (50 * Math.PI) / 180;

/**
 * Candidates each dead slot tries per step. Over 97% of the water is not a
 * drawn whitecap, so one try a step gave a plume on a third of the drawn
 * foam blobs of the judged crop, and on a fifth of those in its lower rows
 * (capture r3b, rootStats.py). Three tries triple the birth rate on every
 * whitecap alike; the hash keeps each try its own three draws, so a pinned
 * capture still reproduces. The draws are (0, 1, 2), (10, 11, 12) and
 * (13, 14, 15) of the particle's sixteen per step.
 */
export const SPRAY_EMIT_TRIES = 3;

/**
 * How far ahead of the camera the emission's reference point sits, meters.
 * Only the restart test reads it: the reference point moving by more than
 * SPRAY_RECENTER_M restarts the spray.
 */
export const SPRAY_EMIT_AHEAD_M = 40;

/**
 * THE SEEN DEFICIT, and the band that emits and holds. The surface draws
 * foam with smoothstep(0.60, 0.38, jac) on jac = 1 - seen deficit, so drawn
 * foam begins at a seen deficit of 0.40 and is full at 0.62. A root HOLDS
 * while its seen deficit is at least 0.40: while there is drawn foam under
 * it. A slot is BORN with a chance that rises from 0 at 0.40 to 1 at 0.52,
 * the band where a whitecap turns white ON SCREEN. Measured at the judged
 * pose (`spray/seenCheck.mjs`: the spray's own seen deficit on a 0.08 m
 * grid, projected onto the frame drawn without strands): pixels at a seen
 * deficit of 0.40 to 0.45 are 40 sRGB or more over the water in 35% of
 * cases, 0.45 to 0.50 in 63%, 0.50 to 0.60 in 85%. The foam mix is only a
 * third drawn at 0.47, but against this dark sea that third is already a
 * bright whitecap. The first ramp, 0.45 to 0.62 ("spray leaves the white,
 * not the fringe"), gave a chance of 0.04 at 0.47, and the largest
 * whitecap of the judged crop had one live root (capture r4f). The same
 * check found the spray's seen deficit tracks the drawn foam's shape blob
 * for blob, and reads about 0.02 under it. In the storm at 42 s the seen
 * deficit is over 0.40 on 7.2% of the water at 40 m, 3.5% at 70 m and 2.3%
 * at 100 m, and over 0.5 on 3.1%, 1.2% and 0.5% (rootTrack.ts).
 */
export const SPRAY_SEEN_HOLD = 0.40;
export const SPRAY_SEEN_BORN = 0.40;
export const SPRAY_SEEN_FULL = 0.52;

/**
 * The stretch the surface puts on every cascade's NORMAL range fade, which
 * is also the range fade of its foam: a copy of NORMAL_RANGE_SCALE in
 * oceanSurface.ts (3 as of 2026-09-24), which that file does not
 * export. The spray must fade a cascade's fold where the surface fades its
 * foam, or it is born on folds the surface still draws as white (or the
 * reverse). A copy drifts; the report asks the shading piece to export it.
 */
export const SPRAY_NORMAL_RANGE_SCALE = 3;

/**
 * Reads spread along the long axis of the footprint, per foam cascade, for
 * the seen deficit. The surface uses the same count (ANISO_TAPS in
 * oceanSurface.ts), each read from a mip level whose texel is a quarter of
 * the long axis; here each read is bilinear at full resolution, so the mean
 * is over the same span along the view and a texel wide across it.
 */
export const SPRAY_SEEN_TAPS = 4;

/**
 * The one-read gate before the full seen deficit: a point whose own read
 * of the foam cascades is under this is open water and is not read further.
 * 0.25 is well under the 0.40 hold: four reads over the footprint cannot
 * average past 0.40 unless the middle of it is folding too. The full test
 * on every candidate made the spray's update 2.1 ms of GPU a step with
 * 16,384 slots and three tries (benchWhole.mjs, r3k); nine in ten of those
 * reads were on open water.
 */
export const SPRAY_SEEN_GATE = 0.25;

/**
 * Strand thickness at its root, meters, across the wind. The critics of
 * rounds 1 and 2 asked for streaks under a meter thick, fine and ragged,
 * with a dense leading edge at the crest; the round-2 strands were 0.5 m at
 * the root and read as tufts. A strand here is one filament of a plume, not
 * the plume: 0.08 to 0.24 m (per particle), and the plume's own width is the
 * spread of its filaments' paths (drop size, eddies, the lip updraft). At
 * 0.12 to 0.36 m the near filaments were 5 to 15 px brush strokes (r3c).
 */
export const SPRAY_ACROSS_BIRTH_M = 0.16;

/**
 * How fast one filament widens along its length, meters per meter. A plane
 * mixing layer grows at 0.16 to 0.18 of the distance from separation (Brown
 * and Roshko 1974), but that is the growth of the whole shear layer, the
 * PLUME, and the plume's width is already made by its filaments diverging.
 * One filament is a coherent packet of drops inside it; its own spread is
 * the drops' turbulent dispersion at the packet's scale, about a third of
 * the layer's: 0.06. A 10 m filament is then 0.76 m wide at its tip and its
 * density there is the root's times 0.16 / 0.76.
 */
export const SPRAY_SPREAD = 0.06;

/**
 * The slope above which a strand is diluted as a rising column (see the
 * ribbon shader), rise over run. The plume's strands rise at a median of
 * 9 degrees and a 90th percentile of 15 at the lee rise of 0.15 (angles.py,
 * r5g); 0.36 is 20 degrees, so only the steepest few percent thin. (At the
 * round-2 lee rise of 0.06 the threshold was 0.2, 11 degrees.)
 */
export const SPRAY_STEEP_SLOPE = 0.36;

/**
 * The extra optical depth of the first meter of a strand, over the thread
 * beyond it, e-folding over a meter. Coarse spume (0.3 to 1 mm) is most of
 * a plume's drop mass and falls back within about a meter of the lip
 * (terminal 2 to 4 m/s from a few decimeters up, at the lip's 6 to 12 m/s
 * forward speed), so the root could be up to twice as opaque as the
 * thread. At 0.8 a preview critic saw the heads as hard-edged decals and a
 * puff "brighter than an overcast sky could light it" (capture r3u); with
 * none, the critics of the ribbon asked for "a dense, bright burst at the
 * crest lip" and saw bands "the same density from end to end" (r4g). 0.5
 * makes the first meter 1.5 times as opaque as the thread.
 */
export const SPRAY_ROOT_MASS = 0.5;

/**
 * How far the strand's dense head reaches upwind of its root, meters. The
 * root is a point on the whitecap; the spume leaves the whole downwind half
 * of it, which on a breaking crest of this sea is about a meter across. The
 * head overlaps that half, so the white of the whitecap runs into the
 * plume with no seam (both critics: "the whitecaps have no transition into
 * mist").
 */
export const SPRAY_LEAD_M = 0.5;

/**
 * The head's radiance as a fraction of the surface's whitecap radiance.
 * Physically a thick spume head and the whitecap are one material and
 * would match, and at 1 they did: the heads, hundreds on a near whitecap,
 * drew the plume roots as bigger white blobs (capture r3c), the fault the
 * critics named in the whitecaps themselves. Measured on the reference
 * storm frame, its plume core peaks at 141 sRGB and its foam at 139, under
 * a deck of 92 to 101; this surface's whitecap is 200. At half the
 * whitecap's radiance both preview critics still called the heads "almost
 * pure white under a dull overcast sky" (capture r3k); at 0.4 a round-2
 * critic still found the spray "as white as the foam specks: airborne mist
 * under a storm sky should be a dimmer gray than the foam on the water".
 * 0.28 was tried with the other round-3 changes, and the plumes faded to a
 * haze two critics of two ranked under the round-2 frame (r5e); 0.34 with
 * the opacity restored keeps the plume core at the reference's level (its
 * band p95 120 sRGB against the reference plume core's 118; the whitecaps
 * are 200): a light gray, dimmer than the foam, and the plume reads as
 * mist leaving the foam, not more foam.
 */
export const SPRAY_HEAD_OF_FOAM = 0.34;

/**
 * How far each ribbon vertex is slid toward the camera, meters, depth only
 * (see the ribbon shader). A breaking crest stands 0.5 to 1 m over the
 * water the mesh draws a vertex or two in front of it; 1 m clears it
 * without letting a strand show through the next crest nearer the camera,
 * which at the judged ranges (30 to 230 m) is 10 m and more away.
 */
export const SPRAY_DEPTH_PULL_M = 1.0;

/**
 * The pull's growth with range, meters per meter: 2 m at 100 m. At the
 * judged 100 m whitecaps a flat 1 m let the crest's front face cut the
 * lower half of each plume on the crest's own skyline, and both critics of
 * round 2 saw "opaque white horizontal cards with hard bottom edges" there.
 * A crest's face at a 0.3 slope seen at 7 degrees stands about 1.2 m in
 * front of a point half a meter under its top, and more under steeper or
 * nearer crests. (The hard edges themselves turned out not to be the
 * occlusion: a 6 cm per meter pull, 6 m at 100 m, left them as they were,
 * capture r5b. They are the line of dense heads; see SPRAY_SOFT_BOTTOM_M.)
 */
export const SPRAY_DEPTH_PULL_PER_M = 0.01;

/**
 * THE SOFT BOTTOM: past the first SPRAY_SOFT_ROOT_M of a strand, its
 * opacity fades to nothing from SPRAY_SOFT_BOTTOM_M over the water under it
 * to 0.15 m under it: where a strand sinks toward the sea its drops are
 * landing. Over the root the fade runs from 0.2 m over the water to 0.4 m
 * under it, and the drawn root sits SPRAY_ROOT_SINK_M lower than the
 * lifted spume, so the head's lower half dips into the whitecap and fades
 * there. The heads of a whitecap's strands all start on its top line, and
 * drawn to full opacity down to it they made the plume's lower edge one
 * hard line, the "hard bottom edges" of both round-2 critics. A wider root
 * fade (0.45 m over to 0.35 m under) with a 0.15 m sink took the density
 * out of every head (r5c, r5d).
 */
export const SPRAY_SOFT_BOTTOM_M = 0.6;
export const SPRAY_SOFT_ROOT_M = 1.5;
export const SPRAY_ROOT_SINK_M = 0.05;

/**
 * THE STREAKS: a wind-aligned pattern in WORLD space, shared by every strand
 * a pixel sees, so a plume shows streaks along the wind across all its
 * overlapping strands instead of one blur ("no streaks inside it", critic 1
 * of round 2). Its main period is SPRAY_STREAK_M in height (about the
 * thickness of one filament, 0.1 to 0.4 m), doubled per octave until it
 * spans 6 px, with a slant across the horizontal and a slow wander along
 * the wind; it drifts with the air at 0.7 U10. A first build faded the
 * streaks out where the base period was under 4 to 8 px, and from the deck
 * that was everything past 35 m: no streak was drawn in the judged crop
 * (capture r5a).
 */
export const SPRAY_STREAK_M = 0.27;

/**
 * The e-fold of the plume's opacity along the strand, meters, on top of the
 * filament's dilution. Critic 2 of round 2: "opacity stays the same along
 * each streak; it should be dense at the crest and fall off fast
 * downwind". With the dilution alone a 10 m strand kept 0.2 of its root
 * opacity at its tip; with an 8 m e-fold on top it keeps 0.06, and the
 * ragged end decides where it vanishes. A 4 m e-fold cut the plumes to
 * stubs that read as haze (r5c).
 */
export const SPRAY_FALLOFF_M = 8;

/**
 * Opacity of one strand at its root, before its share of drops (0.6 to 1)
 * and its clumps (0.5 to 1). With every strand at full share and no clumps
 * the plumes read as "bright, solid, brush-stroke smears" with no water
 * showing through (preview critics, capture r3k); at 0.8 with shares from
 * 0.45 and clumps from 0.35 they thinned to a veil the eye barely finds
 * (r3m). The variation between strands, not a lower mean, is what lets
 * the water through. It was 1.3 through round 2, because the ragged tail
 * and the orphan puff (r3r) thin every strand; a round-2 critic still saw
 * "opaque white horizontal cards" and "cotton-ball cloud sprites parked on
 * the sea" where the heads of a big whitecap's strands overlap along the
 * view. Round 3 answers that with STRUCTURE instead of a lower mean: the
 * soft bottom, the 8 m falloff and the world-space streaks (0.5 to 1.35)
 * each take opacity out of the parts the critics named, and 1.5 restores
 * the plume core to the round-2 frame's level (band p95 120 against 127).
 * At 0.8 and 1.1 the plumes faded to haze on sight (r5c, r5d), and at 1.4
 * with the 0.28 head they lost to the round-2 frame in two blind A/Bs of
 * two (r5e). The final opacity is clamped to 1.
 */
export const SPRAY_ALPHA = 1.5;

/**
 * The pixel floor of a strand's thickness. A strand thinner than this on
 * screen is drawn at this width with its opacity cut by the same ratio, so
 * the light it puts on screen is conserved: a far streamer becomes the faint
 * lightening it is, instead of a dotted line (drawn at full opacity on a few
 * pixels, the first build's fault) or nothing (a hard fade, the second's).
 * At 1.5 px a far filament at a slant rasterized as a hatched line, a row
 * of short ticks (capture r3d); 2.5 px gives its soft ridge room to cover
 * the pixels it crosses smoothly.
 */
export const SPRAY_PX_FLOOR = 2.5;

/* ------------------------------------------------------------------ */
/* Pure CPU logic, unit-tested                                         */
/* ------------------------------------------------------------------ */

export interface SprayStepPlan {
  /** True when the particles are cleared and the warm-up is re-integrated. */
  readonly restart: boolean;
  /** Index of the first step to run. Step s advances the clock to (s+1) dt. */
  readonly firstStep: number;
  /** Number of steps to run. 0 when the cursor is already at the target. */
  readonly steps: number;
}

export interface SprayPlanOptions {
  readonly dtS?: number;
  readonly warmupS?: number;
  readonly recenterM?: number;
}

/**
 * Decide which fixed steps bring the spray from its cursor to a target time.
 *
 * A gap up to the warm-up length is integrated whole: every particle alive at
 * the target was born inside it, so the result is the same as a restart's
 * and the clearing is not needed. A longer gap restarts, because the steps
 * before the warm-up cannot change the outcome and would only cost time.
 *
 * @param cursorStep   the step index the system has reached, or null before
 *                     the first step.
 * @param simTimeS     the sea clock to reach.
 * @param centerJumpM  how far the emission moved since the last step
 *                     (`sprayViewJumpM`).
 */
export function planSprayStep(
  cursorStep: number | null,
  simTimeS: number,
  centerJumpM: number,
  opts: SprayPlanOptions = {},
): SprayStepPlan {
  const dt = opts.dtS ?? SPRAY_DT_S;
  const warmupSteps = Math.round((opts.warmupS ?? SPRAY_WARMUP_S) / dt);
  const recenter = opts.recenterM ?? SPRAY_RECENTER_M;

  // The last step whose end time does not pass the target. The epsilon keeps
  // an exact multiple (42.0 / (1/60) = 2520 in exact arithmetic) from
  // rounding down to 2519 in floating point.
  const target = Math.floor(simTimeS / dt + 1e-6);

  const restart = cursorStep === null
    || target < cursorStep
    || target - cursorStep > warmupSteps
    || centerJumpM > recenter;

  if (restart) {
    return { restart: true, firstStep: target - warmupSteps, steps: warmupSteps };
  }
  return { restart: false, firstStep: cursorStep as number, steps: target - (cursorStep as number) };
}

/**
 * How far the emission moved, meters: the largest of
 *   - the reference point's move;
 *   - the swing of the wedge's far edge, the heading change (radians,
 *     wrapped to +-pi) times SPRAY_EMIT_FAR_M: a camera that turns in place
 *     moves no point near it, but it points the whole wedge somewhere new;
 *   - the change of the pixel footprint, |ln(ratio)| times SPRAY_EMIT_FAR_M,
 *     where `footprintRatio` is (row angle / camera height) now over its
 *     last value. Births and roots read the drawn foam through the
 *     footprint (`sprayFootprintLongM`), so a camera that rises from 5.5 to
 *     12 m over the same forward point (the storm-eye and storm-deck poses)
 *     sees different foam, and the strands born for the old one would not
 *     be the ones the new one draws. A ship heaving a meter at 12 m changes
 *     it by 8%, 18 m of jump, under the threshold.
 * A pinned capture after any of these must restart, or it shows the old
 * view's strands: shootOurs.mjs shot storm-deck after storm-eye in one page
 * and drew the eye pose's births (capture sp20).
 */
export function sprayViewJumpM(centerMoveM: number, headingChangeRad: number, footprintRatio = 1): number {
  const wrapped = Math.atan2(Math.sin(headingChangeRad), Math.cos(headingChangeRad));
  const foot = Math.abs(Math.log(Math.max(footprintRatio, 1e-6))) * SPRAY_EMIT_FAR_M;
  return Math.max(centerMoveM, Math.abs(wrapped) * SPRAY_EMIT_FAR_M, foot);
}

/**
 * Whether the sea is re-stepped before spray step `s`, the `k`-th of `steps`
 * in this frame. Never inside an ordinary frame; in a catch-up, at the first
 * step and then at every step index that is a multiple of
 * `SPRAY_SEA_RESTEP_EVERY`. Keying on the absolute step index, not on `k`,
 * means a pinned target reached from any cursor re-steps the sea at the same
 * moments, which the determinism guarantee needs.
 */
export function spraySeaRestep(s: number, k: number, steps: number): boolean {
  if (steps <= SPRAY_FRAME_STEPS_MAX) return false;
  return k === 0 || s % SPRAY_SEA_RESTEP_EVERY === 0;
}

/**
 * The long axis of a pixel's footprint on the water, meters, for a point at
 * horizontal range `rangeM` from a camera `heightM` above it: the pixel's
 * angle times the slant distance, stretched by one over the sine of the
 * grazing angle (height over slant distance). This is the length of the
 * surface's `longM` (the longer screen derivative of the grid coordinate) on
 * flat water. From 12 m at 50 degrees and 900 rows: 0.23 m at 50 m, 0.88 m at
 * 100 m, 2.0 m at 150 m.
 */
export function sprayFootprintLongM(rangeM: number, heightM: number, radPerPx: number): number {
  const h = Math.max(heightM, 1);
  return (radPerPx * (rangeM * rangeM + h * h)) / h;
}

/**
 * The footprint fade the surface puts on a cascade's normal and foam: 1
 * while the footprint is under a 96th of the cascade's longest wave, 0 past
 * a quarter of it, smooth in log2 between. A copy of `fit` in
 * oceanSurface.ts, which does not export it; the unit test pins the copy to
 * that formula at its two ends and its middle.
 */
export function sprayFootprintFit(cutoffHighM: number, longM: number): number {
  const e0 = Math.log2(cutoffHighM / 96);
  const e1 = Math.log2(cutoffHighM / 4);
  const t = Math.min(Math.max((Math.log2(longM) - e0) / (e1 - e0), 0), 1);
  return 1 - t * t * (3 - 2 * t);
}

export interface SprayWind {
  /** Wind direction, radians from +X toward +Z. Waves and spray go this way. */
  readonly dirRad: number;
  /** U10, meters per second. */
  readonly speedMs: number;
  /**
   * Phase speed of the wind sea's JONSWAP peak, m/s: g / omegaP. The water
   * in a breaking crest moves forward at about this speed, and that is the
   * speed the spume leaves it with.
   */
  readonly crestSpeedMs: number;
}

/**
 * The wind the spray answers to: the wind of the longest foam-driving
 * cascade, which is the local wind sea. The swell is an old wind from
 * somewhere else and says nothing about the air here.
 *
 * @throws when no cascade drives foam. Without one there is no breaking and
 *         `createOceanField` would already have refused the sea.
 */
export function sprayWindFromCascades(cascades: readonly CascadeParams[]): SprayWind {
  const foamers = cascades.filter((c) => c.drivesFoam);
  if (foamers.length === 0) {
    throw new Error('[ocean] Spray needs a cascade that drives foam; none does.');
  }
  const windSea = foamers.reduce((a, c) => (c.cutoffHighM > a.cutoffHighM ? c : a));
  return {
    dirRad: windSea.windDirRad,
    speedMs: windSea.windSpeedMs,
    crestSpeedMs: GRAVITY_MS2 / jonswapPeakOmega(windSea.windSpeedMs, windSea.fetchM),
  };
}

/**
 * How much airborne spray a wind produces, 0 to 1, from the Beaufort scale's
 * own wording. Force 5 (up to 10.7 m/s) lists no spray. Force 6 (10.8-13.8)
 * has "some airborne spray", force 7 "moderate amounts", force 8
 * "considerable", and force 9 (20.8-24.4) "large amounts of airborne spray
 * may begin to reduce visibility". A smoothstep from the top of force 5 to
 * the bottom of force 9 gives 2.5% at the shipped 11.5 m/s and 97% at the
 * storm's 20 m/s.
 */
export function sprayWindFactor(u10Ms: number): number {
  const x = Math.min(Math.max((u10Ms - 10.5) / (21 - 10.5), 0), 1);
  return x * x * (3 - 2 * x);
}

/**
 * Wind speed at a height above the water, as a fraction of U10.
 *
 * The log profile u(z) = u* / kappa ln(z / z0) over the sea, with Charnock's
 * roughness z0 = 0.011 u*^2 / g and u* about 0.04 U10: at 20 m/s that is
 * 0.7 mm, and 1 mm is used for every wind because the profile's shape barely
 * moves with it. A drop 1 m up feels 75% of U10; at 0.3 m, 62%; at 3 m, 87%.
 * The floor at 5 cm keeps the log finite for a drop at the water.
 */
export function windProfileFactor(heightM: number): number {
  const z0 = 1e-3;
  return Math.log(Math.max(heightM, 0.05) / z0) / Math.log(10 / z0);
}

/**
 * The per-step blend toward the air's velocity for a drop with relaxation
 * time tau: 1 - exp(-dt / tau). Exact for a constant wind over the step,
 * unlike dt / tau, which overshoots when dt approaches tau.
 */
export function sprayDragK(dtS: number, tauS: number): number {
  return 1 - Math.exp(-dtS / tauS);
}

/* ------------------------------------------------------------------ */
/* The GPU system                                                      */
/* ------------------------------------------------------------------ */

export interface OceanSprayOptions {
  /**
   * Particle slots, a power of two. Default 16384. Every dead slot tries
   * SPRAY_EMIT_TRIES candidates a step, and the drawn foam covers 0.5 to 7%
   * of the water in the born band, so a hundred or more strands are born a
   * step. A strand lives about as long as its whitecap, half a second to a
   * second, so about 8,200 are alive at the judged storm-deck frame: some
   * tens of filaments a whitecap, which is what a plume with a dense root and
   * a ragged tail needs. Every slot runs the ribbon's vertex shader, dead or
   * not, so the pool is also the draw's floor. Round 2 ran 4096 slots with
   * 1.5 s plumes on undrawn folds.
   */
  readonly count?: number;
  /** The same sun the sky and the water use. */
  readonly sunDir?: THREE.Vector3;
  /**
   * The sky's `uOvercast` node (0 fair weather, 1 storm deck), the SAME node
   * `createOceanSky` returns, so one value drives the sky, the water and the
   * spray. Omitted, the strands are lit by the fair sky, which under a storm
   * deck made them pale blue-white against a gray sky (seen in capture sp5).
   */
  readonly overcast?: TslNode;
}

export interface OceanSpray {
  readonly mesh: THREE.Mesh;
  readonly count: number;
  readonly wind: SprayWind;
  /**
   * Bring the spray to the sea clock `simTimeS`, emitting around `camera`.
   * Enqueues compute dispatches; does not await. Re-steps the sea only on a
   * catch-up, and leaves it at `simTimeS` afterwards.
   */
  step(renderer: THREE.WebGPURenderer, camera: THREE.Camera, simTimeS: number): void;
  dispose(): void;
  /** Values a capture script reads through `__OCEAN__.extras.spray`. */
  readonly probe: {
    readonly count: number;
    readonly windSpeedMs: number;
    readonly windFactor: number;
    readonly crestSpeedMs: number;
    cursorStep: number | null;
    lastSteps: number;
    restarts: number;
    /**
     * Read the particle buffers back and count the live ones, with the
     * spread of spawn steps among them. The spread is the check that each
     * catch-up step saw its own step index: if every live particle reports
     * the same spawn step, the per-step uniform collapsed.
     */
    census(renderer: THREE.WebGPURenderer): Promise<{
      alive: number; distinctSpawnSteps: number; meanHeightAboveM: number;
    }>;
    /**
     * The first `n` live particles read back: tip and root positions, age,
     * life, strand length, height above the water, root strength and drop
     * size. A debugging aid: the strand draw is otherwise a black box.
     */
    dump(renderer: THREE.WebGPURenderer, n?: number): Promise<Array<Record<string, number | number[]>>>;
    /**
     * The spray's update dispatch alone, saturating: `iters` consecutive
     * steps enqueued with no render between, one fence, ms per step. The
     * sea is not re-stepped, as in a live frame. The steps are consumed
     * (the cursor moves on), so a pinned capture after this must re-pin.
     */
    benchStep(renderer: THREE.WebGPURenderer, iters?: number): Promise<number>;
    /**
     * The clear kernel the same way: plain writes per particle and no
     * reads, so its time is the per-call floor (submission, binding, a
     * near-empty dispatch). `benchStep - benchClear` is the update kernel's
     * own GPU time. Kills every particle; call it last.
     */
    benchClear(renderer: THREE.WebGPURenderer, iters?: number): Promise<number>;
    /**
     * The update and clear kernels in BATCHES: `batch` dispatches of one
     * kernel in one compute pass (one submit), fenced, `reps` times, the
     * minimum ms per dispatch kept. One submit per batch takes the per-call
     * submission cost, which a contended GPU inflates to milliseconds, out
     * of the reading; what is left is the kernel's own throughput. Every
     * dispatch of a batch sees the same step index, which only matters for
     * the draws, not the time. Moves the cursor and kills every particle.
     */
    benchBatch(renderer: THREE.WebGPURenderer, batch?: number, reps?: number): Promise<{
      updateMs: number; clearMs: number;
    }>;
    /**
     * The seen deficit (`seenDeficit`, no gate) and the displaced world
     * point at each of `grid` (x, z pairs, meters), from the camera the
     * spray last synced to: [seen, worldX, worldY, worldZ] per point. The
     * check that births read the foam the surface draws: a capture script
     * projects the points and compares them with the foam mask.
     */
    seenAt(renderer: THREE.WebGPURenderer, camera: THREE.Camera, grid: Float32Array): Promise<Float32Array>;
  };
  /**
   * A fence: resolves when the GPU has drained everything enqueued so far.
   * Reads one particle buffer back, which forces the wait.
   */
  fence(renderer: THREE.WebGPURenderer): Promise<void>;
  /**
   * One live-frame step with no plan: advance the cursor by exactly one
   * fixed step at the given camera, dispatching the update kernel once. For
   * benches, where the sea is stepped by the caller.
   */
  stepOnce(renderer: THREE.WebGPURenderer, camera: THREE.Camera): void;
}

/**
 * Build the spray for a sea.
 *
 * @param field the sea the spray breaks off. Its normal planes are read for
 *              the drawn foam and its displacement planes for the crest,
 *              every step; its cascades give the wind.
 */
export function createOceanSpray(
  field: OceanField,
  opts: OceanSprayOptions = {},
): OceanSpray {
  const count = opts.count ?? 16384;
  log2Exact(count);
  const bufs = field.buffers;
  log2Exact(bufs.n);
  const cascades = field.cascades;
  const wind = sprayWindFromCascades(cascades);
  const windFactor = sprayWindFactor(wind.speedMs);
  const sunDir = (opts.sunDir ?? OCEAN_SUN_DIR).clone().normalize();
  // A constant 0 when no sky node is given: the fair-weather look is kept
  // for every caller that does not pass one.
  const uOvercast: TslNode = opts.overcast ?? float(0);

  /* --- buffers ------------------------------------------------------ */

  // pos: xyz world meters of the drops, the strand's downwind TIP; w age
  //      in seconds.
  // vel: xyz m/s, w life in seconds; life <= 0 is a dead slot.
  // src: xyz world meters of the strand's ROOT, the drawn whitecap point the
  //      drops left; w the drag relaxation time of this particle's drops,
  //      seconds (their size).
  // rgr: xy the root's GRID coordinate (undisplaced XZ). The fields are
  //      indexed by it, so the root's foam is read there directly, with no
  //      inversion of the displacement: at a fold that inversion is
  //      many-to-one and lands off the crest. The world root in `src` is
  //      grid plus the displacement read there. z the PLUME seed, 0 to 1,
  //      one value for every strand born in the same 4 m cell of water, so
  //      the strands of one whitecap share a break length and a density and
  //      two whitecaps differ (SPRAY_PLUME_CELL_M). w unused.
  // aux: x height of the tip above the surface, y size seed, z root
  //      strength (1 while drawn foam is under the root, running down to 0
  //      over SPRAY_ORPHAN_S when it is not), w the step the particle was
  //      born on (for the census).
  const pos = instancedArray(count, 'vec4');
  const vel = instancedArray(count, 'vec4');
  const src = instancedArray(count, 'vec4');
  const rgr = instancedArray(count, 'vec4');
  const aux = instancedArray(count, 'vec4');
  // tint: rgb the strand's veil radiance (see the light, below), computed
  // by the update kernel once a step for each live strand; w unused.
  const tint = instancedArray(count, 'vec4');

  /* --- uniforms ------------------------------------------------------ */

  const uDt = uniform(SPRAY_DT_S);
  const uStep = uniform(0);
  const uWindDir = uniform(new THREE.Vector2(Math.cos(wind.dirRad), Math.sin(wind.dirRad)));
  const uWindSpeed = uniform(wind.speedMs);
  const uCrestSpeed = uniform(wind.crestSpeedMs);
  const uRate = uniform(windFactor);
  const uSun = uniform(sunDir);
  // The view the drawn foam is judged from: the camera position, its
  // heading on the water (radians from +X toward +Z) and the angle of one
  // framebuffer row, radians. The footprint of the seen deficit and the
  // emission wedge read these; the ribbons' pixel floor reads the inverse.
  const uCam = uniform(new THREE.Vector3(0, 12, 0));
  const uHeading = uniform(-Math.PI / 2);
  const uRadPerPx = uniform((2 * Math.tan((50 / 2) * Math.PI / 180)) / 900);
  const uPxPerRad = uniform(900 / (2 * Math.tan((50 / 2) * Math.PI / 180)));
  // The patch center the surface's range fades measure from.
  const uCenter = uniform(new THREE.Vector2(0, 0));

  /* --- sampling the sea, as the surface samples it ------------------ */

  // The one shared read of a cascade plane (oceanSampler.ts): the same
  // bilinear read and the same range fade the surface uses.
  const sampler = createOceanSampler(bufs, uCenter);

  /**
   * The summed displacement at a grid XZ: (dispX, height, dispZ), each
   * cascade faded on its DISPLACEMENT range, the geometry the mesh really
   * carries, so a root sits on the crest that is drawn.
   */
  const surfaceAt = (grid: TslNode): TslNode => {
    let acc: TslNode = vec3(0, 0, 0);
    for (let ci = 0; ci < cascades.length; ci += 1) {
      const c = cascades[ci];
      const d = sampler.sampleCascade(sampler.disp, grid, ci, c.patchM);
      acc = acc.add(d.xyz.mul(sampler.cascadeLod(grid, c.dispLod)));
    }
    return acc;
  };

  /**
   * The height of the foam-driving cascades alone at a grid XZ, meters: the
   * wind sea and its ripples, the swell left out. This is the wave the
   * spray's crest belongs to; the reach of the lip updraft reads it.
   */
  const foamHeightAt = (grid: TslNode): TslNode => {
    let h: TslNode = float(0);
    for (let ci = 0; ci < cascades.length; ci += 1) {
      const c = cascades[ci];
      if (!c.drivesFoam) continue;
      h = h.add(sampler.sampleCascade(sampler.disp, grid, ci, c.patchM).y.mul(sampler.cascadeLod(grid, c.dispLod)));
    }
    return h;
  };

  /**
   * The range fade the surface puts on a foam cascade's deficit: its
   * `normalLod` stretched by SPRAY_NORMAL_RANGE_SCALE, measured from the
   * patch center, with the lod's floor.
   */
  const foamRange = (grid: TslNode, c: CascadeParams): TslNode => {
    const r = grid.sub(uCenter).length();
    const k = float(1).sub(smoothstep(
      float(c.normalLod.startM * SPRAY_NORMAL_RANGE_SCALE), float(c.normalLod.endM * SPRAY_NORMAL_RANGE_SCALE), r,
    ));
    return k.mul(float(1 - c.normalLod.floor)).add(float(c.normalLod.floor));
  };

  /**
   * THE SEEN DEFICIT at a grid XZ: the fold deficit the surface's foam mask
   * sees there from the current camera. For each foam cascade, the mean of
   * SPRAY_SEEN_TAPS reads of its Jacobian spread along the long axis of the
   * pixel footprint (the surface reads the same span from its mip), times
   * its NORMAL range fade and its footprint fade `fit`, summed as the
   * surface sums them. The footprint is `sprayFootprintLongM` on flat water,
   * and its long axis is the radial direction from the camera, which is the
   * longer screen derivative for any view that looks down at the water.
   */
  const seenDeficit = (grid: TslNode): TslNode => {
    const rel = grid.sub(vec2(uCam.x, uCam.z));
    const rangeM = max(rel.length(), float(0.01));
    const alongDir = rel.div(rangeM);
    const h = max(uCam.y, float(1));
    const longM = uRadPerPx.mul(rangeM.mul(rangeM).add(h.mul(h))).div(h).toVar();
    const footLog = log2(longM);
    let d: TslNode = float(0);
    for (let ci = 0; ci < cascades.length; ci += 1) {
      const c = cascades[ci];
      if (!c.drivesFoam) continue;
      const fit = float(1).sub(smoothstep(
        float(Math.log2(c.cutoffHighM / 96)), float(Math.log2(c.cutoffHighM / 4)), footLog,
      ));
      let jSum: TslNode = float(0);
      for (let t = 0; t < SPRAY_SEEN_TAPS; t += 1) {
        const along = (t + 0.5) / SPRAY_SEEN_TAPS - 0.5;
        const at = grid.add(alongDir.mul(longM.mul(float(along))));
        jSum = jSum.add(sampler.sampleCascade(sampler.norm, at, ci, c.patchM).z);
      }
      const jMean = jSum.mul(float(1 / SPRAY_SEEN_TAPS));
      d = d.add(float(1).sub(jMean).mul(fit).mul(foamRange(grid, c)));
    }
    return d;
  };

  /**
   * The seen deficit behind a one-read gate (SPRAY_SEEN_GATE): one read of
   * each foam cascade at the point itself, faded the same way, and only if
   * that passes the gate the full SPRAY_SEEN_TAPS reads. Over 97% of the
   * points a step tests are open water, and the gate spends a quarter of
   * the reads on each of them.
   */
  const seenGated = (grid: TslNode): TslNode => {
    const rel = grid.sub(vec2(uCam.x, uCam.z));
    const rangeM = max(rel.length(), float(0.01));
    const h = max(uCam.y, float(1));
    const footLog = log2(uRadPerPx.mul(rangeM.mul(rangeM).add(h.mul(h))).div(h));
    let quick: TslNode = float(0);
    for (let ci = 0; ci < cascades.length; ci += 1) {
      const c = cascades[ci];
      if (!c.drivesFoam) continue;
      const fit = float(1).sub(smoothstep(
        float(Math.log2(c.cutoffHighM / 96)), float(Math.log2(c.cutoffHighM / 4)), footLog,
      ));
      const j = sampler.sampleCascade(sampler.norm, grid, ci, c.patchM).z;
      quick = quick.add(float(1).sub(j).mul(fit).mul(foamRange(grid, c)));
    }
    const out = float(0).toVar();
    If(quick.greaterThan(float(SPRAY_SEEN_GATE)), () => {
      out.assign(seenDeficit(grid));
    });
    return out;
  };

  /**
   * THE VEIL: the radiance a thin strand of drops at world point `at` sends
   * toward the camera. Drops of 0.1 to 1 mm scatter forward (Mie, g near
   * 0.85), so what a thin veil sends to the eye is mostly the light from
   * behind it along the view: the sky over the drop, 0.85, and the sea
   * below, 0.15, which is its dark body plus the 2% Fresnel of the sky at
   * normal incidence (n = 1.33). The forward lobe is some 30 degrees wide,
   * so it takes in the low sky behind the drop and the deck above it, half
   * each. Under the deck that veil is a cool sky-gray, lighter than the
   * water and never warmer than the sky. The round-2 veil weighted sky and
   * sea evenly and was darker than the sky; the reference streak's core is
   * lighter than the deck. In fair weather the sun is forward-scattered by
   * a Henyey-Greenstein lobe, g = 0.55, scaled by (1 - overcast): there is
   * no sun under a deck. The sea body colors are the mean of the trough and
   * crest values `oceanSurface.ts` uses (copied; that file does not export
   * them).
   *
   * It is evaluated in the update kernel, once a step for each live strand,
   * and read by the ribbon as a buffer. Evaluated in the ribbon's vertex
   * shader it ran two sky functions on every vertex of every slot, dead
   * ones included, and the ribbon cost 1.5 ms of draw (perfBatch.mjs, r4g).
   */
  const veilAt = (at: TslNode): TslNode => {
    const viewDir = normalize(uCam.sub(at));
    const behind = normalize(vec3(viewDir.x.negate(), float(0.08), viewDir.z.negate()));
    const zenith = oceanSkyRadiance(vec3(0, 1, 0), uSun, 0, uOvercast);
    const skyFwd = mix(oceanSkyRadiance(behind, uSun, 0, uOvercast), zenith, float(0.5));
    const seaBody = mix(vec3(0.036, 0.138, 0.168), vec3(0.013, 0.030, 0.036), uOvercast);
    const seaUp = seaBody.add(zenith.mul(float(0.02)));
    const cosSun = dot(uSun.negate(), viewDir);
    const g = 0.55;
    const hg = float((1 - g * g) / (4 * Math.PI))
      .div(pow(float(1 + g * g).sub(cosSun.mul(float(2 * g))), float(1.5)));
    const sunE = float(6).mul(float(1).sub(uOvercast));
    return mix(seaUp, skyFwd, float(0.85)).add(vec3(1.0, 0.97, 0.92).mul(sunE.mul(hg)));
  };

  /* --- the clear kernel ---------------------------------------------- */

  const clearKernel = Fn(() => {
    const i = instanceIndex;
    pos.element(i).assign(vec4(0, 0, 0, 0));
    vel.element(i).assign(vec4(0, 0, 0, 0));
    src.element(i).assign(vec4(0, 0, 0, 0));
    rgr.element(i).assign(vec4(0, 0, 0, 0));
    aux.element(i).assign(vec4(0, 0, 0, 0));
    tint.element(i).assign(vec4(0, 0, 0, 0));
  })().compute(count);

  /* --- the update kernel --------------------------------------------- */

  const updateKernel = Fn(() => {
    const i = instanceIndex;
    const p = pos.element(i).toVar();
    const v = vel.element(i).toVar();
    const sr = src.element(i).toVar();
    const rg4 = rgr.element(i).toVar();
    const rg = vec2(rg4.x, rg4.y).toVar();
    const a = aux.element(i).toVar();
    const dt = uDt;
    const stepU = uint(uStep);
    const windXZ = vec3(uWindDir.x, float(0), uWindDir.y).toVar();
    const wind2 = vec2(uWindDir.x, uWindDir.y).toVar();
    // Every draw is a hash of (particle, step), so a restart at the same
    // target replays the same draws.
    const seed = i.mul(uint(16)).add(stepU.mul(uint(2654435761))).toVar();
    const r = (k: number) => hash(seed.add(uint(k)));

    If(v.w.greaterThan(float(0)), () => {
      // --- alive: drift, fall, hold the root on its whitecap -----------
      const age = p.w.add(dt).toVar();

      // The surface under the tip. The fields are indexed by the undisplaced
      // grid coordinate; one correction step backs the world XZ out of the
      // horizontal displacement, which is several meters on a storm crest.
      const s0 = surfaceAt(vec2(p.x, p.z));
      const grid = vec2(p.x, p.z).sub(vec2(s0.x, s0.z)).toVar();
      const s1 = surfaceAt(grid).toVar();
      const hAbove = p.y.sub(s1.y).toVar();

      // THE ROOT HOLDS ON DRAWN FOAM. It stays where it is (SPRAY_ROOT_SPEED_MS
      // is 0, measured), and when the drawn foam under it clears it tries a
      // ring of SPRAY_REROOT_TAPS points SPRAY_REROOT_M out and hops to the
      // one with the most drawn foam, if that one holds. The ring starts at
      // a random angle each step so no direction is preferred.
      const rgNew = rg.add(wind2.mul(float(SPRAY_ROOT_SPEED_MS).mul(dt))).toVar();
      const held = seenGated(rgNew).toVar();
      If(held.lessThan(float(SPRAY_SEEN_HOLD)), () => {
        const best = float(-1).toVar();
        const bestAt = vec2(rgNew).toVar();
        const a0 = r(5).mul(float(2 * Math.PI));
        for (let k = 0; k < SPRAY_REROOT_TAPS; k += 1) {
          const ang = a0.add(float((k * 2 * Math.PI) / SPRAY_REROOT_TAPS));
          const q = rgNew.add(vec2(cos(ang), sin(ang)).mul(float(SPRAY_REROOT_M))).toVar();
          const d = seenGated(q).toVar();
          If(d.greaterThan(best), () => {
            best.assign(d);
            bestAt.assign(q);
          });
        }
        // The hop is taken only onto foam at about the root's own height
        // (SPRAY_REROOT_DH_M): the strand is a straight line from the root
        // to drops that left the old spot, and a root that dropped into the
        // trough beside its crest tilted that line up into a spike.
        If(best.greaterThanEqual(float(SPRAY_SEEN_HOLD)), () => {
          const hBest = surfaceAt(bestAt).y;
          If(abs(hBest.sub(sr.y.sub(float(SPRAY_ROOT_LIFT_M)))).lessThan(float(SPRAY_REROOT_DH_M)), () => {
            rgNew.assign(bestAt);
            held.assign(best);
          });
        });
      });
      const holds = held.greaterThanEqual(float(SPRAY_SEEN_HOLD)).toVar();

      // The air: U10 on the log profile of height, plus the lip updraft,
      // plus coherent gusts. The gust field is a noise volume frozen into
      // the wind and carried at 0.8 U10 (Taylor's hypothesis: eddies move
      // with the mean wind at their height), with eddies of about 33 m, the
      // size of a whole plume, so a plume's strands wander together. 18% of
      // U10 is the turbulence intensity over open water near the surface,
      // along the wind. The vertical rms is split between these large eddies
      // and the small ones below (SPRAY_EDDY_W).
      const prof = clamp(log(max(hAbove, float(0.05)).mul(float(1000))).div(float(Math.log(10 / 1e-3))), float(0.3), float(1));
      const airSpeed = uWindSpeed.mul(prof).toVar();
      // The lip updraft (SPRAY_LIP_SLOPE), dying away with the drop's
      // distance from the lip over the crest's height, SPRAY_LIP_MIN_M at
      // the least. The distance is the air's run since birth, air speed
      // times age, and not the distance to the current root: a root that
      // hopped a meter downwind toward its tip put a young drop back "at the
      // lip", and its strand stood up at 36 degrees (capture r3g).
      const hFoamRoot = foamHeightAt(rgNew);
      const fromRoot = airSpeed.mul(age);
      const lipL = max(hFoamRoot, float(SPRAY_LIP_MIN_M));
      // The lip's slope varies with the crest's local steepness: 0.7 to 1.3
      // of SPRAY_LIP_SLOPE per strand, which fans a plume's strands up and
      // down a few degrees more. From 0.5 to 1.5 the steepest strands of a
      // plume climbed to 4 m within a second and drew long bright needles
      // across it (capture r3p).
      const lipK = float(0.7).add(fract(a.y.mul(float(2.9))).mul(float(0.6)));
      const lipUp = airSpeed.mul(float(SPRAY_LIP_SLOPE)).mul(lipK).mul(exp(fromRoot.negate().div(lipL)));
      // The small eddies (SPRAY_EDDY_W): one vertical speed per particle,
      // held for its life, uniform with the given rms. Both eddy sizes are
      // damped under a meter (SPRAY_EDDY_FLOOR_M): the water is a wall the
      // air cannot move through, and an eddy is no taller than its height
      // above it.
      const wallDamp = clamp(hAbove.div(float(SPRAY_EDDY_FLOOR_M)), float(0.25), float(1));
      const eddyW = uWindSpeed.mul(float(SPRAY_EDDY_W * Math.sqrt(3)))
        .mul(fract(a.y.mul(float(7.31))).mul(float(2)).sub(float(1))).mul(wallDamp);
      // The lateral small eddy (SPRAY_EDDY_V), across the wind, the same way.
      const eddyV = uWindSpeed.mul(float(SPRAY_EDDY_V * Math.sqrt(3)))
        .mul(fract(a.y.mul(float(13.7))).mul(float(2)).sub(float(1)));
      // The lee rise (SPRAY_LEE_RISE) on top of the lip updraft.
      const rise = lipUp.add(airSpeed.mul(float(SPRAY_LEE_RISE))).add(eddyW);
      const air = vec3(
        windXZ.x.mul(airSpeed).sub(windXZ.z.mul(eddyV)),
        rise,
        windXZ.z.mul(airSpeed).add(windXZ.x.mul(eddyV)),
      ).toVar();
      const gustSeed = p.xyz.sub(windXZ.mul(uWindSpeed.mul(float(0.8)).mul(float(uStep).mul(dt)))).mul(float(0.03));
      const gust = mx_noise_vec3(gustSeed).mul(uWindSpeed.mul(float(0.18)))
        .mul(vec3(float(1), float(SPRAY_EDDY_W / 0.18).mul(wallDamp), float(1)));

      // Drag toward the air, then gravity. The blend is 1 - exp(-dt / tau)
      // for THIS particle's drops (`sprayDragK` on the CPU is the same
      // formula). At equilibrium the vertical speed is -g tau, the drop's
      // terminal speed, so nothing here is tuned twice.
      const k = float(1).sub(exp(dt.negate().div(max(sr.w, float(1e-3)))));
      const vNew = mix(v.xyz, air.add(gust), k).toVar();
      vNew.y.subAssign(float(GRAVITY_MS2).mul(dt));
      const pNew = p.xyz.add(vNew.mul(dt)).toVar();
      const hNew = pNew.y.sub(s1.y).toVar();
      // A tip that meets the water has landed: its drops are back in the
      // sea. It rests on the surface, and the strand fades as an orphan.
      // Kept as a variable: `hNew` is overwritten just below.
      const landed = hNew.lessThan(float(0)).toVar();
      If(landed, () => {
        pNew.y.assign(s1.y.add(float(0.02)));
        vNew.y.assign(max(vNew.y, float(0)));
        hNew.assign(float(0.02));
      });

      // The world root: grid plus the displacement read there, a hand above
      // the surface.
      const r1 = surfaceAt(rgNew).toVar();
      // Each strand leaves its own height of the lip's spume cloud, from a
      // hand over the foam up to SPRAY_LIP_THROW_M more, most of them low.
      const throwU = fract(a.y.mul(float(6.1)));
      const rootLift = float(SPRAY_ROOT_LIFT_M - SPRAY_ROOT_SINK_M).add(throwU.mul(throwU).mul(float(SPRAY_LIP_THROW_M)));
      // The root follows the water at its spot, up and down. (Two limits on
      // a root whose water falls away as a crest passes were tried: ending
      // the feed once it had fallen 0.35 m ended most of the judged crop's
      // main plume, capture r3v, and holding the drawn root at that depth
      // shortened the plume's rising streaks into puffs at the roots, r3w.
      // The rising streaks are what the preview critics read as spindrift
      // torn off and carried, r3n to r3s.)
      const rootWorld = vec3(rgNew.x.add(r1.x), r1.y.add(rootLift), rgNew.y.add(r1.z));

      // The strength rises back over SPRAY_REGAIN_S while drawn foam is
      // under the root, the tip is airborne and the break has not run past
      // SPRAY_BREAK_MAX_S, and runs down over SPRAY_ORPHAN_S otherwise. The
      // ribbon scales its opacity by it.
      // The break's length for this plume: SPRAY_BREAK_MAX_S times 0.55 to
      // 1.45 by the plume seed, so plumes differ in length.
      const breakS = float(SPRAY_BREAK_MAX_S).mul(float(0.55).add(rg4.z.mul(float(0.9))));
      const feeds = holds.and(landed.not()).and(age.lessThan(breakS));
      const gain = select(feeds, dt.div(float(SPRAY_REGAIN_S)), dt.negate().div(float(SPRAY_ORPHAN_S)));
      const strength = clamp(a.z.add(gain), float(0), float(1)).toVar();

      const dead = age.greaterThanEqual(v.w).or(strength.lessThanEqual(float(0)));
      p.assign(vec4(pNew, age));
      v.assign(vec4(vNew, select(dead, float(0), v.w)));
      sr.assign(vec4(rootWorld, sr.w));
      tint.element(i).assign(vec4(veilAt(rootWorld.add(pNew).mul(float(0.5))), float(0)));
      rg4.assign(vec4(rgNew, rg4.z, rg4.w));
      a.assign(vec4(hNew, a.y, strength, a.w));
    }).Else(() => {
      // --- dead: try to be born on a drawn whitecap ---
      // A point of the emission wedge: range uniform from NEAR to FAR,
      // bearing within HALF_ANGLE of the camera's heading.
      // SPRAY_EMIT_TRIES candidates are tried in turn and the first that
      // passes is taken. Each draw is a point of the emission wedge: a
      // bearing within HALF_ANGLE of the camera's heading and a range
      // uniform over the wedge's area (the square root of a uniform draw
      // between NEAR^2 and FAR^2).
      const found = float(0).toVar();
      const pick = vec2(0, 0).toVar();
      const draws: Array<[number, number, number]> = [[0, 1, 2], [10, 11, 12], [13, 14, 15]];
      for (let t = 0; t < SPRAY_EMIT_TRIES; t += 1) {
        const [kAng, kRad, kChance] = draws[t];
        If(found.lessThan(float(0.5)), () => {
          const ang = uHeading.add(r(kAng).mul(float(2)).sub(float(1)).mul(float(SPRAY_EMIT_HALF_ANGLE_RAD)));
          const rad = sqrt(mix(float(SPRAY_EMIT_NEAR_M * SPRAY_EMIT_NEAR_M), float(SPRAY_EMIT_FAR_M * SPRAY_EMIT_FAR_M), r(kRad)));
          const cand = vec2(uCam.x, uCam.z).add(vec2(cos(ang), sin(ang)).mul(rad)).toVar();
          const seen = seenGated(cand);
          const chance = smoothstep(float(SPRAY_SEEN_BORN), float(SPRAY_SEEN_FULL), seen).mul(uRate);
          If(r(kChance).lessThan(chance), () => {
            found.assign(float(1));
            pick.assign(cand);
          });
        });
      }

      If(found.greaterThan(float(0.5)), () => {
        const cand = pick;
        // Born at the displaced crest, a hand above the water. Root and tip
        // start at the same point; the strand grows as they part.
        const s = surfaceAt(cand).toVar();
        const born = vec3(cand.x.add(s.x), s.y.add(float(0.15)), cand.y.add(s.z));
        // Leaves with the crest's forward speed and a jet upward: the
        // crest's own vertical speed, a omega = (Hs / 2)(2 pi / T) = 1.2 m/s
        // for the storm wind sea (Hs 2.3 m, T 6.2 s), from 0.8 to 2.0 m/s.
        // Coarse spume rises a few tenths of a meter before drag takes over;
        // fine mist gives it up within a step and rides the air. Round 2
        // launched at 1.2-3.4 m/s, and the young strands stood up as bright
        // spikes of 30 degrees and more on screen (capture r3e).
        const v0 = windXZ.mul(uCrestSpeed.mul(float(0.6).add(r(3).mul(float(0.6)))))
          .add(vec3(0, 1, 0).mul(float(0.8).add(r(4).mul(float(1.2)))));
        // Drop size over SPRAY_DROP_TAU_MIN_S..MAX_S, log in tau, and the
        // life it sets: the coarsest drops get SPRAY_LIFE_MIN_S, the finest
        // SPRAY_LIFE_MAX_S. The draw is squared: a particle stands for a
        // COUNT of drops, and spume drop spectra (Andreas 1998) fall steeply
        // with size, so the count is in the fine end though the volume is
        // in the coarse. Squaring puts three particles in four under a
        // 0.1 s tau (0.35 mm).
        const u = r(9);
        const sizeR = u.mul(u);
        const tau = float(SPRAY_DROP_TAU_MIN_S)
          .mul(pow(float(SPRAY_DROP_TAU_MAX_S / SPRAY_DROP_TAU_MIN_S), sizeR));
        const life = float(SPRAY_LIFE_MAX_S).sub(sizeR.mul(float(SPRAY_LIFE_MAX_S - SPRAY_LIFE_MIN_S)));
        p.assign(vec4(born, float(0)));
        v.assign(vec4(v0, life));
        sr.assign(vec4(born, tau));
        // The plume seed: a hash of the 4 m cell the strand is born in.
        const cell = floor(cand.div(float(SPRAY_PLUME_CELL_M)));
        const plume = fract(sin(dot(cell, vec2(12.9898, 78.233))).mul(float(43758.5453)));
        rg4.assign(vec4(cand, plume, float(0)));
        a.assign(vec4(float(0.15), r(7), float(1), uStep));
      });
    });

    pos.element(i).assign(p);
    vel.element(i).assign(v);
    src.element(i).assign(sr);
    rgr.element(i).assign(rg4);
    aux.element(i).assign(a);
  })().compute(count);

  /* --- the ribbons --------------------------------------------------- */

  const material = new THREE.MeshBasicNodeMaterial();
  material.transparent = true;
  material.depthWrite = false;
  material.depthTest = true;
  material.blending = THREE.NormalBlending;
  material.fog = false;
  // The ribbon is built to face the camera, but its winding flips with the
  // strand's direction on screen; both faces are drawn.
  material.side = THREE.DoubleSide;

  const aPos = pos.toAttribute();
  const aVel = vel.toAttribute();
  const aSrc = src.toAttribute();
  const aAux = aux.toAttribute();
  const aRgr = rgr.toAttribute();
  const aTint = tint.toAttribute();
  const life = aVel.w;
  const ageFrac = clamp(aPos.w.div(max(life, float(1e-3))), float(0), float(1));
  const alive = life.greaterThan(float(0));

  // THE STRAND. A camera-facing RIBBON from a little upwind of the root on
  // the whitecap (SPRAY_LEAD_M) to the tip where the drops are now, so every
  // streamer begins in a whitecap and leans the way the wind carries it;
  // nothing is drawn that is not attached to drawn foam. Its centerline is
  // a quadratic curve that BOWS UP over the chord from root to tip: the
  // drops between them left the lip at different times, and each rose on
  // the lip updraft within its first wave height of run and then levelled
  // (SPRAY_LIP_SLOPE), so the streak of them arcs up off the crest and
  // runs on; a strand whose tip has fallen is an arc. Round 3 drew each
  // strand as one straight billboard at its middle, and every preview
  // critic, winning or losing, named flat "ruler-straight" strips lying on
  // the water with no curl off the crest (captures r3n to sp21). The
  // ribbon is built per vertex in world space, so a strand is foreshortened
  // correctly end to end, which a billboard at the middle was not. A
  // strand still at its root points along the wind.
  const root = aSrc.xyz;
  const tip = aPos.xyz;
  const seg = tip.sub(root);
  const lengthM = seg.length();
  const dir3 = normalize(seg.add(vec3(uWindDir.x, float(0), uWindDir.y).mul(float(0.02))));
  const lead = float(SPRAY_LEAD_M);
  const spanM = lengthM.add(lead);
  const mid = root.add(seg.mul(float(0.5)));
  // The filament: SPRAY_ACROSS_BIRTH_M thick at the root times a
  // per-particle factor of 0.4 to 1.8, skewed thin (most filaments are
  // threads, a few are puffs), widening at SPRAY_SPREAD per meter to its
  // tip. The ribbon is drawn at the tip's width; the fragment tapers it and
  // dilutes it (see below). A factor uniform in 0.5 to 1.5 drew even
  // strokes (capture r3k).
  const wSeed = fract(aAux.y.mul(float(5.3)));
  // An orphan puffs out as it fades: its drops disperse once no break
  // feeds them, so its width grows to 2.5 times as its strength runs down,
  // with the same drops spread wider (the dilution below conserves them).
  // The plume leaves a brief soft haze behind instead of a stroke that
  // switches off, which the critics asked for ("fade out raggedly, with a
  // faint mist haze left behind", capture r3q).
  const puff = float(1).add(float(1).sub(aAux.z).mul(float(1.5)));
  const across0 = float(SPRAY_ACROSS_BIRTH_M).mul(float(0.4).add(wSeed.mul(wSeed).mul(float(1.4)))).mul(puff);
  const wTip = across0.add(lengthM.mul(float(SPRAY_SPREAD)));
  // The pixel floor (see SPRAY_PX_FLOOR), from the same row angle the
  // footprint uses, at the strand's middle.
  const toCam = cameraPosition.sub(mid);
  const dist = toCam.length();
  const pxPerM = uPxPerRad.div(max(dist, float(0.5)));
  const floorM = float(SPRAY_PX_FLOOR).div(pxPerM);
  const acrossDrawn = max(wTip, floorM);

  // The bow. The lip lifted each drop by lipRise (1 - exp(-s / reach)) over
  // its first s of run, the same per-strand lip slope the update kernel
  // uses; at the middle of the strand that is above the chord by
  // `over`, and a quadratic curve's middle sits at half its control
  // point's offset, so the control point is raised by twice that. Capped
  // at a quarter of the strand's length, so a short strand is not a hoop.
  const lipK = float(0.7).add(fract(aAux.y.mul(float(2.9))).mul(float(0.6)));
  const lipRise = float(SPRAY_LIP_SLOPE * SPRAY_LIP_MIN_M).mul(lipK);
  const halfRun = vec2(seg.x, seg.z).length().mul(float(0.5));
  const arch = lipRise.mul(float(1).sub(exp(halfRun.negate().div(float(SPRAY_LIP_MIN_M)))));
  const over = max(arch.sub(seg.y.mul(float(0.5))), float(0));
  const bow = min(over.mul(float(2)), lengthM.mul(float(0.25)));
  const start = root.sub(dir3.mul(lead));
  const ctrl = root.add(seg.mul(float(0.5))).add(vec3(0, 1, 0).mul(bow));
  // Along the ribbon, u runs 0 at the upwind end to 1 at the tip. The lead
  // is the straight first part; past the root the curve runs root, ctrl,
  // tip. Across, v runs -0.5 to 0.5 on a side vector square to the curve
  // and to the view, at the tip's width.
  const u = positionGeometry.x.add(float(0.5));
  const v = positionGeometry.y;
  const uRoot = lead.div(max(spanM, float(1e-3)));
  const t = clamp(u.sub(uRoot).div(max(float(1).sub(uRoot), float(1e-3))), float(0), float(1));
  const omt = float(1).sub(t);
  const onCurve = root.mul(omt.mul(omt)).add(ctrl.mul(omt.mul(t).mul(float(2)))).add(tip.mul(t.mul(t)));
  const tangentCurve = ctrl.sub(root).mul(omt).add(tip.sub(ctrl).mul(t)).mul(float(2));
  const inLead = u.lessThan(uRoot);
  const centre = select(inLead, mix(start, root, u.div(max(uRoot, float(1e-4)))), onCurve);
  const tangent = normalize(select(inLead, dir3, tangentCurve.add(dir3.mul(float(1e-3)))));
  const side = normalize(cross(tangent, normalize(cameraPosition.sub(centre))).add(vec3(0, 1e-4, 0)));
  // THE DEPTH PULL. Each vertex is slid SPRAY_DEPTH_PULL_M toward the
  // camera along its own view ray, which leaves it where it is on screen
  // and moves only its depth. The root of a strand is a hand over a crest
  // that the mesh draws with a vertex every 0.5 to 3 m, and the lead runs
  // upwind down the crest's face, so without the pull the water hid the
  // heads of most strands and the plume floated off its whitecaps
  // (capture r4e, the first ribbon). The billboard before it drew the whole
  // strand at its middle's depth, which hid the same fault.
  const ribbon = centre.add(side.mul(v.mul(acrossDrawn))).toVar();
  // The pull grows with range (SPRAY_DEPTH_PULL_PER_M): the farther the
  // crest, the shallower the view grazes it, and the deeper its front face
  // stands in front of the spume over it.
  const pullM = float(SPRAY_DEPTH_PULL_M).add(dist.mul(float(SPRAY_DEPTH_PULL_PER_M)));
  const pulled = ribbon.add(normalize(cameraPosition.sub(ribbon)).mul(pullM));
  // THE WATER UNDER EACH VERTEX, for the soft bottom (SPRAY_SOFT_BOTTOM_M):
  // the ribbon's height over the sea, from the two water heights the strand
  // already knows, under its root (the root less its lift, the same draw
  // the update kernel makes) and under its tip (the tip less its stored
  // height over the water), interpolated along the strand. A strand spans a
  // tenth of a wind-sea wavelength, so the line between them is the wave
  // under it to a few centimeters; the ripple is left out. Reading the sea
  // at every vertex instead cost 24 storage reads on each of ten vertices of
  // all 16,384 slots, dead ones included, every frame.
  const throwU = fract(aAux.y.mul(float(6.1)));
  const rootLiftR = float(SPRAY_ROOT_LIFT_M - SPRAY_ROOT_SINK_M).add(throwU.mul(throwU).mul(float(SPRAY_LIP_THROW_M)));
  const waterY = mix(root.y.sub(rootLiftR), tip.y.sub(aAux.x), select(inLead, float(0), t));
  const vHWater = varying(ribbon.y.sub(waterY), 'vSprayHWater');
  // The unpulled world point, for the wind-aligned streaks (SPRAY_STREAK_M).
  const vWorld = varying(ribbon, 'vSprayWorld');
  // A dead slot collapses to a point far under the sea, which draws nothing.
  material.positionNode = select(alive, pulled, vec3(0, -1e4, 0));

  material.colorNode = Fn(() => {
    // Shape. `sM` is the distance from the root along the strand, meters:
    // -SPRAY_LEAD_M at the upwind end of the quad, 0 at the root, the
    // strand's length at the tip. The local width is the root's plus
    // SPRAY_SPREAD times the distance past the root, and the drops are
    // spread over it, so the density is the root's times the width ratio:
    // a wedge, dense and thin at the crest, wide and faint at the tip. The
    // head fades in over the lead, soft on the whitecap. The last part of
    // the strand fades as its oldest drops settle and spread. Across the
    // local width a soft ridge. The pixel floor is applied to the LOCAL
    // width: a thin root at distance is drawn at the floor width with its
    // opacity cut by the same ratio.
    const q = uv();
    const sM = q.x.mul(spanM).sub(lead).toVar();
    const past = max(sM, float(0));
    const wLocal = across0.add(past.mul(float(SPRAY_SPREAD)));
    // (A head wider than the thread, a "burst" tuft at the lip, was tried
    // and both preview critics picked the strands without it: the tufts
    // read as cotton-wool sprites that hid the sea, capture r3t.)
    const wDraw = max(wLocal, floorM);
    const cover = wLocal.div(wDraw);
    const acrossQ = q.y.sub(float(0.5)).mul(float(2)).mul(acrossDrawn).div(wDraw).toVar();
    const ridge = pow(clamp(float(1).sub(acrossQ.mul(acrossQ)), float(0), float(1)), float(1.5));
    // A strand that climbs STEEPLY spreads its drops over the height it
    // climbed: the lip and an updraft carried them up out of the plume's
    // layer, and a packet that rose faster than the plume's own slope is a
    // column, not a thread. Past a slope of SPRAY_STEEP_SLOPE its drops are
    // diluted by 1 / (1 + (slope - 0.2) / 0.1): a half at 0.3, a fifth at
    // 0.6. The steep strands are few, but drawn at full density they read as
    // "diagonal slashes... the stretched edges of sprite cards" to both
    // preview critics of capture r3u. (A dilution by the climb itself, not
    // its slope, took out the whole judged plume, whose strands climb 1 to
    // 2 m over 5 to 14 m: capture r3y.)
    const horizM = max(vec2(seg.x, seg.z).length(), float(0.05));
    const steep = max(tip.y.sub(root.y).div(horizM).sub(float(SPRAY_STEEP_SLOPE)), float(0));
    const dilute = across0.div(wLocal).div(puff).div(float(1).add(steep.div(float(0.1)))).toVar();
    const head = smoothstep(lead.negate(), float(0), sM);
    const tailFrac = past.div(max(lengthM, float(0.05)));
    // Fibers: a pattern stretched ALONG the strand (a cycle per 1.1 m) and
    // packed ACROSS it, seeded per particle and drifting with age, so each
    // filament breaks into wisps that run with the wind rather than into
    // blobs. Across, the pattern runs over the filament's TRUE width: a
    // filament drawn wider than itself at the pixel floor keeps one wisp
    // across, not a hatch of them.
    // Three sines with per-strand phases, not a noise: a 3D Perlin noise
    // here was 0.4 of the ribbon's 0.84 ms of draw (perfBatch.mjs, r4h),
    // and the ribbon's fragments are the spray's whole cost. The periods are
    // incommensurate (1.1 m, 2.7 m and a slant across the width), so the
    // pattern does not repeat along a strand, and overlapping strands carry
    // different phases.
    const acrossC = acrossQ.mul(cover);
    const nz = sin(sM.mul(float(5.65)).add(acrossC.mul(float(2.1))).add(aAux.y.mul(float(53))))
      .mul(float(0.5))
      .add(sin(sM.mul(float(2.3)).sub(acrossC.mul(float(4.3))).add(aAux.y.mul(float(29))).add(aPos.w.mul(float(1.3)))).mul(float(0.35)))
      .add(sin(acrossC.mul(float(7.9)).add(aAux.w.mul(float(0.013)))).mul(float(0.15)));

    // A filament thinner than the pixel floor cannot show its fibres: its
    // wisps average out to their mean, 0.65. Drawn at full contrast on a
    // 2.5 px line they read as a dashed, hatched needle (capture r3r).
    const wisp = mix(float(0.65), smoothstep(float(-0.55), float(0.3), nz), cover);
    // The fade runs the whole length of the strand, from the root, and its
    // end is RAGGED: the fibre pattern pushes the fade a quarter of the
    // length back and forth, so each filament ends at its own point. The
    // critics asked that each streak "fade gradually along its length
    // instead of staying one even grey" (r3n, where the fade began at 45%),
    // that the tails not "end cleanly" (r3q), and, with the fade from a
    // fifth of the way, still saw a streak "keep the same opacity for about
    // 200 px" (r4g).
    const tail = float(1).sub(smoothstep(float(0.3), float(1), tailFrac.add(nz.mul(float(0.25)))))
      .mul(exp(past.negate().div(float(SPRAY_FALLOFF_M))));
    // The soft bottom (SPRAY_SOFT_BOTTOM_M): wide and low over the root,
    // tighter past it.
    const softBottom = mix(
      smoothstep(float(-0.4), float(0.2), vHWater),
      smoothstep(float(-0.15), float(SPRAY_SOFT_BOTTOM_M), vHWater),
      smoothstep(float(0.3), float(SPRAY_SOFT_ROOT_M), past),
    );
    // The streaks (SPRAY_STREAK_M), in world space along the wind.
    const wind2f = vec2(uWindDir.x, uWindDir.y);
    const alongW = dot(vec2(vWorld.x, vWorld.z), wind2f)
      .sub(uWindSpeed.mul(float(0.7)).mul(float(uStep).mul(uDt)));
    const acrossW = dot(vec2(vWorld.x, vWorld.z), vec2(wind2f.y.negate(), wind2f.x));
    // The period is SPRAY_STREAK_M, doubled until it spans at least 6 px
    // (turbulent streaks exist at every scale; the eye sees the ones the
    // pixels resolve). The octave is whole, so the strands of one plume at
    // one range share it. The streaks tilt with the plume's mean rise
    // (SPRAY_LEE_RISE) so they run with the strands, not across them.
    const octave = max(ceil(log2(float(6).div(float(SPRAY_STREAK_M).mul(pxPerM)))), float(0));
    const kY = float((2 * Math.PI) / SPRAY_STREAK_M).div(exp2(octave));
    const yRun = vWorld.y.sub(alongW.mul(float(SPRAY_LEE_RISE)));
    const st1 = sin(yRun.mul(kY).add(acrossW.mul(kY.mul(float(0.3)))).add(sin(alongW.mul(float(0.29))).mul(float(1.7))));
    const st2 = sin(yRun.mul(kY.mul(float(1.78))).sub(acrossW.mul(kY.mul(float(0.45)))).add(alongW.mul(float(0.13))));
    const streakRaw = smoothstep(float(-0.35), float(0.75), st1.mul(float(0.6)).add(st2.mul(float(0.4))));
    const streak = mix(float(0.5), float(1.35), streakRaw);
    // Clumps: a second pattern, slow along the strand (a cycle per 3 m and
    // one per 7.5 m) and drifting with age, that thins the filament between
    // puffs, so a strand is a train of denser tufts and thinner thread, not
    // an even stroke.
    // Two sines, not a noise: the ribbon's fragments are the spray's cost.
    const clump = smoothstep(float(-0.45), float(0.45),
      sin(sM.mul(float(2.09)).add(aAux.y.mul(float(91)))).mul(float(0.55))
        .add(sin(sM.mul(float(0.83)).add(aAux.y.mul(float(17))).add(aPos.w.mul(float(1.9)))).mul(float(0.45))));
    // Each strand's own share of drops: 0.6 to 1.
    const share = float(0.6).add(fract(aAux.y.mul(float(3.7))).mul(float(0.4)));

    // Density in time: in over the first 0.25 s, out over the last quarter
    // of the life; the tip end fades as its drops settle onto the water;
    // the whole strand runs down with its root strength once its whitecap
    // has cleared.
    // A newborn filament is a point in the head the older filaments already
    // draw, and its direction is not yet the wind's: of the strands steeper
    // than 20 degrees on screen, 44 in 52 were under 0.25 s old (r3h), and
    // with a 0.12 s fade-in one drew a bright tick across its plume.
    const env = smoothstep(float(0), float(0.25), aPos.w)
      .mul(float(1).sub(smoothstep(float(0.75), float(1), ageFrac)));
    // The tip end also thins as it climbs: the drops in a plume thin out
    // with height (a mixing layer's concentration falls off its middle), so
    // a strand whose drops are 1.5 to 3.5 m over the water fades toward its
    // tip. (A fade on the climb over the root, 0.8 to 2 m, was tried; it
    // took the rising tails off the judged plume, and two of two preview
    // critics then saw "flat white decals lying on the water", captures
    // r3u and r3z. The slashes it was aimed at are the steep dilution's.)
    const tipW = smoothstep(float(0.5), float(1), tailFrac);
    const settle = mix(float(1), smoothstep(float(0), float(0.3), aAux.x), tipW)
      .mul(mix(float(1), float(1).sub(smoothstep(float(2.5), float(4.5), aAux.x)), tipW));
    // A strand at the lens would be a white card; fade the nearest 4 m.
    const near = smoothstep(float(1.5), float(4.0), dist);
    // The first meter carries the coarse spume, most of the plume's drop
    // mass, before it falls out (SPRAY_ROOT_MASS). Both preview critics of
    // capture r3s found the roots "too faint and even" and asked for the
    // spray to be densest where it tears loose.
    const rootMass = float(1).add(float(SPRAY_ROOT_MASS).mul(exp(past.negate().div(float(1)))));
    const alpha = ridge.mul(head).mul(tail).mul(dilute).mul(wisp).mul(env).mul(settle).mul(near).mul(rootMass)
      .mul(softBottom).mul(streak)
      .mul(cover).mul(aAux.z).mul(float(SPRAY_ALPHA))
      .mul(clump.mul(float(0.5)).add(float(0.5))).mul(share)
      // The plume's density: 0.7 to 1.15 by its seed, so a dense plume's
      // core can reach full cover where its strands overlap.
      .mul(float(0.7).add(aRgr.z.mul(float(0.45))));

    // Light. Near the root the spume is dense enough to scatter many times,
    // and an optically thick cloud of drops IS foam: it returns the light
    // the surface's whitecap returns, the same (0.86, 0.90, 0.92) at the
    // same 0.7 of diffuse sky plus 0.3 of sun that `oceanSurface.ts` gives
    // its foam (times SPRAY_HEAD_OF_FOAM), so the whitecap runs into the
    // head. Down the strand the drops thin to a single-scattering veil,
    // whose radiance the update kernel wrote into `tint` (see `veilAt`).
    const veil = aTint.xyz;
    const sunLit = clamp(uSun.y, float(0), float(1)).mul(float(1).sub(uOvercast));
    const foam = vec3(0.86, 0.90, 0.92).mul(float(0.7).add(sunLit.mul(float(0.3))))
      .mul(float(SPRAY_HEAD_OF_FOAM));
    // How much of the strand is foam-thick: all of it at the root, then an
    // e-fold every 2 m as the drops fall out and spread, and less as the
    // filament dilutes. The plume grades from the whitecap's white through
    // a light gray to the veil. A hard cut at 1.5 m drew the heads near the
    // camera as white dashes 60 to 90 px long (capture r3a); a cut at 0.8 m
    // left a dull gray smear behind every whitecap (r3b).
    const thick = dilute.mul(exp(past.negate().div(float(2))));
    const radiance = mix(veil, foam, thick);
    return vec4(radiance, clamp(alpha, float(0), float(1)));
  })();

  // Four segments along: enough for the bow to read as a curve at 50 m
  // (a 6 m strand is 100 px long there, 25 px a segment). Every slot runs
  // the vertex shader, dead ones included, so segments are not free.
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 4, 1), material);
  mesh.count = count;
  mesh.frustumCulled = false;
  // Draw after the water. The water is opaque, so this only orders the
  // transparent pass; it is here so a second transparent piece cannot land
  // under the spray by accident.
  mesh.renderOrder = 10;

  /* --- stepping -------------------------------------------------------- */

  let cursorStep: number | null = null;
  const lastCenter = new THREE.Vector2(Number.NaN, Number.NaN);
  let lastHeading = Number.NaN;
  // The last view's row angle over camera height (see sprayViewJumpM).
  let lastFootScale = Number.NaN;
  const fwd = new THREE.Vector3();
  const center = new THREE.Vector2();
  const bufSize = new THREE.Vector2();
  const probe: OceanSpray['probe'] = {
    count,
    windSpeedMs: wind.speedMs,
    windFactor,
    crestSpeedMs: wind.crestSpeedMs,
    cursorStep: null,
    lastSteps: 0,
    restarts: 0,
    // Filled in below, once `fence` and the kernels are in scope.
    benchStep: async () => { throw new Error('[ocean] spray benchStep not ready'); },
    benchClear: async () => { throw new Error('[ocean] spray benchClear not ready'); },
    benchBatch: async () => { throw new Error('[ocean] spray benchBatch not ready'); },
    seenAt: async () => { throw new Error('[ocean] spray seenAt not ready'); },
    async census(renderer) {
      const read = async (attr: THREE.BufferAttribute) => new Float32Array(
        await (renderer as unknown as {
          getArrayBufferAsync(a: unknown): Promise<ArrayBuffer>;
        }).getArrayBufferAsync(attr),
      );
      const vRaw = await read(vel.value as THREE.BufferAttribute);
      const aRaw = await read(aux.value as THREE.BufferAttribute);
      let alive = 0;
      let hSum = 0;
      const steps = new Set<number>();
      for (let k = 0; k < count; k += 1) {
        if (vRaw[k * 4 + 3] > 0) {
          alive += 1;
          hSum += aRaw[k * 4];
          steps.add(aRaw[k * 4 + 3]);
        }
      }
      return {
        alive,
        distinctSpawnSteps: steps.size,
        meanHeightAboveM: alive > 0 ? hSum / alive : 0,
      };
    },
    async dump(renderer, n = 12) {
      const read = async (attr: THREE.BufferAttribute) => new Float32Array(
        await (renderer as unknown as {
          getArrayBufferAsync(a: unknown): Promise<ArrayBuffer>;
        }).getArrayBufferAsync(attr),
      );
      const pRaw = await read(pos.value as THREE.BufferAttribute);
      const vRaw = await read(vel.value as THREE.BufferAttribute);
      const sRaw = await read(src.value as THREE.BufferAttribute);
      const aRaw = await read(aux.value as THREE.BufferAttribute);
      const out: Array<Record<string, number | number[]>> = [];
      for (let k = 0; k < count && out.length < n; k += 1) {
        if (vRaw[k * 4 + 3] <= 0) continue;
        const tip = [pRaw[k * 4], pRaw[k * 4 + 1], pRaw[k * 4 + 2]];
        const root = [sRaw[k * 4], sRaw[k * 4 + 1], sRaw[k * 4 + 2]];
        out.push({
          slot: k,
          ageS: pRaw[k * 4 + 3],
          lifeS: vRaw[k * 4 + 3],
          tip,
          root,
          alongM: Math.hypot(tip[0] - root[0], tip[1] - root[1], tip[2] - root[2]),
          hAboveM: aRaw[k * 4],
          strength: aRaw[k * 4 + 2],
          tauS: sRaw[k * 4 + 3],
          bornStep: aRaw[k * 4 + 3],
        });
      }
      return out;
    },
  };

  const dispatch = (renderer: THREE.WebGPURenderer, node: unknown) => {
    renderer.compute(node as Parameters<THREE.WebGPURenderer['compute']>[0]);
  };

  const fence = async (renderer: THREE.WebGPURenderer) => {
    await (renderer as unknown as {
      getArrayBufferAsync(a: unknown): Promise<ArrayBuffer>;
    }).getArrayBufferAsync(vel.value as THREE.BufferAttribute);
  };

  /**
   * Read the view into the uniforms: the camera position and heading for
   * the wedge and the footprint, the row angle from the field of view and
   * the framebuffer height (the surface's derivatives are per framebuffer
   * pixel), and the surface's patch center. Returns the heading.
   */
  const syncView = (renderer: THREE.WebGPURenderer, camera: THREE.Camera): number => {
    camera.getWorldDirection(fwd);
    const horiz = Math.hypot(fwd.x, fwd.z);
    // A camera looking straight down has no heading on the water; the wedge
    // then keeps the last one.
    const heading = horiz > 1e-3 ? Math.atan2(fwd.z, fwd.x) : (Number.isNaN(lastHeading) ? -Math.PI / 2 : lastHeading);
    const ax = horiz > 1e-3 ? fwd.x / horiz : 0;
    const az = horiz > 1e-3 ? fwd.z / horiz : 0;
    center.set(
      camera.position.x + ax * SPRAY_EMIT_AHEAD_M,
      camera.position.z + az * SPRAY_EMIT_AHEAD_M,
    );
    const fovDeg = (camera as THREE.PerspectiveCamera).fov ?? 50;
    renderer.getDrawingBufferSize(bufSize);
    const rows = bufSize.y > 0 ? bufSize.y : 900;
    const radPerPx = (2 * Math.tan((fovDeg / 2) * Math.PI / 180)) / rows;
    uRadPerPx.value = radPerPx;
    uPxPerRad.value = 1 / radPerPx;
    uCam.value.copy(camera.position);
    uHeading.value = heading;
    uCenter.value.copy(field.surface.center);
    return heading;
  };

  const stepOnce = (renderer: THREE.WebGPURenderer, camera: THREE.Camera) => {
    lastHeading = syncView(renderer, camera);
    lastFootScale = uRadPerPx.value / Math.max(camera.position.y, 1);
    lastCenter.copy(center);
    const s = cursorStep ?? 0;
    uStep.value = s;
    dispatch(renderer, updateKernel);
    cursorStep = s + 1;
    probe.cursorStep = cursorStep;
    probe.lastSteps = 1;
  };

  probe.benchStep = async (renderer, iters = 300) => {
    // Warm up: the first dispatch of a kernel compiles it.
    for (let i = 0; i < 10; i += 1) {
      uStep.value = (cursorStep ?? 0) + i;
      dispatch(renderer, updateKernel);
    }
    cursorStep = (cursorStep ?? 0) + 10;
    await fence(renderer);
    const t0 = performance.now();
    for (let i = 0; i < iters; i += 1) {
      uStep.value = (cursorStep ?? 0) + i;
      dispatch(renderer, updateKernel);
    }
    cursorStep = (cursorStep ?? 0) + iters;
    await fence(renderer);
    probe.cursorStep = cursorStep;
    return (performance.now() - t0) / iters;
  };

  probe.benchClear = async (renderer, iters = 300) => {
    for (let i = 0; i < 10; i += 1) dispatch(renderer, clearKernel);
    await fence(renderer);
    const t0 = performance.now();
    for (let i = 0; i < iters; i += 1) dispatch(renderer, clearKernel);
    await fence(renderer);
    // Everything is dead now; the next live step restarts and warms up.
    cursorStep = null;
    probe.cursorStep = null;
    return (performance.now() - t0) / iters;
  };

  // The seenAt probe: built on first use, sized to the largest request.
  let seenProbe: { n: number; inp: TslNode; out: TslNode; kernel: TslNode } | null = null;
  probe.seenAt = async (renderer, camera, grid) => {
    const n = grid.length / 2;
    if (!seenProbe || seenProbe.n < n) {
      const inp = instancedArray(n, 'vec2');
      const out = instancedArray(n, 'vec4');
      const kernel = Fn(() => {
        const g = inp.element(instanceIndex);
        const d = seenDeficit(g);
        const s = surfaceAt(g);
        out.element(instanceIndex).assign(vec4(d, g.x.add(s.x), s.y, g.y.add(s.z)));
      })().compute(n);
      seenProbe = { n, inp, out, kernel };
    }
    syncView(renderer, camera);
    const attr = seenProbe.inp.value as THREE.BufferAttribute;
    (attr.array as Float32Array).fill(0);
    (attr.array as Float32Array).set(grid);
    attr.needsUpdate = true;
    dispatch(renderer, seenProbe.kernel);
    const raw = await (renderer as unknown as {
      getArrayBufferAsync(a: unknown): Promise<ArrayBuffer>;
    }).getArrayBufferAsync(seenProbe.out.value as THREE.BufferAttribute);
    return new Float32Array(raw).slice(0, n * 4);
  };

  probe.benchBatch = async (renderer, batch = 32, reps = 7) => {
    const run = async (node: unknown) => {
      const list = new Array(batch).fill(node);
      dispatch(renderer, list);
      await fence(renderer);
      let best = Infinity;
      for (let k = 0; k < reps; k += 1) {
        uStep.value = (cursorStep ?? 0) + k;
        const t0 = performance.now();
        dispatch(renderer, list);
        await fence(renderer);
        best = Math.min(best, (performance.now() - t0) / batch);
      }
      return best;
    };
    const updateMs = await run(updateKernel);
    cursorStep = (cursorStep ?? 0) + reps;
    const clearMs = await run(clearKernel);
    cursorStep = null;
    probe.cursorStep = null;
    return { updateMs, clearMs };
  };

  return {
    mesh,
    count,
    wind,
    probe,
    fence,
    stepOnce,
    step(renderer, camera, simTimeS) {
      const heading = syncView(renderer, camera);
      const footScale = uRadPerPx.value / Math.max(camera.position.y, 1);
      const jump = Number.isNaN(lastCenter.x)
        ? Infinity
        : sprayViewJumpM(center.distanceTo(lastCenter), heading - lastHeading, footScale / lastFootScale);

      const plan = planSprayStep(cursorStep, simTimeS, jump);
      if (plan.restart) {
        dispatch(renderer, clearKernel);
        probe.restarts += 1;
      }
      if (plan.steps > 0) {
        lastCenter.copy(center);
        lastHeading = heading;
        lastFootScale = footScale;
      }
      let seaMoved = false;
      for (let k = 0; k < plan.steps; k += 1) {
        const s = plan.firstStep + k;
        // In a catch-up the sea is stepped to the step's own time every few
        // steps, so a spawn reads the crest that existed then. In a live
        // frame the sea is already at the frame's time, two steps ahead at
        // most. See SPRAY_SEA_RESTEP_EVERY for why not every step.
        if (spraySeaRestep(s, k, plan.steps)) {
          field.step(renderer, (s + 1) * SPRAY_DT_S);
          seaMoved = true;
        }
        uStep.value = s;
        dispatch(renderer, updateKernel);
      }
      // The viewer left the sea at the frame's time; put it back there.
      if (seaMoved) field.step(renderer, simTimeS);
      cursorStep = plan.firstStep + plan.steps;
      probe.cursorStep = cursorStep;
      probe.lastSteps = plan.steps;
    },
    dispose() {
      mesh.geometry.dispose();
      material.dispose();
    },
  };
}
