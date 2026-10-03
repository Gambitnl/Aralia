/**
 * @file oceanWakeBoat.ts — the hull that makes the wake: a procedural stern
 * trawler that rides the sea on its course.
 *
 * WHAT IT IS. A lofted hull built from the same waterline the wake's foam
 * reads (`hullHalfBreadth` in oceanWakeMath.ts), so the white water hugs
 * the hull that is drawn: a raked, flared bow, a sheer that rises forward,
 * a raked transom, a bulwark, a wheelhouse, a mast and a stern gantry. Its
 * paint (antifouling, topsides, a sheer stripe) is vertex color.
 *
 * HOW IT RIDES. Each frame one compute invocation reads the sea's own
 * displacement buffers at 15 points of the waterplane (with the
 * displacement inversion the buoyancy probe uses, so the height is the
 * surface ABOVE each point) and fits a plane: heave, pitch and roll. The
 * hull's vertex stage reads the fit from a storage buffer, so the hull sits
 * on the water drawn in the same frame, with no readback and no lag. It is
 * a pure function of (seed, time, course): a pinned capture reproduces.
 *
 * WHY A FIT AND NOT A FLOATING BODY. The wake needs a hull on a course at a
 * set speed; `oceanBuoyancy.ts` floats a free body. A 30 m hull averages the
 * short waves over its waterplane and follows the long ones, which is what
 * the fit gives. What it does not give is inertia: a real hull lags the
 * swell and overshoots it. Still open; the buoyancy piece's bodies have it.
 *
 * LIGHT. Unlit node material with its own sun and sky terms (the same
 * irradiance values the buoys' lights use: sun 7, sky 1.6 of the haze
 * color), so mounting the wake adds no light to the scene and leaves the
 * other pieces' lighting alone.
 */
import * as THREE from 'three/webgpu';
import {
  Fn,
  If,
  attribute,
  cameraPosition,
  clamp,
  dot,
  float,
  frontFacing,
  instanceIndex,
  int,
  max,
  mix,
  modelWorldMatrix,
  normalLocal,
  normalize,
  positionLocal,
  pow,
  select,
  sqrt,
  storage,
  uniform,
  uniformArray,
  varying,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import { StorageBufferAttribute } from 'three/webgpu';
import type { OceanField } from './oceanField';
import { createOceanSampler } from './oceanSampler';
import { OCEAN_SUN_DIR } from './oceanSky';
import { hullHalfBreadth, type WakeCoursePoint, type WakeHull } from './oceanWakeMath';

/** A TSL node expression. See `oceanSurface.ts` for why this is `any`. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TslNode = any;

export interface WakeBoat {
  readonly group: THREE.Group;
  /** Put the hull on the course point and fit it to the sea. Enqueues one dispatch. */
  update(renderer: THREE.WebGPURenderer, p: WakeCoursePoint): void;
  /** (heave m, pitch slope, roll slope, 0) of the last fit. */
  readonly pose: StorageBufferAttribute;
  /** The fit's dispatch list, for a timing probe. */
  readonly dispatchList: readonly unknown[];
  dispose(): void;
}

/** Iterations of the displacement inversion; oceanBuoyancyProbe.ts uses four. */
const INVERSION_ITERATIONS = 4;

/**
 * Freeboard at the transom and the rise of the sheer to the stem, meters.
 * A stern trawler works its gear over a low aft deck and carries a high
 * forecastle: 1.7 m aft, 3.4 m at the stem.
 */
const FREEBOARD_AFT_M = 1.7;
const SHEER_RISE_M = 1.7;
/** Stem rake at deck height and transom rake, meters. */
const STEM_RAKE_M = 2.2;
const TRANSOM_RAKE_M = 0.35;
/** Bulwark height above the deck edge, meters. */
const BULWARK_M = 0.9;

/**
 * Paint, linear RGB: red antifouling under a black boot-top, navy topsides
 * with a white sheer stripe, a white bulwark inside, a grey-green steel
 * deck, a white house with a black window band, a red funnel, orange gear.
 * The colors of a North Sea stern trawler; nothing here is measured.
 */
const PAINT = {
  bottom: [0.30, 0.04, 0.028],
  boot: [0.018, 0.018, 0.02],
  topside: [0.018, 0.045, 0.085],
  stripe: [0.78, 0.78, 0.75],
  inner: [0.55, 0.56, 0.54],
  rail: [0.70, 0.70, 0.68],
  deck: [0.07, 0.085, 0.075],
  house: [0.74, 0.74, 0.72],
  glass: [0.012, 0.016, 0.02],
  roof: [0.36, 0.37, 0.36],
  funnel: [0.42, 0.045, 0.03],
  black: [0.02, 0.02, 0.022],
  gear: [0.62, 0.28, 0.025],
  drum: [0.05, 0.16, 0.07],
  mast: [0.66, 0.66, 0.64],
} as const;

type Rgb = readonly [number, number, number] | readonly number[];

/** A growing triangle soup with per-vertex color. */
class Soup {
  readonly pos: number[] = [];
  readonly col: number[] = [];
  tri(a: number[], b: number[], c: number[], ca: Rgb, cb: Rgb = ca, cc: Rgb = ca): void {
    this.pos.push(...a, ...b, ...c);
    this.col.push(...ca, ...cb, ...cc);
  }
  quad(a: number[], b: number[], c: number[], d: number[], ca: Rgb, cb: Rgb = ca, cc: Rgb = ca, cd: Rgb = ca): void {
    this.tri(a, b, c, ca, cb, cc);
    this.tri(a, c, d, ca, cc, cd);
  }
  /** An axis-aligned box, faces outward, one color per face group. */
  box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, side: Rgb, top: Rgb = side): void {
    const p = (x: number, y: number, z: number) => [x, y, z];
    this.quad(p(x0, y1, z0), p(x0, y1, z1), p(x1, y1, z1), p(x1, y1, z0), top);
    this.quad(p(x0, y0, z1), p(x1, y0, z1), p(x1, y1, z1), p(x0, y1, z1), side);
    this.quad(p(x1, y0, z0), p(x0, y0, z0), p(x0, y1, z0), p(x1, y1, z0), side);
    this.quad(p(x1, y0, z1), p(x1, y0, z0), p(x1, y1, z0), p(x1, y1, z1), side);
    this.quad(p(x0, y0, z0), p(x0, y0, z1), p(x0, y1, z1), p(x0, y1, z0), side);
  }
  /**
   * An octagonal prism (a drum, a canister): center (cx, cy, cz), radius r,
   * length len along `axis` ('x' or 'z').
   */
  prism(cx: number, cy: number, cz: number, r: number, len: number, col: Rgb, axis: 'x' | 'z'): void {
    const n = 10;
    const ring = (sgn: number) => {
      const out: number[][] = [];
      for (let k = 0; k < n; k += 1) {
        const a = (2 * Math.PI * k) / n;
        const dy = r * Math.sin(a);
        const dq = r * Math.cos(a);
        out.push(axis === 'z' ? [cx + dq, cy + dy, cz + (sgn * len) / 2] : [cx + (sgn * len) / 2, cy + dy, cz + dq]);
      }
      return out;
    };
    const A = ring(-1);
    const B = ring(1);
    const cA = axis === 'z' ? [cx, cy, cz - len / 2] : [cx - len / 2, cy, cz];
    const cB = axis === 'z' ? [cx, cy, cz + len / 2] : [cx + len / 2, cy, cz];
    for (let k = 0; k < n; k += 1) {
      const k1 = (k + 1) % n;
      this.quad(A[k], A[k1], B[k1], B[k], col);
      this.tri(cA, A[k1], A[k], col);
      this.tri(cB, B[k], B[k1], col);
    }
  }
  geometry(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeVertexNormals();
    return g;
  }
}

/** Keel depth at xi (the forefoot rises to the stem, the run to the transom). */
function keelDepth(hull: WakeHull, xi: number): number {
  const t = hull.draftM;
  if (xi > 0.5) return t * (1 - 0.62 * ((xi - 0.5) / 0.5) ** 2);
  if (xi < -0.7) return t * (1 - 0.5 * ((-0.7 - xi) / 0.3));
  return t;
}

/** Freeboard at xi. */
function freeboard(xi: number): number {
  const s = Math.min(Math.max((xi + 0.2) / 1.2, 0), 1);
  return FREEBOARD_AFT_M + SHEER_RISE_M * s * s;
}

/** The hull's surface point at station xi and height y, starboard (+z). */
function hullPoint(hull: WakeHull, xi: number, y: number): number[] {
  const L = hull.lengthM;
  const tk = keelDepth(hull, xi);
  const fb = freeboard(xi);
  const b = hullHalfBreadth(hull, Math.min(xi, 0.9995));
  let z: number;
  if (y <= 0) {
    const r = Math.min(-y / tk, 1);
    z = b * Math.pow(Math.max(1 - r ** 3, 0), 1 / 3);
  } else {
    // Flare: the topsides open out, most at the bow.
    const flare = 0.1 + 0.9 * Math.max(0, xi) ** 1.5;
    const bd = b + flare * 0.9 * Math.min(y / fb, 1.4) ** 1.2;
    z = Math.min(bd, hull.beamM / 2 + 0.25);
  }
  let x = (xi * L) / 2;
  const fwd = Math.max(0, xi) ** 3;
  if (y > 0) x += fwd * STEM_RAKE_M * Math.min(y / fb, 1.3);
  else x -= fwd * 1.2 * Math.min(-y / tk, 1);
  if (xi <= -0.999) x -= TRANSOM_RAKE_M * Math.max(y, 0) / fb;
  return [x, y, z];
}

/** Paint by height above the waterline. */
function paintAt(y: number, fb: number): Rgb {
  if (y < -0.05) return PAINT.bottom;
  if (y < 0.4) return PAINT.boot;
  if (y > fb - 0.45 && y < fb - 0.25) return PAINT.stripe;
  return PAINT.topside;
}

/** Build the trawler, in its own frame: +X forward, +Y up, +Z starboard, waterline at y = 0. */
export function buildTrawlerGeometry(hull: WakeHull): THREE.BufferGeometry {
  const s = new Soup();
  const NS = 56;
  const NY = 18;
  const xis: number[] = [];
  for (let i = 0; i <= NS; i += 1) {
    // Denser toward the stem, where the shape turns fastest.
    const u = i / NS;
    xis.push(-1 + 2 * (1 - (1 - u) ** 1.35));
  }
  const heights = (xi: number) => {
    const tk = keelDepth(hull, xi);
    const top = freeboard(xi) + BULWARK_M;
    const ys: number[] = [];
    for (let j = 0; j <= NY; j += 1) {
      const g = j / NY;
      ys.push(-tk + (top + tk) * g);
    }
    return ys;
  };
  // Hull sides, both sides; the bulwark is the side carried up.
  for (let i = 0; i < NS; i += 1) {
    const ya = heights(xis[i]);
    const yb = heights(xis[i + 1]);
    for (let j = 0; j < NY; j += 1) {
      const a = hullPoint(hull, xis[i], ya[j]);
      const b = hullPoint(hull, xis[i + 1], yb[j]);
      const c = hullPoint(hull, xis[i + 1], yb[j + 1]);
      const d = hullPoint(hull, xis[i], ya[j + 1]);
      const fa = freeboard(xis[i]);
      const col = (p: number[]) => (p[1] > freeboard(xis[i]) + BULWARK_M - 0.12 ? PAINT.stripe : paintAt(p[1], fa));
      s.quad(a, b, c, d, col(a), col(b), col(c), col(d));
      const m = (p: number[]) => [p[0], p[1], -p[2]];
      s.quad(m(a), m(d), m(c), m(b), col(a), col(d), col(c), col(b));
    }
  }
  // Keel line: close the bottom between the two sides.
  for (let i = 0; i < NS; i += 1) {
    const a = hullPoint(hull, xis[i], -keelDepth(hull, xis[i]));
    const b = hullPoint(hull, xis[i + 1], -keelDepth(hull, xis[i + 1]));
    s.quad([a[0], a[1], -a[2]], [b[0], b[1], -b[2]], b, a, PAINT.bottom);
  }
  // Deck: at the freeboard, edge to edge, slight camber.
  for (let i = 0; i < NS; i += 1) {
    const fa = freeboard(xis[i]);
    const fbb = freeboard(xis[i + 1]);
    const a = hullPoint(hull, xis[i], fa);
    const b = hullPoint(hull, xis[i + 1], fbb);
    const camber = 0.12;
    s.quad([a[0], fa, -a[2]], [a[0], fa + camber, 0], [b[0], fbb + camber, 0], [b[0], fbb, -b[2]], PAINT.deck);
    s.quad([a[0], fa + camber, 0], [a[0], fa, a[2]], [b[0], fbb, b[2]], [b[0], fbb + camber, 0], PAINT.deck);
  }
  // Transom: a fan from the stern section's center.
  {
    const ys = heights(-1);
    const cy = (ys[0] + ys[ys.length - 1]) / 2;
    const c = hullPoint(hull, -1, cy);
    const center = [c[0], cy, 0];
    for (let j = 0; j < NY; j += 1) {
      const a = hullPoint(hull, -1, ys[j]);
      const b = hullPoint(hull, -1, ys[j + 1]);
      const col = paintAt(ys[j], freeboard(-1));
      s.tri(center, [b[0], b[1], b[2]], [a[0], a[1], a[2]], col);
      s.tri(center, [a[0], a[1], -a[2]], [b[0], b[1], -b[2]], col);
    }
  }
  // Bulwark: the inner face, a hand's breadth inside the outer plating, and
  // the rail capping both.
  for (let i = 0; i < NS; i += 1) {
    const fa = freeboard(xis[i]);
    const fbb = freeboard(xis[i + 1]);
    if (xis[i] < -0.985) continue;
    const a0 = hullPoint(hull, xis[i], fa);
    const b0 = hullPoint(hull, xis[i + 1], fbb);
    const a1 = hullPoint(hull, xis[i], fa + BULWARK_M);
    const b1 = hullPoint(hull, xis[i + 1], fbb + BULWARK_M);
    const inset = 0.12;
    const ia0 = [a0[0], a0[1], Math.max(a0[2] - inset, 0)];
    const ib0 = [b0[0], b0[1], Math.max(b0[2] - inset, 0)];
    const ia1 = [a1[0], a1[1], Math.max(a1[2] - inset, 0)];
    const ib1 = [b1[0], b1[1], Math.max(b1[2] - inset, 0)];
    const m = (p: number[]) => [p[0], p[1], -p[2]];
    // Inner faces look inboard: starboard wound one way, port the other.
    s.quad(ia0, ia1, ib1, ib0, PAINT.inner);
    s.quad(m(ia0), m(ib0), m(ib1), m(ia1), PAINT.inner);
    // Rail cap.
    s.quad(ia1, a1, b1, ib1, PAINT.rail);
    s.quad(m(ia1), m(ib1), m(b1), m(a1), PAINT.rail);
  }

  // The deckhouse and the wheelhouse over it, forward of midship.
  {
    const yd = freeboard(-0.1);
    // Accommodation deckhouse.
    s.box(-1.0, 9.0, yd, yd + 2.3, -3.1, 3.1, PAINT.house, PAINT.roof);
    // Portholes: a dark band low on the deckhouse sides.
    s.box(0.0, 8.0, yd + 1.1, yd + 1.5, -3.13, 3.13, PAINT.glass);
    // Wheelhouse: a white band, the window band all round, the roof.
    const yw = yd + 2.3;
    s.box(3.2, 8.4, yw, yw + 1.0, -2.6, 2.6, PAINT.house);
    s.box(3.15, 8.5, yw + 1.0, yw + 2.05, -2.62, 2.62, PAINT.glass);
    s.box(3.1, 8.55, yw + 2.05, yw + 2.3, -2.64, 2.64, PAINT.house);
    s.box(2.8, 8.9, yw + 2.3, yw + 2.45, -2.95, 2.95, PAINT.roof);
    // The funnel abaft the wheelhouse, red with a black top.
    s.box(1.0, 2.4, yw, yw + 3.2, -0.6, 0.6, PAINT.funnel);
    s.box(0.95, 2.45, yw + 3.2, yw + 3.6, -0.65, 0.65, PAINT.black);
    // The mast on the wheelhouse roof, its yard, the radar scanner.
    const ym = yw + 2.45;
    s.box(5.2, 5.5, ym, ym + 6.2, -0.15, 0.15, PAINT.mast);
    s.box(5.1, 5.6, ym + 4.6, ym + 4.8, -1.8, 1.8, PAINT.mast);
    s.box(4.6, 6.1, ym + 1.4, ym + 1.55, -1.2, 1.2, PAINT.black);
    s.box(5.25, 5.45, ym + 1.0, ym + 1.4, -0.1, 0.1, PAINT.mast);
    // Life rafts, two canisters on the deckhouse roof.
    s.prism(0.0, yw - 0.05, 2.3, 0.4, 1.2, PAINT.rail, 'x');
    s.prism(0.0, yw - 0.05, -2.3, 0.4, 1.2, PAINT.rail, 'x');
  }

  // The working deck aft: the net drum, the trawl winches, the stern gantry.
  {
    const y0 = freeboard(-0.6);
    // Net drum: a green barrel across the deck.
    s.prism(-8.2, y0 + 1.3, 0, 1.2, 4.4, PAINT.drum, 'z');
    s.box(-9.0, -7.4, y0, y0 + 0.9, -2.5, -2.2, PAINT.gear);
    s.box(-9.0, -7.4, y0, y0 + 0.9, 2.2, 2.5, PAINT.gear);
    // Trawl winches either side, forward of the drum.
    s.box(-4.4, -2.6, y0, y0 + 1.2, 1.2, 2.6, PAINT.black);
    s.box(-4.4, -2.6, y0, y0 + 1.2, -2.6, -1.2, PAINT.black);
    // Stern gantry: two legs raked aft and a beam.
    const xg = -13.4;
    const zg = 3.0;
    const yg = freeboard(-0.9);
    s.box(xg - 0.28, xg + 0.28, yg, yg + 5.4, zg - 0.28, zg + 0.28, PAINT.gear);
    s.box(xg - 0.28, xg + 0.28, yg, yg + 5.4, -zg - 0.28, -zg + 0.28, PAINT.gear);
    s.box(xg - 0.38, xg + 0.38, yg + 5.1, yg + 5.75, -zg - 0.45, zg + 0.45, PAINT.gear);
    // Trawl doors hung on the gantry.
    s.box(xg - 0.2, xg + 0.2, yg + 1.6, yg + 3.6, zg + 0.4, zg + 0.55, PAINT.black);
    s.box(xg - 0.2, xg + 0.2, yg + 1.6, yg + 3.6, -zg - 0.55, -zg - 0.4, PAINT.black);
  }
  return s.geometry();
}

/** Waterplane points the fit reads, in the hull frame (x forward, z starboard), meters. */
function waterplanePoints(hull: WakeHull): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  for (const xi of [-0.8, -0.4, 0, 0.4, 0.8]) {
    for (const zs of [-0.3, 0, 0.3]) pts.push([(xi * hull.lengthM) / 2, zs * hull.beamM]);
  }
  return pts;
}

export interface WakeBoatOptions {
  readonly sunDir?: THREE.Vector3;
  readonly overcast?: TslNode;
  /**
   * The hull's own wave field, height at a world XZ point (`OceanWake`'s
   * `heightAt`). With it the hull sinks and trims into its own waves.
   */
  readonly wakeHeight?: (worldXZ: TslNode) => TslNode;
}

/**
 * SINKAGE AND TRIM. A hull under way runs in the trough its own flow draws
 * down along its sides, and settles into it: the sinkage and trim that
 * squat tables give (at Fr 0.35 a displacement hull sinks a few tenths of a
 * meter and trims by the stern). The fit reads the hull's own wave field at
 * these stations along both sides, just outside the waterline, and adds
 * their mean to the heave and their fore-and-aft slope to the pitch, so the
 * painted waterline stays at the water the hull has made.
 */
const SINK_STATIONS_XI = [-0.8, -0.4, 0, 0.4, 0.8] as const;
const SINK_OUTSIDE_M = 0.4;

/** Build the trawler and its sea fit on a field. */
export function createWakeBoat(field: OceanField, hull: WakeHull, opts: WakeBoatOptions = {}): WakeBoat {
  const pose = new StorageBufferAttribute(new Float32Array(4), 4);
  const uCenter = uniform(new THREE.Vector2(0, 0));
  // (x, z, cos heading, sin heading).
  const uBoat = uniform(new THREE.Vector4(0, 0, 1, 0));
  const { disp, sampleCascade, cascadeLod } = createOceanSampler(field.buffers, uCenter);
  const cascades = field.cascades;

  /** The summed, range-faded displacement at grid point g, as the mesh sums it. */
  const sumDisp = (g: TslNode): TslNode => {
    let acc: TslNode | null = null;
    for (let ci = 0; ci < cascades.length; ci += 1) {
      const d = sampleCascade(disp, g, ci, cascades[ci].patchM).xyz.mul(cascadeLod(g, cascades[ci].dispLod));
      acc = acc === null ? d : acc.add(d);
    }
    return acc as TslNode;
  };

  // THE FIT RUNS WIDE. One invocation per sample point (15 on the sea, with
  // the inversion; 10 on the hull's own waves), then one that sums them.
  // As a single invocation that walked every point in turn the fit was a
  // chain of about a thousand dependent buffer reads on one GPU thread, and
  // it cost more than the whole wake field.
  const pts = waterplanePoints(hull);
  interface Sample { px: number; pz: number; sea: boolean; wc: number; wa: number; wb: number }
  const samples: Sample[] = [];
  let sxx = 0;
  let szz = 0;
  for (const [px, pz] of pts) { sxx += px * px; szz += pz * pz; }
  for (const [px, pz] of pts) {
    samples.push({ px, pz, sea: true, wc: 1 / pts.length, wa: px / sxx, wb: pz / szz });
  }
  if (opts.wakeHeight) {
    // The hull's own waves beside it: sinkage and trim.
    let sx = 0;
    let n = 0;
    for (const xi of SINK_STATIONS_XI) { sx += (xi * hull.lengthM / 2) ** 2; n += 2; }
    for (const xi of SINK_STATIONS_XI) {
      const px = (xi * hull.lengthM) / 2;
      for (const side of [-1, 1]) {
        const pz = side * (hullHalfBreadth(hull, xi) + SINK_OUTSIDE_M);
        samples.push({ px, pz, sea: false, wc: 1 / n, wa: px / (2 * sx), wb: 0 });
      }
    }
  }
  const sampleVals = samples.map((q) => new THREE.Vector4(q.px, q.pz, q.sea ? 0 : 1, 0));
  const uPts = uniformArray(sampleVals, 'vec4');
  const heights = new StorageBufferAttribute(new Float32Array(samples.length), 1);
  const heightsW = storage(heights, 'float', samples.length);
  const fitPoints = Fn(() => {
    const q = uPts.element(instanceIndex);
    const hx = uBoat.z;
    const hz = uBoat.w;
    // Hull frame to world: +x along the heading, +z along (-hz, hx).
    const target = vec2(uBoat.x.add(hx.mul(q.x)).sub(hz.mul(q.y)), uBoat.y.add(hz.mul(q.x)).add(hx.mul(q.y))).toVar();
    const h = float(0).toVar();
    If(q.z.lessThan(float(0.5)), () => {
      const g = target.toVar();
      for (let it = 0; it < INVERSION_ITERATIONS; it += 1) {
        const d = sumDisp(g);
        g.assign(target.sub(vec2(d.x, d.z)));
      }
      h.assign(sumDisp(g).y);
    });
    if (opts.wakeHeight) {
      const wakeH = opts.wakeHeight;
      If(q.z.greaterThan(float(0.5)), () => { h.assign(wakeH(target)); });
    }
    heightsW.element(instanceIndex).assign(h);
  })().compute(samples.length);
  const heightsR = storage(heights, 'float', samples.length).toReadOnly();
  const poseW = storage(pose, 'vec4', 1);
  const fitSum = Fn(() => {
    let c: TslNode = float(0);
    let a: TslNode = float(0);
    let b: TslNode = float(0);
    samples.forEach((q, i) => {
      const h = heightsR.element(int(i));
      c = c.add(h.mul(q.wc));
      a = a.add(h.mul(q.wa));
      if (q.wb !== 0) b = b.add(h.mul(q.wb));
    });
    poseW.element(0).assign(vec4(c, a, b, float(0)));
  })().compute(1);
  const fit = [fitPoints, fitSum];

  // The hull's vertex stage: roll, then pitch, then heave, from the fit.
  const poseR = storage(pose, 'vec4', 1).toReadOnly();
  const rotate = (v: TslNode, withHeave: boolean): TslNode => {
    const pz = poseR.element(0);
    const ta = pz.y;
    const tb = pz.z;
    const cP = float(1).div(sqrt(float(1).add(ta.mul(ta))));
    const sP = ta.mul(cP);
    const cR = float(1).div(sqrt(float(1).add(tb.mul(tb))));
    const sR = tb.mul(cR);
    // Roll about +x: the +z side rises by tb per meter.
    const y1 = v.y.mul(cR).add(v.z.mul(sR));
    const z1 = v.z.mul(cR).sub(v.y.mul(sR));
    // Pitch about +z: the bow rises by ta per meter.
    const x2 = v.x.mul(cP).sub(y1.mul(sP));
    const y2 = y1.mul(cP).add(v.x.mul(sP));
    return vec3(x2, withHeave ? y2.add(pz.x) : y2, z1);
  };

  const sun = (opts.sunDir ?? OCEAN_SUN_DIR).clone().normalize();
  const uOvercast: TslNode = opts.overcast ?? uniform(0);
  const material = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide });
  material.positionNode = rotate(positionLocal, true);
  const nWorld = varying(normalize(modelWorldMatrix.mul(vec4(rotate(normalLocal, false), 0)).xyz), 'vBoatNormal');
  const vPos = varying(modelWorldMatrix.mul(vec4(rotate(positionLocal, true), 1)).xyz, 'vBoatPos');
  material.colorNode = Fn(() => {
    const n = normalize(select(frontFacing, nWorld, nWorld.negate())).toVar();
    const albedo = attribute('color', 'vec3');
    const sunVis = float(1).sub(uOvercast);
    const ndl = clamp(dot(n, vec3(sun.x, sun.y, sun.z)), float(0), float(1));
    const skyW = n.y.mul(0.5).add(0.5);
    const amb = mix(vec3(0.10, 0.15, 0.19), vec3(0.40, 0.50, 0.66), skyW).mul(1.6);
    const irr = vec3(1.0, 0.96, 0.9).mul(ndl.mul(7).mul(sunVis)).add(amb);
    // Gloss paint: a Blinn-Phong sheen, 4% at normal incidence (enamel).
    const v = normalize(cameraPosition.sub(vPos));
    const hv = normalize(v.add(vec3(sun.x, sun.y, sun.z)));
    const sheen = pow(clamp(dot(n, hv), float(0), float(1)), float(80)).mul(ndl).mul(sunVis).mul(0.04 * 7 * 12);
    return albedo.mul(irr).mul(1 / Math.PI).mul(max(float(0.35), sunVis.mul(0.65).add(0.35))).add(vec3(sheen, sheen, sheen));
  })();

  const mesh = new THREE.Mesh(buildTrawlerGeometry(hull), material);
  mesh.frustumCulled = false;
  const group = new THREE.Group();
  group.add(mesh);

  return {
    group,
    pose,
    dispatchList: fit,
    update(renderer, p) {
      const c = field.surface.center;
      uCenter.value.set(c.x, c.y);
      uBoat.value.set(p.xM, p.zM, Math.cos(p.headingRad), Math.sin(p.headingRad));
      // Local +X is the heading: rotation.y = -heading maps +X to (cos, 0, sin).
      group.position.set(p.xM, 0, p.zM);
      group.rotation.set(0, -p.headingRad, 0);
      group.updateMatrixWorld();
      renderer.compute(fit as unknown as Parameters<THREE.WebGPURenderer['compute']>[0]);
    },
    dispose() {
      mesh.geometry.dispose();
      material.dispose();
      for (const f of fit) (f as { dispose?: () => void }).dispose?.();
    },
  };
}
