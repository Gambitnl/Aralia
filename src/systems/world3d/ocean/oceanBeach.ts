/**
 * @file oceanBeach.ts — the beach on the GPU: the sand of the cay's shore,
 * the swash sheet over it, the foam and the swash mark, the wet and drying
 * sand, and the shells, sticks and seaweed the sheet pushes about.
 *
 * WHAT DRAWS WHAT.
 *
 *   The physics runs in `oceanBeachWorker.ts` (the math is `oceanBeachMath.ts`)
 *   and comes back as two half-float textures of the swash grid: sheet depth,
 *   velocity and foam; skin wetness, stranded foam, swash mark and the time
 *   since the sheet left. Everything below reads them.
 *
 *   THE FLOOR is the caustics piece's (`oceanSeabed.ts`), built from
 *   `LAGOON_CAY_SEABED` (the lagoon plus the cay) with this piece's hook:
 *   the floor lights the beach's wet sand with its own function, draws the
 *   beach's foam on the SEA SURFACE where the sea is the water the eye sees
 *   (the bores seaward of the swash sheet), and leaves the beach's patch of
 *   ground to this piece.
 *
 *   THE SAND over the patch is this piece's mesh, at the swash grid's
 *   resolution, lit by the floor's own function (so it meets the floor's
 *   sand at the patch's edge), with the wet film's sky reflection, the
 *   stranded foam and the swash mark on it.
 *
 *   THE SHEET is a transparent film over the sand wherever the swash holds
 *   water: the sky and sun in its surface, its foam as a lace carried with
 *   its flow, the sand and the debris seen through it. Where the sea's own
 *   surface stands higher (seaward of the tip) the sea hides the sheet by
 *   the depth test, so the sea's surface meets the sheet at a real waterline.
 *
 *   THE DEBRIS are three instanced meshes (shells, sticks) and one ribbon
 *   mesh (weed), placed each state from the worker's poses.
 *
 * DETERMINISM. The state is a function of the sea's time (the worker's
 * fixed-step clock); a pinned capture waits until `probe.settled()` says the
 * beach has reached the pinned time. The foam lace moves with the state's
 * own time, not the wall clock.
 *
 * NO LOOK IS KEYED ON THE CAMERA. Every term below is a function of the
 * world point and the state; the only screen terms are the footprint fades
 * that stop the lace aliasing (the same texture sampled coarser), per the
 * lead's ruling of 2026-09-25.
 *
 * C5 OWNERSHIP: Look constants, contracts and resource builders live in oceanBeachLook, oceanBeachTypes and oceanBeachResources. This file retains the complete beach factory and all legacy public exports; resource creation/update/disposal order stays intact.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 25/10/2026, 03:34:56
 * Dependents: components/DesignPreview/steps/sidebyside/oceanExtras/beach.ts, components/DesignPreview/steps/sidebyside/oceanExtras/mouth.ts, systems/world3d/ocean/oceanMouth.ts
 * Imports: 9 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import * as THREE from 'three/webgpu';
import { storage, float, uniform, vec2, texture, floor, fract, mix, smoothstep, clamp, abs, max, vec3, length, dot, min, select, log2, If, int, sin, exp, normalize, pow, step, mod, Fn, positionWorld, dFdx, dFdy, cameraPosition, reflect, vec4, positionGeometry } from 'three/tsl';
import { type SeabedShoreHook, createOceanSeabed } from './oceanSeabed';
import { LAGOON_CAY_SEABED, FLOOR_LIGHT, seabedDepthAt, seabedPointAt } from './oceanSeabedMath';
import { oceanSkyDeckLight, oceanSkyRadiance } from './oceanSky';
import { WAKE_LACE_TILE_M, WAKE_LACE_CDF_KNOTS } from './oceanWakeMath';
import { buildBeachSite, type DebrisItem, BEACH_DT, SWASH_TILE_N, BEACH_SWASH, SKIN_M, BEACH_SAND, BEACH_LACE_WEIGHTS, SWASH_TILE_M, beachToWorld, type BeachSite } from './oceanBeachMath';
import { type OceanBeachOptions, type OceanBeach, type TslNode, type OceanBeachState } from './oceanBeachTypes';
import { makeNoiseTexture, coarseFloorHeight, buildDebrisMeshes } from './oceanBeachResources';
import { NOISE_CELLS, MATCH_DAMP_K, MATCH_WET_K, MATCH_GLOSS_CUT, MATCH_FILM_DEEP_M, MATCH_LINE_W_M, MATCH_LINE_GAP_SHARE, MATCH_LINE_AMOUNT, MATCH_BAND_OP_HI, MATCH_FACE_W_M, MATCH_FACE_SHARE, MATCH_TILE_K, MATCH_SURF_BODY_SHARE, MATCH_IMMERSED_K, MATCH_RAMP_K, MATCH_OLIVE_S, MATCH_OLIVE_GRAY, MATCH_OLD_K, MATCH_NET_OP, MATCH_NET_CAP, MATCH_RIM_K, MATCH_DAMP_DRY_K, MATCH_LINE_W_K, MATCH_EDGE_FULL_M, MATCH_SURF_BAND, MATCH_FOLD, MATCH_STRENGTH_RUN_M, MATCH_BAND_COVER, MATCH_WET_GRAY, MATCH_SURF_OP, MATCH_SURF_H, MATCH_SURF_AMOUNT, MATCH_FILM_GRAY, MATCH_THICK_M, WANDER_S_M, WANDER_S2_M, WANDER_A_M, RIM_SCALLOP_M, RIM_SCALLOP_DEPTH_M, SEG_M, SEG_T_S, SEG_AMP, FILM_FOAM_KEEP, FILM_PART_H, SHEET_MIN_M, GLASS_THIN, GLASS_THICK, GLASS_H, FLOW_PHASE_S, SHEET_DAPPLE_M, SHEET_DAPPLE2_M, OP_SHEET, HWM_SCALLOP_M, HWM_SCALLOP_DEPTH_M, EDGE_FADE_M, TOP_FADE_M, WET_RE, WET_RI, WET_PATCH_M, WET_LINE_VAR, WET_LINE_SE, DRY_LINE2_M, DRY_LINE2_VAR, WET_LINE_W, DRY_LINE_W_K, WET_SOAK_K, WET_SOAK_S, WET_DAMP_LO, WET_DRAINED, WET_BLOTCH_M, WET_BLOTCH, DRY_BLOTCH_K, SWASH_FOAM_TINT, MATCH_FOAM_TINT, FILM_SKY_UP, FILM_SKY_GRAY, SHEET_FULL_M, WET_IMMERSED_DEEP_M, FILM_SKY_SHARE, FILM_SHEEN_M, FILM_SHEEN, VEIL_TINT, SURF_BODY_RGB, MATCH_SURF_BODY_RGB, FACE_RGB, MATCH_FACE_RGB, LACE_TILE_SCALE, LACE_HOLE_STRETCH, LACE_STREAK_STRETCH, LACE_WISP_STRETCH, LACE_FLOW, LACE_FLOW_MAX, FEED_PATCH_M, FEED_H, FEED_BORE, SCUM_PATCH_M, FEED_GAIN, SCUM_AMOUNT, FEED_WOBBLE_M, FEED_WOBBLE, MATCH_HOLE_STRETCH, BAND_HOLE_STRETCH, MATCH_STREAK_STRETCH, BAND_STREAK_STRETCH, NET_FOLD, AGE_FOLD, BAND_MAX_COVER, LACE_MAX_COVER, LACE_SOFT, THIN_GATE, BREAK_TILE, BREAK_STRETCH, BREAK_KEEP, BREAK_MAX, BREAK_AGE, BREAK_AMT, LACE_MID_M, OP_LO, BAND_OP_LO, OP_HI, BAND_OP_HI, OP_RANGE, BREAK_SPECK_OP, SPECKLE_H, SPECKLE_THIN_OP, AGE_OPACITY, AGE_GRAY, MILK_PLUME_M, LACE_BUBBLE_M, WET_FRINGE_M, MATCH_RAMP_M, FILM_DEEP_M, DRY_PATCH_M, DRY_FRESH_S, DRY_FRESH_K, SHEET_GRAIN_K, SAND_GRAIN_K, MOTTLE_BROAD_M, MOTTLE_BROAD_WET, MOTTLE_BROAD_DRY, MOTTLE_COARSE_M, MOTTLE_COARSE_WET, MOTTLE_COARSE_DRY, MOTTLE_MID_M, MOTTLE_MID_WET, MOTTLE_MID_DRY, MOTTLE_FINE_M, MOTTLE_FINE_WET, MOTTLE_FINE_DRY, MOTTLE_RELIEF_M, MOTTLE_RELIEF_DRY, TONE_PATCH_M, TONE_PATCH_K, SAND_TINT, SAND_TINT_H, MATCH_TINT_H, MATCH_SAND_RGB, SPECK_M, SPECK_SHARE, GRAVEL_M, GRAVEL_SHARE, GRAVEL_WET_K, WET_IMMERSED_K, SHEET_OLIVE_RGB, SHEET_OLIVE, MATCH_FILM_RGB, MATCH_WET_S, MATCH_DAMP_AGE_S, MATCH_DAMP_GRAY, STRENGTH, LIP_GAP_M, MATCH_LINE_PROFILE, MATCH_NET_SCALE, MATCH_NET_VAR_M, MATCH_NET_LINE, MATCH_NET_STRETCH, MATCH_NET_PATCH_M, SED_ATTEN_M2_KG, GLASS_CLEAR, SPECKLE_CLARITY, FILM_SKY_SEA_CUT, STRENGTH_RUN_M, TRAIL_SIDE, TRAIL_PATCH_M, TRAIL_AMT, LIP_W0, LIP_GAP_SHARE, LIP_W_M, LIP_AMOUNT, FACE_W_M, FACE_SHARE, MATCH_SURF_REACH_M, MILK_FOAM_LO, MILK_MAX, SED_BACK_M2_KG, VEIL_MAX, SURF_BODY_H, SURF_BODY_SHARE, CREST_HIDE_H, GLINT_KEEP_LO_M, GLINT_KEEP_HI_M, RIPPLE_TURN_RAD, RIPPLE_M, RIPPLE_H_M, PIT_CELL_M, PIT_SHARE, PIT_DEPTH_M, FOOTPRINT_TRACKS, FOOTPRINT_STRIDE_M, FOOTPRINT_L_M, FOOTPRINT_W_M, FOOTPRINT_DEPTH_M, RELIEF_S_FULL_M, FILM_WEB_GAIN, SUN_SHARE, GLOSS_DRAIN_S, GLOSS_SPREAD, SHINE_S, SHEET_EDGE_FULL_M, SAT_SKY_SHARE, SHINE_SKY, RELIEF_S_ZERO_M, RILL_S, RILL_FIELD_SHARE, RILL_FIELD_M, RILL_W, RILL_STRETCH, RILL_M, RILL_TRIB_STRETCH, RILL_TRIB_M, RILL_TRIB_K, RILL_DEPTH_M, RILL_FLOOR_DARK, RILL_SKY, SHEEN_SE_LO, SHEEN_SHARE, SHEEN_ROUGH, RIM_EDGE_M, RIM_LOBE_M, RIM_W_SCALE_M, RIM_W_MIN_M, FRONT_W_M, RIM_W_MAX_M, RIM_ARC_GAIN, RIM_LOBE_GAIN, RIM_CLUSTER_M, RIM_CLUSTER_LO, FRONT_CLUSTER_LO, RIM_GAP_SHARE, FRONT_GAP_SHARE, RIM_GAP_M, RIM_ROUGH_CELL_M, RIM_ROUGH_M, RIM_TRAIL_M, FRONT_TRAIL_M, RIM_TRAIL_AMOUNT, FRONT_TRAIL_AMOUNT, RIM_BACK_SHARE, RIM_AMOUNT, FRONT_TRAIL_AGE_S, MATCH_RIM_GAP_M, RIM_OP, MATCH_STRAND_K, HWM_W_M, DRY_HWM_W_M, HWM_FOAM_AMOUNT, MARK_FOAM_AMOUNT, OLD_S_M, OLD_L_M, OLD_D_M, OLD_TILT, OLD_W_M, MATCH_OLD_W_K, OLD_LACE_W_K, OLD_LACE_AMOUNT, MATCH_OLD_LACE_K, HWM_DARK, OLD_DARK, OLD_FOAM, MATCH_OLD_FOAM_K, SHEET_LIFT_M, SHEET_PUSH_M, FILM_CHOP_PER_MS, FILM_CHOP_MAX, FILM_RIPPLE_SLOPE, GLINT_CHOP_PER_MS, GLINT_CHOP_MAX, GLINT_RMS_SLOPE, GLINT_START_M, GLINT_END_M, SHEET_SUN_E, GLINT_CELL_M, GLINT_DENSITY, GLINT_P_MAX, GLINT_POINT, GLINT_CAP, SHEET_DAPPLE_HI, SHEET_DAPPLE_LO, FILM_SHEEN_STRETCH, FILM_SHEEN_STREAK_M, FILM_SHEEN_LO, MATCH_SHEET_LACE_K, MATCH_FACE_H } from './oceanBeachLook';

// Compatibility exports preserve existing consumers while each concern has one owner.
export {  } from './oceanBeachLook';
export { type OceanBeachOptions, type OceanBeachSwash, type OceanBeachState, type OceanBeach } from './oceanBeachTypes';
export {  } from './oceanBeachResources';


/** Build the beach: start its worker, and wait until it has its first state. */
export async function createOceanBeach(opts: OceanBeachOptions): Promise<OceanBeach> {
  const { field } = opts;
  const MT0 = opts.match === true;
  const floorParams = opts.seabedParams ?? LAGOON_CAY_SEABED;
  const site = buildBeachSite(floorParams, opts.grid);
  const { frame: fr, grid: g } = site;
  const nCell = g.ns * g.na;
  const lenS = g.ns * g.ds;
  const lenA = g.na * g.da;
  const s1 = g.s0 + lenS;
  const a1 = g.a0 + lenA;

  /* --- the worker (started first: the look reads its foam tile) ---------- */

  // The worker: its first message is 'ready' with the debris items.
  const worker = new Worker(new URL('./oceanBeachWorker.ts', import.meta.url), { type: 'module' });
  let workerError: string | null = null;
  const ready = await new Promise<{
    items: DebrisItem[]; modes: number; keptShare: number[]; dt: number; foamTile: Uint8Array;
    wakeLace: Uint8Array; wakeLaceCdf: Float32Array;
  }>((resolve, reject) => {
    worker.onmessage = (e: MessageEvent) => {
      const m = e.data;
      if (m.type === 'ready') resolve(m);
      else if (m.type === 'error') reject(new Error(m.message));
    };
    worker.onerror = (e) => reject(new Error(`[ocean] The beach worker failed to start: ${e.message}`));
    // Round 16: the match runs its own swash (BEACH_MATCH_SWASH in oceanBeachMath.ts).
    // Round 20: that swash is derived from the sea and the sand; `matchSwash:
    // 'r16'` asks for round 16's fitted set instead (an A/B switch; the look
    // is the same either way).
    worker.postMessage({
      type: 'init', cascades: opts.cascades ?? field.cascades, n: field.buffers.n, seed: opts.seed,
      ...(MT0 ? { match: opts.matchSwash === 'r16' ? 'r16' : true } : opts.derivedSwash ? { match: true } : {}),
      // River mouth round 1: another floor, grid and the mouth's walls.
      ...(opts.seabedParams ? { params: opts.seabedParams } : {}),
      ...(opts.grid ? { grid: opts.grid } : {}),
      ...(opts.wall ? { wall: opts.wall } : {}),
      ...(opts.seaSlope ? { seaSlope: true } : {}),
    });
  });
  if (Math.abs(ready.dt - BEACH_DT) > 1e-12) throw new Error('[ocean] The beach worker runs a different step than this module.');
  const items = ready.items;
  // THE SWASH FOAM TILE, baked in the worker (800 ms of CPU, off the frame).
  const foamTileTex = new THREE.DataTexture(ready.foamTile, SWASH_TILE_N, SWASH_TILE_N, THREE.RGBAFormat, THREE.UnsignedByteType);
  foamTileTex.minFilter = THREE.LinearFilter;
  foamTileTex.magFilter = THREE.LinearFilter;
  foamTileTex.wrapS = THREE.RepeatWrapping;
  foamTileTex.wrapT = THREE.RepeatWrapping;
  foamTileTex.generateMipmaps = false;
  foamTileTex.needsUpdate = true;
  // THE WAKE'S LACE IMAGE and its coverage table (round 7, see LACE_TILE_SCALE),
  // set up as `oceanWake.ts` sets them: mipmapped, and the table a read-only
  // storage buffer (a float uniform array pads to a 16-byte stride).
  const wakeLaceTex = new THREE.DataTexture(ready.wakeLace, 512, 512, THREE.RGBAFormat);
  wakeLaceTex.wrapS = THREE.RepeatWrapping;
  wakeLaceTex.wrapT = THREE.RepeatWrapping;
  wakeLaceTex.magFilter = THREE.LinearFilter;
  wakeLaceTex.minFilter = THREE.LinearMipmapLinearFilter;
  wakeLaceTex.generateMipmaps = true;
  wakeLaceTex.colorSpace = THREE.NoColorSpace;
  wakeLaceTex.needsUpdate = true;
  const cdfAttr = new THREE.StorageBufferAttribute(ready.wakeLaceCdf, 1);
  const uLaceCdf = storage(cdfAttr, 'float', cdfAttr.count).toReadOnly();
  // The web's mean over the tile (its lines' share), so the web moves light
  // and adds none: 1 - smoothstep(0, 0.18, G) averaged over every texel.
  let webSum = 0;
  for (let k2 = 0; k2 < SWASH_TILE_N * SWASH_TILE_N; k2 += 1) {
    const g2 = ready.foamTile[k2 * 4 + 1] / 255;
    const x2 = Math.min(Math.max(g2 / 0.18, 0), 1);
    webSum += 1 - x2 * x2 * (3 - 2 * x2);
  }
  const filmWebMean = float(webSum / (SWASH_TILE_N * SWASH_TILE_N));

  /* --- the state textures -------------------------------------------- */

  const makeTex = (data: Uint16Array): THREE.DataTexture => {
    const t = new THREE.DataTexture(data, g.ns, g.na, THREE.RGBAFormat, THREE.HalfFloatType);
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.wrapS = THREE.ClampToEdgeWrapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
    t.generateMipmaps = false;
    t.flipY = false;
    t.needsUpdate = true;
    return t;
  };
  const texA = makeTex(new Uint16Array(nCell * 4));
  const texB = makeTex(new Uint16Array(nCell * 4));
  const texD = makeTex(new Uint16Array(nCell * 4));
  // The static part: the bed (for the sheet's slope) and the saturated band,
  // the cells whose skin sits in the capillary fringe over the water table
  // (as `SwashField` sets them: its skin never drains, and it stays glossy).
  const cData = new Uint16Array(nCell * 4);
  for (let c = 0; c < nCell; c += 1) {
    const wt = Math.min(BEACH_SWASH.wtShoreM + BEACH_SWASH.wtSlope * Math.max(site.shoreDist[c], 0), BEACH_SWASH.wtMaxM);
    const saturated = site.bed[c] - SKIN_M / 2 - wt <= BEACH_SAND.psiBM;
    cData[c * 4] = THREE.DataUtils.toHalfFloat(site.bed[c]);
    cData[c * 4 + 1] = THREE.DataUtils.toHalfFloat(saturated ? 1 : 0);
  }
  const texC = makeTex(cData);
  // River mouth round 1c: the sea side's slope (two half floats a cell; `seaSlope`).
  const texE = opts.seaSlope ? (() => {
    const t = new THREE.DataTexture(new Uint16Array(nCell * 2), g.ns, g.na, THREE.RGFormat, THREE.HalfFloatType);
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.wrapS = THREE.ClampToEdgeWrapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
    t.generateMipmaps = false;
    t.flipY = false;
    t.needsUpdate = true;
    return t;
  })() : null;

  const uTime = uniform(0);
  const noiseTex = makeNoiseTexture(opts.seed);
  /** Gradient noise, about -1 to 1, one lattice cell per `scale` m, field `ch` (0 to 3), shifted by `seed`. */
  const noise2 = (xz: TslNode, scale: number, ch: number, seed: number): TslNode => {
    const uv = xz.div(scale * NOISE_CELLS).add(vec2(seed * 0.3719, seed * 0.6173));
    const t = texture(noiseTex, uv).level(float(0));
    const c = ch === 0 ? t.x : ch === 1 ? t.y : ch === 2 ? t.z : t.w;
    return c.mul(2).sub(1);
  };
  const uSun = uniform(opts.sunDir.clone().normalize());
  const uOvercast: TslNode = opts.overcast;
  // River mouth round 6: under the sky's stratus deck the sun's unscattered share and the sky's diffuse gain
  // (oceanSky.ts DECK_OF; both 1 with no deck, so the beach's judged views draw as before).
  const deckLight = oceanSkyDeckLight(uOvercast);
  const sunVis = float(1).sub(uOvercast).mul(deckLight.sunDirect);
  const skyE = float(FLOOR_LIGHT.skyE).mul(deckLight.skyGain);
  /**
   * Tuning and ablation channel: named uniforms whose defaults are the
   * shipped values; a capture rig sets them in one page load. Nothing in the
   * game sets them. `show*` 0 hides that part's look (for the no-beach A/B).
   */
  // ROUND 12: the match (see MATCH_*) builds the levers and turns on the two
  // it uses (vSand, vBand); without it both are 0, as round 11 shipped them.
  const MT = opts.match === true;
  const tune = {
    wet: uniform(1),
    gloss: uniform(1),
    foam: uniform(1),
    mark: uniform(1),
    showSheet: uniform(1),
    veil: uniform(1),
    web: uniform(1),
    // ROUND 10: THE VARIANT LEVERS (see VARIANTS). Each at 0 draws round 8's
    // look to the pixel; at 1 its lever is at full strength. ROUND 11: round
    // 8's look is the default again, every lever off (round 10's step 2, all
    // of them on, lost both views; a fresh control judge picked round 8's
    // view-1 frame, and round 8 with the hidden fixes lost view 1).
    vSpeck: uniform(0),
    vGloss: uniform(0),
    vFilm: uniform(0),
    vFront: uniform(0),
    vDry: uniform(0),
    vFeed: uniform(0),
    vSheet: uniform(0),
    vSpeckle: uniform(0),
    vTrail: uniform(0),
    // Round 8's drawn rills (see RILLS_ON): 1 on, as round 8 has them.
    rills: uniform(MT ? 0 : 1),
    // ROUND 11, STEP 2: the draining view's new levers (see SAND_GRAIN_K,
    // STRENGTH, OLD_LACE_AMOUNT); 0 draws round 8.
    vSand: uniform(MT ? 1 : 0),
    vBand: uniform(MT ? 1 : 0),
    // Round 14: on in the match (see MATCH_NET_STRETCH's note).
    vOld: uniform(MT ? 1 : 0),
    // ROUND 12: the match's own changes (see MATCH_*): 1 with `opts.match`,
    // 0 draws round 8 with round 11's vSand and vBand.
    vMatch: uniform(MT ? 1 : 0),
    // The match's calibrations (see MATCH_*), uniforms so a rig can step
    // each one at one pinned state; read only when `opts.match` builds them.
    mDampK: uniform(MATCH_DAMP_K),
    mWetK: uniform(MATCH_WET_K),
    mGlossCut: uniform(MATCH_GLOSS_CUT),
    mFilmDeep0: uniform(MATCH_FILM_DEEP_M[0]),
    mFilmDeep1: uniform(MATCH_FILM_DEEP_M[1]),
    mLineW: uniform(MATCH_LINE_W_M),
    mLineGap: uniform(MATCH_LINE_GAP_SHARE),
    mLineAmt: uniform(MATCH_LINE_AMOUNT),
    mBandOpHi: uniform(MATCH_BAND_OP_HI),
    mFaceW: uniform(MATCH_FACE_W_M),
    mFaceShare: uniform(MATCH_FACE_SHARE),
    mTileK: uniform(MATCH_TILE_K),
    mSurfShare: uniform(MATCH_SURF_BODY_SHARE),
    mImmK: uniform(MATCH_IMMERSED_K),
    mRampK: uniform(MATCH_RAMP_K),
    mOlive0: uniform(MATCH_OLIVE_S[0]),
    mOlive1: uniform(MATCH_OLIVE_S[1]),
    mOliveGray: uniform(MATCH_OLIVE_GRAY),
    mOldK: uniform(MATCH_OLD_K),
    mNetOp: uniform(MATCH_NET_OP),
    mNetCap: uniform(MATCH_NET_CAP),
    mRimK: uniform(MATCH_RIM_K),
    mDampDryK: uniform(MATCH_DAMP_DRY_K),
    mLineWK: uniform(MATCH_LINE_W_K),
    mEdgeFull: uniform(MATCH_EDGE_FULL_M),
    mReach: uniform(1),
    mSurfBand: uniform(MATCH_SURF_BAND),
    mFold: uniform(MATCH_FOLD),
    mStrRun: uniform(MATCH_STRENGTH_RUN_M),
    mBandCover: uniform(MATCH_BAND_COVER),
    mWetGray: uniform(MATCH_WET_GRAY),
    mSurfOp: uniform(MATCH_SURF_OP),
    mSurfH0: uniform(MATCH_SURF_H[0]),
    mSurfH1: uniform(MATCH_SURF_H[1]),
    mSurfAmt: uniform(MATCH_SURF_AMOUNT),
    mFilmGray: uniform(MATCH_FILM_GRAY),
    mThick0: uniform(MATCH_THICK_M[0]),
    mThick1: uniform(MATCH_THICK_M[1]),
    // The crest-polygon fix (see CREST_HIDE_H): built only with
    // `opts.crestHide`, and then on.
    vHide: uniform(opts.crestHide ? 1 : 0),
  };

  // ROUND 11: the levers are built only with `opts.levers` (see there);
  // without it every lever site below builds round 8's own nodes.
  const LV = opts.levers === true || MT;

  /* --- world to grid ------------------------------------------------- */

  const toSA = (xz: TslNode): TslNode => {
    const dx = xz.x.sub(fr.originX);
    const dz = xz.y.sub(fr.originZ);
    return vec2(dx.mul(fr.sX).add(dz.mul(fr.sZ)), dx.mul(fr.aX).add(dz.mul(fr.aZ)));
  };
  const saUV = (sa: TslNode): TslNode => vec2(sa.x.sub(g.s0).div(lenS), sa.y.sub(g.a0).div(lenA));
  const readA = (uv: TslNode): TslNode => texture(texA, uv).level(float(0));
  const readC = (uv: TslNode): TslNode => texture(texC, uv).level(float(0));
  /**
   * A cubic B-spline read of a state texture: four bilinear taps weighted
   * so they sum the sixteen texels of the spline (the standard four-tap
   * form). The tip of a swash is a jump of a centimeter of water across one
   * cell, and a bilinear read draws that jump as the grid's 0.5 m steps
   * along the shore; the spline's read is smooth in its first derivative.
   */
  const spline = (tex: THREE.DataTexture, uv: TslNode): TslNode => {
    const size = vec2(g.ns, g.na);
    const x = uv.mul(size).sub(0.5);
    const i = floor(x);
    const f = x.sub(i);
    const f2 = f.mul(f);
    const f3 = f2.mul(f);
    const w0 = float(1).sub(f).pow(3).div(6);
    const w1 = f3.mul(3).sub(f2.mul(6)).add(4).div(6);
    const w2 = f3.mul(-3).add(f2.mul(3)).add(f.mul(3)).add(1).div(6);
    const w3 = f3.div(6);
    const g0 = w0.add(w1);
    const g1 = w2.add(w3);
    const p0 = i.sub(1).add(w1.div(g0)).add(0.5).div(size);
    const p1 = i.add(1).add(w3.div(g1)).add(0.5).div(size);
    const t = (u: TslNode, v: TslNode): TslNode => texture(tex, vec2(u, v)).level(float(0));
    return t(p0.x, p0.y).mul(g0.x).add(t(p1.x, p0.y).mul(g1.x)).mul(g0.y)
      .add(t(p0.x, p1.y).mul(g0.x).add(t(p1.x, p1.y).mul(g1.x)).mul(g1.y));
  };
  /**
   * THE WANDER: the look reads the state at a point moved by a smooth noise,
   * up to WANDER_S_M plus WANDER_S2_M across the shore and WANDER_A_M along
   * it. The tip of a real swash and a bore's front wander over the sand's
   * own small relief at scales the 0.5 m grid cannot hold; this puts that
   * wander into the drawn lines. World space: the same at any view. The
   * lines still move with the swash: the state they read moves.
   */
  const wanderBase = (xz: TslNode, sa: TslNode): TslNode => sa.add(vec2(
    noise2(xz, 1.3, 0, 3.7).mul(WANDER_S_M).add(noise2(xz, 0.41, 2, 5.9).mul(WANDER_S2_M)),
    noise2(xz, 1.11, 1, 8.1).mul(WANDER_A_M),
  ));
  /**
   * ROUND 8: THE FRONT'S SCALLOPS ARE IN THE READ. The water's state is read
   * up to RIM_SCALLOP_DEPTH_M onshore of the point, in arcs RIM_SCALLOP_M long
   * along the shore, so each line the water draws (the sheet's edge, the rim
   * on it, the wet sand under it, its foam) is set back seaward into scallops
   * that meet in cusps up the beach, all together. Round 7 set back only the
   * sheet's edge and the rim, so the dark wet sand at the grid's own edge lay
   * in front of them with no foam on it.
   */
  const wander = (xz: TslNode, sa: TslNode): TslNode => {
    const fS = fract(sa.y.div(RIM_SCALLOP_M).add(noise2(xz, RIM_SCALLOP_M * 1.7, 1, 2.9).mul(0.35)));
    const setBack = fS.mul(float(1).sub(fS)).mul(4).mul(RIM_SCALLOP_DEPTH_M).mul(noise2(xz, RIM_SCALLOP_M * 2.3, 3, 6.6).mul(0.4).add(0.6));
    return wanderBase(xz, sa).add(vec2(setBack, 0));
  };
  /** The breaker's segments (see SEG_AMP): the amount of dense foam, varied along the shore. */
  /** `strength` 0 to 1 (V2, see STRENGTH): a strong bore is one band, with no segments. */
  const segmented = (sa: TslNode, amount: TslNode, strength: TslNode | null = null): TslNode => {
    // Round 6: across the shore too, and wandering (a function of the
    // along-shore position alone drew blocks with straight sides).
    const n = noise2(vec2(sa.y.add(sa.x.mul(0.45)), sa.x.mul(0.8).add(uTime.mul(SEG_M / SEG_T_S))), SEG_M, 2, 11.3);
    const seg = mix(float(1 - SEG_AMP), float(1.15), smoothstep(float(-0.25), float(0.35), n));
    const segK = strength === null ? smoothstep(float(0.3), float(0.7), amount) : smoothstep(float(0.3), float(0.7), amount).mul(float(1).sub(strength));
    return clamp(amount.mul(mix(float(1), seg, segK)), float(0), float(1));
  };
  /** The share of the film's foam the lace draws at depth `h` (see FILM_FOAM_KEEP). */
  const filmKeep = (h: TslNode): TslNode => float(1).sub(
    smoothstep(float(0.002), float(0.004), h).mul(float(1).sub(smoothstep(float(0.03), float(0.08), h))).mul(1 - FILM_FOAM_KEEP));
  /** The film's share at a grid depth `h`, 1 to 0 over FILM_PART_H (V1: no lace there). */
  const filmPart = (h: TslNode): TslNode => float(1).sub(smoothstep(float(FILM_PART_H[0]), float(FILM_PART_H[1]), h));
  /** V1's glassy sky shine at a grid depth `h` (see GLASS_THIN): more as the film thins, no streaks. */
  const glassShare = (h: TslNode): TslNode => smoothstep(float(SHEET_MIN_M), float(0.001), h)
    .mul(mix(float(GLASS_THIN), float(GLASS_THICK), smoothstep(float(GLASS_H[0]), float(GLASS_H[1]), h)));
  /** vSheet's dapple, 0 to 1 (see SHEET_DAPPLE_M): light cells, carried with the flow `vel` in two phases. */
  const dapple = (xz: TslNode, vel: TslNode): TslNode => {
    const v = vel.mul(0.5);
    const ph1 = fract(uTime.div(FLOW_PHASE_S * 2));
    const ph2 = fract(uTime.div(FLOW_PHASE_S * 2).add(0.5));
    const q1 = xz.sub(v.mul(ph1.mul(FLOW_PHASE_S * 2)));
    const q2 = xz.sub(v.mul(ph2.mul(FLOW_PHASE_S * 2))).add(vec2(2.3, 4.1));
    const wgt = abs(ph1.mul(2).sub(1));
    const at = (q: TslNode): TslNode => noise2(q, SHEET_DAPPLE_M, 3, 51.7).mul(0.6).add(noise2(q, SHEET_DAPPLE2_M, 1, 37.1).mul(0.4));
    return smoothstep(float(-0.3), float(0.6), mix(at(q1), at(q2), wgt));
  };
  /** The lace's opacity share on a sheet `h` deep (see OP_SHEET). */
  const sheetOp = (h: TslNode): TslNode => mix(float(OP_SHEET[2]), float(1), smoothstep(float(OP_SHEET[0]), float(OP_SHEET[1]), h));
  /** The skin's reads: the wander (not the front's scallops) plus the high-water mark's scallops (see HWM_SCALLOP_M). */
  const wanderSkin = (xz: TslNode, sa: TslNode): TslNode => {
    const fW = fract(sa.y.div(HWM_SCALLOP_M).add(noise2(xz, HWM_SCALLOP_M * 1.9, 2, 31.3).mul(0.4)));
    return wanderBase(xz, sa).add(vec2(fW.mul(float(1).sub(fW)).mul(4).mul(HWM_SCALLOP_DEPTH_M), 0));
  };
  /** 1 inside the patch, fading to 0 over EDGE_FADE_M at its alongshore ends, TOP_FADE_M at its top, 2 m at its sea edge. */
  const patchFade0 = (sa: TslNode): TslNode => smoothstep(float(g.a0), float(g.a0 + EDGE_FADE_M), sa.y)
    .mul(smoothstep(float(a1), float(a1 - EDGE_FADE_M), sa.y))
    .mul(smoothstep(float(s1), float(s1 - TOP_FADE_M), sa.x))
    .mul(smoothstep(float(g.s0), float(g.s0 + (opts.seaEdgeFadeM ?? 2)), sa.x));
  // The mouth's strip (see `wallStripA`): 0 inside it, rising to 1 over EDGE_FADE_M outside each side.
  const strip = opts.wallStripA;
  const patchFade = strip === undefined ? patchFade0
    : (sa: TslNode): TslNode => patchFade0(sa).mul(max(
      smoothstep(float(strip[0]), float(strip[0] - EDGE_FADE_M), sa.y),
      smoothstep(float(strip[1]), float(strip[1] + EDGE_FADE_M), sa.y),
    ));
  /** The sheet's velocity in world XZ, from its (along s, along a) pair. */
  const worldVel = (st: TslNode): TslNode => vec2(
    st.y.mul(fr.sX).add(st.z.mul(fr.aX)),
    st.y.mul(fr.sZ).add(st.z.mul(fr.aZ)),
  );

  /** Ångström's wet albedo. */
  const wetAlbedo = (alb: TslNode): TslNode => alb.mul((1 - WET_RE) * (1 - WET_RI)).div(float(1).sub(alb.mul(WET_RI)));
  /** How wet the surface looks, 0 to 1, from the skin and any sheet (see WET_LINE_SE). */
  /** The wet line's threshold (see WET_LINE_SE), with V3's second octave (DRY_LINE2_M). */
  const wetThr = (xz: TslNode): TslNode => {
    const t0 = noise2(xz, WET_PATCH_M, 0, 12.7).mul(WET_LINE_VAR).add(WET_LINE_SE);
    return LV ? t0.add(noise2(xz, DRY_LINE2_M, 2, 19.3).mul(tune.vDry.mul(DRY_LINE2_VAR))) : t0;
  };
  const wetness = (xz: TslNode, a: TslNode, b: TslNode, seSea: TslNode = float(0)): TslNode => {
    const thr = wetThr(xz);
    // V3 (vDry): a crisper ramp (see DRY_LINE_W_K).
    const lw = LV ? mix(float(WET_LINE_W), float(WET_LINE_W * DRY_LINE_W_K), tune.vDry) : float(WET_LINE_W);
    // Round 13 (the match): the wet line MATCH_LINE_W_K times wider (a soft, drying edge).
    const lwM = MT ? lw.mul(mix(float(1), tune.mLineWK, tune.vMatch)) : lw;
    const line = smoothstep(thr.sub(lwM), thr.add(lwM), b.x);
    const soak = mix(float(1), float(WET_SOAK_K), smoothstep(float(WET_SOAK_S[0] / 60), float(WET_SOAK_S[1] / 60), b.w));
    const damp = line.mul(mix(float(WET_DAMP_LO), float(WET_DRAINED), smoothstep(thr, float(0.97), b.x))).mul(soak);
    // The drying blotches on the line's land side (see WET_FRINGE_M): the skin
    // WET_FRINGE_M seaward is over the threshold.
    const blotch0 = smoothstep(thr, thr.add(0.25), seSea).mul(float(1).sub(line))
      // Round 8: crisp-edged (from -0.2 to 0.3 of the noise to round 7, soft smudges).
      .mul(smoothstep(float(0.02), float(0.1), noise2(xz, WET_BLOTCH_M, 1, 61.1).mul(0.7).add(noise2(xz, WET_BLOTCH_M * 0.37, 3, 67.3).mul(0.3))))
      .mul(WET_BLOTCH * WET_DAMP_LO);
    const blotch = LV ? blotch0.mul(mix(float(1), float(DRY_BLOTCH_K), tune.vDry)) : blotch0;
    return max(
      max(max(damp, blotch), smoothstep(float(0), float(0.002), a.x)),
      // Stranded foam is bubbles standing in the water they came in with: the
      // sand under it is wet (round 2: a judge read foam on light sand as
      // "sprites stuck on top, with no wet mark under them").
      smoothstep(float(0.02), float(0.15), b.y),
    );
  };

  /** The foam's white, lit by the sun's height (as the sea's own foam), in the swash's cream (SWASH_FOAM_TINT). */
  const ndlSun = clamp(uSun.y, float(0), float(1));
  const foamWhite = vec3(0.86 * SWASH_FOAM_TINT[0], 0.90 * SWASH_FOAM_TINT[1], 0.92 * SWASH_FOAM_TINT[2])
    .mul(float(0.7).add(ndlSun.mul(0.3).mul(sunVis)));
  /** Round 12 (the match): the strong bore's foam a cool white (MATCH_FOAM_TINT over SWASH_FOAM_TINT). */
  // Scaled to keep the foam's luma (a bare tint of MATCH_FOAM_TINT drew the surf's brightest tenth 15 luma dimmer).
  const lumOf = (c: readonly number[]): number => 0.2126 * 0.86 * c[0] + 0.7152 * 0.9 * c[1] + 0.0722 * 0.92 * c[2];
  const coolLumK = lumOf(SWASH_FOAM_TINT) / lumOf(MATCH_FOAM_TINT);
  const coolTint = vec3(MATCH_FOAM_TINT[0] / SWASH_FOAM_TINT[0], MATCH_FOAM_TINT[1] / SWASH_FOAM_TINT[1], MATCH_FOAM_TINT[2] / SWASH_FOAM_TINT[2]).mul(coolLumK);
  /** The foam's radiance at an amount: a thin film of bubbles lets 40% of the water's darker light through. */
  const foamLight = (amount: TslNode): TslNode => foamWhite.mul(float(0.6).add(smoothstep(float(0.25), float(0.9), amount).mul(0.4)));
  /**
   * The milk's light: the foam's white seen through the water that carries
   * the bubbles, which takes its red (a pale green white, as surf water).
   */
  const milkLight = foamWhite.mul(vec3(0.62, 0.78, 0.74));
  /** The low sky the film reflects (see FILM_SKY_UP): the view's reflection off a level film, lowered to FILM_SKY_UP. */
  const filmSkyLow = (viewDir: TslNode): TslNode => {
    const r = vec2(viewDir.x.negate(), viewDir.z.negate());
    const rl = max(length(r), float(1e-3));
    const hz = Math.sqrt(1 - FILM_SKY_UP * FILM_SKY_UP);
    const dir = vec3(r.x.div(rl).mul(hz), float(FILM_SKY_UP), r.y.div(rl).mul(hz));
    const sk = oceanSkyRadiance(dir, uSun, 0, uOvercast, 0, opts.skyClouds, float(1), float(0.15));
    const lum = dot(sk, vec3(0.2126, 0.7152, 0.0722));
    return mix(sk, vec3(lum, lum, lum), FILM_SKY_GRAY);
  };
  /**
   * The film's share of reflected low sky at a grid depth `h` (see
   * FILM_SKY_SHARE): from the film's visible edge to full, and gone as the
   * water deepens past the swash zone's (5 to 30 cm, as WET_IMMERSED_DEEP_M).
   * The one share the sheet's thin part, its deep part (through the reader)
   * and the sea's own surface over the grid (the hook) all draw.
   */
  const filmShare = (h: TslNode): TslNode => smoothstep(float(SHEET_MIN_M), float(SHEET_FULL_M * 2), h)
    .mul(float(1).sub(smoothstep(float(WET_IMMERSED_DEEP_M[0]), float(WET_IMMERSED_DEEP_M[1]), h))).mul(FILM_SKY_SHARE);
  /** The silver sheen's share at a grid depth `h` (see FILM_SHEEN): a band behind the leading edge. */
  const sheenShare = (h: TslNode): TslNode => smoothstep(float(SHEET_MIN_M), float(FILM_SHEEN_M[0]), h)
    .mul(float(1).sub(smoothstep(float(FILM_SHEEN_M[1]), float(FILM_SHEEN_M[2]), h))).mul(FILM_SHEEN);
  /** The fines' veil's light (VEIL_TINT of the foam's white, the same sun). */
  const veilLight = foamWhite.mul(vec3(VEIL_TINT[0], VEIL_TINT[1], VEIL_TINT[2]));
  /** The surf's own body's light (see SURF_BODY_RGB), the sun's share as the lagoon's in-scatter. */
  const surfLight = (MT
    ? mix(vec3(SURF_BODY_RGB[0], SURF_BODY_RGB[1], SURF_BODY_RGB[2]), vec3(MATCH_SURF_BODY_RGB[0], MATCH_SURF_BODY_RGB[1], MATCH_SURF_BODY_RGB[2]), tune.vMatch)
    : vec3(SURF_BODY_RGB[0], SURF_BODY_RGB[1], SURF_BODY_RGB[2])).mul(sunVis.mul(0.7).add(0.3));
  /** V2's bore face's light (see FACE_RGB), the sun's share as the surf's. */
  const faceLight = (MT
    ? mix(vec3(FACE_RGB[0], FACE_RGB[1], FACE_RGB[2]), vec3(MATCH_FACE_RGB[0], MATCH_FACE_RGB[1], MATCH_FACE_RGB[2]), tune.vMatch)
    : vec3(FACE_RGB[0], FACE_RGB[1], FACE_RGB[2])).mul(sunVis.mul(0.7).add(0.3));

  /**
   * THE LACE: foam amount -> coverage. Bubble rafts torn by holes (the
   * coarse cells), bubbles in them (the fine cells), both carried with the
   * water in two flow-map phases. `foot` is the pixel's footprint: a cell
   * smaller than about three pixels is read as its mean, so the lace never
   * aliases into noise at a distance.
   */
  /** `wakeMixUniformCdf` in oceanWakeMath.ts, node for node (copied from `oceanWake.ts`'s mixUniform). */
  const mixUniform = (x: TslNode, w: TslNode): TslNode => {
    const p = min(w, float(1).sub(w)).toVar();
    const q = max(w, float(1).sub(w)).toVar();
    const xx = clamp(x, float(0), float(1)).toVar();
    const pq2 = max(p.mul(q).mul(2), float(1e-6));
    const lo = xx.mul(xx).div(pq2);
    const mid = xx.sub(p.mul(0.5)).div(q);
    const hi = float(1).sub(float(1).sub(xx).mul(float(1).sub(xx)).div(pq2));
    const out = select(xx.lessThan(p), lo, select(xx.lessThan(q), mid, hi));
    return select(p.lessThan(float(1e-6)), xx, out);
  };
  const T0 = WAKE_LACE_TILE_M[0] * LACE_TILE_SCALE;
  const T2 = WAKE_LACE_TILE_M[2] * LACE_TILE_SCALE;
  const T3 = WAKE_LACE_TILE_M[3] * LACE_TILE_SCALE;
  /** A read of the wake's lace image at tile `tile` (m) in beach coordinates `p`, mip level from the footprint. */
  // `alongS` draws the read out along s (the fall line), else along a (the
  // shore). One mip level sharper than the footprint (the wake reads with
  // anisotropic gradients; a full-footprint level blurred the raft's holes
  // shut and drew the bore's foam as smooth masses).
  const wl = (p: TslNode, tile: number, stretch: number, off: [number, number], foot: TslNode, alongS = false): TslNode => {
    const uv = (alongS ? vec2(p.x.div(stretch * tile), p.y.div(tile)) : vec2(p.x.div(tile), p.y.div(stretch * tile))).add(vec2(off[0], off[1]));
    const lod = max(log2(foot.mul(512 / tile)).sub(1), float(0));
    return texture(wakeLaceTex, uv).level(lod);
  };
  /** The equalized rank of the wake's mixed lace noise at beach point `p` (see LACE_TILE_SCALE). */
  const laceRank = (p: TslNode, kS: TslNode, foot: TslNode, holeS = LACE_HOLE_STRETCH, streakS = LACE_STREAK_STRETCH): TslNode => {
    const holes = wl(p, T0, holeS, [0, 0], foot).x.toVar();
    If(kS.greaterThan(0.01), () => {
      // The backwash draws its foam out down the fall line (the wake's wispStretch).
      holes.assign(mix(holes, wl(p, T0, LACE_WISP_STRETCH, [0.41, 0.77], foot, true).x, kS));
    });
    // (No clumps read: BEACH_LACE_WEIGHTS[1] is 0, see there.)
    const streaks = mix(wl(p, T2, streakS, [0.13, 0.29], foot).z,
      wl(p, T2, LACE_STREAK_STRETCH, [0.67, 0.11], foot, true).z, kS);
    const patches = wl(p, T3, 1, [0.71, 0.05], foot).w;
    const noise = holes.mul(BEACH_LACE_WEIGHTS[0]).add(streaks.mul(BEACH_LACE_WEIGHTS[2])).add(patches.mul(BEACH_LACE_WEIGHTS[3]));
    const x = clamp(noise, float(0), float(1)).mul(WAKE_LACE_CDF_KNOTS).toVar();
    const k0 = min(int(floor(x)), int(WAKE_LACE_CDF_KNOTS - 1)).toVar();
    return mix(uLaceCdf.element(k0), uLaceCdf.element(k0.add(int(1))), x.sub(float(k0)));
  };
  /**
   * THE LACE: foam `amount` of age `age` (s) -> (coverage, shade), carried
   * with the water `vel` in two flow-map phases. The wake's round-11 method
   * (see LACE_TILE_SCALE). `op` is the caller's share of the opacity (see OP_LO).
   */
  const lace = (xz: TslNode, vel: TslNode, amount: TslNode, foot: TslNode, age: TslNode = float(0), op: TslNode = float(1), swashH: TslNode | null = null, trailK: TslNode | null = null, thinFade: TslNode | null = null, band: TslNode | null = null, tileK: TslNode | null = null, foldTo: TslNode | null = null): TslNode => {
    // Round 12 (the match): `tileK` reads the lace at that many times its tile
    // (see MATCH_TILE_K); null builds round 8's reads.
    const sK = (pp: TslNode): TslNode => (tileK === null ? pp : pp.div(tileK));
    const footK = tileK === null ? foot : foot.div(tileK);
    // THE FLOW MAP, gentle (round 2): two phases of FLOW_PHASE_S, at
    // LACE_FLOW of the sheet's speed and never faster than LACE_FLOW_MAX.
    const v0 = vel.mul(LACE_FLOW);
    const vl = length(v0);
    const v = v0.mul(min(float(1), float(LACE_FLOW_MAX).div(max(vl, float(1e-4)))));
    const ph1 = fract(uTime.div(FLOW_PHASE_S));
    const ph2 = fract(uTime.div(FLOW_PHASE_S).add(0.5));
    const cyc1 = floor(uTime.div(FLOW_PHASE_S));
    const cyc2 = floor(uTime.div(FLOW_PHASE_S).add(0.5));
    const q1 = xz.sub(v.mul(ph1.mul(FLOW_PHASE_S))).add(vec2(cyc1.mul(1.37), cyc1.mul(2.71)));
    const q2 = xz.sub(v.mul(ph2.mul(FLOW_PHASE_S))).add(vec2(cyc2.mul(3.11).add(0.5), cyc2.mul(1.93)));
    const wgt = abs(ph1.mul(2).sub(1));
    const a0 = clamp(amount, float(0), float(1)).toVar();
    // Where the sheet runs seaward (the backwash).
    const uS = vel.x.mul(fr.sX).add(vel.y.mul(fr.sZ));
    const kS = smoothstep(float(0.1), float(0.6), uS.negate()).toVar();
    const wob = float(0).toVar();
    if (swashH !== null) {
      // V1 (vFilm): no lace on the film (FILM_PART_H), but in V4's patches
      // (step 2: V1 and V4 ship together; the film's cut removed V4's feed).
      // (0.2 to 0.5 of the patch noise, about a quarter of the face; at 0.1
      // to 0.45 a first combined build drew whole fields of streaks.)
      const feedP = smoothstep(float(0.2), float(0.5), noise2(xz, FEED_PATCH_M, 1, 81.3));
      a0.assign(a0.mul(float(1).sub(tune.vFilm.mul(filmPart(swashH)).mul(float(1).sub(feedP.mul(tune.vFeed))))));
      // V4 (vFeed, see FEED_PATCH_M): the swash's own lace only, on the sheet
      // (FEED_H) and not in the dense bore (FEED_BORE).
      const onSheet = smoothstep(float(FEED_H[0]), float(FEED_H[1]), swashH).mul(float(1).sub(smoothstep(float(FEED_H[2]), float(FEED_H[3]), swashH)))
        .mul(float(1).sub(smoothstep(float(FEED_BORE[0]), float(FEED_BORE[1]), a0)));
      // (Not keyed on the flow's direction: at both judged times the sheet
      // runs back almost everywhere, and a first build keyed on the uprush
      // changed 0.1% of the pixels.)
      const feed = feedP.mul(onSheet).mul(tune.vFeed);
      const scum = kS.mul(smoothstep(float(0.25), float(0.55), noise2(xz, SCUM_PATCH_M, 3, 91.7))).mul(onSheet).mul(tune.vFeed);
      a0.assign(max(clamp(a0.mul(feed.mul(FEED_GAIN).add(1)), float(0), float(1)), scum.mul(SCUM_AMOUNT)));
      kS.assign(max(kS, feed));
      wob.assign(feed);
    }
    // vTrail (see TRAIL_SIDE): the bore's thin seaward foam drawn out down the fall line.
    if (trailK !== null) {
      kS.assign(max(kS, trailK.mul(tune.vTrail)));
      wob.assign(max(wob, trailK.mul(tune.vTrail)));
    }
    // V4's streaks wobble sideways (see FEED_WOBBLE_M); only with the levers.
    const aDir = vec2(fr.aX, fr.aZ);
    const q1w = LV ? q1.add(aDir.mul(noise2(q1, FEED_WOBBLE_M, 2, 5.7).mul(FEED_WOBBLE).mul(wob))) : q1;
    const q2w = LV ? q2.add(aDir.mul(noise2(q2, FEED_WOBBLE_M, 2, 5.7).mul(FEED_WOBBLE).mul(wob))) : q2;
    // The two phases' ranks, mixed and made uniform again.
    const rank = mixUniform(mix(laceRank(sK(toSA(q1w)), kS, footK), laceRank(sK(toSA(q2w)), kS, footK), wgt), wgt).toVar();
    // V2 (vBand, see STRENGTH): the strong bore's lace drawn out along the shore.
    if (band !== null) {
      If(band.greaterThan(0.01), () => {
        // (Round 13, the match: drawn out further along the shore, MATCH_HOLE_STRETCH.)
        const hS = MT ? MATCH_HOLE_STRETCH : BAND_HOLE_STRETCH;
        const stS = MT ? MATCH_STREAK_STRETCH : BAND_STREAK_STRETCH;
        const rankB = mixUniform(mix(laceRank(sK(toSA(q1w)), kS, footK, hS, stS),
          laceRank(sK(toSA(q2w)), kS, footK, hS, stS), wgt), wgt);
        rank.assign(mix(rank, rankB, band));
      });
    }

    // THE NET (see NET_FOLD): the raft is threads round windows, more so as it ages.
    const wFold0 = mix(float(NET_FOLD[0]), float(NET_FOLD[1]), smoothstep(float(AGE_FOLD[0]), float(AGE_FOLD[1]), age));
    // Round 12 (the match): `foldTo` folds the rank at least that far (threads round windows, see MATCH_FOLD).
    const wFold = foldTo === null ? wFold0 : max(wFold0, foldTo);
    const rankF = float(1).sub(abs(rank.mul(2).sub(1)));
    // Round 12 (the match): the foam line's cover cap MATCH_BAND_COVER.
    const bandCap = MT ? mix(float(BAND_MAX_COVER), tune.mBandCover, tune.vMatch) : float(BAND_MAX_COVER);
    const edge = float(1).sub(min(a0, band === null ? float(LACE_MAX_COVER) : mix(float(LACE_MAX_COVER), bandCap, band)));
    const coverS = mix(smoothstep(edge.sub(LACE_SOFT), edge.add(LACE_SOFT), rank),
      smoothstep(edge.sub(LACE_SOFT), edge.add(LACE_SOFT), rankF), wFold);
    const rankO = mix(rank, rankF, wFold);
    const gate = smoothstep(float(THIN_GATE[0]), float(THIN_GATE[1]), a0);
    // THE BREAK-UP (see BREAK_TILE): old, thin foam breaks into dashes and
    // specks, and into streaks down the fall line where the sheet runs seaward.
    const pB = sK(toSA(q1));
    const fine = mix(wl(pB, T0 * BREAK_TILE, 1, [0.29, 0.53], footK).x,
      wl(pB, T0 * BREAK_TILE, BREAK_STRETCH, [0.61, 0.17], footK, true).x, kS);
    const keep = smoothstep(float(BREAK_KEEP[0]), float(BREAK_KEEP[1]), fine);
    const brk = float(BREAK_MAX).mul(smoothstep(float(BREAK_AGE[0]), float(BREAK_AGE[1]), age))
      .mul(float(1).sub(smoothstep(float(BREAK_AMT[0]), float(BREAK_AMT[1]), a0)));
    const cover0 = coverS.mul(gate).mul(float(1).sub(brk.mul(float(1).sub(keep))));
    // Under three pixels a raft cell reads as its mean: the amount itself,
    // less the share the break-up takes.
    const kFar = smoothstep(float(LACE_MID_M / 3), float(LACE_MID_M), footK);
    const cover = mix(cover0, a0.mul(gate).mul(float(1).sub(brk.mul((BREAK_KEEP[0] + BREAK_KEEP[1]) / 2))), kFar);
    // OPACITY (see OP_LO): a film of bubbles to the densest foam, never
    // opaque; thinner with age (the wake's ageOpacity); the caller's share.
    // Over the capped threshold (round 8: over the raw amount, the densest
    // foam was near full opacity in every pixel, a flat glowing patch).
    const over = rankO.sub(edge);
    const opLo = band === null ? float(OP_LO) : mix(float(OP_LO), float(BAND_OP_LO), band);
    // Round 12 (the match): the strong bore's band brighter (MATCH_BAND_OP_HI).
    const opHi = band === null ? float(OP_HI) : mix(float(OP_HI), MT ? mix(float(BAND_OP_HI), tune.mBandOpHi, tune.vMatch) : float(BAND_OP_HI), band);
    const opacity = max(mix(opLo, opHi, smoothstep(float(0), float(OP_RANGE), over)),
      float(BREAK_SPECK_OP).mul(brk).mul(keep)
        // vSpeckle: the specks fade in the surf's depth (see SPECKLE_H).
        .mul(swashH === null ? float(1) : float(1).sub(smoothstep(float(SPECKLE_H[0] * 2), float(SPECKLE_H[1]), swashH).mul(tune.vSpeckle))))
      // vSpeckle: thin foam in the surf's depth and away from the bore is
      // fainter (SPECKLE_THIN_OP off at most; the bore's cores and their
      // fringes keep all of it: `thinFade`, the caller's).
      .mul(swashH === null || thinFade === null ? float(1) : float(1).sub(smoothstep(float(SPECKLE_H[0] * 2), float(SPECKLE_H[1]), swashH)
        .mul(float(1).sub(smoothstep(float(0.25), float(0.5), a0))).mul(thinFade).mul(SPECKLE_THIN_OP).mul(tune.vSpeckle)))
      .mul(mix(float(1), float(AGE_OPACITY[2]), smoothstep(float(AGE_OPACITY[0]), float(AGE_OPACITY[1]), age))).mul(op);
    // THE SHADE: dense foam brightest; old foam grayer (the foam piece's age clock).
    // (The rank's depth over the threshold varies it through dense foam too:
    // a first build saturated at 0.35 of rank and drew dense foam flat white.)
    const shade = float(0.72).add(smoothstep(float(0), float(0.75), over).mul(0.28))
      .mul(mix(float(1), float(AGE_GRAY[2]), smoothstep(float(AGE_GRAY[0]), float(AGE_GRAY[1]), age)));
    return vec2(cover.mul(opacity), shade);
  };

  /** The milk's plumes: 0.35 to 1, a noise of MILK_PLUME_M carried with the flow as the lace is. */
  const plumes = (xz: TslNode, vel: TslNode): TslNode => {
    const ph1 = fract(uTime.div(FLOW_PHASE_S * 2));
    const ph2 = fract(uTime.div(FLOW_PHASE_S * 2).add(0.5));
    const q1 = xz.sub(vel.mul(ph1.mul(FLOW_PHASE_S * 2)));
    const q2 = xz.sub(vel.mul(ph2.mul(FLOW_PHASE_S * 2))).add(vec2(5.3, 1.7));
    const wgt = abs(ph1.mul(2).sub(1));
    const n1 = noise2(q1, MILK_PLUME_M, 3, 7.7);
    const n2 = noise2(q2, MILK_PLUME_M, 3, 7.7);
    return smoothstep(float(-0.5), float(0.6), mix(n1, n2, wgt)).mul(0.65).add(0.35);
  };

  /**
   * The film's web: the tile's bubble net (G, 0 on a rim) as bright lines,
   * minus its tile mean so the light only moves; carried with the film in
   * the lace's two phases. Read as its mean (0) once a cell is under three
   * pixels.
   */
  const filmWeb = (xz: TslNode, vel: TslNode, foot: TslNode): TslNode => {
    const v = vel.mul(0.6);
    const ph1 = fract(uTime.div(FLOW_PHASE_S));
    const ph2 = fract(uTime.div(FLOW_PHASE_S).add(0.5));
    const cyc1 = floor(uTime.div(FLOW_PHASE_S));
    const cyc2 = floor(uTime.div(FLOW_PHASE_S).add(0.5));
    const q1 = xz.sub(v.mul(ph1.mul(FLOW_PHASE_S))).add(vec2(cyc1.mul(0.71), cyc1.mul(1.13)));
    const q2 = xz.sub(v.mul(ph2.mul(FLOW_PHASE_S))).add(vec2(cyc2.mul(1.57).add(0.3), cyc2.mul(0.97)));
    const wgt = abs(ph1.mul(2).sub(1));
    const line = (q: TslNode): TslNode => float(1).sub(smoothstep(float(0), float(0.18), texture(foamTileTex, q.div(SWASH_TILE_M)).level(float(0)).y));
    // Its lines are a sixth of a cell: faded as the cell falls from eight
    // pixels to four, before the lines go under a pixel and sparkle.
    const k = float(1).sub(smoothstep(float(LACE_BUBBLE_M / 8), float(LACE_BUBBLE_M / 4), foot));
    return mix(line(q1), line(q2), wgt).sub(filmWebMean).mul(k);
  };

  /* --- the floor with the beach's hook -------------------------------- */

  const insidePatch = (sa: TslNode, inset: number): TslNode => smoothstep(float(g.s0 + inset - 1e-4), float(g.s0 + inset), sa.x)
    .mul(smoothstep(float(s1 - inset + 1e-4), float(s1 - inset), sa.x))
    .mul(smoothstep(float(g.a0 + inset - 1e-4), float(g.a0 + inset), sa.y))
    .mul(smoothstep(float(a1 - inset + 1e-4), float(a1 - inset), sa.y));
  /**
   * The beach's sand at a floor point inside the patch: detailed (the mottle
   * and the specks, see MOTTLE_COARSE_M) and wetted (Angstrom's law, by the
   * skin's state).
   */
  const beachAlbedo = (xz: TslNode, sa: TslNode, inPatch: TslNode, albedo: TslNode, footM: TslNode): TslNode => {
    const uv = saUV(wander(xz, sa));
    const stA = spline(texA, uv);
    const stB = spline(texB, saUV(wanderSkin(xz, sa)));
    const seSea = spline(texB, saUV(wanderSkin(xz, sa.sub(vec2(WET_FRINGE_M, 0))))).x;
    const k0 = wetness(xz, stA, stB, seSea).mul(inPatch).mul(tune.wet);
    // Round 17 (the match): THE DAMP RAMP. Manly's sand darkens gradually over
    // 28 to 65 rows (1 to 2.4 m at our frame's scale) above its wet zone; ours
    // stepped from wet to dry in about 5 rows (the skin's wet line). The ramp
    // is the wetness of the skin MATCH_RAMP_M[k] seaward, weighted down with
    // the distance: sand next to wet sand holds some of its water (capillary
    // wicking and the last swashes' spray). World space: the state and the
    // beach frame only.
    let k = k0;
    if (MT) {
      const thrR = wetThr(xz);
      const wetAt = (dM: number): TslNode => smoothstep(thrR, thrR.add(0.1), texture(texB, saUV(sa.sub(vec2(dM, 0)))).level(float(0)).x);
      const ramp = max(max(wetAt(MATCH_RAMP_M[0]).mul(0.85), wetAt(MATCH_RAMP_M[1]).mul(0.6)), max(wetAt(MATCH_RAMP_M[2]).mul(0.38), wetAt(MATCH_RAMP_M[3]).mul(0.18)));
      k = max(k0, ramp.mul(tune.mRampK).mul(tune.vMatch).mul(inPatch).mul(tune.wet));
    }
    // The grains immersed (see WET_IMMERSED_K): under a sheet, the more the
    // deeper it is to FILM_DEEP_M (the darkest sand is at the water).
    // Round 12 (the match): full over MATCH_FILM_DEEP_M, so the film is one tone.
    const underSheet = (MT
      ? smoothstep(mix(float(FILM_DEEP_M[0]), tune.mFilmDeep0, tune.vMatch), mix(float(FILM_DEEP_M[1]), tune.mFilmDeep1, tune.vMatch), stA.x)
      : smoothstep(float(FILM_DEEP_M[0]), float(FILM_DEEP_M[1]), stA.x))
      .mul(float(1).sub(smoothstep(float(WET_IMMERSED_DEEP_M[0]), float(WET_IMMERSED_DEEP_M[1]), stA.x)));
    // V3 (vDry): fresh wet sand keeps a film in its pores (see DRY_FRESH_S).
    // (Built only with the levers: `fresh` is read only then.)
    const pF = smoothstep(float(-0.5), float(0.5), noise2(xz, DRY_PATCH_M, 1, 33.7).mul(0.7)
      .add(noise2(xz, DRY_PATCH_M * 0.3, 3, 71.1).mul(0.3))).mul(0.8).add(0.6);
    const fresh = float(1).sub(smoothstep(pF.mul(DRY_FRESH_S[0]), pF.mul(DRY_FRESH_S[1]), stB.w.mul(60)))
      .mul(smoothstep(float(0.6), float(0.8), stB.x)).mul(DRY_FRESH_K).mul(tune.vDry);
    const full = (LV ? max(underSheet, fresh) : underSheet).mul(inPatch).mul(tune.wet);
    const fadeOf = (scale: number): TslNode => float(1).sub(smoothstep(float(scale / 3), float(scale / 1.5), footM));
    // Dry sand is patchy, wet sand smooth (see MOTTLE_FINE_WET); vSheet: the
    // sand under the water keeps the dry sand's grain (SHEET_GRAIN_K).
    const dry = LV ? max(float(1).sub(k), underSheet.mul(SHEET_GRAIN_K).mul(tune.vSheet).mul(inPatch)) : float(1).sub(k);
    // V1 (vSand): the dry sand's fine grain up (see SAND_GRAIN_K).
    const gK = mix(float(1), float(SAND_GRAIN_K), tune.vSand);
    const gD = (c: number): TslNode => (LV ? gK.mul(c) : float(c));
    const mottle = noise2(xz, MOTTLE_BROAD_M, 1, 2.2).mul(mix(float(MOTTLE_BROAD_WET), float(MOTTLE_BROAD_DRY), dry)).mul(fadeOf(MOTTLE_BROAD_M))
      .add(noise2(xz, MOTTLE_COARSE_M, 0, 4.4).mul(mix(float(MOTTLE_COARSE_WET), gD(MOTTLE_COARSE_DRY), dry)).mul(fadeOf(MOTTLE_COARSE_M)))
      .add(noise2(xz, MOTTLE_MID_M, 1, 5.3).mul(mix(float(MOTTLE_MID_WET), gD(MOTTLE_MID_DRY), dry)).mul(fadeOf(MOTTLE_MID_M)))
      .add(noise2(xz, MOTTLE_FINE_M, 2, 6.2).mul(mix(float(MOTTLE_FINE_WET), gD(MOTTLE_FINE_DRY), dry)).mul(fadeOf(MOTTLE_FINE_M)))
      .add(noise2(xz, MOTTLE_RELIEF_M, 3, 2.9).mul(dry.mul(gD(MOTTLE_RELIEF_DRY))).mul(fadeOf(MOTTLE_RELIEF_M)));
    /**
     * Specks in cells of `cellM`: one cell in `share` holds a disc of 0.16 to
     * 0.4 of the cell at a jittered point, dark three times in four (0.5 to
     * 0.8 of the sand), pale shell the rest (1.2 to 1.4). The albedo factor.
     */
    const specks = (cellM: number, share: number, salt: number, density: TslNode): TslNode => {
      const cell = floor(xz.div(cellM)).add(salt);
      const hA = fract(sin(dot(cell, vec2(12.9898, 78.233))).mul(43758.5453));
      const hB = fract(sin(dot(cell, vec2(39.3468, 11.135))).mul(24634.6345));
      const inCell = fract(xz.div(cellM)).sub(vec2(hA.mul(0.6).add(0.2), hB.mul(0.6).add(0.2)));
      const rad = hB.mul(0.12).add(0.08);
      const disc = float(1).sub(smoothstep(rad.mul(0.7), rad, length(inCell)));
      const hC = fract(sin(dot(cell, vec2(93.989, 67.345))).mul(17453.13));
      // V1 (vSand): more specks on the dry sand (see SAND_GRAIN_K).
      const shareHere = LV ? density.mul(share).mul(mix(float(1), gK, dry.mul(tune.vSand))) : density.mul(share);
      const on = disc.mul(float(1).sub(smoothstep(shareHere.mul(0.8), shareHere, hC))).mul(fadeOf(cellM));
      const tone = mix(hC.div(share).mul(0.3).add(0.5).min(0.8), float(1.2).add(hB.mul(0.2)), smoothstep(float(0.74), float(0.76), hA));
      // vSpeckle: the surf's stirred water hides them (see SPECKLE_H).
      if (!LV) return mix(float(1), tone, on.mul(inPatch));
      const hide = float(1).sub(smoothstep(float(SPECKLE_H[0]), float(SPECKLE_H[1]), stA.x).mul(tune.vSpeckle));
      return mix(float(1), tone, on.mul(inPatch).mul(hide));
    };
    // The tone patches (see TONE_PATCH_M): two tones with crisp edges.
    const tone = smoothstep(float(-0.05), float(0.05), noise2(xz, TONE_PATCH_M, 0, 17.1)).sub(0.5).mul(TONE_PATCH_K).mul(dry);
    // V1 (vSand): the sand's color toward Manly's gold (see SAND_TINT).
    // (Faded out under the water, from SAND_TINT_H[0] to [1] m of it: under
    // the sheet and the surf a first build drew the water gold-brown, where
    // Manly's sheet is an olive gray over its gold sand.)
    const albT = LV ? albedo.mul(mix(vec3(1, 1, 1), vec3(SAND_TINT[0], SAND_TINT[1], SAND_TINT[2]),
      tune.vSand.mul(inPatch).mul(float(1).sub(MT
        // Round 12 (the match): the gold gone under MATCH_TINT_H of film.
        ? smoothstep(mix(float(SAND_TINT_H[0]), float(MATCH_TINT_H[0]), tune.vMatch), mix(float(SAND_TINT_H[1]), float(MATCH_TINT_H[1]), tune.vMatch), stA.x)
        : smoothstep(float(SAND_TINT_H[0]), float(SAND_TINT_H[1]), stA.x))))) : albedo;
    // Round 12 (the match): the sand's albedo times MATCH_SAND_RGB.
    const albM = MT ? albT.mul(mix(vec3(1, 1, 1), vec3(MATCH_SAND_RGB[0], MATCH_SAND_RGB[1], MATCH_SAND_RGB[2]), tune.vMatch.mul(inPatch))) : albT;
    const detailed = albM.mul(float(1).add(mottle.add(tone).mul(inPatch)))
      .mul(specks(SPECK_M, SPECK_SHARE, 0, float(1)))
      .mul(specks(GRAVEL_M, GRAVEL_SHARE, 71.3, mix(float(GRAVEL_WET_K), float(1), dry)));
    // vSheet: the sand under the water grayed toward olive (see SHEET_OLIVE).
    // Round 12 (the match): the film's immersed grains at MATCH_IMMERSED_K.
    const immK = MT ? mix(float(WET_IMMERSED_K), tune.mImmK, tune.vMatch) : float(WET_IMMERSED_K);
    const wetA = wetAlbedo(detailed.mul(mix(float(1), immK, full)));
    if (!LV) return mix(detailed, wetA, k);
    const wetL = dot(wetA, vec3(0.2126, 0.7152, 0.0722));
    const olive = vec3(SHEET_OLIVE_RGB[0], SHEET_OLIVE_RGB[1], SHEET_OLIVE_RGB[2]).mul(wetL);
    const wetO = mix(wetA, olive, underSheet.mul(SHEET_OLIVE).mul(tune.vSheet).mul(inPatch));
    if (!MT) return mix(detailed, wetO, k);
    // Round 12 (the match): the film one gray olive (MATCH_FILM_RGB times its
    // luma, MATCH_FILM_GRAY of the way): Manly's film is b* 5 to 8 over a
    // gold sand of b* 27 to 31.
    const filmG = vec3(MATCH_FILM_RGB[0], MATCH_FILM_RGB[1], MATCH_FILM_RGB[2]).mul(dot(wetO, vec3(0.2126, 0.7152, 0.0722)));
    const wetM = mix(wetO, filmG, underSheet.mul(tune.mFilmGray).mul(tune.vMatch).mul(inPatch));
    // Round 12 (the match): the damp and the wet sand darker (MATCH_DAMP_K,
    // MATCH_WET_K): sand the sheet left under MATCH_WET_S ago is the wet sand.
    const fresh12 = float(1).sub(smoothstep(float(MATCH_WET_S[0]), float(MATCH_WET_S[1]), stB.w.mul(60)))
      .mul(smoothstep(float(0.6), float(0.8), stB.x));
    const kSand = k.mul(float(1).sub(underSheet)).mul(inPatch).mul(tune.vMatch);
    // Round 13: the damp sand lightens as it dries, MATCH_DAMP_K next to the
    // wet sand to MATCH_DAMP_DRY_K by MATCH_DAMP_AGE_S[1] s after the sheet left.
    const dampK = mix(tune.mDampK, tune.mDampDryK, smoothstep(float(MATCH_DAMP_AGE_S[0]), float(MATCH_DAMP_AGE_S[1]), stB.w.mul(60)));
    const outM = mix(detailed, wetM, k).mul(mix(float(1), mix(dampK, tune.mWetK, fresh12), kSand));
    const grayW = vec3(MATCH_FILM_RGB[0], MATCH_FILM_RGB[1], MATCH_FILM_RGB[2]).mul(dot(outM, vec3(0.2126, 0.7152, 0.0722)));
    // Round 17: the sand the sheet left under MATCH_OLIVE_S ago is the sheet's
    // own dark olive (Manly's zone from the foam line up is one olive tone, b* 5
    // to 9, for 95 to 170 rows before its damp ramp), fading to the damp sand's
    // orange as it dries.
    const oliveK = float(1).sub(smoothstep(tune.mOlive0, tune.mOlive1, stB.w.mul(60))).mul(smoothstep(float(0.5), float(0.75), stB.x));
    const grayK = max(mix(float(MATCH_DAMP_GRAY), tune.mWetGray, fresh12), oliveK.mul(tune.mOliveGray)).mul(kSand);
    return mix(outM, grayW, grayK);
  };
  /**
   * ROUND 12 (the match): THE FOAM LINE BY ITS REAL WIDTH, AND THE FACE. The
   * round-11 lip's distance (the foam over its gradient) holds only a few
   * centimeters from the contour, so it could not draw a band MATCH_LINE_W_M
   * wide (at 1 and 1.5 m the frames differed by 21 pixels). The band is the
   * strong bore's foam whose shoreward front lies within MATCH_LINE_W_M
   * onshore, read at four steps, densest at the front; the face is the water
   * whose strong bore lies within MATCH_FACE_W_M seaward (its strength read
   * there: ahead of the bore the foam's run is 0). Broken where a noise falls
   * into its lowest MATCH_LINE_GAP_SHARE. Returns (line, face), each 0 to 1
   * and times `vMatch`. World space: the state and the beach frame only.
   */
  const strengthAt = (uv: TslNode, w0: TslNode): TslNode => {
    // (The match's own run length, MATCH_STRENGTH_RUN_M.)
    const R = tune.mStrRun;
    const wAtN = (d: TslNode): TslNode => readA(uv.add(vec2(d.div(lenS), 0))).w;
    const run = max(max(min(wAtN(R.negate()), w0), min(wAtN(R.mul(-0.5)), wAtN(R.mul(0.5)))), min(w0, wAtN(R)));
    return smoothstep(float(STRENGTH[0]), float(STRENGTH[1]), run).mul(tune.vBand);
  };
  const boreMatch = (sa: TslNode, uvW: TslNode, w0: TslNode): TslNode => {
    const onF = (wv: TslNode): TslNode => smoothstep(float(0.35), float(0.55), wv);
    const wAtS = (dM: TslNode): TslNode => readA(uvW.add(vec2(dM.div(lenS), 0))).w;
    const gap = smoothstep(tune.mLineGap.mul(1.6).sub(0.9), tune.mLineGap.mul(1.6).sub(0.75), noise2(vec2(sa.x.mul(0.3), sa.y), LIP_GAP_M, 3, 57.7));
    const inF = onF(w0);
    const W = tune.mLineW;
    const o1 = float(1).sub(onF(wAtS(W.mul(0.25))));
    const o2 = float(1).sub(onF(wAtS(W.mul(0.5))));
    const o3 = float(1).sub(onF(wAtS(W.mul(0.75))));
    const o4 = float(1).sub(onF(wAtS(W)));
    const lineM = inF.mul(max(max(o1, o2.mul(MATCH_LINE_PROFILE[0])), max(o3.mul(MATCH_LINE_PROFILE[1]), o4.mul(MATCH_LINE_PROFILE[2]))))
      .mul(gap).mul(strengthAt(uvW, w0)).mul(tune.vMatch);
    const uvF = uvW.add(vec2(tune.mFaceW.mul(-0.7).div(lenS), 0));
    const f1 = onF(wAtS(tune.mFaceW.mul(-0.5)));
    const f2 = onF(wAtS(tune.mFaceW.negate()));
    // Darkest next to the bore (Manly's face is darkest where the foam line
    // starts); the bore's own edge (foam 0.45 to 0.6) keeps it.
    const faceM = float(1).sub(smoothstep(float(0.45), float(0.6), w0)).mul(max(f1, f2.mul(0.5))).mul(gap).mul(strengthAt(uvF, readA(uvF).w))
      .mul(tune.mFaceShare).mul(tune.vMatch);
    return vec2(lineM, faceM);
  };
  /**
   * ROUND 13 (the match): THE SURF'S NET. Manly's surf behind its foam line is
   * a reticulated net of thin bright threads round small dark windows, 41 to
   * 56 windows per 10,000 px of about 20 px (`beach/r12/shape.py`); the wake's
   * lace drew blotchy rafts with round holes there. The net is the swash foam
   * tile's fine warped cell net (B: 0 on a wall), read at MATCH_NET_SCALE of
   * its tile (cells of about 0.37 m, Manly's window size at the judged frame's
   * scale), drawn out MATCH_NET_STRETCH times along the shore, carried with
   * the water in two flow phases, broken where a noise falls low, and read as
   * its mean once a cell is under three pixels. Returns the cover, 0 to 1.
   */
  const surfNet = (sa: TslNode, vel: TslNode, foot: TslNode): TslNode => {
    const T = SWASH_TILE_M * MATCH_NET_SCALE;
    const cellM = T / 40;
    const ph1 = fract(uTime.div(FLOW_PHASE_S));
    const ph2 = fract(uTime.div(FLOW_PHASE_S).add(0.5));
    const vS = vec2(vel.x.mul(fr.sX).add(vel.y.mul(fr.sZ)), vel.x.mul(fr.aX).add(vel.y.mul(fr.aZ))).mul(LACE_FLOW);
    // The thread's width and light vary along it (a noise of MATCH_NET_VAR_M):
    // one even width drew a crackle of cracked glaze (round 6's fault).
    const wv = noise2(vec2(sa.x, sa.y), MATCH_NET_VAR_M, 3, 41.9).mul(0.5).add(0.5);
    const hi = mix(float(MATCH_NET_LINE[0]), float(MATCH_NET_LINE[1]), wv);
    const at = (p: TslNode, off: number): TslNode => {
      // Round 14: drawn out down the fall line (the backwash tears it seaward).
      const uv = vec2(p.x.div(T * MATCH_NET_STRETCH), p.y.div(T)).add(vec2(off, off * 1.7));
      const t = texture(foamTileTex, uv).level(float(0));
      // The fine net (B) and, fainter, the coarse net (R, 2.5 times its cells).
      const fine = float(1).sub(smoothstep(float(0), hi, t.z));
      const coarse = float(1).sub(smoothstep(float(0), hi.mul(0.7), t.x)).mul(0.6);
      return max(fine, coarse);
    };
    const n1 = at(sa.sub(vS.mul(ph1.mul(FLOW_PHASE_S))), 0.13);
    const n2 = at(sa.sub(vS.mul(ph2.mul(FLOW_PHASE_S))), 0.61);
    const wgt = abs(ph1.mul(2).sub(1));
    const brk = smoothstep(float(-0.45), float(0.15), noise2(vec2(sa.x, sa.y.div(2)), 0.9, 1, 97.3))
      // Round 14: patchy at the meter scale (MATCH_NET_PATCH_M), not even.
      .mul(smoothstep(float(-0.2), float(0.35), noise2(sa, MATCH_NET_PATCH_M, 2, 13.9)));
    const light = wv.mul(0.35).add(0.65);
    const kFar = smoothstep(float(cellM / 3), float(cellM), foot);
    return mix(mix(n1, n2, wgt).mul(brk).mul(light), float(0.2), kFar);
  };
  const hook: SeabedShoreHook = {
    owns: (xz: TslNode) => insidePatch(toSA(xz), 0.01),
    // Every floor pixel of the lagoon reaches these two; only the patch's
    // do the work, the rest return the seabed's own albedo and clarity. (The
    // first build ran the splines and the noise on every floor pixel of the
    // view and multiplied them by 0 outside the patch.)
    floorAlbedo: (xz: TslNode, _depth: TslNode, albedo: TslNode, footM: TslNode) => {
      const sa = toSA(xz).toVar();
      const inPatch = patchFade(sa).mul(insidePatch(sa, 0)).toVar();
      const out = vec3(albedo).toVar();
      If(inPatch.greaterThan(0), () => {
        out.assign(beachAlbedo(xz, sa, inPatch, albedo, footM));
      });
      /* RIVER MOUTH ROUND 5 (GG-394, \`stripSoil\`): over the mouth's strip, where
       * the look above is off, the wet sand by the beach's law from the mouth
       * grid's own sand (its skin's saturation, the water on it, the time
       * since it left), weighted by the strip (1 - the look's fade there) and
       * the near field's own extent. */
      const soilAt = opts.stripSoil?.at ?? null;
      if (soilAt !== null && strip !== undefined) {
        const inStrip = float(1).sub(max(
          smoothstep(float(strip[0]), float(strip[0] - EDGE_FADE_M), sa.y),
          smoothstep(float(strip[1]), float(strip[1] + EDGE_FADE_M), sa.y),
        ));
        const st = soilAt(xz);
        const wS = inStrip.mul(st.w).mul(tune.wet).toVar();
        If(wS.greaterThan(0), () => {
          /* RIVER MOUTH ROUND 12 (gap 3): the wet look is the sand's under air or a film; under deeper water the beach's
           * own immersed fade (WET_IMMERSED_DEEP_M) hands it back to the floor the coast draws under the sea everywhere
           * else. Round 5 wetted every submerged texel of the mouth's grid: its whole box (the channel, the bar's
           * flanks, the sea out to the grid's edge) drew its floor darker than the same floor outside it, a dark
           * rectangle round the mouth straight down (mouth12/shots/z-b1.png, with the river's reader off too). */
          const kM = wetness(xz, st.a, st.b, st.b.x).mul(wS)
            .mul(float(1).sub(smoothstep(float(WET_IMMERSED_DEEP_M[0]), float(WET_IMMERSED_DEEP_M[1]), st.a.x)));
          const underM = smoothstep(float(FILM_DEEP_M[0]), float(FILM_DEEP_M[1]), st.a.x)
            .mul(float(1).sub(smoothstep(float(WET_IMMERSED_DEEP_M[0]), float(WET_IMMERSED_DEEP_M[1]), st.a.x)));
          const wetM = wetAlbedo(out.mul(mix(float(1), float(WET_IMMERSED_K), underM)));
          out.assign(mix(out, wetM, kM));
        });
      }
      return out;
    },
    // THE GRAIN (round 2): the floor's speckle is one random value per 1.2 cm
    // square, which from 3 m draws a blocky knit on the dry sand. Over the
    // patch it is two octaves of the baked smooth noise at 1.1 and 1.7 cm
    // (incommensurate, so their sum does not repeat within a view), faded
    // as a cell falls under two pixels.
    grain: (xz: TslNode, footM: TslNode, cellGrain: TslNode) => {
      // Every floor pixel of the lagoon reaches this; only the patch's read
      // the noise.
      const inPatch = insidePatch(toSA(xz), 0).toVar();
      const out = float(cellGrain).toVar();
      If(inPatch.greaterThan(0), () => {
        const k = float(1).sub(smoothstep(float(0.006), float(0.012), footM));
        const smooth = noise2(xz, 0.011, 2, 3.3).mul(0.3).add(noise2(xz, 0.017, 3, 6.1).mul(0.25)).mul(k);
        out.assign(mix(cellGrain, smooth, inPatch));
      });
      return out;
    },
    floorClarity: (xz: TslNode) => {
      const sa = toSA(xz).toVar();
      const inPatch = patchFade(sa).mul(insidePatch(sa, 0)).toVar();
      const out = float(1).toVar();
      If(inPatch.greaterThan(0), () => {
        const uv = saUV(sa);
        // The path down and back up through the sheet's own depth.
        const k0 = float(SED_ATTEN_M2_KG * 2).mul(spline(texD, uv).x).mul(max(spline(texA, uv).x, float(0)));
        // V1 (vFilm): the sand seen through the film (see GLASS_CLEAR).
        const k = LV ? k0.mul(mix(float(1), float(GLASS_CLEAR), tune.vFilm)) : k0;
        // Over the sea edge's first 5 m the grid's sand fades in, so the
        // clear lagoon and the sandy surf meet without a line.
        const seaFade = smoothstep(float(g.s0), float(g.s0 + 5), sa.x);
        // vSpeckle (see SPECKLE_H): the surf's stirred water hides the floor's
        // fine detail (its wave ripples, grain and web) as it deepens.
        const clear = LV
          ? exp(k.negate()).mul(float(1).sub(smoothstep(float(SPECKLE_H[0]), float(SPECKLE_H[1]), spline(texA, uv).x).mul(SPECKLE_CLARITY).mul(tune.vSpeckle)))
          : exp(k.negate());
        out.assign(mix(float(1), clear, inPatch.mul(seaFade)));
      });
      return out;
    },
    waterFoam: (xz: TslNode, _column: TslNode, footM: TslNode, viewDir: TslNode, own?: boolean) => {
      // Every water pixel of the sea runs this, so the lace runs only over
      // the patch. The reader hands in its pixel's footprint, so nothing
      // here takes a derivative, and a caller may run the reader in a branch.
      const sa = toSA(xz).toVar();
      const inside = insidePatch(sa, 0).toVar();
      const foot = footM;
      const cover = float(0).toVar();
      const bubShade = float(0.9).toVar();
      const milk = float(0).toVar();
      const veil = float(0).toVar();
      const surf = float(0).toVar();
      const face = float(0).toVar();
      // Round 12 (the match): the strong bore's share of the cool white (see coolTint).
      const coolK = float(0).toVar();
      const amount = float(0).toVar();
      const skyShare = float(0).toVar();
      If(inside.greaterThan(0), () => {
        const uvW = saUV(wander(xz, sa));
        const st = spline(texA, uvW);
        const k = patchFade(sa).mul(inside).mul(tune.foam);
        // The film's low sky (see FILM_SKY_UP), where the grid's water is a film.
        skyShare.assign(filmShare(st.x).mul(patchFade(sa)).mul(inside).mul(own ? 1 : 1 - FILM_SKY_SEA_CUT));
        // V1 (vFilm): no lace on the film (see FILM_PART_H).
        // V1 (vFilm): no lace on the film (see FILM_PART_H), but in V4's
        // patches (see FEED_PATCH_M); the lace applies the cut (`swashH`).
        // Round 11: the levers' reads below only with `opts.levers`.
        let strength: TslNode | null = null;
        let trailK: TslNode | null = null;
        let thinFade: TslNode | null = null;
        // Round 12 (the match): the foam line's share (see MATCH_LINE_W_M).
        const lineV = float(0).toVar();
        if (!LV) amount.assign(segmented(sa, st.w).mul(filmKeep(st.x)));
        if (LV) {
        // V2 (vBand): the bore's strength (see STRENGTH): the foam behind its front.
        const wAt = (dM: number): TslNode => readA(uvW.add(vec2(dM / lenS, 0))).w;
        const R = STRENGTH_RUN_M;
        const run = max(max(min(wAt(-R), st.w), min(wAt(-R / 2), wAt(R / 2))), min(st.w, wAt(R)));
        const strengthV = smoothstep(float(STRENGTH[0]), float(STRENGTH[1]), run).mul(tune.vBand).toVar();
        strength = strengthV;
        amount.assign(segmented(sa, st.w, strengthV).mul(filmKeep(st.x)));
        // vTrail (see TRAIL_SIDE): the seaward side of the bore, in thin foam.
        const wS = spline(texA, uvW.add(vec2(1 / g.ns, 0))).w;
        const wA = spline(texA, uvW.add(vec2(0, 1 / g.na))).w;
        const gwS = wS.sub(st.w).div(g.ds);
        const glw = max(length(vec2(gwS, wA.sub(st.w).div(g.da))), float(0.05));
        trailK = smoothstep(float(TRAIL_SIDE[0]), float(TRAIL_SIDE[1]), gwS.div(glw))
          .mul(smoothstep(float(0.15), float(0.45), noise2(vec2(sa.x.mul(0.25), sa.y), TRAIL_PATCH_M, 2, 73.3)))
          .mul(smoothstep(float(TRAIL_AMT[0]), float(TRAIL_AMT[1]), st.w)).mul(float(1).sub(smoothstep(float(TRAIL_AMT[2]), float(TRAIL_AMT[3]), st.w)));
        // vSpeckle: away from the bore (the foam 1 m to either side across the shore under 0.35 to 0.55).
        const wFore = spline(texA, uvW.add(vec2(1 / lenS, 0))).w;
        const wAft = spline(texA, uvW.sub(vec2(1 / lenS, 0))).w;
        thinFade = float(1).sub(smoothstep(float(0.35), float(0.55), max(max(wFore, wAft), st.w)));
        // V2 (vBand): THE ROLLED FRONT (see LIP_W_M) and the face before it.
        If(strengthV.greaterThan(0.01), () => {
          const shoreward = smoothstep(float(0.2), float(0.6), gwS.negate().div(glw));
          const dF = st.w.sub(LIP_W0).div(glw);
          // Round 12 (the match): the band MATCH_LINE_W_M wide, broken in
          // MATCH_LINE_GAP_SHARE, at MATCH_LINE_AMOUNT; the face MATCH_FACE_W_M
          // wide at MATCH_FACE_SHARE. Without the match, round 11's numbers.
          const gapS = MT ? mix(float(LIP_GAP_SHARE), tune.mLineGap, tune.vMatch) : float(LIP_GAP_SHARE);
          const lipW = MT ? mix(float(LIP_W_M), tune.mLineW, tune.vMatch) : float(LIP_W_M);
          const lipA = MT ? mix(float(LIP_AMOUNT), tune.mLineAmt, tune.vMatch) : float(LIP_AMOUNT);
          const faceW = MT ? mix(float(FACE_W_M), tune.mFaceW, tune.vMatch) : float(FACE_W_M);
          const faceS = MT ? mix(float(FACE_SHARE), tune.mFaceShare, tune.vMatch) : float(FACE_SHARE);
          const lipGap = smoothstep(gapS.mul(1.6).sub(0.9), gapS.mul(1.6).sub(0.75), noise2(vec2(sa.x.mul(0.3), sa.y), LIP_GAP_M, 3, 57.7));
          const lip = smoothstep(float(-0.03), float(0.03), dF).mul(float(1).sub(smoothstep(lipW.mul(0.5), lipW, dF)))
            .mul(shoreward).mul(lipGap).mul(strengthV);
          amount.assign(max(amount, lip.mul(lipA).mul(filmKeep(st.x))));
          face.assign(smoothstep(faceW.negate(), faceW.mul(-0.4), dF).mul(float(1).sub(smoothstep(float(-0.05), float(0.02), dF)))
            .mul(shoreward).mul(lipGap).mul(strengthV).mul(faceS).mul(patchFade(sa)).mul(inside));
        });
        if (MT) {
          // Round 12 (the match): the foam line and the face (see boreMatch).
          // Seaward of the line the strong bore's foam thins to the surf's lace
          // net (MATCH_SURF_AMOUNT of itself); the line is dense.
          const bm = boreMatch(sa, uvW, st.w);
          lineV.assign(bm.x);
          coolK.assign(strengthV.mul(tune.vMatch));
          amount.assign(mix(amount.mul(mix(float(1), tune.mSurfAmt, strengthV.mul(tune.vMatch))),
            max(amount, bm.x.mul(tune.mLineAmt).mul(filmKeep(st.x))), bm.x));
          face.assign(max(face.mul(float(1).sub(tune.vMatch)), bm.y.mul(patchFade(sa)).mul(inside)));
        }
        }
        // Round 12 (the match): the bore's and the surf's lace at MATCH_TILE_K of its tile.
        // (The match: the surf's lace MATCH_SURF_OP as opaque, the line as it is.)
        // (Round 12: the surf's opacity, the tile and the fold are the strong
        // bore's only, `mK`: view 1's weaker bore keeps round 8's lace.)
        // (A first build also took the strength 2.5 and 5 m onshore, so the
        // surf behind the bore took the coarse lace too: it drew scattered
        // white discs and a straight seam where the reach ended. Not kept.)
        // Round 13: the surf behind a strong bore takes its lace too (the
        // strength read MATCH_SURF_REACH_M onshore, times `mReach`). With round
        // 12's coarse tile this drew white discs and a seam; with the finer,
        // longer net it is the surf band's lace (see measure-shape.md).
        const reachAt = (dM: number): TslNode => strengthAt(uvW.add(vec2(dM / lenS, 0)), readA(uvW.add(vec2(dM / lenS, 0))).w);
        const mK = MT && strength !== null
          ? max(strength, max(max(reachAt(MATCH_SURF_REACH_M[0]), reachAt(MATCH_SURF_REACH_M[1])), reachAt(MATCH_SURF_REACH_M[2])).mul(tune.mReach)).mul(tune.vMatch)
          : float(0);
        const opW = MT ? sheetOp(st.x).mul(mix(float(1), mix(tune.mSurfOp, float(1), lineV), mK)) : sheetOp(st.x);
        const bandArg = MT && strength !== null ? mix(strength, lineV, tune.vMatch) : strength;
        const lc = (MT ? lace(xz, worldVel(st), amount, foot, spline(texD, uvW).y, opW, st.x, trailK, thinFade, bandArg)
          : lace(xz, worldVel(st), amount, foot, spline(texD, uvW).y, opW, LV ? st.x : null, trailK, thinFade, strength)).toVar();
        // Round 12 (the match): in the strong bore, a second read of the lace at
        // MATCH_TILE_K of its tile, folded to MATCH_FOLD, mixed in by the
        // strength. (One read whose tile scale followed the strength drew
        // contour bands where the strength changed: a scale that varies over
        // space shears the pattern.) Only where the bore is strong: no cost
        // and no change in view 1's weaker bore.
        if (MT) {
          If(mK.greaterThan(0.01), () => {
            // The strong bore's whole lace drawn as the band (MATCH_SURF_BAND of it:
            // drawn out along the shore, Manly's surf lies in lines along it).
            // Round 13: THE SURF'S NET. Its amount capped at MATCH_NET_CAP (the
            // fold then draws thin threads round small windows, a net, not a
            // raft with round holes); the line keeps its own amount.
            const amtNet = mix(min(amount, tune.mNetCap), amount, lineV);
            const lcM = lace(xz, worldVel(st), amtNet, foot, spline(texD, uvW).y, opW, st.x, trailK, thinFade,
              max(bandArg ?? float(0), mK.mul(tune.mSurfBand)), tune.mTileK, tune.mFold);
            lc.assign(mix(lc, lcM, mK));
            // Round 13: THE SURF'S NET (see surfNet), over the lace away from
            // the line, where the foam is present.
            const netC = surfNet(sa, worldVel(st), foot).mul(smoothstep(float(0.04), float(0.15), amount))
              .mul(float(1).sub(lineV)).mul(tune.mNetOp).mul(mK);
            lc.assign(vec2(max(lc.x, netC), lc.y));
          });
        }
        cover.assign(lc.x.mul(k));
        bubShade.assign(lc.y);
        milk.assign(smoothstep(float(MILK_FOAM_LO), float(0.8), st.w).mul(MILK_MAX).mul(k).mul(plumes(xz, worldVel(st))));
        // The fines' veil over the column (see SED_BACK_M2_KG).
        const seaFade = smoothstep(float(g.s0), float(g.s0 + 5), sa.x);
        const tau = float(2 * SED_BACK_M2_KG).mul(spline(texD, uvW).x).mul(max(st.x, float(0)));
        // The stirred sand comes in clouds, carried with the water as the milk's
        // plumes are (another phase of the same noise).
        const clouds = plumes(xz.add(vec2(13.7, -4.1)), worldVel(st));
        veil.assign(float(1).sub(exp(tau.negate())).mul(VEIL_MAX).mul(clouds).mul(patchFade(sa)).mul(seaFade).mul(inside).mul(tune.veil));
        // The surf's own body (see SURF_BODY_SHARE).
        // Round 12 (the match): MATCH_SURF_BODY_SHARE of MATCH_SURF_BODY_RGB.
        surf.assign((MT ? smoothstep(mix(float(SURF_BODY_H[0]), tune.mSurfH0, tune.vMatch), mix(float(SURF_BODY_H[1]), tune.mSurfH1, tune.vMatch), st.x)
          : smoothstep(float(SURF_BODY_H[0]), float(SURF_BODY_H[1]), st.x))
          .mul(MT ? mix(float(SURF_BODY_SHARE), tune.mSurfShare, tune.vMatch) : float(SURF_BODY_SHARE)).mul(patchFade(sa)).mul(inside).mul(tune.veil));
      });
      // The veil, the milk over it and the foam over both: one coverage and
      // one radiance for the reader.
      // The film's sky under the veil and the milk.
      const skyRad = filmSkyLow(viewDir);
      // The surf's body under the veil: one share and one light.
      // V2's face over the surf's body, under the veil: one share and one light.
      const body = LV ? float(1).sub(float(1).sub(veil).mul(float(1).sub(surf)).mul(float(1).sub(face)))
        : float(1).sub(float(1).sub(veil).mul(float(1).sub(surf)));
      const bodyRad = LV ? veilLight.mul(veil).add(surfLight.mul(surf).mul(float(1).sub(veil)))
        .add(faceLight.mul(face).mul(float(1).sub(veil)).mul(float(1).sub(surf))).div(max(body, float(1e-4)))
        : veilLight.mul(veil).add(surfLight.mul(surf).mul(float(1).sub(veil))).div(max(body, float(1e-4)));
      const underSky = float(1).sub(float(1).sub(skyShare).mul(float(1).sub(body)));
      const underSkyRad = skyRad.mul(skyShare).add(bodyRad.mul(body).mul(float(1).sub(skyShare))).div(max(underSky, float(1e-4)));
      const underFoam = float(1).sub(float(1).sub(milk).mul(float(1).sub(underSky)));
      const underRad = underSkyRad.mul(underSky).mul(float(1).sub(milk)).add(milkLight.mul(milk))
        .div(max(underFoam, float(1e-4)));
      const both = float(1).sub(float(1).sub(cover).mul(float(1).sub(underFoam)));
      // Round 12 (the match): the strong bore's foam cool white (see coolTint).
      const foamRad = MT ? foamLight(amount).mul(mix(vec3(1, 1, 1), coolTint, coolK)) : foamLight(amount);
      const radiance = underRad.mul(underFoam).mul(float(1).sub(cover)).add(foamRad.mul(bubShade).mul(cover))
        .div(max(both, float(1e-4)));
      return { cover: both, radiance };
    },
    // THE READER'S PATH over the patch: the grid's own water (see
    // `SeabedShoreHook.waterColumn`); the sea's crest over the beach face is
    // the offshore field, and its column drew the film under it darker and
    // greener, with the crests' straight-sided outline.
    waterColumn: (xz: TslNode, column: TslNode) => {
      const sa = toSA(xz).toVar();
      const inPatch = patchFade(sa).mul(insidePatch(sa, 0)).toVar();
      const out = float(column).toVar();
      If(inPatch.greaterThan(0), () => {
        const hGrid = max(spline(texA, saUV(sa)).x, float(0));
        out.assign(mix(column, min(column, hGrid), inPatch));
      });
      return out;
    },
    // THE SEA'S CREST OVER THE SHEET (see CREST_HIDE_H): vHide over the patch
    // where the grid's water is shallow. Round 11: only with `opts.crestHide`
    // (without it the reader returns no `hide`, and the surface builds no
    // Discard node: a discard in the sea's shader cost about 1 ms).
    ...(opts.crestHide ? {
      waterHide: (xz: TslNode, _column: TslNode) => {
        const sa = toSA(xz).toVar();
        const inPatch = patchFade(sa).mul(insidePatch(sa, 0));
        const hGrid = spline(texA, saUV(sa)).x;
        return select(inPatch.greaterThan(0.5).and(hGrid.lessThan(CREST_HIDE_H)), tune.vHide, float(0));
      },
    } : {}),
    // V0 (vSpeck): THE SEA'S OWN FOAM OVER THE PATCH (round 9). The beach
    // draws the surf's foam from its swash grid; the sea's own whitecaps over
    // the patch drew clipped white specks and a white crest polygon there.
    // (Round 11: only with the levers; without it the reader returns no
    // `seaFoam`, and the surface adds no node for it.)
    ...(LV ? {
      waterSeaFoam: (xz: TslNode, _column: TslNode) => {
        const sa = toSA(xz).toVar();
        return float(1).sub(patchFade(sa).mul(insidePatch(sa, 0)).mul(tune.vSpeck));
      },
    } : {}),
    // THE SEA'S GLINTS OVER THE BEACH FACE (see GLINT_KEEP_LO_M).
    waterGlint: (xz: TslNode, _column: TslNode) => {
      const sa = toSA(xz).toVar();
      const inPatch = patchFade(sa).mul(insidePatch(sa, 0)).toVar();
      const keep = float(1).toVar();
      If(inPatch.greaterThan(0), () => {
        const hGrid = max(spline(texA, saUV(sa)).x, float(0));
        keep.assign(float(1).sub(inPatch.mul(float(1).sub(smoothstep(float(GLINT_KEEP_LO_M), float(GLINT_KEEP_HI_M), hGrid)))));
      });
      return keep;
    },
  };
  const seabed = createOceanSeabed({
    field,
    sunDir: opts.sunDir,
    overcast: opts.overcast,
    params: floorParams,
    shore: hook,
    ...(opts.floorDetail ? { detail: opts.floorDetail } : {}),
  });

  /* --- the sand ------------------------------------------------------ */

  // The patch's grid of cell corners. Inside, the fine bed; on its border
  // ring, the floor mesh's own height at that point (its 2.5 m triangles
  // over the half-float map), so the two meshes meet with no step.
  const nsV = g.ns + 1;
  const naV = g.na + 1;
  const pos = new Float32Array(nsV * naV * 3);
  const floorH = coarseFloorHeight(seabed.map);
  // Round 12 (river mouth gap 3): whether a shore-frame point (s, a) lies in the floor's detail rectangles (on an edge too).
  const fdet = opts.floorDetail;
  const inFloorDetail = (s: number, a: number): boolean => {
    if (!fdet) return false;
    const [wx, wz] = beachToWorld(fr, s, a);
    const rs = (wx - fdet.originX) * fdet.sX + (wz - fdet.originZ) * fdet.sZ;
    const ra = (wx - fdet.originX) * fdet.aX + (wz - fdet.originZ) * fdet.aZ;
    return fdet.rects.some(([s0, s1, a0, a1]) => rs >= s0 - 1e-6 && rs <= s1 + 1e-6 && ra >= a0 - 1e-6 && ra <= a1 + 1e-6);
  };
  for (let j = 0; j < naV; j += 1) {
    for (let i = 0; i < nsV; i += 1) {
      const s = g.s0 + i * g.ds;
      const a = g.a0 + j * g.da;
      const [x, z] = beachToWorld(fr, s, a);
      const border = i === 0 || j === 0 || i === nsV - 1 || j === naV - 1;
      // Round 12 (river mouth gap 3): a border vertex inside the floor's detail rectangles takes the map's height
      // there, as the detail mesh's vertex at the same point does.
      const y = border ? (inFloorDetail(s, a) ? -seabedDepthAt(seabed.map, x, z) : floorH(x, z)) : -seabedPointAt(floorParams, x, z).depthM;
      const o = (j * nsV + i) * 3;
      pos[o] = x;
      pos[o + 1] = y;
      pos[o + 2] = z;
    }
  }
  const idx = new Uint32Array((nsV - 1) * (naV - 1) * 6);
  let k = 0;
  for (let j = 0; j < naV - 1; j += 1) {
    for (let i = 0; i < nsV - 1; i += 1) {
      const a = j * nsV + i;
      // Both windings face up: s x a points down here (s onshore, a along),
      // so the order is (a, a+1, a+nsV) for an upward normal.
      idx[k++] = a; idx[k++] = a + 1; idx[k++] = a + nsV;
      idx[k++] = a + 1; idx[k++] = a + nsV + 1; idx[k++] = a + nsV;
    }
  }
  const sandGeom = new THREE.BufferGeometry();
  sandGeom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  sandGeom.setIndex(new THREE.BufferAttribute(idx, 1));
  sandGeom.computeBoundingSphere();

  /** The bed's normal from the static bed texture, world space. */
  const bedNormal = (uv: TslNode): TslNode => {
    const du = 1 / g.ns;
    const dv = 1 / g.na;
    const zs = readC(uv.add(vec2(du, 0))).x.sub(readC(uv.sub(vec2(du, 0))).x).div(2 * g.ds);
    const za = readC(uv.add(vec2(0, dv))).x.sub(readC(uv.sub(vec2(0, dv))).x).div(2 * g.da);
    const gx = zs.mul(fr.sX).add(za.mul(fr.aX));
    const gz = zs.mul(fr.sZ).add(za.mul(fr.aZ));
    return normalize(vec3(gx.negate(), float(1), gz.negate()));
  };
  const fresnel = (cosV: TslNode): TslNode => float(0.02).add(float(0.98).mul(pow(float(1).sub(clamp(cosV, float(0), float(1))), float(5))));

  /**
   * THE DRY SAND'S RELIEF (see RIPPLE_M): the slope of its height field, per
   * m across and along the shore, at a beach point. Analytic slopes: the
   * ripples' profile sin + 0.5 sin 2 (a steeper lee), the pits and prints as
   * paraboloid dishes. Each fades as its size falls under two pixels.
   */
  const rippleDir = vec2(Math.sin(RIPPLE_TURN_RAD), Math.cos(RIPPLE_TURN_RAD));
  const reliefSlope = (sa: TslNode, xz: TslNode, foot: TslNode): TslNode => {
    // Ripples, sinuous, in fields.
    const ph = dot(sa, rippleDir).mul((2 * Math.PI) / RIPPLE_M).add(noise2(xz, 0.7, 1, 3.3).mul(2.2));
    const field = smoothstep(float(-0.1), float(0.35), noise2(xz, 2.2, 2, 5.5));
    // Faded from eight pixels a wavelength down to four (round 6 faded from
    // five: at 2.2 cm a pixel they drew a regular moire of stripes).
    const kR = float(1).sub(smoothstep(float(RIPPLE_M / 8), float(RIPPLE_M / 4), foot));
    const gRip = rippleDir.mul(ph.cos().add(ph.mul(2).cos().mul(0.5)).mul((RIPPLE_H_M * 2 * Math.PI) / RIPPLE_M).mul(field).mul(kR));
    // Pits: one cell in PIT_SHARE holds a dish.
    const cp = floor(sa.div(PIT_CELL_M));
    const hA = fract(sin(dot(cp, vec2(12.9898, 78.233))).mul(43758.5453));
    const hB = fract(sin(dot(cp, vec2(39.3468, 11.135))).mul(24634.6345));
    const hC = fract(sin(dot(cp, vec2(93.989, 67.345))).mul(17453.13));
    const rP = hB.mul(0.11).add(0.075).mul(PIT_CELL_M);
    const dP = fract(sa.div(PIT_CELL_M)).sub(vec2(hA.mul(0.5).add(0.25), hB.mul(0.5).add(0.25))).mul(PIT_CELL_M);
    const inPit = step(length(dP), rP).mul(step(hC, float(PIT_SHARE))).mul(float(1).sub(smoothstep(float(0.01), float(0.02), foot)));
    const gPit = dP.mul(float(2 * PIT_DEPTH_M).div(rP.mul(rP))).mul(inPit);
    // Footprints along the walkers' tracks, on the backshore.
    const gFoot = vec2(0, 0).toVar();
    for (const [ts, ta, turn] of FOOTPRINT_TRACKS) {
      const d = vec2(Math.sin(turn), Math.cos(turn));
      const nrm = vec2(-Math.cos(turn), Math.sin(turn));
      const rel = sa.sub(vec2(ts, ta));
      const u = dot(rel, d);
      const k = floor(u.div(FOOTPRINT_STRIDE_M).add(0.5));
      const side = mod(k, float(2)).mul(2).sub(1);
      const hk = fract(sin(k.mul(12.9898).add(ts * 7.1)).mul(43758.5453));
      const du = u.sub(k.mul(FOOTPRINT_STRIDE_M)).sub(hk.sub(0.5).mul(0.04));
      const dv = dot(rel, nrm).sub(side.mul(0.09));
      const e = du.mul(du).div(FOOTPRINT_L_M * FOOTPRINT_L_M).add(dv.mul(dv).div(FOOTPRINT_W_M * FOOTPRINT_W_M));
      // One print in eight is missing (a scuffed step).
      const on = step(e, float(1)).mul(step(float(0.12), hk));
      const gu = du.mul(2 * FOOTPRINT_DEPTH_M / (FOOTPRINT_L_M * FOOTPRINT_L_M));
      const gv = dv.mul(2 * FOOTPRINT_DEPTH_M / (FOOTPRINT_W_M * FOOTPRINT_W_M));
      gFoot.assign(gFoot.add(d.mul(gu).add(nrm.mul(gv)).mul(on)));
    }
    const kF = smoothstep(float(RELIEF_S_FULL_M), float(RELIEF_S_FULL_M + 0.5), sa.x).mul(float(1).sub(smoothstep(float(0.03), float(0.06), foot)));
    return gRip.add(gPit).add(gFoot.mul(kF));
  };

  const sandMat = new THREE.MeshBasicNodeMaterial();
  sandMat.fragmentNode = Fn(() => {
    const w = positionWorld;
    const xz = vec2(w.x, w.z);
    const foot = max(length(dFdx(xz)), length(dFdy(xz)));
    const sa = toSA(xz);
    const uv = saUV(sa);
    const uvW = saUV(wander(xz, sa));
    const sb = spline(texB, saUV(wanderSkin(xz, sa)));
    const fade = patchFade(sa);
    // The floor's own light on the beach's sand (the hook wets it).
    const base = seabed.floorRadianceAt(xz, foot, float(0)).toVar();
    // THE FILM'S CAUSTIC WEB (see FILM_WEB_GAIN), under a film of 1 mm to
    // 6 cm, only where there is one.
    const hFilm = max(spline(texA, uvW).x, float(0)).toVar();
    If(hFilm.greaterThan(0.0008), () => {
      const st = spline(texA, uvW);
      const k = smoothstep(float(0.001), float(0.004), hFilm).mul(float(1).sub(smoothstep(float(0.02), float(0.06), hFilm)))
        // V1 (vFilm): no web on the film either (its bright bubble-net lines
        // read as light worms over the thin sheet; see FILM_PART_H).
        .mul(fade).mul(tune.web).mul(LV ? float(1).sub(tune.vFilm) : float(1));
      base.assign(base.mul(float(1).add(filmWeb(xz, worldVel(st), foot).mul(k).mul(FILM_WEB_GAIN * SUN_SHARE))));
    });
    // THE FILM'S GLOSS: the saturated band keeps a mirror of water on the
    // grains; sand the sheet has just left keeps a film for a few seconds.
    const sat = readC(uv).y;
    const drain = exp(sb.w.mul(60).div(-GLOSS_DRAIN_S));
    const gloss = max(sat, drain.mul(smoothstep(float(0.5), float(0.95), sb.x))).mul(fade).mul(tune.gloss);
    const n = bedNormal(uv);
    const view = normalize(cameraPosition.sub(w));
    const refl = reflect(view.negate(), n);
    const sky = oceanSkyRadiance(refl, uSun, 0, uOvercast, 0, opts.skyClouds, float(1), float(GLOSS_SPREAD));
    // Only where no sheet covers the sand: the sheet draws its own share.
    const shine = exp(sb.w.mul(60).div(-SHINE_S)).mul(smoothstep(float(0.85), float(0.99), sb.x)).mul(fade).mul(tune.gloss);
    // Round 8: the shine is silver (the low sky's luma; see FILM_SHEEN).
    const lowLumS = dot(filmSkyLow(view), vec3(0.2126, 0.7152, 0.0722));
    // V0 (vGloss): only on sand the sheet has left, not under its thin film.
    const glossCut0 = float(1).sub(smoothstep(float(SHEET_MIN_M), float(SHEET_EDGE_FULL_M), hFilm));
    const glossCut = LV ? mix(glossCut0, float(1).sub(smoothstep(float(0.0001), float(SHEET_MIN_M), hFilm)), tune.vGloss) : glossCut0;
    const film = sky.mul(fresnel(dot(n, view))).add(filmSkyLow(view).mul(SAT_SKY_SHARE)).mul(gloss)
      .add(vec3(lowLumS, lowLumS, lowLumS).mul(shine.mul(SHINE_SKY)))
      // Round 8: gone where the sheet's alpha is full (SHEET_EDGE_FULL_M; to
      // SHEET_FULL_M in round 7, and both reflected the sky over 1 to 4 mm).
      .mul(glossCut);
    // THE DRY SAND'S RELIEF (see RIPPLE_M), lit by the sun: dry sand above the
    // swash zone only.
    const reliefK = float(1).sub(smoothstep(float(WET_LINE_SE - 0.06), float(WET_LINE_SE + 0.04), sb.x))
      .mul(float(1).sub(smoothstep(float(0), float(0.002), hFilm)))
      .mul(smoothstep(float(RELIEF_S_ZERO_M), float(RELIEF_S_FULL_M), sa.x)).mul(fade).toVar();
    // THE RILLS (see RILL_M): on the lower swash face, wet, under a thin film.
    const rillK = smoothstep(float(RILL_S[0]), float(RILL_S[1]), sa.x).mul(float(1).sub(smoothstep(float(RILL_S[2]), float(RILL_S[3]), sa.x)))
      .mul(smoothstep(float(WET_LINE_SE), float(0.9), sb.x)).mul(float(1).sub(smoothstep(float(0.004), float(0.009), hFilm)))
      .mul(float(1).sub(smoothstep(float(0.08), float(0.14), foot))).mul(fade)
      .mul(smoothstep(float(0.55 - 1.4 * RILL_FIELD_SHARE), float(0.75 - 1.4 * RILL_FIELD_SHARE), noise2(vec2(sa.x.div(2), sa.y), RILL_FIELD_M, 0, 41.3)))
      // Round 10: behind `tune.rills` (with the levers; see RILLS_ON).
      .mul(LV ? tune.rills : float(1)).toVar();
    If(rillK.greaterThan(0.01), () => {
      // A ridged noise: a channel where it crosses 0. Its slope by central
      // differences, 1.5 cm apart.
      const chan = (nn: TslNode): TslNode => float(1).sub(smoothstep(float(0), float(RILL_W), abs(nn)));
      const rillAt = (p: TslNode): TslNode => {
        const nn = noise2(vec2(p.x.div(RILL_STRETCH), p.y), RILL_M, 3, 31.7).add(noise2(vec2(p.x.div(RILL_STRETCH * 0.6), p.y), RILL_M * 0.45, 2, 8.3).mul(0.12));
        // The tributaries (see RILL_TRIB_M), shallower, crossing and joining the channels.
        const nT = noise2(vec2(p.x.div(RILL_TRIB_STRETCH), p.y), RILL_TRIB_M, 1, 23.9);
        return max(chan(nn), chan(nT).mul(RILL_TRIB_K)).mul(RILL_DEPTH_M).negate();
      };
      const e = 0.015;
      const gS = rillAt(sa.add(vec2(e, 0))).sub(rillAt(sa.sub(vec2(e, 0)))).div(2 * e);
      const gA = rillAt(sa.add(vec2(0, e))).sub(rillAt(sa.sub(vec2(0, e)))).div(2 * e);
      const gwx = gS.mul(fr.sX).add(gA.mul(fr.aX));
      const gwz = gS.mul(fr.sZ).add(gA.mul(fr.aZ));
      const nR = normalize(vec3(n.x.sub(gwx), n.y, n.z.sub(gwz)));
      const eS = float(FLOOR_LIGHT.sunE).mul(sunVis);
      const lit = (nn: TslNode): TslNode => eS.mul(max(dot(nn, uSun), float(0))).add(skyE);
      // The channels hold water: a tenth darker at their floor.
      const inCh = rillAt(sa).div(-RILL_DEPTH_M);
      const floorDark = float(1).sub(inCh.mul(RILL_FLOOR_DARK));
      base.assign(base.mul(mix(float(1), lit(nR).div(lit(n)).mul(floorDark), rillK))
        .add(filmSkyLow(view).mul(inCh.mul(rillK).mul(RILL_SKY))));
    });
    If(reliefK.greaterThan(0.01), () => {
      // V1 (vSand): the sunlit relief deeper (see SAND_GRAIN_K).
      const slope = LV ? reliefSlope(sa, xz, foot).mul(mix(float(1), float(SAND_GRAIN_K), tune.vSand)) : reliefSlope(sa, xz, foot);
      const gwx = slope.x.mul(fr.sX).add(slope.y.mul(fr.aX));
      const gwz = slope.x.mul(fr.sZ).add(slope.y.mul(fr.aZ));
      const nR = normalize(vec3(n.x.sub(gwx), n.y, n.z.sub(gwz)));
      const eS = float(FLOOR_LIGHT.sunE).mul(sunVis);
      const lit = (nn: TslNode): TslNode => eS.mul(max(dot(nn, uSun), float(0))).add(skyE);
      base.assign(base.mul(mix(float(1), lit(nR).div(lit(n)), reliefK)));
    });
    // THE SHEEN (see SHEEN_ROUGH): GGX with Smith-Schlick shadowing, on sand
    // whose skin is full and which no sheet covers.
    const sheenK = max(sat, smoothstep(float(SHEEN_SE_LO), float(0.99), sb.x))
      .mul(glossCut)
      .mul(SHEEN_SHARE).mul(fade).mul(tune.gloss);
    const hV = normalize(view.add(uSun));
    const ndh = clamp(dot(n, hV), float(0), float(1));
    const a2 = SHEEN_ROUGH * SHEEN_ROUGH;
    const dd = ndh.mul(ndh).mul(a2 - 1).add(1);
    const ggx = float(a2).div(dd.mul(dd).mul(Math.PI));
    const ndv = clamp(dot(n, view), float(0.05), float(1));
    const ndl = clamp(dot(n, uSun), float(0), float(1));
    const kG = SHEEN_ROUGH / 2;
    const shadowG = ndv.div(ndv.mul(1 - kG).add(kG)).mul(ndl.div(ndl.mul(1 - kG).add(kG)));
    const sheen = vec3(ggx.mul(fresnel(dot(view, hV))).mul(shadowG).div(ndv.mul(4)).mul(FLOOR_LIGHT.sunE).mul(sunVis).mul(sheenK));
    // THE SWASH FRONT (see RIM_M): the lace at the sheet's edge, on the sand.
    const rimCover = float(0).toVar();
    If(hFilm.greaterThan(RIM_EDGE_M * 0.5).and(hFilm.lessThan(0.012)), () => {
      const st = spline(texA, uvW);
      const hS = spline(texA, uvW.add(vec2(1 / g.ns, 0))).x;
      const hA = spline(texA, uvW.add(vec2(0, 1 / g.na))).x;
      // The depth's gradient, across and along the shore, per m.
      const grad = vec2(hS.sub(st.x).div(g.ds), hA.sub(st.x).div(g.da));
      const gl = max(length(grad), float(1e-4));
      // ROUND 8: ON THE TRUE EDGE. The scallops are in the read (see
      // `wander`), so the band starts where the sheet and the wet sand under
      // it start. (Round 7 set the band back from the grid's edge here.)
      const dIn = st.x.sub(RIM_EDGE_M).div(gl);
      // The scallop's middle, for the width (see RIM_ARC_GAIN).
      const fS = fract(sa.y.div(RIM_SCALLOP_M).add(noise2(xz, RIM_SCALLOP_M * 1.7, 1, 2.9).mul(0.35)));
      const arc = fS.mul(float(1).sub(fS)).mul(4);
      // The lobes of the grid's tongues (see RIM_LOBE_M).
      const hL = spline(texA, uvW.sub(vec2(0, RIM_LOBE_M / g.da / g.na))).x;
      const hR = spline(texA, uvW.add(vec2(0, RIM_LOBE_M / g.da / g.na))).x;
      const side = hL.add(hR).mul(0.5);
      const lobe = clamp(st.x.sub(side).div(st.x.add(side).add(1e-4)), float(0), float(1));
      // The width (see RIM_W_MIN_M): its noise, the scallop's middle, the lobes.
      // V2 (vFront): a wider swing of width, with a second octave (see FRONT_W_M).
      const wN = LV ? smoothstep(float(-0.55), float(0.55), noise2(xz, RIM_W_SCALE_M, 3, 4.1).add(noise2(xz, 0.35, 1, 14.3).mul(tune.vFront.mul(0.6))))
        : smoothstep(float(-0.55), float(0.55), noise2(xz, RIM_W_SCALE_M, 3, 4.1));
      // Step 2: more of the length thin (the noise's upper 40% only reaches
      // the wide end).
      const wN2 = LV ? mix(wN, smoothstep(float(0.35), float(0.95), wN), tune.vFront) : wN;
      const wR = (LV ? mix(mix(float(RIM_W_MIN_M), float(FRONT_W_M[0]), tune.vFront), mix(float(RIM_W_MAX_M), float(FRONT_W_M[1]), tune.vFront), wN2)
        : mix(float(RIM_W_MIN_M), float(RIM_W_MAX_M), wN))
        .mul(arc.mul(RIM_ARC_GAIN).add(1 - RIM_ARC_GAIN / 2)).mul(lobe.mul(RIM_LOBE_GAIN).add(1));
      const tq = clamp(dIn.div(wR), float(0), float(1));
      const taper = float(1).sub(tq.mul(tq).mul(tq));
      const clusters = LV
        ? smoothstep(float(-0.35), float(0.45), noise2(xz, RIM_CLUSTER_M, 0, 7.9)).mul(float(1).sub(mix(float(RIM_CLUSTER_LO), float(FRONT_CLUSTER_LO), tune.vFront)))
          .add(mix(float(RIM_CLUSTER_LO), float(FRONT_CLUSTER_LO), tune.vFront))
        : smoothstep(float(-0.35), float(0.45), noise2(xz, RIM_CLUSTER_M, 0, 7.9)).mul(1 - RIM_CLUSTER_LO).add(RIM_CLUSTER_LO);
      const gaps = LV
        ? smoothstep(mix(float(-0.9 + 1.6 * RIM_GAP_SHARE), float(-0.9 + 1.6 * FRONT_GAP_SHARE), tune.vFront),
          mix(float(-0.7 + 1.6 * RIM_GAP_SHARE), float(-0.7 + 1.6 * FRONT_GAP_SHARE), tune.vFront), noise2(xz, RIM_GAP_M, 2, 5.1))
          .mul(mix(float(0.85), float(1), tune.vFront)).add(mix(float(0.15), float(0), tune.vFront))
        : smoothstep(float(-0.9 + 1.6 * RIM_GAP_SHARE), float(-0.7 + 1.6 * RIM_GAP_SHARE), noise2(xz, RIM_GAP_M, 2, 5.1)).mul(0.85).add(0.15);
      const front = smoothstep(float(-0.005), float(0.006), dIn.add(noise2(xz, RIM_ROUGH_CELL_M, 1, 71.9).mul(RIM_ROUGH_M)));
      const band = front.mul(taper).mul(clusters).mul(gaps);
      // The lace trailing behind it (see RIM_TRAIL_M).
      const trail = LV ? front.mul(smoothstep(wR.add(mix(float(RIM_TRAIL_M), float(FRONT_TRAIL_M), tune.vFront)), wR.mul(0.6), dIn))
        .mul(mix(float(RIM_TRAIL_AMOUNT), float(FRONT_TRAIL_AMOUNT), tune.vFront))
        // Step 2: the trailing lace only where the band is wide (in patches).
        .mul(mix(float(1), wN2.mul(1.4), tune.vFront))
        : front.mul(smoothstep(wR.add(RIM_TRAIL_M), wR.mul(0.6), dIn)).mul(RIM_TRAIL_AMOUNT);
      // The flow across the edge, outward (down the depth's gradient): over 0 the edge advances.
      const vOut = st.y.mul(grad.x).add(st.z.mul(grad.y)).negate().div(gl);
      const amt = max(band.mul(mix(float(RIM_BACK_SHARE), float(1), smoothstep(float(-0.15), float(0.25), vOut))).mul(RIM_AMOUNT), trail);
      // V2 (vFront): the trail drawn as older foam, broken into bubbles.
      const ageR = LV ? mix(float(0.5), mix(float(0.5), float(FRONT_TRAIL_AGE_S), trail.div(max(band.add(trail), float(1e-4)))), tune.vFront) : float(0.5);
      // Round 13 (the match): the rim MATCH_RIM_K as strong and broken in
      // patches of MATCH_RIM_GAP_M (Manly's edge line rises 6 to 8 luma in a
      // fifth of the columns; round 12's rose 14 in over half).
      // Only where the edge retreats (the backwash leaves a faint broken line;
      // an advancing front keeps its bubbly rim, view 1's won front).
      const retreat = float(1).sub(smoothstep(float(-0.15), float(0.25), vOut));
      const rimM = MT ? mix(float(1), tune.mRimK.mul(smoothstep(float(-0.05), float(0.35), noise2(xz, MATCH_RIM_GAP_M, 2, 83.9))), tune.vMatch.mul(retreat)) : float(1);
      // Round 17 (the match): no rim at all (Manly's lip has no stroke).
      rimCover.assign(lace(xz, worldVel(st), min(amt, float(1)), foot, ageR, float(RIM_OP)).x.mul(fade).mul(tune.foam).mul(rimM)
        .mul(MT ? float(1).sub(tune.vMatch) : float(1)));
    });
    // STRANDED FOAM and THE SWASH MARK: bubbles the sheet left, popping; and
    // the line of fine dark grains and scum where each uprush stopped.
    // Only where the sheet left foam (most of the sand has none).
    const strandCover = float(0).toVar();
    If(sb.y.greaterThan(0.02), () => {
      // Round 8: as old foam (broken into specks, see BREAK_TILE), 0.8 of the opacity.
      // Round 16 (the match): its stranded foam MATCH_STRAND_K as strong (the
      // match's larger swash strands more foam, which drew an even salt of
      // specks over the wet sand).
      strandCover.assign(lace(xz, vec2(0, 0), sb.y.mul(0.9), foot, float(12), float(0.8)).x.mul(fade).mul(tune.foam)
        .mul(MT ? mix(float(1), float(MATCH_STRAND_K), tune.vMatch) : float(1)));
    });
    // A thin line along the field's crest, broken where the grains thin out.
    const markBreak = smoothstep(float(-0.2), float(0.3), noise2(xz, 0.32, 3, 9.4));
    const markLine = smoothstep(float(0.3), float(0.6), sb.z).mul(markBreak).mul(fade).mul(tune.mark);
    // THE HIGH-WATER MARK (see HWM_W_M): at the wet line, fine dark grains and
    // bubbles in a thin scalloped line.
    const hwm = float(0).toVar();
    const hwmFoam = float(0).toVar();
    If(sb.x.greaterThan(WET_LINE_SE - 0.15).and(sb.x.lessThan(WET_LINE_SE + 0.2)).and(hFilm.lessThan(SHEET_MIN_M)), () => {
      const thrW = wetThr(xz);
      const seS = spline(texB, uvW.add(vec2(1 / g.ns, 0))).x.sub(sb.x).div(g.ds);
      const seA = spline(texB, uvW.add(vec2(0, 1 / g.na))).x.sub(sb.x).div(g.da);
      const gSe = max(length(vec2(seS, seA)), float(0.05));
      // Metres inside the wet side of the line; the mark lies on it.
      const dW = sb.x.sub(thrW).div(gSe);
      // V3 (vDry): a crisp thin line (see DRY_HWM_W_M).
      const on = LV
        ? float(1).sub(smoothstep(mix(float(HWM_W_M * 0.4), float(DRY_HWM_W_M * 0.4), tune.vDry), mix(float(HWM_W_M), float(DRY_HWM_W_M), tune.vDry),
          abs(dW.add(mix(float(HWM_W_M * 0.3), float(DRY_HWM_W_M * 0.3), tune.vDry)))))
        : float(1).sub(smoothstep(float(HWM_W_M * 0.4), float(HWM_W_M), abs(dW.add(HWM_W_M * 0.3))));
      const broken = smoothstep(float(-0.45), float(0.1), noise2(xz, 0.55, 1, 27.7));
      hwm.assign(on.mul(broken).mul(fade).mul(tune.mark));
      hwmFoam.assign(lace(xz, vec2(0, 0), on.mul(broken).mul(HWM_FOAM_AMOUNT), foot, float(10), float(0.7)).x.mul(fade).mul(tune.mark));
    });
    // THE OLDER RUN-UP LINES (see MARK_FOAM_AMOUNT): stranded bubbles along the mark.
    const markFoam = float(0).toVar();
    If(sb.z.greaterThan(0.15), () => {
      markFoam.assign(lace(xz, vec2(0, 0), smoothstep(float(0.2), float(0.6), sb.z).mul(markBreak).mul(MARK_FOAM_AMOUNT), foot, float(14), float(0.6)).x.mul(fade).mul(tune.mark));
    });
    // V2 (vFront): THE OLDER SWASH LINES (see OLD_S_M), on wet sand only.
    const oldLine = float(0).toVar();
    // Round 11: also with vOld alone (V3), round 8's front kept.
    const oldK = max(tune.vFront, tune.vOld);
    const oldBand = float(0).toVar();
    if (LV) If(oldK.greaterThan(0).and(hFilm.lessThan(SHEET_MIN_M)).and(sb.x.greaterThan(WET_LINE_SE + 0.03)), () => {
      const wetK = smoothstep(float(WET_LINE_SE + 0.03), float(WET_LINE_SE + 0.12), sb.x).mul(float(1).sub(smoothstep(float(0.0001), float(SHEET_MIN_M), hFilm)));
      for (let kk = 0; kk < OLD_S_M.length; kk += 1) {
        const fL = fract(sa.y.div(OLD_L_M[kk]).add(kk * 0.37).add(noise2(xz, OLD_L_M[kk] * 1.3, kk % 4, 3.1 + kk).mul(0.25)));
        const u = sa.x.sub(OLD_S_M[kk]).sub(fL.mul(float(1).sub(fL)).mul(4 * OLD_D_M[kk])).sub(sa.y.mul(OLD_TILT[kk]));
        // Its width varies 0.4 to 1 of OLD_W_M along it.
        // (Round 14, the match: MATCH_OLD_W_K times wider.)
        const wL = noise2(xz, 0.6, kk % 4, 23.3 + kk).mul(0.3).add(0.7).mul(MT ? OLD_W_M * MATCH_OLD_W_K : OLD_W_M);
        const ln = float(1).sub(smoothstep(wL.mul(0.2), wL, abs(u.add(noise2(xz, 0.09, (kk + 1) % 4, 7.7 + kk).mul(0.012)))));
        const brk = smoothstep(float(0), float(0.35), noise2(xz, 0.9, (kk + 2) % 4, 19.1 + kk * 3.3));
        oldLine.assign(max(oldLine, ln.mul(brk)));
        // V3 (vOld): the band of stranded bubbles along it (see OLD_LACE_W_K).
        const lnB = float(1).sub(smoothstep(wL.mul(OLD_LACE_W_K * 0.4), wL.mul(OLD_LACE_W_K), abs(u)));
        oldBand.assign(max(oldBand, lnB.mul(brk)));
      }
      oldLine.assign(oldLine.mul(wetK).mul(fade).mul(oldK));
      oldBand.assign(oldBand.mul(wetK).mul(fade).mul(tune.vOld));
    });
    const oldLace = float(0).toVar();
    if (LV) If(oldBand.greaterThan(0.01), () => {
      // (Round 14, the match: the stranded bubbles MATCH_OLD_LACE_K as strong: at full they drew white dashed strokes.)
      oldLace.assign(lace(xz, vec2(0, 0), oldBand.mul(OLD_LACE_AMOUNT), foot, float(14), float(0.7)).x.mul(MT ? mix(float(1), float(MATCH_OLD_LACE_K), tune.vMatch) : float(1)));
    });
    const markGrain = noise2(xz, 0.025, 1, 1.7).mul(0.5).add(0.5);
    const darkened = base.mul(float(1).sub(markLine.mul(0.2).mul(markGrain.mul(0.6).add(0.4))))
      .mul(float(1).sub(hwm.mul(HWM_DARK).mul(markGrain.mul(0.6).add(0.4))));
    // V2's older lines: fine dark grains, and scum over them.
    // (Round 14, the match: the old lines' grains and scum times `mOldK`.)
    const oldK12 = MT ? mix(float(1), tune.mOldK, tune.vMatch) : float(1);
    const darkenedO = darkened.mul(float(1).sub(oldLine.mul(OLD_DARK).mul(oldK12).mul(markGrain.mul(0.6).add(0.4))));
    // Round 12 (the match): the wet sand's gloss, shine and sheen cut by
    // MATCH_GLOSS_CUT (Manly's wet sand shows a sheen share of 0 to 0.015).
    const glossK = MT ? float(1).sub(tune.mGlossCut.mul(tune.vMatch)) : float(1);
    const withFoam = MT
      ? mix(mix(mix(darkenedO.add(film.mul(glossK)).add(sheen.mul(glossK)), foamWhite.mul(0.85), max(max(max(strandCover.mul(0.9), markFoam.mul(0.8)), hwmFoam.mul(0.8)), oldLace.mul(0.8))),
        foamWhite.mul(0.85), oldLine.mul(OLD_FOAM).mul(MT ? mix(float(1), float(MATCH_OLD_FOAM_K), tune.vMatch) : float(1)).mul(markGrain.mul(0.8).add(0.2))), foamWhite, rimCover)
      : LV
      ? mix(mix(mix(darkenedO.add(film).add(sheen), foamWhite.mul(0.85), max(max(max(strandCover.mul(0.9), markFoam.mul(0.8)), hwmFoam.mul(0.8)), oldLace.mul(0.8))),
        foamWhite.mul(0.85), oldLine.mul(OLD_FOAM).mul(markGrain.mul(0.8).add(0.2))), foamWhite, rimCover)
      : mix(mix(darkened.add(film).add(sheen), foamWhite.mul(0.85), max(max(strandCover.mul(0.9), markFoam.mul(0.8)), hwmFoam.mul(0.8))), foamWhite, rimCover);
    return vec4(withFoam, float(1));
  })();
  sandMat.toneMapped = true;
  const sandMesh = new THREE.Mesh(sandGeom, sandMat);
  sandMesh.frustumCulled = false;
  sandMesh.name = 'beach-sand';

  /* --- the sheet ------------------------------------------------------ */

  const sheetGeom = new THREE.BufferGeometry();
  const sheetPos = new Float32Array(pos.length);
  sheetPos.set(pos);
  sheetGeom.setAttribute('position', new THREE.BufferAttribute(sheetPos, 3));
  sheetGeom.setIndex(new THREE.BufferAttribute(idx, 1));
  sheetGeom.computeBoundingSphere();
  const sheetMat = new THREE.MeshBasicNodeMaterial();
  const vXZ = vec2(positionGeometry.x, positionGeometry.z);
  const vUV = saUV(toSA(vXZ));
  // THE SEA WINS WHERE THE TWO WATERS MEET. Seaward of the still-water line
  // the sea's own surface is the water the eye sees, and the sheet is drawn
  // up to SHEET_PUSH_M lower there (full by 0.4 m of depth), so where the
  // sheet and the sea stand at nearly one level the sea is in front; the
  // sheet still shows where a bore's crest stands higher than that, or where
  // a trough of the sea leaves the grid's water uncovered.
  sheetMat.positionNode = vec3(
    positionGeometry.x,
    positionGeometry.y.add(max(readA(vUV).x, float(0))).add(SHEET_LIFT_M)
      .sub(opts.crestHide
        // vHide: no push where the sea no longer draws (see CREST_HIDE_H).
        ? smoothstep(float(0.05), float(-0.4), positionGeometry.y).mul(SHEET_PUSH_M)
          .mul(mix(float(1), smoothstep(float(CREST_HIDE_H - 0.02), float(CREST_HIDE_H + 0.05), readA(vUV).x), tune.vHide))
        : smoothstep(float(0.05), float(-0.4), positionGeometry.y).mul(SHEET_PUSH_M))
      // A dry vertex sinks 3 cm under the sand: a triangle dry at all three
      // corners is then hidden, and the depth test drops its fragments
      // before they shade (the sheet spans the whole patch; most is dry).
      .sub(float(1).sub(smoothstep(float(SHEET_MIN_M * 0.25), float(SHEET_MIN_M), readA(vUV).x)).mul(0.03)),
    positionGeometry.z,
  );
  sheetMat.fragmentNode = Fn(() => {
    const w = positionWorld;
    const xz = vec2(w.x, w.z);
    const foot = max(length(dFdx(xz)), length(dFdy(xz))).toVar();
    const sa = toSA(xz);
    const uvW = saUV(wander(xz, sa));
    const st = spline(texA, uvW);
    const h = max(st.x, float(0));
    const fade = patchFade(sa);
    // The water surface's slope: bed plus depth, differenced over a cell of
    // the spline reads, so it is smooth across the cells' edges (round 2
    // differenced the bilinear reads, whose slope jumps at every edge).
    const du = 1 / g.ns;
    const dv = 1 / g.na;
    const etaAt = (q: TslNode, hq: TslNode): TslNode => readC(q).x.add(max(hq, float(0)));
    const e0 = etaAt(uvW, st.x);
    const uvS = uvW.add(vec2(du, 0));
    const uvA = uvW.add(vec2(0, dv));
    const hSs = spline(texA, uvS).x;
    const hAs = spline(texA, uvA).x;
    const es = etaAt(uvS, hSs).sub(e0).div(g.ds);
    const ea = etaAt(uvA, hAs).sub(e0).div(g.da);
    const gx = es.mul(fr.sX).add(ea.mul(fr.aX));
    const gz = es.mul(fr.sZ).add(ea.mul(fr.aZ));
    // A small roughness: a thin sheet is glassy, a fast one breaks into
    // capillary chop (a noise normal scaled by the flow's speed).
    const vel = worldVel(st);
    const speed = length(vel);
    const rough = clamp(speed.mul(FILM_CHOP_PER_MS), float(0), float(FILM_CHOP_MAX)).add(FILM_RIPPLE_SLOPE);
    // The ripple drifts with time (a scroll of the baked field).
    const nx = noise2(xz.add(vec2(uTime.mul(0.13), uTime.mul(0.09))), 0.11, 0, 0.5).mul(rough);
    const nz = noise2(xz.sub(vec2(uTime.mul(0.1), uTime.mul(0.12))), 0.11, 1, 1.5).mul(rough);
    const n = normalize(vec3(gx.negate().add(nx), float(1), gz.negate().add(nz))).toVar();
    const view = normalize(cameraPosition.sub(w)).toVar();
    const cosV = max(dot(n, view), float(0.02));
    const F = fresnel(cosV);
    const refl = reflect(view.negate(), n);
    const sky = oceanSkyRadiance(refl, uSun, 3, uOvercast, 0, opts.skyClouds, float(1));
    // THE SUN IN THE SHEET (see SHEET_SUN_E): a Beckmann lobe about the
    // smooth surface, the chop its rms slope, broken into glitter points.
    const nS = normalize(vec3(gx.negate(), float(1), gz.negate()));
    const half = normalize(view.add(uSun));
    const ndh = clamp(dot(nS, half), float(1e-4), float(1));
    const c2 = ndh.mul(ndh);
    const tan2 = float(1).sub(c2).div(c2);
    const mG = clamp(speed.mul(GLINT_CHOP_PER_MS), float(0), float(GLINT_CHOP_MAX)).add(GLINT_RMS_SLOPE);
    const m2 = mG.mul(mG);
    const ndf = exp(tan2.negate().div(m2)).div(m2.mul(c2).mul(c2).mul(Math.PI));
    const vdh = clamp(dot(view, half), float(0), float(1));
    const fh = float(0.02).add(float(0.98).mul(pow(float(1).sub(vdh), float(5))));
    const ndvS = max(dot(nS, view), float(0.02));
    const glintFar = float(1).sub(smoothstep(float(GLINT_START_M), float(GLINT_END_M), length(cameraPosition.sub(w))));
    const lobe = ndf.mul(fh).div(ndvS.mul(4)).mul(SHEET_SUN_E).mul(sunVis).mul(step(float(0), dot(nS, uSun))).mul(glintFar);
    // The points: one jittered point per cell, lit with a probability that
    // saturates in the lobe, drawn again eight times a second as the ripples
    // turn. Under about two pixels a cell reads as the lobe's mean. The hash
    // reads the cell modulo 256 (15 m) and the draw modulo 97: a GPU sine
    // of the unreduced arguments (near 1e6) gave hashes of exactly 0, which
    // lit a salt of points where the lobe was 0.
    const gcell = mod(floor(xz.div(GLINT_CELL_M)), float(256)).add(mod(floor(uTime.mul(8)), float(97)).mul(vec2(7, 3)));
    const g1 = fract(sin(dot(gcell, vec2(12.9898, 78.233))).mul(43758.5453));
    const g2 = fract(sin(dot(gcell, vec2(39.3468, 11.135))).mul(24634.6345));
    const g3 = fract(sin(dot(gcell, vec2(93.989, 67.345))).mul(17453.13));
    const toPt = fract(xz.div(GLINT_CELL_M)).sub(vec2(g1.mul(0.6).add(0.2), g2.mul(0.6).add(0.2)));
    const pt = float(1).sub(smoothstep(float(0.12), float(0.28), length(toPt)));
    const pLit = float(1).sub(exp(lobe.mul(GLINT_DENSITY).negate())).mul(GLINT_P_MAX);
    const points = pt.mul(step(g3, pLit)).mul(step(float(1e-6), pLit)).mul(GLINT_POINT);
    const lobeMean = lobe.div(lobe.div(GLINT_CAP).add(1));
    const kPt = smoothstep(float(GLINT_CELL_M / 2.5), float(GLINT_CELL_M / 1.25), foot);
    const sunGlint = vec3(mix(points.add(lobeMean.mul(0.1)), lobeMean, kPt));
    // THE WATER BELOW, AS THE SEA SEES IT: the floor's own see-through
    // reader (refraction, the path's color, the suspended sand's blur), so
    // the sheet and the sea draw one water where they meet.
    // A thin sheet is the sand seen through a film: only its surface draws
    // (the sky and sun in it), and the sand mesh and the debris show behind.
    // From 5 mm to 5 cm the sheet becomes the reader's water; the reader runs
    // only where it is needed.
    // Round 12 (the match): the sheet stays a film over the sand to
    // MATCH_THICK_M (5 mm to 5 cm to round 11), so the film is one tone.
    const thick = (MT ? smoothstep(mix(float(0.005), tune.mThick0, tune.vMatch), mix(float(0.05), tune.mThick1, tune.vMatch), h)
      : smoothstep(float(0.005), float(0.05), h)).toVar();
    const deep = vec3(0).toVar();
    If(thick.greaterThan(0), () => {
      const bed = seabed.reader.shade({ world: w, normal: n, normalLong: n, viewDir: view, longM: foot, shortM: foot, own: true });
      deep.assign(mix(bed.through, sky, F).add(sunGlint));
    });
    // V1 (vFilm): the glassy shine carries on into the film's deep part.
    const lumV = dot(filmSkyLow(view), vec3(0.2126, 0.7152, 0.0722));
    // vSheet: the sheen dappled (see SHEET_DAPPLE_M), carried with the flow.
    const dappleK = LV ? mix(float(1), dapple(xz, vel).mul(SHEET_DAPPLE_HI - SHEET_DAPPLE_LO).add(SHEET_DAPPLE_LO), tune.vSheet).toVar() : float(1);
    if (LV) deep.assign(deep.add(vec3(lumV, lumV, lumV).mul(glassShare(h).mul(dappleK).mul(tune.vFilm))));
    // THE FILM REFLECTS THE LOW SKY (see FILM_SKY_SHARE), where the film shows.
    const shareF = filmShare(h);
    // The silver sheen (see FILM_SHEEN): the low sky's luma.
    const streak = smoothstep(float(-0.25), float(0.45), noise2(vec2(sa.x.div(FILM_SHEEN_STRETCH), sa.y), FILM_SHEEN_STREAK_M, 2, 44.1));
    // V1 (vFilm): round 8's streaked band becomes the glassy shine (see GLASS_THIN).
    const shareS0 = sheenShare(h).mul(streak.mul(1 - FILM_SHEEN_LO).add(FILM_SHEEN_LO));
    const shareS1 = LV ? mix(shareS0, glassShare(h).mul(dappleK), tune.vFilm) : shareS0;
    // Round 13 (the match): the silver sheen's fall-line streaks drew thin
    // vertical lines over the film (the rill measure 0.28, Manly's 0.17 to
    // 0.27): the sheen unstreaked in the match.
    // (Round 17: no silver sheen band at the lip in the match: it drew a bright rim.)
    const shareS = MT ? mix(shareS1, float(0), tune.vMatch) : shareS1;
    const lowSky = filmSkyLow(view).toVar();
    const lowLum = dot(lowSky, vec3(0.2126, 0.7152, 0.0722));
    const thinPre = sky.mul(F).add(lowSky.mul(shareF)).add(vec3(lowLum, lowLum, lowLum).mul(shareS)).add(sunGlint);
    const pre0 = mix(thinPre, deep, thick);
    const a0 = mix(min(F.add(shareF).add(shareS), float(1)), float(1), thick);
    // Foam over it: the swash's lace, carried with its flow.
    // The reader's water already carries the foam and the milk (the hook);
    // the sheet's own lace draws them only on its thin part.
    const cover = float(0).toVar();
    const sheetShade = float(0.9).toVar();
    If(thick.lessThan(1), () => {
      const lc = lace(xz, vel, segmented(sa, st.w).mul(filmKeep(h)), foot, spline(texD, uvW).y, sheetOp(h), LV ? h : null);
      // (Round 17, the match: the thin sheet's own lace MATCH_SHEET_LACE_K as strong: white speckle.)
      cover.assign(lc.x.mul(tune.foam).mul(float(1).sub(thick)).mul(MT ? mix(float(1), float(MATCH_SHEET_LACE_K), tune.vMatch) : float(1)));
      sheetShade.assign(lc.y);
    });
    const pre1 = pre0.mul(float(1).sub(cover)).add(foamLight(st.w).mul(sheetShade).mul(cover));
    const alpha1 = a0.mul(float(1).sub(cover)).add(cover);
    // Round 12 (the match): the face (see boreMatch) where the sheet is still
    // its thin film; its deep part draws it through the reader (the hook).
    // Round 13: only where the water is over MATCH_FACE_H deep (the backwash
    // piling against the bore): on the thin film it traced a weak foam
    // patch's contour as a thin blue line.
    const faceT = MT ? boreMatch(sa, uvW, st.w).y.mul(float(1).sub(thick)).mul(fade)
      .mul(smoothstep(float(MATCH_FACE_H[0]), float(MATCH_FACE_H[1]), h)) : float(0);
    const pre = MT ? pre1.mul(float(1).sub(faceT)).add(faceLight.mul(faceT)) : pre1;
    const alpha0 = MT ? alpha1.mul(float(1).sub(faceT)).add(faceT) : alpha1;
    // The sheet's edge, crisp over its first 1.5 cm in. (Round 6 set it back
    // into the scallops here; round 8 puts the scallops in the read, see
    // `wander`, so the edge, the rim and the wet sand meet.)
    const hGrad = max(length(vec2(hSs.sub(st.x).div(g.ds), hAs.sub(st.x).div(g.da))), float(1e-4));
    // Only where the sheet is thin: the distance to the edge (depth over its
    // gradient) holds only near the edge, and at a bore's steep front the
    // set-back cut the sheet and drew lenses of bare sand.
    const inFront = max(smoothstep(float(-0.005), float(0.015), h.sub(RIM_EDGE_M).div(hGrad)),
      smoothstep(float(0.006), float(0.015), h));
    // Round 13 (the match): the sheet fades in over its top MATCH_EDGE_FULL_M (it thins to nothing uphill).
    const edgeFull = MT ? mix(float(SHEET_EDGE_FULL_M), tune.mEdgeFull, tune.vMatch) : float(SHEET_EDGE_FULL_M);
    const edge = smoothstep(float(SHEET_MIN_M), edgeFull, h).mul(inFront).mul(fade).mul(tune.showSheet);
    const alpha = clamp(alpha0.mul(edge), float(0), float(1));
    return vec4(pre.div(max(alpha0, float(1e-3))), alpha);
  })();
  sheetMat.transparent = true;
  sheetMat.depthWrite = false;
  sheetMat.blending = THREE.NormalBlending;
  sheetMat.toneMapped = true;
  const sheetMesh = new THREE.Mesh(sheetGeom, sheetMat);
  sheetMesh.frustumCulled = false;
  sheetMesh.name = 'beach-sheet';

  /* --- the debris ---------------------------------------------------- */

  const group = new THREE.Group();
  group.name = 'beach';
  group.add(sandMesh);
  group.add(sheetMesh);

  const debrisMeshes = buildDebrisMeshes(items, uSun, sunVis, { frame: fr, vDry: () => (LV ? tune.vDry.value : 0) }, deckLight.skyGain);
  for (const m of debrisMeshes.meshes) group.add(m);

  /* --- the stepping plan ---------------------------------------------- */

  let inFlight = false;
  let reqId = 0;
  let wantT = 0;
  let wantPinned = false;
  let shown: OceanBeachState | null = null;
  let lastAsked = -1;
  const stepOf = (t: number) => Math.max(Math.floor(t / BEACH_DT + 1e-6), 0);
  const ask = () => {
    if (inFlight) return;
    const target = stepOf(wantT);
    if (shown && shown.step === target) return;
    inFlight = true;
    reqId += 1;
    // A live frame asks for at most two seconds of beach at once, so a
    // stall never makes one reply take seconds; a pinned clock asks for all.
    const budget = wantPinned ? Number.POSITIVE_INFINITY : 200;
    lastAsked = target;
    worker.postMessage({ type: 'advance', id: reqId, t: wantT, budget });
  };
  worker.onmessage = (e: MessageEvent) => {
    const m = e.data;
    if (m.type === 'error') {
      workerError = m.message;
      inFlight = false;
      return;
    }
    if (m.type !== 'state') return;
    inFlight = false;
    (texA.image as { data: Uint16Array }).data = m.a;
    (texB.image as { data: Uint16Array }).data = m.b;
    (texD.image as { data: Uint16Array }).data = m.d;
    texD.needsUpdate = true;
    if (texE !== null && m.e) {
      (texE.image as { data: Uint16Array }).data = m.e;
      texE.needsUpdate = true;
    }
    texA.needsUpdate = true;
    texB.needsUpdate = true;
    debrisMeshes.place(m.poses as Float32Array);
    shown = { step: m.step, timeS: m.step * BEACH_DT, ledger: m.ledger, stats: m.stats };
    uTime.value = m.step * BEACH_DT;
    ask();
  };

  const update = (renderer: THREE.WebGPURenderer, camera: THREE.Camera, simTime: number, pinned: boolean, askWorker = true) => {
    if (workerError) throw new Error(`[ocean] The beach worker failed.\n\n${workerError}`);
    if (askWorker) {
      wantT = simTime;
      wantPinned = pinned;
      ask();
    }
    seabed.step(renderer, camera);
  };

  const probe: Record<string, unknown> = {
    /** True once the shown state is the one for the time last asked for, and nothing is on its way. */
    settled: () => !inFlight && shown !== null && shown.step === stepOf(wantT),
    state: () => shown,
    stepOf,
    dt: BEACH_DT,
    modes: ready.modes,
    keptShare: ready.keptShare,
    site: { frame: fr, grid: g },
    items: items.map((it) => ({ kind: it.kind, massKg: it.massKg, lengthM: it.lengthM })),
    lastAsked: () => lastAsked,
    setTune: (name: string, value: number) => {
      // Round 10: 'seabed.<name>' reaches the beach's own seabed's tunes (the
      // floor under the surf; for toggle tests).
      if (name.startsWith('seabed.')) {
        (seabed.probe.setTune as (k: string, v: number) => void)(name.slice(7), value);
        return;
      }
      const u = (tune as Record<string, { value: number }>)[name];
      if (!u) throw new Error(`[ocean] No beach tuning uniform named "${name}".`);
      u.value = value;
    },
    getTune: () => Object.fromEntries(Object.entries(tune).map(([kk, u]) => [kk, u.value])),
    /** Show or hide one part: 'sand', 'sheet', 'debris'. For the frame-cost A/B. */
    setPart: (part: string, on: boolean) => {
      if (part === 'sand') sandMesh.visible = on;
      else if (part === 'sheet') sheetMesh.visible = on;
      else if (part === 'debris') for (const mm of debrisMeshes.meshes) mm.visible = on;
      else throw new Error(`[ocean] beach setPart: unknown part "${part}" (sand, sheet, debris)`);
    },
    /** World XZ of a local (s, a) beach point, for placing poses. */
    toWorld: (s: number, a: number) => beachToWorld(fr, s, a),
  };

  return {
    seabed,
    site,
    swash: { a: texA, c: texC, e: texE, frame: fr, grid: g },
    group,
    update,
    dispose() {
      worker.terminate();
      texE?.dispose();
      texA.dispose();
      texB.dispose();
      texD.dispose();
      foamTileTex.dispose();
      wakeLaceTex.dispose();
      texC.dispose();
      sandGeom.dispose();
      sandMat.dispose();
      sheetGeom.dispose();
      sheetMat.dispose();
      debrisMeshes.dispose();
      seabed.dispose();
    },
    probe,
  };
}

/** Linear sRGB-free helper kept for the probe: the static bed of a site at a local point. */
export function beachBedAt(site: BeachSite, s: number, a: number): number {
  const g = site.grid;
  const i = Math.min(Math.max(Math.round((s - g.s0) / g.ds - 0.5), 0), g.ns - 1);
  const j = Math.min(Math.max(Math.round((a - g.a0) / g.da - 0.5), 0), g.na - 1);
  return site.bed[j * g.ns + i];
}
