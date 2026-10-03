/**
 * @file oceanRainMath.ts — the CPU side of the rain: every number the rain
 * shaders use, computed once here so a unit test can check it.
 *
 * WHY A SEPARATE FILE. `oceanRain.ts` builds GPU objects and imports
 * `three/webgpu`. A test that imports it must start a renderer to reach a
 * function that only does arithmetic. So the arithmetic lives here, with no
 * three import, in the same way `oceanFftReference.ts` keeps the transform
 * testable without a GPU.
 *
 * WHAT THE NUMBERS ARE AND WHERE THEY CAME FROM. The reference is one frame
 * of Three.js Water Pro's storm preset at eye level, 1600x900
 * (`ref/demo/storm-away.png`), measured with a median high-pass and line
 * detection. Each default below cites the measurement it answers to. Values
 * with a physical source cite that too. Rounds 1 to 3 matched the
 * reference's streak brightness and lost anyway: both blind critics named
 * the reference's own streaks as flat (the same at every distance), so
 * from round 4 the target is the look the critics asked for, and physics
 * (a drop is a lens onto the whole sky; a lens blurs what is near it)
 * gives it.
 */

/** Rain parameters. Metric, internal. See `STORM_RAIN` for the reasoning. */
export interface OceanRainParams {
  /**
   * Number of streak instances in the box around the camera. Round 4 set
   * this by the look the critics asked for, not by a count of the
   * reference's streaks: "raise the count several-fold with each streak
   * fainter", "a dense fine-grain curtain". Most of the drops are far and
   * faint (see `farRefM`); they are the curtain, and the few mid-range
   * drops are the lines the eye picks out. `STORM_RAIN` states the value
   * and what it measured.
   */
  readonly dropCount: number;
  /**
   * Fall speed of the drops that show as streaks, m/s. Gunn and Kinzer
   * (1949) terminal velocities: 2 mm drop 6.5 m/s, 2.5 mm 7.4 m/s, 3 mm
   * 8.1 m/s. Only the large drops are visible as streaks, so 7.0 m/s.
   */
  readonly fallSpeedMs: number;
  /**
   * Horizontal drift of the drops, m/s, along `driftDirRad`. This sets the
   * slant. The reference streaks lean 19 to 22 degrees from vertical at the
   * left of the frame and stand vertical near the vanishing point, which is a
   * drift of tan(20 deg) * 7 m/s = 2.5 m/s. That is NOT the storm wind speed:
   * a 20 m/s wind would slant the rain 70 degrees, which reads as sideways
   * spray, and the reference does not do it either.
   */
  readonly driftMs: number;
  /** Drift heading, radians from +X toward +Z. Comes from the sea state's wind. */
  readonly driftDirRad: number;
  /**
   * Exposure time that sets the streak length, seconds. The on-screen
   * length is the drop's travel over the exposure, divided by the distance:
   * perspective alone makes a near streak long and a far one short, which
   * is the depth cue the round-2 critics missed ("they need to shrink and
   * fade with distance"). The reference's own streaks do not shrink.
   */
  readonly exposureS: number;
  /**
   * Streak width in world meters before the pixel floor. 3 mm, a large
   * drop. Only a drop inside 2.6 m is wider than one pixel; everything else
   * sits on the floor, as the reference's streaks do (measured width p50
   * 0.96 px, p90 1.28 px in its sky).
   */
  readonly dropWidthM: number;
  /**
   * Drops nearer than this fade in from nothing, meters. A drop a few
   * centimeters from the lens is not seen at all; the defocus term
   * (`cocPxM`) is what makes the near drops soft, and this only removes
   * the ones that would be a smear across half the frame.
   */
  readonly nearFadeM: number;
  /**
   * A second, denser population close to the eye, so the defocused near
   * drops that carry the sense of depth are not left to chance in the main
   * box. The box is centered a little ahead of the eye.
   */
  readonly nearBoxM: { readonly x: number; readonly y: number; readonly z: number };
  /** Share of `dropCount` in the near box, 0 to 1. */
  readonly nearFraction: number;
  /**
   * The width floor in pixels. Every reference streak is 1 px wide (measured
   * width p50 0.96 px, p90 1.28 px). A 1.15 px quad with a flat profile
   * measures about 1 px through the multisample.
   */
  readonly minWidthPx: number;
  /**
   * Range of the streaks, meters: the window that removes them closes
   * between here and 1.25 times here. Past `farRefM` the streaks are
   * already faint and short, so the window ends a curtain that has faded,
   * not a band of visible lines.
   */
  readonly fadeM: number;
  /**
   * The box the drops wrap in, meters, centered ahead of the camera. It
   * must be wider than the frustum out to the range where streaks are still
   * visible, or the frame's edges lose their far streaks and the rain reads
   * as a column. The depth is what the window needs and no more: with the
   * box a third of its depth ahead of the eye, the far face sits at 0.83 of
   * the depth, where the window has closed.
   */
  readonly boxM: { readonly x: number; readonly y: number; readonly z: number };
  /**
   * HOW A STREAK CHANGES THE PIXEL BEHIND IT. One draw, ordinary alpha
   * blending in the renderer's LINEAR frame buffer, before the ACES tone map
   * (the WebGPU renderer draws the scene into a half-float linear target
   * and tone-maps in its output pass):
   *
   *   result = background * (1 - a) + streakRadiance * a
   *
   * A drop is a wide-angle lens: what it shows is the storm's whole sky
   * and sea, averaged and inverted, so its radiance is one value whatever
   * is behind it. Against the sky it is close to the sky and barely shows;
   * against the dark sea it is brighter and shows more. That is the order
   * both round-2 critics asked for ("barely visible against the sky, pop
   * only against the dark water"). Rounds 1 to 3 got it backward or flat:
   * a blend toward a near-white color at alpha 0.35 drew bars on the sky,
   * and a proportional lens gain gave the same +16 over sky and sea.
   *
   * The numbers, through three.js' ACES fit and sRGB (the test checks
   * them): the 95 sRGB sky is 0.114 scene-linear and the 58 sRGB mid water
   * in the judged crop 0.060. At radiance 0.16 a mid-range streak (alpha
   * 0.49) reads +12 over the sky, +34 over that water and +4 over the 109
   * sRGB band just above the horizon, so the lines thin out into the
   * horizon haze; a far one (alpha 0.26) reads +6 over the sky.
   */
  readonly streakRadiance: readonly [number, number, number];
  /** Peak alpha of an in-focus drop at or inside `farRefM`. */
  readonly streakOpacity: number;
  /**
   * The lens's blur for near drops, pixels times meters: a drop at d meters
   * is blurred over `cocPxM / d` pixels (a lens focused on the far sea has a
   * circle of confusion that grows as one over the distance). The blur
   * widens the quad and divides its alpha by the same factor, so a near
   * drop is a long, soft, faint streak, not a bright bar. Round 2's critics
   * read the depth order backward because the near streaks were the
   * boldest; a real lens makes them the softest.
   */
  readonly cocPxM: number;
  /**
   * Past this distance, meters, a streak's alpha falls as
   * `(farRefM / d) ^ farExponent`. A far drop covers less of its pixel and
   * more rain lies between it and the eye, so it is fainter; the frustum
   * holds most of its drops far away, so these faint ones are the fine
   * curtain and the mid-range drops are the lines.
   */
  readonly farRefM: number;
  readonly farExponent: number;
  /**
   * Rain falls in sheets. The alpha of each drop is scaled by
   * `1 + gustDepth * n`, where n is a smooth noise in [-1, 1] on the drop's
   * horizontal position with a feature size of `gustScaleM`, carried along
   * by the drift. It is a function of position and time only, so it keeps
   * the rain pure in (seed, time). The reference's rain is one uniform
   * field, and both critics noted its streaks look the same everywhere.
   */
  readonly gustScaleM: number;
  readonly gustDepth: number;
  /**
   * In a sheet the drift is stronger: the streak's drift is scaled by
   * `1 + gustSlant * n` with the same noise n as `gustDepth`, so a dense
   * sheet also leans harder. Only the drawn direction changes, not the
   * field's motion; see `slantJitterMs`.
   */
  readonly gustSlant: number;
  /**
   * Per-drop turbulence in the drawn streak direction, m/s: each drop's
   * streak points along the mean velocity plus a horizontal jitter of up to
   * this much each way. At 7 m/s of fall, 0.6 m/s is a spread of about 5
   * degrees. The field itself still moves at one velocity, which is what
   * keeps its wrap exact; a drop crosses its own streak length in 1/30 s,
   * so a direction a few degrees off its motion does not show.
   */
  readonly slantJitterMs: number;
  /**
   * How much a blurred near drop is dimmed: alpha times
   * `(sharpPx / blurPx) ^ blurDimExponent`. 1 conserves the drop's light
   * exactly as the blur spreads it. Below 1 the near drops keep more of it:
   * both blind critics of round 4's first build asked for near drops
   * "longer, softer and brighter" than the far ones, and at 1 the near
   * drops fell under the far ones' contrast. Justified by the look, not by
   * optics; say so wherever it is changed.
   */
  readonly blurDimExponent: number;

  /* --- the murk: rain between the eye and everything far ------------- */

  /**
   * Extinction of the rain for rays that go UP, per meter. Koschmieder gives
   * beta = 3.912 / V for a contrast threshold of 2%; heavy rain has a
   * visibility V of 1.5 to 3 km. This one is set lower, 0.6e-3 (V = 6.5 km),
   * for one reason: the reference keeps its cloud deck legible down to the
   * horizon under a graded veil, and at 1.8e-3 the deck vanished into flat
   * murk below 25 degrees of elevation and the critics read a card with a
   * hard strip over the horizon. What the deck looks like through rain is
   * finally the sky module's to decide (the overcast state is routed); until
   * then this keeps the reference's gradient.
   */
  readonly hazeExtinctionPerM: number;
  /**
   * Extinction for rays that go DOWN onto the sea, per meter. 5e-3 (V =
   * 0.8 km). Measured on the reference water: 80% veiled 2.6 degrees below
   * the horizon and 50% at 8.7 degrees, which from a 10 m eye is 220 m and
   * 66 m of path. Only a torrential rate gives that from one extinction, and
   * the sky side cannot share it (see above), so the two are set apart and
   * said to be. Both critics named the missing sea veil first.
   */
  readonly hazeSeaExtinctionPerM: number;
  /**
   * Rain shafts in the murk: the extinction is scaled by `1 + shaftDepth * n`
   * with n a smooth noise on the horizontal view direction, so the far haze
   * has upright bands of denser and thinner rain instead of one even band.
   * `shaftFrequency` is the noise's radius on the unit circle of azimuth:
   * about 2 pi times it features around the horizon.
   */
  readonly shaftDepth: number;
  readonly shaftFrequency: number;
  /** Cloud base of the storm, meters. Nimbostratus sits at 300 to 600 m. */
  readonly hazeCloudBaseM: number;
  /** Longest rain path counted toward the sky, meters. */
  readonly hazeMaxPathM: number;
  /**
   * Longest rain path counted toward the sea, meters. 300, not the 11 km to
   * the horizon: the reference's far water ghosts through its veil (78 sRGB
   * at the horizon line with wave texture still in it, over an 84 haze),
   * and at 4 km the veil reached 100% over the top 60 rows of water and
   * drew what a critic called "a flat uniform gray slab that erases the far
   * sea". 300 m leaves 22% of the far water showing at the horizon.
   */
  readonly hazeSeaMaxPathM: number;
  /**
   * The murk's own color for rays that go UP into the sky, and for rays that
   * go DOWN onto the sea, scene-linear. Both measured on the reference at the
   * horizon: sky just above it (104, 101, 97) sRGB and (92 to 96) higher up,
   * water just below it (79, 77, 76) sRGB. Two colors keep the horizon a
   * readable line under full murk, as the reference does. The sky value is
   * what the viewer's ACES tone map turns into 96 sRGB; a first pass at 0.150
   * came out at 114, lighter than any part of the reference sky.
   */
  readonly hazeSkyColor: readonly [number, number, number];
  readonly hazeSeaColor: readonly [number, number, number];
  /**
   * The sky murk's color for rays that go well up, scene-linear; the murk
   * blends from `hazeSkyColor` at the horizon to this over the first 20
   * degrees of elevation. The reference sky is 91 sRGB at the top of the
   * frame and 105 just above the horizon, and one murk color could not give
   * both: at 0.135 the upper sky measured 103 to 107 over the sky module's
   * deck. Rain lit from a bright deck is brightest along the long grazing
   * paths and darker straight up, which is this gradient.
   */
  readonly hazeZenithColor: readonly [number, number, number];
  /**
   * The cloud deck's own color, scene-linear, a shade darker than the sky
   * murk in front of it: the reference's upper sky is 92 to 96 sRGB and its
   * horizon sky 104. The gradient between the two is the veil the critics
   * asked for, starting well above the horizon. Only drawn when
   * `stormCeiling` is on; the viewer's sky module carries its own deck now.
   */
  readonly deckColor: readonly [number, number, number];

  /* --- the marks on the water ---------------------------------------- */

  /** Splash instances on the water near the camera. 0 disables the marks. */
  readonly splashCount: number;
  /** The ground box the splashes wrap in, meters, centered ahead of the camera. */
  readonly splashBoxM: { readonly x: number; readonly z: number };
  /**
   * Life of one splash, seconds. A raindrop crown lasts about 60 ms and the
   * ring wave it leaves is gone in 0.3 to 0.5 s (Bliven, Sobieski and Craeye
   * 1997 measured rain ring waves at 4 to 6 cm wavelength, decayed within
   * half a second). One instance replays every `splashPeriodS`; the count and
   * the period together set the impact rate per square meter.
   */
  readonly splashPeriodS: number;
  /**
   * Crown height at its peak, meters. A 2.5 mm drop throws a 2 to 4 cm
   * crown, and on a sea the crown carries a fleck of foam with it; the
   * reference's near water shows white flecks 5 to 10 cm across. 4.5 cm.
   */
  readonly crownHeightM: number;
  /**
   * Ring radius at the end of its life, meters. 8 cm. A first pass at 12 cm
   * with a bright band drew ellipses on the water that read as cartoon
   * bubbles; on a rough sea the ring wave is nearly lost in the chop, and
   * the reference shows none, so the ring is small and faint and the crown
   * is what marks the drop.
   */
  readonly ringRadiusM: number;
  /**
   * Peak alpha of a near crown, before its pixel coverage and the rain's
   * veil. The crown's alpha is the share of its pixel it covers times the
   * Beer-Lambert veil along the sea path (the murk dome's own sea arm),
   * which is the model the far crowns need; 0.6 keeps the near crowns at
   * the brightness rounds 1 to 3 showed at 15 to 25 m (0.9 * exp(-d / 35)
   * was 0.53 at 18 m; 0.6 * 0.91 is 0.55).
   */
  readonly crownOpacity: number;
  /**
   * THE SEA UNDER THE RAIN, OUT PAST THE NEAR MARKS. Crowns only, in a
   * second ground box `farSplashAheadM` ahead of the eye. Every water pixel
   * of the judged crop is 52 m or more from a 10 m eye (the crop's lowest
   * row is 10.9 degrees down), so the near marks, which end 25 m out, never
   * reach it, and round 2's first critic saw "no rain marks visible on the
   * water". Out there a crown is under a pixel: it is held at one pixel and
   * its alpha is the share it covers, so the far sea gets a faint stipple of
   * impacts that thins with distance and under the veil, not a field of
   * bright specks.
   */
  readonly farSplashCount: number;
  readonly farSplashBoxM: { readonly x: number; readonly z: number };
  readonly farSplashAheadM: number;
  /** Peak alpha of a far crown, before coverage and veil. */
  readonly farCrownOpacity: number;
}

/**
 * The storm rain. Every value is explained on its field above.
 *
 * The drift heading is a placeholder here; `rainDriftDirRad` reads the real
 * one from the sea state so the rain leans with the sea's own wind.
 */
export const STORM_RAIN: OceanRainParams = {
  // 120,000 in a 112 x 36 x 68 m box is 0.44 drops per cubic meter; the
  // window and the frustum leave about a fifth of them on screen. Round 3
  // ran 9,000 at the reference's own streak count and lost on "density
  // too low, big empty gaps"; the critics asked for "the count several-
  // fold with each streak fainter". Measured on the storm-away pose (the
  // capture minus the same capture with the streaks hidden): the streak
  // layer lifts the sky by 1.0 to 1.4 sRGB on average (a veil), its 95th
  // percentile is +6 to +9 there against +20 over the water, and the
  // brightest 0.5% reach +10 to +15 on the sky, where the reference's reach
  // +16. The count costs nothing measurable: 40,000 and 120,000 bench
  // within noise of each other (the vertex work is a few hashes and one
  // noise per corner; the lines are one pixel wide).
  dropCount: 120000,
  // 960 drops in 384 cubic meters around the eye, 2.5 per cubic meter: the
  // soft near streaks that carry the depth. Past 2.5 m the main box has too
  // few to rely on.
  nearFraction: 0.008,
  nearBoxM: { x: 8, y: 6, z: 8 },
  // 2.5 m. At 1.0 m and 1.5 m a drop 0.7 m from the lens drew as a 6 px
  // wide, 300 px long light band across the frame, a lens flare and not
  // rain; the defocus alone does not remove it, this does.
  nearFadeM: 2.5,
  fallSpeedMs: 7.0,
  driftMs: 2.5,
  driftDirRad: 0,
  // 1/23 s: a 32 cm streak, 28 px at 10 m and 9 px at 30 m. At 1/30 s the
  // far streaks read as short dashes; at 1/19 s (40 cm) the near streaks
  // ran 70 px and the storm read heavier than any the reference shows. The
  // blind checks of this build named the long, soft near streaks over
  // short far ones as what gave the rain its depth.
  exposureS: 1 / 23,
  dropWidthM: 0.003,
  minWidthPx: 1.15,
  // 45 m, the window closing to 56 m. With the far fall-off below, a
  // streak at 45 m is at a third of a mid streak's alpha: the curtain, not
  // a line, so the end of the rain does not draw an edge.
  fadeM: 45,
  // 112 m wide: the 85-degree horizontal frustum is 104 m wide at 56 m.
  // 36 m tall from 4 m under the sea: at 56 m the top of the storm-away
  // frame (21.5 degrees up) is 32 m above the sea. 68 m deep: the far face
  // at 0.83 of the depth is 56 m, where the window closes.
  boxM: { x: 112, y: 36, z: 68 },
  // 0.16 scene-linear: a shade over the storm's own sky (0.114 at 95 sRGB),
  // so a mid-range streak reads +12 over the sky and +34 over the 58 sRGB
  // water, and +4 in the band just above the horizon. Every blind check of
  // this build said rain "should be close to invisible against bright
  // cloud and show mostly against the dark water"; 0.22 put the sky streaks
  // at the reference's brightest (+19 at p99.5 against +16), 0.14 all but
  // erased them over the horizon band (+5 at p99.5), and at 0.16, 0.18 and
  // 0.22 the sea side measured the same +20 at p95. A two-way blind check
  // of 0.16 against 0.18 split one to one.
  streakRadiance: [0.16, 0.158, 0.155],
  // 0.68 at the drop's focus, before blur, distance and size: a mid streak
  // at 8 m draws at 0.49, a far one at 30 m at 0.26.
  streakOpacity: 0.68,
  // 12 px m: a drop at 3 m is blurred over 4 px, at 8 m over 1.5 px, and
  // past 15 m it is on the pixel floor. At 7 the near streaks were still
  // "hard-edged, near-opaque lines that look like scratches on film" to a
  // blind critic; at 12 they are soft, wide and faint.
  cocPxM: 12,
  // Past 8 m the alpha falls as (8 / d) ^ 0.65: 0.42 of the mid value at
  // 30 m. At 0.8 the near streaks dominated the frame; at 0.5 the curtain
  // evened out into one flat layer.
  farRefM: 8,
  farExponent: 0.65,
  // Sheets 14 m across, alpha 0.6 to 1.4 of the mean, and a sheet leans up
  // to 150% harder than the mean drift (or stands up to 150% straighter).
  // Seen through 50 m of rain the sheets overlap and mostly average out;
  // what shows is a patchy density and a slant that changes across the
  // frame, one part of the sky leaning harder than the next. Added because
  // both blind checks of the first build named "all at one identical
  // angle", and the slant moved from the per-drop jitter to the sheets
  // because a later check still saw one slant at 0.8 here.
  gustScaleM: 14,
  gustDepth: 0.4,
  gustSlant: 1.5,
  // 0.3 m/s, about 2.5 degrees each way: the slant now varies by sheet, so
  // neighbors lean together. At 1.2 m/s two near streaks crossed as an X,
  // which rain a meter apart does not do.
  slantJitterMs: 0.3,
  // 0.5: a near streak blurred to four times its width keeps half its
  // alpha instead of a quarter. At 1 the near streaks fell under the far
  // ones' contrast and the depth range flattened; see the field's note.
  blurDimExponent: 0.5,
  hazeExtinctionPerM: 0.6e-3,
  hazeSeaExtinctionPerM: 5e-3,
  hazeCloudBaseM: 400,
  // 0.5 on a noise of radius 8: about fifty bands around the horizon, a
  // few degrees each, the murk's optical depth half again or half as much
  // from one to the next. At 0 the far haze is one even band, as the
  // reference's is; at 0.6 it thickens and thins along the horizon, and
  // 0.5 keeps that without the bands reading as stripes.
  shaftDepth: 0.5,
  shaftFrequency: 8,
  hazeMaxPathM: 2500,
  hazeSeaMaxPathM: 300,
  hazeSkyColor: [0.140, 0.134, 0.124],
  hazeZenithColor: [0.100, 0.097, 0.092],
  // 0.086: at 0.078 the veiled water measured 72 sRGB at the horizon line
  // and 63 at 60 px below it against the reference's 78 and 71, and the
  // streaks over it, which brighten in proportion, fell under the +14 the
  // reference's horizon band holds.
  hazeSeaColor: [0.086, 0.082, 0.079],
  deckColor: [0.105, 0.100, 0.092],
  // 12,000 in a 30 m box replaying every 0.45 s: 13 marks per square meter
  // at any moment, which from a 10 m eye is what reads as pitting at 15 to
  // 25 m. 6,000 at 8 cm showed nothing at that distance (round 1 critics).
  splashCount: 12000,
  splashBoxM: { x: 30, z: 30 },
  splashPeriodS: 0.45,
  crownHeightM: 0.045,
  ringRadiusM: 0.12,
  crownOpacity: 0.6,
  farSplashCount: 48000,
  farSplashBoxM: { x: 300, z: 220 },
  farSplashAheadM: 140,
  farCrownOpacity: 1.0,
};

/**
 * The pixel a streak leaves over a background, scene-linear: the alpha
 * blend `oceanRain.ts` draws (see `streakRadiance`). A test pushes this
 * through three.js' ACES fit to check the sRGB contrast it predicts over
 * the sky and over the sea.
 */
export function rainStreakOverBackground(
  bgLinear: number,
  alpha: number,
  p: Pick<OceanRainParams, 'streakRadiance'>,
): number {
  return bgLinear * (1 - alpha) + p.streakRadiance[1] * alpha;
}

const smooth01 = (a: number, b: number, x: number): number => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

/**
 * Width of one streak on screen, pixels, the CPU twin of the vertex
 * arithmetic in `oceanRain.ts`.
 *
 * `sharpPx` is the drop itself or the pixel floor, whichever is wider;
 * `blurPx` adds the lens's circle of confusion (`cocPxM / d`) in
 * quadrature, and is the width the quad is drawn at. The alpha is divided
 * by `blurPx / sharpPx`, so a blurred streak spreads the same light wider.
 *
 * @param metersPerPxAt1m meters one pixel covers at 1 m (`rainMetersPerPixel(1, ...)`).
 * @param size            the drop's size factor, 0.75 to 1.25.
 */
export function rainStreakWidthPx(
  distM: number,
  p: Pick<OceanRainParams, 'dropWidthM' | 'minWidthPx' | 'cocPxM'>,
  metersPerPxAt1m: number,
  size = 1,
): { sharpPx: number; blurPx: number } {
  const d = Math.max(distM, 1e-3);
  const sharpPx = Math.max(p.minWidthPx, (p.dropWidthM * size) / (metersPerPxAt1m * d));
  const cocPx = p.cocPxM / d;
  return { sharpPx, blurPx: Math.hypot(sharpPx, cocPx) };
}

/**
 * Alpha of one streak by distance, the CPU twin of the vertex arithmetic
 * in `oceanRain.ts`. The shader mirrors it term for term.
 *
 * The terms, in order: the window that ends the rain; the far fall-off,
 * which makes the distant drops the faint curtain; the near-lens fade-in;
 * the defocus, which spreads a near drop's light over a wider, softer
 * line; the size brightness, a narrow 0.85 to 1; and the gust sheet the
 * drop sits in (`gust` is the noise value, -1 to 1).
 */
export function rainStreakAlpha(
  distM: number,
  p: Pick<OceanRainParams, 'fadeM' | 'nearFadeM' | 'streakOpacity' | 'farRefM' | 'farExponent'
    | 'dropWidthM' | 'minWidthPx' | 'cocPxM' | 'gustDepth' | 'blurDimExponent'>,
  metersPerPxAt1m: number,
  size = 1,
  gust = 0,
): number {
  const d = Math.max(distM, 1e-3);
  const window = 1 - smooth01(p.fadeM, p.fadeM * 1.25, d);
  const far = Math.min(p.farRefM / d, 1) ** p.farExponent;
  const near = smooth01(p.nearFadeM * 0.2, p.nearFadeM, d);
  const { sharpPx, blurPx } = rainStreakWidthPx(d, p, metersPerPxAt1m, size);
  const soft = (sharpPx / blurPx) ** p.blurDimExponent;
  const bright = 0.85 + 0.15 * ((size - 0.75) / 0.5);
  const gustF = Math.max(1 + p.gustDepth * gust, 0);
  return p.streakOpacity * window * far * near * soft * bright * gustF;
}

/** A cascade as the rain needs it: only the wind that drives it. */
export interface RainWindSource {
  readonly windSpeedMs: number;
  readonly windDirRad: number;
  readonly drivesFoam: boolean;
}

/**
 * The heading the rain drifts along, from a sea state's cascades.
 *
 * Rain follows the LOCAL wind, which is the wind sea's, not the swell's: the
 * swell arrived from a storm somewhere else and says nothing about the air
 * here. So the strongest cascade that drives foam wins. A sea with no foam
 * cascade cannot occur (`createOceanField` refuses it), but the function
 * still answers with the strongest wind rather than throw, because a heading
 * is never a reason to lose the rain.
 */
export function rainDriftDirRad(cascades: readonly RainWindSource[]): number {
  if (cascades.length === 0) return 0;
  const pool = cascades.filter((c) => c.drivesFoam);
  const from = pool.length > 0 ? pool : cascades;
  return from.reduce((a, c) => (c.windSpeedMs > a.windSpeedMs ? c : a)).windDirRad;
}

/** The drop velocity vector, m/s, world space (+Y up). */
export function rainVelocityMs(p: Pick<OceanRainParams, 'fallSpeedMs' | 'driftMs' | 'driftDirRad'>):
[number, number, number] {
  return [
    Math.cos(p.driftDirRad) * p.driftMs,
    -p.fallSpeedMs,
    Math.sin(p.driftDirRad) * p.driftMs,
  ];
}

/** Slant of the streaks from vertical, degrees. The reference measures 19 to 22. */
export function rainSlantDeg(fallSpeedMs: number, driftMs: number): number {
  return (Math.atan2(driftMs, fallSpeedMs) * 180) / Math.PI;
}

/** Streak length in meters: speed over the exposure. */
export function rainStreakLengthM(speedMs: number, exposureS: number): number {
  return speedMs * exposureS;
}

/**
 * World meters covered by one pixel at a distance, for a vertical field of
 * view and a viewport height. This is what the shader multiplies by the
 * pixel floor to keep a far streak one pixel wide.
 */
export function rainMetersPerPixel(distM: number, fovDeg: number, viewportHeightPx: number): number {
  return (distM * 2 * Math.tan((fovDeg * Math.PI) / 360)) / viewportHeightPx;
}

/** On-screen length of a streak in pixels, seen broadside. */
export function rainStreakPx(
  lengthM: number, distM: number, fovDeg: number, viewportHeightPx: number,
): number {
  return lengthM / rainMetersPerPixel(distM, fovDeg, viewportHeightPx);
}

/**
 * Length of the rain path along a view direction, meters.
 *
 * A ray that goes up ends at the cloud base; a ray that goes down ends on
 * the sea, which is a plane at the camera's height below it. Both are
 * capped at the storm's extent. `dirY` is the sine of the elevation.
 */
export function rainPathLengthM(
  dirY: number, camHeightM: number, cloudBaseM: number, maxPathM: number,
): number {
  const s = Math.abs(dirY);
  if (s < 1e-6) return maxPathM;
  const target = dirY >= 0 ? cloudBaseM : Math.max(camHeightM, 0);
  return Math.min(target / s, maxPathM);
}

/** Beer-Lambert transmittance through `pathM` of rain. */
export function rainTransmittance(pathM: number, extinctionPerM: number): number {
  return Math.exp(-extinctionPerM * pathM);
}

/**
 * Where the drop field is at time t, as the shader sees it: the offset the
 * whole field has moved, wrapped to the box so the shader's `fract` stays in
 * float32 range. The wrap is per axis and exact, so the result is the same
 * pure function of t whether t is 42 s or 42,000 s.
 */
export function rainFieldOffsetM(
  velocityMs: readonly [number, number, number],
  boxM: { readonly x: number; readonly y: number; readonly z: number },
  tS: number,
): [number, number, number] {
  const wrap = (v: number, b: number) => {
    const m = v % b;
    return m < 0 ? m + b : m;
  };
  return [
    wrap(velocityMs[0] * tS, boxM.x),
    wrap(velocityMs[1] * tS, boxM.y),
    wrap(velocityMs[2] * tS, boxM.z),
  ];
}

/**
 * Floor of the streak box for a camera height, meters.
 *
 * Centered on the camera, but never deeper than 4 m under the mean sea:
 * a low camera's drops must end in the water, and a masthead camera must
 * have rain around itself rather than a box left down at the sea (a plan
 * view from 140 m had no drop within 110 m of the eye when the floor was
 * anchored to the sea).
 */
export function rainBoxFloorM(camHeightM: number, boxHeightM: number): number {
  return Math.max(camHeightM - boxHeightM * 0.5, -4);
}

/**
 * The added mean-square slope rain puts on the sea, for the water shader's
 * roughness. Bliven, Sobieski and Craeye (1997) tank measurements: rain of
 * 10 to 40 mm/h raises the short-wave slope variance by roughly 0.005 to
 * 0.02, growing with rate. Linear in the rate, 0.0005 per mm/h, clamped at
 * the top of the measured range.
 */
export function rainSlopeVariance(rateMmPerH: number): number {
  return Math.min(Math.max(rateMmPerH, 0) * 0.0005, 0.02);
}

/**
 * Age of one splash instance at time t, seconds in [0, period).
 *
 * Each instance replays every `period` seconds with its own phase, so the
 * impacts do not pulse together. A pure function of t: a pinned capture
 * shows the same splash at the same age.
 */
export function rainSplashAgeS(tS: number, periodS: number, phase01: number): number {
  const u = tS / periodS + phase01;
  return (u - Math.floor(u)) * periodS;
}

/**
 * Crown height as a fraction of its peak, by age. It rises in the first
 * 30 ms, holds, and falls away by 90 ms — about the life a high-speed
 * photograph of a drop crown shows. Zero afterward so the ring alone remains.
 */
export function rainCrownProfile(ageS: number): number {
  const rise = Math.min(Math.max(ageS / 0.03, 0), 1);
  const fall = 1 - Math.min(Math.max((ageS - 0.05) / 0.04, 0), 1);
  return rise * fall;
}

/**
 * Ring radius as a fraction of the final radius, by age. The ring wave is
 * launched at 20 ms, when the crown collapses, and expands at a steady
 * group speed to the end of the life. Zero before launch.
 */
export function rainRingProfile(ageS: number, periodS: number): number {
  const t0 = 0.02;
  if (ageS < t0) return 0;
  return Math.min((ageS - t0) / Math.max(periodS - t0, 1e-6), 1);
}
