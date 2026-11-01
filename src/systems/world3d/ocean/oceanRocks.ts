/**
 * @file oceanRocks.ts — rocks in the surf, on the GPU and on screen.
 *
 * The model is `oceanRocksMath.ts`: how the water runs up a face, bursts,
 * washes over, cascades off, lays foam and wets the rock. This file reads
 * the sea at every face, steps that model on its fixed clock, and draws it.
 *
 * ROUND 2 (2026-09-29): ONE WATER. Remy's rule: all water is one system.
 * So the rocks keep as little water of their own as they can:
 *
 *   - THE REEF IS THE SEA'S. The shelf each rock stands on is written into
 *     the sea's one bathymetry (`oceanBathymetry.ts`). The sea surface
 *     shoals its waves over it and the foam field breaks them there (both
 *     through patches the lead applies: `patchSurfaceShoal.mjs`,
 *     `patchFoamOneWater.mjs`), so the wave that arrives, steepens and
 *     breaks into the rock is the sea's own.
 *   - THE WHITE WATER IS THE SEA'S. Every deposit of the model (a breaking
 *     crest at a face, a jet, water poured off the rock, a drop landing) is
 *     written as a timed disc into the sea's one foam field (round 3:
 *     `oceanFoamSources(field).add(oceanFoamDiscSource(...))`). The rocks'
 *     own foam grid is kept behind `foamPath: 'own'` for an A/B only.
 *   - THE SPLASH IS THE SHARED MODEL (`oceanSplashMath.ts`,
 *     `oceanSplash.ts`): the rocks throw sheets of water; the model breaks
 *     them into strands, drops and mist, lights them through the plume and
 *     lands them.
 *
 *   THE SEA AT THE FACES. A compute kernel reads the FFT sea through the
 *   surface's own sampler (`createOceanSampler`, GG-273) at a point just
 *   outside each face, inverts the choppy displacement, and also reads the
 *   parcel that stood there one sample ago, so the parcel's velocity is a
 *   difference of one parcel at two times. When the surface shoals over the
 *   reef, the kernel mirrors the gain, so the water the model reads is the
 *   water drawn.
 *
 *   A PINNED TIME RE-INTEGRATES from rest over the 20 s before it (the sea
 *   stepped to each sample time, the rows read back once); with the foam
 *   field, the field is then asked to replay its warm-up with the sources
 *   (`probe.invalidate`), and `settled` reports only after it has.
 *
 * ROUND 3 (2026-09-30), after both round-2 views lost again (a sprite
 * cloud with no light, a rock like glossy plastic, white water as a decal):
 *   - the burst is drawn as a LIT VOLUME, one density grid per rock
 *     (SplashVolume, createOceanSplashVolumeDraw), depth-tested slices, so it
 *     stands behind the rock with a grey core and a sunlit side; only the
 *     rim's drops and the drips stay particles;
 *   - the stone has fractured plates in its mesh and pits, crust and knobs in
 *     its shading, and keeps that relief when wet;
 *   - the water on the rock is a SHELL of geometry over it (streams, the
 *     swash edge, the spill, a clear film);
 *   - the white water goes into the sea's one foam field as a timed-disc
 *     source (foam round 10's registry), the only default path.
 *
 * ROUND 4 (2026-09-30), after both round-3 views lost again (the burst not
 * rooted at the impact, one flat light, cauliflower lumps, a rock not seen
 * to be struck): the burst leaves only a struck face that looks at the sea
 * and leans back over it, in still air in front of the windward face (the
 * model, oceanRocksMath.ts); the volume is drawn-out sheets with fibers
 * along the flight and a deeper light (oceanSplashMath.ts, oceanSplash.ts);
 * the drops draw under the plume; the rock loses its 2 cm speckle and gains
 * a soaked band and a sheen that follows its shape; the pour-off is
 * stronger. See the domain doc's "## Rocks", Round 4.
 *
 * Added by the rocks piece of the ocean gauntlet (rounds 1 and 2, 2026-09-29; rounds 3 and 4, 2026-09-30).
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 12/10/2026, 21:44:53
 * Dependents: components/DesignPreview/steps/sidebyside/oceanExtras/rocks.ts, systems/world3d/ocean/oceanSurface.ts
 * Imports: 13 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { createRockMaterialSetup, type TslNode } from './oceanRocksMaterial';
import * as THREE from 'three/webgpu';
import { Fn, If, Loop, asin, select, sqrt, abs, atan, attribute, bitAnd, cameraPosition, cbrt, sign, step, clamp, dot, exp, float, floor, fract, fwidth, instanceIndex, int, max, min, mix, normalize, positionLocal, pow, smoothstep, storage, texture, uniform, uniformArray, varying, vec2, vec3, vec4 } from 'three/tsl';
import { OCEAN_PROBE_INVERSION_ITERATIONS } from './oceanBuoyancyProbe';
import * as oceanSurfaceModule from './oceanSurface';
import { OCEAN_MESH_SIDE, OCEAN_RADIUS_M, OCEAN_WARP_POWER } from './oceanSurface';
import { FOAM_DISC_SLOTS, oceanFoamDiscSource, oceanFoamSources, type OceanFoamBreaker } from './oceanFoam';
import { FOAM_LEVELS } from './oceanFoamMath';
import type { OceanField } from './oceanField';
import { createOceanSampler } from './oceanSampler';

import { oceanSkyRadiance } from './oceanSky';
import { wakeLaceImage } from './oceanWakeMath';
import { oceanBathymetryFor } from './oceanBathymetry';
import { MARCH_SCALE, createOceanSplashDepthPrepass, createOceanSplashDraw, createOceanSplashDropDraw, createOceanSplashMarchDraw } from './oceanSplash';
import { SPLASH_BODY_STRIDE, SPLASH_FALL, SPLASH_G, SplashVolume, sunThroughAir } from './oceanSplashMath';
import { ROCK_DT_S, ROCK_FOAM_CELL_M, ROCK_FOAM_MAX, ROCK_FOAM_N, rockSectorOf, rockTopRaster, rockTopRasterAt, ROCK_PRIME_S, rockReflectHoldM, ROCK_COLLAR_REACH_M, ROCK_FLOW_SAMPLE_S, ROCK_FLOW_SLOTS, ROCK_REEF_DEPTH_M, ROCK_LEE_ENDS, ROCK_REFLECT_RING, ROCK_REFLECT_SKIN_M, ROCK_REFLECT_SLOT_STEPS, ROCK_REFLECT_TAPER, ROCK_SAMPLE_HZ, ROCK_SECTORS, rockBandLambda, rockLeeOf, rockLeeHalfWidth, rockReflectSpeed, RockSeaHistory, RockSurf, buildRockMesh, ROCK_BODY_MAX, rockBodyCensus, rockRollerBodies, rockFaceTable, rockFoamSources, rockHistoryRow, rockPrimeTimes, rockQueryPoints, rockSeaParams, rockShelves, type RockFaceTable, type RockSpec } from './oceanRocksMath';

/**
 * ROUND 7: THE ROCK READER (oceanRocksMath.ts, THE SEA KNOWS THE ROCK; ADR
 * 0006). The ocean surface reads the rocks through it, in the pattern of the
 * wake's and the river's readers (oceanSurface.ts `setRocks`). All three
 * take the grid coordinate (the undisplaced world XZ, meters) the surface
 * samples its bands at.
 */
export interface OceanRockReader {
  /**
   * Round 7b (GG-388): the reader's vertex sample, built ONCE per setRocks
   * at the surface's grid coordinate: the lee of every band (vec4, 1 past
   * the last band), the reflected wave's height and its slope (as `slope`).
   * The surface takes each band's share from `lee` and hands `lee` and
   * `slope` to its fragment stage as varyings.
   */
  sample(sample: TslNode): { lee: TslNode; lift: TslNode; slope: TslNode };
  /** Vertex stage: the reflected wave's height off the struck faces, meters. */
  lift(sample: TslNode): TslNode;
  /** Fragment stage: the reflected wave's slope as the surface sums its bands' (-d(eta)/dx, -d(eta)/dz: a normal's x and z over its y), vec2. */
  slope(sample: TslNode): TslNode;
  /** Both stages: the share of band `ci`'s waves that reaches `sample` past the rocks (their lee), 0 to 1. */
  bandShare(sample: TslNode, ci: number): TslNode;
}

/**
 * Rows the history buffer holds: a pinned start's 20 s at 30 a second and
 * the pinned time itself, or a probe scan's 20 s warm-up and up to 60 s of
 * window (`scan`, for choosing the capture time).
 */
const SCAN_MAX_S = 60;
const HIST_SLOTS = (ROCK_PRIME_S + SCAN_MAX_S) * ROCK_SAMPLE_HZ + 1;
/** The live ring. A readback lands one to five frames late; 32 is margin. */
const LIVE_SLOTS = 32;
/** The most fixed steps a live frame takes; past that the model skips ahead. */
const LIVE_MAX_STEPS = 8;
/**
 * ROUND 18: THE LIVE STEPS HAVE A BUDGET (GG-406; round 17 measured the strike's live cost and found it mostly
 * the catch-up STEPS, 9 to 54 ms in a 0.5 s window: a slow frame took up to LIVE_MAX_STEPS steps of the whole
 * pool, which made the next frame slow too). A live frame now takes model steps until LIVE_STEP_BUDGET_MS of
 * them has run (at least one a frame, so the model always moves), and the rest of the sea's time is DEFERRED to
 * the next frames: the model runs that far behind the page's clock (`stats().liveDeferredS`, now and its
 * largest) and catches up when a strike's steps are cheap again. The budget is the 5 ms gate on the rocks' live
 * CPU less the frame's other parts on a quiet frame (the sources, the draw's plan and write: about 2 ms, round
 * 17's stats().cpuParts). A deferral past LIVE_MAX_STEPS * 4 steps still skips ahead (the history's reach).
 */
const LIVE_STEP_BUDGET_MS = 3;
/**
 * The foam field's disc slots (FOAM_DISC_SLOTS in oceanFoam.ts). Round 5: 256
 * (was 96): the model holds about 180 to 340 live discs at the judged hit,
 * and at 96 only the newest were laid, so the collar came out thin.
 */
const FIELD_SOURCE_SLOTS = FOAM_DISC_SLOTS;

/**
 * THE LIGHT ON THE ROCK, on the scale of the sea's own white. The surface
 * draws its foam, a white of albedo about 0.9, at 0.86 to 0.92 times
 * (0.7 + 0.3 n.l): a radiance of about 1.0 under the sun. A Lambertian
 * surface of albedo 0.9 draws at that radiance when the sun and the sky
 * together give an irradiance of about 3.5; the sky's share (pi times its
 * radiance, 0.3 at the zenith) is about 1, so the sun's is 3.0. The sun's
 * color is the sun through the air at its elevation (`sunThroughAir`), so a
 * dusk sun lights the rock orange.
 */
const ROCK_SUN_IRRADIANCE = 3;
/**
 * THE ROCK'S ALBEDO. Basalt and dark greywacke weather to a reflectance of
 * 0.06 to 0.12 (a dark rock's normal albedo). The reference rocks read black
 * against their water: k2's rock at 15 to 30 sRGB against water at 70 to
 * 110. Dry rock 0.09 in two tones (weathering patches a few meters across
 * and a 20 cm mottle); the dry top of a sea rock is paler still with salt
 * and lichen (ROCK_DRY_TOP_GAIN); wet rock is half (ROCK_WET_DARKEN).
 */
const ROCK_ALBEDO = 0.09;
const ROCK_DRY_TOP_GAIN = 1.5;
/**
 * WET ROCK IS DARKER (Lekner and Dorf 1988, Applied Optics 27: 1278): a
 * water film traps the light a rough surface scatters by total internal
 * reflection, so a dark stone's diffuse reflectance falls to about half. It
 * also gains a mirror sheen: the film's Fresnel reflection of the sky and a
 * sharp highlight of the sun (a water film's roughness is its ripples).
 */
const ROCK_WET_DARKEN = 0.5;
/**
 * ROUND 13: THE AIR BETWEEN THE EYE AND THE ROCK (Koschmieder 1924; GG-402 item 2). The sea's surface
 * hazes its water toward the horizon sky's radiance in the view's azimuth by 1 - exp(-beta d m), beta
 * the scene's air extinction (oceanSurface.ts HAZE_PER_M, 1.6e-4 per meter: a 24 km visibility) and m
 * the path's mean air density over the eye's height (HAZE_AIR_H_M, a scale height of 1 km). The rock
 * stood in the same air with none of it: at the telephoto's 85 m the air adds 1.35% of the horizon's
 * radiance, which is more than a dark wet stone's own light at dusk. The two values are the surface's
 * (not exported there; the surface owner's file): one air for the scene.
 */
const ROCK_AIR_PER_M = 1.6e-4;
const ROCK_AIR_H_M = 1000;
// Round 11: the stone under the film (ROCK_MICRO_ROUGH_M, ROCK_STONE_ROUGHNESS, ROCK_WATER_NU_M2S) is in oceanRocksMath.ts with the film laws' CPU twins.
/** Foam's color in the surface shader (`foamCol` in oceanSurface.ts), so the rock's white water is the sea's white. */
const FOAM_WHITE: [number, number, number] = [0.86, 0.9, 0.92];

/** Where the rocks' white water goes: the sea's foam field, or the rocks' own grid (the stopgap). */
export type RockFoamPath = 'field' | 'own';

export interface OceanRocksOptions {
  readonly renderer: THREE.WebGPURenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly field: OceanField;
  readonly sunDir: THREE.Vector3;
  readonly overcast: TslNode;
  readonly specs: readonly RockSpec[];
  /** Icosphere level per rock (5 is 10,242 vertices, 6 is 40,962). */
  readonly meshLevels?: readonly number[];
  /**
   * Round 3: 'field' (the default) writes the white water into the sea's
   * one foam field as a timed-disc source (`oceanFoamSources(field).add`);
   * the foam piece must run on the page to draw it. 'own' is the round-1
   * stopgap grid, kept only for an A/B.
   */
  readonly foamPath?: RockFoamPath;
  /**
   * Round 5: how the plume volume is drawn: one ray march a pixel against a
   * depth prepass of the rocks and the fine sea. Round 6 removed round 4's
   * 'slices' (see THE SLICE DRAW IS GONE in oceanSplash.ts).
   */
  readonly plumeDraw?: 'march';
}

export interface OceanRocks {
  readonly group: THREE.Group;
  readonly tables: readonly RockFaceTable[];
  readonly sim: RockSurf;
  update(simTime: number, dtS: number): void;
  /** The pinned time the drawn state belongs to, or null while none is settled. */
  readonly settledTime: number | null;
  /** Where the white water went on the last frame. */
  readonly foamPath: RockFoamPath | null;
  /** Live figures for a capture script. */
  stats(): Record<string, unknown>;
  /** Swap the splash's draw for a debug view (0 restores; see OceanSplashDraw.debug). */
  debugSpray(mode: number): void;
  /** Round 5: swap the marched plume for a debug view (0 restores, 1 its opacity, 2 the prepass distance; round 14: 4 the march's steps). */
  debugPlume(mode: number): void;
  /** Round 14: the stone's debug view (0 restores; 1 the film's depths as color, 2 the mirror share, 3 the specular light). */
  debugRock(mode: number): void;
  /** Round 18: the march's turbulence multiplier on (the law) or off (the mean density), for the A/B (THE EDGE TEARS). */
  setTurbulence(on: boolean): void;
  /** Round 19: the march's dome source on or off (THE PLUME SEES THE DOME, oceanSplash.ts), for the A/B. */
  setDome(on: boolean): void;
  /** The window scan (see `scan` in the body). */
  scan(t0: number, t1: number, every?: number, simTimeNow?: number): Promise<Array<Record<string, unknown>>>;
  /**
   * Round 6: the last pinned start's sea at the faces (the sampled times and
   * the raw readback), the face tables and the sea's params, as plain
   * arrays: a script replays the model on the CPU from them (RockSurf with
   * rockHistoryRow), so the plume's numbers are measured with no GPU.
   */
  dumpPrime(): Record<string, unknown> | null;
  dispose(): void;
}


export function createOceanRocks(opts: OceanRocksOptions): OceanRocks {
  const { renderer, camera, field } = opts;
  const group = new THREE.Group();
  group.name = 'oceanRocks';
  opts.scene.add(group);

  /* --- the rocks and their faces ------------------------------------ */

  const meshes = opts.specs.map((s, i) => buildRockMesh(s, opts.meshLevels?.[i] ?? 5));
  const tables = opts.specs.map((s, i) => rockFaceTable(s, meshes[i]));
  const sea = rockSeaParams(field.cascades, field.significantWaveHeightM);
  const sim = new RockSurf(tables, sea, { seed: 0x5eed0 });
  const history = new RockSeaHistory(tables.length * ROCK_SECTORS);
  const Q = tables.length * ROCK_SECTORS;

  /* --- the reef, written into the sea's one bathymetry --------------- */

  const bathy = oceanBathymetryFor(field.buffers);
  bathy.set(rockShelves(tables));
  bathy.setBands(field.cascades, ROCK_REEF_DEPTH_M);
  /** Whether the surface shoals over the bathymetry (its patch has landed or is served). */
  const surfaceShoals = (oceanSurfaceModule as unknown as Record<string, unknown>).OCEAN_SURFACE_SHOALS === true;
  /** Each band's shoaling gain at a grid point, as the surface applies it (1 when it does not shoal). */
  const bandGainAt = (g: TslNode, ci: number): TslNode => (surfaceShoals ? bathy.bandGain(ci, bathy.depthAt(g)) : float(1));

  /* --- the sea at the faces (compute) ------------------------------- */

  const queryPts: THREE.Vector4[] = [];
  for (const tab of tables) {
    const p = rockQueryPoints(tab);
    for (let s = 0; s < tab.sectors; s += 1) queryPts.push(new THREE.Vector4(p[s * 2], p[s * 2 + 1], 0, 0));
  }
  const uQuery = uniformArray(queryPts, 'vec4');
  const uCenter = uniform(new THREE.Vector2(0, 0));
  const uSlot = uniform(0, 'int');
  const uPrevSlot = uniform(0, 'int');
  const uHasPrev = uniform(0);
  const histAttr = new THREE.StorageBufferAttribute(new Float32Array(HIST_SLOTS * Q * 2 * 4), 4);
  const liveAttr = new THREE.StorageBufferAttribute(new Float32Array(LIVE_SLOTS * Q * 2 * 4), 4);
  const histBuf = storage(histAttr, 'vec4', HIST_SLOTS * Q * 2);
  const liveBuf = storage(liveAttr, 'vec4', LIVE_SLOTS * Q * 2);
  const sampler = createOceanSampler(field.buffers, uCenter);
  /** The summed, range-faded (and shoaled) displacement at grid point g, as the mesh sums it; w the foam deficit. */
  const sumDisp = (g: TslNode): TslNode => {
    let acc: TslNode = null;
    field.cascades.forEach((c, ci) => {
      const s = sampler.sampleCascade(sampler.disp, g, ci, c.patchM);
      const lod = sampler.cascadeLod(g, c.dispLod).mul(bandGainAt(g, ci));
      const d = vec4(s.x.mul(lod), s.y.mul(lod), s.z.mul(lod), c.drivesFoam ? float(1).sub(s.w).mul(lod) : float(0));
      acc = acc === null ? d : acc.add(d);
    });
    return acc;
  };
  const makeKernel = (out: TslNode, prev: TslNode) => Fn(() => {
    const i = instanceIndex;
    const q = uQuery.element(i);
    const target = vec2(q.x, q.y).toVar();
    const g = vec2(q.x, q.y).toVar();
    const d = vec4(0, 0, 0, 0).toVar();
    for (let it = 0; it < OCEAN_PROBE_INVERSION_ITERATIONS; it += 1) {
      d.assign(sumDisp(g));
      g.assign(target.sub(vec2(d.x, d.z)));
    }
    d.assign(sumDisp(g));
    const base = uSlot.mul(int(Q)).add(int(i)).mul(int(2));
    out.element(base).assign(d);
    // The parcel that stood here one sample ago: its grid point is the
    // target minus that sample's horizontal displacement.
    const pb = uPrevSlot.mul(int(Q)).add(int(i)).mul(int(2));
    const a = prev.element(pb);
    const gp = target.sub(vec2(a.x, a.z));
    const b = sumDisp(gp);
    out.element(base.add(int(1))).assign(vec4(b.x, b.y, b.z, uHasPrev));
  })().compute(Q);
  const kHist = makeKernel(histBuf, histBuf);
  const kLiveFromHist = makeKernel(liveBuf, histBuf);
  const kLive = makeKernel(liveBuf, liveBuf);
  const fftNodes = field.kernels.dispatches.map((d) => d.node) as unknown as Parameters<THREE.WebGPURenderer['compute']>[0];
  type ComputeArg = Parameters<THREE.WebGPURenderer['compute']>[0];
  const readback = async (attr: THREE.StorageBufferAttribute): Promise<Float32Array> => {
    const raw = await (renderer as unknown as { getArrayBufferAsync(a: unknown): Promise<ArrayBuffer> }).getArrayBufferAsync(attr);
    return new Float32Array(raw);
  };

  /* --- light shared by every material ------------------------------- */

  const uSun = uniform(opts.sunDir.clone().normalize());
  const sunAir = sunThroughAir(Math.asin(Math.min(Math.max(opts.sunDir.clone().normalize().y, -1), 1)));
  /** The sun's color through the air (the sky module's sun color at the test sun, times the air's change). */
  const uSunColor = uniform(new THREE.Vector3(1.0 * sunAir[0], 0.95 * sunAir[1], 0.85 * sunAir[2]));
  const overcast = opts.overcast;
  const sunVis = float(1).sub(overcast);
  const skyZenith = oceanSkyRadiance(vec3(0, 1, 0), uSun, 0, overcast);
  const skyLow = oceanSkyRadiance(normalize(vec3(uSun.x.negate(), float(0.12), uSun.z.negate())), uSun, 0, overcast);
  const uTime = uniform(0);
  // Round 14: the stone's debug view (debugRock): 0 the shipped draw, 1 the film's depths as color (red the
  // cascade's Nusselt film over 3 mm, green the draining film over 0.5 mm, blue the swash and the top sheet
  // over 2 cm), 2 the mirror share as grey, 3 the specular light alone.
  const uRockDebug = uniform(0);
  /** The lit white of foam, the surface's own formula (0.7 + 0.3 ndl, on the sun's side). */
  const foamLit = (ndl: TslNode): TslNode => vec3(...FOAM_WHITE).mul(float(0.7).add(ndl.mul(0.3).mul(sunVis)));
  /* ROUND 12: THE STONE SEES THE WHOLE SKY (the brief: the Kalaloch rock's luma p50 0.015 against
   * the clip's 0.069). Rounds 2 to 11 lit the stone by two samples of the sky, the zenith and one
   * point 7 degrees over the horizon opposite the sun, mixed by the normal's height. At dusk the
   * light of the sky is in the low glow round the sun and along the horizon, which neither sample
   * holds, so a face that looks at the sun's side of the sky took the dark anti-sun horizon. The
   * irradiance on a face is the integral of the sky's radiance over the dome it sees,
   * E(n) = integral of L(w) max(n . w, 0) dw: here SKY_DOME_N directions of equal solid angle
   * (cos(theta) evenly spaced, the azimuths by the golden angle), each 2 pi / SKY_DOME_N sr, read
   * from the ocean sky's own radiance function (no clouds: the reflection's cloud read is the
   * water's). The lower half of the sphere is the sea: each direction's mirror under the horizon
   * sees the sea's Fresnel reflection of that same sky, F(theta) L(w) with F = 0.02 + 0.98 (1 -
   * cos theta)^5, plus the light the water body sends up (the stone's own sea term, kept). It is
   * read per vertex on the mesh's normal (the dome changes slowly over the normals; the bumps keep
   * their own sun term). Kept: the sun's direct light (ROCK_SUN_IRRADIANCE through the air). */
  const SKY_DOME_N = 16;
  const uDome = uniformArray(Array.from({ length: SKY_DOME_N }, (_, k) => {
    const y = 1 - (k + 0.5) / SKY_DOME_N;
    const r = Math.sqrt(Math.max(1 - y * y, 0));
    const a = k * Math.PI * (3 - Math.sqrt(5));
    return new THREE.Vector4(r * Math.cos(a), y, r * Math.sin(a), 0);
  }), 'vec4');
  const seaBody = vec3(0.02, 0.035, 0.045).mul(mix(float(1), float(0.3), overcast));
  /** Round 13: a color at world point P seen through the scene's air (THE AIR BETWEEN THE EYE AND THE ROCK). */
  const airOver = (P: TslNode, col: TslNode): TslNode => {
    const toEye = P.sub(cameraPosition);
    const d = toEye.length();
    const toward = vec3(toEye.x, float(0), toEye.z.sub(float(1e-5)));
    const hazeCol = oceanSkyRadiance(normalize(toward), uSun, 0, overcast);
    const eyeH = max(cameraPosition.y, float(0.01));
    const airMean = float(ROCK_AIR_H_M).mul(float(1).sub(exp(eyeH.div(ROCK_AIR_H_M).negate()))).div(eyeH);
    const haze = float(1).sub(exp(d.mul(airMean).mul(-ROCK_AIR_PER_M)));
    return mix(col, hazeCol, haze);
  };
  /* ROUND 18: THE WHITE ROUND THE STONE LIGHTS IT (law 5; round 17: the camera-side faces read black, p50 0.023
   * against the clip's 0.069, lit by the sky dome and the sea's mirror of it only). The clip's faces stand in
   * white water: the foam round the foot and the plume over the rock are large bright surfaces, area lights of
   * the radiance the page draws them with (the one water: the stone sees the same foam the camera sees), the sea
   * surface's own lit foam, `foamLit` on a level face (FOAM_WHITE times 0.7 plus 0.3 of the sun's height; rk18d:
   * a Lambertian white under this page's own sun and sky irradiance, FOAM_WHITE E_h / pi, was 0.05 at dusk where
   * the surface draws its foam at 0.7, and the stone moved 0.023 to 0.024 only). The dome's samples read
   * them where they look: a direction under the horizon meets the sea at the distance (y - eta) / |w.y| from the
   * stone point, and there the sea is white by the face's white-water share (the breaking crest's share and the
   * swash roller's air at that face, B.z and B.w) within the backwash foam's reach of the face
   * (ROCK_COLLAR_REACH_M, the collar law's), its own mirror of the sky past it; a direction over the horizon that
   * points into the plume (a sphere at its water's mass centroid of radius its integral scale, uRockPlume) sees
   * the plume's white by its opacity, 1 - exp(-tau), tau its cross-section over its disk (uRockLive.z), the sky
   * behind it by the rest. The plume's white is the same lit-foam radiance (a cloud of drops many optical depths
   * thick scatters as a white body; Bohren 1987). Kept: the sky's and the sea's terms of round 12. */
  const whiteLit = foamLit(max(uSun.y, float(0)));
  const skyIrradiance = Fn(([nIn, pIn, seaY, whiteShare, plume, plumeA]: [TslNode, TslNode, TslNode, TslNode, TslNode, TslNode]) => {
    const n = normalize(nIn).toVar();
    const e = vec3(0, 0, 0).toVar();
    const above = max(pIn.y.sub(seaY), float(0.01));
    const toPl = plume.xyz.sub(pIn);
    const dPl = max(toPl.length(), float(1e-3));
    const cosPl = sqrt(max(float(1).sub(min(plume.w.div(dPl), float(1)).pow(2)), float(0)));
    const plDir = toPl.div(dPl);
    Loop({ start: int(0), end: int(SKY_DOME_N), type: 'int', condition: '<' }, ({ i }: { i: TslNode }) => {
      const w = uDome.element(i).xyz.toVar();
      const L = oceanSkyRadiance(w, uSun, 0, overcast).toVar();
      const inPlume = step(cosPl, dot(w, plDir)).mul(plumeA);
      e.addAssign(mix(L, whiteLit, inPlume).mul(max(dot(n, w), float(0))));
      const fr = float(0.02).add(float(0.98).mul(pow(float(1).sub(w.y), float(5))));
      const reach = above.div(max(w.y, float(1e-3)));
      const white = whiteShare.mul(float(1).sub(smoothstep(float(ROCK_COLLAR_REACH_M * 0.75), float(ROCK_COLLAR_REACH_M * 1.25), reach)));
      e.addAssign(mix(L.mul(fr).add(seaBody), whiteLit, white).mul(max(dot(n, vec3(w.x, w.y.negate(), w.z)), float(0))));
    });
    return e.mul((2 * Math.PI) / SKY_DOME_N);
  });

  // Build once with the original live node/uniform references; updates and disposal stay below.
  const { rockMeshes, rockUniforms, plumeVals, rockMats } = createRockMaterialSetup({
    tables, opts, ROCK_ALBEDO, ROCK_DRY_TOP_GAIN, uTime, uSun, skyIrradiance, ROCK_WET_DARKEN, uSunColor, ROCK_SUN_IRRADIANCE, sunVis, overcast, airOver, uRockDebug, meshes, group, skyLow, skyZenith, foamLit
  });

  /* --- the splash: the shared model's draw --------------------------- */

  const overcastValue = () => Number((overcast as { value?: number }).value ?? 0);
  // ROUND 3: the sheets, strands and mist are drawn as a lit volume (one
  // per rock, below); the particle draw shows only the drops at the rim and
  // the drips off the edges.
  // ROUND 6: THE DROPS ARE IN THE VOLUME ONLY. Rounds 3 to 5 also drew each
  // drop parcel as one sprite at 0.3 of its alpha (a look number); a parcel
  // stands for thousands of drops, which the volume already holds as their
  // cross-section (sigma = n pi r^2 Q). The particle draw keeps the falls
  // off the rock's edges (the pour-off, out of this round's scope).
  const splashDraw = createOceanSplashDraw({
    renderer, camera, pool: sim.splash, sunDir: opts.sunDir, overcast: overcastValue(), name: 'oceanRockSpray',
    drawKinds: [SPLASH_FALL],
  });
  // ROUND 4: THE DROPS DRAW UNDER THE PLUME. Both round-3 judges saw "hard
  // same-size white sprite dots" over the plume and "sprite speckle" over the
  // rock: the drops drew after the volume (render order 14 over 13), so every
  // drop inside the dense plume showed on its face. Drawn before it (12.5),
  // a drop inside the plume is covered by the medium in front of it, and
  // only the drops that leave the rim show, on their arcs.
  splashDraw.mesh.renderOrder = 12.5;
  group.add(splashDraw.mesh);
  /**
   * THE PLUME AS A VOLUME, one grid per rock (SplashVolume in
   * oceanSplashMath.ts). The cell is 0.2 m: a plume's lobes are 20 to 60 cm
   * (sl_003) and the draw's detail noise carries what is finer. The main
   * rock's grid is 11.2 x 9.6 x 9.6 m (a 14 m/s jet, the cap, climbs 10 m;
   * the curtain is as long as the 6.7 m rock plus its fan), the small
   * rocks' 7.2 x 6.4 x 6.4 m.
   */
  const VOLUME_CELL_M = 0.2;
  /* ROUND 15: THE CORE IS DENSE (GG-405; SplashVolume.coreDraw). The march's water over the root is laid on
   * a 0.1 m grid in the root's box: over each rock's waterline (its largest radius) plus CORE_MARGIN_M, from
   * CORE_FLOOR_M under the sea to CORE_HEIGHTS rock heights over it (the brief's core box, the first 1.5 rock
   * heights over the root, where the sheets leave the faces). A numeric budget, not a look: the box's cells
   * (the main rock 86 x 38 x 86 at 0.1 m) bound the upload, and the march's steps are counted
   * (debugPlume(4)). */
  const CORE_CELL_M = 0.1;
  const CORE_HEIGHTS = 1.5;
  const CORE_MARGIN_M = 1.0;
  const CORE_FLOOR_M = 0.5;
  const coreBox = tables.map((t) => {
    let r = 0;
    for (let s = 0; s < t.sectors; s += 1) r = Math.max(r, t.waterlineM[s]);
    const half = r + CORE_MARGIN_M;
    const n = Math.ceil((2 * half) / CORE_CELL_M);
    const ny = Math.ceil((CORE_HEIGHTS * t.topM + CORE_FLOOR_M) / CORE_CELL_M);
    return { x0: t.centerX - half, y0: -CORE_FLOOR_M, z0: t.centerZ - half, n, ny };
  });
  const volumes = tables.map((_, ri) => {
    const cb = coreBox[ri];
    const v = new SplashVolume(ri === 0
      ? { nx: 56, ny: 48, nz: 48, cellM: VOLUME_CELL_M, coreN: [cb.n, cb.ny, cb.n], coreCellM: CORE_CELL_M }
      : { nx: 36, ny: 32, nz: 32, cellM: VOLUME_CELL_M, coreN: [cb.n, cb.ny, cb.n], coreCellM: CORE_CELL_M });
    v.setCore(cb.x0, cb.y0, cb.z0);
    return v;
  });
  // ROUND 5: THE PLUME IS ONE MARCHED VOLUME (see WHY A MARCH in
  // oceanSplash.ts). Both round-4 judges named the slice stack's own marks:
  // "dithered, stippled" tongues, "stacked, vertically smeared gray columns",
  // edges with "a dither pattern". The march stops at the rocks and the fine
  // sea round them, drawn alone into a depth prepass each frame (the rocks'
  // proxies are added below, the fine sea's after its mesh is built).
  const prepass = createOceanSplashDepthPrepass({ renderer, camera, scale: MARCH_SCALE });
  const marchDraws = volumes.map((volume, ri) => createOceanSplashMarchDraw({
    volume, camera, sunDir: opts.sunDir, overcast: overcastValue(), skyZenith, skyLow, sceneDistance: prepass.texture, renderer, name: `oceanRockPlume${ri}`,
  }));
  const volumeDraws = marchDraws;
  for (const m of rockMeshes) prepass.add(m);
  // ROUND 6: THE SHEETS, STRANDS AND DROPS ARE DRAWN DIRECTLY (see WHICH
  // WATER THE GRID DRAWS in oceanSplashMath.ts): the 0.2 m grid cannot hold
  // a ligament of 1 to 3 cm or a tongue of 5 to 10 cm, so each parcel is a
  // sprite with its own optical depth, lit from its rock's light grid.
  const dropDraw = createOceanSplashDropDraw({
    renderer, camera, pool: sim.splash, volumes, sunDir: opts.sunDir, overcast: overcastValue(), skyZenith, skyLow, name: 'oceanRockDrops',
    // Round 13: each sprite's pixels read its rock's light grid (THE PLUME IS LIT AS ONE MASS, oceanSplash.ts).
    lightGrids: marchDraws.map((d) => d.light),
  });
  group.add(dropDraw.mesh);
  for (const d of volumeDraws) group.add(d.mesh);
  /** The light through each plume is marched on one write in VOLUME_LIGHT_EVERY live (every write when pinned). */
  const VOLUME_LIGHT_EVERY = 2;
  // Round 14: THE LOW SUN IS CUT BY THE ROCK AND THE CREST (SplashVolume.light): the rocks' tops on a
  // 0.2 m raster (static), and the water standing against each rock's faces (the model's own level
  // there, the sector's eta, out to a quarter past the waterline: the crest that climbs the face).
  const topRaster = rockTopRaster(tables, 0.2);
  let occMax = 0;
  for (const t of tables) occMax = Math.max(occMax, t.topM);
  const waterMax = tables.map((t) => Math.max(...t.waterlineM));
  const occluderTopAt = (x: number, z: number): number => {
    let h = rockTopRasterAt(topRaster, x, z);
    for (let ri = 0; ri < tables.length; ri += 1) {
      const t = tables[ri];
      const dx = x - t.centerX; const dz = z - t.centerZ;
      const r = Math.sqrt(dx * dx + dz * dz);
      if (r > 1.25 * waterMax[ri]) continue;
      const { i0, i1, f } = rockSectorOf(t, Math.atan2(dz, dx));
      if (r > 1.25 * (t.waterlineM[i0] * (1 - f) + t.waterlineM[i1] * f)) continue;
      const sc = sim.rocks[ri].sectors;
      h = Math.max(h, Math.max(sc[i0].etaM, sc[i0].standingM) * (1 - f) + Math.max(sc[i1].etaM, sc[i1].standingM) * f);
    }
    return h;
  };
  let volumeWrites = 0;

  // Per rock: the center (x, z) and the fine zone's outer radius; per rock
  // and sector: (mound height, skin radius at still water).
  const rockCenters: THREE.Vector4[] = tables.map((t) => {
    let rMax = 0;
    for (let s = 0; s < t.sectors; s += 1) rMax = Math.max(rMax, t.waterlineM[s]);
    return new THREE.Vector4(t.centerX, t.centerZ, rMax, 0);
  });
  const uRockCenters = uniformArray(rockCenters, 'vec4');
  const moundVals: THREE.Vector4[] = [];
  // Round 8: per rock and slot, .z the lee waterline's distance down the
  // heading at offset k (THE LEE STARTS AT THE ROCK; ROCK_LEE_ENDS =
  // ROCK_SECTORS slots a rock), and .w the face's newest reflected value
  // (RockSurf.reflectNow, written each update).
  if (ROCK_LEE_ENDS !== ROCK_SECTORS) throw new Error('[ocean] The lee waterline rides the mound array: ROCK_LEE_ENDS must equal ROCK_SECTORS.');
  tables.forEach((t) => {
    const { ends } = rockLeeOf(t, sea.windDirRad);
    for (let s = 0; s < ROCK_SECTORS; s += 1) moundVals.push(new THREE.Vector4(0, t.waterlineM[s], ends[s], 0));
  });
  // A fixed name (build-time round 1): oceanRockReflected, a layout Fn, reads it; see THE LAYOUT FN'S UNIFORMS.
  const uMound = uniformArray(moundVals, 'vec4').label('oceanRockMound');
  // Round 11: per rock and sector, the face's run from the waterline to its rim, over which the
  // reflected wave holds (rockReflectHoldM, THE WATER AGAINST A FACE STANDS OVER ITS SUBMERGED PART).
  const holdVals: number[] = [];
  tables.forEach((t) => { for (let s = 0; s < ROCK_SECTORS; s += 1) holdVals.push(rockReflectHoldM(t, s)); });
  const uHold = uniformArray(holdVals, 'float').label('oceanRockHold');
  /**
   * THE WATER STANDS UP AGAINST THE STRUCK FACE: the lift of the sea at
   * world XZ `p` near rock `ri` (an int node), from the model's per-sector
   * mound (the reflected part of the run-up, `writeDraw`), falling off from
   * the skin over MOUND_DECAY_M. Inside the skin the water is under the
   * rock, and the lift goes to 0 within 0.6 m of it (a lift there would
   * raise the sea over the rock's own top). The fine water and the foam
   * both take it, so the foam rides the mound.
   */
  // Round 7: the mound is now only the own-foam stopgap's (`foamPath: 'own'`, an A/B);
  // the sea's own surface carries the reflected wave (THE ROCK READER, below).
  const MOUND_DECAY_M = 1.6;
  const moundAt = (p: TslNode, ri: TslNode): TslNode => {
    const rc = uRockCenters.element(ri);
    const rel = vec2(p.x.sub(rc.x), p.y.sub(rc.y));
    const rr = rel.length();
    const az = atan(rel.y, rel.x);
    const u = fract(az.div(Math.PI * 2).sub(tables[0].azimuthRad[0] / (Math.PI * 2))).mul(ROCK_SECTORS);
    const s0 = bitAnd(int(floor(u)), int(ROCK_SECTORS - 1));
    const s1 = bitAnd(s0.add(int(1)), int(ROCK_SECTORS - 1));
    const m = mix(uMound.element(ri.mul(int(ROCK_SECTORS)).add(s0)), uMound.element(ri.mul(int(ROCK_SECTORS)).add(s1)), fract(u));
    const dSigned = rr.sub(m.y);
    const d = max(dSigned, float(0));
    const inside = smoothstep(float(-0.6), float(0), dSigned);
    return m.x.mul(exp(d.div(MOUND_DECAY_M).negate())).mul(inside);
  };

  /* --- the rock reader: the sea knows the rock (round 7) --------------- */

  // THE REFLECTED WAVE'S RING (RockSurf.reflectRing), four steps a vec4:
  // element q * RING / 4 + slot / 4, component slot % 4.
  const RING = ROCK_REFLECT_RING;
  if ((RING & (RING - 1)) !== 0) throw new Error('[ocean] ROCK_REFLECT_RING must be a power of two (the ring wraps by a bit mask).');
  const ringVals: THREE.Vector4[] = Array.from({ length: (Q * RING) / 4 }, () => new THREE.Vector4());
  const uRing = uniformArray(ringVals, 'vec4').label('oceanRockRing');
  const uRingHead = uniform(0, 'int').label('oceanRockRingHead');
  // Round 8: the share of a slot since the newest slot (RockSurf.reflectPhase), fixed name as the ring's.
  const uRingPhase = uniform(0).label('oceanRockRingPhase');
  const SLOT_S = ROCK_REFLECT_SLOT_STEPS * ROCK_DT_S;
  const ringAt = (q: TslNode, k: TslNode): TslNode => {
    const slot = bitAnd(uRingHead.sub(k).add(int(RING * 64)), int(RING - 1));
    const idx = q.mul(int(RING)).add(slot);
    const v = uRing.element(idx.div(int(4)));
    const c = bitAnd(idx, int(3));
    return select(c.equal(int(0)), v.x, select(c.equal(int(1)), v.y, select(c.equal(int(2)), v.z, v.w)));
  };
  /*
   * THE SHADER'S SIZE (the lead's gate after GG-388: the surface's shader
   * build with the river reader took 840 s). A TSL Fn is inlined at every
   * call unless it has a layout, and the surface calls a reader once per
   * band in its per-band loop. So the reader's two laws are WGSL functions
   * (`setLayout`: one copy each, called), the reader is read ONCE per vertex
   * (the lee of every band in one vec4, the reflected wave's slope with it),
   * and the fragment stage reads only two varyings of those values. Every
   * node the varyings hold is also in the vertex position's graph (the lift
   * carries a zero-weight term of them): three r172 does not set up the nodes
   * under a varying alone (the mouth builder's finding).
   */
  /** The reflected wave at world XZ `p` (THE REFLECTED WAVE; the CPU twin is rockReflectedWave). */
  const reflectedAt = Fn(([p]: [TslNode]) => {
    const acc = float(0).toVar();
    tables.forEach((tab, ri) => {
      const c = rockReflectSpeed(tab.reefDepthM);
      let rMax = 0;
      for (let s = 0; s < tab.sectors; s += 1) rMax = Math.max(rMax, tab.waterlineM[s]);
      const reach = rMax + c * RING * SLOT_S;
      const rel = vec2(p.x.sub(tab.centerX), p.y.sub(tab.centerZ)).toVar();
      const rr = rel.length().toVar();
      If(rr.lessThan(reach), () => {
        const az = atan(rel.y, rel.x);
        const u = fract(az.div(Math.PI * 2).sub(tab.azimuthRad[0] / (Math.PI * 2))).mul(ROCK_SECTORS);
        const s0 = bitAnd(int(floor(u)), int(ROCK_SECTORS - 1));
        const s1 = bitAnd(s0.add(int(1)), int(ROCK_SECTORS - 1));
        const f = fract(u);
        const skin = mix(uMound.element(int(ri * ROCK_SECTORS).add(s0)).y, uMound.element(int(ri * ROCK_SECTORS).add(s1)).y, f);
        const dS = rr.sub(skin);
        const d = max(dS, float(0));
        // Round 11: held over the face's submerged run, then 0 over the skin past it (rockReflectInside).
        const hold = mix(uHold.element(int(ri * ROCK_SECTORS).add(s0)), uHold.element(int(ri * ROCK_SECTORS).add(s1)), f);
        const inside = smoothstep(hold.add(ROCK_REFLECT_SKIN_M).negate(), hold.negate(), dS);
        // Round 8 (THE REFLECTED WAVE IS CONTINUOUS): the lag in time, then
        // in 30 Hz slots behind the newest slot; under the slot's phase the
        // wave is the line from the face's newest value (uMound.w) to it.
        const tau = d.div(c);
        const phi = uRingPhase.mul(SLOT_S);
        const lag = max(tau.sub(phi), float(0)).div(SLOT_S);
        const taper = float(1).sub(smoothstep(float(RING - 1 - ROCK_REFLECT_TAPER), float(RING - 1), lag));
        const k0 = int(floor(min(lag, float(RING - 2))));
        const fr = fract(lag);
        const near = step(phi, tau);
        const wNow = float(1).sub(tau.div(max(phi, float(1e-6)))).mul(float(1).sub(near));
        const q0 = int(ri * ROCK_SECTORS);
        const at = (q: TslNode, sec: TslNode) => mix(
          mix(ringAt(q, k0), ringAt(q, k0.add(int(1))), fr),
          uMound.element(int(ri * ROCK_SECTORS).add(sec)).w,
          wNow,
        );
        const val = mix(at(q0.add(s0), s0), at(q0.add(s1), s1), f);
        const spread = sqrt(skin.div(skin.add(d.mul(2))));
        acc.addAssign(inside.mul(taper).mul(spread).mul(val));
      });
    });
    return acc;
  }).setLayout({ name: 'oceanRockReflected', type: 'float', inputs: [{ name: 'p', type: 'vec2' }] });
  // THE LEE (oceanRocksMath.ts, THE LEE): each band's wavelength and each
  // rock's half-width across the waves' heading.
  const heading = sea.windDirRad;
  const hx = Math.cos(heading);
  const hz = Math.sin(heading);
  const leeA = tables.map((t) => rockLeeHalfWidth(t, heading));
  // Round 8: each rock's lee (THE LEE STARTS AT THE ROCK): its two edges across
  // the heading, and the lee waterline's nearest point down the heading (the guard).
  const lees = tables.map((t) => rockLeeOf(t, heading));
  const leeEndMin = lees.map((l) => Math.min(...l.ends) - 1e-3);
  const bandLambda = field.cascades.map((c) => rockBandLambda(c));
  /** erf (Abramowitz and Stegun 7.1.26, as rockErf). */
  const erfT = (x: TslNode): TslNode => {
    const a = abs(x);
    const t = float(1).div(a.mul(0.3275911).add(1));
    const poly = t.mul(1.061405429).sub(1.453152027).mul(t).add(1.421413741).mul(t).sub(0.284496736).mul(t).add(0.254829592).mul(t);
    return sign(x).mul(float(1).sub(poly.mul(exp(a.mul(a).negate()))));
  };
  /** The share of a band of wavelength `lam` that reaches `p` past every rock (THE LEE; the CPU twin is rockLeeShare). */
  const leeShareAt = Fn(([p, lam]: [TslNode, TslNode]) => {
    const share = float(1).toVar();
    tables.forEach((tab, ri) => {
      const dx = p.x.sub(tab.centerX);
      const dz = p.y.sub(tab.centerZ);
      const s = dx.mul(hx).add(dz.mul(hz)).toVar();
      // Round 8: the lee starts at the rock's lee waterline, which may lie up the heading of the center.
      If(s.greaterThan(float(leeEndMin[ri])), () => {
        // Round 8 (THE LEE STARTS AT THE ROCK): s from the lee waterline at
        // this offset (uMound.z, ROCK_LEE_ENDS offsets across the rock), the
        // strip's own two edges (round 7: one half-width for both sides), and the
        // shadow scaled by the body's scattering, min(1, (3 pi^2 / 8)(k a)^3).
        const ySigned = dz.mul(hx).sub(dx.mul(hz));
        const L = lees[ri];
        const mid = 0.5 * (L.aPlus - L.aMinus);
        const half = 0.5 * (L.aPlus + L.aMinus);
        // rockLeeEndAt: the offsets are mid + half sin(theta), theta even across -90..90 deg.
        const uE = asin(clamp(ySigned.sub(mid).div(half), float(-1), float(1))).add(Math.PI / 2).div(Math.PI).mul(ROCK_LEE_ENDS - 1);
        const e0 = min(floor(uE), float(ROCK_LEE_ENDS - 2));
        const e0i = int(e0);
        const sEnd = mix(uMound.element(int(ri * ROCK_SECTORS).add(e0i)).z, uMound.element(int(ri * ROCK_SECTORS).add(e0i).add(int(1))).z, uE.sub(e0));
        const sr = max(s.sub(sEnd), float(0));
        const w = sqrt(max(sr, float(1e-6)).mul(lam).div(Math.PI));
        const ka = float(2 * Math.PI * half).div(lam);
        const scatter = min(float(1), ka.mul(ka).mul(ka).mul((3 * Math.PI * Math.PI) / 8));
        const B = erfT(float(L.aPlus).sub(ySigned).div(w)).add(erfT(float(L.aMinus).add(ySigned).div(w))).mul(0.5).mul(scatter).mul(step(float(1e-6), sr));
        share.mulAssign(float(1).sub(B));
      });
    });
    return share;
  }).setLayout({ name: 'oceanRockLee', type: 'float', inputs: [{ name: 'p', type: 'vec2' }, { name: 'lam', type: 'float' }] });
  if (bandLambda.length > 4) throw new Error(`[ocean] The rock reader carries four band shares; this sea has ${bandLambda.length} cascades.`);
  /** The step of the slope's central difference, m (under the fine patch's 0.2 m cell). */
  const SLOPE_EPS_M = 0.05;
  /**
   * The reader's values at one vertex sample node, built once per node: the
   * lee of every band (vec4, 1 past the last band) and the reflected wave's
   * slope as the surface sums its bands' (THE SIGN, below).
   */
  const atSample = new Map<TslNode, { lee: TslNode; slope: TslNode; lift: TslNode }>();
  const fieldsAt = (w: TslNode) => {
    let f = atSample.get(w);
    if (!f) {
      const lees = [0, 1, 2, 3].map((ci) => (ci < bandLambda.length ? leeShareAt(w, float(bandLambda[ci])) : float(1)));
      const ex = vec2(SLOPE_EPS_M, 0);
      const ez = vec2(0, SLOPE_EPS_M);
      // THE SIGN: the surface sums each band's slope as its normal's x and z
      // over its y (oceanCompute.ts: nx = -(d eta / dx) ...), so a band adds
      // -grad(eta), and the surface's normal is normalize(sx, 1, sz). The
      // reflected wave adds its own -grad(eta) to that sum.
      const slope = vec2(
        reflectedAt(w.sub(ex)).sub(reflectedAt(w.add(ex))),
        reflectedAt(w.sub(ez)).sub(reflectedAt(w.add(ez))),
      ).div(2 * SLOPE_EPS_M);
      /* THE LAYOUT FN'S UNIFORMS (build-time round 1, GG-388). three r172 makes
       * the WGSL of a layout Fn once per builder class (its function cache) and
       * puts the same text in every later material. The uniforms the function
       * reads are declared only by the material that built it first, and under
       * that build's own names (nodeUniformN). The surface's main vertex stage
       * comes after the fine patch's, so it called a function on names it did
       * not declare: an invalid pipeline, an invalid command buffer, and a black
       * page for every sea with rocks (seen 2026-10-09, before and after the
       * type memo). Now the three uniforms carry fixed names (above), and the
       * lift reads each one with a zero weight, so every material that calls
       * the function declares them under those names. The term adds 0 (the
       * values are finite). oceanRockLee reads no uniform. */
      const declare = uRing.element(int(0)).x.add(uMound.element(int(0)).y).add(uHold.element(int(0))).add(float(uRingHead)).add(uRingPhase).mul(0);
      f = { lee: vec4(lees[0], lees[1], lees[2], lees[3]), slope, lift: reflectedAt(w).add(declare) };
      atSample.set(w, f);
    }
    return f;
  };
  /** The fragment's copies, one varying pair per vertex sample node. */
  const varyingAt = new Map<TslNode, { lee: TslNode; slope: TslNode }>();
  const varyingsOf = (vs: TslNode) => {
    // A fragment sample is the surface's varying of its vertex sample: read
    // the vertex's values through varyings (no law runs per pixel).
    const w = vs.node;
    let v = varyingAt.get(w);
    if (!v) {
      const f = fieldsAt(w);
      v = { lee: varying(f.lee, 'vRockLee'), slope: varying(f.slope, 'vRockSlope') };
      varyingAt.set(w, v);
    }
    return v;
  };
  const isVarying = (n: TslNode): boolean => n?.isVaryingNode === true && n.node !== undefined;
  const pick = (v4: TslNode, ci: number): TslNode => [v4.x, v4.y, v4.z, v4.w][ci];
  const rockReader: OceanRockReader = {
    sample: (w: TslNode) => fieldsAt(w),
    // The lift carries a zero-weight term of the lee and the slope, so the
    // vertex stage sets up every node the fragment's varyings hold.
    lift: (sample: TslNode) => {
      const f = fieldsAt(sample);
      return f.lift.add(dot(f.lee, vec4(0)).add(dot(f.slope, vec2(0))));
    },
    slope: (sample: TslNode) => (isVarying(sample) ? varyingsOf(sample).slope : fieldsAt(sample).slope),
    bandShare: (sample: TslNode, ci: number) => pick(isVarying(sample) ? varyingsOf(sample).lee : fieldsAt(sample).lee, ci),
  };
  // ONE REAL PATH: the surface must carry the hook (the lead's patch,
  // rocks/r7/patchSurfaceRocks.mjs in the gauntlet scratch).
  const surfaceRocks = field.surface as unknown as { setRocks?: (r: OceanRockReader | null) => void };
  if (typeof surfaceRocks.setRocks !== 'function') {
    throw new Error('[ocean] The rocks feed the sea\'s surface through a rock reader (rocks round 7), and this '
      + 'oceanSurface.ts has no setRocks: apply .agent/scratch/ocean-gauntlet/rocks/r7/patchSurfaceRocks.mjs.');
  }
  surfaceRocks.setRocks(rockReader);

  /* --- the rocks' own foam (the stopgap path, `?rockFoam=own`) --------- */

  // THE LACE: the wake's own image (round 11's lace, `wakeLaceImage`), its
  // red channel a ranked field (uniform on 0 to 1: gaps and rafts with
  // popped cells), its blue channel streaks. Thresholding the rank by the
  // foam amount draws a coverage equal to the amount, with holes.
  const laceSize = 512;
  const laceTex = new THREE.DataTexture(wakeLaceImage(laceSize), laceSize, laceSize, THREE.RGBAFormat, THREE.UnsignedByteType);
  laceTex.wrapS = THREE.RepeatWrapping;
  laceTex.wrapT = THREE.RepeatWrapping;
  // NO MIP CHAIN. The rank is thresholded: a mip level averages a uniform
  // rank toward 0.5, and the threshold of a flat 0.5 draws the patch solid.
  // The threshold's soft edge widens with the rank's change across the
  // pixel (`fwidth`) instead.
  laceTex.magFilter = THREE.LinearFilter;
  laceTex.minFilter = THREE.LinearFilter;
  laceTex.generateMipmaps = false;
  laceTex.needsUpdate = true;
  /** Lace tiles, meters: the rafts' 7 m (their gaps 2 m and down, cells 10 cm to 0.5 m) and the streaks' 13 m. */
  const LACE_RAFT_M = 7;
  const LACE_STREAK_M = 13;
  const foamSampler = createOceanSampler(field.buffers, uCenter, { filtered: true });
  interface FoamLayer { tex: THREE.DataTexture; data: Uint8Array; uOrigin: TslNode; mesh: THREE.Mesh }
  const foamLayers: FoamLayer[] = [];
  const FOAM_MESH_N = 96;
  const windDir = new THREE.Vector2(Math.cos(sea.windDirRad), Math.sin(sea.windDirRad));
  tables.forEach((tab, ri) => {
    const data = new Uint8Array(ROCK_FOAM_N * ROCK_FOAM_N * 4);
    const tex = new THREE.DataTexture(data, ROCK_FOAM_N, ROCK_FOAM_N, THREE.RGBAFormat, THREE.UnsignedByteType);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;
    const uOrigin = uniform(new THREE.Vector2(0, 0));
    const size = ROCK_FOAM_N * ROCK_FOAM_CELL_M;
    const geom = new THREE.BufferGeometry();
    const v = FOAM_MESH_N + 1;
    const pos = new Float32Array(v * v * 3);
    for (let j = 0; j < v; j += 1) {
      for (let i = 0; i < v; i += 1) {
        const o = (j * v + i) * 3;
        pos[o] = tab.centerX - size / 2 + (i / FOAM_MESH_N) * size;
        pos[o + 1] = 0;
        pos[o + 2] = tab.centerZ - size / 2 + (j / FOAM_MESH_N) * size;
      }
    }
    const idx: number[] = [];
    for (let j = 0; j < FOAM_MESH_N; j += 1) {
      for (let i = 0; i < FOAM_MESH_N; i += 1) {
        const a = j * v + i;
        idx.push(a, a + v, a + 1, a + 1, a + v, a + v + 1);
      }
    }
    geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geom.setIndex(idx);
    const mat = new THREE.MeshBasicNodeMaterial();
    mat.name = `oceanRockFoam${ri}`;
    // The vertex is a GRID point of the sea: it lands where the sea's
    // displacement carries it, so the foam rides the water's own parcels.
    const gridXZ = vec2(positionLocal.x, positionLocal.z);
    let disp: TslNode = null;
    field.cascades.forEach((c, ci) => {
      const s = foamSampler.sampleCascade(foamSampler.disp, gridXZ, ci, c.patchM).xyz
        .mul(foamSampler.cascadeLod(gridXZ, c.dispLod)).mul(bandGainAt(gridXZ, ci));
      disp = disp === null ? s : disp.add(s);
    });
    const surf0 = vec3(positionLocal.x, 0, positionLocal.z).add(disp);
    // The foam rides the mound the fine water draws against a struck face.
    const surf = surf0.add(vec3(0, moundAt(vec2(surf0.x, surf0.z), int(ri)), 0));
    // 0.2 m toward the eye along the view ray: the same pixel, drawn over
    // the sea's coarse triangles (the buoy ring's 24 cm nudge, for the same reason).
    mat.positionNode = surf.add(normalize(cameraPosition.sub(surf)).mul(0.2));
    const gridW = attribute('position', 'vec3');
    const foamUV = vec2(gridW.x, gridW.z).sub(uOrigin).div(size);
    const fa = texture(tex, foamUV);
    const amount = fa.x.mul(ROCK_FOAM_MAX);
    const age = fa.y.mul(20);
    const along = gridW.x.mul(windDir.x).add(gridW.z.mul(windDir.y));
    const acrossW = gridW.z.mul(windDir.x).sub(gridW.x.mul(windDir.y));
    const raft = texture(laceTex, vec2(gridW.x, gridW.z).div(LACE_RAFT_M)).x;
    const streak = texture(laceTex, vec2(along.div(LACE_STREAK_M * 3), acrossW.div(LACE_STREAK_M))).z;
    const oldK = smoothstep(float(1.5), float(9.0), age);
    const rank = mix(raft, raft.mul(0.55).add(streak.mul(0.45)), oldK.mul(0.8));
    const cover = clamp(amount.mul(mix(float(0.85), float(0.45), oldK)), float(0), float(0.7));
    const soft = max(float(0.06), fwidth(rank).mul(1.5));
    const lace = smoothstep(rank.sub(soft), rank.add(soft), cover);
    const bright = mix(float(1.0), float(0.8), oldK);
    const ndlF = max(dot(vec3(0, 1, 0), uSun), float(0));
    mat.colorNode = foamLit(ndlF).mul(bright);
    mat.opacityNode = lace.mul(0.85);
    mat.transparent = true;
    mat.depthWrite = false;
    mat.fog = false;
    const mesh = new THREE.Mesh(geom, mat);
    mesh.name = `oceanRockFoam${ri}`;
    mesh.frustumCulled = false;
    mesh.renderOrder = 12;
    group.add(mesh);
    foamLayers.push({ tex, data, uOrigin, mesh });
  });

  /* --- the fine water round each rock -------------------------------- */

  /**
   * WHY A FINE PIECE OF THE SAME SEA. The ocean mesh is a warped grid whose
   * vertices are 3 to 5 m apart 45 to 90 m from the camera (the warp
   * x = R u^3), so a 6 m rock cuts one or two flat triangles of it: its
   * waterline is a straight line, and no water can stand up against its
   * face. This is the buoy piece's fine patch (oceanExtras/buoys.ts), for
   * the same reason: a square of the SAME surface round each rock, 0.2 m
   * between vertices, drawn with a clone of the ocean's material (the same
   * displacement, normals, shading and uniforms, and the shoaling when the
   * surface has it), so it is the ocean, resolved. Within FINE_ZONE_M of a
   * rock's waterline its vertices take the exact field; toward its edge they
   * blend to the coarse mesh's own triangle, so at its edge it is the coarse
   * surface and there is no seam. Every vertex is moved PATCH_EYE_NUDGE_M
   * toward the camera along its view ray, so the patch wins the depth test
   * over the coarse sea, and it draws first so the coarse fragments under it
   * fail early. Near a face the patch rises by the reflected part of the
   * run-up (`moundAt`).
   *
   * COST (round 1, `rocks/perfParts.mjs`): the patch cost 1.0 ms at the
   * telephoto pose with a 4 m fine zone and a 6 m margin; a 2.5 m zone in a
   * 4 m margin keeps the mound's reach.
   */
  const FINE_ZONE_M = 2.5;
  const PATCH_MARGIN_M = 4;
  const PATCH_CELL_M = 0.2;
  const PATCH_EYE_NUDGE_M = 0.12;
  const oceanMat = field.surface.material as THREE.MeshBasicNodeMaterial;
  const uSurfaceCenter = uniform(new THREE.Vector2(0, 0));
  const exact = createOceanSampler(field.buffers, uSurfaceCenter);
  const dispAtWorld = (w: TslNode): TslNode => {
    let acc: TslNode = null;
    field.cascades.forEach((c, ci) => {
      // Round 7: the coarse mesh's own vertex takes the rocks' lee and their
      // reflected wave (the rock reader), so its corners here take them too.
      const d = exact.sampleCascade(exact.disp, w, ci, c.patchM).xyz.mul(exact.cascadeLod(w, c.dispLod)).mul(bandGainAt(w, ci))
        .mul(rockReader.bandShare(w, ci));
      acc = acc === null ? d : acc.add(d);
    });
    return (acc as TslNode).add(vec3(0, rockReader.lift(w), 0));
  };
  /** The coarse ocean mesh's own surface point for ocean-local grid XZ `P` (ocean-local xyz). */
  const coarseAtGrid = (P: TslNode): TslNode => {
    const R = float(OCEAN_RADIUS_M);
    if (OCEAN_WARP_POWER !== 3) throw new Error('[ocean] The rocks\' fine patch inverts a cubic warp; OCEAN_WARP_POWER changed.');
    const cellOf = (x: TslNode) => cbrt(x.div(R)).add(1).mul(0.5 * OCEAN_MESH_SIDE);
    const i0 = floor(cellOf(P.x));
    const j0 = floor(cellOf(P.y));
    const warp = (idx: TslNode) => {
      const u = idx.div(OCEAN_MESH_SIDE).mul(2).sub(1);
      return sign(u).mul(abs(u).pow(3)).mul(R);
    };
    const x0 = warp(i0);
    const x1 = warp(i0.add(1));
    const z0 = warp(j0);
    const z1 = warp(j0.add(1));
    const fx = P.x.sub(x0).div(x1.sub(x0));
    const fz = P.y.sub(z0).div(z1.sub(z0));
    const corner = (x: TslNode, z: TslNode) => vec3(x, 0, z).add(dispAtWorld(vec2(x, z).add(uSurfaceCenter)));
    const pa = corner(x0, z0);
    const pb = corner(x1, z0);
    const pc = corner(x0, z1);
    const pd = corner(x1, z1);
    const lower = pa.mul(float(1).sub(fx).sub(fz)).add(pb.mul(fx)).add(pc.mul(fz));
    const upper = pd.mul(fx.add(fz).sub(1)).add(pc.mul(float(1).sub(fx))).add(pb.mul(float(1).sub(fz)));
    return mix(lower, upper, step(float(1), fx.add(fz)));
  };
  const patchGeom = new THREE.BufferGeometry();
  {
    const pos: number[] = [];
    const rockIdx: number[] = [];
    const idx: number[] = [];
    tables.forEach((t, ri) => {
      const half = rockCenters[ri].z + PATCH_MARGIN_M;
      const n = Math.ceil((2 * half) / PATCH_CELL_M);
      const v = n + 1;
      const base = pos.length / 3;
      for (let j = 0; j < v; j += 1) {
        for (let i = 0; i < v; i += 1) {
          pos.push(t.centerX - half + i * PATCH_CELL_M, 0, t.centerZ - half + j * PATCH_CELL_M);
          rockIdx.push(ri);
        }
      }
      for (let j = 0; j < n; j += 1) {
        for (let i = 0; i < n; i += 1) {
          const a = base + j * v + i;
          idx.push(a, a + v, a + 1, a + 1, a + v, a + v + 1);
        }
      }
    });
    patchGeom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    patchGeom.setAttribute('rockIndex', new THREE.Float32BufferAttribute(rockIdx, 1));
    patchGeom.setIndex(idx);
  }
  const patchMat = oceanMat.clone() as THREE.MeshBasicNodeMaterial;
  patchMat.name = 'oceanRockFinePatch';
  patchMat.positionNode = Fn(() => {
    // The patch's vertices are WORLD points; the cloned vertex stage reads
    // ocean-local ones (world minus the surface center), and the mesh sits
    // at that center. Shift before anything reads the position.
    const world = vec3(positionLocal.x, 0, positionLocal.z).toVar();
    positionLocal.assign(world.sub(vec3(uSurfaceCenter.x, 0, uSurfaceCenter.y)));
    const P = vec2(positionLocal.x, positionLocal.z);
    const fine = oceanMat.positionNode as TslNode;
    const ri = int(attribute('rockIndex', 'float'));
    const rc = uRockCenters.element(ri);
    const rel = vec2(world.x.sub(rc.x), world.z.sub(rc.y));
    const rr = rel.length();
    const w = float(1).sub(smoothstep(rc.z.add(FINE_ZONE_M - 1.0), rc.z.add(FINE_ZONE_M + 1.0), rr));
    const coarse = coarseAtGrid(P);
    const surf = mix(coarse, fine, w).toVar();
    // Round 7: the water against the faces is the sea's own reflected wave
    // (the rock reader, in both the fine and the coarse surface); round 2's
    // mound (moundAt, a 1.6 m fall-off) is gone from the patch.
    const lifted = surf;
    const toEye = cameraPosition.sub(lifted.add(vec3(uSurfaceCenter.x, 0, uSurfaceCenter.y))).normalize();
    return lifted.add(toEye.mul(PATCH_EYE_NUDGE_M));
  })();
  const finePatch = new THREE.Mesh(patchGeom, patchMat);
  finePatch.name = 'oceanRockFinePatch';
  finePatch.frustumCulled = false;
  finePatch.renderOrder = -1;
  group.add(finePatch);
  // The fine sea stands inside the plume's box too: its prepass copy takes
  // the patch's own vertex stage (the same displaced, lifted surface).
  if (prepass) prepass.add(finePatch, patchMat.positionNode as TslNode);
  /** Another piece may rebuild the ocean's fragment stage (setWake, setSeabed, setFoam); the clone follows it. */
  const syncPatchShading = () => {
    if (patchMat.fragmentNode !== oceanMat.fragmentNode) {
      patchMat.fragmentNode = oceanMat.fragmentNode;
      patchMat.needsUpdate = true;
    }
  };
  /* THE PATCH FOLLOWS THE SEA BEFORE EACH DRAW (build-time round 1, GG-388).
   * The sync ran only in update(), so a draw before the first update (the
   * underwater piece's warm-up renders, after every piece has set its reader)
   * built the patch with the fragment stage of the time the rocks mounted,
   * and the first update built it again: two builds and two compiles of a
   * 400 kB pipeline (15 to 17 s each on this machine). Synced in the draw
   * itself, the patch is built once, with the fragment stage it draws with.
   * The update keeps its call (no change when nothing changed). */
  finePatch.onBeforeRender = () => syncPatchShading();

  /* --- the foam path ------------------------------------------------- */

  // ROUND 3: THE WHITE WATER IS THE SEA'S FOAM (foam round 10 landed the
  // one source registry). The rocks' deposits go into the sea's one foam
  // field as a timed-disc source; the field's own lace, age and drift draw
  // the collar, the flanks and the cascade's foam. The own grid stays only
  // behind `foamPath: 'own'` for an A/B, and is then the only foam drawn.
  const foamPath: RockFoamPath = opts.foamPath ?? 'field';
  const foamSet = oceanFoamSources(field);
  const discSource = foamPath === 'field' ? oceanFoamDiscSource('rocks', FIELD_SOURCE_SLOTS) : null;
  // Round 17 (the cost): the model keeps its own foam grid only where it is drawn (RockSurf.ownFoam).
  sim.ownFoam = foamPath === 'own';
  /* ROUND 13: THE WATER ROUND THE ROCK MOVES THE FOAM (rockFlowAt in oceanRocksMath.ts). The disc source
   * also answers the foam field's optional hook `velocityAt(x, tS)` (rocks/patches/patchFoamFlow.mjs, for
   * the foam piece's file): the perturbation of the surge by each rock (-U a^2 / z^2, round a circle of
   * the rock's mean waterline radius) and the backwash's radial jet, read from the model's flow history
   * at the step's own time (the last closed sample before tS), so the field's pinned warm-up replays the
   * flow of its own times. A field without the hook never calls it, and nothing here changes a frame. */
  const R_FLOW = tables.length;
  const flowA: THREE.Vector4[] = Array.from({ length: ROCK_FLOW_SLOTS * R_FLOW }, () => new THREE.Vector4(-1, 0, 0, 0));
  const flowB: THREE.Vector4[] = Array.from({ length: ROCK_FLOW_SLOTS * R_FLOW * (ROCK_SECTORS / 4) }, () => new THREE.Vector4());
  const uFlowA = uniformArray(flowA, 'vec4').label('oceanRockFlowA');
  const uFlowB = uniformArray(flowB, 'vec4').label('oceanRockFlowB');
  const flowRadius = tables.map((t) => { let m = 0; for (let s = 0; s < t.sectors; s += 1) m += t.waterlineM[s]; return m / t.sectors; });
  const velocityAt = (x: TslNode, tS: TslNode): TslNode => {
    const kRead = floor(tS.div(ROCK_FLOW_SAMPLE_S).add(1e-6)).sub(1);
    const slot = bitAnd(int(kRead), int(ROCK_FLOW_SLOTS - 1));
    let acc: TslNode = vec2(0, 0);
    tables.forEach((tab, ri) => {
      const a = flowRadius[ri];
      const A = uFlowA.element(slot.mul(int(R_FLOW)).add(int(ri)));
      const valid = abs(A.x.sub(kRead)).lessThan(0.5);
      const rx = x.x.sub(tab.centerX); const rz = x.y.sub(tab.centerZ);
      const r2 = rx.mul(rx).add(rz.mul(rz)).max(1e-6);
      const r = sqrt(r2);
      const outside = r2.greaterThan(a * a);
      // (1) The surge's perturbation round the circle, in U's frame.
      const Um = vec2(A.y, A.z).length();
      const ex = A.y.div(Um.max(1e-6)); const ez = A.z.div(Um.max(1e-6));
      const qx = rx.mul(ex).add(rz.mul(ez)); const qy = rz.mul(ex).sub(rx.mul(ez));
      const a2r4 = float(a * a).div(r2.mul(r2));
      const up = Um.negate().mul(a2r4).mul(qx.mul(qx).sub(qy.mul(qy)));
      const vp = Um.negate().mul(a2r4).mul(qx.mul(qy).mul(2));
      const surge = vec2(up.mul(ex).sub(vp.mul(ez)), up.mul(ez).add(vp.mul(ex)));
      // (2) The backwash of the face the point looks at, radial, as a / r, mixed out over the collar's reach.
      const u = fract(atan(rz, rx).div(Math.PI * 2).sub(tab.azimuthRad[0] / (Math.PI * 2))).mul(ROCK_SECTORS);
      const s0 = bitAnd(int(floor(u)), int(ROCK_SECTORS - 1));
      const s1 = bitAnd(s0.add(int(1)), int(ROCK_SECTORS - 1));
      const base = slot.mul(int(R_FLOW)).add(int(ri)).mul(int(ROCK_SECTORS / 4));
      const pick = (sec: TslNode): TslNode => {
        const v = uFlowB.element(base.add(sec.div(int(4))));
        const c = bitAnd(sec, int(3));
        return select(c.equal(int(0)), v.x, select(c.equal(int(1)), v.y, select(c.equal(int(2)), v.z, v.w)));
      };
      const ub = mix(pick(s0), pick(s1), fract(u));
      const sp = ub.mul(float(a).div(r)).mul(exp(r.sub(a).div(ROCK_COLLAR_REACH_M).negate()));
      const wash = vec2(rx, rz).div(r).mul(sp);
      acc = acc.add(select(valid.and(outside), surge.add(wash), vec2(0, 0)));
    });
    return acc;
  };
  /* ROUND 15: THE ROOT IS THE BREAKING CREST AT THE FACE (rockFaceBreakerShare, rockFaceRollerReachM,
   * rockFaceBreakerCover in oceanRocksMath.ts). The disc source also gives the foam field's ACTIVE BREAKER
   * (foam round 11, `OceanFoamSource.breakerAt`): where a struck face's standing crest breaks on the reef,
   * the roller covers the crest's face from the waterline out over its reach, the rock owns the breaking
   * there, and the crest runs at its own speed sqrt(g (d + eta)) along the sea's heading. The field draws
   * the cover as its breaker channel B (the crest whitens as it rises against the face) and lays F at
   * least B under it (the collar). Read from the model's breaker history at the step's own time, as the
   * flow hook reads its flow, so the field's pinned warm-up replays the strikes of its own times. A field
   * step kernel with no source that gives `breakerAt` is unchanged (oceanFoam.ts). */
  const flowBrA: THREE.Vector4[] = Array.from({ length: ROCK_FLOW_SLOTS * R_FLOW }, () => new THREE.Vector4(-1, 0, 0, 0));
  // ROUND 19: THE COLLAR'S ROLLER FLOORS THE FOAM (oceanRocksMath.ts): the collar roller's share and reach by sector
  // (the model's breaker history's third and fourth blocks) ride in the SAME two arrays after the face's, at
  // BR_COLLAR_OFF: the foam step kernel binds at most 12 uniform buffers a stage (WebGPU's limit; two more arrays put
  // it at 14 and the kernel did not build), and one array is one buffer whatever its length (24 KB a rock here).
  const BR_COLLAR_OFF = ROCK_FLOW_SLOTS * R_FLOW * (ROCK_SECTORS / 4);
  const flowBrS: THREE.Vector4[] = Array.from({ length: 2 * BR_COLLAR_OFF }, () => new THREE.Vector4());
  const flowBrL: THREE.Vector4[] = Array.from({ length: 2 * BR_COLLAR_OFF }, () => new THREE.Vector4());
  const uBrA = uniformArray(flowBrA, 'vec4').label('oceanRockBreakA');
  const uBrS = uniformArray(flowBrS, 'vec4').label('oceanRockBreakShare');
  const uBrL = uniformArray(flowBrL, 'vec4').label('oceanRockBreakReach');
  // Each face's waterline radius (static), for the distance out from the face.
  const wlVals: THREE.Vector4[] = [];
  for (const tab of tables) for (let q = 0; q < ROCK_SECTORS / 4; q += 1) wlVals.push(new THREE.Vector4(tab.waterlineM[q * 4], tab.waterlineM[q * 4 + 1], tab.waterlineM[q * 4 + 2], tab.waterlineM[q * 4 + 3]));
  const uWaterline = uniformArray(wlVals, 'vec4').label('oceanRockWaterline');
  /** The edge of the roller's reach: the fine foam level's texel (the field's own resolution). */
  const BREAK_EDGE_M = FOAM_LEVELS[0].texelM;
  const crestDirX = Math.cos(sea.windDirRad);
  const crestDirZ = Math.sin(sea.windDirRad);
  const breakerAt = (x: TslNode, tS: TslNode): OceanFoamBreaker => {
    const kRead = floor(tS.div(ROCK_FLOW_SAMPLE_S).add(1e-6)).sub(1);
    const slot = bitAnd(int(kRead), int(ROCK_FLOW_SLOTS - 1));
    let cov: TslNode = float(0);
    let own: TslNode = float(0);
    let cMs: TslNode = float(0);
    let brk: TslNode = float(0);
    tables.forEach((tab, ri) => {
      const A = uBrA.element(slot.mul(int(R_FLOW)).add(int(ri)));
      const valid = abs(A.x.sub(kRead)).lessThan(0.5);
      const rx = x.x.sub(tab.centerX); const rz = x.y.sub(tab.centerZ);
      const r = sqrt(rx.mul(rx).add(rz.mul(rz)).max(1e-6));
      const u = fract(atan(rz, rx).div(Math.PI * 2).sub(tab.azimuthRad[0] / (Math.PI * 2))).mul(ROCK_SECTORS);
      const s0 = bitAnd(int(floor(u)), int(ROCK_SECTORS - 1));
      const s1 = bitAnd(s0.add(int(1)), int(ROCK_SECTORS - 1));
      const fr = fract(u);
      const pickOf = (arr: TslNode, base: TslNode) => (sec: TslNode): TslNode => {
        const v = arr.element(base.add(sec.div(int(4))));
        const c = bitAnd(sec, int(3));
        return select(c.equal(int(0)), v.x, select(c.equal(int(1)), v.y, select(c.equal(int(2)), v.z, v.w)));
      };
      const base = slot.mul(int(R_FLOW)).add(int(ri)).mul(int(ROCK_SECTORS / 4));
      const pS = pickOf(uBrS, base);
      const pL = pickOf(uBrL, base);
      const pW = pickOf(uWaterline, int(ri * (ROCK_SECTORS / 4)));
      const share = mix(pS(s0), pS(s1), fr);
      const reach = mix(pL(s0), pL(s1), fr);
      const pCs = pickOf(uBrS, base.add(int(BR_COLLAR_OFF)));
      const pCl = pickOf(uBrL, base.add(int(BR_COLLAR_OFF)));
      const shareC = mix(pCs(s0), pCs(s1), fr);
      const reachC = mix(pCl(s0), pCl(s1), fr);
      const d = r.sub(mix(pW(s0), pW(s1), fr));
      // rockFaceBreakerCover: the share over the reach, its edge one fine texel; nothing under the rock.
      const inReach = float(1).sub(smoothstep(reach.sub(BREAK_EDGE_M * 0.5), reach.add(BREAK_EDGE_M * 0.5), d));
      const here = valid.and(d.greaterThan(-BREAK_EDGE_M)).and(share.greaterThan(0)).and(reach.greaterThan(0));
      const c = select(here, share.mul(inReach), float(0));
      // ROUND 19: THE COLLAR'S ROLLER FLOORS THE FOAM: the collar roller's cover, its share over its own reach with
      // the same one-texel edge; the field takes the larger of the face's and the collar's, and the rock's band past
      // the reach follows the larger reach.
      const inReachC = float(1).sub(smoothstep(reachC.sub(BREAK_EDGE_M * 0.5), reachC.add(BREAK_EDGE_M * 0.5), d));
      const hereC = valid.and(d.greaterThan(-BREAK_EDGE_M)).and(shareC.greaterThan(0)).and(reachC.greaterThan(0));
      const cAll = max(c, select(hereC, shareC.mul(inReachC), float(0)));
      const reachAll = max(reach, reachC);
      // THE ROCK STOPS THE CREST: under the rock (its waterline less a texel) it owns the breaking, and every
      // wave there "breaks" (breaking 1) with no roller (cover 0), so B is 0 there and the field's own
      // breakers, which run along the sea's heading with no knowledge of the rock, do not pass through it
      // (rk15b: the face's roller ran on as a sea breaker through the rock and laid a trail on the lee).
      const inRock = d.lessThan(-BREAK_EDGE_M);
      // ROUND 16: THE ROLLER'S FLOOR STAYS UNDER THE ROLLER (GG-408; round 15's collar SHARE 0.661 against the
      // clip's 0.254). The roller is the crest's own aerated face while it stands breaking against the rock:
      // it covers 0.9 H out from the waterline (rockFaceRollerReachM) and runs on with its crest inside that
      // reach (round 15's law, kept). Round 15 handed it to the sea's breaker law at the reach's edge, which
      // runs a breaker on for its own 5 s life (FOAM_BREAKER_TAU_S) laying foam as it goes, and the surge
      // carried that foam round the base: the white sheet. Now the rock also owns a band of two foam texels
      // past each face's reach (the band no breaker crosses in one step; on a face that is not struck, reach
      // 0, the two texels at its waterline), with breaking 1 and no cover there: the roller's B ends at its
      // reach, the field's F floor (B under the roller) is laid only under the roller, and the foam the roller
      // laid is carried by the surge (velocityAt) and ages by the field's own clock.
      const ring = d.lessThan(reachAll.add(BREAK_EDGE_M * 2));
      const o = select(inRock.or(valid.and(ring)), float(1), float(0));
      const underRoller = d.lessThan(reachAll.add(BREAK_EDGE_M * 0.5));
      cov = max(cov, cAll);
      brk = max(brk, select(inRock, float(1), select(underRoller, cAll, o)));
      cMs = select(o.greaterThan(own), A.y, cMs);
      own = max(own, o);
    });
    const velocity = vec2(float(crestDirX).mul(cMs), float(crestDirZ).mul(cMs));
    return { cover: cov, breaking: brk, own, velocity };
  };
  if (discSource) Object.assign(discSource, { velocityAt, breakerAt });
  // The field lays the breaking crest's white water (the roller's F floor): the model does not lay it twice.
  sim.breakerInField = discSource !== null;
  /** Copy the model's flow history into the hook's arrays (THE WATER ROUND THE ROCK MOVES THE FOAM). */
  const writeFlow = () => {
    // Round 15: the breaker's history (THE ROOT IS THE BREAKING CREST AT THE FACE).
    {
      const br = sim.breakRing;
      const BS = RockSurf.BREAK_STRIDE;
      for (let slot = 0; slot < ROCK_FLOW_SLOTS; slot += 1) {
        for (let ri = 0; ri < R_FLOW; ri += 1) {
          const o = (slot * R_FLOW + ri) * BS;
          flowBrA[slot * R_FLOW + ri].set(br[o], br[o + 1], 0, 0);
          for (let q = 0; q < ROCK_SECTORS / 4; q += 1) {
            const so = o + 2 + q * 4;
            const lo = o + 2 + ROCK_SECTORS + q * 4;
            flowBrS[(slot * R_FLOW + ri) * (ROCK_SECTORS / 4) + q].set(br[so], br[so + 1], br[so + 2], br[so + 3]);
            flowBrL[(slot * R_FLOW + ri) * (ROCK_SECTORS / 4) + q].set(br[lo], br[lo + 1], br[lo + 2], br[lo + 3]);
            // Round 19: the collar roller's share and reach (THE COLLAR'S ROLLER FLOORS THE FOAM).
            const co = o + 2 + 2 * ROCK_SECTORS + q * 4;
            const cl = o + 2 + 3 * ROCK_SECTORS + q * 4;
            flowBrS[BR_COLLAR_OFF + (slot * R_FLOW + ri) * (ROCK_SECTORS / 4) + q].set(br[co], br[co + 1], br[co + 2], br[co + 3]);
            flowBrL[BR_COLLAR_OFF + (slot * R_FLOW + ri) * (ROCK_SECTORS / 4) + q].set(br[cl], br[cl + 1], br[cl + 2], br[cl + 3]);
          }
        }
      }
    }
    const ring = sim.flowRing;
    const S = RockSurf.FLOW_STRIDE;
    for (let slot = 0; slot < ROCK_FLOW_SLOTS; slot += 1) {
      for (let ri = 0; ri < R_FLOW; ri += 1) {
        const o = (slot * R_FLOW + ri) * S;
        flowA[slot * R_FLOW + ri].set(ring[o], ring[o + 1], ring[o + 2], 0);
        for (let q = 0; q < ROCK_SECTORS / 4; q += 1) {
          flowB[(slot * R_FLOW + ri) * (ROCK_SECTORS / 4) + q].set(ring[o + 3 + q * 4], ring[o + 4 + q * 4], ring[o + 5 + q * 4], ring[o + 6 + q * 4]);
        }
      }
    }
  };
  const removeDiscSource = discSource ? foamSet.add(discSource) : null;
  for (const L of foamLayers) L.mesh.visible = foamPath === 'own';
  /** The last disc list handed to the field, as a key: a changed list on a pinned page asks for a replay. */
  let discKey = '';
  /** The field has been asked to replay its warm-up for this pinned time. */
  let fieldReplayFor: number | null = null;
  let fieldReplayFrames = 0;

  /* --- the clock ----------------------------------------------------- */

  let settledTime: number | null = null;
  let modelSettledFor: number | null = null;
  let primingFor: number | null = null;
  let primes = 0;
  let liveRestarts = 0;
  let liveSlot = -1;
  /** Where the previous sample's A vectors live on the GPU: 'hist' slot, 'live' slot, or none. */
  let prevRef: { buf: 'hist' | 'live'; slot: number } | null = null;
  /** The previous sample's A vectors and time, CPU side, for the velocity difference. */
  let lastA: Float32Array | null = null;
  let lastT = 0;
  const pendingLive: Array<{ slot: number; t: number }> = [];
  let liveInFlight = false;
  let liveEpoch = 0;
  let lastDrawnStep = -1;
  let disposed = false;
  let sourcesSet = 0;

  const setCenter = () => {
    const c = field.surface.center;
    uCenter.value.set(c.x, c.y);
    uSurfaceCenter.value.set(c.x, c.y);
    finePatch.position.set(c.x, 0, c.y);
  };

  /** Rows from a raw readback: A vectors at [slot*Q*8 + q*8], B at +4. */
  const aOf = (raw: Float32Array, slotOff: number): Float32Array => {
    const a = new Float32Array(Q * 8);
    a.set(raw.subarray(slotOff, slotOff + Q * 8));
    return a;
  };

  /**
   * Step the sea to every time in `times`, read the faces after each step
   * into the history buffer, and put the sea back at `restoreT`. Every call
   * is its own submit, so each kernel sees the clock and the slot written
   * just before it. Returns the readback.
   */
  const sampleTimes = (times: Float64Array, restoreT: number): Promise<Float32Array> => {
    if (times.length > HIST_SLOTS) throw new Error(`[ocean] Rocks: ${times.length} sea rows asked, the buffer holds ${HIST_SLOTS}.`);
    setCenter();
    const uT = field.kernels.uTime;
    for (let i = 0; i < times.length; i += 1) {
      uT.value = times[i];
      renderer.compute(fftNodes);
      uSlot.value = i;
      uPrevSlot.value = Math.max(i - 1, 0);
      uHasPrev.value = i > 0 ? 1 : 0;
      renderer.compute(kHist as unknown as ComputeArg);
    }
    // Put the sea back where the frame is drawn.
    uT.value = restoreT;
    renderer.compute(fftNodes);
    return readback(histAttr);
  };
  /** Round 6: the last sampled readback, kept for `dumpPrime` (a CPU replay of the model in a test script). */
  let lastPrime: { raw: Float32Array; times: Float64Array } | null = null;
  /** Fill `history` from a sampled readback. */
  const fillHistory = (raw: Float32Array, times: Float64Array) => {
    lastPrime = { raw, times };
    history.clear();
    let prev: Float32Array | null = null;
    let prevOff = 0;
    for (let i = 0; i < times.length; i += 1) {
      const off = i * Q * 8;
      const row = rockHistoryRow(Q, raw, off, prev, prevOff, i > 0 ? times[i] - times[i - 1] : 0);
      history.push(times[i], row, 1e9);
      prev = raw;
      prevOff = off;
    }
  };

  /**
   * The sea center a pinned prime read the faces with (round 3). The
   * surface's dense center follows the camera and lands a frame after a
   * pose change; the face read's range fade depends on it, so a prime
   * started on the frame of a pose change read the old center, and the
   * same pinned time drew two plumes (rk3m against the rk3fin strip). A
   * pinned state whose center has moved since is primed again.
   */
  const primedCenter = new THREE.Vector2(Number.NaN, Number.NaN);
  const startPrime = (tEnd: number) => {
    primingFor = tEnd;
    primedCenter.set(field.surface.center.x, field.surface.center.y);
    primes += 1;
    const times = rockPrimeTimes(tEnd);
    const epoch = ++liveEpoch;
    void sampleTimes(times, tEnd).then((raw) => {
      if (disposed || primingFor !== tEnd || epoch !== liveEpoch) return;
      fillHistory(raw, times);
      lastA = aOf(raw, (times.length - 1) * Q * 8);
      lastT = tEnd;
      prevRef = { buf: 'hist', slot: times.length - 1 };
      sim.reset(times[0]);
      const steps = Math.round((tEnd - times[0]) / ROCK_DT_S);
      for (let s = 0; s < steps; s += 1) sim.step(ROCK_DT_S, history);
      sim.time = tEnd;
      modelSettledFor = tEnd;
      primingFor = null;
      lastDrawnStep = -1;
    });
  };

  const restartLive = (t: number) => {
    liveRestarts += 1;
    liveEpoch += 1;
    history.clear();
    sim.reset(t);
    prevRef = null;
    lastA = null;
    pendingLive.length = 0;
    settledTime = null;
    modelSettledFor = null;
    primingFor = null;
    fieldReplayFor = null;
  };

  const liveSample = (t: number) => {
    setCenter();
    liveSlot = (liveSlot + 1) % LIVE_SLOTS;
    uSlot.value = liveSlot;
    if (prevRef === null) {
      uPrevSlot.value = liveSlot;
      uHasPrev.value = 0;
      renderer.compute(kLive as unknown as ComputeArg);
    } else {
      uPrevSlot.value = prevRef.slot;
      uHasPrev.value = 1;
      renderer.compute((prevRef.buf === 'hist' ? kLiveFromHist : kLive) as unknown as ComputeArg);
    }
    prevRef = { buf: 'live', slot: liveSlot };
    pendingLive.push({ slot: liveSlot, t });
    if (pendingLive.length > LIVE_SLOTS - 2) restartLive(t);
  };

  const kickLiveReadback = () => {
    if (liveInFlight || pendingLive.length === 0) return;
    const batch = pendingLive.splice(0);
    const epoch = liveEpoch;
    liveInFlight = true;
    void readback(liveAttr).then((raw) => {
      liveInFlight = false;
      if (disposed || epoch !== liveEpoch) return;
      for (const { slot, t } of batch) {
        if (history.length && t <= history.lastTime) continue;
        const off = slot * Q * 8;
        const dt = lastA !== null ? t - lastT : 0;
        const row = rockHistoryRow(Q, raw, off, lastA, 0, dt);
        history.push(t, row, 8);
        lastA = aOf(raw, off);
        lastT = t;
      }
    }).catch(() => { liveInFlight = false; });
  };

  /* --- writing the model to the draw ---------------------------------- */

  const writeDraw = () => {
    // Round 7: the reflected wave's ring for the rock reader.
    {
      const r = sim.reflectRing;
      for (let k = 0; k < ringVals.length; k += 1) ringVals[k].set(r[k * 4], r[k * 4 + 1], r[k * 4 + 2], r[k * 4 + 3]);
      uRingHead.value = sim.reflectHead;
      // Round 8: the newest value of each face and the slot's phase.
      uRingPhase.value = sim.reflectPhase;
      for (let q = 0; q < Q; q += 1) moundVals[q].w = sim.reflectNow[q];
    }
    sim.rocks.forEach((rock, ri) => {
      const u = rockUniforms[ri];
      rock.sectors.forEach((st, s) => {
        // The mound: the reflected part of the run-up, the water standing
        // against the face (standing - eta), under the swash line.
        moundVals[ri * ROCK_SECTORS + s].x = Math.max(0, Math.min(st.standingM - st.etaM, st.swashM - st.etaM));
        u.a[s].set(st.etaM, st.swashM, st.wetM, st.streamTopM);
        // Round 15: B.w is the swash roller's air share (was the jet, which no shader read).
        u.b[s].set(st.stream, st.cascadeM2s, st.breaking, st.rollerAir);
      });
      // Round 18: the plume's opacity over its disk and its sphere (THE WHITE ROUND THE STONE LIGHTS IT).
      {
        const v = volumes[ri];
        const R = Math.max(v.turbL, 0.1);
        const tau = v.empty ? 0 : (v.layCs + v.bodyCs) / (Math.PI * R * R);
        u.live.set(rock.sheetM, rock.damp, 1 - Math.exp(-tau), 0);
        if (v.empty) plumeVals[ri].set(0, -100, 0, 0); else plumeVals[ri].set(v.turbCx, v.turbCy, v.turbCz, R);
      }
      if (foamPath === 'own') {
        // Foam: amount / MAX and age / 20 s, 8 bits each.
        const L = foamLayers[ri];
        const N = ROCK_FOAM_N;
        for (let k = 0; k < N * N; k += 1) {
          const a = rock.foamAmount[k];
          L.data[k * 4] = Math.min(255, Math.round((a / ROCK_FOAM_MAX) * 255));
          L.data[k * 4 + 1] = Math.min(255, Math.round((rock.foamAge[k] / 20) * 255));
        }
        L.tex.needsUpdate = true;
        L.uOrigin.value.set(rock.foamOriginX + rock.foamShiftX, rock.foamOriginZ + rock.foamShiftZ);
      }
    });
    splashDraw.setSun(opts.sunDir, overcastValue());
    splashDraw.write((owner, x, z) => sim.seaAt(owner, x, z));
    const sd = opts.sunDir.clone().normalize();
    const relight = pinnedDraw || volumeWrites % VOLUME_LIGHT_EVERY === 0;
    volumeWrites += 1;
    // Round 14: which water the sprites draw (the drops the camera resolves) and the cross-section the
    // march draws of the rest, before the grids are built (ONE PLUME, ONE BUDGET, oceanSplash.ts).
    const c0 = performance.now();
    dropDraw.plan();
    const c1 = performance.now();
    cpuNow.plan = c1 - c0;
    cpuNow.bodies = 0; cpuNow.build = 0; cpuNow.light = 0; cpuNow.pack = 0;
    volumes.forEach((v, ri) => {
      // Round 17: THE ROOT IS A VOLUME: the rock's aerated bodies (rockRollerBodies) are laid with its parcels.
      const b0 = performance.now();
      const nb = rockRollerBodies(sim, ri, bodyBufs[ri]);
      bodyStats[ri] = { ...rockBodyCensus };
      const b1 = performance.now();
      v.build(sim.splash, ri, dropDraw.volumeCs, bodyBufs[ri], nb);
      const b2 = performance.now();
      if (relight) v.light(sd.x, sd.y, sd.z, occluderTopAt, occMax + 1);
      const b3 = performance.now();
      cpuNow.bodies += b1 - b0; cpuNow.build += b2 - b1; cpuNow.light += b3 - b2;
      volumeDraws[ri].setSun(opts.sunDir, overcastValue());
      volumeDraws[ri].setTime(sim.time);
      volumeDraws[ri].write();
      cpuNow.pack += performance.now() - b3;
    });
    const d0 = performance.now();
    dropDraw.setSun(opts.sunDir, overcastValue());
    dropDraw.write((owner, x, z) => sim.seaAt(owner, x, z));
    cpuNow.drops = performance.now() - d0;
  };
  /* ROUND 17: THE COST'S PARTS (the gates GG-406: the step under 1 ms, the strike's CPU under 5 ms). Each frame's
   * rocks CPU split by part, ms: the model's steps, the foam sources, the sprites' plan (the depth sort and the
   * split), the bodies, the grids' build, the light, the pack and upload flags, the sprites' write; `stats()`
   * returns the last frame's and the largest of each since the last call. */
  const cpuNow = { steps: 0, sources: 0, plan: 0, bodies: 0, build: 0, light: 0, pack: 0, drops: 0, total: 0 };
  const cpuPeak = { steps: 0, sources: 0, plan: 0, bodies: 0, build: 0, light: 0, pack: 0, drops: 0, total: 0 };
  const bodyBufs = tables.map(() => new Float32Array(ROCK_BODY_MAX * SPLASH_BODY_STRIDE));
  const bodyStats: Array<Record<string, number>> = tables.map(() => ({}));
  /** Whether the frame being written is a pinned one (its light is marched in full). */
  let pinnedDraw = false;

  /** Hand the model's foam to the sea's foam field. */
  const writeSources = (): boolean => {
    if (!discSource) return false;
    // Round 13: the flow's history with the discs (the field reads both at its steps' own times).
    writeFlow();
    const list = rockFoamSources(sim, sim.time, FIELD_SOURCE_SLOTS);
    discSource.setDiscs(list);
    sourcesSet = list.length;
    const key = list.map((d) => `${d.xM},${d.zM},${d.rM},${d.s},${d.t0S},${d.t1S},${d.soft ?? 0}`).join(';');
    const changed = key !== discKey;
    discKey = key;
    return changed;
  };

  /**
   * THE WINDOW SCAN, for choosing a capture time: the model from rest at
   * t0 - 20 s through t1, with a row every `every` seconds of what each
   * rock does (the summed jet over its faces, the fastest jet, the highest
   * run-up over the rims, the sheet, the live particles). It steps the sea
   * through the whole window, so the pinned state is dropped and the next
   * pinned frame re-integrates.
   */
  const scan = async (t0: number, t1: number, every = 0.1, simTimeNow = t0) => {
    const span = Math.min(t1 - t0, SCAN_MAX_S);
    const m = Math.round((ROCK_PRIME_S + span) * ROCK_SAMPLE_HZ);
    const times = new Float64Array(m + 1);
    for (let i = 0; i <= m; i += 1) times[i] = t0 - ROCK_PRIME_S + i / ROCK_SAMPLE_HZ;
    liveEpoch += 1;
    settledTime = null;
    modelSettledFor = null;
    primingFor = null;
    const raw = await sampleTimes(times, simTimeNow);
    fillHistory(raw, times);
    sim.reset(times[0]);
    const rows: Array<Record<string, unknown>> = [];
    const steps = Math.round((times[m] - times[0]) / ROCK_DT_S);
    const everySteps = Math.max(1, Math.round(every / ROCK_DT_S));
    for (let k = 1; k <= steps; k += 1) {
      sim.step(ROCK_DT_S, history);
      if (sim.time >= t0 - 1e-9 && k % everySteps === 0) {
        rows.push({
          t: +sim.time.toFixed(3),
          alive: sim.alive,
          rocks: sim.rocks.map((r) => {
            let jet = 0; let jetMs = 0; let over = 0; let eta = -9;
            r.sectors.forEach((st, i) => {
              jet += st.jet; jetMs = Math.max(jetMs, st.jetMs);
              over = Math.max(over, st.runUpM - r.tab.rimM[i]); eta = Math.max(eta, st.etaM);
            });
            return { jet: +jet.toFixed(3), jetMs: +jetMs.toFixed(2), over: +over.toFixed(2), eta: +eta.toFixed(2), sheet: +r.sheetM.toFixed(3) };
          }),
        });
      }
    }
    lastDrawnStep = -1;
    return rows;
  };

  let stepsTotal = 0;
  // Round 18: the sea's time the live model has deferred (THE LIVE STEPS HAVE A BUDGET), now and its largest since the last stats().
  let liveDeferredS = 0;
  let liveDeferredPeakS = 0;
  return {
    scan,
    debugSpray: (m: number) => splashDraw.debug(m),
    // Round 13: mode 3 draws the sprites' light shares (direct sun, sun many times, direct sky) as color.
    // Round 14: mode 4 draws each march ray's step count as grey ((n + 1) / 97), the march's cost census.
    debugRock: (m: number) => { uRockDebug.value = m; },
    setTurbulence: (on: boolean) => { for (const d of marchDraws) d.setTurbulence(on); },
    setDome: (on: boolean) => { for (const d of marchDraws) d.setDome(on); },
    debugPlume: (m: number) => { for (const d of marchDraws) d.debug(m === 3 ? 0 : m === 4 ? 3 : m); dropDraw.debug(m === 1 ? 1 : m === 3 ? 2 : 0); },
    dumpPrime: () => {
      if (!lastPrime) return null;
      const plain = (t: RockFaceTable) => Object.fromEntries(Object.entries(t).map(([k, v]) => [k, ArrayBuffer.isView(v) ? Array.from(v as unknown as ArrayLike<number>) : v]));
      return { Q, times: Array.from(lastPrime.times), raw: Array.from(lastPrime.raw), tables: tables.map(plain), sea: sim.sea };
    },
    group,
    tables,
    sim,
    get settledTime() { return settledTime; },
    get foamPath() { return foamPath; },
    update(simTime: number, dtS: number) {
      if (disposed) return;
      const u0 = performance.now();
      cpuNow.steps = 0; cpuNow.sources = 0; cpuNow.plan = 0; cpuNow.bodies = 0; cpuNow.build = 0; cpuNow.light = 0; cpuNow.pack = 0; cpuNow.drops = 0;
      uTime.value = simTime;
      setCenter();
      syncPatchShading();
      if (dtS === 0) {
        // Pinned. A new pinned time re-integrates from rest (see the header).
        const c = field.surface.center;
        if ((settledTime === simTime || modelSettledFor === simTime || primingFor === simTime)
          && (c.x !== primedCenter.x || c.y !== primedCenter.y)) {
          settledTime = null;
          modelSettledFor = null;
          primingFor = null;
          fieldReplayFor = null;
        }
        if (settledTime !== simTime && modelSettledFor !== simTime && primingFor !== simTime) startPrime(simTime);
        if (modelSettledFor === simTime && settledTime !== simTime) {
          if (discSource) {
            // Hand the field the discs, have it replay its warm-up with
            // them, and wait for it: the foam piece steps before this piece
            // in the frame, so the replay runs on the next frame; two frames
            // of margin.
            if (fieldReplayFor !== simTime) {
              writeSources();
              foamSet.invalidate();
              fieldReplayFor = simTime;
              fieldReplayFrames = 0;
            } else if (++fieldReplayFrames >= 2) {
              settledTime = simTime;
            }
          } else {
            settledTime = simTime;
          }
        }
      } else {
        // Live. A jump back, or a gap of over a second, starts from rest.
        if (settledTime !== null || primingFor !== null || modelSettledFor !== null
          || (history.length > 0 && (simTime < history.lastTime || simTime - history.lastTime > 1.0))) {
          restartLive(simTime);
        }
        liveSample(simTime);
        kickLiveReadback();
        const s0 = performance.now();
        if (history.length >= 2) {
          const target = history.lastTime;
          if (target - sim.time > LIVE_MAX_STEPS * ROCK_DT_S * 4) sim.time = target - ROCK_DT_S * LIVE_MAX_STEPS;
          let k = 0;
          while (sim.time + ROCK_DT_S <= target && k < LIVE_MAX_STEPS) {
            sim.step(ROCK_DT_S, history);
            k += 1;
            stepsTotal += 1;
            // Round 18: the frame's step budget (THE LIVE STEPS HAVE A BUDGET); the rest waits for the next frame.
            if (performance.now() - s0 >= LIVE_STEP_BUDGET_MS) break;
          }
          liveDeferredS = Math.max(target - sim.time, 0);
          liveDeferredPeakS = Math.max(liveDeferredPeakS, liveDeferredS);
        }
        const s1 = performance.now();
        writeSources();
        cpuNow.steps = s1 - s0;
        cpuNow.sources = performance.now() - s1;
      }
      const drawKey = Math.round(sim.time * 600);
      if (drawKey !== lastDrawnStep) {
        pinnedDraw = dtS === 0;
        writeDraw();
        lastDrawnStep = drawKey;
      }
      cpuNow.total = performance.now() - u0;
      for (const k of Object.keys(cpuNow) as Array<keyof typeof cpuNow>) cpuPeak[k] = Math.max(cpuPeak[k], cpuNow[k]);
      // The prepass follows the camera every frame (the plume's state only
      // when the model steps); skipped while no plume is drawn.
      if (volumeDraws.some((d) => d.mesh.visible)) {
        prepass.render();
        // Then each plume's march, at MARCH_SCALE, into its own target.
        for (const d of marchDraws) d.renderPass();
      }
    },
    stats() {
      // Round 17: the cost's parts (the last frame's and the largest since the last call).
      const cpuParts = { now: { ...cpuNow }, peak: { ...cpuPeak } };
      for (const k of Object.keys(cpuPeak) as Array<keyof typeof cpuPeak>) cpuPeak[k] = 0;
      const deferred = { now: +liveDeferredS.toFixed(4), peak: +liveDeferredPeakS.toFixed(4), budgetMs: LIVE_STEP_BUDGET_MS };
      liveDeferredPeakS = 0;
      return {
        cpuParts, liveDeferredS: deferred, bodies: bodyStats.map((b, ri) => ({ ...b, laid: volumes[ri].bodyN, cs: +volumes[ri].bodyCs.toFixed(1), coverage: +volumes[ri].layCoverage.toFixed(4) })),
        settledTime, modelSettledFor, primingFor, primes, liveRestarts, simTime: sim.time, alive: sim.alive, stepsTotal,
        foamPath, sourcesHeld: sim.sources.length, sourcesSet, surfaceShoals,
        splashEmitted: sim.splash.emitted.slice(), splashLandedSea: sim.splash.landedSea,
        volumes: volumes.map((v) => ({
          peak: +v.peak.toFixed(2), origin: [v.ox, v.oy, v.oz], box: [v.bx0, v.by0, v.bz0, v.bx1, v.by1, v.bz1],
          // Round 6: the water and the drops in the grid, the optical depth through the core, and the profile up the flight.
          massKg: +v.massKg.toFixed(1), drops: Math.round(v.drops), tauCore: +v.tauCore.toFixed(2), tauCoreUp: +v.tauCoreUp.toFixed(2),
          // Round 15: the march's parcels on the core grid and on the light grid (THE CORE IS DENSE).
          coreParcels: v.coreParcels, coarseParcels: v.coarseParcels, coreBox: [v.cbx0, v.cby0, v.cbz0, v.cbx1, v.cby1, v.cbz1],
          g: SPLASH_G, profile: v.profile(0.5).map((r) => ({ y0: +r.y0.toFixed(2), cells: r.cells, n: +r.n.toExponential(3), sigma: +r.sigma.toFixed(3), sigmaMax: +r.sigmaMax.toFixed(2), spanXM: +r.spanXM.toFixed(1), spanZM: +r.spanZM.toFixed(1) })),
        })),
        // Round 6: the pool's water ledger, kg.
        massEmitted: +sim.splash.massEmitted.toFixed(1), massAlive: +sim.splash.massAlive().toFixed(1),
        massLanded: +sim.splash.massLanded.toFixed(1), massLost: +sim.splash.massLost.toFixed(1),
        plumeTop: sim.rocks.map((_, ri) => {
          let top = -Infinity;
          for (let a = 0; a < sim.splash.alive; a += 1) {
            const i = sim.splash.aliveIndex[a];
            if (sim.splash.owner[i] === ri && sim.splash.mass[i] > 0) top = Math.max(top, sim.splash.pos[i * 3 + 1]);
          }
          return Number.isFinite(top) ? +top.toFixed(2) : null;
        }),
        aliveByKind: (() => { const c = [0, 0, 0, 0, 0]; for (let a = 0; a < sim.splash.alive; a += 1) c[sim.splash.kind[sim.splash.aliveIndex[a]]] += 1; return c; })(),
        historyRows: history.length, historyFirst: history.firstTime, historyLast: history.lastTime,
        // Round 13: the sprites of the last write and the soft edge of the 50 widest (A COLUMN'S EDGE IS THE GAUSSIAN'S).
        sprites: dropDraw.census(50),
        rocks: sim.rocks.map((r) => ({
          jetsSeen: r.jetsSeen, thrown: r.particlesThrown, peakJetMs: r.peakJetMs, peakRunUpM: r.peakRunUpM,
          jetKg: +r.jetKg.toFixed(1), peakJetKgPerS: +r.peakJetKgPerS.toFixed(1), topM: r.tab.topM,
          sheetM: r.sheetM, damp: r.damp,
          sectors: r.sectors.map((s) => ({
            eta: +s.etaM.toFixed(3), swash: +s.swashM.toFixed(3), wet: +s.wetM.toFixed(3), jet: +s.jet.toFixed(3),
            jetMs: +s.jetMs.toFixed(2), inflow: +s.inflowMs.toFixed(2), breaking: +s.breaking.toFixed(2), cascade: +s.cascadeM2s.toFixed(4),
            jetKgPerMS: +s.jetKgPerMS.toFixed(1), sheetM: +s.jetSheetM.toFixed(4),
          })),
        })),
      };
    },
    dispose() {
      disposed = true;
      opts.scene.remove(group);
      // The reef leaves the sea with the rocks, and so does the rock reader.
      bathy.set([]);
      surfaceRocks.setRocks?.(null);
      removeDiscSource?.();
      for (const m of rockMeshes) m.geometry.dispose();
      for (const m of rockMats) m.dispose();
      splashDraw.dispose();
      dropDraw.dispose();
      for (const d of volumeDraws) d.dispose();
      prepass.dispose();
      patchGeom.dispose();
      patchMat.dispose();
      for (const L of foamLayers) {
        L.tex.dispose();
        L.mesh.geometry.dispose();
        (L.mesh.material as THREE.Material).dispose();
      }
      laceTex.dispose();
      for (const k of [kHist, kLiveFromHist, kLive]) (k as { dispose?: () => void }).dispose?.();
    },
  };
}
