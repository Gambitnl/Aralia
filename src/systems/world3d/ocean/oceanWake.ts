/**
 * @file oceanWake.ts — the wake of a moving hull on the GPU, and the read
 * the ocean surface draws it with.
 *
 * WHAT IT IS. `oceanWakeMath.ts` holds the model and its CPU mirror: the
 * hull as a surface pressure, the course as straight pieces, each piece's
 * wave integral in closed form, and the white water as a function of where
 * the water lies against the course. This file runs that model each frame,
 * in one `renderer.compute` call of 20 dispatches:
 *
 *   1. `pack`    one invocation per mode of the 512 x 256 window: the sum of
 *                every piece's closed-form integral (the mirror of
 *                `wakeModeAmplitude`), then the two packed complex planes
 *                eta + i d(eta)/du and d(eta)/dv + i eta_lowpass.
 *   2. 9 + 8     radix-2 Stockham stages along u, then v, the same gather
 *                plan as oceanCompute.ts (`oceanFftIndex`), for a
 *                rectangle.
 *   3. `unpack`  one invocation per texel: the (-1)^(i+j) of the centered
 *                wavevector grid, the window mask, the slopes turned to
 *                world XZ, the stern churn (the mirror of `wakeFoamAt`) and
 *                the breaking rate of the wake's own crests (the mirror of
 *                `wakeBreaking`).
 *   4. `deposit` one invocation per texel: the foam the breakers left,
 *                summed over the texels ahead along the track (the mirror
 *                of `wakeDepositCpu`).
 *
 * The CPU writes only uniforms: the window's corner and axis and the
 * course pieces. So the wake is a pure function of (course, sea time); a
 * pinned capture needs no warm-up and reproduces bit for bit.
 *
 * WHAT THE SURFACE READS. `reader.lift(sample)` in the vertex stage (the
 * low-passed height, meters) and `reader.shade({ sample, longM, shortM })`
 * in the fragment stage: the wake's slope to add to the surface's, the foam
 * alpha, and the bubble cloud (a weight and the light it adds to the body).
 * `sample` is the surface's grid coordinate (`worldFlat` / `vSample`), so
 * the white water sits in the FFT sea's own parcels and rides its chop.
 * The surface calls them through `setWake(reader)`: a routed change to
 * oceanSurface.ts, written out in the wake report. The foam's holes and
 * edges come from THE TRAIL (round 14, oceanWakeTrail.ts) when the look's
 * `trail` is on (the shipped look); older looks draw the lace, the net and
 * the layer as they did, node for node.
 *
 * REGISTERED TSL HAZARDS. No integer `.mod()`: every wrap is a mask. Stage
 * constants are compiled in: one kernel per stage, both ping-pong
 * directions built up front. No race: the pack invocation for mode i
 * writes element i of each of the two planes (i and i + cells), which no
 * other invocation writes; every other kernel writes its own element only.
 * Uniforms are written once before the one compute call, so every dispatch
 * in it sees the frame's values.
 *
 * WHAT IS STILL OPEN. See oceanWakeMath.ts. The foam is the wake's own; it
 * does not yet feed the persistent foam field of oceanFoam.ts.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 25/10/2026, 03:57:03
 * Dependents: components/DesignPreview/steps/sidebyside/oceanExtras/wake.ts, systems/world3d/ocean/oceanSurface.ts
 * Imports: 9 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { createWakeReader } from './oceanWakeReader';
import { type TslNode, type OceanWakeReader } from './oceanWakeReaderTypes';
import { LACE_SOFT, OP_THIN, OP_RANGE, FOAM_THIN, JAC_POWER } from './oceanWakeShadeParams';
export type { OceanWakeReader } from './oceanWakeReaderTypes';

import * as THREE from 'three/webgpu';
import { Fn, If, Loop, abs, bitAnd, clamp, cos, exp, float, floor, fract, instanceIndex, int, max, min, mix, pow, select, shiftLeft, shiftRight, sin, smoothstep, sqrt, storage, uniform, uniformArray, vec2, vec4 } from 'three/tsl';
import { StorageBufferAttribute } from 'three/webgpu';
import { GRAVITY_MS2, log2Exact } from './oceanConfig';
import type { OceanField } from './oceanField';
import { createOceanSampler } from './oceanSampler';
import { OCEAN_SUN_DIR } from './oceanSky';
import { WAKE_BREAK_ACTIVE, WAKE_BREAK_BUBBLE_TAU_S, WAKE_BREAK_COVER_MAX, WAKE_BREAK_FOAM_PER_S, WAKE_BREAK_HULL_MARGIN_M, WAKE_BREAK_REACH_L, WAKE_BREAK_REACH_S, WAKE_BREAK_SLOPE_HI, WAKE_BREAK_SLOPE_LO, WAKE_BREAK_TAU_S, WAKE_BUBBLE_TAU_S, WAKE_BOW_BAND_M, WAKE_BOW_FORE_SHARE, WAKE_BUBBLE_WIDTH, WAKE_COURSE, WAKE_GRID, WAKE_LOOK_DEFAULT, WAKE_MAX_SEGMENTS, WAKE_MAX_TOUCHES, WAKE_STERN_BOIL, WAKE_STERN_BOIL_M, WAKE_STERN_BOIL_WIDTH, WAKE_STERN_FOAM_PEAK, WAKE_STERN_FOAM_TAU_S, WAKE_STERN_GROWTH, WAKE_STERN_GROWTH_M, WAKE_STERN_HALF_WIDTH, WAKE_TRAWLER, WAKE_VERTEX_SMOOTH_M, WAKE_WINDOW_AHEAD_M, WAKE_WINDOW_REAR_FADE_M, WAKE_WINDOW_SIDE_FADE_M, createWakeCourse, wakeHistoryFor, wakeLaceCdfTable, wakeLaceImage, wakeNetImage, wakeMassImage, WAKE_NET_WEIGHTS, wakePressureCutK, wakePressureForHull, wakeSegments, wakeTouchPieces, wakeWindowAt, type WakeCourse, type WakeCourseSpec, type WakeGrid, type WakeHull, type WakeLook, type WakeSegmentSet, type WakeTouch, type WakeTouchPiece, type WakeWindow } from './oceanWakeMath';
import { wakeTrailImage } from './oceanWakeTrail';

export interface OceanWakeOptions {
  readonly hull?: WakeHull;
  readonly course?: WakeCourseSpec;
  readonly grid?: WakeGrid;
  /** The sky's `uOvercast` node, the same one the surface was built with. */
  readonly overcast?: TslNode;
  readonly sunDir?: THREE.Vector3;
  /**
   * The sea the wake is drawn on. Its folding Jacobian gathers the foam
   * where the water converges (see the read); required.
   */
  readonly field: OceanField;
  /**
   * The look's controls (`WakeLook` in oceanWakeMath.ts), over the default
   * (`WAKE_LOOK_DEFAULT`). Build-time: a control that is off adds no node.
   */
  readonly look?: Partial<WakeLook>;
}

export interface OceanWake {
  readonly reader: OceanWakeReader;
  readonly course: WakeCourse;
  readonly hull: WakeHull;
  readonly grid: WakeGrid;
  readonly historyS: number;
  readonly coherenceS: number;
  /**
   * The output buffers, laid out by who reads them. A is the fragment's:
   * (d eta/dx, d eta/dz, foam, bubbles), read at every water pixel. B is
   * the vertex's and the lace's: (eta low-passed, eta, tanX, tanZ), read at
   * every vertex and only at the pixels that have white water.
   */
  readonly outA: StorageBufferAttribute;
  readonly outB: StorageBufferAttribute;
  /**
   * Bring the wake to sea time `simTimeS`: pieces and window to uniforms,
   * then one compute call. Enqueues; does not await.
   */
  step(renderer: THREE.WebGPURenderer, simTimeS: number): void;
  /** The window, the pieces and the touch pieces of the last step. */
  readonly last: {
    window: WakeWindow | null; set: WakeSegmentSet | null; timeS: number; touches: WakeTouchPiece[];
  };
  /**
   * The touches, oldest first: ripples from a point (`WakeTouch`). Add one
   * with its sea time; a touch in the future of the clock is silent until
   * then, so a pinned capture of a touch is a pure function of time too.
   */
  readonly touches: WakeTouch[];
  /** The dispatch list `step` hands to `renderer.compute`, for a timing probe. */
  readonly dispatchList: readonly unknown[];
  /**
   * TSL: the wake's height (the full field, masked) at a world XZ point, for
   * a compute kernel that runs after `step` (the hull's sinkage and trim).
   */
  heightAt(worldXZ: TslNode): TslNode;
  /** Named uniforms a capture rig may sweep; defaults are the shipped values. */
  readonly tune: Readonly<Record<string, { value: number }>>;
  /** The look this wake was built with. */
  readonly look: WakeLook;
  dispose(): void;
}

/** 2 pi, for the range reduction of large phases. */
const TWO_PI = 2 * Math.PI;

/**
 * Build the wake on a sea's window. Throws on a grid that is not a power
 * of two.
 */
export function createOceanWake(opts: OceanWakeOptions): OceanWake {
  const hull = opts.hull ?? WAKE_TRAWLER;
  const grid = opts.grid ?? WAKE_GRID;
  const look: WakeLook = { ...WAKE_LOOK_DEFAULT, ...opts.look };
  const course = createWakeCourse(opts.course ?? WAKE_COURSE);
  const { nu, nv, texelM } = grid;
  const logU = log2Exact(nu);
  const logV = log2Exact(nv);
  const cells = nu * nv;
  const logCells = logU + logV;
  const lu = nu * texelM;
  const lv = nv * texelM;
  const area = lu * lv;
  const dku = TWO_PI / lu;
  const dkv = TWO_PI / lv;
  const pr = wakePressureForHull(hull);
  const kCut = wakePressureCutK(pr);
  const { historyS, coherenceS } = wakeHistoryFor(hull, course.spec.speedMs, grid);
  const hullUM = lu - WAKE_WINDOW_AHEAD_M - hull.lengthM / 2;

  /* --- buffers ------------------------------------------------------ */

  const fftA = new StorageBufferAttribute(new Float32Array(cells * 2 * 2), 2);
  const fftB = new StorageBufferAttribute(new Float32Array(cells * 2 * 2), 2);
  const outA = new StorageBufferAttribute(new Float32Array(cells * 4), 4);
  const outB = new StorageBufferAttribute(new Float32Array(cells * 4), 4);
  // The breaking rate per texel, with the texel's lateral offset and
  // course distance, between the unpack and the deposit.
  const brk = new StorageBufferAttribute(new Float32Array(cells * 4), 4);

  /* --- uniforms ----------------------------------------------------- */

  // Three vec4 per piece: (du, dv, vu, vv), (age, dur, decayAge, decayDur),
  // (cosH, sinH, arc, speed).
  const segVals: THREE.Vector4[] = [];
  for (let i = 0; i < 3 * WAKE_MAX_SEGMENTS; i += 1) segVals.push(new THREE.Vector4());
  const uSeg = uniformArray(segVals, 'vec4');
  const uWaveCount = uniform(0, 'int');
  const uFoamCount = uniform(0, 'int');
  // Two vec4 per touch: (du, dv, age, dur), (decayAge, decayDur, sigma, volume).
  const touchVals: THREE.Vector4[] = [];
  for (let i = 0; i < 2 * WAKE_MAX_TOUCHES; i += 1) touchVals.push(new THREE.Vector4());
  const uTouch = uniformArray(touchVals, 'vec4');
  const uTouchCount = uniform(0, 'int');
  const touches: WakeTouch[] = [];
  // The window: corner (ox, oz) and heading axis (hx, hz); the side axis is
  // (-hz, hx).
  const uWin = uniform(new THREE.Vector4(0, 0, 1, 0));
  const invT = float(1 / coherenceS);

  const tune = {
    /** Scales the foam amount before the lace threshold. */
    foamGain: uniform(1),
    /** Scales the bubble weight. */
    bubbleGain: uniform(1),
    /** Scales the wake's slope in the shading and its lift in the mesh. */
    waveGain: uniform(1),
    /** See the constants of the same names. */
    laceSoft: uniform(LACE_SOFT),
    opThin: uniform(OP_THIN),
    opRange: uniform(OP_RANGE),
    foamThin: uniform(FOAM_THIN),
    subGain: uniform(look.subGain),
    jacPower: uniform(JAC_POWER),
  };

  /* --- small TSL helpers ------------------------------------------- */

  /** wakeMixUniformCdf in oceanWakeMath.ts, node for node. */
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

  /** x wrapped to [-pi, pi]: the hardware sin loses digits on large phases. */
  const wrapPhase = (x: TslNode): TslNode => x.sub(floor(x.mul(1 / TWO_PI).add(0.5)).mul(TWO_PI));
  const sinc = (x: TslNode): TslNode => select(
    abs(x).lessThan(float(1e-4)),
    float(1).sub(x.mul(x).div(6)),
    sin(x).div(select(abs(x).lessThan(float(1e-4)), float(1), x)),
  );

  /* --- kernel 1: pack ---------------------------------------------- */

  const fftAw = storage(fftA, 'vec2', fftA.count);
  const pack = Fn(() => {
    const i = int(instanceIndex);
    const p = bitAnd(i, int(nu - 1)).toVar();
    const q = shiftRight(i, int(logU)).toVar();
    const ku = float(p.sub(int(nu / 2))).mul(dku).toVar();
    const kv = float(q.sub(int(nv / 2))).mul(dkv).toVar();
    const k2 = ku.mul(ku).add(kv.mul(kv)).toVar();
    const k = sqrt(k2).toVar();
    const omega = sqrt(k.mul(GRAVITY_MS2)).toVar();
    const sr = float(0).toVar();
    const si = float(0).toVar();
    // The modes the hull cannot drive skip its pieces (wakePressureCutK).
    const hullEnd = select(k2.greaterThan(float(kCut * kCut)), int(0), uWaveCount);
    Loop({ start: int(0), end: hullEnd, type: 'int', condition: '<' }, ({ i: j }: { i: TslNode }) => {
      const s0 = uSeg.element(j.mul(3));
      const s1 = uSeg.element(j.mul(3).add(1));
      const s2 = uSeg.element(j.mul(3).add(2));
      // The patch, turned to this piece's heading (wakePressureTransform).
      const kAl = ku.mul(s2.x).add(kv.mul(s2.y));
      const kAc = ku.mul(s2.y).negate().add(kv.mul(s2.x));
      const fAlong = sinc(kAl.mul(pr.lengthM / 2))
        .mul(exp(kAl.mul(kAl).mul(-0.5 * pr.endSmoothM * pr.endSmoothM)));
      const fAcross = exp(kAc.mul(kAc).mul(-0.5 * pr.sigmaYM * pr.sigmaYM));
      const f = fAlong.mul(fAcross).mul(pr.headM * pr.lengthM * Math.sqrt(2 * Math.PI) * pr.sigmaYM).toVar();
      // The piece's integral (wakeSegmentIntegral).
      const kdotV = ku.mul(s0.z).add(kv.mul(s0.w)).toVar();
      const dur = s1.y;
      const zr = invT.mul(dur).negate().toVar();
      const zpi = omega.sub(kdotV).mul(dur).toVar();
      const zmi = omega.negate().sub(kdotV).mul(dur).toVar();
      const eDur = s1.w;
      // E(z) = (e^z - 1) / z, with e^{zr} = e^{-dur/T} from the CPU.
      const eOver = (zi: TslNode): TslNode => {
        const nr = eDur.mul(cos(wrapPhase(zi))).sub(1);
        const ni = eDur.mul(sin(wrapPhase(zi)));
        const m2 = zr.mul(zr).add(zi.mul(zi));
        const small = m2.lessThan(float(1e-8));
        const den = select(small, float(1), m2);
        const er = select(small, float(1).add(zr.mul(0.5)), nr.mul(zr).add(ni.mul(zi)).div(den));
        const ei = select(small, zi.mul(0.5), ni.mul(zr).sub(nr.mul(zi)).div(den));
        return vec2(er, ei);
      };
      const ep = eOver(zpi).toVar();
      const em = eOver(zmi).toVar();
      const wa = wrapPhase(omega.mul(s1.x)).toVar();
      const ca = cos(wa).toVar();
      const sa = sin(wa).toVar();
      const qr = ca.mul(ep.x).sub(sa.mul(ep.y)).sub(ca.mul(em.x).add(sa.mul(em.y)));
      const qi = ca.mul(ep.y).add(sa.mul(ep.x)).sub(ca.mul(em.y).sub(sa.mul(em.x)));
      const hr = qi.mul(0.5);
      const hi = qr.mul(-0.5);
      const scale = s1.z.mul(dur).mul(f);
      const ph = wrapPhase(ku.mul(s0.x).add(kv.mul(s0.y)).negate()).toVar();
      const pc = cos(ph);
      const ps = sin(ph);
      sr.addAssign(scale.mul(pc.mul(hr).sub(ps.mul(hi))));
      si.addAssign(scale.mul(pc.mul(hi).add(ps.mul(hr))));
    });
    // The touches: still pieces with a round footprint (wakeModeAmplitude).
    Loop({ start: int(0), end: uTouchCount, type: 'int', condition: '<' }, ({ i: j }: { i: TslNode }) => {
      const t0 = uTouch.element(j.mul(2));
      const t1 = uTouch.element(j.mul(2).add(1));
      const f = exp(k2.mul(t1.z.mul(t1.z)).mul(-0.5)).mul(t1.w).toVar();
      const dur = t0.w;
      const zr = invT.mul(dur).negate().toVar();
      const zpi = omega.mul(dur).toVar();
      const zmi = omega.negate().mul(dur).toVar();
      const eOver = (zi: TslNode): TslNode => {
        const nr = t1.y.mul(cos(wrapPhase(zi))).sub(1);
        const ni = t1.y.mul(sin(wrapPhase(zi)));
        const m2 = zr.mul(zr).add(zi.mul(zi));
        const small = m2.lessThan(float(1e-8));
        const den = select(small, float(1), m2);
        const er = select(small, float(1).add(zr.mul(0.5)), nr.mul(zr).add(ni.mul(zi)).div(den));
        const ei = select(small, zi.mul(0.5), ni.mul(zr).sub(nr.mul(zi)).div(den));
        return vec2(er, ei);
      };
      const ep = eOver(zpi).toVar();
      const em = eOver(zmi).toVar();
      const wa = wrapPhase(omega.mul(t0.z)).toVar();
      const ca = cos(wa).toVar();
      const sa = sin(wa).toVar();
      const qr = ca.mul(ep.x).sub(sa.mul(ep.y)).sub(ca.mul(em.x).add(sa.mul(em.y)));
      const qi = ca.mul(ep.y).add(sa.mul(ep.x)).sub(ca.mul(em.y).sub(sa.mul(em.x)));
      const hr = qi.mul(0.5);
      const hi = qr.mul(-0.5);
      const scale = t1.x.mul(dur).mul(f);
      const ph = wrapPhase(ku.mul(t0.x).add(kv.mul(t0.y)).negate()).toVar();
      const pc = cos(ph);
      const ps = sin(ph);
      sr.addAssign(scale.mul(pc.mul(hr).sub(ps.mul(hi))));
      si.addAssign(scale.mul(pc.mul(hi).add(ps.mul(hr))));
    });
    // -k g / (omega A); the mean mode is 0.
    const isMean = k.lessThan(float(1e-9));
    const g = select(isMean, float(0), k.mul(-GRAVITY_MS2).div(max(omega, float(1e-9)).mul(area)));
    const hr = sr.mul(g).toVar();
    const hi = si.mul(g).toVar();
    const lp = exp(k2.mul(-0.5 * WAKE_VERTEX_SMOOTH_M * WAKE_VERTEX_SMOOTH_M));
    // Pack X + i Y: (X.re - Y.im, X.im + Y.re). Plane 0: eta + i d/du.
    // d/du hhat = i ku hhat = (-ku hi, ku hr).
    fftAw.element(i).assign(vec2(hr.sub(ku.mul(hr)), hi.add(ku.mul(hi).negate())));
    // Plane 1: d/dv + i lowpass.
    fftAw.element(i.add(int(cells))).assign(vec2(
      kv.mul(hi).negate().sub(hi.mul(lp)),
      kv.mul(hr).add(hr.mul(lp)),
    ));
  })().compute(cells);

  /* --- kernels 2 and 3: Stockham stages ---------------------------- */

  /**
   * One radix-2 Stockham stage over both planes, gather form. The mirror of
   * `oceanFftIndex` in oceanFftReference.ts, for a rectangle: along u a
   * line is a row of nu; along v a column of nv at stride nu.
   */
  const stage = (src: StorageBufferAttribute, dst: StorageBufferAttribute, vertical: boolean, s: number) => {
    const n = vertical ? nv : nu;
    const half = n >> 1;
    const m = 1 << s;
    const read = storage(src, 'vec2', src.count).toReadOnly();
    const write = storage(dst, 'vec2', dst.count);
    return Fn(() => {
      const i = int(instanceIndex);
      const planeBase = bitAnd(i, int(~(cells - 1))).toVar();
      const rem = bitAnd(i, int(cells - 1)).toVar();
      const row = shiftRight(rem, int(logU)).toVar();
      const col = bitAnd(rem, int(nu - 1)).toVar();
      const o = vertical ? row : col;
      const lineBase = vertical ? planeBase.add(col) : planeBase.add(shiftLeft(row, int(logU)));
      const kk = bitAnd(o, int(m - 1)).toVar();
      const q2 = shiftRight(o, int(s)).toVar();
      const aIdx = shiftRight(q2, int(1)).mul(int(m)).add(kk).toVar();
      const bIdx = aIdx.add(int(half)).toVar();
      const flat = (idx: TslNode) => (vertical ? lineBase.add(shiftLeft(idx, int(logU))) : lineBase.add(idx));
      const a = read.element(flat(aIdx)).toVar();
      const b = read.element(flat(bIdx)).toVar();
      const ang = float(kk).mul(float(Math.PI / m)).toVar();
      const wr = cos(ang).toVar();
      const wi = sin(ang).toVar();
      const tr = wr.mul(b.x).sub(wi.mul(b.y)).toVar();
      const ti = wr.mul(b.y).add(wi.mul(b.x)).toVar();
      const sgn = select(bitAnd(q2, int(1)).equal(int(0)), float(1), float(-1)).toVar();
      write.element(i).assign(vec2(a.x.add(sgn.mul(tr)), a.y.add(sgn.mul(ti))));
    })().compute(cells * 2);
  };

  const stages: TslNode[] = [];
  let fromA = true;
  for (let s = 0; s < logU; s += 1) {
    stages.push(stage(fromA ? fftA : fftB, fromA ? fftB : fftA, false, s));
    fromA = !fromA;
  }
  for (let s = 0; s < logV; s += 1) {
    stages.push(stage(fromA ? fftA : fftB, fromA ? fftB : fftA, true, s));
    fromA = !fromA;
  }
  const result = fromA ? fftA : fftB;

  /* --- kernel 4: unpack, mask, stern churn, breaking --------------- */

  const res = storage(result, 'vec2', result.count).toReadOnly();
  const outAw = storage(outA, 'vec4', outA.count);
  const outBw = storage(outB, 'vec4', outB.count);
  const brkW = storage(brk, 'vec4', brk.count);
  const L = hull.lengthM;
  const B = hull.beamM;
  const stemU = hullUM + L / 2;
  /** hullHalfBreadth at xi, in TSL (0 off the hull). */
  const halfBreadth = (xi: TslNode): TslNode => {
    const fwd = pow(max(float(1).sub(xi.mul(xi)), float(1e-6)), float(0.7)).mul(B / 2);
    const xi4 = xi.mul(xi).mul(xi).mul(xi);
    const aft = float(1).sub(xi4.mul(1 - hull.transomShare)).mul(B / 2);
    const on = xi.greaterThan(float(-1)).and(xi.lessThan(float(1)));
    return select(on, select(xi.greaterThanEqual(float(0)), fwd, aft), float(0));
  };
  const unpack = Fn(() => {
    const i = int(instanceIndex);
    const p = bitAnd(i, int(nu - 1)).toVar();
    const q = shiftRight(i, int(logU)).toVar();
    const sgn = select(bitAnd(p.add(q), int(1)).equal(int(0)), float(1), float(-1)).toVar();
    const f0 = res.element(i).mul(sgn).toVar();
    const f1 = res.element(i.add(int(cells))).mul(sgn).toVar();
    const u = float(p).mul(texelM).toVar();
    const v = float(q).mul(texelM).toVar();
    // The window mask (wakeWindowMask); the foam takes the edge fades only.
    const ahead = float(1).sub(smoothstep(float(stemU + WAKE_WINDOW_AHEAD_M / 3), float(lu - 2), u));
    const edge = smoothstep(float(0), float(WAKE_WINDOW_REAR_FADE_M), u)
      .mul(smoothstep(float(0), float(WAKE_WINDOW_SIDE_FADE_M), v))
      .mul(smoothstep(float(0), float(WAKE_WINDOW_SIDE_FADE_M), float(lv).sub(v))).toVar();
    const mask = ahead.mul(edge).toVar();
    const hx = uWin.z;
    const hz = uWin.w;
    // Slopes to world: d/dx = d/du hx + d/dv lx, with l = (-hz, hx).
    const eu = f0.y;
    const ev = f1.x;
    const ex = eu.mul(hx).sub(ev.mul(hz));
    const ez = eu.mul(hz).add(ev.mul(hx));

    // The nearest point of the course (wakeFoamAt).
    const best = float(1e12).toVar();
    const behind = float(0).toVar();
    const lateral = float(0).toVar();
    const tu = float(1).toVar();
    const tv = float(0).toVar();
    const speed = float(1).toVar();
    Loop({ start: int(0), end: uFoamCount, type: 'int', condition: '<' }, ({ i: j }: { i: TslNode }) => {
      const s0 = uSeg.element(j.mul(3));
      const s1 = uSeg.element(j.mul(3).add(1));
      const s2 = uSeg.element(j.mul(3).add(2));
      const eu2 = s0.z.mul(s1.y);
      const ev2 = s0.w.mul(s1.y);
      const len2 = max(eu2.mul(eu2).add(ev2.mul(ev2)), float(1e-12));
      const muRaw = u.sub(s0.x).mul(eu2).add(v.sub(s0.y).mul(ev2)).div(len2);
      // The first piece reaches ahead of the hull; the others are clamped.
      const mu = min(select(j.equal(int(0)), muRaw, max(muRaw, float(0))), float(1)).toVar();
      const du = u.sub(s0.x.add(mu.mul(eu2))).toVar();
      const dv = v.sub(s0.y.add(mu.mul(ev2))).toVar();
      const d2 = du.mul(du).add(dv.mul(dv));
      If(d2.lessThan(best), () => {
        best.assign(d2);
        behind.assign(s2.z.add(mu.mul(sqrt(len2))));
        lateral.assign(s2.x.mul(dv).sub(s2.y.mul(du)));
        tu.assign(s2.x);
        tv.assign(s2.y);
        speed.assign(s2.w);
      });
    });
    const n = abs(lateral).toVar();
    const uu = max(speed, float(0.5)).toVar();
    const halfB = halfBreadth(behind.negate().div(L / 2)).toVar();
    const inside = n.lessThan(halfB);
    // The stern churn.
    const dStern = max(behind.sub(L / 2), float(0)).toVar();
    const tSt = dStern.div(uu);
    const w = pow(float(1).add(dStern.div(WAKE_STERN_GROWTH_M)), float(WAKE_STERN_GROWTH))
      .mul(WAKE_STERN_HALF_WIDTH * B).toVar();
    const ramp = smoothstep(float(0), float(1.5), behind.sub(L / 2)).toVar();
    const r = n.div(w);
    const rc = r.div(WAKE_STERN_BOIL_WIDTH);
    const churn = exp(tSt.div(-WAKE_STERN_FOAM_TAU_S)).mul(WAKE_STERN_FOAM_PEAK).mul(exp(r.mul(r).negate()))
      .add(exp(dStern.div(-WAKE_STERN_BOIL_M)).mul(WAKE_STERN_BOIL).mul(exp(rc.mul(rc).negate())))
      .mul(ramp);
    const rb = n.div(w.mul(WAKE_BUBBLE_WIDTH));
    const bubS = exp(tSt.div(-WAKE_BUBBLE_TAU_S)).mul(exp(rb.mul(rb).negate())).mul(ramp);
    const out = select(inside, float(0), float(1)).mul(edge);
    // Tangent to world.
    const tx = tu.mul(hx).sub(tv.mul(hz));
    const tz = tu.mul(hz).add(tv.mul(hx));
    outAw.element(i).assign(vec4(ex.mul(mask), ez.mul(mask), churn.mul(out), bubS.mul(out)));
    outBw.element(i).assign(vec4(f1.y.mul(mask), f0.x.mul(mask), tx, tz));
    // The breaking rate (wakeBreaking), on the unmasked field, and the
    // bow's contact breaker (wakeBowBreaking).
    const offHull = n.greaterThanEqual(select(halfB.greaterThan(float(0)), halfB.add(WAKE_BREAK_HULL_MARGIN_M), float(0)));
    const slope = sqrt(eu.mul(eu).add(ev.mul(ev)));
    // Only the hull's own wedge (wakeBreakingReach).
    const reachL = WAKE_BREAK_REACH_L * L;
    const fromStem = behind.add(L / 2).toVar();
    const edgeN = max(fromStem, float(0)).mul(0.4).add(B / 2).toVar();
    const reach = smoothstep(float(-3), float(-1), fromStem)
      .mul(float(1).sub(smoothstep(edgeN, edgeN.add(6), n)))
      .mul(float(1).sub(smoothstep(float(0.8 * reachL), float(reachL), behind)));
    const waveBrk = smoothstep(float(WAKE_BREAK_SLOPE_LO), float(WAKE_BREAK_SLOPE_HI), slope)
      .mul(select(f0.x.greaterThan(float(0)).and(offHull), float(1), float(0))).mul(reach);
    const xh = behind.negate();
    const outM = n.sub(halfB);
    const bowAlong = smoothstep(float(L / 2 - WAKE_BOW_FORE_SHARE * L), float(L / 2 - 0.04 * L), xh)
      .mul(float(1).sub(smoothstep(float(L / 2 + 0.5), float(L / 2 + 2.5), xh)));
    const bowAcross = smoothstep(float(-0.3), float(0.1), outM)
      .mul(float(1).sub(smoothstep(float(0.4 * WAKE_BOW_BAND_M), float(WAKE_BOW_BAND_M), outM)));
    brkW.element(i).assign(vec4(max(waveBrk, bowAlong.mul(bowAcross)), lateral, behind, float(0)));
  })().compute(cells);

  /* --- kernel 5: the breakers' foam, swept aft --------------------- */

  const brkR = storage(brk, 'vec4', brk.count).toReadOnly();
  const depDt = texelM / Math.max(course.spec.speedMs, 0.5);
  const depReach = Math.ceil(WAKE_BREAK_REACH_S / depDt);
  const kf = Math.exp(-depDt / WAKE_BREAK_TAU_S);
  const kb = Math.exp(-depDt / WAKE_BREAK_BUBBLE_TAU_S);
  /** hullEnvelope at hull-frame x. */
  const envelope = (x: TslNode): TslNode => select(x.lessThanEqual(float(0)), float(B / 2), halfBreadth(x.div(L / 2)));
  const deposit = Fn(() => {
    const i = int(instanceIndex);
    const p = bitAnd(i, int(nu - 1)).toVar();
    const q = shiftRight(i, int(logU)).toVar();
    const own = brkR.element(i).toVar();
    const x0 = own.z.negate().toVar();
    const n0 = own.y.toVar();
    const env0 = envelope(x0).toVar();
    const off = abs(n0).sub(env0);
    const inside = abs(x0).lessThan(float(L / 2)).and(abs(n0).lessThan(halfBreadth(x0.div(L / 2))));
    const side = select(n0.lessThan(float(0)), float(-1), float(1));
    const keep = exp(max(off, float(0)).div(-B)).mul(side).toVar();
    const f = float(0).toVar();
    const bb = float(0).toVar();
    const wf = float(1).toVar();
    const wb = float(1).toVar();
    Loop({ start: int(0), end: int(depReach + 1), type: 'int', condition: '<' }, ({ i: m }: { i: TslNode }) => {
      If(p.add(m).lessThan(int(nu)), () => {
        const shift = envelope(x0.add(float(m).mul(texelM))).sub(env0).mul(keep);
        const jj = clamp(q.add(int(floor(shift.div(texelM).add(0.5)))), int(0), int(nv - 1));
        const d = brkR.element(jj.mul(int(nu)).add(p).add(m)).x;
        f.addAssign(d.mul(wf));
        bb.addAssign(d.mul(wb));
      });
      wf.mulAssign(kf);
      wb.mulAssign(kb);
    });
    const outside = select(inside, float(0), float(1));
    const cur = outAw.element(i).toVar();
    const u = float(p).mul(texelM);
    const v = float(q).mul(texelM);
    const fade = smoothstep(float(0), float(WAKE_WINDOW_REAR_FADE_M), u)
      .mul(smoothstep(float(0), float(WAKE_WINDOW_SIDE_FADE_M), v))
      .mul(smoothstep(float(0), float(WAKE_WINDOW_SIDE_FADE_M), float(lv).sub(v)));
    const foamB = max(
      float(1).sub(exp(f.mul(-WAKE_BREAK_FOAM_PER_S * depDt))).mul(WAKE_BREAK_COVER_MAX),
      own.x.mul(WAKE_BREAK_ACTIVE),
    ).mul(fade).mul(outside);
    const bubB = float(1).sub(exp(bb.mul(-0.6 * WAKE_BREAK_FOAM_PER_S * depDt))).mul(fade).mul(outside);
    outAw.element(i).assign(vec4(cur.x, cur.y, max(cur.z, foamB), max(cur.w, bubB)));
  })().compute(cells);

  const dispatches: TslNode[] = [pack, ...stages, unpack, deposit];

  /* --- the surface's read ------------------------------------------ */

  const inA = storage(outA, 'vec4', outA.count).toReadOnly();
  const inB = storage(outB, 'vec4', outB.count).toReadOnly();
  // The breaking buffer's (rate, lateral, behind, 0): `behind` is the
  // texel's distance along the course from the hull's center, so behind
  // minus L / 2 over the speed is the foam's age (round 4; read only where
  // the look keys on age).
  const inK = storage(brk, 'vec4', brk.count).toReadOnly();
  // Round 14's trail: when it is on it draws every foam pixel of the wake,
  // and the lace's structure, the net and the layer are not built (their
  // textures are not made either). It reads the texel's age and offset.
  const trailOn = look.trail[0] > 0;
  const keysOnAge = trailOn || look.ageShade[2] !== 1 || look.ageShade[3] !== 1 || look.ageOpacity[2] !== 1 || look.wispAge[0] >= 0
    || look.sideFade[2] !== 1 || look.clumpTearAge[1] > look.clumpTearAge[0]
    || (look.laceFold[2] > 0 && look.laceFold[1] > look.laceFold[0]) || look.edgeLines[0] > 0 || look.envelope[3] < 1 || look.debugView === 2
    || (look.laceNet[2] > 0 && look.laceNet[1] > look.laceNet[0]) || look.coreBand[2] > 0 || look.churnSlope[0] > 0
    || look.sideThin[2] < 1 || look.mass[0] > 0;
  // Round 6's edge lines also read the texel's offset from the track (and
  // round 12's foam mass, its age and offset both).
  const keysOnSide = look.edgeLines[0] > 0 || look.envelope[3] < 1 || look.coreBand[2] > 0 || look.sideThin[2] < 1
    || look.mass[0] > 0 || trailOn;
  // Round 5's on-screen key serves sideStretch alone (WakeLook): the
  // structure paths apply at every view.
  const sideOn = look.sideStretch[0] > 0 || look.sideStretch[1] > 0 || look.sideNet[0] > 0;

  /** Bilinear read of a window buffer at world XZ; zero outside the window. */
  const sampleWindow = (buf: TslNode, world: TslNode): TslNode => {
    const d = world.sub(vec2(uWin.x, uWin.y));
    const tu2 = d.x.mul(uWin.z).add(d.y.mul(uWin.w)).div(texelM);
    const tv2 = d.x.mul(uWin.w).negate().add(d.y.mul(uWin.z)).div(texelM);
    const inside = tu2.greaterThanEqual(float(0)).and(tu2.lessThan(float(nu - 1)))
      .and(tv2.greaterThanEqual(float(0))).and(tv2.lessThan(float(nv - 1)));
    const cu = clamp(tu2, float(0), float(nu - 1.001));
    const cv = clamp(tv2, float(0), float(nv - 1.001));
    const bu = floor(cu);
    const bv = floor(cv);
    const fu = fract(cu);
    const fv = fract(cv);
    const i0 = int(bu);
    const j0 = int(bv);
    const at = (di: number, dj: number) => buf.element(j0.add(int(dj)).mul(int(nu)).add(i0.add(int(di))));
    const val = mix(mix(at(0, 0), at(1, 0), fu), mix(at(0, 1), at(1, 1), fu), fv);
    return select(inside, val, vec4(0, 0, 0, 0));
  };

  // The lace: a mipmapped, tileable RGBA texture built once on the CPU,
  // and its coverage table (see wakeLaceCdfTable).
  const LACE_SIZE = 512;
  const laceImg = wakeLaceImage(LACE_SIZE);
  const laceTex = new THREE.DataTexture(laceImg, LACE_SIZE, LACE_SIZE, THREE.RGBAFormat);
  laceTex.wrapS = THREE.RepeatWrapping;
  laceTex.wrapT = THREE.RepeatWrapping;
  laceTex.magFilter = THREE.LinearFilter;
  laceTex.minFilter = THREE.LinearMipmapLinearFilter;
  laceTex.generateMipmaps = true;
  laceTex.anisotropy = 8;
  laceTex.colorSpace = THREE.NoColorSpace;
  laceTex.needsUpdate = true;
  // A read-only storage buffer, not a uniform array: a float uniform array
  // is padded to a 16-byte stride, and a table read through the wrong
  // stride looks like foam that will not thin.
  const cdfAttr = new StorageBufferAttribute(
    new Float32Array(wakeLaceCdfTable(laceImg, LACE_SIZE, undefined, undefined, look.laceWeights)), 1,
  );
  const uLaceCdf = storage(cdfAttr, 'float', cdfAttr.count).toReadOnly();
  // Round 6's net lace (the look's laceNet): built only when it is on, so
  // an older look allocates nothing and adds no node. (Round 14: not with
  // the trail, which replaces it.)
  const netOn = look.laceNet[2] > 0 && !trailOn;
  let netTex: THREE.DataTexture | null = null;
  let uNetCdf: TslNode = null;
  if (netOn) {
    const netImg = wakeNetImage(LACE_SIZE);
    netTex = new THREE.DataTexture(netImg, LACE_SIZE, LACE_SIZE, THREE.RGBAFormat);
    netTex.wrapS = THREE.RepeatWrapping;
    netTex.wrapT = THREE.RepeatWrapping;
    netTex.magFilter = THREE.LinearFilter;
    netTex.minFilter = THREE.LinearMipmapLinearFilter;
    netTex.generateMipmaps = true;
    netTex.anisotropy = 8;
    netTex.colorSpace = THREE.NoColorSpace;
    netTex.needsUpdate = true;
    const netCdf = new StorageBufferAttribute(
      new Float32Array(wakeLaceCdfTable(netImg, LACE_SIZE, undefined, undefined, WAKE_NET_WEIGHTS)), 1,
    );
    uNetCdf = storage(netCdf, 'float', netCdf.count).toReadOnly();
  }
  // Round 12's foam mass (the look's mass): built only when it is on, so an
  // older look allocates nothing and adds no node. About 0.3 s on the CPU.
  // (Round 14: not with the trail, which replaces it.)
  const massOn = look.mass[0] > 0 && !trailOn;
  let massTex: THREE.DataTexture | null = null;
  let massGradScale = 1;
  if (massOn) {
    const massImg = wakeMassImage(LACE_SIZE);
    massGradScale = massImg.gradScale;
    massTex = new THREE.DataTexture(massImg.data, LACE_SIZE, LACE_SIZE, THREE.RGBAFormat);
    massTex.wrapS = THREE.RepeatWrapping;
    massTex.wrapT = THREE.RepeatWrapping;
    massTex.magFilter = THREE.LinearFilter;
    massTex.minFilter = THREE.LinearMipmapLinearFilter;
    massTex.generateMipmaps = true;
    massTex.anisotropy = 8;
    massTex.colorSpace = THREE.NoColorSpace;
    massTex.needsUpdate = true;
  }
  // Round 14's trail texture (oceanWakeTrail.ts): built only when the trail
  // is on. About 0.4 s on the CPU.
  let trailTex: THREE.DataTexture | null = null;
  let trailGradScale = 1;
  if (trailOn) {
    const trailImg = wakeTrailImage(LACE_SIZE, undefined, look.trailTexture[0], look.trailTexture[1], look.trailTexture[2]);
    trailGradScale = trailImg.gradScale;
    trailTex = new THREE.DataTexture(trailImg.data, LACE_SIZE, LACE_SIZE, THREE.RGBAFormat);
    trailTex.wrapS = THREE.RepeatWrapping;
    trailTex.wrapT = THREE.RepeatWrapping;
    trailTex.magFilter = THREE.LinearFilter;
    trailTex.minFilter = THREE.LinearMipmapLinearFilter;
    trailTex.generateMipmaps = true;
    trailTex.anisotropy = 8;
    trailTex.colorSpace = THREE.NoColorSpace;
    trailTex.needsUpdate = true;
  }

  const uOvercast: TslNode = opts.overcast ?? uniform(0);
  const sun = (opts.sunDir ?? OCEAN_SUN_DIR).clone().normalize();

  // The sea's displacement planes, for its folding Jacobian (FOAM GATHERS
  // WHERE THE WATER CONVERGES). The same read the surface and the buoys
  // make (oceanSampler.ts), centered where the surface is (`step` copies it).
  const field = opts.field;
  const cascades = field.cascades;
  const uSeaCenter = uniform(new THREE.Vector2(0, 0));
  const { disp, sampleCascade, cascadeLod } = createOceanSampler(field.buffers, uSeaCenter);
  const foamCascades = cascades.map((c, i) => (c.drivesFoam ? i : -1)).filter((i) => i >= 0);

  // THE CALM LANE (round 16, the look's trailCalm): the share of the wake's
  // own waves kept at a texel of the breaking buffer (rate, lateral, behind):
  // `keep` inside the sheet's half-width (trailBand's halfM + spread d, no
  // wobble: the lift's vertex stage has no trail texture), all of it back by
  // reachM past it, grown in from d0 to d1 m behind the transom. World space.
  const calmOn = look.trailCalm[0] < 1 && trailOn;
  const calmAt = (k: TslNode): TslNode => {
    const tcl = look.trailCalm;
    const dC = max(k.z.sub(L / 2), float(0));
    const halfC = dC.mul(look.trailBand[2]).add(look.trailBand[1]);
    const inC = float(1).sub(smoothstep(halfC, halfC.add(tcl[1]), abs(k.y)))
      .mul(smoothstep(float(tcl[2]), float(tcl[3]), dC));
    // (Outside the window the buffer reads 0: behind 0, so the grow-in is 0
    // and the lane keeps all of its waves, which are 0 there too.)
    return float(1).sub(inC.mul(1 - tcl[0]));
  };

  // Surface shader logic reads the original settled textures and live uniforms.
  const reader = createWakeReader({ sampleWindow, inB, calmOn, tune, calmAt, inK, inA, look, massOn, trailOn, keysOnSide, keysOnAge, L, course, B, sideOn, laceTex, foamCascades, cascades, sampleCascade, disp, cascadeLod, hull, trailTex, mixUniform, trailGradScale, sun, uLaceCdf, netOn, netTex, uNetCdf, massTex, massGradScale, uOvercast });

  /* --- stepping ----------------------------------------------------- */

  const last: {
    window: WakeWindow | null; set: WakeSegmentSet | null; timeS: number; touches: WakeTouchPiece[];
  } = { window: null, set: null, timeS: NaN, touches: [] };

  return {
    reader,
    course,
    hull,
    grid,
    historyS,
    coherenceS,
    outA,
    outB,
    last,
    touches,
    dispatchList: dispatches,
    heightAt: (world: TslNode) => sampleWindow(inB, world).y,
    tune,
    look,
    step(renderer, simTimeS) {
      const w = wakeWindowAt(course, simTimeS, hull, historyS, grid);
      const set = wakeSegments(course, simTimeS, w, historyS, coherenceS);
      const n = Math.min(set.segs.length, WAKE_MAX_SEGMENTS);
      for (let j = 0; j < n; j += 1) {
        const s = set.segs[j];
        segVals[3 * j].set(s.du, s.dv, s.vu, s.vv);
        segVals[3 * j + 1].set(s.ageS, s.durS, s.decayAge, s.decayDur);
        segVals[3 * j + 2].set(s.cosH, s.sinH, s.arcM, s.speedMs);
      }
      uWaveCount.value = Math.min(set.waveCount, n);
      uFoamCount.value = n;
      uWin.value.set(w.oxM, w.ozM, w.hx, w.hz);
      uSeaCenter.value.copy(field.surface.center);
      const tp = wakeTouchPieces(touches, simTimeS, w, coherenceS);
      for (let j = 0; j < tp.length; j += 1) {
        const t = tp[j];
        touchVals[2 * j].set(t.du, t.dv, t.ageS, t.durS);
        touchVals[2 * j + 1].set(t.decayAge, t.decayDur, t.radiusM, t.volumeM3);
      }
      uTouchCount.value = tp.length;
      last.window = w;
      last.set = set;
      last.touches = tp;
      last.timeS = simTimeS;
      renderer.compute(dispatches as Parameters<THREE.WebGPURenderer['compute']>[0]);
    },
    dispose() {
      for (const d of dispatches) (d as { dispose?: () => void }).dispose?.();
      laceTex.dispose();
      netTex?.dispose();
      massTex?.dispose();
      trailTex?.dispose();
    },
  };
}
