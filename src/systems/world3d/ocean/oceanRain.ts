/**
 * @file oceanRain.ts — rain over the sea: streaks, the murk, and the marks
 * the drops leave on the water.
 *
 * THREE THINGS, ONE PIECE
 *
 *   1. STREAKS. Each raindrop is one instanced quad, stretched along its fall
 *      direction by the exposure time (a motion-blur streak) and turned to
 *      face the camera around that axis. It is blended toward the drop's
 *      own radiance, so it barely shows on the sky and shows more on the
 *      dark sea, and it is soft near the lens and faint far away. Its position is a pure function of
 *      (seed, index, time): the drop field is fixed in the world and moves at
 *      the rain velocity, and the shader wraps it into a box around the
 *      camera, so the camera can go anywhere and a pinned time always shows
 *      the same drops in the same places.
 *
 *   2. THE MURK. Rain between the eye and anything far grays it out. A dome
 *      around the camera carries that: its alpha is the Beer-Lambert
 *      transmittance along each view direction, through the rain to the
 *      cloud base for rays that go up and to the sea for rays that go down.
 *      It is what makes the horizon dense and gray while the near water
 *      stays dark and readable. The dome also carries the storm's cloud
 *      deck; see `stormCeiling` below for why, and for how it goes away.
 *
 *   3. THE MARKS. Where a drop lands it throws a crown and leaves a ring.
 *      Both are instanced quads sitting on the sea's own height, read from
 *      the FFT displacement buffer the way the surface reads it, so they ride
 *      the waves instead of floating above a trough. They are small; they
 *      matter at eye level and vanish from a masthead, as they should.
 *
 * WHAT IS CHEAP HERE. Three draw calls plus the dome (one for the streaks,
 * two for the marks), no compute, no read-back, no per-frame buffer
 * upload. The per-frame CPU work is a few uniform writes. The streak count is the only cost knob that matters, and
 * `STORM_RAIN.dropCount` says how it was chosen.
 *
 * WHAT THIS FILE DOES NOT DO. It does not touch the water shader. Rain also
 * roughens the sea (`rainSlopeVariance` in oceanRainMath.ts says by how
 * much); that change belongs in `oceanSurface.ts`, which another builder
 * owns, and the rain report states it exactly.
 *
 * REGISTERED TSL HAZARDS. Integer `.mod()` is never used; the cascade index
 * wrap is a power-of-two mask, as in `oceanSurface.ts`. `hash()` converts its
 * seed to a uint, so per-drop channels use distinct INTEGER seeds
 * (`index * 8 + channel`), never fractional offsets, which would all hash the
 * same.
 */
import * as THREE from 'three/webgpu';
import {
  Fn,
  abs,
  bitAnd,
  cameraPosition,
  clamp,
  cross,
  exp,
  float,
  floor,
  fract,
  hash,
  instanceIndex,
  int,
  length,
  max,
  min,
  mix,
  mx_fractal_noise_float,
  mx_noise_float,
  normalize,
  positionGeometry,
  positionLocal,
  pow,
  select,
  smoothstep,
  storage,
  uint,
  uniform,
  varying,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import type { CascadeParams } from './oceanConfig';
import { log2Exact } from './oceanConfig';
import type { OceanGpuBuffers } from './oceanCompute';
import {
  STORM_RAIN,
  rainBoxFloorM,
  rainFieldOffsetM,
  rainSlantDeg,
  rainStreakLengthM,
  rainVelocityMs,
  type OceanRainParams,
} from './oceanRainMath';

/** A TSL node expression. See `oceanSurface.ts` for why this is `any`. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TslNode = any;

export interface OceanRainOptions {
  readonly params?: OceanRainParams;
  /** The sea seed; the drop field is a function of it. */
  readonly seed: number;
  /** The sea's buffers and cascades, so the marks can sit on the water. */
  readonly buffers: OceanGpuBuffers;
  readonly cascades: readonly CascadeParams[];
  /**
   * The storm's cloud deck, 0 to 1, drawn on the dome where a sky ray ends.
   *
   * THIS IS A STAND-IN AND SAYS SO. The sky belongs to `oceanSky.ts`, which
   * has one state, fair weather with a sun. Rain from a blue sky reads as a
   * mistake before anything else in the frame is judged. A ray through the
   * rain curtain ends on the cloud base, and that base is what the dome
   * draws there, at the murk's own color, so the sky above the rain is the
   * dark deck the storm has. `oceanSky.ts` now has that overcast state and
   * the ocean viewer uses it, so the viewer passes 0 and the dome carries
   * the murk alone; the deck code stays for a scene whose sky has no storm.
   * At 0 (or omitted) the deck is not compiled into the dome at all: its
   * noise costs 1.3 ms of draw per frame and a dead multiply does not remove
   * it. So this is a build-time choice, not a live knob, and `probe.set`
   * only offers `ceiling` on a rain built with one.
   */
  readonly stormCeiling?: number;
}

export interface OceanRain {
  /** Add this to the scene. It holds the streaks, the dome and the marks. */
  readonly group: THREE.Group;
  readonly params: OceanRainParams;
  /**
   * Once a frame, after the sea has stepped. Pure in `simTime`: a pinned
   * clock shows the same rain each run.
   *
   * @param viewportHeightPx the drawing-buffer height, for the pixel floor
   *                         on streak width.
   */
  update(camera: THREE.PerspectiveCamera, viewportHeightPx: number, simTime: number): void;
  /** Move the sea's patch center, if the surface's `setCenter` was called. */
  setSeaCenter(xM: number, zM: number): void;
  dispose(): void;
  /** Live knobs and facts for a capture script; see `probe.set`. */
  readonly probe: Record<string, unknown>;
}

/**
 * One quad, instanced. The corner code lives in the position attribute:
 * x is -0.5 or +0.5 across the streak, y is 0 at the head and 1 at the tail.
 * The bounding sphere is huge and the mesh is never frustum culled, because
 * the shader places every instance and the CPU knows nothing of where.
 */
function instancedQuad(count: number): THREE.InstancedBufferGeometry {
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(
    [-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0], 3,
  ));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.instanceCount = count;
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
  return g;
}

/**
 * Build the rain.
 *
 * Everything is created here and nothing is created per frame. The three
 * meshes and the dome go in one group so a caller adds and removes one thing.
 */
export function createOceanRain(opts: OceanRainOptions): OceanRain {
  const p = opts.params ?? STORM_RAIN;
  const group = new THREE.Group();
  group.name = 'oceanRain';

  // Distinct integer seeds per drop channel: `hash` takes a uint. The seed
  // offset keeps every sum under 2^24 so float32 holds it exactly.
  const seedOffset = float((Math.abs(opts.seed) % 1000) * 16000);
  const channel = (k: number): TslNode => hash(
    float(instanceIndex).mul(float(8)).add(float(k)).add(seedOffset),
  );

  /* --- shared uniforms ---------------------------------------------- */

  const uTime = uniform(0);
  const uSeaCenter = uniform(new THREE.Vector2(0, 0));
  const uCamHeight = uniform(10);
  const uMetersPerPx = uniform(0.001);

  /* ================================================================== */
  /* 1. Streaks                                                          */
  /* ================================================================== */

  const vel = rainVelocityMs(p);
  const speed = Math.hypot(vel[0], vel[1], vel[2]);
  const uBox = uniform(new THREE.Vector3(p.boxM.x, p.boxM.y, p.boxM.z));
  const uBoxCenter = uniform(new THREE.Vector3(0, 10, 0));
  const uNearBox = uniform(new THREE.Vector3(p.nearBoxM.x, p.nearBoxM.y, p.nearBoxM.z));
  const uNearCenter = uniform(new THREE.Vector3(0, 10, 0));
  const uOffset = uniform(new THREE.Vector3(0, 0, 0));
  const uNearOffset = uniform(new THREE.Vector3(0, 0, 0));
  const uNearFade = uniform(p.nearFadeM);
  const nearCount = Math.round(p.dropCount * p.nearFraction);
  const uFallDir = uniform(new THREE.Vector3(vel[0] / speed, vel[1] / speed, vel[2] / speed));
  const uStreakLen = uniform(rainStreakLengthM(speed, p.exposureS));
  const uDropWidth = uniform(p.dropWidthM);
  const uMinWidthPx = uniform(p.minWidthPx);
  const uFade = uniform(p.fadeM);
  const uStreakRadiance = uniform(new THREE.Vector3(...p.streakRadiance));
  const uStreakOpacity = uniform(p.streakOpacity);
  const uCocPxM = uniform(p.cocPxM);
  const uFarRef = uniform(p.farRefM);
  const uFarExp = uniform(p.farExponent);
  const uGustScale = uniform(p.gustScaleM);
  const uGustDepth = uniform(p.gustDepth);
  const uGustSlant = uniform(p.gustSlant);
  const uSlantJitter = uniform(p.slantJitterMs);
  const uBlurDim = uniform(p.blurDimExponent);
  // The horizontal drift, for carrying the gust sheets along with the rain.
  const uDrift = uniform(new THREE.Vector2(vel[0], vel[2]));

  // Room is allocated for three times the count so a capture script can
  // raise it live (`probe.set('dropCount', n)`) to measure density against
  // the reference without a rebuild. Only `instanceCount` instances are drawn.
  const STREAK_CAPACITY = Math.max(p.dropCount * 3, 1);
  const streakGeom = instancedQuad(STREAK_CAPACITY);
  streakGeom.instanceCount = p.dropCount;

  // Size factor: 0.75 to 1.25 of the nominal drop. It widens and brightens a
  // streak; it does not change the fall speed, on purpose. One speed for all
  // drops lets the field offset wrap EXACTLY on the CPU (see
  // `rainFieldOffsetM`), which is what keeps the pattern a pure function of
  // time at any t. Real terminal speeds vary about 10% across the visible
  // sizes; a 10% spread in streak length is below what the eye reads.
  const sz = float(0.75).add(channel(3).mul(0.5)).toVar();

  // Two populations in one draw: the first `nearCount` instances live in the
  // small dense box around the eye, the rest in the main box. `select` on
  // the instance index picks the box, its center and its own wrapped offset.
  const isNear = instanceIndex.lessThan(uint(nearCount));
  const box = select(isNear, uNearBox, uBox);
  const center = select(isNear, uNearCenter, uBoxCenter);
  const offset = select(isNear, uNearOffset, uOffset);

  // The drop head, world space. The field is r*box + velocity*t, fixed in the
  // world; `fract` picks the one copy of each drop inside the box around the
  // camera. WGSL's fract is x - floor(x), so a negative argument wraps up
  // into [0, 1) as needed.
  const pRaw = vec3(channel(0), channel(1), channel(2)).mul(box).add(offset);
  const rel = fract(pRaw.sub(center).div(box)).mul(box).sub(box.mul(0.5));
  const head = center.add(rel).toVar();

  const toCam = head.sub(cameraPosition).toVar();
  const dist = length(toCam).toVar();

  // The gust sheets: noise on the drop's horizontal position with the drift
  // taken out, so a sheet drifts with the rain and the drops fall through
  // it; a slow third coordinate lets the sheets change shape. Pure in
  // (position, time). It scales the alpha (denser rain in a sheet) and the
  // drift (a sheet leans harder), below.
  const gustP = vec3(
    head.x.sub(uDrift.x.mul(uTime)).div(uGustScale),
    uTime.mul(0.06),
    head.z.sub(uDrift.y.mul(uTime)).div(uGustScale),
  );
  const gustN = mx_noise_float(gustP).toVar();
  const gust = max(float(1).add(uGustDepth.mul(gustN)), float(0));

  // THE STREAK'S DIRECTION, per drop. The field moves at one velocity (the
  // exact wrap needs it), but each streak is drawn along its own: the mean
  // velocity, plus the gust's extra drift, plus a small per-drop turbulent
  // jitter. Both blind critics of round 4's first build named "every streak
  // at one identical slant" as what makes the rain read as a screen overlay.
  // At 7 m/s the drop moves a streak length in 1/30 s, so a direction a few
  // degrees off its motion is not something the eye can follow.
  const jitter = vec3(channel(4).sub(0.5), float(0), channel(5).sub(0.5)).mul(uSlantJitter.mul(2));
  const gustDrift = vec3(uDrift.x, float(0), uDrift.y).mul(gustN.mul(uGustSlant));
  const streakDir = normalize(uFallDir.mul(speed).add(jitter).add(gustDrift)).toVar();
  // Cylindrical billboard: the quad's width vector is perpendicular to both
  // the view ray and the streak direction. Looking straight along it the
  // cross product vanishes; the divide is floored so the quad collapses to
  // nothing there instead of to NaN.
  const sideRaw = cross(toCam, streakDir);
  const side = sideRaw.div(max(length(sideRaw), float(1e-4)));

  // THE ALPHA AND WIDTH BY DISTANCE. Every term is mirrored in
  // `rainStreakAlpha` and `rainStreakWidthPx` (oceanRainMath.ts), which the
  // unit test checks; change both or neither.
  //
  //   sharp width: the drop, or the 1.15 px floor, whichever is wider;
  //   blur:        the lens's circle of confusion, cocPxM / d pixels;
  //   drawn width: the two added in quadrature, and the alpha dimmed by
  //                (sharp / blur) ^ blurDimExponent, so a near drop is soft;
  //   far:         past farRefM the alpha falls as (farRefM / d)^farExp;
  //   window:      the rain ends between fadeM and 1.25 fadeM;
  //   near:        inside nearFadeM a drop fades in from nothing;
  //   gust:        the sheet the drop is in, 1 + gustDepth * noise.
  const pxAtD = uMetersPerPx.mul(dist);
  const sharpPx = max(uMinWidthPx, uDropWidth.mul(sz).div(pxAtD));
  const cocPx = uCocPxM.div(max(dist, float(1e-3)));
  const blurPx = sharpPx.mul(sharpPx).add(cocPx.mul(cocPx)).sqrt().toVar();
  const soft = sharpPx.div(blurPx).toVar();
  const window = float(1).sub(smoothstep(uFade, uFade.mul(1.25), dist));
  const far = pow(min(uFarRef.div(max(dist, float(1e-3))), float(1)), uFarExp);
  const nearIn = smoothstep(uNearFade.mul(0.2), uNearFade, dist);
  // 0.85 to 1 by drop size: the reference's contrast spread is narrow.
  const bright = float(0.85).add(sz.sub(0.75).div(0.5).mul(0.15));
  const alpha = uStreakOpacity.mul(window).mul(far).mul(nearIn).mul(pow(soft, uBlurDim))
    .mul(bright).mul(gust).toVar();
  // A drop whose streak cannot show is collapsed to a point: no fragments.
  const live = select(alpha.greaterThan(float(0.002)), float(1), float(0));
  const widthWorld = blurPx.mul(pxAtD).mul(live);
  const vertex = head
    .sub(streakDir.mul(uStreakLen.mul(live).mul(positionGeometry.y)))
    .add(side.mul(widthWorld.mul(positionGeometry.x)));

  const vStreakAlpha = varying(alpha, 'vRainAlpha');
  const vStreakSoft = varying(float(1).sub(soft), 'vRainSoft');
  const vStreakUv = varying(vec2(positionGeometry.x, positionGeometry.y), 'vRainUv');

  /**
   * The per-fragment alpha of a streak.
   *
   * An in-focus streak is flat across its width with a soft edge; the quad
   * is about one pixel wide and the multisample resolve anti-aliases it. A
   * blurred near streak has a rounded profile, from flat at `soft` 0 to a
   * tent at `soft` 1. Both taper at the ends. A knee under alpha 0.006
   * turns a streak too faint to matter into nothing.
   */
  const streakAlpha = (): TslNode => {
    const edge = mix(float(0.6), float(0.0), vStreakSoft);
    const across = smoothstep(float(1), edge, abs(vStreakUv.x.mul(2)));
    const ends = smoothstep(float(0), float(0.12), vStreakUv.y)
      .mul(smoothstep(float(1), float(0.88), vStreakUv.y));
    const a0 = across.mul(ends).mul(vStreakAlpha);
    return a0.mul(smoothstep(float(0.002), float(0.006), a0));
  };

  // ONE DRAW, ordinary alpha blending toward the drop's radiance. See
  // `streakRadiance` in oceanRainMath.ts for why this is the right blend
  // and what the two rounds before it did instead.
  const streakMat = new THREE.MeshBasicNodeMaterial();
  streakMat.positionNode = vertex;
  streakMat.fragmentNode = Fn(() => vec4(uStreakRadiance, streakAlpha()))();
  streakMat.transparent = true;
  streakMat.blending = THREE.NormalBlending;
  streakMat.depthWrite = false;
  streakMat.depthTest = true;
  streakMat.side = THREE.DoubleSide;
  streakMat.fog = false;

  const streaks = new THREE.Mesh(streakGeom, streakMat);
  streaks.name = 'oceanRainStreaks';
  streaks.frustumCulled = false;
  // After the murk: a streak has its own distance fade and must stay crisp
  // over the dome, not be grayed by it twice.
  streaks.renderOrder = 30;
  group.add(streaks);

  /* ================================================================== */
  /* 2. The murk, and the storm's cloud deck                             */
  /* ================================================================== */

  const uExt = uniform(p.hazeExtinctionPerM);
  const uExtSea = uniform(p.hazeSeaExtinctionPerM);
  const uCloudBase = uniform(p.hazeCloudBaseM);
  const uMaxPath = uniform(p.hazeMaxPathM);
  const uMaxPathSea = uniform(p.hazeSeaMaxPathM);
  const uShaftDepth = uniform(p.shaftDepth);
  const uShaftFreq = uniform(p.shaftFrequency);
  const uHazeSky = uniform(new THREE.Vector3(...p.hazeSkyColor));
  const uHazeZenith = uniform(new THREE.Vector3(...p.hazeZenithColor));
  const uHazeSea = uniform(new THREE.Vector3(...p.hazeSeaColor));
  const uDeckColor = uniform(new THREE.Vector3(...p.deckColor));
  const uCeiling = uniform(opts.stormCeiling ?? 0);
  // The deck is compiled in only when asked for at construction. Its mottle
  // is seven octaves of fractal noise per pixel of a full-screen pass, and a
  // clean bench measured that at 1.3 ms of draw when it was multiplied by a
  // ceiling of 0 every frame. A viewer whose sky module carries the deck
  // (this one, under `sea=storm`) pays nothing for it. The `ceiling` knob
  // therefore only exists on a rain built with a deck.
  const hasDeck = (opts.stormCeiling ?? 0) > 0;

  // The dome sits 2 m from the eye. It is a direction lookup, not a thing at
  // a distance, and at 2 m nothing that matters is nearer, so its depth test
  // passes everywhere no matter what the backend makes of `depthTest =
  // false`: a first build at 1500 m lost the murk on every wave inside that
  // radius. It cannot be much closer either: the near plane is 0.5 m, and a
  // frame-corner ray at 55 degrees is 47 degrees off axis, so a 0.6 m dome
  // fell inside the near plane there and drew as a clipped disc. 2 m clears
  // any field of view under 150 degrees. Where a wave crest comes within
  // 2 m of the eye the murk there is nil anyway.
  //
  // 192 x 64 segments: the rain shafts below are computed per vertex, and
  // a shaft a few degrees wide needs a vertex every 1.9 degrees of azimuth.
  // Twelve thousand vertices once a frame cost nothing next to one noise
  // per pixel of a full-screen pass.
  const domeGeom = new THREE.SphereGeometry(2, 192, 64);
  const domeMat = new THREE.MeshBasicNodeMaterial();
  // RAIN SHAFTS. Heavy rain falls in shafts a few hundred meters across,
  // and from a few kilometers they are vertical bands of denser and thinner
  // murk along the horizon. The extinction on both arms is scaled by
  // `1 + shaftDepth * n`, n a smooth noise on the horizontal view direction
  // (sampled on a circle, so there is no seam at any azimuth) that barely
  // changes with elevation, so the bands stand upright. It is computed at
  // the dome's vertices and interpolated: the round-4 critics called the
  // first build's rain "one flat, even layer", and the reference's haze is
  // one even band. Pure in (direction, time).
  const shaftDir = normalize(positionLocal);
  const shaftH = vec2(shaftDir.x, shaftDir.z).div(max(length(vec2(shaftDir.x, shaftDir.z)), float(1e-4)));
  const shaftN = mx_noise_float(vec3(
    shaftH.x.mul(uShaftFreq).add(uTime.mul(0.013)),
    shaftDir.y.mul(1.2),
    shaftH.y.mul(uShaftFreq),
  ));
  // Only near the horizon: a shaft is seen edge-on from kilometers off,
  // and toward the zenith or the nadir the horizontal direction spins
  // round a point, so the noise there drew dark spokes radiating from
  // under a masthead camera. Full within 8.6 degrees of the horizon, gone
  // past 23.
  const shaftAmt = uShaftDepth.mul(float(1).sub(smoothstep(float(0.15), float(0.4), abs(shaftDir.y))));
  const vShaft = varying(max(float(1).add(shaftAmt.mul(shaftN)), float(0.05)), 'vRainShaft');
  domeMat.fragmentNode = Fn(() => {
    // The dome is centered on the camera, so the local position IS the view
    // direction, and its y is the sine of the elevation.
    const dir = normalize(positionLocal).toVar();
    const s = dir.y.toVar();
    // Path through the rain: up to the cloud base, or down to the sea, each
    // capped at its own extent, each with its own extinction (see
    // `hazeSeaExtinctionPerM` for why they differ). Both arms reach full
    // murk at the horizon, so they meet without a seam.
    const pathSky = min(uCloudBase.div(max(s, float(1e-3))), uMaxPath);
    const pathSea = min(uCamHeight.div(max(s.negate(), float(1e-3))), uMaxPathSea);
    const up = s.greaterThanEqual(float(0));
    const transmit = select(
      up, exp(pathSky.mul(uExt).mul(vShaft).negate()), exp(pathSea.mul(uExtSea).mul(vShaft).negate()),
    ).toVar();
    // Two murk colors, blended over one degree either side of the horizon,
    // so the horizon stays a line under full murk as the reference keeps it.
    // Above it the murk darkens toward the zenith over 20 degrees: the
    // reference sky is 105 sRGB at the horizon and 91 at the top of the
    // frame, and one color gave 107 everywhere.
    const w = smoothstep(float(-0.02), float(0.02), s);
    const skyMurk = mix(uHazeSky, uHazeZenith, smoothstep(float(0.0), float(0.35), s));
    const murk = mix(uHazeSea, skyMurk, w);
    if (!hasDeck) {
      // The murk alone: what the rain takes from whatever is behind it.
      return vec4(murk, float(1).sub(transmit));
    }
    // The cloud deck: what a sky ray ends on. Its own opacity is multiplied
    // into what the rain lets through, so at ceiling 1 every upward ray ends
    // on the deck and at ceiling 0 only the rain remains. It fades in over
    // the first few degrees above the horizon, where the sky's own haze band
    // already sits, so the deck does not draw an edge there.
    //
    // The deck is not a flat card. A nimbostratus base is mottled by ragged
    // scud a shade darker and by thinner patches a shade lighter; the
    // reference sky runs 95 to 137 sRGB across the frame. The mottling is
    // fractal noise on the direction projected onto the cloud-base plane,
    // which is how `oceanSky.ts` foreshortens its own clouds toward the
    // horizon; the plane divisor is floored so a grazing ray stays finite.
    // One noise unit is 250 m of cloud base: a storm deck's scud is a few
    // hundred meters across, and at 900 m per unit the first build showed
    // one soft gradient across the whole sky instead of a mottled deck.
    const planeXZ = vec2(dir.x, dir.z)
      .div(max(s, float(0.03)))
      .mul(uCloudBase.div(float(250)))
      .add(vec2(5.1, 9.7));
    // Two layers: broad scud a few hundred meters across, and a finer
    // shredded layer under it. The reference deck runs from 80 to 137 sRGB
    // across one frame, a 1.7x spread; at a 0.7 gain on one layer the first
    // build showed under a 1.1x spread and read as a card.
    const mottle = mx_fractal_noise_float(
      vec3(planeXZ.x, float(0.3), planeXZ.y), 4, 2.1, 0.5, 1.0,
    ).mul(1.6).add(mx_fractal_noise_float(
      vec3(planeXZ.x.mul(3.7), float(1.9), planeXZ.y.mul(3.7)), 3, 2.0, 0.5, 1.0,
    ).mul(0.5));
    const deckCol = uDeckColor.mul(clamp(float(1).add(mottle), float(0.55), float(1.75)));
    // The deck fades in over the first 8.6 degrees above the horizon. At 3.4
    // degrees the round-1 critics saw "a flat, hard-edged lighter strip";
    // with the deck a shade darker than the murk and this longer ramp, the
    // strip is a graded veil that starts well above the horizon.
    const deckAmt = uCeiling.mul(smoothstep(float(0.0), float(0.15), s));
    // Where the deck shows, its mottled color replaces the murk color in
    // proportion to how much of the ray reaches it through the rain.
    const col = mix(murk, deckCol, deckAmt.mul(transmit));
    const alpha = float(1).sub(transmit.mul(float(1).sub(deckAmt)));
    return vec4(col, alpha);
  })();
  domeMat.transparent = true;
  domeMat.depthWrite = false;
  domeMat.depthTest = false;
  domeMat.side = THREE.BackSide;
  domeMat.fog = false;

  const dome = new THREE.Mesh(domeGeom, domeMat);
  dome.name = 'oceanRainMurk';
  dome.frustumCulled = false;
  dome.renderOrder = 10;
  group.add(dome);

  /* ================================================================== */
  /* 3. The marks: crowns and rings on the sea                           */
  /* ================================================================== */

  const n = opts.buffers.n;
  log2Exact(n);
  const cells = n * n;
  const disp = storage(opts.buffers.disp, 'vec4', opts.buffers.disp.count).toReadOnly();

  /**
   * Bilinear read of one cascade's displacement at a world XZ. This mirrors
   * `sampleCascade` in `oceanSurface.ts` node for node: the same mask wrap,
   * the same corner order. It is copied rather than imported because that
   * file is another builder's; if the surface ever exports it, use theirs.
   */
  const sampleCascade = (world: TslNode, cascadeIdx: number, patchM: number): TslNode => {
    const texel = world.div(float(patchM)).mul(float(n));
    const base = floor(texel);
    const f = fract(texel);
    const ix = int(base.x);
    const iz = int(base.y);
    const m = int(n - 1);
    const x0 = bitAnd(ix, m);
    const x1 = bitAnd(ix.add(int(1)), m);
    const z0 = bitAnd(iz, m);
    const z1 = bitAnd(iz.add(int(1)), m);
    const off = int(cascadeIdx * cells);
    const at = (xi: TslNode, zi: TslNode) => disp.element(off.add(bitAnd(zi, m).mul(int(n))).add(xi));
    return mix(mix(at(x0, z0), at(x1, z0), f.x), mix(at(x0, z1), at(x1, z1), f.x), f.y);
  };

  /** The surface's own distance roll-off, so a mark and the mesh under it agree. */
  const cascadeLod = (world: TslNode, lod: CascadeParams['dispLod']): TslNode => {
    const r = world.sub(uSeaCenter).length();
    const k = float(1).sub(smoothstep(float(lod.startM), float(lod.endM), r));
    return k.mul(float(1 - lod.floor)).add(float(lod.floor));
  };

  /** Summed displacement (x, y, z) at a grid XZ, every cascade faded as the mesh fades it. */
  const sumDisp = (world: TslNode): TslNode => {
    let acc: TslNode | null = null;
    for (let ci = 0; ci < opts.cascades.length; ci += 1) {
      const c = opts.cascades[ci];
      const d = sampleCascade(world, ci, c.patchM).xyz.mul(cascadeLod(world, c.dispLod));
      acc = acc === null ? d : acc.add(d);
    }
    return acc as TslNode;
  };

  /**
   * Sea height at a WORLD XZ. The displacement is indexed by the undisplaced
   * grid position, and the choppy field moves a crest sideways by meters, so
   * one fixed-point step walks the lookup back: q = p - D(p).xz, then read
   * D(q). One step brings the error under the mark's own size on this sea;
   * a second step cost 12 more buffer reads per vertex and moved nothing
   * the eye could see.
   */
  const seaHeightAt = (pXZ: TslNode): TslNode => {
    const d0 = sumDisp(pXZ);
    const q = pXZ.sub(vec2(d0.x, d0.z));
    return sumDisp(q).y;
  };

  const uSplashBox = uniform(new THREE.Vector2(p.splashBoxM.x, p.splashBoxM.z));
  const uSplashCenter = uniform(new THREE.Vector2(0, 0));
  const uFarSplashBox = uniform(new THREE.Vector2(p.farSplashBoxM.x, p.farSplashBoxM.z));
  const uFarSplashCenter = uniform(new THREE.Vector2(0, 0));
  const uSplashPeriod = uniform(p.splashPeriodS);
  const uCrownHeight = uniform(p.crownHeightM);
  const uRingRadius = uniform(p.ringRadiusM);
  const uMarkOpacity = uniform(1);
  const uCrownOpacity = uniform(p.crownOpacity);
  const uFarCrownOpacity = uniform(p.farCrownOpacity);

  /**
   * Shared per-splash values: where it lands, how old it is, how far it is.
   * The land point wraps in a ground box ahead of the camera exactly as the
   * streaks wrap in theirs; the age replays every period with a per-instance
   * phase (`rainSplashAgeS` is the CPU twin). The first `splashCount`
   * instances land in the near box; the crowns carry `farSplashCount` more
   * in the far box (see `farSplashCount`), and the rings draw only the near
   * ones, because a ring wave is lost in the chop past a few tens of meters.
   */
  const splashCommon = () => {
    const isFar = instanceIndex.greaterThanEqual(uint(p.splashCount));
    const sBox = select(isFar, uFarSplashBox, uSplashBox);
    const sCenter = select(isFar, uFarSplashCenter, uSplashCenter);
    const r = vec2(channel(0), channel(1));
    const rel = fract(r.mul(sBox).sub(sCenter).div(sBox))
      .mul(sBox).sub(sBox.mul(0.5));
    const xz = sCenter.add(rel).toVar();
    const phase = channel(2);
    const age = fract(uTime.div(uSplashPeriod).add(phase)).mul(uSplashPeriod).toVar();
    // Sit 1 cm proud of the surface: the mark must never z-fight the water.
    const h = seaHeightAt(xz).add(float(0.01)).toVar();
    const foot = vec3(xz.x, h, xz.y).toVar();
    const d = length(foot.sub(cameraPosition)).toVar();
    return { foot, age, d, isFar, size: float(0.7).add(channel(3).mul(0.6)) };
  };

  // --- crowns: a vertical billboard that rises and collapses ---------------
  // Room for three times the far crowns, so a capture script can raise the
  // count live (`probe.set('farSplashCount', n)`), as for the streaks.
  const CROWN_CAPACITY = p.splashCount + p.farSplashCount * 3;
  const crownGeom = instancedQuad(CROWN_CAPACITY);
  crownGeom.instanceCount = p.splashCount + p.farSplashCount;
  const crownMat = new THREE.MeshBasicNodeMaterial();
  {
    const { foot, age, d, isFar, size } = splashCommon();
    // `rainCrownProfile` in TSL: up in 30 ms, gone by 90 ms.
    const rise = clamp(age.div(float(0.03)), float(0), float(1));
    const fall = float(1).sub(clamp(age.sub(float(0.05)).div(float(0.04)), float(0), float(1)));
    const prof = rise.mul(fall).toVar();
    const hgt = uCrownHeight.mul(size).mul(prof);
    const wid = uCrownHeight.mul(size).mul(float(0.55).add(prof.mul(0.45)));
    const toCamXZ = vec3(foot.x.sub(cameraPosition.x), float(0), foot.z.sub(cameraPosition.z));
    const sideRawC = cross(toCamXZ, vec3(0, 1, 0));
    const sideC = sideRawC.div(max(length(sideRawC), float(1e-4)));
    // A crown smaller than a pixel is held at one pixel each way, as a
    // streak is, and its alpha is scaled by the share of the pixel it
    // really covers. Without the height floor a far crown is under half a
    // pixel tall and the rasterizer drops it on some frames and not others.
    const pxAtD = uMetersPerPx.mul(d);
    const widC = max(wid, pxAtD);
    const hgtC = max(hgt, pxAtD);
    const coverage = wid.div(widC).mul(hgt.div(max(hgtC, float(1e-5))));
    const vtx = foot.add(vec3(0, 1, 0).mul(hgtC.mul(positionGeometry.y)))
      .add(sideC.mul(widC.mul(positionGeometry.x)));
    // The rain between the eye and the crown veils it as it veils the sea
    // behind it: the same Beer-Lambert path as the murk dome's sea arm. The
    // crowns draw after the dome, so the veil is applied here.
    const veil = exp(min(d, uMaxPathSea).mul(uExtSea).negate());
    const vis = prof.mul(coverage).mul(veil).mul(select(isFar, uFarCrownOpacity, uCrownOpacity));
    const vA = varying(vis, 'vCrownA');
    const vUv = varying(vec2(positionGeometry.x, positionGeometry.y), 'vCrownUv');
    crownMat.positionNode = vtx;
    crownMat.fragmentNode = Fn(() => {
      const across = float(1).sub(abs(vUv.x.mul(2)));
      const top = float(1).sub(vUv.y.mul(0.5));
      return vec4(vec3(0.70, 0.72, 0.74), across.mul(top).mul(vA).mul(uMarkOpacity));
    })();
  }
  crownMat.transparent = true;
  crownMat.depthWrite = false;
  crownMat.side = THREE.DoubleSide;
  crownMat.fog = false;
  const crowns = new THREE.Mesh(crownGeom, crownMat);
  crowns.name = 'oceanRainCrowns';
  crowns.frustumCulled = false;
  crowns.renderOrder = 20;
  group.add(crowns);

  // --- rings: a flat expanding ring wave -----------------------------------
  const ringGeom = instancedQuad(p.splashCount);
  const ringMat = new THREE.MeshBasicNodeMaterial();
  {
    const { foot, age, d, size } = splashCommon();
    // `rainRingProfile` in TSL: launched at 20 ms, expands to the end of life.
    const t0 = float(0.02);
    const prof = clamp(age.sub(t0).div(uSplashPeriod.sub(t0)), float(0), float(1)).toVar();
    const launched = smoothstep(float(0.0), float(0.005), age.sub(t0));
    const rad = uRingRadius.mul(size).mul(prof).add(float(0.004));
    // The quad lies flat on the sea, corner code mapped to [-1, 1]^2.
    const cx = positionGeometry.x.mul(2);
    const cz = positionGeometry.y.mul(2).sub(1);
    const vtx = foot.add(vec3(cx.mul(rad), float(0), cz.mul(rad)));
    // The ring wave dies within its life and with distance, and its band is
    // one pixel wide at the least: thinner and it flickers. 35 m of fade:
    // 12 m left nothing to see from the storm-away pose, 10 m up, whose
    // nearest water is 14 m out.
    const vis = launched.mul(float(1).sub(prof)).mul(exp(d.div(float(35)).negate()));
    const bandFrac = clamp(uMetersPerPx.mul(d).div(rad), float(0.10), float(0.6));
    const vA = varying(vis, 'vRingA');
    const vBand = varying(bandFrac, 'vRingBand');
    const vUv = varying(vec2(cx, cz), 'vRingUv');
    ringMat.positionNode = vtx;
    ringMat.fragmentNode = Fn(() => {
      const r = length(vUv);
      const inner = float(1).sub(vBand);
      const ring = smoothstep(inner.sub(vBand.mul(0.5)), inner, r)
        .mul(smoothstep(float(1.0), float(1).sub(vBand.mul(0.5)), r));
      // 0.3: at 0.55 the rings drew as ellipses the eye read as bubbles from
      // 3 m up; at 0.18 the round-1 critics saw no mark at all from 10 m up.
      return vec4(vec3(0.62, 0.65, 0.68), ring.mul(vA).mul(uMarkOpacity).mul(0.3));
    })();
  }
  ringMat.transparent = true;
  ringMat.depthWrite = false;
  ringMat.side = THREE.DoubleSide;
  ringMat.fog = false;
  const rings = new THREE.Mesh(ringGeom, ringMat);
  rings.name = 'oceanRainRings';
  rings.frustumCulled = false;
  rings.renderOrder = 20;
  group.add(rings);

  /* ================================================================== */
  /* Per-frame                                                            */
  /* ================================================================== */

  const fwd = new THREE.Vector3();
  const boxCenter = new THREE.Vector3();

  const update = (camera: THREE.PerspectiveCamera, viewportHeightPx: number, simTime: number) => {
    camera.getWorldDirection(fwd);
    // Horizontal forward only: a camera that looks down still wants its rain
    // box ahead of it on the sea, not under it.
    const fl = Math.hypot(fwd.x, fwd.z);
    const fx = fl > 1e-4 ? fwd.x / fl : 0;
    const fz = fl > 1e-4 ? fwd.z / fl : -1;
    const cam = camera.position;

    // The streak box: a third of its depth ahead of the camera, so its far
    // face sits where the window closes and its near face 8 m behind the
    // eye. Vertically it is centered on the camera but never reaches deeper
    // than 4 m under the sea: a deck or eye-level camera gets its drops
    // ending in the water, and a masthead camera gets rain around itself.
    // The first build anchored the floor to the sea, and a plan view from
    // 140 m had no drop within 110 m of the eye.
    const floorY = rainBoxFloorM(cam.y, p.boxM.y);
    boxCenter.set(
      cam.x + fx * p.boxM.z * 0.33,
      floorY + p.boxM.y * 0.5,
      cam.z + fz * p.boxM.z * 0.33,
    );
    uBoxCenter.value.copy(boxCenter);
    const off = rainFieldOffsetM(vel, p.boxM, simTime);
    uOffset.value.set(off[0], off[1], off[2]);
    // The near box: on the eye, a quarter of its depth ahead, its own exact
    // wrap on its own period.
    uNearCenter.value.set(
      cam.x + fx * p.nearBoxM.z * 0.25, cam.y, cam.z + fz * p.nearBoxM.z * 0.25,
    );
    const offN = rainFieldOffsetM(vel, p.nearBoxM, simTime);
    uNearOffset.value.set(offN[0], offN[1], offN[2]);

    uMetersPerPx.value = (2 * Math.tan((camera.fov * Math.PI) / 360)) / Math.max(viewportHeightPx, 1);
    uCamHeight.value = Math.max(cam.y, 0.5);
    uTime.value = simTime;

    dome.position.copy(cam);
    uSplashCenter.value.set(cam.x + fx * p.splashBoxM.z * 0.35, cam.z + fz * p.splashBoxM.z * 0.35);
    uFarSplashCenter.value.set(cam.x + fx * p.farSplashAheadM, cam.z + fz * p.farSplashAheadM);
  };

  /* ================================================================== */
  /* Probe                                                                */
  /* ================================================================== */

  const knobs: Record<string, { value: number } | { value: THREE.Vector3 }> = {
    streakOpacity: uStreakOpacity,
    streakRadiance: uStreakRadiance,
    cocPxM: uCocPxM,
    farRefM: uFarRef,
    farExponent: uFarExp,
    gustScaleM: uGustScale,
    gustDepth: uGustDepth,
    gustSlant: uGustSlant,
    slantJitterMs: uSlantJitter,
    blurDimExponent: uBlurDim,
    fadeM: uFade,
    streakLenM: uStreakLen,
    minWidthPx: uMinWidthPx,
    dropWidthM: uDropWidth,
    extinction: uExt,
    extinctionSea: uExtSea,
    cloudBaseM: uCloudBase,
    shaftDepth: uShaftDepth,
    shaftFrequency: uShaftFreq,
    nearFadeM: uNearFade,
    ...(hasDeck ? { ceiling: uCeiling, deckColor: uDeckColor } : {}),
    markOpacity: uMarkOpacity,
    crownOpacity: uCrownOpacity,
    farCrownOpacity: uFarCrownOpacity,
    crownHeightM: uCrownHeight,
    ringRadiusM: uRingRadius,
    hazeSky: uHazeSky,
    hazeZenith: uHazeZenith,
    hazeSea: uHazeSea,
  };

  const probe: Record<string, unknown> = {
    dropCount: p.dropCount,
    splashCount: p.splashCount,
    farSplashCount: p.farSplashCount,
    slantDeg: rainSlantDeg(p.fallSpeedMs, p.driftMs),
    streakLengthM: rainStreakLengthM(speed, p.exposureS),
    driftDirRad: p.driftDirRad,
    /** Live tuning from a capture script: `set('streakOpacity', 0.4)`. */
    set(name: string, value: number | [number, number, number]) {
      if (name === 'dropCount') {
        const n = Math.floor(Number(value));
        if (!(n >= 0 && n <= STREAK_CAPACITY)) {
          throw new Error(`[ocean] rain dropCount ${value} is outside 0..${STREAK_CAPACITY}.`);
        }
        streakGeom.instanceCount = n;
        probe.dropCount = n;
        return;
      }
      if (name === 'farSplashCount') {
        const n = Math.floor(Number(value));
        if (!(n >= 0 && p.splashCount + n <= CROWN_CAPACITY)) {
          throw new Error(`[ocean] rain farSplashCount ${value} is outside 0..${CROWN_CAPACITY - p.splashCount}.`);
        }
        crownGeom.instanceCount = p.splashCount + n;
        probe.farSplashCount = n;
        return;
      }
      const u = knobs[name];
      if (!u) throw new Error(`[ocean] rain has no knob "${name}". Knobs: ${Object.keys(knobs).join(', ')}.`);
      if (Array.isArray(value)) (u.value as THREE.Vector3).set(value[0], value[1], value[2]);
      else (u as { value: number }).value = value;
    },
    /** Hide or show one part, for a critic's crop: 'streaks' | 'murk' | 'marks'. */
    show(part: string, on: boolean) {
      if (part === 'streaks') streaks.visible = on;
      else if (part === 'murk') dome.visible = on;
      else if (part === 'marks') { crowns.visible = on; rings.visible = on; } else {
        throw new Error(`[ocean] rain has no part "${part}".`);
      }
    },
  };

  return {
    group,
    params: p,
    update,
    setSeaCenter(xM, zM) { uSeaCenter.value.set(xM, zM); },
    dispose() {
      group.removeFromParent();
      streakGeom.dispose();
      streakMat.dispose();
      domeGeom.dispose();
      domeMat.dispose();
      crownGeom.dispose();
      crownMat.dispose();
      ringGeom.dispose();
      ringMat.dispose();
    },
    probe,
  };
}
