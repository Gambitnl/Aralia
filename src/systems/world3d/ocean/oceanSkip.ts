/**
 * @file oceanSkip.ts — what a person sees of a thrown stone: the stone, the
 * splash at each touch, the rings and the hollow it leaves, and a mark where
 * it touched.
 *
 * The physics is `oceanSkipMath.ts`; this file only draws a `SkipRun`. Every
 * part is a pure function of the sea time: the stone is the run's recorded
 * state at (time - release), the splash parcels and drops are closed-form
 * ballistic flights from launch states the run fixes, and the rings are a
 * table look-up. So a capture at a pinned sea time draws the same frame on
 * every run, with no warm-up and no stepped state.
 *
 * THE SPLASH, AND THE BAR IT IS JUDGED BY. Remy approved a clip as the bar on
 * 2026-09-28 (the sheet's q33): "Rock skipping in slow motion2.webm" by
 * TonyRaccoon, CC BY 3.0, Wikimedia Commons (Lake Baron, Lake Tahoe), its
 * stills in `.agent/scratch/ocean-gauntlet/ref/real/splash/skip/`. Frames
 * sk_017 to sk_020 show one touch's splash from a camera just over the water:
 * a milky CROWN thrown up around the stone, 5 to 8 stone widths tall, that
 * rises out of a white line of churned water, with bright striations running
 * up it, torn at its top into jets and DROPS of many sizes that fly on and
 * fall back, and a dim, broken image of it in the water. This file builds
 * each of those from the touch's own numbers:
 *
 *   - THE CROWN SHEET: parcels launched from the rim of the stone's
 *     footprint through the contact, at the speed the stone drives the
 *     water, U sin(alpha + beta) ([R05]'s normal speed), times
 *     SPLASH_SHEET_SPEED; steep (SPLASH_SHEET_ELEV), strongest ahead of the
 *     stone, the earliest the fastest (the first contact is the hardest).
 *     Each parcel flies ballistic; the sheet is the surface through them.
 *     THE ROOT (round 2): after the stone leaves, the closing cavity feeds
 *     the sheet's foot more and more slowly, so the crown stays joined to
 *     the water (round 1's stood on two points in the air).
 *   - ITS LOOK (round 2, THE LIGHT ON AERATED WATER): a mix of clear water
 *     (the frame behind it, bent, and the sky by Fresnel) and milky, bubbly
 *     water lit as a scattering medium (the sun on the side it faces,
 *     through the sheet, forward scatter toward the sun, the sky), by the
 *     sheet's aeration: white at the foot, in the striations and at the torn
 *     top; see-through only where smooth and of middle thickness.
 *   - THE BREAK-UP: the sheet's top (its oldest parcels) tears first, from
 *     SPLASH_TEAR_S after launch, and is gone by SPLASH_LIFE_S. Holes open in
 *     the film, the film draws back into the striations (the ligaments), and
 *     those go too; the drops carry on.
 *   - THE DROPS (round 2): three gamma-distributed sizes (Villermaux 2007):
 *     jet drops pinched off the fingers at the top, rim spray from the torn
 *     film, and mist, each with its own drag time from its fall speed; and a
 *     few soft puffs of the finest mist. Seeded per touch, so a pinned frame
 *     replays them. Each drop is a small lens: the frame behind it
 *     inverted, a dark rim, a sun glint, a flare looking toward the sun.
 *   - THE FOAM (round 2): churned, bubbly water where the crown stands,
 *     carried out as a ring as the crown falls, lingering for seconds.
 *   - THE MIRROR TWIN: the crown's image in the calm water, dim, dark, short
 *     and cut into streaks by the ripples (round 2; round 1's was as bright
 *     and tall as the crown).
 *   - THE HOLLOW AND THE RINGS: the water the stone pushed aside
 *     (`SkipTouch.pushedM3`) is a hollow that closes and radiates rings,
 *     linear capillary-gravity theory (`skipRingTable`, Cauchy and Poisson).
 *     The hollow is the same solution at small times, so the cavity that
 *     closes and the rings that leave are one field. It is drawn as the
 *     change it makes to the water's reflection of the sky.
 *   - THE MARK: a little churned water where it touched, fading in seconds,
 *     so the row of touches reads as a trail.
 *
 * WHAT IS SET, NOT MEASURED: the sheet's speed share, its elevation, its
 * tear times, its aeration and light, the foam's spread and the mirror's
 * gain were set by eye against the clip's stills (the clip gives no scale
 * bar; the stone in it is about 6 cm, which sets the sheet near 40 cm
 * tall), and the crown's luma spread is held against the clip's (sk_017 to
 * sk_019) by the gauntlet's crownBand.py. See the constants.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/09/2026, 09:55:03
 * Dependents: components/DesignPreview/steps/sidebyside/oceanExtras/skip.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import * as THREE from 'three/webgpu';
import {
  Fn,
  If,
  Loop,
  abs,
  attribute,
  cameraPosition,
  cameraProjectionMatrix,
  cameraViewMatrix,
  clamp,
  cos,
  dot,
  exp,
  float,
  frontFacing,
  length,
  max,
  min,
  mix,
  modelWorldMatrix,
  mx_noise_float,
  mx_worley_noise_vec2,
  normalize,
  normalLocal,
  positionLocal,
  positionWorld,
  pow,
  reflect,
  screenUV,
  select,
  sin,
  smoothstep,
  texture,
  uniform,
  uniformArray,
  varying,
  vec2,
  vec3,
  vec4,
  viewportTexture,
} from 'three/tsl';
import type { OceanSky } from './oceanSky';
import { oceanSkyRadiance } from './oceanSky';
import {
  SKIP_STONES,
  skipStateAt,
  type SkipRingTable,
  type SkipRun,
  type SkipStoneType,
  type SkipTouch,
} from './oceanSkipMath';

/** A TSL node expression. See `oceanSurface.ts` for why this is `any`. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TslNode = any;

const G = 9.81;

/* ------------------------------------------------------------------ */
/* The splash's set values (see WHAT IS SET, NOT MEASURED)             */
/* ------------------------------------------------------------------ */

/** Sheet launch speed over the stone's normal speed into the water. */
export const SPLASH_SHEET_SPEED = 0.7;
/** Sheet launch elevation, radians: a crown rises steeply. */
export const SPLASH_SHEET_ELEV = (62 * Math.PI) / 180;
/** Share of the stone's speed the water ahead is carried forward with. */
export const SPLASH_CARRY = 0.12;
/** The sheet's top starts to tear this long after a parcel leaves, s. */
export const SPLASH_TEAR_S = 0.12;
/** A parcel of sheet is gone this long after it leaves, s. */
export const SPLASH_LIFE_S = 0.6;
/** The crown opens forward: the rim runs this far round from dead ahead, rad. */
const SPLASH_RIM_HALF = (150 * Math.PI) / 180;
/**
 * Launch slices through a contact, root slices after it, and rim points
 * round the footprint.
 *
 * THE ROOT (round 2). Round 1 launched the sheet only while the stone was in
 * the water, so 60 ms after the stone left, the sheet's youngest row had
 * risen off the water and the crown stood on two points in the air (the
 * judge's "base pinched to two points above the water", r-spl1-A). A real
 * crown stays joined to the water: the cavity the stone opened keeps
 * feeding the sheet's foot, slower and slower, while it closes. So
 * SHEET_ROOT rows launch after the contact, over SPLASH_ROOT_S, at a speed
 * that falls off with SPLASH_ROOT_DECAY_S, and the first row not yet
 * launched is drawn at the water line as the sheet's foot.
 */
const SHEET_NC = 12;
const SHEET_ROOT = 7;
const SHEET_NS = SHEET_NC + SHEET_ROOT;
const SHEET_NR = 64;
/**
 * THE SHEET'S LOOK (round 2; see THE LIGHT ON AERATED WATER). Set by eye
 * against the clip's crowns and held by the crown's luma and white share
 * against sk_017 to sk_020 (crownBand.py in the gauntlet's scratch).
 */
/** Fine and coarse striations round the whole rim. */
const SHEET_FINE_LINES = 90;
const SHEET_COARSE_LINES = 19;
/** The share of the sun that comes through an aerated sheet lit from behind. */
const SHEET_TRANSMIT = 0.5;
/** The forward-scatter lobe's gain, looking toward the sun through the sheet. */
const SHEET_FORWARD = 1.4;
/** The milky water's albedo. */
const SHEET_MILK_ALBEDO = 0.35;
/** The least aeration anywhere in a crown (a fast sheet takes in air throughout). */
const SHEET_AIR_FLOOR = 0.36;
/** The share of the sun a churned foot spreads to every side of itself. */
const SHEET_ISO = 0.45;
/** Height over the water under which the sheet's foot is churned white, m. */
const SHEET_FOOT_M = 0.08;
/** The mirror twin (see THE SPLASH IN THE MIRROR). */
const MIRROR_GAIN = 0.8;
const MIRROR_DARK = 0.55;
const MIRROR_SQUASH = 0.7;
const MIRROR_FADE_M = 0.14;
/** How long the cavity feeds the sheet's foot after the stone leaves, s. */
const SPLASH_ROOT_S = 0.34;
/** The foot's launch speed falls off as exp(-t / this) after the stone leaves, s. */
const SPLASH_ROOT_DECAY_S = 0.07;
/**
 * Sheets drawn at once: a pool, and a touch takes a sheet while its splash
 * lives (about 0.8 s). Round 1 gave each of the last 12 touches its own
 * sheet, and round 2's longer runs (16 touches on the lake) lost the first,
 * judged, splash that way.
 */
const SHEET_SLOTS = 8;
/** Most touches planned with a splash (a run that planes on has more; they are small). */
const MAX_SPLASH = 40;
/**
 * THE DROPS (round 2): three sizes of spray, each GAMMA-DISTRIBUTED.
 *
 * Villermaux (2007, "Fragmentation", Annu. Rev. Fluid Mech. 39:419) shows
 * that a torn sheet breaks into ligaments and each ligament into drops whose
 * sizes follow a gamma law, p(x) = n^n x^(n-1) e^(-nx) / Gamma(n) with x the
 * size over the mean, where n (about 4 for the rims and ligaments of a
 * splash) measures how corrugated the ligaments are. Marmottant and
 * Villermaux (2004, J. Fluid Mech. 498:73) measured the same law on
 * ligaments torn off a liquid jet. The whole spray is a mix of such laws,
 * one per source, so this file draws three:
 *   - JET DROPS: the fingers at the crown's top (the rim instability) pinch
 *     off drops about 1.9 times their own width (Rayleigh and Plateau); a
 *     finger of about 2 mm gives a mean near DROP_JET_MEAN_M.
 *   - RIM SPRAY: the thin torn sheet between the fingers (DROP_RIM_MEAN_M).
 *   - MIST: the finest spray off the torn film (DROP_MIST_MEAN_M), which the
 *     air stops within a fraction of a second.
 * The count per touch scales with the water the stone pushed, and with the
 * square of the sheet's speed (a slow sheet does not tear into spray: the
 * Weber number of its rim), in DROPS_PER_M3.
 */
const DROP_GAMMA_N = 4;
const DROP_JET_MEAN_M = 3.4e-3;
const DROP_RIM_MEAN_M = 1.1e-3;
const DROP_MIST_MEAN_M = 0.35e-3;
/** Rim-spray drops per cubic meter pushed at full sheet speed, and bounds per touch. */
const DROPS_PER_M3 = 4e7;
const DROPS_MIN = 40;
const DROPS_MAX = 2500;
/** Mist drops per rim-spray drop. */
const MIST_PER_RIM = 0.9;
/** The sheet speed over which its rim tears fully into spray, m/s (count ~ (v / this)^2 under it). */
const DROP_TEAR_SPEED_MS = 2.5;
const DROP_POOL = 8192;
/** A drop is never drawn under this many pixels across. */
const DROP_PX_FLOOR = 1.6;
/**
 * A drop's drag time, s: its terminal fall speed over g, from the fit of
 * Atlas, Srivastava and Sekhon (1973, Rev. Geophys. 11:1) to Gunn and
 * Kinzer's measured fall speeds, v = 9.65 - 10.3 exp(-600 d) m/s for a
 * drop d meters across. Under linear drag with this time a drop falls at
 * that speed at the end, and a mist drop (a third of a millimeter falls at
 * about 1.3 m/s) stops in about a tenth of a second where a 3 mm jet drop
 * flies on for most of one.
 */
function dropDragS(d: number): number {
  return Math.max(0.3, 9.65 - 10.3 * Math.exp(-600 * Math.min(d, 6e-3))) / G;
}
/** A gamma draw of shape DROP_GAMMA_N and this mean (a sum of n exponentials over n). */
function gammaDraw(rand: () => number, mean: number): number {
  let s = 0;
  for (let k = 0; k < DROP_GAMMA_N; k += 1) s -= Math.log(1 - rand() * 0.999999);
  return (mean * s) / DROP_GAMMA_N;
}
/**
 * THE FOAM (round 2): the churned, bubbly water the crown stands in, which
 * spreads as a ring and lingers after the crown has fallen (the white line
 * at the foot of the clip's crowns, sk_017 to sk_019, and the white patch
 * each touch leaves). The ring stands at the crown's foot while the crown
 * stands (it grows with THE ROOT), then the outflow carries it on as
 * FOAM_SPREAD_M * sqrt(t) (it slows as it spreads), and it fades out by
 * FOAM_LIFE_S. Set by eye, not measured.
 */
const FOAM_LIFE_S = 6;
const FOAM_SPREAD_M = 0.12;
/** The foam's albedo. */
const FOAM_ALBEDO = 0.8;
/**
 * The puffs of mist: their size at launch, m, how fast they grow (share of
 * their size per second), their drag time, s (the finest mist stops almost
 * at once), their life, s, their most per touch, and their opacity.
 */
const PUFF_SIZE_M = 0.02;
const PUFF_GROW = 5;
const PUFF_DRAG_S = 0.08;
const PUFF_LIFE_S = 0.35;
const PUFFS_MAX = 40;
const PUFF_ALPHA = 0.07;
/** The sun's glint on a drop, scene-linear (doubled looking toward the sun). */
const DROP_GLINT = 12;
/** Height of the foam's quad over the water, m: over the lake's ripples, under the eye's notice. */
const FOAM_LIFT_M = 0.012;
/** Ring sources per touch: the start, the middle and the end of its path. */
const RING_SOURCES_PER_TOUCH = 3;
const RING_SOURCES_MAX_PER_TOUCH = 10;
const RING_SOURCE_SPACING_M = 0.1;
const MAX_RING_SOURCES = 64;
/** Share of the pushed water that makes the hollow the rings come from. */
const RING_VOLUME_SHARE = 0.6;
/** Marks: most kept, and how long one shows, s. */
const MAX_MARKS = 16;
const MARK_LIFE_S = 9;

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

/** A seeded generator (LCG), one per touch, so a pinned frame replays. */
function rng(seed: number): () => number {
  let s = (seed ^ 0x9e3779b9) >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** The stone's drawn mesh: a smooth, slightly irregular version of its shape. */
function stoneGeometry(stone: SkipStoneType): THREE.BufferGeometry {
  let geom: THREE.BufferGeometry;
  if (stone.shape === 'disc') {
    const r = stone.radiusM;
    const h = stone.thicknessM / 2;
    const edge = Math.min(h * 0.95, r * 0.35);
    const pts: THREE.Vector2[] = [new THREE.Vector2(0, -h)];
    pts.push(new THREE.Vector2(r - edge, -h));
    for (let i = 1; i < 8; i += 1) {
      const a = -Math.PI / 2 + (Math.PI * i) / 8;
      pts.push(new THREE.Vector2(r - edge + edge * Math.cos(a), h * Math.sin(a)));
    }
    pts.push(new THREE.Vector2(r - edge, h));
    pts.push(new THREE.Vector2(0, h));
    geom = new THREE.LatheGeometry(pts, 40);
  } else {
    geom = new THREE.IcosahedronGeometry(1, 3);
    geom.scale(stone.radiusM, stone.thicknessM / 2, stone.radiusM);
  }
  // A stone is not a lathe part: a little seeded unevenness, 4% of its size.
  const p = geom.getAttribute('position') as THREE.BufferAttribute;
  const rand = rng(stone.id.length * 7919 + Math.round(stone.radiusM * 1e4));
  const bumps: Array<[number, number, number, number]> = [];
  for (let i = 0; i < 6; i += 1) bumps.push([rand() * 6.28, rand() * 3.14, 0.02 + rand() * 0.03, 1 + rand() * 2]);
  for (let i = 0; i < p.count; i += 1) {
    const x = p.getX(i); const y = p.getY(i); const z = p.getZ(i);
    const ang = Math.atan2(z, x);
    let f = 1;
    for (const [ph, ph2, amp, freq] of bumps) f += amp * Math.sin(freq * ang + ph) * Math.cos(freq * 0.7 * y / stone.thicknessM + ph2);
    p.setXYZ(i, x * f, y * (1 + (f - 1) * 0.5), z * f);
  }
  geom.computeVertexNormals();
  return geom;
}

const STONE_ALBEDO: Record<string, [number, number, number]> = {
  slate: [0.13, 0.14, 0.16],
  pebble: [0.46, 0.43, 0.39],
  chunk: [0.29, 0.26, 0.23],
  pumice: [0.64, 0.61, 0.55],
  clay: [0.52, 0.28, 0.17],
};

/* ------------------------------------------------------------------ */
/* The view                                                            */
/* ------------------------------------------------------------------ */

export interface SkipViewOptions {
  readonly sky: OceanSky;
  readonly ringTable: SkipRingTable;
  /** A probe switch: 'drops' draws every drop solid red, to find them. */
  readonly debug?: string;
}

export interface SkipView {
  /** Everything above the water: the stone, the sheets, the drops. */
  readonly group: THREE.Group;
  /** The hollow, rings and marks on the water (two meshes: its gain and its loss). */
  readonly marks: THREE.Group;
  /** Draw this run, released at sea time t0S. Null clears the water. */
  setRun(run: SkipRun | null, t0S: number): void;
  /** Bring every part to sea time `simTime`. */
  update(simTime: number, camera: THREE.PerspectiveCamera, viewportHeightPx: number, waterAt?: (x: number, z: number, seaTimeS: number) => number): void;
  /** The stone's world position at the last update. */
  readonly stonePos: THREE.Vector3;
  /** True when the stone is shown (released and not gone). */
  readonly stoneShown: boolean;
  /** Counts for the probe: live drops, drawn sheets. */
  stats(): { drops: number; sheets: number; ringSources: number };
  dispose(): void;
}

interface SplashPlan {
  touch: SkipTouch;
  /** Sim time of each launch slice, s from release. */
  ts: Float64Array;
  /** Rim position (xyz) per slice x rim point. */
  base: Float64Array;
  /** Launch velocity (xyz) per slice x rim point. */
  vel: Float64Array;
  /** The rim lines that are jets (the fingers at the crown's top). */
  jets: number[];
  /** The sheet's launch speed at the contact, m/s. */
  v0: number;
  water: number;
  /** The rivulet profile and the sheet coordinates, copied to a sheet when the touch takes one. */
  streakArr: Float32Array;
  uvArr: Float32Array;
  /** The pooled sheet this touch draws with, or -1. */
  slot: number;
}

interface DropPlan {
  /** Launch sim time, s from release, and launch state. */
  t: number; x: number; y: number; z: number; vx: number; vy: number; vz: number;
  size: number; water: number;
  /** Length over width: a torn-off finger is long, a late drop round. */
  stretch: number;
  /** Drag time, s (dropDragS of its size; a mist puff's own). */
  drag: number;
  /** 0: a drop (a small lens). 1: a puff of mist (a soft white blur that grows). */
  kind: number;
}

/**
 * The worker that runs a throw (`oceanSkipWorker.ts`). Built here so the
 * worker URL is relative to the module that owns it.
 */
export function createSkipWorker(): Worker {
  return new Worker(new URL('./oceanSkipWorker.ts', import.meta.url), { type: 'module' });
}

export function createSkipView(opts: SkipViewOptions): SkipView {
  const { sky, ringTable } = opts;
  // THE FRAME BEHIND THE WATER. The sheet and the drops bend the frame drawn
  // so far (a screen-space refraction). three's shared frame copy samples
  // nearest, and a bend of a few pixels drew stair steps in the sheet
  // (s2 captures); this copy filters linearly.
  const behindTex = new THREE.FramebufferTexture(1, 1);
  behindTex.minFilter = THREE.LinearFilter;
  behindTex.magFilter = THREE.LinearFilter;
  const frameBehind = (uv: TslNode): TslNode => viewportTexture(uv, null, behindTex);
  const group = new THREE.Group();
  const marks = new THREE.Group();
  const sun = sky.sunDir.clone().normalize();
  const uSun = uniform(sun);
  const uOvercast: TslNode = sky.uOvercast;

  /* --- the stone -------------------------------------------------- */

  const stoneMat = new THREE.MeshBasicNodeMaterial();
  const uAlbedo = uniform(new THREE.Color(0.13, 0.14, 0.16));
  const uWet = uniform(0);
  {
    const nWorld = varying(normalize(modelWorldMatrix.mul(vec4(normalLocal, 0)).xyz), 'vStoneNormal');
    const vPos = varying(modelWorldMatrix.mul(vec4(positionLocal, 1)).xyz, 'vStonePos');
    // Lit as the wake's hull is (oceanWakeBoat.ts): the sun at 7 scene-linear
    // units on the facing side, a sky-to-water ambient, over pi.
    stoneMat.colorNode = Fn(() => {
      const n = normalize(nWorld).toVar();
      const sunVis = float(1).sub(uOvercast);
      const ndl = clamp(dot(n, uSun), float(0), float(1));
      const skyW = n.y.mul(0.5).add(0.5);
      const amb = mix(vec3(0.10, 0.15, 0.19), vec3(0.40, 0.50, 0.66), skyW).mul(1.6);
      const irr = vec3(1.0, 0.96, 0.9).mul(ndl.mul(7).mul(sunVis)).add(amb);
      // A wet stone is darker and glossy: its film fills the grain.
      const albedo = vec3(uAlbedo).mul(mix(float(1), float(0.62), uWet));
      const v = normalize(cameraPosition.sub(vPos));
      const hv = normalize(v.add(uSun));
      const sheen = pow(clamp(dot(n, hv), float(0), float(1)), mix(float(18), float(120), uWet))
        .mul(ndl).mul(sunVis).mul(mix(float(0.4), float(3.2), uWet));
      return albedo.mul(irr).mul(1 / Math.PI).add(vec3(sheen, sheen, sheen));
    })();
  }
  const stoneMeshes = new Map<string, THREE.Mesh>();
  for (const st of Object.values(SKIP_STONES)) {
    const m = new THREE.Mesh(stoneGeometry(st), stoneMat);
    m.visible = false;
    m.frustumCulled = false;
    stoneMeshes.set(st.id, m);
    group.add(m);
  }

  /* --- the water marks: hollow, rings, churn ----------------------- */

  // The ring table as a half-float texture, normalized to its largest value.
  const ringData = new Uint16Array(ringTable.slope.length);
  for (let i = 0; i < ringTable.slope.length; i += 1) ringData[i] = THREE.DataUtils.toHalfFloat(ringTable.slope[i] / ringTable.maxAbs);
  const ringTex = new THREE.DataTexture(ringData, ringTable.nr, ringTable.nt, THREE.RedFormat, THREE.HalfFloatType);
  ringTex.minFilter = THREE.LinearFilter;
  ringTex.magFilter = THREE.LinearFilter;
  ringTex.wrapS = THREE.ClampToEdgeWrapping;
  ringTex.wrapT = THREE.ClampToEdgeWrapping;
  ringTex.needsUpdate = true;

  const srcArr: THREE.Vector4[] = [];
  for (let i = 0; i < MAX_RING_SOURCES; i += 1) srcArr.push(new THREE.Vector4(0, 0, -1e6, 0));
  const uSrc = uniformArray(srcArr, 'vec4');
  const uSrcN = uniform(0, 'int');
  const markArr: THREE.Vector4[] = [];
  for (let i = 0; i < MAX_MARKS; i += 1) markArr.push(new THREE.Vector4(0, 0, -1e6, 0));
  const uMark = uniformArray(markArr, 'vec4');
  const uMarkN = uniform(0, 'int');
  const uTime = uniform(0);
  const uRingScale = uniform(ringTable.maxAbs);

  /**
   * The slope the rings and hollows put on the water at a world XZ point,
   * and the churn of the marks. (d eta/dx, d eta/dz, churn).
   */
  const waterMarks = Fn(([p]: [TslNode]) => {
    const g = vec2(0, 0).toVar();
    Loop(uSrcN, ({ i }: { i: TslNode }) => {
      const s = uSrc.element(i);
      const d = p.sub(vec2(s.x, s.y));
      const r = length(d);
      const age = uTime.sub(s.z);
      If(age.greaterThan(0).and(age.lessThan(ringTable.tMaxS)).and(r.lessThan(ringTable.rMaxM)), () => {
        const uv = vec2(r.div(ringTable.rMaxM), age.div(ringTable.tMaxS));
        const sl = texture(ringTex, uv).r.mul(uRingScale).mul(s.w);
        g.addAssign(d.div(max(r, float(1e-4))).mul(sl));
      });
    });
    const churn = float(0).toVar();
    Loop(uMarkN, ({ i }: { i: TslNode }) => {
      const m = uMark.element(i);
      const age = uTime.sub(m.z);
      If(age.greaterThan(0).and(age.lessThan(MARK_LIFE_S)), () => {
        const r = length(p.sub(vec2(m.x, m.y)));
        // A patch of bubbles the stone's size: it comes up as the hollow
        // closes (0.1 to 0.3 s), spreads a little and fades. Patchy: the
        // bubbles are clumps, not a disc.
        const rad = m.w.mul(float(1).add(age.mul(0.15)));
        const k = float(1).sub(smoothstep(rad.mul(0.3), rad, r));
        const q = p.mul(90);
        const clump = smoothstep(float(-0.2), float(0.9), q.x.sin().mul(q.y.mul(1.3).add(q.x.mul(0.7)).sin()).add(q.y.mul(0.8).sin().mul(0.5)));
        const rise = smoothstep(float(0.08), float(0.3), age);
        const fade = float(1).sub(smoothstep(float(0.5), float(MARK_LIFE_S), age));
        churn.addAssign(k.mul(clump).mul(rise).mul(fade).mul(0.45));
      });
    });
    return vec3(g.x, g.y, churn);
  });

  const schlick = (c: TslNode) => float(0.02).add(float(0.98).mul(pow(float(1).sub(clamp(c, float(0), float(1))), float(5))));
  /**
   * THE CHANGE THE MARKS MAKE, as a factor on what the water already shows.
   * The water reflects the sky in the mirror direction of its normal, so a
   * slope moves the reflection: the sky in the new direction by its Fresnel,
   * over the sky in the old one by its Fresnel, with the dark body under a
   * calm lake showing through each. Churn adds lit foam. The factor
   * multiplies the frame (a DstColor blend), so the water keeps its own hue
   * and shading and is untouched (factor 1) where nothing moved. (A first
   * build added and subtracted the difference instead; where the surface's
   * own reflection was weaker than this estimate, the subtraction went
   * under zero in one channel and drew red and black specks in the hollow.)
   */
  const marksFactor = Fn(() => {
    const p = positionWorld.xz;
    const wm = waterMarks(p).toVar();
    const n = normalize(vec3(wm.x.negate(), float(1), wm.y.negate()));
    const v = normalize(positionWorld.sub(cameraPosition));
    const r1 = reflect(v, n).toVar();
    const r0 = reflect(v, vec3(0, 1, 0)).toVar();
    // Keep the moved ray above the water: a ray sent into the water would
    // read the sky function's below-horizon color, which the surface never shows.
    r1.y.assign(max(r1.y, float(0.002)));
    const f1 = schlick(dot(v.negate(), n));
    const f0 = schlick(dot(v.negate(), vec3(0, 1, 0)));
    const s1 = oceanSkyRadiance(r1, uSun, 1, uOvercast, 0, sky.cloudReflTexture);
    const s0 = oceanSkyRadiance(r0, uSun, 1, uOvercast, 0, sky.cloudReflTexture);
    const body = vec3(0.010, 0.022, 0.026);
    const sunVis = float(1).sub(uOvercast);
    const foamLight = vec3(1.0, 0.97, 0.93).mul(max(uSun.y, float(0)).mul(7).mul(sunVis)).add(vec3(0.4, 0.5, 0.6).mul(1.6)).mul(0.75 / Math.PI);
    const cNew = s1.mul(f1).add(body.mul(float(1).sub(f1)));
    const cOld = s0.mul(f0).add(body.mul(float(1).sub(f0)));
    const withFoam = mix(cNew, foamLight, clamp(wm.z, float(0), float(0.9)));
    return clamp(withFoam.div(max(cOld, vec3(1e-4, 1e-4, 1e-4))), vec3(0.15, 0.15, 0.15), vec3(4, 4, 4));
  });
  const marksGeom = new THREE.PlaneGeometry(1, 1, 1, 1);
  marksGeom.rotateX(-Math.PI / 2);
  const marksMat = new THREE.MeshBasicNodeMaterial();
  marksMat.colorNode = marksFactor();
  marksMat.transparent = true;
  marksMat.depthWrite = false;
  marksMat.depthTest = false;
  marksMat.blending = THREE.CustomBlending;
  marksMat.blendEquation = THREE.AddEquation;
  marksMat.blendSrc = THREE.DstColorFactor;
  marksMat.blendDst = THREE.ZeroFactor;
  marksMat.blendEquationAlpha = THREE.AddEquation;
  marksMat.blendSrcAlpha = THREE.ZeroFactor;
  marksMat.blendDstAlpha = THREE.OneFactor;
  const marksMesh = new THREE.Mesh(marksGeom, marksMat);
  // Drawn right after the sea (and the sky), before the stone and splash.
  marksMesh.renderOrder = 20;
  marksMesh.frustumCulled = false;
  marksMesh.visible = false;
  marks.add(marksMesh);

  /* --- the foam: the churned water each crown stands in (round 2) ----- */

  // Per touch: a = (start x, start z, sea time of the touch, footprint
  // radius), b = (end x, end z, strength, 0): the contact's path, so a stone
  // that planes leaves a trench of foam, not a spot.
  const foamA: THREE.Vector4[] = [];
  const foamB: THREE.Vector4[] = [];
  for (let i = 0; i < MAX_MARKS; i += 1) { foamA.push(new THREE.Vector4(0, 0, -1e6, 0)); foamB.push(new THREE.Vector4(0, 0, 0, 0)); }
  const uFoamA = uniformArray(foamA, 'vec4');
  const uFoamB = uniformArray(foamB, 'vec4');
  const uFoamN = uniform(0, 'int');
  /**
   * How much foam covers a water point (0 to 1): a dense CORE of churn over
   * the footprint while the cavity closes (the white foot of the crown), a
   * RING the cavity's outflow carries out as FOAM_SPREAD_M * sqrt(age), and a
   * thin LACE left inside it; all fade out by FOAM_LIFE_S.
   */
  const foamCover = Fn(([p, wobble]: [TslNode, TslNode]) => {
    const cover = float(0).toVar();
    Loop(uFoamN, ({ i }: { i: TslNode }) => {
      const a = uFoamA.element(i);
      const b = uFoamB.element(i);
      const age = uTime.sub(a.z);
      If(age.greaterThan(0).and(age.lessThan(FOAM_LIFE_S)), () => {
        const pa = p.sub(a.xy);
        const ba = b.xy.sub(a.xy);
        const h = clamp(dot(pa, ba).div(max(dot(ba, ba), float(1e-8))), float(0), float(1));
        const r0 = a.w;
        // The ring's edge is not a circle: a noise field moves it in and out
        // by up to most of its width.
        const w = r0.mul(0.6).add(age.mul(0.03));
        const d = length(pa.sub(ba.mul(h))).add(wobble.mul(w).mul(0.9));
        // The ring stands at the crown's foot while the crown stands (the
        // foot's rim grows as 1 + 2.5 t after the touch, THE ROOT), and the
        // outflow carries it on as FOAM_SPREAD_M * sqrt(t) after that.
        const R = r0.mul(float(1).add(min(age, float(SPLASH_ROOT_S)).mul(2.5))).add(max(age.sub(SPLASH_ROOT_S), float(0)).sqrt().mul(FOAM_SPREAD_M));
        // The churn over the path while the cavity closes, spreading with it.
        const core = float(1).sub(smoothstep(r0.mul(0.4), r0.mul(float(1.2).add(age)), d)).mul(float(1).sub(smoothstep(float(0.3), float(1.8), age)));
        const x = d.sub(R).div(w);
        const ring = exp(x.mul(x).negate());
        const lace = smoothstep(R.add(w), R.sub(w.mul(2)), d).mul(0.3);
        const rise = smoothstep(float(0), float(0.05), age);
        const fade = float(1).sub(smoothstep(float(FOAM_LIFE_S * 0.3), float(FOAM_LIFE_S), age));
        cover.assign(max(cover, max(core.mul(0.9), max(ring.mul(0.85), lace)).mul(rise).mul(fade).mul(b.z)));
      });
    });
    return cover;
  });
  const foamMat = new THREE.MeshBasicNodeMaterial();
  foamMat.colorNode = Fn(() => {
    const p = positionWorld.xz;
    const wobble = mx_noise_float(vec3(p.mul(16), float(3.3)));
    const cover = foamCover(p, wobble).toVar();
    const out = vec4(0, 0, 0, 0).toVar();
    // The noise only where there is foam (the quad spans every touch).
    If(cover.greaterThan(0.004), () => {
      // A raft of bubbles: bright walls where two cells meet (Worley F2 - F1),
      // about 1 cm cells, broken into patches by a coarser noise.
      const f = mx_worley_noise_vec2(p.mul(55));
      const walls = float(1).sub(smoothstep(float(0.0), float(0.2), f.y.sub(f.x)));
      const patch = mx_noise_float(vec3(p.mul(30), float(1.7))).mul(0.5).add(0.5);
      const dense = smoothstep(float(0.3), float(0.7), patch.add(cover.mul(0.22)));
      const sunVis = float(1).sub(uOvercast);
      const light = vec3(1.0, 0.97, 0.93).mul(max(uSun.y, float(0)).mul(7).mul(sunVis)).add(vec3(0.4, 0.5, 0.6).mul(1.6)).mul(FOAM_ALBEDO / Math.PI);
      const a = clamp(cover.mul(dense).mul(float(0.55).add(walls.mul(0.45))), float(0), float(0.96));
      out.assign(vec4(light.mul(float(0.85).add(walls.mul(0.15))), a));
    });
    return out;
  })();
  foamMat.transparent = true;
  foamMat.depthWrite = false;
  const foamGeom = new THREE.PlaneGeometry(1, 1, 1, 1);
  foamGeom.rotateX(-Math.PI / 2);
  const foamMesh = new THREE.Mesh(foamGeom, foamMat);
  // After the mirror twin (the foam lies on the water, over its image) and
  // before the sheets. Depth-tested, a little over the water, so the stone
  // in front of it hides it.
  foamMesh.renderOrder = 26;
  foamMesh.frustumCulled = false;
  foamMesh.visible = false;
  marks.add(foamMesh);
  /** Sea time after which no foam is left to draw. */
  let foamUntil = -Infinity;

  /* --- the sheets ---------------------------------------------------- */

  /**
   * THE LIGHT ON AERATED WATER (round 2). Round 1 drew the sheet as clear
   * glass with a little white, and the judge saw "cellophane" with flat,
   * see-through light (r-spl1-A). The clip's crowns are milky: a sheet thrown
   * up at a few meters a second takes in air, and its bubbles scatter light
   * as foam does. So each point of the sheet mixes two looks by its
   * AERATION A (0 clear, 1 white):
   *   - CLEAR WATER, as in round 1: the frame behind, bent by the sheet, and
   *     the sky in its mirror direction by Fresnel.
   *   - MILKY WATER, lit as a scattering medium: the sun on the side it faces
   *     (with a wrap), the sun through the sheet when the sun lights its far
   *     side (diffuse transmission), a FORWARD-SCATTER lobe when the eye
   *     looks toward the sun through it, and the sky's light. A side that
   *     faces away from the sun gets only the sky and the light through the
   *     sheet, so the crown has form (it shades itself).
   * A is high at the FOOT (churned water near the water line), in the
   * rivulets and the fine STRIATIONS that run up the sheet, and at the torn
   * top. It is low only where the sheet is smooth and of middle thickness,
   * which stays see-through. Hard GLINTS of the sun sit on the striations,
   * because each striation tilts the normal across the sheet.
   */
  const sheetMat = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide });
  /** The striations at a sheet point: (brightness 0 to 1, the normal's tilt across the sheet). */
  const striations = (u: TslNode, s: TslNode): [TslNode, TslNode] => {
    // Lines that run up the sheet along its own flow lines (constant u),
    // wavy, and broken along their length so none is a ruled line.
    const wob = sin(s.mul(6.0).add(u.mul(29.0))).mul(0.35);
    const q1 = u.mul(SHEET_FINE_LINES).add(wob);
    const q2 = u.mul(SHEET_COARSE_LINES).add(wob.mul(0.5)).add(1.3);
    const along = sin(s.mul(9.0).add(u.mul(77.0))).mul(0.5).add(0.5);
    const r1 = pow(abs(cos(q1.mul(Math.PI))), float(18)).mul(float(0.4).add(along.mul(0.6)));
    const r2 = pow(abs(cos(q2.mul(Math.PI))), float(6));
    const bright = clamp(r1.mul(0.85).add(r2.mul(0.35)), float(0), float(1));
    const tilt = sin(q1.mul(2 * Math.PI)).mul(0.22).add(sin(q2.mul(2 * Math.PI)).mul(0.18));
    return [bright, tilt];
  };
  {
    const pA = attribute('sheetA', 'vec4');
    const pB = attribute('sheetB', 'vec4');
    const aAlpha = pA.x;
    const aThick = pA.y;
    const aStreak = pA.z;
    const aH = pA.w;
    const aUV = varying(pB.xy, 'vSheetUV');
    const aTear = pB.z;
    const nW = varying(normalize(attribute('normal', 'vec3')), 'vSheetN');
    const tW = varying(attribute('sheetTan', 'vec3'), 'vSheetT');
    sheetMat.colorNode = Fn(() => {
      const v = normalize(positionWorld.sub(cameraPosition)).toVar();
      const n0 = normalize(nW);
      const nF = select(frontFacing, n0, n0.negate()).toVar();
      const u = aUV.x; const s = aUV.y;
      const [ribs, tilt] = striations(u, s);
      const t = normalize(tW.add(vec3(1e-6, 0, 0)));
      const n = normalize(nF.add(t.mul(tilt))).toVar();
      const cosI = abs(dot(v, n));
      // Two faces reflect: a sheet sends back about twice one surface's Fresnel.
      const f = min(schlick(cosI).mul(2), float(1));
      const r = reflect(v, n).toVar();
      r.y.assign(max(r.y, float(0.002)));
      const refl = oceanSkyRadiance(r, uSun, 1, uOvercast, 0, sky.cloudReflTexture);
      // CLEAR: the frame behind, bent by the sheet's normal in view space
      // times how thick the water is here.
      const nView = cameraViewMatrix.mul(vec4(n, 0)).xyz;
      const bend = nView.xy.mul(vec2(1, -1)).mul(aThick.mul(0.05).add(aStreak.mul(0.02)));
      const behind = frameBehind(clamp(screenUV.add(bend), vec2(0.001, 0.001), vec2(0.999, 0.999))).rgb;
      const tint = mix(vec3(1, 1, 1), vec3(0.86, 0.95, 0.97), aThick);
      const clear = mix(behind.mul(tint), refl, f);
      // THE AERATION.
      const foot = float(1).sub(smoothstep(float(0), float(SHEET_FOOT_M), aH)).mul(smoothstep(float(0.35), float(0.7), s)).add(smoothstep(float(0.6), float(0.9), aThick).mul(0.25));
      const torn = smoothstep(float(0.35), float(0.05), aThick);
      const A = clamp(float(SHEET_AIR_FLOOR).add(foot.mul(0.8)).add(ribs.mul(0.45)).add(torn.mul(0.2)).add(aStreak.mul(0.15)).add(aTear.mul(0.3)), float(0), float(1));
      // MILKY: the light a bubbly sheet scatters to the eye. The churned
      // foot spreads the sun through itself (SHEET_ISO), so its light does
      // not fall to the sky's alone on its side away from the sun.
      const sunVis = float(1).sub(uOvercast);
      const ndl = dot(nF, uSun);
      const facing = clamp(ndl.mul(0.8).add(0.2), float(0), float(1));
      const through = clamp(ndl.negate(), float(0), float(1)).mul(SHEET_TRANSMIT);
      const fwd = pow(clamp(dot(v, uSun), float(0), float(1)), float(8)).mul(SHEET_FORWARD).mul(float(1).sub(aThick.mul(0.5)));
      const diffuse = max(max(facing, through), clamp(foot, float(0), float(1)).mul(SHEET_ISO));
      const sunTerm = vec3(1.0, 0.97, 0.93).mul(float(7).mul(sunVis).mul(diffuse.add(fwd)));
      const skyLight = mix(vec3(0.16, 0.2, 0.24), vec3(0.4, 0.5, 0.66), nF.y.mul(0.5).add(0.5)).mul(1.6);
      const mottle = mx_noise_float(vec3(u.mul(70), s.mul(24), float(2))).mul(0.18).add(1);
      const milk = sunTerm.add(skyLight).mul(mottle).mul(SHEET_MILK_ALBEDO / Math.PI);
      const glint = pow(clamp(dot(r, uSun), float(0), float(1)), float(700)).mul(40).mul(sunVis);
      return mix(clear, milk, A).add(vec3(glint, glint, glint));
    })();
    // THE TEAR, per pixel (round 1 cut whole triangles out, which drew the
    // torn top as shards). Holes open in the film where a noise field is
    // lowest as the tear share grows. A torn film does not fly on in pieces
    // (a first round-2 build drew them as long white blades): it draws back
    // into the thick lines at a few meters a second (Culick's retraction),
    // and those lines, the striations, are the LIGAMENTS that break into
    // drops (Villermaux 2007). So the film goes first, the ligaments a little
    // later, and the drops carry on.
    sheetMat.opacityNode = Fn(() => {
      const u = aUV.x; const s = aUV.y;
      const [ribs] = striations(u, s);
      const hole = mx_noise_float(vec3(u.mul(60), s.mul(14), float(0.5))).mul(0.5).add(0.5);
      const film = smoothstep(aTear.sub(0.05), aTear.add(0.05), hole.add(0.05)).mul(float(1).sub(smoothstep(float(0.35), float(0.7), aTear)));
      const ligament = smoothstep(float(0.35), float(0.7), ribs).mul(float(1).sub(smoothstep(float(0.4), float(0.65), aTear)));
      // The top edge (the oldest row) is the thick rim that the jets leave
      // from: it fades over the top rows, not at one ruled line.
      const rim = smoothstep(float(0), float(0.12), s);
      return aAlpha.mul(max(film, ligament.mul(0.7))).mul(rim);
    })();
    sheetMat.transparent = true;
    sheetMat.depthWrite = false;
  }
  /**
   * THE SPLASH IN THE MIRROR. A calm lake mirrors what stands on it, so
   * each sheet gets a mirrored twin under the water line, drawn over the
   * water (no depth test).
   *
   * Round 2: round 1's twin was as tall, sharp and bright as the crown, and
   * the judge saw "a huge, sharp, bright reflection" (r-spl1-A). In the clip
   * (sk_017 to sk_019) the crown's image in the water is dim, dark, short
   * and broken into streaks by the ripples the touch itself sends out. So
   * the twin is now:
   *   - DIMMER: the water's reflectance at the ray's grazing angle (Fresnel)
   *     times MIRROR_GAIN, which stands for the light the rings scatter out
   *     of the image.
   *   - DARKER: the sky and the milky water at MIRROR_DARK of their light.
   *   - SHORTER: squashed to MIRROR_SQUASH of the crown's height, and it
   *     fades out MIRROR_FADE_M under the water line.
   *   - SMEARED: cut into horizontal streaks by a noise stretched along the
   *     water, which drifts with time.
   */
  const mirrorMat = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide });
  {
    const pA = attribute('sheetA', 'vec4');
    const aAlpha = pA.x;
    const aThick = pA.y;
    const aStreak = pA.z;
    const aH = pA.w;
    const nW = varying(normalize(attribute('normal', 'vec3')), 'vMirrorN');
    mirrorMat.colorNode = Fn(() => {
      const v = normalize(positionWorld.sub(cameraPosition)).toVar();
      const n = normalize(nW).toVar();
      const r = reflect(v, n).toVar();
      r.y.assign(abs(r.y).max(0.002));
      const refl = oceanSkyRadiance(r, uSun, 1, uOvercast, 0, sky.cloudReflTexture);
      const sunVis = float(1).sub(uOvercast);
      const milk = vec3(1.0, 0.97, 0.93).mul(float(7).mul(sunVis).mul(0.35)).add(vec3(0.4, 0.5, 0.6).mul(1.6)).mul(SHEET_MILK_ALBEDO / Math.PI);
      const white = clamp(float(SHEET_AIR_FLOOR).add(aStreak.mul(0.3)).add(smoothstep(float(0.55), float(0.95), aThick).mul(0.4)), float(0), float(1));
      return mix(refl.mul(0.6), milk, white).mul(MIRROR_DARK);
    })();
    mirrorMat.opacityNode = Fn(() => {
      const vM = normalize(positionWorld.sub(cameraPosition));
      const streaks = smoothstep(float(-0.15), float(0.35), mx_noise_float(vec3(positionWorld.x.mul(7), positionWorld.y.mul(60), positionWorld.z.mul(7).add(uTime.mul(1.5)))));
      const fade = float(1).sub(smoothstep(float(0), float(MIRROR_FADE_M), aH));
      return aAlpha.mul(schlick(abs(vM.y))).mul(MIRROR_GAIN).mul(streaks).mul(fade);
    })();
    mirrorMat.transparent = true;
    mirrorMat.depthWrite = false;
    mirrorMat.depthTest = false;
  }
  // Triangle index for one sheet: (slice, rim) grid.
  const sheetIndex: number[] = [];
  for (let i = 0; i < SHEET_NS - 1; i += 1) {
    for (let j = 0; j < SHEET_NR - 1; j += 1) {
      const a = i * SHEET_NR + j; const b = a + 1; const c = a + SHEET_NR; const d = c + 1;
      sheetIndex.push(a, c, b, b, c, d);
    }
  }
  const makeSheetMesh = () => {
    const geom = new THREE.BufferGeometry();
    const nv = SHEET_NS * SHEET_NR;
    const pos = new THREE.BufferAttribute(new Float32Array(nv * 3), 3);
    const nrm = new THREE.BufferAttribute(new Float32Array(nv * 3), 3);
    // Round 2: the rim tangent (the striations tilt the normal along it),
    // and two packed vec4s (WebGPU allows 8 vertex buffers a pipeline, and
    // nine single values made the pipeline invalid):
    //   sheetA = (alpha, thickness, rivulet, height over the water),
    //   sheetB = (u round the rim plus a per-touch offset, s from the top
    //            row (0) to the foot (1), tear, unused).
    const tan = new THREE.BufferAttribute(new Float32Array(nv * 3), 3);
    const packA = new THREE.BufferAttribute(new Float32Array(nv * 4), 4);
    const packB = new THREE.BufferAttribute(new Float32Array(nv * 4), 4);
    for (const a of [pos, nrm, tan, packA, packB]) a.setUsage(THREE.DynamicDrawUsage);
    geom.setAttribute('position', pos);
    geom.setAttribute('normal', nrm);
    geom.setAttribute('sheetTan', tan);
    geom.setAttribute('sheetA', packA);
    geom.setAttribute('sheetB', packB);
    geom.setIndex(sheetIndex);
    geom.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    const mesh = new THREE.Mesh(geom, sheetMat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 30;
    mesh.visible = false;
    group.add(mesh);
    // The twin: the same geometry mirrored in the water line (its height is
    // set per touch in planSplash). A child, so it shows only with the sheet.
    const mirror = new THREE.Mesh(geom, mirrorMat);
    mirror.frustumCulled = false;
    mirror.renderOrder = 25;
    mirror.scale.set(1, -MIRROR_SQUASH, 1);
    mesh.add(mirror);
    return { mesh, pos, nrm, tan, packA, packB, mirror };
  };
  const sheetMeshes = Array.from({ length: SHEET_SLOTS }, makeSheetMesh);
  /** The plan that holds each sheet, or null. */
  const slotOwner: Array<SplashPlan | null> = Array.from({ length: SHEET_SLOTS }, () => null);

  /* --- the drops ------------------------------------------------------ */

  const dropGeom = new THREE.BufferGeometry();
  const dCenter = new Float32Array(DROP_POOL * 4 * 3).fill(-1e4);
  const dCorner = new Float32Array(DROP_POOL * 4 * 2);
  const dSize = new Float32Array(DROP_POOL * 4);
  const dFade = new Float32Array(DROP_POOL * 4);
  const dVel = new Float32Array(DROP_POOL * 4 * 3);
  const dStretch = new Float32Array(DROP_POOL * 4).fill(1);
  const dKind = new Float32Array(DROP_POOL * 4);
  /** 1 while a drop was drawn at the last update (a hidden drop that stays hidden is not written again). */
  const dShown = new Uint8Array(DROP_POOL);
  /** The next upload covers at least this many drops (the whole pool after a clear). */
  let dropsClearTo = DROP_POOL;
  for (let i = 0; i < DROP_POOL; i += 1) {
    const o = i * 8;
    dCorner[o] = -0.5; dCorner[o + 1] = -0.5; dCorner[o + 2] = 0.5; dCorner[o + 3] = -0.5;
    dCorner[o + 4] = 0.5; dCorner[o + 5] = 0.5; dCorner[o + 6] = -0.5; dCorner[o + 7] = 0.5;
  }
  const dIndex: number[] = [];
  for (let i = 0; i < DROP_POOL; i += 1) { const v = i * 4; dIndex.push(v, v + 1, v + 2, v, v + 2, v + 3); }
  const dCenterAttr = new THREE.BufferAttribute(dCenter, 3);
  const dSizeAttr = new THREE.BufferAttribute(dSize, 1);
  const dFadeAttr = new THREE.BufferAttribute(dFade, 1);
  const dVelAttr = new THREE.BufferAttribute(dVel, 3);
  const dStretchAttr = new THREE.BufferAttribute(dStretch, 1);
  const dKindAttr = new THREE.BufferAttribute(dKind, 1);
  for (const a of [dCenterAttr, dSizeAttr, dFadeAttr, dVelAttr, dStretchAttr, dKindAttr]) a.setUsage(THREE.DynamicDrawUsage);
  dropGeom.setAttribute('position', dCenterAttr);
  dropGeom.setAttribute('corner', new THREE.BufferAttribute(dCorner, 2));
  dropGeom.setAttribute('dropSize', dSizeAttr);
  dropGeom.setAttribute('fade', dFadeAttr);
  dropGeom.setAttribute('dropVel', dVelAttr);
  dropGeom.setAttribute('dropLen', dStretchAttr);
  dropGeom.setAttribute('dropKind', dKindAttr);
  dropGeom.setIndex(dIndex);
  dropGeom.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
  const uCamRight = uniform(new THREE.Vector3(1, 0, 0));
  const uCamUp = uniform(new THREE.Vector3(0, 1, 0));
  const uRadPerPx = uniform(0.001);
  const dropMat = new THREE.MeshBasicNodeMaterial();
  {
    const corner = attribute('corner', 'vec2');
    const sizeIn = attribute('dropSize', 'float');
    const fadeIn = attribute('fade', 'float');
    const kindIn = attribute('dropKind', 'float');
    const dist = cameraPosition.sub(positionLocal).length();
    const floorM = dist.mul(uRadPerPx).mul(DROP_PX_FLOOR);
    const sizeM = sizeIn.max(floorM);
    // A drop under the pixel floor keeps its own light: (size / drawn)^2.
    const conserve = sizeIn.div(sizeM).pow(2).max(0.15);
    // A LIGAMENT, not only a ball: the torn rim throws fingers of water that
    // are several times longer than wide, along their flight (the clip's
    // jets, sk_018 to sk_020). The quad is stretched along the velocity as
    // seen from the camera, by the drop's own stretch.
    const velIn = attribute('dropVel', 'vec3');
    const stretchIn = attribute('dropLen', 'float');
    const toCam = normalize(positionLocal.sub(cameraPosition));
    const vPerp = velIn.sub(toCam.mul(dot(velIn, toCam)));
    const along = select(length(vPerp).greaterThan(0.05), normalize(vPerp), uCamRight);
    const across = normalize(along.cross(toCam));
    dropMat.positionNode = positionLocal.add(along.mul(corner.x.mul(sizeM).mul(stretchIn))).add(across.mul(corner.y.mul(sizeM)));
    const vCorner = varying(corner, 'vDropCorner');
    const vKind = varying(kindIn, 'vDropKind');
    const vConserve = varying(conserve, 'vDropConserve');
    const vToCam = varying(toCam, 'vDropToCam');
    const centerClip = cameraProjectionMatrix.mul(cameraViewMatrix.mul(vec4(positionLocal, 1)));
    const vCenterUV = varying(vec2(centerClip.x.div(centerClip.w).mul(0.5).add(0.5), centerClip.y.div(centerClip.w).mul(-0.5).add(0.5)), 'vDropUV');
    dropMat.colorNode = Fn(() => {
      const c = vCorner;
      const rr = length(c).mul(2);
      const sunVis = float(1).sub(uOvercast);
      // Looking toward the sun through a drop: a ball of water focuses the
      // sun toward the eye, and a drop near the sun's direction flares
      // (round 2: "drops that catch the sun").
      const toSunLook = pow(clamp(dot(normalize(vToCam), uSun), float(0), float(1)), float(10));
      // A ball lens: a drop takes in a wide cone of the scene behind it and
      // shows it turned over (a sphere of water images almost a half space
      // into its disc). So the frame behind is read over 20 times the drop's
      // own size round it, flipped: a drop against the sky shows the dark
      // water under the horizon in its top half, as real drops do.
      const lensUV = vCenterUV.sub(screenUV.sub(vCenterUV).mul(20));
      const behind = frameBehind(clamp(lensUV, vec2(0.001, 0.001), vec2(0.999, 0.999))).rgb;
      // The sun's glint sits toward the sun on the ball's face.
      const toSun = vec2(dot(uSun, uCamRight), dot(uSun, uCamUp)).mul(0.22);
      const glint = smoothstep(float(0.22), float(0.0), length(c.sub(toSun))).mul(float(DROP_GLINT).add(toSunLook.mul(DROP_GLINT))).mul(sunVis);
      const flare = smoothstep(float(0.5), float(0.0), rr).mul(toSunLook).mul(6).mul(sunVis);
      // Its edge mirrors the sky at grazing angles (a sphere's Fresnel), so a
      // drop reads as a bright bead with a darker line just inside its rim.
      const skyTop = vec3(0.55, 0.68, 0.82);
      const edge = smoothstep(float(0.25), float(0.75), rr);
      const inner = smoothstep(float(0.2), float(0.45), rr).mul(float(1).sub(smoothstep(float(0.45), float(0.65), rr)));
      const lens = mix(behind.mul(1.1), skyTop.mul(1.6), edge).mul(float(1).sub(inner.mul(0.35))).add(vec3(glint, glint, glint).add(flare));
      const disc = float(1).sub(smoothstep(float(0.44), float(0.5), length(c)));
      // A PUFF OF MIST: a soft white blur lit as the milky sheet is, brighter
      // toward the sun (fine drops scatter forward).
      const milk = vec3(1.0, 0.97, 0.93).mul(float(7).mul(sunVis).mul(float(0.45).add(toSunLook.mul(SHEET_FORWARD))))
        .add(vec3(0.4, 0.5, 0.6).mul(1.6)).mul(SHEET_MILK_ALBEDO / Math.PI);
      const soft = exp(dot(c, c).mul(-14));
      const isPuff = vKind.greaterThan(0.5);
      return vec4(select(isPuff, milk, lens), select(isPuff, soft.mul(PUFF_ALPHA), disc.mul(vConserve)).mul(fadeIn));
    })();
    if (opts.debug === 'drops') { dropMat.colorNode = vec4(6, 0, 0, 1); dropMat.opacityNode = fadeIn; }
    dropMat.transparent = true;
    dropMat.depthWrite = false;
    // Both sides: a stretched quad's winding follows its velocity, and a
    // first build lost every drop to back-face culling.
    dropMat.side = THREE.DoubleSide;
  }
  const drops = new THREE.Mesh(dropGeom, dropMat);
  drops.frustumCulled = false;
  drops.renderOrder = 31;
  group.add(drops);

  /* --- the plans made from a run -------------------------------------- */

  let run: SkipRun | null = null;
  let t0 = 0;
  /** The water height under a floating stone at its run's end (see update). */
  let floatRef: number | null = null;
  /** Sea time after which no ring or mark is left to draw. */
  let marksUntil = -Infinity;
  /** True while the drop attributes hold live drops (so an idle frame uploads nothing). */
  let dropsDirty = false;
  let plans: SplashPlan[] = [];
  let dropPlans: DropPlan[] = [];
  /** The first launch and the last landing of the run's drops, s from release. */
  let dropsFrom = Infinity;
  let dropsUntil = -Infinity;
  const stonePos = new THREE.Vector3();
  let stoneShown = false;
  const qTmp = new Float64Array(4);
  const pTmp = new Float64Array(3);

  const pathAt = (tc: SkipTouch, tS: number): [number, number] => {
    const n = tc.path.length / 2;
    if (n === 0) return [tc.xM, tc.zM];
    const f = Math.max(0, Math.min(n - 1, (tS - tc.tStartS) / 1e-3));
    const i = Math.floor(f); const k = Math.min(n - 1, i + 1); const w = f - i;
    return [tc.path[2 * i] * (1 - w) + tc.path[2 * k] * w, tc.path[2 * i + 1] * (1 - w) + tc.path[2 * k + 1] * w];
  };

  const planSplash = (tc: SkipTouch, stone: SkipStoneType): SplashPlan => {
    const hx = Math.cos(tc.headingRad); const hz = Math.sin(tc.headingRad);
    const lx = -hz; const lz = hx;
    // The stone's normal speed into the water at entry, [R05]'s U sin(alpha + beta).
    const un = Math.max(0.4, tc.speedInMs * Math.sin(Math.max(2, tc.flightInDeg + tc.tiltInDeg) * Math.PI / 180));
    const v0 = SPLASH_SHEET_SPEED * un;
    const ts = new Float64Array(SHEET_NS);
    const base = new Float64Array(SHEET_NS * SHEET_NR * 3);
    const vel = new Float64Array(SHEET_NS * SHEET_NR * 3);
    const rand = rng(tc.index * 104729 + Math.round(tc.tStartS * 1e4));
    // THE JETS. A crown's rim does not rise evenly: it gathers into fingers
    // (a rim instability, Rayleigh-Plateau on the thick rim) that shoot out
    // ahead of the sheet between them, the scalloped top of the clip's
    // crowns (sk_018, sk_019). Seeded bumps round the rim raise the launch
    // speed of a few rim lines by up to 35%.
    const jetPh = rand() * 6.28; const jetN = 7 + Math.floor(rand() * 5);
    const jetAmp = Array.from({ length: SHEET_NR }, (_, j) => 1 + 0.35 * Math.pow(Math.max(0, Math.sin((j / (SHEET_NR - 1)) * jetN * Math.PI + jetPh)), 12) * (0.6 + 0.4 * rand()));
    const dur = Math.max(1e-3, tc.tEndS - tc.tStartS);
    const aL = stone.radiusM * 1.15; const aW = stone.radiusM * 1.05;
    const [ex, ez] = pathAt(tc, tc.tEndS);
    for (let i = 0; i < SHEET_NS; i += 1) {
      // Contact rows through the touch, then the ROOT rows after it (see
      // SHEET_ROOT), spaced as the square of their order, so they lie close
      // together while the foot still moves fast.
      const root = i >= SHEET_NC;
      const kR = root ? (i - SHEET_NC + 1) / SHEET_ROOT : 0;
      const tAfter = root ? SPLASH_ROOT_S * kR * kR : 0;
      const t = root ? tc.tEndS + tAfter : tc.tStartS + (dur * i) / (SHEET_NC - 1);
      ts[i] = t;
      const [cx, cz] = root ? [ex, ez] : pathAt(tc, t);
      // The first contact is the hardest; after the stone leaves, the foot
      // slows as the cavity closes (it starts where the last contact row
      // left off, 0.45 of the first).
      const early = root ? 0.45 * Math.exp(-tAfter / SPLASH_ROOT_DECAY_S) : 1 - 0.55 * (i / (SHEET_NC - 1));
      // The foot moves out with the cavity's outflow.
      const grow = root ? 1 + 2.5 * tAfter : 1;
      for (let j = 0; j < SHEET_NR; j += 1) {
        const phi = -SPLASH_RIM_HALF + (2 * SPLASH_RIM_HALF * j) / (SHEET_NR - 1);
        const cph = Math.cos(phi); const sph = Math.sin(phi);
        const ox = grow * (cph * aL * hx + sph * aW * lx); const oz = grow * (cph * aL * hz + sph * aW * lz);
        let nx = (cph / aL) * hx + (sph / aW) * lx; let nz = (cph / aL) * hz + (sph / aW) * lz;
        const nl = Math.hypot(nx, nz); nx /= nl; nz /= nl;
        const ahead = 0.5 * (1 + cph);
        // The jets gather at the rim's top, from the contact; the foot has none.
        const sp = v0 * early * (0.35 + 0.65 * ahead) * (0.92 + 0.16 * rand()) * (root ? 1 : jetAmp[j]);
        const el = SPLASH_SHEET_ELEV - 0.12 * ahead;
        const carry = root ? 0 : SPLASH_CARRY * tc.speedInMs * ahead * ahead;
        const k = (i * SHEET_NR + j) * 3;
        base[k] = cx + ox; base[k + 1] = tc.yM; base[k + 2] = cz + oz;
        vel[k] = sp * Math.cos(el) * nx + carry * hx;
        vel[k + 1] = sp * Math.sin(el);
        vel[k + 2] = sp * Math.cos(el) * nz + carry * hz;
      }
    }
    // The jet lines: the peaks of jetAmp (the drops' fingertips).
    const jets: number[] = [];
    for (let j = 1; j < SHEET_NR - 1; j += 1) if (jetAmp[j] > 1.12 && jetAmp[j] >= jetAmp[j - 1] && jetAmp[j] >= jetAmp[j + 1]) jets.push(j);
    // RIVULETS. A crown is not a smooth pane: the flow thickens into ribs
    // along its own lines, which the clip shows as brighter streaks running
    // up the sheet to the jets at its top (sk_018, sk_019). A smooth random
    // profile round the rim, the same up each line.
    const sa = new Float32Array(SHEET_NS * SHEET_NR);
    const ph = [rand() * 6.28, rand() * 6.28, rand() * 6.28];
    for (let j = 0; j < SHEET_NR; j += 1) {
      const u = j / (SHEET_NR - 1);
      const w = 0.5 + 0.5 * Math.sin(u * 37 + ph[0]) * Math.sin(u * 13 + ph[1]) + 0.25 * Math.sin(u * 71 + ph[2]);
      const v = Math.max(0, Math.min(1, (w - 0.45) * 2.2));
      for (let i = 0; i < SHEET_NS; i += 1) sa[i * SHEET_NR + j] = v;
    }
    // The sheet coordinates: u round the rim, offset per touch so no two
    // crowns show the same striations; s from the top row (0) to the foot (1).
    const uvA = new Float32Array(SHEET_NS * SHEET_NR * 2);
    const uOff = rand() * 7.3;
    for (let i = 0; i < SHEET_NS; i += 1) {
      for (let j = 0; j < SHEET_NR; j += 1) {
        const v = i * SHEET_NR + j;
        uvA[v * 2] = uOff + j / (SHEET_NR - 1);
        uvA[v * 2 + 1] = i / (SHEET_NS - 1);
      }
    }
    return { touch: tc, ts, base, vel, jets, v0, water: tc.yM, streakArr: sa, uvArr: uvA, slot: -1 };
  };

  /**
   * The drops a touch throws (see THE DROPS). Each leaves a point of the
   * sheet at the moment that point tears, with the sheet's own velocity
   * there and a spread, so the spray leaves the torn top and the jets and
   * flies on as the sheet did.
   */
  const planDrops = (p: SplashPlan): DropPlan[] => {
    const tc = p.touch;
    const rand = rng(tc.index * 7727 + 13);
    const out: DropPlan[] = [];
    const tearFull = Math.min(1, (p.v0 / DROP_TEAR_SPEED_MS) ** 2);
    const nRim = Math.round(Math.max(DROPS_MIN, Math.min(DROPS_MAX, tc.pushedM3 * DROPS_PER_M3 * tearFull)));
    const nMist = Math.round(nRim * MIST_PER_RIM);
    /** Launch one drop from sheet point (i, j) at this age after it left. stretch < 0: from its speed. */
    const launch = (i: number, j: number, age: number, size: number, spread: number, stretch: number, kind: number, speedGain = 1) => {
      const k = (i * SHEET_NR + j) * 3;
      const vx = p.vel[k] * speedGain; const vy = p.vel[k + 1] * speedGain; const vz = p.vel[k + 2] * speedGain;
      const x = p.base[k] + vx * age; const y = p.base[k + 1] + vy * age - 0.5 * G * age * age; const z = p.base[k + 2] + vz * age;
      if (y < p.water + 0.005) return;
      const sp = Math.hypot(vx, vy, vz);
      const jit = spread * sp;
      out.push({
        t: p.ts[i] + age, x, y, z,
        vx: vx + (rand() - 0.5) * jit, vy: vy - G * age + (rand() - 0.5) * jit, vz: vz + (rand() - 0.5) * jit,
        size, water: p.water,
        stretch: stretch >= 0 ? stretch : 1 + Math.min(3, sp * 0.7) * rand() * rand(),
        drag: kind === 1 ? PUFF_DRAG_S : dropDragS(size),
        kind,
      });
    };
    // JET DROPS. Each finger at the top pinches off a chain of drops from
    // its tip (Rayleigh and Plateau), one every couple of hundredths of a
    // second, a little faster than the sheet (the tip is the fastest water).
    // The first piece is still a ligament, several times longer than wide.
    for (const j of p.jets) {
      const nChain = 4 + Math.floor(rand() * 7 * tearFull);
      for (let c = 0; c < nChain; c += 1) {
        const i = Math.min(SHEET_NC - 1, Math.floor(c * 0.6));
        const jj = Math.max(1, Math.min(SHEET_NR - 2, j + (rand() < 0.3 ? (rand() < 0.5 ? -1 : 1) : 0)));
        const age = SPLASH_TEAR_S * 0.7 + c * 0.022 + rand() * 0.01;
        launch(i, jj, age, Math.min(6e-3, gammaDraw(rand, DROP_JET_MEAN_M)), 0.06, c === 0 ? 2.5 + rand() * 1.5 : 1 + rand() * 0.8, 0, 1.03 + 0.05 * rand());
      }
    }
    // RIM SPRAY from the torn top, the oldest rows first.
    for (let d = 0; d < nRim; d += 1) {
      const i = Math.floor(rand() * rand() * SHEET_NC * 0.8);
      const j = 1 + Math.floor(rand() * (SHEET_NR - 2));
      const age = SPLASH_TEAR_S * 0.75 + Math.pow(rand(), 1.6) * (SPLASH_LIFE_S - SPLASH_TEAR_S) * 0.8;
      launch(i, j, age, Math.min(6e-3, gammaDraw(rand, DROP_RIM_MEAN_M)), 0.18, -1, 0);
    }
    // MIST: finer, spread wider, stopped by the air in a tenth of a second.
    for (let d = 0; d < nMist; d += 1) {
      const i = Math.floor(rand() * rand() * SHEET_NC * 0.7);
      const j = 1 + Math.floor(rand() * (SHEET_NR - 2));
      const age = SPLASH_TEAR_S * 0.8 + rand() * (SPLASH_LIFE_S - SPLASH_TEAR_S) * 0.7;
      launch(i, j, age, gammaDraw(rand, DROP_MIST_MEAN_M), 0.15, 1, 0);
    }
    // PUFFS of the finest mist over the torn top, most over the jets.
    const nPuff = Math.round(Math.min(PUFFS_MAX, 4 + nRim * 0.025));
    for (let d = 0; d < nPuff; d += 1) {
      const onJet = p.jets.length > 0 && rand() < 0.6;
      const j = onJet ? p.jets[Math.floor(rand() * p.jets.length)] : 1 + Math.floor(rand() * (SHEET_NR - 2));
      const i = Math.floor(rand() * rand() * SHEET_NC * 0.5);
      const age = SPLASH_TEAR_S + rand() * 0.12;
      launch(i, j, age, PUFF_SIZE_M * (0.6 + 0.8 * rand()), 0.25, 1, 1);
    }
    return out;
  };

  const setRun = (r: SkipRun | null, t0S: number) => {
    run = r;
    t0 = t0S;
    floatRef = null;
    for (const s of sheetMeshes) s.mesh.visible = false;
    slotOwner.fill(null);
    for (const m of stoneMeshes.values()) m.visible = false;
    plans = [];
    dropPlans = [];
    dropsFrom = Infinity;
    dropsUntil = -Infinity;
    dCenter.fill(-1e4);
    dFade.fill(0);
    dShown.fill(0);
    dropsClearTo = DROP_POOL;
    let nSrc = 0;
    let nMark = 0;
    if (r) {
      const stone = r.stone;
      const touches = r.touches.slice(0, MAX_SPLASH);
      touches.forEach((tc) => {
        const p = planSplash(tc, stone);
        plans.push(p);
        for (const d of planDrops(p)) dropPlans.push(d);
      });
      if (dropPlans.length > DROP_POOL) {
        // The pool is full: the finest mist goes first (drops under half a
        // millimeter), the drops and puffs keep their places.
        const keep = dropPlans.filter((d) => d.kind === 1 || d.size >= 0.5e-3);
        const mist = dropPlans.filter((d) => !(d.kind === 1 || d.size >= 0.5e-3));
        dropPlans = keep.concat(mist).slice(0, DROP_POOL);
      }
      for (const d of dropPlans) { dropsFrom = Math.min(dropsFrom, d.t); dropsUntil = Math.max(dropsUntil, d.t + 2.5); }
      for (const tc of r.touches) {
        // The hollow's water, split along the path: a skip's short touch
        // leaves a hollow, a stone that planes leaves a trench, so one
        // source every RING_SOURCE_SPACING_M of the path (at least
        // RING_SOURCES_PER_TOUCH), each holding at most a hollow three
        // stone-thicknesses deep over the footprint (a trench is not one
        // deep hole: the pushed water of a 1 m plane over several sources).
        const pathLen = (() => { let l = 0; for (let k = 2; k < tc.path.length; k += 2) l += Math.hypot(tc.path[k] - tc.path[k - 2], tc.path[k + 1] - tc.path[k - 1]); return l; })();
        const nS = Math.max(RING_SOURCES_PER_TOUCH, Math.min(RING_SOURCES_MAX_PER_TOUCH, Math.ceil(pathLen / RING_SOURCE_SPACING_M)));
        const volCap = 3 * stone.thicknessM * Math.PI * ringTable.sigmaM * ringTable.sigmaM;
        const vol = Math.min(volCap, RING_VOLUME_SHARE * tc.pushedM3 / nS);
        for (let s = 0; s < nS && nSrc < MAX_RING_SOURCES; s += 1) {
          const tt = tc.tStartS + ((tc.tEndS - tc.tStartS) * s) / (nS - 1);
          const [x, z] = pathAt(tc, tt);
          // A hollow is let go when the stone leaves it.
          srcArr[nSrc].set(x, z, t0S + Math.min(tc.tEndS, tt + 0.02), vol);
          nSrc += 1;
        }
        if (nMark < MAX_MARKS) {
          markArr[nMark].set(tc.xM, tc.zM, t0S + tc.tStartS, stone.radiusM * 1.3);
          // The foam along the contact's path, as strong as the stone drove
          // the water ([R05]'s normal speed, as the sheet).
          const [x0, z0] = pathAt(tc, tc.tStartS);
          const [x1, z1] = pathAt(tc, tc.tEndS);
          const un = tc.speedInMs * Math.sin(Math.max(2, tc.flightInDeg + tc.tiltInDeg) * Math.PI / 180);
          foamA[nMark].set(x0, z0, t0S + tc.tStartS, stone.radiusM * 1.25);
          foamB[nMark].set(x1, z1, Math.max(0.35, Math.min(1, 0.35 + 0.16 * un)), 0);
          nMark += 1;
        }
      }
      // Place the marks' quads over every touch, with the rings' reach.
      let minX = Infinity; let maxX = -Infinity; let minZ = Infinity; let maxZ = -Infinity;
      for (const tc of r.touches) {
        minX = Math.min(minX, tc.xM); maxX = Math.max(maxX, tc.xM);
        minZ = Math.min(minZ, tc.zM); maxZ = Math.max(maxZ, tc.zM);
      }
      if (r.touches.length > 0) {
        const pad = ringTable.rMaxM;
        const sx = maxX - minX + 2 * pad; const sz = maxZ - minZ + 2 * pad;
        const y = r.touches[0].yM;
        for (const m of [marksMesh]) {
          m.position.set((minX + maxX) / 2, y, (minZ + maxZ) / 2);
          m.scale.set(sx, 1, sz);
          m.visible = true;
          m.updateMatrixWorld();
        }
      } else { marksMesh.visible = false; }
    } else { marksMesh.visible = false; }
    for (let i = nSrc; i < MAX_RING_SOURCES; i += 1) srcArr[i].set(0, 0, -1e6, 0);
    for (let i = nMark; i < MAX_MARKS; i += 1) markArr[i].set(0, 0, -1e6, 0);
    for (let i = nMark; i < MAX_MARKS; i += 1) { foamA[i].set(0, 0, -1e6, 0); foamB[i].set(0, 0, 0, 0); }
    uFoamN.value = nMark;
    // The foam's quad over every touch, with the foam's reach.
    foamUntil = -Infinity;
    foamMesh.visible = false;
    if (r && nMark > 0) {
      let minX = Infinity; let maxX = -Infinity; let minZ = Infinity; let maxZ = -Infinity;
      for (let i = 0; i < nMark; i += 1) {
        for (const [x, z] of [[foamA[i].x, foamA[i].y], [foamB[i].x, foamB[i].y]]) {
          minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
        }
        foamUntil = Math.max(foamUntil, foamA[i].z + FOAM_LIFE_S);
      }
      const pad = r.stone.radiusM * 3 + FOAM_SPREAD_M * Math.sqrt(FOAM_LIFE_S) + 0.03 * FOAM_LIFE_S + 0.05;
      foamMesh.position.set((minX + maxX) / 2, r.touches[0].yM + FOAM_LIFT_M, (minZ + maxZ) / 2);
      foamMesh.scale.set(maxX - minX + 2 * pad, 1, maxZ - minZ + 2 * pad);
      foamMesh.updateMatrixWorld();
    }
    uSrcN.value = nSrc;
    // The marks draw while a hollow still rings or a mark still shows.
    marksUntil = -Infinity;
    for (let i = 0; i < nSrc; i += 1) marksUntil = Math.max(marksUntil, srcArr[i].z + ringTable.tMaxS);
    for (let i = 0; i < nMark; i += 1) marksUntil = Math.max(marksUntil, markArr[i].z + MARK_LIFE_S);
    uMarkN.value = nMark;
  };

  const vA = new THREE.Vector3();
  const vB = new THREE.Vector3();
  const vN = new THREE.Vector3();
  let liveDrops = 0;
  let liveSheets = 0;

  const update = (simTime: number, camera: THREE.PerspectiveCamera, viewportHeightPx: number, waterAt?: (x: number, z: number, seaTimeS: number) => number) => {
    uTime.value = simTime;
    camera.updateMatrixWorld();
    uCamRight.value.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
    uCamUp.value.setFromMatrixColumn(camera.matrixWorld, 1).normalize();
    uRadPerPx.value = (2 * Math.tan((camera.fov * Math.PI) / 360)) / Math.max(1, viewportHeightPx);
    liveDrops = 0;
    liveSheets = 0;
    stoneShown = false;
    for (const m of stoneMeshes.values()) m.visible = false;
    if (!run) {
      for (const s of sheetMeshes) s.mesh.visible = false;
      drops.visible = false;
      marksMesh.visible = false;
      foamMesh.visible = false;
      return;
    }
    const tau = simTime - t0;
    const S = 8;
    const endT = run.samples[run.samples.length - S];
    // The stone.
    const mesh = stoneMeshes.get(run.stone.id)!;
    skipStateAt(run, Math.max(0, tau), pTmp, qTmp);
    let y = pTmp[1];
    if (tau > endT && run.floats && waterAt) {
      // A floating stone rides the sea after its run: its height over the
      // water where and when the run ended, on the water here now.
      if (floatRef === null) floatRef = waterAt(pTmp[0], pTmp[2], t0 + endT);
      y = pTmp[1] - floatRef + waterAt(pTmp[0], pTmp[2], simTime);
    }
    mesh.position.set(pTmp[0], y, pTmp[2]);
    mesh.quaternion.set(qTmp[0], qTmp[1], qTmp[2], qTmp[3]);
    // A stone that sank is under the lake: once it is a stone's width under
    // the water after its last touch, it is not drawn (the surface would
    // otherwise have to hide it, and from above at a steep angle the
    // lake's opaque surface did not, capture s7 nospin f5).
    const lastT = run.touches.length ? run.touches[run.touches.length - 1] : null;
    const sunk = !run.floats && lastT !== null && tau > lastT.tStartS && y < lastT.yM - 2 * run.stone.radiusM;
    mesh.visible = !sunk;
    stonePos.set(pTmp[0], y, pTmp[2]);
    stoneShown = true;
    const firstTouch = run.touches.length ? run.touches[0].tStartS : Infinity;
    uWet.value = tau > firstTouch ? 1 : 0;

    // The sheets.
    for (const p of plans) {
      const age0 = tau - p.ts[0];
      const live = age0 >= 0 && age0 <= SPLASH_LIFE_S + (p.ts[SHEET_NS - 1] - p.ts[0]);
      if (!live) {
        if (p.slot >= 0) { sheetMeshes[p.slot].mesh.visible = false; slotOwner[p.slot] = null; p.slot = -1; }
        continue;
      }
      if (p.slot < 0) {
        // Take a free sheet; with none free (more than SHEET_SLOTS splashes
        // in the air at once) this one is not drawn.
        const free = slotOwner.indexOf(null);
        if (free < 0) continue;
        p.slot = free;
        slotOwner[free] = p;
        const sl = sheetMeshes[free];
        const qa = sl.packA.array as Float32Array; const qb = sl.packB.array as Float32Array;
        for (let v = 0; v < SHEET_NS * SHEET_NR; v += 1) {
          qa[v * 4 + 2] = p.streakArr[v];
          qb[v * 4] = p.uvArr[v * 2]; qb[v * 4 + 1] = p.uvArr[v * 2 + 1];
        }
        // Mirror about the water line, squashed: y' = w - MIRROR_SQUASH (y - w).
        sl.mirror.position.set(0, (1 + MIRROR_SQUASH) * p.water, 0);
        sl.mirror.updateMatrix();
      }
      const sm = sheetMeshes[p.slot];
      sm.mesh.visible = true;
      liveSheets += 1;
      const pa = sm.pos.array as Float32Array;
      const qa = sm.packA.array as Float32Array; const qb = sm.packB.array as Float32Array;
      const [cx, cz] = pathAt(p.touch, Math.min(tau, p.touch.tEndS));
      // THE FOOT (see SHEET_ROOT): the first row not yet launched sits at the
      // water line under the youngest launched row, so the sheet reaches the
      // water; every later unlaunched row folds onto it (no area, no draw).
      let foot = -1;
      for (let i = 0; i < SHEET_NS; i += 1) {
        const age = tau - p.ts[i];
        if (age <= 0 && foot < 0) foot = i;
        // A contact row not yet launched rides round the stone.
        const [bx, bz] = i < SHEET_NC ? pathAt(p.touch, p.ts[i]) : [cx, cz];
        for (let j = 0; j < SHEET_NR; j += 1) {
          const v = i * SHEET_NR + j;
          const k = v * 3;
          const edge = j === 0 || j === SHEET_NR - 1 ? 0 : 1;
          let x: number; let yy: number; let z: number;
          if (age <= 0) {
            if (foot === i) {
              x = p.base[k] + cx - bx; yy = p.water; z = p.base[k + 2] + cz - bz;
              qa[v * 4] = i > 0 ? qa[(v - SHEET_NR) * 4] : 0;
            } else {
              const kf = (foot * SHEET_NR + j) * 3;
              x = pa[kf]; yy = pa[kf + 1]; z = pa[kf + 2];
              qa[v * 4] = 0;
            }
            qb[v * 4 + 2] = 0;
          } else {
            x = p.base[k] + p.vel[k] * age;
            yy = p.base[k + 1] + p.vel[k + 1] * age - 0.5 * G * age * age;
            z = p.base[k + 2] + p.vel[k + 2] * age;
            // Alive until SPLASH_LIFE_S; torn from its top after
            // SPLASH_TEAR_S (the oldest rows tear first). The tear is a
            // share that the fragment's noise opens holes to.
            const life = 1 - smooth(SPLASH_LIFE_S * 0.55, SPLASH_LIFE_S, age);
            qb[v * 4 + 2] = smooth(SPLASH_TEAR_S, SPLASH_LIFE_S * 0.8, age + (SHEET_NS - 1 - i) * 0.006);
            const under = yy < p.water ? 0 : 1;
            qa[v * 4] = life * under * edge;
            if (yy < p.water) yy = p.water;
          }
          pa[k] = x; pa[k + 1] = yy; pa[k + 2] = z;
          qa[v * 4 + 3] = yy - p.water;
          // Thick at the foot and when young, a film at the top when old.
          qa[v * 4 + 1] = Math.max(0, Math.min(1, (0.25 + 0.75 * (i / (SHEET_NS - 1))) * (1 - Math.max(0, age) / SPLASH_LIFE_S)));
        }
      }
      // Normals and rim tangents from the grid.
      const na = sm.nrm.array as Float32Array;
      const ta = sm.tan.array as Float32Array;
      for (let i = 0; i < SHEET_NS; i += 1) {
        for (let j = 0; j < SHEET_NR; j += 1) {
          const v = i * SHEET_NR + j;
          const i0 = Math.max(0, i - 1); const i1 = Math.min(SHEET_NS - 1, i + 1);
          const j0 = Math.max(0, j - 1); const j1 = Math.min(SHEET_NR - 1, j + 1);
          const a0 = (i0 * SHEET_NR + j) * 3; const a1 = (i1 * SHEET_NR + j) * 3;
          const b0 = (i * SHEET_NR + j0) * 3; const b1 = (i * SHEET_NR + j1) * 3;
          vA.set(pa[a1] - pa[a0], pa[a1 + 1] - pa[a0 + 1], pa[a1 + 2] - pa[a0 + 2]);
          vB.set(pa[b1] - pa[b0], pa[b1 + 1] - pa[b0 + 1], pa[b1 + 2] - pa[b0 + 2]);
          vN.crossVectors(vB, vA);
          if (vN.lengthSq() < 1e-14) vN.set(0, 1, 0);
          vN.normalize();
          na[v * 3] = vN.x; na[v * 3 + 1] = vN.y; na[v * 3 + 2] = vN.z;
          if (vB.lengthSq() < 1e-14) vB.set(1, 0, 0);
          vB.normalize();
          ta[v * 3] = vB.x; ta[v * 3 + 1] = vB.y; ta[v * 3 + 2] = vB.z;
        }
      }
      sm.pos.needsUpdate = true; sm.nrm.needsUpdate = true; sm.tan.needsUpdate = true;
      sm.packA.needsUpdate = true; sm.packB.needsUpdate = true;
    }
    for (let s = 0; s < SHEET_SLOTS; s += 1) if (slotOwner[s] === null) sheetMeshes[s].mesh.visible = false;

    // THE IDLE COST (measured, perfIdle.mjs): every visible mesh that reads
    // the frame behind it costs a full-frame copy, and every attribute
    // flagged costs an upload. So the marks draw only while something rings,
    // the drops only while one flies, and an idle frame uploads nothing.
    if (marksMesh.visible && simTime > marksUntil) marksMesh.visible = false;
    else if (!marksMesh.visible && simTime <= marksUntil && run.touches.length > 0) marksMesh.visible = true;
    // The foam draws from the first touch until the last one's foam is gone.
    foamMesh.visible = run.touches.length > 0 && tau >= run.touches[0].tStartS && simTime <= foamUntil;
    if (tau < dropsFrom || tau > dropsUntil) {
      drops.visible = false;
      if (dropsDirty) { dCenter.fill(-1e4); dShown.fill(0); dropsClearTo = DROP_POOL; dropsDirty = false; }
      return;
    }
    // The drops: closed-form flight under linear drag, each with its own
    // drag time (dropDragS), from their launch. THE DROPS' COST: only the
    // planned drops are visited, a drop is written only while it flies (and
    // once when it goes), and only the used part of each buffer is uploaded,
    // on frames that draw the drops. A first round-2 build walked and
    // uploaded the whole pool every frame (1.2 to 1.6 ms of update,
    // perf-r2-130 and perf-r2-240).
    const used = Math.min(DROP_POOL, dropPlans.length);
    for (let d = 0; d < used; d += 1) {
      const o = d * 12;
      const dp = dropPlans[d];
      const age = dp ? tau - dp.t : -1;
      const puff = dp !== null && dp.kind === 1;
      const lifeS = puff ? PUFF_LIFE_S : 2.5;
      let alive = false;
      let x = -1e4; let yy = -1e4; let z = -1e4;
      let ux = 0; let uy = 0; let uz = 0;
      if (dp && age >= 0 && age < lifeS) {
        const T = dp.drag;
        const e = Math.exp(-age / T);
        const k1 = T * (1 - e);
        x = dp.x + dp.vx * k1;
        z = dp.z + dp.vz * k1;
        // Vertical: the terminal fall is g T under linear drag.
        yy = dp.y + (dp.vy + G * T) * k1 - G * T * age;
        alive = yy > dp.water;
        ux = dp.vx * e; uy = (dp.vy + G * T) * e - G * T; uz = dp.vz * e;
      }
      // A puff of mist grows as it slows and thins, and fades.
      if (!alive && !dShown[d]) continue;
      dShown[d] = alive ? 1 : 0;
      const size = dp ? (puff ? dp.size * (1 + Math.max(0, age) * PUFF_GROW) : dp.size) : 0;
      const fade = !alive ? 0 : puff ? Math.min(1, age / 0.03) * (1 - smooth(0.1, lifeS, age)) : Math.min(1, age / 0.01);
      for (let c = 0; c < 4; c += 1) {
        const vi = d * 4 + c;
        dCenter[o + c * 3] = alive ? x : -1e4; dCenter[o + c * 3 + 1] = alive ? yy : -1e4; dCenter[o + c * 3 + 2] = alive ? z : -1e4;
        dSize[vi] = size;
        dStretch[vi] = dp ? dp.stretch : 1;
        dKind[vi] = puff ? 1 : 0;
        if (alive) { dVel[vi * 3] = ux; dVel[vi * 3 + 1] = uy; dVel[vi * 3 + 2] = uz; }
        dFade[vi] = fade;
      }
      if (alive) liveDrops += 1;
    }
    drops.visible = liveDrops > 0;
    if (drops.visible) {
      // A range from 0 only: three r172's WebGPU backend writes each range
      // at the buffer's start. Ranges wait for the next draw, so none is lost.
      const n = Math.max(used, dropsClearTo);
      for (const [attr, k] of [[dCenterAttr, 3], [dSizeAttr, 1], [dFadeAttr, 1], [dVelAttr, 3], [dStretchAttr, 1], [dKindAttr, 1]] as const) {
        attr.addUpdateRange(0, n * 4 * k);
        attr.needsUpdate = true;
      }
      dropsClearTo = 0;
    }
    dropsDirty = true;
  };

  return {
    group,
    marks,
    setRun,
    update,
    stonePos,
    get stoneShown() { return stoneShown; },
    stats: () => {
      let first: number[] | null = null;
      for (let d = 0; d < DROP_POOL && !first; d += 1) if (dCenter[d * 12 + 1] > -1e3) first = [dCenter[d * 12], dCenter[d * 12 + 1], dCenter[d * 12 + 2], dSize[d * 4], dFade[d * 4], dStretch[d * 4]];
      return { drops: liveDrops, sheets: liveSheets, ringSources: uSrcN.value as number, firstDrop: first, dropsVisible: drops.visible, dropsParent: drops.parent === group, foam: foamMesh.visible, dropsPlanned: dropPlans.length };
    },
    dispose() {
      for (const m of stoneMeshes.values()) m.geometry.dispose();
      stoneMat.dispose();
      for (const s of sheetMeshes) s.mesh.geometry.dispose();
      sheetMat.dispose();
      mirrorMat.dispose();
      dropGeom.dispose();
      dropMat.dispose();
      marksGeom.dispose();
      marksMat.dispose();
      foamGeom.dispose();
      foamMat.dispose();
      ringTex.dispose();
      behindTex.dispose();
    },
  };
}

/** GLSL smoothstep on the CPU. */
function smooth(e0: number, e1: number, x: number): number {
  const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1);
  return t * t * (3 - 2 * t);
}
