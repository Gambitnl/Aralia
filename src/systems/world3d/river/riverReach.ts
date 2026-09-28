/**
 * @file riverReach.ts — the judged river reach: its course, its bed, its
 * valley and its boulders. A pure function of the seed.
 *
 * WHAT THIS IS
 *
 * The water gauntlet (2026-09-28) judges river water against three real
 * river clips: the Merced in Yosemite (fast water over boulders, white water),
 * a small stream over pebbles (the flow texture up close), and the Nerang in
 * Queensland (a calm reach with the banks reflected). One reach here holds all
 * three kinds of water, in the order a real river puts them:
 *
 *   s =   0 ..  95 m  a steep boulder reach (bed slope 2.5 %), wide and shallow;
 *   s =  95 .. 140 m  a bend of about 90 degrees to the right, with a pool at
 *                     the outer bank and a rock spur at the inner bank (the
 *                     spur makes an eddy);
 *   s = 140 .. 166 m  a riffle: narrow, steep (4 %) and shallow;
 *   s = 166 .. 279 m  a calm pool reach held up by a sill at the outlet, split
 *                     by an island, as the Nerang frame shows.
 *
 * `s` is the distance along the course line from the domain's west edge, in
 * meters. The water comes in at the west edge and leaves at the east edge.
 *
 * WHY A SOLVER DOMAIN AND A LARGER RENDER DOMAIN. The flow solver needs the bed
 * only where water can go, at 0.5 m. The camera sees the valley far past that.
 * Both read ONE height function (`terrainHeight`), so the solver's bed and the
 * drawn ground cannot disagree.
 *
 * WHAT IS KEPT OUT. The game's own rivers do not use this file: they carry a
 * course from `generateRiverCourse` and a bed from the chunk carve. This is the
 * judged scene's ground. The flow solver and the look (riverSolver.ts,
 * riverFlowField.ts, riverWaterMaterial.ts) take any bed and any course.
 */

/** Seeded 32-bit generator (mulberry32). Deterministic on every engine. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Integer hash to [0, 1), used by the value noise. */
function hash2(ix: number, iz: number, seed: number): number {
  let h = Math.imul(ix, 0x27d4eb2d) ^ Math.imul(iz, 0x165667b1) ^ Math.imul(seed, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smooth value noise in [-1, 1] at a scale of 1 unit per lattice cell. */
export function valueNoise(x: number, z: number, seed: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz, seed);
  const b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed);
  const d = hash2(ix + 1, iz + 1, seed);
  return (a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz) * 2 - 1;
}

/** Fractal sum of value noise: `octaves` layers, each at twice the frequency. */
export function fbm(x: number, z: number, seed: number, octaves: number): number {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let f = 1;
  for (let o = 0; o < octaves; o += 1) {
    sum += amp * valueNoise(x * f, z * f, seed + o * 101);
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  return sum / norm;
}

/** The solver's grid. Cell (i, j) has its center at (x0 + (i + 0.5) dx, z0 + (j + 0.5) dx). */
export interface RiverGridSpec {
  readonly x0: number;
  readonly z0: number;
  /** Cell size, m. */
  readonly dx: number;
  readonly nx: number;
  readonly nz: number;
}

/**
 * THE SOLVER GRID: 350 m x 140 m at 0.5 m, from x = -60 to x = 290. Why 0.5 m:
 * the boulders that make the white water are 1 to 3 m across, and a flow
 * solver needs 2 to 6 cells across an obstacle to turn the water around it and
 * leave a wake. At 1 m the smaller boulders were one cell and the flow went
 * through them as a bump. Why past both judged ends: a camera that looks up
 * the boulder reach or down the pool reach sees 50 m past each, and the
 * channel there must hold real water, not a dry trench.
 */
export const RIVER_GRID: RiverGridSpec = { x0: -60, z0: 0, dx: 0.5, nx: 700, nz: 280 };

/**
 * THE RENDER DOMAIN, m: the ground the camera can see. The valley walls
 * outside the solver grid come from the same height function at a coarser
 * mesh step.
 */
export const RIVER_RENDER_DOMAIN = { x0: -260, z0: -220, x1: 480, z1: 360 };

/**
 * THE DISCHARGE, m^3/s. 8 m^3/s is a small mountain river at summer flow
 * (the Merced at Pohono Bridge runs 5 to 30 m^3/s from July to September).
 * Round 1 ran 10 m^3/s and the boulder reach stood 0.7 m deep over a flat
 * floor: a sheet of water with rocks in it, where the Merced frames show a
 * shallow bed with the water in channels between rock bars. At 8 m^3/s over
 * the rougher bed below, the reach runs 0.2 to 0.6 m deep with many rocks out
 * of the water, about 2 m/s in the riffle and a slow pool.
 */
//
// RIVERS ROUND 4: 1.5 m^3/s, LOW SUMMER WATER. The Merced clips are
// late-summer low flow (about 1 to 3 m^3/s near Pohono Bridge in late August
// and September): most rocks stand out of the water, and the wetted channel
// is a set of narrow threads between them. By point counts on the clips'
// frames, water is 28 % of the channel (bank to bank, the dry bars included)
// at merced01 and 46 % at merced03 (r4/refWet.py); round 3's 8 m^3/s filled
// ours as one sheet (61 % and 71 %).
export const RIVER_DISCHARGE_M3S = 1.5;

/**
 * THE RIVER'S SHAPE, set by the river scene's control panel (Remy,
 * 2026-09-28: "controls on the rivers width and depth").
 *
 * - `widthScale` multiplies the channel's half width at every course key, the
 *   low-water thread's width and the island's place and size.
 * - `depthScale` multiplies the channel's depth under its bank top (the bed
 *   drops, the banks stay), and the thread's raise.
 * - `dischargeM3S` is the flow the solver feeds in at the west edge.
 *
 * Width, depth and flow are tied: the flow is the width times the water's
 * depth times its mean speed. The panel shows the solved mean speed and
 * Froude number, so a change reads in those terms.
 *
 * The shape is MODULE STATE: `setRiverShape` sets it before a build. The flow
 * worker is a fresh module for each build, and the scene sets it on the main
 * thread before it builds the view (the scene reads `courseKeyAt` too). The
 * default shape draws the judged reach exactly as before.
 */
export interface RiverShape {
  widthScale: number;
  depthScale: number;
  dischargeM3S: number;
}

export const RIVER_SHAPE_DEFAULT: RiverShape = Object.freeze({ widthScale: 1, depthScale: 1, dischargeM3S: RIVER_DISCHARGE_M3S });

/**
 * The panel's ranges. Past them the grid runs out (the channel would reach the
 * solver grid's edge at about 1.8 times the width) or the look breaks; the
 * panel reports what it finds inside them.
 */
export const RIVER_SHAPE_LIMITS = Object.freeze({
  widthScale: [0.6, 1.6] as const,
  depthScale: [0.5, 2] as const,
  dischargeM3S: [0.5, 12] as const,
});

let activeShape: RiverShape = RIVER_SHAPE_DEFAULT;

export function isDefaultRiverShape(s: RiverShape): boolean {
  return s.widthScale === 1 && s.depthScale === 1 && s.dischargeM3S === RIVER_DISCHARGE_M3S;
}

/** A short key for a shape, for caches and addresses. The default's key is empty. */
export function riverShapeKey(s: RiverShape): string {
  return isDefaultRiverShape(s) ? '' : `w${s.widthScale}-d${s.depthScale}-q${s.dischargeM3S}`;
}

/** A shape clamped to the panel's ranges; a missing or bad number takes the default. Pure. */
export function clampRiverShape(s: Partial<RiverShape> | null | undefined): RiverShape {
  const L = RIVER_SHAPE_LIMITS;
  const clamp = (v: unknown, r: readonly [number, number], d: number): number => {
    const x = typeof v === 'number' && Number.isFinite(v) ? v : d;
    return Math.min(r[1], Math.max(r[0], x));
  };
  const next: RiverShape = {
    widthScale: clamp(s?.widthScale, L.widthScale, 1),
    depthScale: clamp(s?.depthScale, L.depthScale, 1),
    dischargeM3S: clamp(s?.dischargeM3S, L.dischargeM3S, RIVER_DISCHARGE_M3S),
  };
  return isDefaultRiverShape(next) ? RIVER_SHAPE_DEFAULT : next;
}

/** Set the shape the next build uses, clamped to the panel's ranges. */
export function setRiverShape(s: Partial<RiverShape> | null | undefined): RiverShape {
  const next = clampRiverShape(s);
  activeShape = next === RIVER_SHAPE_DEFAULT ? RIVER_SHAPE_DEFAULT : Object.freeze({ ...next });
  // The design level's tables were built for the old shape.
  designTable = null;
  shapedDesignTable = null;
  return activeShape;
}

export function getRiverShape(): RiverShape {
  return activeShape;
}

/**
 * How much of the design level scales with the flow. For a wide channel the
 * normal depth goes as (flow per unit width)^(3/5) (Manning), so a doubled
 * flow in the same channel stands about 1.5 times as deep, and a doubled width
 * at the same flow about 0.66 times. 1 at the default shape.
 */
export function riverFlowDepthFactor(s: RiverShape = activeShape): number {
  if (isDefaultRiverShape(s)) return 1;
  return Math.pow((s.dischargeM3S / RIVER_DISCHARGE_M3S) / s.widthScale, 0.6);
}

/**
 * The solver's wet ceiling over the design level, m. 0.8 m at the default
 * shape (calibrated: the design level is within 0.15 m of the steady level).
 * A changed shape's design level is only an estimate, so its ceiling is
 * higher, so no water is cut off; the cells it adds cost the step little
 * while they stay dry.
 */
export function riverCeilingMarginM(): number {
  if (isDefaultRiverShape(activeShape)) return 0.8;
  return 0.8 * Math.max(1, riverFlowDepthFactor()) + 0.8;
}

/**
 * THE RIVER'S PATH AND ITS LOCAL WIDTH, set by the river scene's edit mode
 * (Remy, 2026-09-29: "make it so i can grab the river and i can manipulate the
 * river shape live, without reloading").
 *
 * - `offsets[p]` moves control point p of the course line (COURSE_POINTS) by
 *   (dx, dz) m. A Catmull-Rom segment reads four points, so a moved point
 *   changes the four segments round it and no others.
 * - `widths[p]` multiplies the channel's half width at control point p. Between
 *   two points the multiplier follows a Catmull-Rom curve in the design s.
 * - `heights[p]` raises (+) or lowers (-) the channel's bed at control point p,
 *   m against the judged bed (Remy, 2026-09-29: "make it so that i can make
 *   the river nodes be able to go up and down individually ... and even if
 *   possible raise above the bank at some points (so that the water is forced
 *   to go around that raised point)"). See `riverHeightAt` and the mound in
 *   `terrainHeightAt`.
 *
 * THE DESIGN S. The bed table (COURSE_KEYS) and the design level are keyed on
 * s, the distance along the course. A moved point changes the length of its
 * segments, and plain arc length would then shift every pool, riffle and sill
 * downstream of it. So an edited course keeps each segment's JUDGED length as
 * its s: a stretched segment is stretched in s too (RiverCourse, `reference`).
 * The bed downstream of an edit stays where it was.
 *
 * MODULE STATE, as the shape is: `setRiverCourseEdit` sets it. The judged
 * river has no edit (null). The edit reaches the ground only through the
 * live editor's bed patch (riverLive.ts): `buildRiverReach` builds the judged
 * course, and refuses to build while an edit is active.
 */
export interface RiverCourseEdit {
  readonly offsets: ReadonlyArray<readonly [number, number]>;
  readonly widths: ReadonlyArray<number>;
  /** The bed's rise (+) or drop (-) at each control point, m; absent or 0 = the judged bed. */
  readonly heights?: ReadonlyArray<number>;
}

/** The limits of the edit mode. */
export const RIVER_EDIT_LIMITS = Object.freeze({
  /**
   * The farthest a control point may move from its judged place, m. The
   * neighbor points are 10 to 30 m apart: past about 40 m two segments fold
   * over each other and the channel crosses itself.
   */
  moveM: 40,
  /** A control point's width multiplier. */
  width: [0.4, 2.0] as const,
  /**
   * A control point's bed rise, m. -3 digs a pool 3 m deeper; +5 lifts the
   * pool reach's bed (3.9 m under its bank) above its bank, and the boulder
   * reach's (about 1 m under its bank) well above it.
   */
  height: [-3, 5] as const,
  /** How far the channel's bank keeps from the solver grid's north and south edges, m. */
  edgeM: 8,
});

/**
 * The control points the edit mode offers: the ones inside the solver grid
 * (x = -45 to 284). The points outside it carry the course out of the judged
 * views, and the solver has no water there to move.
 */
export const RIVER_EDITABLE_POINTS: readonly number[] = Object.freeze(
  Array.from({ length: 19 }, (_, k) => k + 4),
);

let activeCourseEdit: RiverCourseEdit | null = null;
/** True when the active edit raises or lowers a control point (the ground function reads it per point). */
let activeHasHeights = false;

/** True when an edit moves nothing and widens nothing (the judged course). */
export function isDefaultCourseEdit(e: RiverCourseEdit | null | undefined): boolean {
  if (!e) return true;
  for (const o of e.offsets) if (o && (o[0] !== 0 || o[1] !== 0)) return false;
  for (const w of e.widths) if (w !== undefined && w !== 1) return false;
  for (const h of e.heights ?? []) if (h !== undefined && h !== 0) return false;
  return true;
}

/**
 * An edit clamped to the edit mode's limits, as dense arrays over every
 * control point; null when it changes nothing. Pure. A point keeps its
 * channel inside the solver grid (the bank `edgeM` from the grid's north and
 * south edges), within `moveM` of its judged place.
 */
export function clampRiverCourseEdit(e: RiverCourseEdit | null | undefined): RiverCourseEdit | null {
  if (!e) return null;
  const L = RIVER_EDIT_LIMITS;
  const n = COURSE_POINTS.length;
  const editable = new Set(RIVER_EDITABLE_POINTS);
  const widths: number[] = [];
  const offsets: Array<[number, number]> = [];
  const heights: number[] = [];
  const pS = defaultRiverCourse().pointS;
  for (let p = 0; p < n; p += 1) {
    const h0 = e.heights?.[p];
    heights.push(editable.has(p) && typeof h0 === 'number' && Number.isFinite(h0) ? Math.min(L.height[1], Math.max(L.height[0], h0)) : 0);
    const w0 = e.widths[p];
    const w = editable.has(p) && typeof w0 === 'number' && Number.isFinite(w0) ? Math.min(L.width[1], Math.max(L.width[0], w0)) : 1;
    widths.push(w);
    const o = e.offsets[p];
    let dx = editable.has(p) && o && Number.isFinite(o[0]) ? o[0] : 0;
    let dz = editable.has(p) && o && Number.isFinite(o[1]) ? o[1] : 0;
    const r = Math.hypot(dx, dz);
    if (r > L.moveM) { dx *= L.moveM / r; dz *= L.moveM / r; }
    // The channel inside the grid: the bank edgeM from the north and south
    // edges, and the point inside the west and east edges.
    const hw = courseKeyAtBase(pS[p]).halfW * activeShape.widthScale * w;
    const g = RIVER_GRID;
    const zMin = g.z0 + hw + L.edgeM;
    const zMax = g.z0 + g.nz * g.dx - hw - L.edgeM;
    const px = COURSE_POINTS[p][0];
    const pz = COURSE_POINTS[p][1];
    if (dx !== 0 || dz !== 0) {
      dz = Math.min(zMax, Math.max(zMin, pz + dz)) - pz;
      dx = Math.min(g.x0 + g.nx * g.dx - 2, Math.max(g.x0 + 2, px + dx)) - px;
    }
    offsets.push([dx, dz]);
  }
  const out = { offsets, widths, heights };
  return isDefaultCourseEdit(out) ? null : out;
}

/** Set the course edit the ground, the key table and the live solver read. Returns the clamped edit. */
export function setRiverCourseEdit(e: RiverCourseEdit | null | undefined): RiverCourseEdit | null {
  const c = clampRiverCourseEdit(e);
  activeCourseEdit = c ? Object.freeze({
    offsets: Object.freeze(c.offsets.map((o) => Object.freeze([o[0], o[1]] as [number, number]))),
    widths: Object.freeze([...c.widths]),
    heights: Object.freeze([...(c.heights ?? new Array(COURSE_POINTS.length).fill(0))]),
  }) : null;
  activeHasHeights = !!activeCourseEdit && activeCourseEdit.heights!.some((h) => h !== 0);
  return activeCourseEdit;
}

export function getRiverCourseEdit(): RiverCourseEdit | null {
  return activeCourseEdit;
}

/** The control points of an edit (the judged ones for no edit). */
export function riverCoursePoints(e: RiverCourseEdit | null | undefined = activeCourseEdit): Array<[number, number]> {
  return COURSE_POINTS.map((p, k) => {
    const o = e?.offsets[k];
    return o ? [p[0] + o[0], p[1] + o[1]] : [p[0], p[1]];
  });
}

/**
 * A short key for an edit, for the page's address and caches: "c<p>:<dx>:<dz>"
 * for each moved point, "w<p>:<w>" for each widened one and "h<p>:<dz>" for
 * each raised or lowered one, joined by "_". Offsets are kept to 0.1 m,
 * widths and heights to 0.01. The judged course's key is empty.
 */
export function riverCourseEditKey(e: RiverCourseEdit | null | undefined): string {
  if (isDefaultCourseEdit(e) || !e) return '';
  const parts: string[] = [];
  e.offsets.forEach((o, p) => {
    if (o && (o[0] !== 0 || o[1] !== 0)) parts.push(`c${p}:${(Math.round(o[0] * 10) / 10)}:${(Math.round(o[1] * 10) / 10)}`);
  });
  e.widths.forEach((w, p) => {
    if (w !== undefined && w !== 1) parts.push(`w${p}:${Math.round(w * 100) / 100}`);
  });
  (e.heights ?? []).forEach((h, p) => {
    if (h !== undefined && h !== 0) parts.push(`h${p}:${Math.round(h * 100) / 100}`);
  });
  return parts.join('_');
}

/** Read an edit from its key (see riverCourseEditKey); null for none or a bad key. Pure. */
export function parseRiverCourseEdit(key: string | null | undefined): RiverCourseEdit | null {
  if (!key) return null;
  const n = COURSE_POINTS.length;
  const offsets: Array<[number, number]> = Array.from({ length: n }, () => [0, 0]);
  const widths: number[] = new Array(n).fill(1);
  const heights: number[] = new Array(n).fill(0);
  for (const part of key.split('_')) {
    const hm = /^h(\d+):(-?[\d.]+)$/.exec(part);
    if (hm) { const p = Number(hm[1]); if (p < n) heights[p] = Number(hm[2]); continue; }
    const m = /^c(\d+):(-?[\d.]+):(-?[\d.]+)$/.exec(part);
    if (m) { const p = Number(m[1]); if (p < n) offsets[p] = [Number(m[2]), Number(m[3])]; continue; }
    const w = /^w(\d+):([\d.]+)$/.exec(part);
    if (w) { const p = Number(w[1]); if (p < n) widths[p] = Number(w[2]); }
  }
  return clampRiverCourseEdit({ offsets, widths, heights });
}

/**
 * THE BED'S RISE at s from the active edit, m: 0 with no edit or no height.
 * Between two control points it follows a SMOOTHSTEP from one point's
 * height to the next (not a Catmull-Rom curve, as the widths do): it never
 * overshoots, so a raised point makes no dip at its neighbors, and it is 0
 * past the neighbors of a lone raised point. Its slope along the course is 0
 * at every point, so a raised point is the crest of its hump.
 */
export function riverHeightAt(s: number): number {
  if (!activeHasHeights || !activeCourseEdit) return 0;
  const P = defaultRiverCourse().pointS;
  const H = activeCourseEdit.heights!;
  const last = P.length - 1;
  if (s <= P[0]) return H[0];
  if (s >= P[last]) return H[last];
  let lo = 0;
  let hi = last;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (P[mid] <= s) lo = mid; else hi = mid;
  }
  const a = H[lo];
  const b = H[lo + 1];
  if (a === b) return a;
  const t = (s - P[lo]) / (P[lo + 1] - P[lo]);
  return a + (b - a) * t * t * (3 - 2 * t);
}

/**
 * THE MOUND across the channel that a height makes, 0..1 by the lateral
 * coordinate t (0 at the thalweg, 1 at the bank): (1 - (t / 0.7)^2)^2 inside
 * the middle 70 % of the half width, 0 outside it. A raised point lifts the
 * middle most, and the outer 30 % on each side keeps the judged bed, so a
 * large raise stands out of the water as a hump with SIDE CHANNELS beside it
 * (Remy: "so that the water is forced to go around that raised point"). A
 * mound over the whole width could only block: at low water the wet width is
 * a narrow middle (the bend pool's water covers t under 0.58), and a mound
 * that covers it leaves the water no way past but over the banks. The slope
 * is 0 at the mound's edge, so the bed has no kink. A lowered point digs the
 * middle deepest.
 */
export const RIVER_MOUND_WIDTH = 0.7;

export function riverMoundAt(t: number): number {
  const u = t / RIVER_MOUND_WIDTH;
  if (u >= 1) return 0;
  const q = 1 - u * u;
  return q * q;
}

/**
 * The width multiplier at s from the active edit: 1 with no edit. A
 * Catmull-Rom curve through the control points' multipliers, by the design s
 * of each point, kept between 0.3 and 2.5 (the curve can overshoot between
 * two points).
 */
export function riverWidthAt(s: number): number {
  const e = activeCourseEdit;
  if (!e) return 1;
  const P = defaultRiverCourse().pointS;
  const W = e.widths;
  const last = P.length - 1;
  if (s <= P[0]) return W[0];
  if (s >= P[last]) return W[last];
  let lo = 0;
  let hi = last;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (P[mid] <= s) lo = mid; else hi = mid;
  }
  const t = (s - P[lo]) / (P[lo + 1] - P[lo]);
  const w = catmull(W[Math.max(0, lo - 1)], W[lo], W[lo + 1], W[Math.min(last, lo + 2)], t);
  return Math.min(2.5, Math.max(0.3, w));
}

/**
 * Where a point at (s, n) of the judged channel lies across the channel now:
 * inside the judged banks, n is scaled by the change of the half width; past
 * them, the point keeps its distance from the bank. For the rocks and the
 * small stones, which ride their place in the channel when it widens.
 */
export function riverLateralN(s: number, n: number): number {
  const hw0 = courseKeyAtBase(s).halfW;
  const hw1 = courseKeyAt(s).halfW;
  if (hw1 === hw0) return n;
  const a = Math.abs(n);
  return a <= hw0 ? n * (hw1 / hw0) : Math.sign(n) * (a - hw0 + hw1);
}

/** The judged half width at s (no shape, no edit), m. */
export function riverBaseHalfWidthAt(s: number): number {
  return courseKeyAtBase(s).halfW;
}

/** One key of the along-course bed description. */
interface CourseKey {
  /** Distance along the course, m. */
  s: number;
  /** Bed height at the deepest point of the cross-section, m. */
  thalweg: number;
  /** Half the channel width at the bank top, m. */
  halfW: number;
  /** Bank-top (floodplain edge) height, m. */
  bankTop: number;
  /** Cross-section shape exponent: bed = thalweg + (bankTop - thalweg) * t^p. 2 = a U, 5 = a flat floor with steep sides. */
  shapeP: number;
  /** Manning roughness n, s/m^(1/3). */
  manning: number;
}

/**
 * THE BED, key by key. Heights in meters; the pool's water stands near 0.95 m.
 *
 * - Boulder reach: slope (4.6 - 2.2) / 95 = 2.5 %, a step-pool slope. The
 *   cross-section is a shallow U (p = 2.4): a deeper thread in the middle and
 *   long shallow margins where the gravel shows through clear water. Round 1
 *   used a flat floor (p = 4), the reach stood 0.5 to 0.8 m deep from bank to
 *   bank, and three judges saw "no depth": one tint over the whole bed.
 *   Manning 0.045 is the cobble-and-boulder value (Chow 1959, table 5-6).
 * - Bend: the pool at s = 120 is 1.0 m under the reach above it; outer-bank
 *   scour is the reason a bend pool exists.
 * - Riffle: 4 % over 27 m, half width 6.5 m, flat (p = 5): shallow fast water.
 * - Pool reach: thalweg -1.4 m, held up by the outlet sill. Manning 0.030: a
 *   clean pool with a sand and gravel bed. Rivers round 4: the sill stands at
 *   +0.9 m (it was +0.45 m) so that the pool keeps its 1.22 m level at the low
 *   summer discharge of 1.5 m^3/s (a 480 s run: 1.21 to 1.22 m over s = 170
 *   to 270): the Nerang pool is a deep still pool in summer, and the judged
 *   calm-bridge view keeps its water.
 */
const COURSE_KEYS: CourseKey[] = [
  { s: -140, thalweg: 8.1, halfW: 10.5, bankTop: 9.1, shapeP: 2.4, manning: 0.045 },
  { s: -20, thalweg: 5.1, halfW: 11.5, bankTop: 6.1, shapeP: 2.4, manning: 0.045 },
  { s: 0, thalweg: 4.6, halfW: 11.5, bankTop: 5.6, shapeP: 2.4, manning: 0.045 },
  { s: 50, thalweg: 3.35, halfW: 12.0, bankTop: 4.4, shapeP: 2.4, manning: 0.045 },
  { s: 95, thalweg: 2.2, halfW: 11.0, bankTop: 3.3, shapeP: 3, manning: 0.042 },
  { s: 120, thalweg: 1.2, halfW: 10.0, bankTop: 3.1, shapeP: 2, manning: 0.035 },
  { s: 140, thalweg: 1.65, halfW: 8.0, bankTop: 2.9, shapeP: 3, manning: 0.04 },
  { s: 152, thalweg: 1.2, halfW: 6.5, bankTop: 2.6, shapeP: 5, manning: 0.04 },
  { s: 166, thalweg: 0.6, halfW: 7.0, bankTop: 2.3, shapeP: 4, manning: 0.035 },
  { s: 182, thalweg: -1.3, halfW: 8.5, bankTop: 2.4, shapeP: 2, manning: 0.03 },
  { s: 205, thalweg: -1.4, halfW: 12.5, bankTop: 2.5, shapeP: 2.2, manning: 0.03 },
  { s: 245, thalweg: -1.4, halfW: 12.5, bankTop: 2.5, shapeP: 2.2, manning: 0.03 },
  { s: 258, thalweg: -1.1, halfW: 8.5, bankTop: 2.4, shapeP: 2, manning: 0.03 },
  { s: 272, thalweg: 0.9, halfW: 8.5, bankTop: 2.2, shapeP: 3, manning: 0.035 },
  { s: 300, thalweg: 0.65, halfW: 8.0, bankTop: 2.0, shapeP: 3, manning: 0.035 },
  { s: 420, thalweg: -1.0, halfW: 8.0, bankTop: 1.0, shapeP: 3, manning: 0.035 },
];

/**
 * THE COURSE LINE, control points in meters (x east, z south). A Catmull-Rom
 * curve runs through them. From (82, 35) to (123, 84) the river turns about
 * 90 degrees to the RIGHT of its flow (x east, z south: from heading east to
 * heading south, on a radius near 30 m); from (128, 94) to (155, 105) it turns
 * back left into the pool reach, which runs east. Upstream of x = 0 the course
 * comes down from the north-west, behind the north mountainside; downstream of
 * x = 240 it turns south into the forest. Both turns take the channel out of
 * the judged views instead of ending it where a camera can see.
 */
const COURSE_POINTS: Array<[number, number]> = [
  [-190, -60], [-150, -32], [-110, -8], [-75, 10], [-45, 24], [-20, 30], [0, 30],
  [30, 27], [58, 30], [82, 35], [98, 40], [110, 48], [118, 60], [121, 72], [123, 84],
  [128, 94], [138, 101], [155, 105], [180, 106.5], [210, 106], [240, 104], [262, 107],
  [284, 116], [306, 132], [330, 155], [360, 185],
];

/** The course sample spacing, m. Four samples per solver cell edge would be waste; two is enough for a smooth projection. */
const COURSE_STEP_M = 0.25;

export interface CourseSample {
  x: number;
  z: number;
  s: number;
  /** Unit tangent, pointing downstream. */
  tx: number;
  tz: number;
  /** Signed curvature, 1/m: positive when the course turns toward its left side (+n). */
  curv: number;
  /**
   * World meters per meter of s here: 1 on the judged course; on an edited
   * course, the stretch of this segment against its judged length (see
   * RiverCourseEdit, the design s).
   */
  stretch: number;
}

/** Catmull-Rom (centripetal is not needed: the control points are evenly spaced). */
function catmull(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

/**
 * THE COURSE: a dense line with its arc length, tangent and curvature, and a
 * projection that returns (s, n) for any point. `n` is the signed offset from
 * the line, positive on the LEFT of the flow. With x east and z south (a map
 * seen from above with +z down the page), the left of an eastward flow is
 * north, which is -z: the left normal of the tangent (tx, tz) is (tz, -tx).
 */
export class RiverCourse {
  readonly samples: CourseSample[] = [];
  /** The control points the curve runs through, m. */
  readonly points: ReadonlyArray<readonly [number, number]>;
  /**
   * The design s of each control point, m: where the JUDGED course has it.
   * An edited course keeps these (see RiverCourseEdit), so a point's bed key
   * does not move along the course when the point moves.
   */
  readonly pointS: number[] = [];
  /** Per segment (control point k to k + 1): the world length of its curve, m. */
  readonly segLen: number[] = [];
  /** Per segment: the design arc (from the curve's first point) where it starts, m. */
  readonly segStartD: number[] = [];
  /** Index of the sample nearest s = 0 (the west grid edge). */
  private readonly sOffset: number;
  /** A coarse bucket grid over the samples, so a projection reads a few samples, not all. */
  private readonly bucketM = 8;
  private bx0 = 0;
  private bz0 = 0;
  private bw = 0;
  private bh = 0;
  private bucketStart = new Int32Array(1);
  private bucketItems = new Int32Array(0);

  /**
   * With no `reference`, the course runs through `points` by its own arc
   * length (the judged course). With a reference (the judged course), s is
   * the DESIGN s: each segment keeps the reference's length in s however long
   * it is now, and the samples are the reference's samples in number and in s
   * (the live river editor, 2026-09-29).
   */
  constructor(points: ReadonlyArray<readonly [number, number]> = COURSE_POINTS, reference: RiverCourse | null = null) {
    this.points = points.map((p) => [p[0], p[1]] as const);
    // Dense raw curve, then resample by arc length.
    const raw: Array<[number, number]> = [];
    for (let k = 0; k < points.length - 1; k += 1) {
      const p0 = points[Math.max(0, k - 1)];
      const p1 = points[k];
      const p2 = points[k + 1];
      const p3 = points[Math.min(points.length - 1, k + 2)];
      for (let q = 0; q < 64; q += 1) {
        const t = q / 64;
        raw.push([catmull(p0[0], p1[0], p2[0], p3[0], t), catmull(p0[1], p1[1], p2[1], p3[1], t)]);
      }
    }
    raw.push([points[points.length - 1][0], points[points.length - 1][1]]);
    const cum: number[] = [0];
    for (let k = 1; k < raw.length; k += 1) {
      cum.push(cum[k - 1] + Math.hypot(raw[k][0] - raw[k - 1][0], raw[k][1] - raw[k - 1][1]));
    }
    const nSeg = points.length - 1;
    // Each segment's length as a sum over its own points only, so a segment
    // an edit leaves alone has exactly its judged length (and a stretch of 1).
    const wcum = new Float64Array(raw.length);
    for (let k = 0; k < nSeg; k += 1) {
      const a = k * 64;
      let acc = 0;
      for (let q = 1; q <= 64; q += 1) {
        acc += Math.hypot(raw[a + q][0] - raw[a + q - 1][0], raw[a + q][1] - raw[a + q - 1][1]);
        if (q < 64) wcum[a + q] = acc;
      }
      this.segLen.push(acc);
    }
    const total = cum[cum.length - 1];
    const pts: Array<[number, number]> = [];
    const stretch: number[] = [];
    let zeroIdx = 0;
    if (!reference) {
      let seg = 0;
      for (let d = 0; d <= total; d += COURSE_STEP_M) {
        while (seg < cum.length - 2 && cum[seg + 1] < d) seg += 1;
        const span = cum[seg + 1] - cum[seg] || 1;
        const t = (d - cum[seg]) / span;
        pts.push([raw[seg][0] + (raw[seg + 1][0] - raw[seg][0]) * t, raw[seg][1] + (raw[seg + 1][1] - raw[seg][1]) * t]);
        stretch.push(1);
      }
      // s = 0 where the course crosses the grid's west edge (x = 0).
      for (let k = 0; k < pts.length - 1; k += 1) {
        if (pts[k][0] <= 0 && pts[k + 1][0] > 0) { zeroIdx = k; break; }
      }
      for (let k = 0; k < nSeg; k += 1) this.segStartD.push(cum[k * 64]);
    } else {
      // THE DESIGN S: a raw point of segment k sits at the reference's start
      // of k plus its own distance into k, scaled to the reference's length.
      if (reference.segLen.length !== nSeg) throw new Error('[river] An edited course needs as many control points as its reference.');
      const D = new Float64Array(raw.length);
      for (let k = 0; k < nSeg; k += 1) {
        const a = k * 64;
        const ratio = reference.segLen[k] / (this.segLen[k] || 1);
        for (let q = 0; q < 64; q += 1) D[a + q] = reference.segStartD[k] + wcum[a + q] * ratio;
      }
      D[raw.length - 1] = reference.segStartD[nSeg - 1] + reference.segLen[nSeg - 1];
      let seg = 0;
      for (let k = 0; k < reference.samples.length; k += 1) {
        const d = Math.min(k * COURSE_STEP_M, D[D.length - 1]);
        while (seg < D.length - 2 && D[seg + 1] < d) seg += 1;
        const span = D[seg + 1] - D[seg] || 1;
        const t = Math.max(0, Math.min(1, (d - D[seg]) / span));
        pts.push([raw[seg][0] + (raw[seg + 1][0] - raw[seg][0]) * t, raw[seg][1] + (raw[seg + 1][1] - raw[seg][1]) * t]);
        const sk = Math.min(nSeg - 1, Math.floor(seg / 64));
        stretch.push(this.segLen[sk] / reference.segLen[sk]);
      }
      zeroIdx = reference.sOffset;
      for (let k = 0; k < nSeg; k += 1) this.segStartD.push(reference.segStartD[k]);
    }
    this.sOffset = zeroIdx;
    for (let k = 0; k < nSeg; k += 1) this.pointS.push(this.segStartD[k] - zeroIdx * COURSE_STEP_M);
    this.pointS.push((reference ? reference.segStartD[nSeg - 1] + reference.segLen[nSeg - 1] : total) - zeroIdx * COURSE_STEP_M);
    for (let k = 0; k < pts.length; k += 1) {
      const a = pts[Math.max(0, k - 1)];
      const b = pts[Math.min(pts.length - 1, k + 1)];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      this.samples.push({
        x: pts[k][0], z: pts[k][1], s: (k - zeroIdx) * COURSE_STEP_M,
        tx: (b[0] - a[0]) / len, tz: (b[1] - a[1]) / len, curv: 0, stretch: stretch[k],
      });
    }
    // An edited course measures its curvature over world meters, not design
    // s: the design step times each sample's stretch. A segment the edit left
    // alone has a stretch of exactly 1, so its curvature is the judged one
    // (a chord sum would differ by about 1e-8 /m and flag it as changed).
    let arc: Float64Array | null = null;
    if (reference) {
      arc = new Float64Array(pts.length);
      for (let k = 1; k < pts.length; k += 1) arc[k] = arc[k - 1] + COURSE_STEP_M * stretch[k - 1];
    }
    // Curvature from the tangent's turn over +-4 m, smoothed so the bed's
    // bend asymmetry has no kinks. Left normal of (tx, tz) is (tz, -tx).
    const W = 16;
    for (let k = 0; k < this.samples.length; k += 1) {
      const ka = Math.max(0, k - W);
      const kb = Math.min(this.samples.length - 1, k + W);
      const a = this.samples[ka];
      const b = this.samples[kb];
      const ds = arc ? arc[kb] - arc[ka] || 1 : b.s - a.s || 1;
      const cross = a.tx * b.tz - a.tz * b.tx;
      // cross > 0 turns from +x toward +z, which is the RIGHT of an eastward
      // flow in this frame (z south); a left turn gives a negative cross.
      this.samples[k].curv = -Math.asin(Math.max(-1, Math.min(1, cross))) / ds;
    }
    // THE BUCKETS as a dense grid over the samples' extent: bucket b holds
    // the samples bucketItems[bucketStart[b] .. bucketStart[b + 1]), in
    // ascending order (a Map of lists cost 20 to 40 ns an empty lookup, and a
    // point 200 m from the course reads about 2,600 buckets: 46 us a point).
    let bxMin = Infinity; let bxMax = -Infinity; let bzMin = Infinity; let bzMax = -Infinity;
    for (const smp of this.samples) {
      const bx = Math.floor(smp.x / this.bucketM);
      const bz = Math.floor(smp.z / this.bucketM);
      if (bx < bxMin) bxMin = bx;
      if (bx > bxMax) bxMax = bx;
      if (bz < bzMin) bzMin = bz;
      if (bz > bzMax) bzMax = bz;
    }
    this.bx0 = bxMin;
    this.bz0 = bzMin;
    this.bw = bxMax - bxMin + 1;
    this.bh = bzMax - bzMin + 1;
    const counts = new Int32Array(this.bw * this.bh + 1);
    const slot = (smp: CourseSample): number => (Math.floor(smp.z / this.bucketM) - bzMin) * this.bw + (Math.floor(smp.x / this.bucketM) - bxMin);
    for (const smp of this.samples) counts[slot(smp) + 1] += 1;
    for (let b = 1; b < counts.length; b += 1) counts[b] += counts[b - 1];
    this.bucketStart = counts.slice();
    this.bucketItems = new Int32Array(this.samples.length);
    const fillAt = counts;
    for (let k = 0; k < this.samples.length; k += 1) {
      const b = slot(this.samples[k]);
      this.bucketItems[fillAt[b]] = k;
      fillAt[b] += 1;
    }
  }

  /** Length of the course inside the solver grid and a little past it, m. */
  get lengthM(): number {
    return this.samples[this.samples.length - 1].s;
  }

  /** The course point at arc length s (clamped to the line). */
  at(s: number): CourseSample {
    const k = Math.max(0, Math.min(this.samples.length - 1, Math.round(s / COURSE_STEP_M) + this.sOffset));
    return this.samples[k];
  }

  /**
   * Project (x, z) on the course. Returns the arc length s, the signed offset n
   * (positive on the left of the flow) and the course sample index. The search
   * reads the buckets in growing rings until a ring cannot hold a nearer point.
   */
  project(x: number, z: number): { s: number; n: number; k: number; d: number } {
    const bx = Math.floor(x / this.bucketM);
    const bz = Math.floor(z / this.bucketM);
    let best = -1;
    let bestD2 = Infinity;
    for (let r = 0; r < 40; r += 1) {
      // The ring's buckets only, row by row and left to right (the order of
      // the full square this loop once walked, so ties resolve the same way;
      // walking the square cost O(r^3) for a far point: 2.5 s of the page's
      // 3 s reach build, 2026-09-29).
      for (let dz = -r; dz <= r; dz += 1) {
        const edgeRow = dz === -r || dz === r;
        const stepX = edgeRow || r === 0 ? 1 : 2 * r;
        const gz = bz + dz - this.bz0;
        if (gz < 0 || gz >= this.bh) continue;
        for (let dxb = -r; dxb <= r; dxb += stepX) {
          const gx = bx + dxb - this.bx0;
          if (gx < 0 || gx >= this.bw) continue;
          const b = gz * this.bw + gx;
          for (let q = this.bucketStart[b], qe = this.bucketStart[b + 1]; q < qe; q += 1) {
            const k = this.bucketItems[q];
            const smp = this.samples[k];
            const d2 = (smp.x - x) ** 2 + (smp.z - z) ** 2;
            if (d2 < bestD2) { bestD2 = d2; best = k; }
          }
        }
      }
      // A point in ring r + 1 is at least r * bucketM away.
      if (best >= 0 && r * this.bucketM > Math.sqrt(bestD2)) break;
    }
    // Past 40 rings (320 m) the buckets hold nothing: read every sample. Only
    // the far corners of the render domain get here.
    if (best < 0) {
      for (let k = 0; k < this.samples.length; k += 1) {
        const smp = this.samples[k];
        const d2 = (smp.x - x) ** 2 + (smp.z - z) ** 2;
        if (d2 < bestD2) { bestD2 = d2; best = k; }
      }
    }
    const smp = this.samples[best];
    const ddx = x - smp.x;
    const ddz = z - smp.z;
    const along = ddx * smp.tx + ddz * smp.tz;
    // Left normal (tz, -tx): an eastward flow (1, 0) has its left at (0, -1), north.
    const n = ddx * smp.tz - ddz * smp.tx;
    // On an edited course a world meter along a stretched segment is less
    // than a meter of s (the judged course has stretch 1 everywhere).
    const s = smp.stretch === 1 ? smp.s + along : smp.s + along / smp.stretch;
    return { s, n, k: best, d: Math.sqrt(bestD2) };
  }
}

let defaultCourse: RiverCourse | null = null;

/** The judged course (built once; it never changes). */
export function defaultRiverCourse(): RiverCourse {
  if (!defaultCourse) defaultCourse = new RiverCourse();
  return defaultCourse;
}

/** The course of an edit: the judged course for none, else a design-s course through the edit's points. */
export function riverCourseFor(e: RiverCourseEdit | null | undefined): RiverCourse {
  if (!e || isDefaultCourseEdit(e)) return defaultRiverCourse();
  const moved = e.offsets.some((o) => o && (o[0] !== 0 || o[1] !== 0));
  return moved ? new RiverCourse(riverCoursePoints(e), defaultRiverCourse()) : defaultRiverCourse();
}

/** The judged course's control points (x east, z south), m. */
export const RIVER_COURSE_POINTS: ReadonlyArray<readonly [number, number]> = COURSE_POINTS;

/**
 * The bed key at s, linearly interpolated, for the active shape. At the
 * default shape it returns the table's own numbers.
 */
export function courseKeyAt(s: number): CourseKey {
  const k = courseKeyAtBase(s);
  const sh = activeShape;
  // The edit mode's local width (1 with no edit, so the judged river is exact).
  const wl = activeCourseEdit ? riverWidthAt(s) : 1;
  if (sh === RIVER_SHAPE_DEFAULT && wl === 1) return k;
  return {
    ...k,
    halfW: k.halfW * sh.widthScale * wl,
    // The bed drops under the bank top; the banks keep their height.
    thalweg: sh.depthScale === 1 ? k.thalweg : k.bankTop - (k.bankTop - k.thalweg) * sh.depthScale,
  };
}

/** The table's own key at s, with no shape: for readouts in meters (the panel). */
export function courseBaseKeyAt(s: number): { halfW: number; depthM: number } {
  const k = courseKeyAtBase(s);
  return { halfW: k.halfW, depthM: k.bankTop - k.thalweg };
}

/** The table's own key at s, linearly interpolated (no shape). */
function courseKeyAtBase(s: number): CourseKey {
  const keys = COURSE_KEYS;
  if (s <= keys[0].s) return keys[0];
  for (let k = 0; k < keys.length - 1; k += 1) {
    const a = keys[k];
    const b = keys[k + 1];
    if (s <= b.s) {
      const t = (s - a.s) / (b.s - a.s);
      return {
        s,
        thalweg: a.thalweg + (b.thalweg - a.thalweg) * t,
        halfW: a.halfW + (b.halfW - a.halfW) * t,
        bankTop: a.bankTop + (b.bankTop - a.bankTop) * t,
        shapeP: a.shapeP + (b.shapeP - a.shapeP) * t,
        manning: a.manning + (b.manning - a.manning) * t,
      };
    }
  }
  return keys[keys.length - 1];
}

/**
 * THE DESIGN WATER LEVEL at s, m: a first guess of the steady level, used only
 * to START the solver near its answer and to bound where water can go. It is
 * not the drawn level; the solver's is.
 *
 * Rivers round 4, CALIBRATED on a 480 s run at the low summer discharge of
 * 1.5 m^3/s (steady to 4 %: outflow 1.44 of 1.5): 0.55 m over the boulder
 * reach's thalweg (the low-water thread and the rock field; the solved
 * median level is within 0.15 m of it), 2.25 m in the bend pool down to
 * s = 125 and 1.95 m past it (the bend's steady level falls from 2.34 m at
 * s = 110 to 1.89 m at 140), the riffle at 0.3 m over its thalweg and never
 * under the pool, a 1.2 m level in the pool reach (held by the raised sill),
 * and 0.3 m past the sill. The level never rises downstream. (Rounds 1 to 3
 * were calibrated at 8 m^3/s.)
 */
let designTable: Float64Array | null = null;
let shapedDesignTable: Float64Array | null = null;
const DESIGN_S0 = -140;
const DESIGN_S1 = 440;

/**
 * The design level for a CHANGED shape: the default table's rules, with each
 * depth over the thalweg scaled by the flow's depth factor, and each held
 * level taken from the thalweg that holds it (the bend pool from the riffle
 * head at s = 140, the pool reach from the outlet sill at s = 272). At the
 * default shape these rules give the default table's own numbers: 1.65 + 0.6
 * = 2.25, 1.65 + 0.3 = 1.95 and 0.9 + 0.3 = 1.2. It only starts the solver
 * and places its ceiling; the drawn level is the solver's.
 */
function shapedDesignLevelAt(s: number): number {
  if (!shapedDesignTable) {
    const f = riverFlowDepthFactor();
    const bendHold = courseKeyAt(140).thalweg;
    const sill = courseKeyAt(272).thalweg;
    const t = new Float64Array(DESIGN_S1 - DESIGN_S0 + 1);
    let best = Infinity;
    for (let q = DESIGN_S0; q <= DESIGN_S1; q += 1) {
      const k = courseKeyAt(q);
      let lvl: number;
      if (q < 100) lvl = k.thalweg + 0.55 * f;
      else if (q < 142) lvl = Math.max(k.thalweg + 0.4 * f, bendHold + (q < 125 ? 0.6 : 0.3) * f);
      else if (q <= 272) lvl = Math.max(k.thalweg + 0.3 * f, sill + 0.3 * f);
      else lvl = k.thalweg + 0.3 * f;
      if (lvl < best) best = lvl;
      t[q - DESIGN_S0] = best;
    }
    shapedDesignTable = t;
  }
  const g = Math.max(0, Math.min(DESIGN_S1 - DESIGN_S0 - 1e-9, s - DESIGN_S0));
  const i = Math.floor(g);
  const T = shapedDesignTable;
  return T[i] + (T[Math.min(T.length - 1, i + 1)] - T[i]) * (g - i);
}

export function designLevelAt(s: number): number {
  if (activeShape !== RIVER_SHAPE_DEFAULT) return shapedDesignLevelAt(s);
  if (!designTable) {
    // Running minimum from upstream, on a 1 m step: the level never rises.
    const t = new Float64Array(DESIGN_S1 - DESIGN_S0 + 1);
    let best = Infinity;
    for (let q = DESIGN_S0; q <= DESIGN_S1; q += 1) {
      const k = courseKeyAt(q);
      let lvl: number;
      if (q < 100) lvl = k.thalweg + 0.55;
      // 2.5 since the bend head's rocks (rivers round 3) hold the bend pool
      // up by 0.2 m (a 430 s run: 2.54 to 2.62 m at s = 110 to 120).
      // (Round 3, recalibrated with the bend head's 52 rocks: the bend's
      // steady level falls from 2.62 m at s = 110 to 2.23 m at 140. The start
      // is held at 2.62 over the whole bend: a start ABOVE the steady level
      // drains in seconds, one below it fills at the inflow's pace, and a
      // sloped start left the run filling at 120 s.)
      // (Round 4, at 1.5 m^3/s: 2.25 m to s = 125, then 1.95 m.)
      else if (q < 142) lvl = Math.max(k.thalweg + 0.4, q < 125 ? 2.25 : 1.95);
      // The riffle's tail is drowned by the pool below it (the 430 s run has
      // 1.26 m at s = 170), so it never stands under the pool's level.
      else if (q < 166) lvl = Math.max(k.thalweg + 0.3, 1.2);
      else if (q <= 272) lvl = Math.max(k.thalweg + 0.3, 1.2);
      else lvl = k.thalweg + 0.3;
      if (lvl < best) best = lvl;
      t[q - DESIGN_S0] = best;
    }
    designTable = t;
  }
  const f = Math.max(0, Math.min(DESIGN_S1 - DESIGN_S0 - 1e-9, s - DESIGN_S0));
  const i = Math.floor(f);
  return designTable[i] + (designTable[Math.min(designTable.length - 1, i + 1)] - designTable[i]) * (f - i);
}

/**
 * THE ISLAND in the pool reach: an ellipse in (s, n) with a vegetated top and
 * gravel margins, off the center toward the left bank so the two channels
 * differ (the Nerang frame has a narrow left channel and a wide right one).
 */
// Rivers round 2: n 3.2 -> 2.4 and half width 3.6 -> 3.2, so the left
// channel stays 5 to 7 m wide under the ragged edge's wander (it had closed
// to 2 m and vanished behind the bank grass from the bridge).
export const RIVER_ISLAND = { s: 225, n: 2.4, halfLen: 22, halfWid: 3.2, top: 2.35 };

/** A boulder: an ellipsoid with its own shape seed. Heights in meters. */
export interface Boulder {
  x: number;
  z: number;
  /** Center height. The top is y + ry. */
  y: number;
  rx: number;
  ry: number;
  rz: number;
  /** Rotation about +y, radians. */
  rot: number;
  seed: number;
  /** True when the boulder stands in the wetted channel (it enters the solver bed). */
  inChannel: boolean;
  /**
   * Where it was placed on the judged course: the course distance s and the
   * signed offset n (m). The live editor moves it with its place when the
   * course moves or the channel widens. Absent in data cached before the editor.
   */
  s?: number;
  n?: number;
}

/**
 * THE LOW-WATER THREAD's center line (rivers round 4): its offset n from the
 * course line at s, m, for a channel of half width `halfW`. It wanders by
 * 0.28 and 0.1 of the half width at 115 m and 41 m wavelengths, so the thread
 * crosses from bank to bank between alternate bars, as a riffle-pool bed's
 * does. See `makeTerrainHeight`.
 */
export function threadCenterAt(s: number, halfW: number): number {
  return halfW * (0.28 * Math.sin(s * 0.05464 + 0.7) + 0.1 * Math.sin(s * 0.15325 + 2.1));
}

/** The thread's Gaussian half width (sigma), m, and how much higher the bed outside it stands, m. */
export const RIVER_THREAD = { sigma: 2.6, raise: 0.42, sEnd: 108, sFade: 10 };

/** Smooth step on [0, 1]. */
function smooth01(t: number): number {
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  return c * c * (3 - 2 * c);
}

/** Soft ramp: ~0 for e << 0, ~e for e >> 0, smooth over `w` meters. */
function softplus(e: number, w: number): number {
  return w * Math.log1p(Math.exp(e / w));
}

/**
 * THE OUTSIDE FIELDS: bank-top height, half width, floodplain width and hill
 * slope, on a 4 m lattice over the render domain.
 *
 * WHY. The first cut read these from the NEAREST course point. Between the two
 * arms of the S-bend the nearest point jumps from one arm to the other, and the
 * ground jumped with it: 15.3 m to 5.0 m across one cell at x = 150, z = 75.
 * Here each lattice value is an inverse-distance blend over the course
 * samples, with weights 1 / (d^2 + 16)^2, so it is continuous everywhere and
 * equal to the local value near the channel. A value that depends on the
 * bank side (the steep north mountainside) blends the two sides with a smooth
 * sign, tanh(n / 6 m), so the side change is continuous too.
 */
export class OutsideFields {
  private readonly step = 4;
  private readonly nx: number;
  private readonly nz: number;
  private readonly x0: number;
  private readonly z0: number;
  private readonly data: Float32Array;

  /** With `copyOf`, a copy of those fields (the live editor keeps the judged ones and edits a copy). */
  constructor(course: RiverCourse | null, copyOf?: OutsideFields) {
    const D = RIVER_RENDER_DOMAIN;
    this.x0 = D.x0;
    this.z0 = D.z0;
    this.nx = Math.ceil((D.x1 - D.x0) / this.step) + 1;
    this.nz = Math.ceil((D.z1 - D.z0) / this.step) + 1;
    if (copyOf) {
      this.data = copyOf.data.slice();
      return;
    }
    this.data = new Float32Array(this.nx * this.nz * 4);
    if (course) this.fill(course, 0, this.nx - 1, 0, this.nz - 1);
  }

  /** A copy of these fields. */
  clone(): OutsideFields {
    return new OutsideFields(null, this);
  }

  /**
   * THE LIVE EDITOR: compute the lattice points in a box (m) again for a
   * course and the key table as they are now. Each point is the same blend
   * over every course sample as the constructor's, so a box refreshed with
   * the judged course and no edit holds the judged values.
   */
  refresh(course: RiverCourse, x0: number, z0: number, x1: number, z1: number): void {
    const i0 = Math.max(0, Math.floor((x0 - this.x0) / this.step));
    const i1 = Math.min(this.nx - 1, Math.ceil((x1 - this.x0) / this.step));
    const j0 = Math.max(0, Math.floor((z0 - this.z0) / this.step));
    const j1 = Math.min(this.nz - 1, Math.ceil((z1 - this.z0) / this.step));
    if (i1 < i0 || j1 < j0) return;
    // The samples past 120 m weigh 2e-4 of the nearest one together (each
    // 1 / (d^2 + 16)^2) NEAR THE CHANNEL, so the refresh leaves them out: a
    // sixth of the work. The constructor blends every sample. AWAY FROM THE
    // CHANNEL the nearest sample weighs less, and the cut is larger: measured
    // 2026-09-29, the ground moves by up to 9.3 mm about 30 m from the channel
    // (an edit at point 9), and 11 mm for a width of 1.001. (The earlier note
    // here said under 1 mm.) An edit that keeps the judged course and widths
    // does not refresh: it copies the judged fields (copyBox), exactly.
    this.fill(course, i0, i1, j0, j1, 120 * 120);
  }

  /**
   * THE LIVE EDITOR: copy the lattice points in a box (m) from other fields
   * of the same domain (the judged ones). The node heights do not enter the
   * fields (they read the course's samples, bank tops and half widths only),
   * so a patch that keeps the judged course and widths keeps the judged
   * fields, bit for bit, where a refresh would blend them again with the
   * 120 m cut.
   */
  copyBox(from: OutsideFields, x0: number, z0: number, x1: number, z1: number): void {
    const i0 = Math.max(0, Math.floor((x0 - this.x0) / this.step));
    const i1 = Math.min(this.nx - 1, Math.ceil((x1 - this.x0) / this.step));
    const j0 = Math.max(0, Math.floor((z0 - this.z0) / this.step));
    const j1 = Math.min(this.nz - 1, Math.ceil((z1 - this.z0) / this.step));
    if (i1 < i0 || j1 < j0) return;
    for (let j = j0; j <= j1; j += 1) {
      const a = (j * this.nx + i0) * 4;
      const b = (j * this.nx + i1 + 1) * 4;
      this.data.set(from.data.subarray(a, b), a);
    }
  }

  private fill(course: RiverCourse, i0: number, i1: number, j0: number, j1: number, cutoff2 = Infinity): void {
    const pick = course.samples.filter((_, k) => k % 8 === 0);
    const keyVals = pick.map((smp) => courseKeyAt(smp.s));
    for (let j = j0; j <= j1; j += 1) {
      const z = this.z0 + j * this.step;
      for (let i = i0; i <= i1; i += 1) {
        const x = this.x0 + i * this.step;
        let wSum = 0;
        let bank = 0;
        let half = 0;
        let fpw = 0;
        let rate = 0;
        for (let k = 0; k < pick.length; k += 1) {
          const smp = pick[k];
          const dx = x - smp.x;
          const dz = z - smp.z;
          const d2 = dx * dx + dz * dz;
          if (d2 > cutoff2) continue;
          const w = 1 / ((d2 + 16) * (d2 + 16));
          const key = keyVals[k];
          // Left side (n > 0) weight from a smooth sign.
          const n = dx * smp.tz - dz * smp.tx;
          const left = 0.5 + 0.5 * Math.tanh(n / 6);
          const past = smooth01((smp.s - 150) / 40);
          // Left (north) bank of the boulder reach and bend: a narrow
          // floodplain under a 0.75 mountainside.
          // RIVERS ROUND 3: the right (south) bank of the boulder reach and
          // the bend is a 10 m boulder bar under a 0.7 forested canyon side
          // too (it was a 16 m lawn under a 0.3 slope). It is the far bank of
          // both Merced views, and in the clips it is a dark forested slope
          // that fills the frame's top third: the water mirrors it. In the
          // pool reach both banks close in (a 6 to 7 m bank under 0.35 to
          // 0.45 slopes) and carry the dense growth the Nerang frame shows
          // over its water.
          const fpL = 6 - 1 * past;
          const fpR = 10 - 3.5 * past;
          const rL = 0.75 - 0.3 * past;
          const rR = 0.7 - 0.35 * past;
          wSum += w;
          bank += w * key.bankTop;
          half += w * key.halfW;
          fpw += w * (left * fpL + (1 - left) * fpR);
          rate += w * (left * rL + (1 - left) * rR);
        }
        // (A point with no sample inside the cutoff keeps its values.)
        if (wSum === 0) continue;
        const o = (j * this.nx + i) * 4;
        this.data[o] = bank / wSum;
        this.data[o + 1] = half / wSum;
        this.data[o + 2] = fpw / wSum;
        this.data[o + 3] = rate / wSum;
      }
    }
  }

  /** Bilinear read of the four fields at (x, z). */
  read(x: number, z: number, out: Float64Array): void {
    const fx = Math.max(0, Math.min(this.nx - 1.001, (x - this.x0) / this.step));
    const fz = Math.max(0, Math.min(this.nz - 1.001, (z - this.z0) / this.step));
    const i = Math.floor(fx);
    const j = Math.floor(fz);
    const tx = fx - i;
    const tz = fz - j;
    const o00 = (j * this.nx + i) * 4;
    const o10 = o00 + 4;
    const o01 = o00 + this.nx * 4;
    const o11 = o01 + 4;
    const d = this.data;
    for (let c = 0; c < 4; c += 1) {
      const a = d[o00 + c] + (d[o10 + c] - d[o00 + c]) * tx;
      const b = d[o01 + c] + (d[o11 + c] - d[o01 + c]) * tx;
      out[c] = a + (b - a) * tz;
    }
  }
}

/**
 * THE GROUND HEIGHT without boulders, m, at any (x, z) of the render domain.
 *
 * Inside the channel (|n| < halfW): the cross-section, with the thalweg moved
 * toward the outer bank in a bend (the scour side) by up to 35 % of the half
 * width, and a 6 cm cobble roughness. Outside: a floodplain that rises 6 % for
 * 6 to 20 m, then the valley sides, all read from the smooth outside fields.
 * The left (north) bank of the boulder reach and the bend is a steep
 * mountainside, as in the Merced frames; the right (south) bank has a wider
 * floodplain where the bank-top camera stands. The two formulas blend over
 * t = 0.92 .. 1.12 of the half width, so the bank top has no step.
 */
export function makeTerrainHeight(course: RiverCourse, seed: number): (x: number, z: number) => number {
  const fields = new OutsideFields(course);
  const noise = { x: 0, z: 0, at(k: number): number { return terrainNoiseAt(this.x, this.z, seed, k); } };
  return (x: number, z: number): number => {
    noise.x = x;
    noise.z = z;
    return terrainHeightAt(course, fields, x, z, course.project(x, z), noise);
  };
}

/**
 * THE EIGHT NOISE FIELDS the ground reads at a point, each an fbm (scale,
 * seed offset, octaves). They depend on (x, z) and the seed only, so the live
 * editor computes them once per cell and reads them back for every edit (the
 * ground costs about 8 us a point with them, 0.4 us from the cache).
 */
export const RIVER_TERRAIN_NOISE: ReadonlyArray<readonly [number, number, number]> = [
  [0.1, 53, 2], // 0: the ragged edge's 10 m wander
  [0.45, 59, 2], // 1: the ragged edge's 2 m wander
  [0.6, 61, 2], // 2: the lumpy bed near the banks
  [0.5, 7, 3], // 3: the 6 cm cobble roughness
  [0.33, 19, 3], // 4: the bars and runs of the rocky reaches
  [0.15, 13, 3], // 5: the bank's own noise
  [0.015, 31, 4], // 6: the valley side's ridges and spurs
  [0.3, 41, 2], // 7: the island's top
];

/** One of the ground's noise fields at a point (see RIVER_TERRAIN_NOISE). */
export function terrainNoiseAt(x: number, z: number, seed: number, k: number): number {
  const q = RIVER_TERRAIN_NOISE[k];
  return fbm(x * q[0], z * q[0], seed + q[1], q[2]);
}

/** Where the ground reads its noise: computed on demand, or from the live editor's cache. */
export interface TerrainNoiseSource {
  at(k: number): number;
}

const outsideScratch = new Float64Array(4);

/**
 * THE GROUND HEIGHT at (x, z) from its parts: the course, the outside fields,
 * the point's projection on the course and its noise. `makeTerrainHeight`
 * is this with the projection and the noise computed at the point; the live
 * editor (riverLive.ts) calls it with cached parts and an edited course. The
 * arithmetic is the judged ground's, term for term.
 */
export function terrainHeightAt(
  course: RiverCourse,
  fields: OutsideFields,
  x: number,
  z: number,
  pr: { s: number; n: number; d: number },
  noise: TerrainNoiseSource,
): number {
  const f = outsideScratch;
  {
    const key = courseKeyAt(pr.s);
    const smp = course.at(pr.s);
    // The edit mode's local width at this s (1 with no edit, exact).
    const wl = activeCourseEdit ? riverWidthAt(pr.s) : 1;
    // Bend asymmetry: the scour side is the OUTER bank. curv > 0 turns left,
    // so the outer bank is on the right (n < 0) and the thalweg moves there.
    const asym = Math.max(-0.35, Math.min(0.35, -smp.curv * 18));
    const shift = asym * key.halfW;
    // A RAGGED EDGE. The cross-section wanders sideways by up to 2.5 m (a 10 m
    // and a 2 m scale), so the waterline has bays, points and small inlets
    // instead of the even ribbon three judges called a poured-concrete
    // spillway (round 1).
    // In the pool reach (s over 170) the wander drops to 40 %: its two
    // channels around the island are 3 to 5 m wide, and a full wander closed
    // the left one.
    const wanderK = 1 - 0.6 * smooth01((pr.s - 165) / 20);
    const wander = wanderK * (2.0 * noise.at(0) + 0.55 * noise.at(1));
    // Map n to a 0..1 lateral coordinate with the thalweg at `shift`.
    const nRel = pr.n - shift + wander;
    const sideHalf = nRel >= 0 ? key.halfW - shift : key.halfW + shift;
    const t = Math.abs(nRel) / Math.max(1, sideHalf);
    // BED RELIEF: 6 cm of cobble roughness everywhere, and in the boulder
    // reach, the bend and the riffle (s under 170 m) bars and runs of
    // +-0.16 m at a 3 m scale, so the low flow splits into channels between
    // rock bars as it does in the Merced frames.
    const rocky = 1 - smooth01((pr.s - 150) / 20);
    // Near the banks (t over 0.55) the bed is lumpier: gravel bars, cobble
    // points and small hollows, +-0.2 m at a 1.7 m scale, so the edge of the
    // water is broken along its length.
    const edgeLump = 0.2 * noise.at(2) * smooth01((t - 0.55) / 0.35);
    const rough = 0.06 * noise.at(3) + 0.16 * rocky * noise.at(4) + edgeLump;
    // The inner side of a bend is a shallow gravel bar: a gentler shape.
    const inner = (nRel >= 0) === (asym < 0) ? 1 : 0;
    const p = key.shapeP * (1 - 0.45 * inner * Math.abs(asym) / 0.35);
    const tIn = Math.min(1, t);
    let yIn = key.thalweg + (key.bankTop - key.thalweg) * Math.pow(tIn, Math.max(1.2, p)) + rough;
    // THE LOW-WATER THREAD (rivers round 4). At low summer water the Merced
    // runs in one thread a few meters wide that wanders from side to side of
    // its boulder bed, with bars of rock between it and the banks (the clips:
    // water is 28 to 46 % of the channel). Round 3's shallow U spread any flow
    // over two thirds of the bed. Here the bed outside the thread stands
    // 0.42 m higher (none at the bank top, so the banks keep their height),
    // and the thread keeps the U's own bed: a Gaussian of 2.6 m (sigma) about
    // `threadCenterAt`. Only in the boulder reach and the bend head (s under
    // 108 m, gone by 118 m): the bend pool and the riffle keep their shape.
    // THE NODE HEIGHTS (the live editor, 2026-09-29): the mound of the bed's
    // rise at this s. With no height the ground is the judged one, exactly.
    if (activeHasHeights) {
      const hz = riverHeightAt(pr.s);
      if (hz !== 0) yIn += hz * riverMoundAt(tIn);
    }
    const T = RIVER_THREAD;
    const threadK = 1 - smooth01((pr.s - T.sEnd) / T.sFade);
    if (threadK > 0) {
      const dn = nRel - threadCenterAt(pr.s, key.halfW);
      // The thread's width and raise follow the shape and the edit's local
      // width (a scale of 1 is exact).
      const sig = T.sigma * activeShape.widthScale * wl;
      const g = Math.exp(-(dn * dn) / (2 * sig * sig));
      yIn += threadK * T.raise * activeShape.depthScale * (1 - g) * (1 - smooth01((t - 0.75) / 0.25));
    }
    const wOut = smooth01((t - 0.92) / 0.2);
    let y = yIn;
    if (wOut > 0) {
      fields.read(x, z, f);
      const bankTop = f[0];
      const dd = Math.max(0, pr.d - f[1]);
      const fpw = f[2];
      const rate = f[3];
      const e = dd - fpw;
      const fp = 0.06 * Math.min(dd, fpw) + 0.2 * smooth01(dd / 1.2);
      // The valley side rises at `rate` and levels off toward a crest height
      // that goes with it: 160 m over a 0.75 mountainside, 40 m over a 0.3
      // slope (the first cut grew as e^2 and reached 931 m at the domain's
      // corner). Ridges and spurs come from the noise, up to 12 m.
      const crest = 40 + 120 * Math.max(0, rate - 0.3) / 0.45;
      const hill = crest * (1 - Math.exp(-(rate * softplus(e, 3)) / crest));
      const hillNoise = (3 + 5 * smooth01(e / 120)) * noise.at(6) * smooth01(e / 30);
      const bankNoise = 0.35 * noise.at(5) * smooth01(dd / 3);
      const yOut = bankTop + fp + hill + hillNoise + bankNoise + rough;
      y = yIn + (yOut - yIn) * wOut;
    }
    // The island: an ellipse in (s, n), a smooth dome to its top with gravel margins.
    const I = RIVER_ISLAND;
    const es = (pr.s - I.s) / I.halfLen;
    const en = (pr.n - I.n * activeShape.widthScale * wl) / (I.halfWid * activeShape.widthScale * wl);
    const e2 = es * es + en * en;
    // The dome falls continuously until it is under the channel floor: the
    // first cut stopped at e = 2.2, where the dome still stood 1.9 m over the
    // floor, and that underwater wall drew a dark line down the pool.
    if (e2 < 7) {
      // Flanks near gravel's angle (round 7 fell 2.2 (e - 0.55)^1.2 and the
      // island stood like a wall, 60 degrees): a soft crown to e = 1.8 (a
      // little under the water line), then a straight slope of 0.8 per unit
      // of e (about 27 degrees across the island) down to the pool floor.
      const eC = Math.min(e2, 1.8);
      let dome = I.top - 1.2 * Math.pow(Math.max(0, eC - 0.55), 1.3) - 0.8 * Math.max(0, e2 - 1.8);
      dome += 0.12 * noise.at(7);
      y = Math.max(y, Math.min(I.top + 0.1, dome));
    }
    return y;
  }
}

/** Top height of one boulder at (x, z), or -Infinity outside it. */
export function boulderTopAt(b: Boulder, x: number, z: number): number {
  const c = Math.cos(b.rot);
  const s = Math.sin(b.rot);
  const lx = (x - b.x) * c + (z - b.z) * s;
  const lz = -(x - b.x) * s + (z - b.z) * c;
  const q = 1 - (lx / b.rx) ** 2 - (lz / b.rz) ** 2;
  if (q <= 0) return -Infinity;
  return b.y + b.ry * Math.sqrt(q);
}

/**
 * THE BOULDERS. Four groups, placed with a seeded generator and a spacing
 * rule (two boulders never overlap past 85 % of their radii):
 *   - 250 in the boulder reach bed, from 55 m upstream of the judged reach
 *     (radius 0.38 to 1.5 m; the mix is weighted to small ones, as a boulder
 *     bed is);
 *   - 230 on the banks of the boulder reach and the bend, from 70 m upstream
 *     of the judged reach (the Merced banks are boulder fields);
 *   - the spur: 3 large boulders (radius 1.9 to 2.6 m) at the inner (right)
 *     bank of the bend entrance. They reach 3 to 4 m into the channel, and the
 *     water behind them turns back into an eddy;
 *   - 20 small ones in the riffle, mostly just under the surface, and 10 along
 *     the pool banks.
 */
export function placeBoulders(course: RiverCourse, terrain: (x: number, z: number) => number, seed: number): Boulder[] {
  const rnd = mulberry32(seed ^ 0x5bd1e995);
  const out: Boulder[] = [];
  const fits = (x: number, z: number, r: number): boolean => {
    for (const b of out) {
      const rr = Math.max(b.rx, b.rz);
      if ((b.x - x) ** 2 + (b.z - z) ** 2 < (0.85 * (rr + r)) ** 2) return false;
    }
    return true;
  };
  const add = (s: number, n: number, r: number, emerge: number, inChannel: boolean): void => {
    const smp = course.at(s);
    // Left normal (tz, -tx).
    const x = smp.x + smp.tz * n;
    const z = smp.z - smp.tx * n;
    if (!fits(x, z, r)) return;
    const ground = terrain(x, z);
    const ry = r * (0.55 + 0.25 * rnd());
    // `emerge` is how far the TOP stands over the bed-relative reference; a
    // boulder sits 20 to 45 % buried in the bed.
    const y = ground + emerge - ry;
    out.push({
      x, z, y, rx: r * (0.9 + 0.3 * rnd()), ry, rz: r * (0.85 + 0.3 * rnd()),
      rot: rnd() * Math.PI, seed: Math.floor(rnd() * 1e9), inChannel, s, n,
    });
  };
  // The spur first, so the spacing rule never drops it for a smaller boulder.
  // It stands at the inner (right) bank of the bend entrance.
  add(101, -8.4, 2.6, 2.3, true);
  add(105.5, -7.0, 2.2, 2.0, true);
  add(98, -10.2, 1.9, 1.8, true);
  // Boulder reach bed, from 55 m upstream of the judged reach: 250 of them,
  // most 0.4 to 0.9 m (a Merced boulder bed is dense and mostly small).
  for (let tries = 0; tries < 3000 && out.length < 3 + 250; tries += 1) {
    const s = -55 + rnd() * 151;
    const key = courseKeyAt(s);
    const n = (rnd() * 2 - 1) * key.halfW * 0.92;
    const u = rnd();
    const r = 0.38 + 1.1 * u * u * u;
    // Tops from 0.25 m under the reach's water to 1.1 m over it (the reach
    // stands about 0.35 m deep on its floor).
    const emerge = r * (0.75 + 0.5 * rnd());
    add(s, n, r, emerge, true);
  }
  // Riffle.
  for (let tries = 0; tries < 400 && out.length < 253 + 20; tries += 1) {
    const s = 141 + rnd() * 24;
    const key = courseKeyAt(s);
    const n = (rnd() * 2 - 1) * key.halfW * 0.85;
    const r = 0.28 + 0.45 * rnd();
    const emerge = r * (0.55 + 0.45 * rnd());
    add(s, n, r, emerge, true);
  }
  // POOL-REACH ROCKS IN THE WATER: 16 rocks at the margins of the pool reach
  // and around the island's head, their tops 0.1 to 0.5 m over the water, so
  // the calm reach has rocks that break its surface, wet stains and a
  // waterline on each (round 1: "no rocks in the stream: a still canal").
  const poolRocks = (): void => {
    let k = 0;
    for (let tries = 0; tries < 400 && k < 16; tries += 1) {
      const sPos = 188 + rnd() * 80;
      const key = courseKeyAt(sPos);
      const side = rnd() < 0.5 ? -1 : 1;
      const nPos = side * key.halfW * (0.5 + 0.35 * rnd());
      const r = 0.45 + 0.8 * rnd();
      const smp = course.at(sPos);
      const x = smp.x + smp.tz * nPos;
      const z = smp.z - smp.tx * nPos;
      if (!fits(x, z, r)) continue;
      const ry = r * (0.5 + 0.25 * rnd());
      const top = designLevelAt(sPos) + 0.1 + 0.4 * rnd();
      const ground = terrain(x, z);
      // Only where the ground under it is in the water, 0.15 to 1.2 m deep.
      const dep = designLevelAt(sPos) - ground;
      if (dep < 0.15 || dep > 1.2) continue;
      out.push({
        x, z, y: top - ry, rx: r * (0.9 + 0.3 * rnd()), ry, rz: r * (0.85 + 0.3 * rnd()),
        rot: rnd() * Math.PI, seed: Math.floor(rnd() * 1e9), inChannel: true, s: sPos, n: nPos,
      });
      k += 1;
    }
  };
  // Pool banks.
  for (let tries = 0; tries < 200 && out.length < 273 + 10; tries += 1) {
    const s = 184 + rnd() * 80;
    const key = courseKeyAt(s);
    const side = rnd() < 0.5 ? -1 : 1;
    const n = side * key.halfW * (0.85 + 0.2 * rnd());
    const r = 0.6 + 0.9 * rnd();
    add(s, n, r, r * (0.8 + 0.4 * rnd()), true);
  }
  // Banks of the boulder reach and the bend.
  for (let tries = 0; tries < 3500 && out.length < 283 + 230; tries += 1) {
    const s = -70 + rnd() * 210;
    const key = courseKeyAt(s);
    const side = rnd() < 0.5 ? -1 : 1;
    const n = side * (key.halfW * 0.9 + rnd() * 9);
    const u = rnd();
    const r = 0.35 + 1.4 * u * u;
    add(s, n, r, r * (0.7 + 0.5 * rnd()), Math.abs(n) < key.halfW);
  }
  // Last, so the groups above keep the draws (and the places) of round 1.
  poolRocks();
  // THE BEND HEAD'S ROCKS (rivers round 3): 52 rocks in the fast water from
  // s = 82 to 128, where the boulder reach turns into the bend. Round 2 had
  // only the spur there, and a judge saw "no rocks break the surface and no
  // white water runs over stones". Three in four stand out of the water
  // (white water starts at their faces); the rest lie 0.05 to 0.3 m under it
  // (they boil the surface and show through it).
  // The tops are set 0.3 m over the DESIGN level: the rocks' own drag holds
  // the solved water about 0.3 m over the design level here, and with tops at
  // 0.05 to 0.45 m over the design level, 25 of the 52 were under the solved
  // water (r3/emergeProbe.mts).
  {
    let k = 0;
    for (let tries = 0; tries < 1400 && k < 52; tries += 1) {
      const sPos = 82 + rnd() * 46;
      const key = courseKeyAt(sPos);
      const nPos = (rnd() * 2 - 1) * key.halfW * 0.8;
      const u = rnd();
      const r = 0.35 + 0.8 * u * u;
      const smp = course.at(sPos);
      const x = smp.x + smp.tz * nPos;
      const z = smp.z - smp.tx * nPos;
      if (!fits(x, z, r)) continue;
      const lvl = designLevelAt(sPos);
      const ground = terrain(x, z);
      if (lvl - ground < 0.12) continue;
      const ry = r * (0.5 + 0.25 * rnd());
      // (Round 4: the design level at 1.5 m^3/s is within 0.15 m of the
      // solved level here, so the tops are 0.08 to 0.48 m over it again, or
      // 0.05 to 0.25 m under it.)
      const top = rnd() < 0.75 ? lvl + 0.08 + 0.4 * rnd() : lvl - 0.05 - 0.2 * rnd();
      // A rock must sit on the bed: its bottom under the ground.
      if (top - 2 * ry > ground) continue;
      out.push({
        x, z, y: top - ry, rx: r * (0.9 + 0.35 * rnd()), ry, rz: r * (0.8 + 0.35 * rnd()),
        rot: rnd() * Math.PI, seed: Math.floor(rnd() * 1e9), inChannel: true, s: sPos, n: nPos,
      });
      k += 1;
    }
  }
  // THE LOW-WATER ROCK FIELD (rivers round 4): 2,000 rocks of 0.22 to 0.97 m
  // radius over the bed and the bars of the boulder reach and the bend head
  // (s = -50 to 132), most of them small, their tops 0.55 to 1.15 radii over
  // the ground. At low summer water the Merced clips show a bed PACKED with
  // rocks and cobbles, hundreds in each frame, and the water runs in threads,
  // pools and short drops between them; round 3's 250 bed boulders over
  // 3,300 m^2 left one broad sheet of water with rocks dotted in it. Three in
  // four of the rocks drawn in the thread itself are skipped (the flow moves
  // them out onto the bars; with all of them the thread ponded 0.8 m deep).
  // Rocks of 0.3 m and more turn the solver's flow (a 0.5 m cell); smaller
  // ones are drawn and shape the surface through the flow map's rock
  // features. Last, so every group above keeps its draws.
  {
    let k = 0;
    for (let tries = 0; tries < 12000 && k < 2000; tries += 1) {
      const sPos = -50 + rnd() * 182;
      const key = courseKeyAt(sPos);
      const nPos = (rnd() * 2 - 1) * (key.halfW + 7);
      const u = rnd();
      const r = 0.22 + 0.75 * u * u;
      const emerge = r * (0.55 + 0.6 * rnd());
      const inThread = Math.abs(nPos - threadCenterAt(sPos, key.halfW)) < 3.5 * activeShape.widthScale && sPos < RIVER_THREAD.sEnd + 5;
      if (inThread && rnd() < 0.75) continue;
      const before = out.length;
      add(sPos, nPos, r, emerge, Math.abs(nPos) < key.halfW);
      if (out.length > before) k += 1;
    }
  }
  // HALF-SUNK STONES AT THE POOL'S MARGINS (rivers round 4): 140 stones of
  // 0.15 to 0.5 m radius along both banks of the pool reach and the island
  // (s = 172 to 268), where the ground lies 0.02 to 0.45 m under the pool's
  // level, their tops from 0.08 m under the water to 0.15 m over it. A judge
  // read the calm-bridge bank as "a smooth, clean contour, with the stones
  // dry above it: no half-sunk stones"; the Nerang's margins are stones
  // half in the water. Last, so every group above keeps its draws.
  {
    let k = 0;
    for (let tries = 0; tries < 3000 && k < 140; tries += 1) {
      const sPos = 172 + rnd() * 96;
      const key = courseKeyAt(sPos);
      const side = rnd() < 0.5 ? -1 : 1;
      const nPos = side * key.halfW * (0.45 + 0.55 * rnd());
      const r = 0.15 + 0.35 * rnd() * rnd();
      const smp = course.at(sPos);
      const x = smp.x + smp.tz * nPos;
      const z = smp.z - smp.tx * nPos;
      const lvl = designLevelAt(sPos);
      const ground = terrain(x, z);
      const dep = lvl - ground;
      const ry = r * (0.5 + 0.25 * rnd());
      const top = lvl - 0.08 + 0.23 * rnd();
      const rot = rnd() * Math.PI;
      const seed = Math.floor(rnd() * 1e9);
      if (dep < 0.02 || dep > 0.45 || !fits(x, z, r)) continue;
      // A stone must sit on the bed: its bottom under the ground.
      if (top - 2 * ry > ground) continue;
      out.push({ x, z, y: top - ry, rx: r * (0.9 + 0.3 * ((seed >>> 3) % 100) / 100), ry, rz: r * (0.85 + 0.3 * ((seed >>> 9) % 100) / 100), rot, seed, inChannel: true, s: sPos, n: nPos });
      k += 1;
    }
  }
  return out;
}

export interface RiverReach {
  readonly seed: number;
  readonly grid: RiverGridSpec;
  readonly course: RiverCourse;
  readonly terrainHeight: (x: number, z: number) => number;
  readonly boulders: Boulder[];
  /** Ground height at each solver cell center, without boulders, m (index j * nx + i). */
  readonly ground: Float64Array;
  /** The solver's bed: the ground raised by every boulder top, m. */
  readonly bed: Float64Array;
  /** Course arc length s at each cell center, m. */
  readonly cellS: Float32Array;
  /** Signed lateral offset n at each cell center, m. */
  readonly cellN: Float32Array;
  /** Manning n at each cell, s/m^(1/3). */
  readonly manning: Float32Array;
  readonly dischargeM3S: number;
}

/**
 * BUILD THE REACH. Everything the flow solver and the scene need, from one
 * seed. The default seed (20260928) is the judged scene's.
 */
export function buildRiverReach(seed = 20260928, grid: RiverGridSpec = RIVER_GRID): RiverReach {
  // A course edit reaches the ground as the live editor's bed patch
  // (riverLive.ts), over the judged reach; a build with an edit active would
  // be a second, different ground for the same edit.
  if (activeCourseEdit) throw new Error('[river] buildRiverReach builds the judged course. Apply a course edit with LiveRiver.applyEdit.');
  const course = defaultRiverCourse();
  const terrainHeight = makeTerrainHeight(course, seed);
  const boulders = placeBoulders(course, terrainHeight, seed);
  const n = grid.nx * grid.nz;
  const ground = new Float64Array(n);
  const bed = new Float64Array(n);
  const cellS = new Float32Array(n);
  const cellN = new Float32Array(n);
  const manning = new Float32Array(n);
  for (let j = 0; j < grid.nz; j += 1) {
    const z = grid.z0 + (j + 0.5) * grid.dx;
    for (let i = 0; i < grid.nx; i += 1) {
      const x = grid.x0 + (i + 0.5) * grid.dx;
      const c = j * grid.nx + i;
      const g = terrainHeight(x, z);
      ground[c] = g;
      bed[c] = g;
      const pr = course.project(x, z);
      cellS[c] = pr.s;
      cellN[c] = pr.n;
      manning[c] = courseKeyAt(pr.s).manning;
    }
  }
  for (const b of boulders) {
    if (!b.inChannel) continue;
    const r = Math.max(b.rx, b.rz);
    const i0 = Math.max(0, Math.floor((b.x - r - grid.x0) / grid.dx));
    const i1 = Math.min(grid.nx - 1, Math.ceil((b.x + r - grid.x0) / grid.dx));
    const j0 = Math.max(0, Math.floor((b.z - r - grid.z0) / grid.dx));
    const j1 = Math.min(grid.nz - 1, Math.ceil((b.z + r - grid.z0) / grid.dx));
    for (let j = j0; j <= j1; j += 1) {
      for (let i = i0; i <= i1; i += 1) {
        const top = boulderTopAt(b, grid.x0 + (i + 0.5) * grid.dx, grid.z0 + (j + 0.5) * grid.dx);
        const c = j * grid.nx + i;
        if (top > bed[c]) bed[c] = top;
      }
    }
  }
  return {
    seed, grid, course, terrainHeight, boulders, ground, bed, cellS, cellN, manning,
    dischargeM3S: activeShape.dischargeM3S,
  };
}
