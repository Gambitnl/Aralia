/**
 * @file oceanWake.test.ts — the CPU half of the wake, checked.
 *
 * The wake field lives on the GPU and vitest has none; the in-page
 * `__OCEAN__.extras.wake.crossCheck(t)` proves the kernels equal the CPU
 * mirror (relative RMS about 1e-5). What is proved here is the mirror
 * itself and the physics it claims:
 *
 *   - the closed-form piece integral against plain quadrature, and that
 *     splitting a piece changes nothing;
 *   - Kelvin's wake out of the dispersion relation alone: the transverse
 *     wavelength 2 pi U^2 / g, the wedge's edge at 19.47 degrees for a
 *     small source, and no wave energy outside the wedge for the trawler;
 *   - a plausible wave height abeam, quiet water ahead of the bow, and a
 *     pattern that stands still in the hull's frame on a straight course;
 *   - the course, the window and the taper that holds a turn;
 *   - the white water: the churn's decay and spread, the bubbles that
 *     outlast it, nothing inside the hull, the breakers only near the hull,
 *     the deposit's saturation and its decay down the track;
 *   - the lace's equalization, and determinism;
 *   - round 14's trail: its texture (ranked, tiling, a relief, holes of many
 *     sizes and fewer than the raft's), the jet's and the lanes' shear that
 *     never folds the coordinate, and its cover;
 *   - round 15's age grading: off in every earlier look, and on in r15;
 *   - round 16's sheet: off in every earlier look; its share (inside the
 *     band, gone outside it, thinning with age, its edge moved by the
 *     wobble), the arm lines on the wake's crests, and the calm lane;
 *   - round 17's graded margin: off in every earlier look; the fringe's lace
 *     (under the threshold only, fading with the depth under it, none at a
 *     zero share) and the milky water's profile.
 */
import { describe, expect, it } from 'vitest';
import { GRAVITY_MS2 } from '../oceanConfig';
import {
  WAKE_BREAK_ACTIVE,
  WAKE_BREAK_COVER_MAX,
  WAKE_BREAK_TAU_S,
  WAKE_BUBBLE_TAU_S,
  WAKE_COURSE,
  WAKE_GRID,
  WAKE_LACE_CDF_KNOTS,
  WAKE_LACE_WEIGHTS,
  WAKE_STERN_FOAM_PEAK,
  WAKE_STERN_FOAM_TAU_S,
  WAKE_TAPER_STEPS,
  WAKE_TOUCH_DEFAULT,
  WAKE_TRAWLER,
  WAKE_TRAWLER_SPEED_MS,
  WAKE_WAVE_MAKING,
  createWakeCourse,
  expm1OverZ,
  hullHalfBreadth,
  measureWakeHalfAngleDeg,
  realizeWakeCpu,
  wakeBreaking,
  wakeCapAlong,
  wakeSideRatio,
  wakeMixUniformCdf,
  parseWakeLook,
  WAKE_LOOK_DEFAULT,
  WAKE_LOOK_ROUND2,
  WAKE_LOOK_ROUND3,
  WAKE_LOOK_ROUND4,
  WAKE_LOOK_ROUND5,
  WAKE_LOOK_ROUND6,
  WAKE_LOOK_ROUND7,
  WAKE_LOOK_ROUND8,
  WAKE_LOOK_ROUND9,
  WAKE_LOOK_ROUND10,
  WAKE_LOOK_ROUND11,
  WAKE_LOOK_ROUND12,
  WAKE_LOOK_ROUND13,
  WAKE_LOOK_ROUND14,
  WAKE_LOOK_ROUND15,
  WAKE_LOOK_ROUND16,
  WAKE_LOOK_ROUND17,
  WAKE_NET_WEIGHTS,
  wakeMassImage,
  wakeNetImage,
  wakeDepositCpu,
  wakeFoamAt,
  wakeFroude,
  wakeHistoryFor,
  wakeLaceCdfTable,
  wakeLaceImage,
  wakeLaceRank,
  wakeModeAmplitude,
  wakePressureForHull,
  wakePressureTransform,
  wakeSegmentIntegral,
  wakeSegments,
  wakeTouchPieces,
  wakeWindowAt,
  wakeWindowFor,
  type WakeFieldCpu,
  type WakeGrid,
  type WakeHull,
  type WakeSegment,
  type WakeWindow,
} from '../oceanWakeMath';
import {
  wakeTrailArmShare, wakeTrailBandShare, wakeTrailCover, wakeTrailFringe, wakeTrailImage, wakeTrailLanesM,
  wakeTrailMilkWater, wakeTrailShearM,
} from '../oceanWakeTrail';

const hull = WAKE_TRAWLER;
const U = WAKE_TRAWLER_SPEED_MS;
const pr = wakePressureForHull(hull);
const course = createWakeCourse(WAKE_COURSE);
const { historyS, coherenceS } = wakeHistoryFor(hull, U, WAKE_GRID);

/** The trawler's steady wake at the judged time, 42 s, 480 m into a straight. */
function trawlerAt(tS = 42): { f: WakeFieldCpu; w: WakeWindow; segs: WakeSegment[]; waveCount: number } {
  const w = wakeWindowAt(course, tS, hull, historyS, WAKE_GRID);
  const set = wakeSegments(course, tS, w, historyS, coherenceS);
  const f = realizeWakeCpu(set.segs.slice(0, set.waveCount), pr, WAKE_GRID, coherenceS);
  return { f, w, segs: set.segs, waveCount: set.waveCount };
}

const steady = trawlerAt(42);

describe('the course', () => {
  it('moves at its speed and is continuous, turns included', () => {
    for (const t of [0, 42, 190, 200, 250, 300, 500]) {
      const a = course.at(t);
      const b = course.at(t + 0.01);
      const v = Math.hypot(b.xM - a.xM, b.zM - a.zM) / 0.01;
      expect(v).toBeCloseTo(U, 3);
    }
  });

  it('is a closed loop', () => {
    const period = course.perimeterM / U;
    const a = course.at(10);
    const b = course.at(10 + period);
    expect(Math.hypot(a.xM - b.xM, a.zM - b.zM)).toBeLessThan(1e-6);
  });

  it('puts the hull where the judged frames expect it', () => {
    const p = course.at(42);
    expect(p.xM).toBeCloseTo(0, 6);
    expect(p.zM).toBeCloseTo(-15, 6);
    expect(p.headingRad).toBeCloseTo(-Math.PI / 2, 9);
  });

  it('gives a straight history as one piece, and its vertices on the course', () => {
    expect(course.polyline(42, historyS)).toHaveLength(2);
    const poly = course.polyline(250, historyS);
    expect(poly.length).toBeGreaterThan(5);
    for (const v of poly) {
      const p = course.at(v.tS);
      expect(Math.hypot(p.xM - v.xM, p.zM - v.zM)).toBeLessThan(1e-6);
    }
  });

  it('keeps its turn vertices fixed from frame to frame', () => {
    const a = course.polyline(250, historyS).slice(1, -1).map((v) => v.tS);
    const b = course.polyline(250.37, historyS).slice(1, -1).map((v) => v.tS);
    const shared = a.filter((t) => b.some((u) => Math.abs(u - t) < 1e-9));
    expect(shared.length).toBeGreaterThan(a.length - 3);
  });
});

describe('the hull and its pressure', () => {
  it('has a pointed stem, a wide transom and the beam at midship', () => {
    expect(hullHalfBreadth(hull, 0)).toBeCloseTo(hull.beamM / 2, 9);
    expect(hullHalfBreadth(hull, 0.999)).toBeLessThan(0.2);
    expect(hullHalfBreadth(hull, -0.9999)).toBeCloseTo(hull.transomShare * hull.beamM / 2, 2);
    for (let xi = -1; xi < 1; xi += 0.01) expect(hullHalfBreadth(hull, xi)).toBeLessThanOrEqual(hull.beamM / 2 + 1e-9);
  });

  it('holds the displaced volume times the wave-making share', () => {
    const volume = hull.blockCoefficient * hull.lengthM * hull.beamM * hull.draftM;
    expect(wakePressureTransform(pr, 0, 0)).toBeCloseTo(WAKE_WAVE_MAKING * volume, 6);
  });

  it('transforms as its direct integral does', () => {
    // p(x, y) = head * box_smooth(x) * gauss(y); integrate it on a grid.
    const erf = (x: number) => {
      const t = 1 / (1 + 0.3275911 * Math.abs(x));
      const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
      return x >= 0 ? y : -y;
    };
    const box = (x: number) => 0.5 * (erf((x + pr.lengthM / 2) / (Math.SQRT2 * pr.endSmoothM)) - erf((x - pr.lengthM / 2) / (Math.SQRT2 * pr.endSmoothM)));
    for (const [ka, kc] of [[0.2, 0], [0.35, 0.3], [0, 0.6], [0.9, 0.1]]) {
      let re = 0;
      const dx = 0.05;
      for (let x = -30; x <= 30; x += dx) re += box(x) * Math.cos(ka * x) * dx;
      let gy = 0;
      for (let y = -15; y <= 15; y += dx) gy += Math.exp(-0.5 * (y / pr.sigmaYM) ** 2) * Math.cos(kc * y) * dx;
      const direct = pr.headM * re * gy;
      expect(wakePressureTransform(pr, ka, kc)).toBeCloseTo(direct, 2);
    }
  });
});

describe('the closed form', () => {
  it('(e^z - 1) / z is continuous through its series', () => {
    const a: [number, number] = [0, 0];
    const b: [number, number] = [0, 0];
    expm1OverZ(1e-5, 2e-5, a);
    expm1OverZ(2e-4, 3e-4, b);
    expect(a[0]).toBeCloseTo(1, 4);
    expect(b[0]).toBeCloseTo(1 + 1e-4, 4);
  });

  it('integrates a piece as quadrature does, resonance included', () => {
    const seg: WakeSegment = {
      du: 300, dv: 128, vu: -U, vv: 0, ageS: 3, durS: 20,
      decayAge: Math.exp(-3 / coherenceS), decayDur: Math.exp(-20 / coherenceS), weight: 1,
      cosH: 1, sinH: 0, arcM: 18, speedMs: U,
    };
    const k0 = GRAVITY_MS2 / (U * U);
    for (const [ku, kv] of [[k0, 0], [0.8 * k0, 0.3], [-k0 * 1.2, 0.5], [0.05, -0.02], [1.5, 0.7]]) {
      const omega = Math.sqrt(GRAVITY_MS2 * Math.hypot(ku, kv));
      const out: [number, number] = [0, 0];
      wakeSegmentIntegral(ku, kv, omega, seg, coherenceS, out);
      let re = 0;
      let im = 0;
      const n = 200000;
      const ds = seg.durS / n;
      for (let i = 0; i < n; i += 1) {
        const s = seg.ageS + (i + 0.5) * ds;
        const pu = seg.du + seg.vu * (s - seg.ageS);
        const pv = seg.dv + seg.vv * (s - seg.ageS);
        const amp = Math.exp(-s / coherenceS) * Math.sin(omega * s);
        const ph = -(ku * pu + kv * pv);
        re += amp * Math.cos(ph) * ds;
        im += amp * Math.sin(ph) * ds;
      }
      expect(out[0]).toBeCloseTo(re, 4);
      expect(out[1]).toBeCloseTo(im, 4);
    }
  });

  it('gives the same sum when a straight piece is split', () => {
    const base = steady.segs[0];
    const cut = 17.3;
    const a: WakeSegment = { ...base, durS: cut, decayDur: Math.exp(-cut / coherenceS) };
    const bAge = base.ageS + cut;
    const b: WakeSegment = {
      ...base, du: base.du + base.vu * cut, dv: base.dv + base.vv * cut, ageS: bAge,
      durS: base.durS - cut, decayAge: Math.exp(-bAge / coherenceS), decayDur: Math.exp(-(base.durS - cut) / coherenceS),
    };
    const area = WAKE_GRID.nu * WAKE_GRID.nv;
    for (const [ku, kv] of [[0.4, 0.02], [0.5, -0.4], [1.1, 0.9]]) {
      const one: [number, number] = [0, 0];
      const two: [number, number] = [0, 0];
      wakeModeAmplitude(ku, kv, [base], pr, coherenceS, area, one);
      wakeModeAmplitude(ku, kv, [a, b], pr, coherenceS, area, two);
      expect(two[0]).toBeCloseTo(one[0], 12);
      expect(two[1]).toBeCloseTo(one[1], 12);
    }
  });
});

/** The slope energy of a field row by row, split by angle from the track. */
function energyByAngle(f: WakeFieldCpu, w: WakeWindow, fromM: number, toM: number, splitDeg: number): { outside: number; total: number; band: number } {
  const t = w.grid.texelM;
  const v0 = (w.grid.nv * t) / 2;
  let outside = 0;
  let total = 0;
  let band = 0;
  for (let d = fromM; d <= toM; d += t) {
    const i = Math.round((w.hullUM - d) / t);
    for (let j = 0; j < f.nv; j += 1) {
      const c = j * f.nu + i;
      const e = f.etaU[c] ** 2 + f.etaV[c] ** 2;
      const ang = (Math.atan(Math.abs(j * t - v0) / d) * 180) / Math.PI;
      total += e;
      if (ang > splitDeg) outside += e;
      if (ang > 15 && ang <= splitDeg) band += e;
    }
  }
  return { outside, total, band };
}

describe('Kelvin', () => {
  it('runs the trawler at Fr 0.35', () => {
    expect(wakeFroude(hull, U)).toBeCloseTo(0.35, 2);
  });

  it('makes transverse waves of length 2 pi U^2 / g along the track', () => {
    const { f, w } = steady;
    const j = WAKE_GRID.nv / 2;
    const iHull = Math.round(w.hullUM / WAKE_GRID.texelM);
    const ups: number[] = [];
    for (let i = iHull - 40; i > iHull - 240; i -= 1) {
      const a = f.eta[j * f.nu + i];
      const b = f.eta[j * f.nu + i - 1];
      // Sub-texel crossing.
      if (a > 0 && b <= 0) ups.push(i - a / (a - b));
    }
    const lambda = ((ups[0] - ups[ups.length - 1]) / (ups.length - 1)) * WAKE_GRID.texelM;
    expect(lambda / ((2 * Math.PI * U * U) / GRAVITY_MS2)).toBeGreaterThan(0.97);
    expect(lambda / ((2 * Math.PI * U * U) / GRAVITY_MS2)).toBeLessThan(1.03);
  });

  it('puts the wedge edge at asin(1/3) for a small source', () => {
    // A near-point source, sigma 1.2 m at Fr_D 0.82, on a finer grid and a
    // long, undamped history: the far field is Kelvin's.
    const s = 1.2;
    const speed = 4.0;
    const grid: WakeGrid = { nu: 1024, nv: 512, texelM: 0.5 };
    const point: WakeHull = { lengthM: 0.01, beamM: 4 * s, draftM: 1, blockCoefficient: 0.5, transomShare: 1 };
    const ppr = { lengthM: 1e-3, endSmoothM: s, sigmaYM: s, headM: 200 };
    const c = createWakeCourse({ ...WAKE_COURSE, speedMs: speed, straightM: 5000, refAlongM: 3000 });
    const w = wakeWindowFor(c.at(42), point, grid);
    const S = (grid.nu * grid.texelM - 60) / speed;
    const set = wakeSegments(c, 42, w, S, 1e4);
    const f = realizeWakeCpu(set.segs.slice(0, set.waveCount), ppr, grid, 1e4);
    const lam = (2 * Math.PI * speed * speed) / GRAVITY_MS2;
    const ang = measureWakeHalfAngleDeg(f, w, 20 * lam, 0.5 * speed * S, speed);
    const kelvin = (Math.asin(1 / 3) * 180) / Math.PI;
    expect(Math.abs(ang.edgeDeg - kelvin)).toBeLessThan(1.5);
  });

  it('keeps the trawler\'s wave energy inside the wedge and on its side', () => {
    // From 100 m back, where the edge's Airy tail, about (d lambda^2)^(1/3)
    // wide, is a fraction of the wedge: 1.7% of the slope energy lies past
    // 23 degrees, none past 30.
    const { f, w } = steady;
    const e = energyByAngle(f, w, 100, 250, 23);
    expect(e.outside / e.total).toBeLessThan(0.025);
    expect(energyByAngle(f, w, 100, 250, 30).outside / e.total).toBeLessThan(0.001);
    // The V's side carries real energy: the diverging waves.
    expect(e.band / e.total).toBeGreaterThan(0.15);
    const ang = measureWakeHalfAngleDeg(f, w, 60, 250, U);
    expect(ang.edgeDeg).toBeGreaterThan(18);
    expect(ang.edgeDeg).toBeLessThan(23);
  });

  it('leaves the water ahead of the bow quiet', () => {
    const { f, w } = steady;
    const t = WAKE_GRID.texelM;
    const rms = (u0: number, u1: number) => {
      let s = 0;
      let n = 0;
      for (let u = u0; u < u1; u += t) {
        const i = Math.round(u / t);
        for (let j = 0; j < f.nv; j += 1) { s += f.eta[j * f.nu + i] ** 2; n += 1; }
      }
      return Math.sqrt(s / n);
    };
    const stem = w.hullUM + hull.lengthM / 2;
    expect(rms(stem + 12, stem + 25) / rms(w.hullUM - 150, w.hullUM - 50)).toBeLessThan(0.1);
  });

  it('makes a 0.3 to 0.9 m wave one hull length abeam', () => {
    const { f } = steady;
    const j = Math.round(WAKE_GRID.nv / 2 + hull.lengthM / WAKE_GRID.texelM);
    let hi = -Infinity;
    let lo = Infinity;
    for (let i = 0; i < f.nu; i += 1) { hi = Math.max(hi, f.eta[j * f.nu + i]); lo = Math.min(lo, f.eta[j * f.nu + i]); }
    expect(hi - lo).toBeGreaterThan(0.3);
    expect(hi - lo).toBeLessThan(0.9);
  });

  it('stands still in the hull\'s frame on a straight course', () => {
    const later = trawlerAt(45.5);
    let d = 0;
    let r = 0;
    for (let c = 0; c < steady.f.eta.length; c += 1) {
      d += (later.f.eta[c] - steady.f.eta[c]) ** 2;
      r += steady.f.eta[c] ** 2;
    }
    expect(Math.sqrt(d / r)).toBeLessThan(1e-6);
  });

  it('is deterministic', () => {
    const again = trawlerAt(42);
    for (let c = 0; c < steady.f.eta.length; c += 97) expect(again.f.eta[c]).toBe(steady.f.eta[c]);
  });
});

describe('a touch', () => {
  // A touch at the center of a 64 m window at 0.25 m, seen 8 s later.
  const grid: WakeGrid = { nu: 256, nv: 256, texelM: 0.25 };
  const w: WakeWindow = { grid, oxM: -32, ozM: -32, hx: 1, hz: 0, lx: 0, lz: 1, hullUM: 32 };
  const t = 8;
  const pieces = wakeTouchPieces([{ xM: 0, zM: 0, tS: 0, ...WAKE_TOUCH_DEFAULT }], t, w, 1e4);
  const f = realizeWakeCpu([], pr, grid, 1e4, pieces);
  /** Twice the mean spacing of zero crossings along +x within [r0, r1] of the touch. */
  const wavelength = (r0: number, r1: number) => {
    const j = 128;
    const zs: number[] = [];
    for (let i = 128 + Math.round(r0 / 0.25); i < 128 + Math.round(r1 / 0.25); i += 1) {
      const a = f.eta[j * 256 + i];
      const b = f.eta[j * 256 + i + 1];
      if ((a <= 0 && b > 0) || (a > 0 && b <= 0)) zs.push((i + a / (a - b)) * 0.25);
    }
    return (2 * (zs[zs.length - 1] - zs[0])) / (zs.length - 1);
  };

  it('rings, and the outer rings are the longer (Cauchy-Poisson)', () => {
    // Stationary phase: at radius r and time t the ring's wavenumber is
    // g t^2 / (4 r^2), so its length goes as r^2: 3.0 m at 8.5 m, 12 m at
    // 17 m. A ripple with one speed would keep one length.
    const lambdaAt = (r: number) => (8 * Math.PI * r * r) / (GRAVITY_MS2 * t * t);
    const inner = wavelength(6, 11);
    const outer = wavelength(12, 28);
    expect(inner / lambdaAt(8.5)).toBeGreaterThan(0.75);
    expect(inner / lambdaAt(8.5)).toBeLessThan(1.3);
    expect(outer / inner).toBeGreaterThan(2.5);
  });

  it('is silent before it starts and gone past three coherence times', () => {
    expect(wakeTouchPieces([{ xM: 0, zM: 0, tS: 5, ...WAKE_TOUCH_DEFAULT }], 4.9, w, 20)).toHaveLength(0);
    expect(wakeTouchPieces([{ xM: 0, zM: 0, tS: 5, ...WAKE_TOUCH_DEFAULT }], 5 + 61, w, 20)).toHaveLength(0);
    expect(wakeTouchPieces([{ xM: 0, zM: 0, tS: 5, ...WAKE_TOUCH_DEFAULT }], 5.1, w, 20)).toHaveLength(1);
  });

  it('raises a first ring of a plausible height', () => {
    let hi = 0;
    for (let i = 128 + 8; i < 256; i += 1) hi = Math.max(hi, Math.abs(f.eta[128 * 256 + i]));
    expect(hi).toBeGreaterThan(0.02);
    expect(hi).toBeLessThan(0.4);
  });
});

describe('the window and the taper', () => {
  it('holds the whole straight history, untapered', () => {
    const set = wakeSegments(course, 42, steady.w, historyS, coherenceS);
    expect(set.waveHistoryS).toBeCloseTo(historyS, 6);
    expect(set.segs.every((s) => s.weight === 1)).toBe(true);
    // The truncated copy is 5% and in the rear fade.
    expect(Math.exp(-historyS / coherenceS)).toBeCloseTo(Math.exp(-3), 9);
  });

  it('cuts a turn where the course leaves the window, and tapers it down', () => {
    const w = wakeWindowAt(course, 250, hull, historyS, WAKE_GRID);
    const set = wakeSegments(course, 250, w, historyS, coherenceS);
    expect(set.waveHistoryS).toBeLessThan(historyS);
    expect(set.waveHistoryS).toBeGreaterThan(0.5 * historyS);
    const weights = set.segs.slice(0, set.waveCount).map((s) => s.weight);
    for (let i = 1; i < weights.length; i += 1) expect(weights[i]).toBeLessThanOrEqual(weights[i - 1] + 1e-12);
    const levels = new Set(weights.map((x) => x.toFixed(4)));
    expect(levels.size).toBe(WAKE_TAPER_STEPS + 1);
    // No wave-making piece leaves the window.
    const lu = WAKE_GRID.nu * WAKE_GRID.texelM;
    const lv = WAKE_GRID.nv * WAKE_GRID.texelM;
    for (const s of set.segs.slice(0, set.waveCount)) {
      const ou = s.du + s.vu * s.durS;
      const ov = s.dv + s.vv * s.durS;
      expect(ou).toBeGreaterThan(0);
      expect(ou).toBeLessThan(lu);
      expect(ov).toBeGreaterThan(0);
      expect(ov).toBeLessThan(lv);
    }
  });
});

describe('the white water', () => {
  const { w, segs } = steady;
  const at = (behindStern: number, lateral: number) => {
    const u = w.hullUM - hull.lengthM / 2 - behindStern;
    return wakeFoamAt(u, WAKE_GRID.nv * WAKE_GRID.texelM / 2 + lateral, segs, hull);
  };

  it('churns behind the transom and decays with its time constant', () => {
    // Past the boil (60 m back it is e^-5 of itself), the trail decays as
    // e^{-t/TAU}: 0.75 e^{-1} = 0.28 of cover at 60 m.
    const a = at(60, 0);
    const b = at(60 + U * WAKE_STERN_FOAM_TAU_S, 0);
    expect(a.foam).toBeGreaterThan(0.3 * WAKE_STERN_FOAM_PEAK);
    expect(b.foam / a.foam).toBeCloseTo(Math.exp(-1), 1);
    // The boil: solid white just aft of the transom.
    expect(at(2, 0).foam).toBeGreaterThan(1);
  });

  it('spreads as it ages', () => {
    const half = (d: number) => {
      const peak = at(d, 0).foam;
      let n = 0;
      while (at(d, n).foam > peak / 2 && n < 60) n += 0.1;
      return n;
    };
    expect(half(150)).toBeGreaterThan(1.8 * half(3));
  });

  it('leaves bubbles that outlast the foam', () => {
    const d = U * 40;
    const f = at(d, 0);
    expect(f.bubbles / at(3, 0).bubbles).toBeCloseTo(Math.exp(-(d - 3) / U / WAKE_BUBBLE_TAU_S), 1);
    expect(f.bubbles).toBeGreaterThan(f.foam);
  });

  it('puts no churn ahead of the transom and no foam inside the hull', () => {
    expect(at(-3, 0).foam).toBe(0);
    expect(at(-10, 1).inside).toBe(true);
    expect(at(-10, 1).foam).toBe(0);
    expect(at(-10, 10).foam).toBe(0);
  });

  it('breaks at the bow and near the hull, and nowhere far out', () => {
    const { f } = steady;
    const t = WAKE_GRID.texelM;
    const brk = new Float64Array(f.eta.length);
    const lat = new Float64Array(f.eta.length);
    const beh = new Float64Array(f.eta.length);
    let near = 0;
    let far = 0;
    let bow = 0;
    for (let j = 0; j < f.nv; j += 1) {
      for (let i = 0; i < f.nu; i += 1) {
        const c = j * f.nu + i;
        const s = wakeFoamAt(i * t, j * t, segs, hull);
        brk[c] = wakeBreaking(f.eta[c], Math.hypot(f.etaU[c], f.etaV[c]), s.lateralM, s.behindM, hull);
        lat[c] = s.lateralM;
        beh[c] = s.behindM;
        const d = Math.hypot(i * t - w.hullUM, j * t - (f.nv * t) / 2);
        if (brk[c] > 0.5 && d < 2 * hull.lengthM) near += 1;
        if (brk[c] > 0.05 && d > 4 * hull.lengthM) far += 1;
        if (brk[c] > 0.5 && -s.behindM > 0.3 * hull.lengthM) bow += 1;
      }
    }
    expect(near).toBeGreaterThan(10);
    expect(bow).toBeGreaterThan(3);
    expect(far).toBe(0);
    // The deposit saturates, and decays down the track.
    const dep = wakeDepositCpu(brk, lat, beh, WAKE_GRID, U, hull);
    let max = 0;
    for (const x of dep.foam) max = Math.max(max, x);
    expect(max).toBeLessThanOrEqual(Math.max(WAKE_BREAK_COVER_MAX, WAKE_BREAK_ACTIVE) + 1e-12);
    expect(max).toBeGreaterThan(0.25);
    // The bow's white water runs back along the flanks: beside the hull at
    // midship, 0.5 to 2 m off the waterline, there is foam; inside, none.
    const iMid = Math.round(w.hullUM / t);
    const jSide = Math.round((f.nv * t) / 2 / t + (hull.beamM / 2 + 1) / t);
    const jIn = Math.round((f.nv * t) / 2 / t + 1 / t);
    expect(dep.foam[jSide * f.nu + iMid]).toBeGreaterThan(0.1);
    expect(dep.foam[jIn * f.nu + iMid]).toBe(0);
  });

  it('decays a single breaker\'s deposit with its time constant', () => {
    const grid: WakeGrid = { nu: 256, nv: 4, texelM: 1 };
    const brk = new Float64Array(grid.nu * grid.nv);
    // A weak breaker: its cover is small, where 1 - e^{-F} is linear, so the
    // ratio of covers is the decay. Far behind and beside the hull, where
    // the streamline is straight.
    brk[1 * grid.nu + 200] = 0.02;
    const lat = new Float64Array(grid.nu * grid.nv).fill(40);
    const beh = new Float64Array(grid.nu * grid.nv).fill(300);
    const dep = wakeDepositCpu(brk, lat, beh, grid, U, hull);
    const a = dep.foam[1 * grid.nu + 200];
    // One texel aft of the crest, where the active whitecap is gone.
    const a1 = dep.foam[1 * grid.nu + 199];
    const b1 = dep.foam[1 * grid.nu + 199 - Math.round(U * WAKE_BREAK_TAU_S)];
    expect(b1 / a1).toBeCloseTo(Math.exp(-1), 2);
    expect(a).toBeGreaterThan(0);
    expect(dep.foam[1 * grid.nu + 201]).toBe(0);
  });
});

describe('the back-face cap (round 3)', () => {
  it('keeps small slopes, saturates large ones under the cap, leaves slopes toward the eye', () => {
    const cap = 0.7 * (12 / 40);
    expect(wakeCapAlong(0.001, cap)).toBeCloseTo(0.001, 5);
    for (const s of [0.05, 0.2, 0.5, 2, 10]) {
      expect(wakeCapAlong(s, cap)).toBeLessThan(cap);
      expect(wakeCapAlong(s, cap)).toBeGreaterThan(0);
    }
    expect(wakeCapAlong(0.5, cap)).toBeGreaterThan(wakeCapAlong(0.2, cap));
    expect(wakeCapAlong(-0.4, cap)).toBe(-0.4);
  });
  it('with a knee (round 4) leaves slopes under it alone, is continuous there, and still never reaches the cap', () => {
    const tanE = 12 / 40;
    const cap = 0.95 * tanE;
    const knee = 0.8 * tanE;
    for (const s of [-0.3, 0, 0.05, 0.2, knee - 1e-9]) expect(wakeCapAlong(s, cap, knee)).toBe(s);
    expect(wakeCapAlong(knee + 1e-6, cap, knee)).toBeCloseTo(knee + 1e-6, 6);
    for (const s of [0.26, 0.4, 1, 10]) {
      expect(wakeCapAlong(s, cap, knee)).toBeGreaterThan(knee);
      expect(wakeCapAlong(s, cap, knee)).toBeLessThan(cap);
    }
    expect(wakeCapAlong(1, cap, knee)).toBeGreaterThan(wakeCapAlong(0.4, cap, knee));
    // A knee of 0 is round 3's cap.
    for (const s of [0.05, 0.2, 0.5]) expect(wakeCapAlong(s, cap, 0)).toBeCloseTo(wakeCapAlong(s, cap), 12);
    // At the chase pose (elevation 0.68 and up, wake slopes under 0.4) the
    // knee at 0.8 bends nothing.
    for (const s of [0.1, 0.25, 0.4]) expect(wakeCapAlong(s, 0.95 * 0.68, 0.8 * 0.68)).toBe(s);
  });
});

describe('the look (round 4)', () => {
  it('ships round 11: the look that won both judged views in both orders (round 18)', () => {
    // Round 18: round 11's look won the live Water Pro quarter view and the
    // chase view in both side orders; every later preset is kept.
    expect(WAKE_LOOK_DEFAULT).toEqual(WAKE_LOOK_ROUND11);
    expect(parseWakeLook('')).toEqual(WAKE_LOOK_ROUND11);
    expect(parseWakeLook('r11')).toEqual(WAKE_LOOK_DEFAULT);
    for (const p of ['r2', 'r3', 'r4', 'r5', 'r6', 'r7', 'r8', 'r9', 'r10', 'r11', 'r12', 'r13', 'r14', 'r15', 'r16', 'r17']) {
      expect(() => parseWakeLook(p)).not.toThrow();
    }
    // Round 11 draws no trail and no layer: the lace and the solid band.
    expect(WAKE_LOOK_ROUND11.trail[0]).toBe(0);
    expect(WAKE_LOOK_ROUND11.mass[0]).toBe(0);
  });

  it('keeps round 17 as a preset: round 16\'s sheet with a graded margin and milky water', () => {
    expect(parseWakeLook('r16')).toEqual(WAKE_LOOK_ROUND16);
    expect(parseWakeLook('r17')).toEqual(WAKE_LOOK_ROUND17);
    // Round 17's fields are off in every earlier look, so `r16` and older
    // draw their rounds to the pixel (the off-value proofs against the
    // round-16 files and ours/r16s-*).
    for (const l of [WAKE_LOOK_ROUND2, WAKE_LOOK_ROUND3, WAKE_LOOK_ROUND4, WAKE_LOOK_ROUND5, WAKE_LOOK_ROUND6,
      WAKE_LOOK_ROUND7, WAKE_LOOK_ROUND8, WAKE_LOOK_ROUND9, WAKE_LOOK_ROUND10, WAKE_LOOK_ROUND11, WAKE_LOOK_ROUND12,
      WAKE_LOOK_ROUND13, WAKE_LOOK_ROUND14, WAKE_LOOK_ROUND15, WAKE_LOOK_ROUND16]) {
      expect(l.trailFringe[1] + l.trailArmSoft[0] + l.trailMilkWater[0] + l.trailMilkWater[4] + l.trailClot[0]).toBe(0);
      expect(l.trailHalo[2] + l.trailBlur[0] + l.trailDots[0]).toBe(0);
    }
    const r17 = WAKE_LOOK_ROUND17;
    // The margin, the soft arms and the milky water are on; the halo, the
    // world blur and the bubble dots are built and off (see their docs).
    expect(r17.trailFringe[1]).toBeGreaterThan(0);
    expect(r17.trailArmSoft[0]).toBeGreaterThan(0);
    expect(r17.trailMilkWater[0]).toBeGreaterThan(0);
    expect(r17.trailHalo[2] + r17.trailBlur[0] + r17.trailDots[0]).toBe(0);
    // Round 16's sheet, clear edge and calm lane are kept.
    expect(r17.trailBand[0]).toBeGreaterThan(0.8);
    expect(r17.trailCalm[0]).toBeLessThan(1);
    expect(r17.trailCut[1]).toBeGreaterThan(r17.trailCut[0]);
  });

  it('ships round 16 as a preset: round 14\'s trail as one connected sheet with a clear edge', () => {
    expect(parseWakeLook('r15')).toEqual(WAKE_LOOK_ROUND15);
    expect(parseWakeLook('r16')).toEqual(WAKE_LOOK_ROUND16);
    // Round 16's fields are off in every earlier look, so `r15` and `r14`
    // draw their rounds to the pixel (the off-value proofs against
    // ours/r15L-* and ours/r14w-*).
    for (const l of [WAKE_LOOK_ROUND2, WAKE_LOOK_ROUND3, WAKE_LOOK_ROUND4, WAKE_LOOK_ROUND5, WAKE_LOOK_ROUND6,
      WAKE_LOOK_ROUND7, WAKE_LOOK_ROUND8, WAKE_LOOK_ROUND9, WAKE_LOOK_ROUND10, WAKE_LOOK_ROUND11, WAKE_LOOK_ROUND12,
      WAKE_LOOK_ROUND13, WAKE_LOOK_ROUND14, WAKE_LOOK_ROUND15]) {
      expect(l.trailBand[0] + l.trailHoles[0] + l.trailArmLine[0] + l.trailCut[1] + l.trailBandGlow[0]).toBe(0);
      expect(l.trailEdge[0]).toBe(1);
      expect(l.trailBody[0]).toBe(1);
      expect(l.trailCalm[0]).toBe(1);
    }
    // Round 16 builds on round 14, not round 15: round 15's streaks,
    // flakes, milk and old-foam film are off in it.
    const r16 = WAKE_LOOK_ROUND16;
    expect(r16.trail[0]).toBe(1);
    expect(r16.trailAge[5] + r16.trailArms[0] + r16.trailArms[1] + r16.trailThin[1] + r16.trailThin[2]).toBe(0);
    expect(r16.trailMilk[0] + r16.trailMilk[2] + r16.trailMilkGlow[0] + r16.trailMilkGlow[2] + r16.trailBump[0]).toBe(0);
    expect(r16.trailOld[0]).toBe(1);
    // The sheet, its clear edge, the arms as their own lines (the amount's
    // edge lines off, so the edge does not cut them), no flakes, the calm lane.
    expect(r16.trailBand[0]).toBeGreaterThan(0.8);
    expect(r16.edgeLines[0]).toBe(0);
    expect(r16.trailArmLine[0]).toBeGreaterThan(0);
    expect(r16.trailCut[1]).toBeGreaterThan(r16.trailCut[0]);
    expect(r16.trailCalm[0]).toBeLessThan(1);
    // No relief: round 14's lit heaps were the chase judge's "cotton-wool clouds".
    expect(r16.trailLight[2]).toBe(0);
  });

  it('ships round 15 as a preset: round 14\'s trail graded by its age', () => {
    expect(parseWakeLook('r14')).toEqual(WAKE_LOOK_ROUND14);
    // Round 15's fields are off in every earlier look, so `r14` draws
    // round 14 to the pixel (the off-value proof against ours/r14w-*).
    for (const l of [WAKE_LOOK_ROUND2, WAKE_LOOK_ROUND3, WAKE_LOOK_ROUND4, WAKE_LOOK_ROUND5, WAKE_LOOK_ROUND6,
      WAKE_LOOK_ROUND7, WAKE_LOOK_ROUND8, WAKE_LOOK_ROUND9, WAKE_LOOK_ROUND10, WAKE_LOOK_ROUND11, WAKE_LOOK_ROUND12,
      WAKE_LOOK_ROUND13, WAKE_LOOK_ROUND14]) {
      expect(l.trailAge[2] + l.trailAge[5] + l.trailArms[0] + l.trailArms[1]).toBe(0);
      expect(l.trailMilk[0] + l.trailMilk[2] + l.trailYoung[0] + l.trailMilkGlow[0] + l.trailMilkGlow[2]).toBe(0);
      expect(l.trailBump[0]).toBe(0);
      expect(l.trailOld[0]).toBe(1);
      expect(l.trailThin[1]).toBe(0);
      expect(l.trailThin[2]).toBe(0);
      expect(l.trailCore[6]).toBeGreaterThanOrEqual(0);
    }
    // Round 15 changes round 14 only in its own fields and the trail's
    // existing controls it retunes.
    const r15Only = ['trailAge', 'trailStreak', 'trailArms', 'trailMilk', 'trailYoung', 'trailMilkGlow', 'trailBump',
      'trailOld', 'trailThin', 'trail', 'trailCore', 'trailLight', 'trailGlow', 'trailFil'];
    for (const k of Object.keys(WAKE_LOOK_ROUND14) as (keyof typeof WAKE_LOOK_ROUND14)[]) {
      if (!r15Only.includes(k)) expect(WAKE_LOOK_ROUND15[k]).toEqual(WAKE_LOOK_ROUND14[k]);
    }
    // The age grading: the lace opens and the streaks take over after the
    // young core, which is brighter and milkier; the old foam thins.
    expect(WAKE_LOOK_ROUND15.trailAge[2]).toBeGreaterThan(0);
    expect(WAKE_LOOK_ROUND15.trailAge[3]).toBeGreaterThan(WAKE_LOOK_ROUND15.trailAge[0]);
    expect(WAKE_LOOK_ROUND15.trailYoung[0]).toBeGreaterThan(0);
    expect(WAKE_LOOK_ROUND15.trailMilk[2]).toBeGreaterThan(0);
    expect(WAKE_LOOK_ROUND15.trailOld[0]).toBeLessThan(1);
  });

  it('ships round 14 as a preset: round 13\'s amount drawn by the trail', () => {
    expect(parseWakeLook('r13')).toEqual(WAKE_LOOK_ROUND13);
    // Round 14's path is gated by trail[0] and is off in every earlier
    // look, so `r13` and `r11` draw their rounds to the pixel (the
    // off-value proofs against ours/r13w-* and ours/r11w-*).
    for (const l of [WAKE_LOOK_ROUND2, WAKE_LOOK_ROUND3, WAKE_LOOK_ROUND4, WAKE_LOOK_ROUND5, WAKE_LOOK_ROUND6,
      WAKE_LOOK_ROUND7, WAKE_LOOK_ROUND8, WAKE_LOOK_ROUND9, WAKE_LOOK_ROUND10, WAKE_LOOK_ROUND11, WAKE_LOOK_ROUND12,
      WAKE_LOOK_ROUND13]) {
      expect(l.trail[0]).toBe(0);
      // Every sub-path is at its neutral value too.
      expect(l.trailShear[0] + l.trailLanes[0] + l.trailFil[1] + l.trailCore[0] + l.trailFilm[2]).toBe(0);
      expect(l.trailGrain[0]).toBe(1);
    }
    // Round 14 changes round 13 only in its own fields, the band's spread
    // and the edge lines (the arms spread and thin).
    const r14Only = ['trail', 'trailTexture', 'trailFil', 'trailShear', 'trailLanes', 'trailFineStretch', 'trailCover',
      'trailCore', 'trailFilm', 'trailGrain', 'trailOpac', 'trailLight', 'trailGlow', 'massBand', 'edgeLines'];
    for (const k of Object.keys(WAKE_LOOK_ROUND13) as (keyof typeof WAKE_LOOK_ROUND13)[]) {
      if (!r14Only.includes(k)) expect(WAKE_LOOK_ROUND14[k]).toEqual(WAKE_LOOK_ROUND13[k]);
    }
    expect(WAKE_LOOK_ROUND14.trail[0]).toBe(1);
    // The race keeps the middle dense through both judged crops (3.6 s)
    // and dissolves after: its long decay starts past them.
    expect(WAKE_LOOK_ROUND14.trailCore[5]).toBeGreaterThan(3.6);
    expect(WAKE_LOOK_ROUND14.trailCore[6]).toBeGreaterThan(0);
    // The densest churn keeps holes: the cover is capped under 1.
    expect(WAKE_LOOK_ROUND14.trailCover[1]).toBeLessThan(1);
  });

  it('ships round 13 as a preset: round 12\'s layer opaque and lit as foam', () => {
    // Round 13's fields are off in every earlier look, so `r12` draws round
    // 12 to the pixel (the off-value proof against ours/r12b-*).
    for (const l of [WAKE_LOOK_ROUND2, WAKE_LOOK_ROUND3, WAKE_LOOK_ROUND4, WAKE_LOOK_ROUND5, WAKE_LOOK_ROUND6,
      WAKE_LOOK_ROUND7, WAKE_LOOK_ROUND8, WAKE_LOOK_ROUND9, WAKE_LOOK_ROUND10, WAKE_LOOK_ROUND11, WAKE_LOOK_ROUND12]) {
      expect(l.massSlope).toEqual([0, 0]);
      expect(l.massSun[0]).toBe(0);
      expect(l.massGrain[0]).toBe(0);
      expect(l.massGrain[3]).toBe(1);
      expect(l.massGrain[5]).toBe(0);
      expect(l.massGlow[0]).toBe(1);
      expect(l.massGlow[3]).toBe(0);
    }
    const r13Only = ['massAlpha', 'massBand', 'massAge', 'massSun', 'massSlope', 'massLight', 'massGrain', 'massLace',
      'massGlow', 'edgeLines', 'sideThin'];
    for (const k of Object.keys(WAKE_LOOK_ROUND12) as (keyof typeof WAKE_LOOK_ROUND12)[]) {
      if (!r13Only.includes(k)) expect(WAKE_LOOK_ROUND13[k]).toEqual(WAKE_LOOK_ROUND12[k]);
    }
    // The layer is opaque: no film, and its old relief (which darkened
    // every slope that did not face the sun) is off in favor of massSun.
    expect(WAKE_LOOK_ROUND13.massAlpha[2]).toBe(0);
    expect(WAKE_LOOK_ROUND13.massLight[0]).toBe(0);
    expect(WAKE_LOOK_ROUND13.massSun[0]).toBeGreaterThan(0);
    // No tonal streaks along the flow.
    expect(WAKE_LOOK_ROUND13.massLight[6]).toBe(1);
    // Round 11's arms.
    expect(WAKE_LOOK_ROUND13.edgeLines).toEqual(WAKE_LOOK_ROUND11.edgeLines);
    expect(WAKE_LOOK_ROUND13.sideThin).toEqual(WAKE_LOOK_ROUND11.sideThin);
    // Round 12's path is gated by mass[0] and is off in every earlier look,
    // so `r11` draws round 11 to the pixel (the off-value proof against
    // ours/r11w-*).
    const r12Fields = ['mass', 'massBand', 'massAge', 'massBoil', 'massVeins', 'massPores', 'massLace', 'massWisp',
      'massCrest', 'massArms', 'massAlpha', 'massLight'];
    for (const l of [WAKE_LOOK_ROUND2, WAKE_LOOK_ROUND3, WAKE_LOOK_ROUND4, WAKE_LOOK_ROUND5, WAKE_LOOK_ROUND6,
      WAKE_LOOK_ROUND7, WAKE_LOOK_ROUND8, WAKE_LOOK_ROUND9, WAKE_LOOK_ROUND10, WAKE_LOOK_ROUND11]) {
      expect(l.mass[0]).toBe(0);
      // Every sub-path is off at its off value too, so a spec that turns
      // the mass on starts from the layer alone.
      expect(l.massVeins[1] + l.massPores[1] + l.massLace[0] + l.massWisp[0] + l.massCrest[0] + l.massArms[0]).toBe(0);
      expect(l.massBand[5] + l.massLight[7]).toBe(0);
      expect(l.massLight[6]).toBe(1);
    }
    const r12Only = [...r12Fields, 'sideThin', 'edgeLines'];
    for (const k of Object.keys(WAKE_LOOK_ROUND11) as (keyof typeof WAKE_LOOK_ROUND11)[]) {
      if (!r12Only.includes(k)) expect(WAKE_LOOK_ROUND12[k]).toEqual(WAKE_LOOK_ROUND11[k]);
    }
    expect(WAKE_LOOK_ROUND12.mass[0]).toBe(1);
    // The layer covers the core only (its weight gone by 0.9 of the wake's
    // edge); the lace keeps the sides and the arms.
    expect(WAKE_LOOK_ROUND12.massBand[4]).toBeLessThan(1);
    // The mass hands over to the lace past both judged crops (3.6 s).
    expect(WAKE_LOOK_ROUND12.massAge[4]).toBeGreaterThan(3.6);
    // The veins and the pores are off in round 12 (a sharp cut of the
    // thickness drew camouflage; the vein cut, cracked ice).
    expect(WAKE_LOOK_ROUND12.massVeins[1]).toBe(0);
    expect(WAKE_LOOK_ROUND12.massPores[1]).toBe(0);
    // Round 11's fields are off in every earlier look, so `r10` draws
    // round 10 to the pixel (the off-value proof against ours/r10w-*).
    for (const l of [WAKE_LOOK_ROUND2, WAKE_LOOK_ROUND3, WAKE_LOOK_ROUND4, WAKE_LOOK_ROUND5, WAKE_LOOK_ROUND6,
      WAKE_LOOK_ROUND7, WAKE_LOOK_ROUND8, WAKE_LOOK_ROUND9, WAKE_LOOK_ROUND10]) {
      expect(l.coreOpacity[1]).toBeLessThanOrEqual(l.coreOpacity[0]);
      expect(l.coreTear[0] + l.coreTear[2] + l.coreLace[0]).toBe(0);
      expect(l.coreTear[3]).toBe(0.8);
    }
    const r11Only = ['coreOpacity', 'coreTear', 'coreLace', 'coreSolid', 'jacGatherMax', 'crestPile', 'backSlope', 'edgeLines'];
    for (const k of Object.keys(WAKE_LOOK_ROUND10) as (keyof typeof WAKE_LOOK_ROUND10)[]) {
      if (!r11Only.includes(k)) expect(WAKE_LOOK_ROUND11[k]).toEqual(WAKE_LOOK_ROUND10[k]);
    }
    expect(WAKE_LOOK_ROUND11.coreOpacity[2]).toBe(1);
    expect(WAKE_LOOK_ROUND10.coreSolid[5]).toBeGreaterThanOrEqual(0.85);
    // Round 10's fields are off in every earlier look, so `r9` draws round
    // 9 to the pixel (the off-value proof against ours/r9w-*).
    for (const l of [WAKE_LOOK_ROUND2, WAKE_LOOK_ROUND3, WAKE_LOOK_ROUND4, WAKE_LOOK_ROUND5, WAKE_LOOK_ROUND6,
      WAKE_LOOK_ROUND7, WAKE_LOOK_ROUND8, WAKE_LOOK_ROUND9]) {
      expect(l.coreSolid[0] + l.ridgeTear).toBe(0);
      expect(l.crestOut).toBe(1);
    }
    expect(WAKE_LOOK_ROUND10.coreSolid[5]).toBeGreaterThanOrEqual(0.85);
    const r10Only = ['coreSolid', 'ridgeTear', 'crestOut', 'sideThin', 'envelope', 'bandFade', 'edgeLines'];
    for (const k of Object.keys(WAKE_LOOK_ROUND9) as (keyof typeof WAKE_LOOK_ROUND9)[]) {
      if (!r10Only.includes(k)) expect(WAKE_LOOK_ROUND10[k]).toEqual(WAKE_LOOK_ROUND9[k]);
    }
    expect(WAKE_LOOK_ROUND9.sideNet[0]).toBeGreaterThan(0);
    // Round 9's fields are off in every earlier look, so `r8` draws round
    // 8 to the pixel (the off-value proof against ours/r8w-*).
    for (const l of [WAKE_LOOK_ROUND2, WAKE_LOOK_ROUND3, WAKE_LOOK_ROUND4, WAKE_LOOK_ROUND5, WAKE_LOOK_ROUND6,
      WAKE_LOOK_ROUND7, WAKE_LOOK_ROUND8]) {
      expect(l.sideNet[0] + l.clumpShade[0]).toBe(0);
      expect(l.sideThin[2]).toBe(1);
      expect(l.bandFade[2]).toBe(1);
    }
    const r9Only = ['sideStretch', 'sideNet', 'clumpShade', 'coreBand', 'sideThin', 'edgeLines', 'bandFade'];
    for (const k of Object.keys(WAKE_LOOK_ROUND8) as (keyof typeof WAKE_LOOK_ROUND8)[]) {
      if (!r9Only.includes(k)) expect(WAKE_LOOK_ROUND9[k]).toEqual(WAKE_LOOK_ROUND8[k]);
    }
    // The on-screen key is back, gentler than round 5's, and bounds the net too.
    expect(WAKE_LOOK_ROUND9.sideStretch[0]).toBeGreaterThan(WAKE_LOOK_ROUND5.sideStretch[0]);
    expect(WAKE_LOOK_ROUND9.sideNet[0]).toBeGreaterThan(0);
    expect(WAKE_LOOK_ROUND8.sideStretch).toEqual([0, 0]);
    // Round 8's fields are off in every earlier look, so `r7` draws round
    // 7 to the pixel (the off-value proof against ours/r7w-*).
    for (const l of [WAKE_LOOK_ROUND2, WAKE_LOOK_ROUND3, WAKE_LOOK_ROUND4, WAKE_LOOK_ROUND5, WAKE_LOOK_ROUND6, WAKE_LOOK_ROUND7]) {
      expect(l.coreBoil[0] + l.churnSlope[0] + l.aerate[3] + l.netFine[0] + l.netFine[1]).toBe(0);
      expect([l.coreBoil[2], l.coreBoil[3]]).toEqual([1, 1]);
    }
    // No look keys on the camera but the back-face cap (a visibility bound).
    expect(WAKE_LOOK_ROUND8.sideStretch).toEqual([0, 0]);
    const r8Only = ['aerate', 'netFine', 'sideStretch', 'coreBoil', 'churnSlope', 'backfaceCap', 'backfaceKnee'];
    for (const k of Object.keys(WAKE_LOOK_ROUND7) as (keyof typeof WAKE_LOOK_ROUND7)[]) {
      if (!r8Only.includes(k)) expect(WAKE_LOOK_ROUND8[k]).toEqual(WAKE_LOOK_ROUND7[k]);
    }
    expect(WAKE_LOOK_ROUND7.coreBand[2]).toBeGreaterThan(0);
    // Round 7's fields are off in every earlier look, so `r6` draws round
    // 6 to the pixel (the off-value proof against ours/r6w-*).
    for (const l of [WAKE_LOOK_ROUND2, WAKE_LOOK_ROUND3, WAKE_LOOK_ROUND4, WAKE_LOOK_ROUND5, WAKE_LOOK_ROUND6]) {
      expect(l.coreBand[2] + l.netSoft + l.aerate[0] + l.aerate[2]).toBe(0);
      expect(l.coreBand[3]).toBe(1);
      expect([l.haze[3], l.haze[4]]).toEqual([0, 0.25]);
    }
    expect(WAKE_LOOK_ROUND7.coreBand[2]).toBeGreaterThan(0);
    const r7Only = ['coreBand', 'netSoft', 'aerate', 'subGain', 'haze', 'laceNet', 'edgeLines', 'sideFade', 'envelope'];
    for (const k of Object.keys(WAKE_LOOK_ROUND6) as (keyof typeof WAKE_LOOK_ROUND6)[]) {
      if (!r7Only.includes(k)) expect(WAKE_LOOK_ROUND7[k]).toEqual(WAKE_LOOK_ROUND6[k]);
    }
    // Round 6's fields are off in every earlier look, so `r5` draws round
    // 5b to the pixel (the off-value proof, wake/r6/sheet-off1.png).
    for (const l of [WAKE_LOOK_ROUND2, WAKE_LOOK_ROUND3, WAKE_LOOK_ROUND4, WAKE_LOOK_ROUND5]) {
      expect(l.laceFold[2] + l.laceNet[2] + l.haze[0] + l.glintSlick[0] + l.edgeLines[0] + l.backSlope[0]).toBe(0);
      expect(l.envelope[3]).toBe(1);
      expect(l.debugView).toBe(0);
    }
    expect(WAKE_LOOK_ROUND6.laceNet[2]).toBe(1);
    expect(WAKE_LOOK_ROUND6.glintSlick[0]).toBe(1);
    expect(WAKE_LOOK_ROUND6.laceFold[2]).toBe(0);
    expect(WAKE_LOOK_ROUND6.debugView).toBe(0);
    const r6Only = ['subGain', 'pinholes', 'darkRim', 'sideFade', 'ageOpacity', 'laceNet', 'haze', 'glintSlick',
      'edgeLines', 'envelope', 'backSlope'];
    for (const k of Object.keys(WAKE_LOOK_ROUND5) as (keyof typeof WAKE_LOOK_ROUND5)[]) {
      if (!r6Only.includes(k)) expect(WAKE_LOOK_ROUND6[k]).toEqual(WAKE_LOOK_ROUND5[k]);
    }
    expect(WAKE_LOOK_ROUND5.clumpTearTile).toBe(12);
    expect(WAKE_LOOK_ROUND5.clumpTearAmt).toEqual([0.3, 0.7]);
    // Round 5b: the tear and the tail start past the chase crop's young
    // lanes (0.9 to 3.5 s), at 2 s.
    expect(WAKE_LOOK_ROUND5.clumpTearAge[0]).toBe(2);
    expect(WAKE_LOOK_ROUND5.sideFade[0]).toBe(2);
    // Round 4 differs from round 2 only in the round-4 fields.
    const r4Only = ['backfaceCap', 'backfaceKnee', 'ageShade', 'ageOpacity', 'wispStretch', 'wispAge'];
    for (const k of Object.keys(WAKE_LOOK_ROUND2) as (keyof typeof WAKE_LOOK_ROUND2)[]) {
      if (!r4Only.includes(k)) expect(WAKE_LOOK_ROUND4[k]).toEqual(WAKE_LOOK_ROUND2[k]);
    }
    expect(WAKE_LOOK_ROUND4.backfaceKnee).toBe(0.3);
    expect(WAKE_LOOK_ROUND4.ageShade[0]).toBe(3.5);
    expect(WAKE_LOOK_ROUND4.ageOpacity[0]).toBe(3.5);
    expect(WAKE_LOOK_ROUND4.wispAge[0]).toBe(3);
    expect(WAKE_LOOK_ROUND2.laceWeights).toEqual(WAKE_LACE_WEIGHTS);
    expect(WAKE_LOOK_ROUND2.backfaceCap).toBe(0);
    expect(WAKE_LOOK_ROUND2.foamVolume).toBe(false);
    expect(WAKE_LOOK_ROUND2.coreGrain).toBe(false);
    expect(WAKE_LOOK_ROUND3.laceWeights).toEqual([0.5, 0.26, 0.1, 0.14]);
    expect(WAKE_LOOK_ROUND3.backfaceCap).toBe(0.7);
    // Round 4's fields are off in both named looks.
    for (const l of [WAKE_LOOK_ROUND2, WAKE_LOOK_ROUND3]) {
      expect(l.backfaceKnee).toBe(0);
      expect(l.jacGatherMax).toBe(1.8);
      expect(l.ageShade).toEqual([0, 0, 1, 1]);
      expect(l.ageOpacity).toEqual([0, 0, 1]);
      expect(l.wispAge[0]).toBeLessThan(0);
      expect(l.laceSharp + l.coreSharp + l.wispStretch + l.streakJitter + l.edgeStreaks).toBe(0);
    }
    // Round 5's fields are off in every earlier look, and on in round 5.
    for (const l of [WAKE_LOOK_ROUND2, WAKE_LOOK_ROUND3, WAKE_LOOK_ROUND4]) {
      expect(l.sideStretch).toEqual([0, 0]);
      expect(l.clumpTear[2]).toBe(0);
      expect(l.fleckKeep).toBe(1);
      expect(l.sideSharp + l.pinholes[0] + l.darkRim[0] + l.crestPile[0]).toBe(0);
      expect(l.sideFade[2]).toBe(1);
    }
    expect(WAKE_LOOK_ROUND5.clumpTear[2]).toBeGreaterThan(0);
    expect(WAKE_LOOK_ROUND5.wispStretch).toBe(0);
    expect(WAKE_LOOK_ROUND5.ageOpacity[2]).toBe(1);
    const r5Only = ['backfaceCap', 'backfaceKnee', 'sideKey', 'sideStretch', 'clumpTear', 'clumpTearAge', 'clumpTearTile',
      'clumpTearAmt', 'fleckKeep', 'sideSharp', 'pinholes', 'darkRim', 'crestPile', 'sideFade'];
    for (const k of Object.keys(WAKE_LOOK_ROUND2) as (keyof typeof WAKE_LOOK_ROUND2)[]) {
      if (!r5Only.includes(k)) expect(WAKE_LOOK_ROUND5[k]).toEqual(WAKE_LOOK_ROUND2[k]);
    }
    // Both mixes sum to one, so the coverage table spans the same range.
    for (const l of [WAKE_LOOK_ROUND2, WAKE_LOOK_ROUND3]) {
      expect(l.laceWeights.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
    }
  });
  it('parses a spec: an empty one is the default, presets then fields in order, bad input throws', () => {
    expect(parseWakeLook('')).toEqual(WAKE_LOOK_DEFAULT);
    expect(parseWakeLook('r2')).toEqual(WAKE_LOOK_ROUND2);
    expect(parseWakeLook('r3')).toEqual(WAKE_LOOK_ROUND3);
    expect(parseWakeLook('r4')).toEqual(WAKE_LOOK_ROUND4);
    expect(parseWakeLook('r5')).toEqual(WAKE_LOOK_ROUND5);
    expect(parseWakeLook('r6')).toEqual(WAKE_LOOK_ROUND6);
    expect(parseWakeLook('r7')).toEqual(WAKE_LOOK_ROUND7);
    expect(parseWakeLook('r8')).toEqual(WAKE_LOOK_ROUND8);
    expect(parseWakeLook('r9')).toEqual(WAKE_LOOK_ROUND9);
    expect(parseWakeLook('r10')).toEqual(WAKE_LOOK_ROUND10);
    expect(parseWakeLook('r11')).toEqual(WAKE_LOOK_ROUND11);
    expect(parseWakeLook('r12')).toEqual(WAKE_LOOK_ROUND12);
    expect(parseWakeLook('r13')).toEqual(WAKE_LOOK_ROUND13);
    expect(() => parseWakeLook('massGrain:0.35/0.2/0.7/0.75/1.1')).toThrow(/6 numbers/);
    expect(parseWakeLook('r11,mass:1/10/3.7/1.3/0.85/0.5').mass).toEqual([1, 10, 3.7, 1.3, 0.85, 0.5]);
    expect(() => parseWakeLook('massLight:1/0.3')).toThrow(/8 numbers/);
    expect(parseWakeLook('r5,laceNet:1/3/1/1.6/0.7').laceNet).toEqual([1, 3, 1, 1.6, 0.7]);
    expect(() => parseWakeLook('laceNet:1/3/1/1.6')).toThrow(/5 numbers/);
    expect(parseWakeLook('r5,sideKey:0/0,clumpTear:0.4/0.5/0.7').clumpTear).toEqual([0.4, 0.5, 0.7]);
    const l = parseWakeLook('r3, backfaceCap:0, coreGrain:0, laceWeights:0.4/0.24/0.22/0.14, corePocketRamp:0.12/0.42');
    expect(l.backfaceCap).toBe(0);
    expect(l.coreGrain).toBe(false);
    expect(l.foamVolume).toBe(true);
    expect(l.laceWeights).toEqual([0.4, 0.24, 0.22, 0.14]);
    expect(l.corePocketRamp).toEqual([0.12, 0.42]);
    expect(parseWakeLook('r2,pocketsGlow:1').pocketsGlow).toBe(true);
    expect(parseWakeLook('ageShade:3.5/8/0.72/1').ageShade).toEqual([3.5, 8, 0.72, 1]);
    expect(parseWakeLook('ageOpacity:3.5/8/0.5,wispAge:3/7').ageOpacity).toEqual([3.5, 8, 0.5]);
    expect(parseWakeLook('wispStretch:4,wispRange:0.15/0.6').wispRange).toEqual([0.15, 0.6]);
    expect(() => parseWakeLook('r99')).toThrow(/preset/);
    expect(() => parseWakeLook('grain:1')).toThrow(/field/);
    expect(() => parseWakeLook('subGain:x')).toThrow(/number/);
    expect(() => parseWakeLook('laceWeights:1/2')).toThrow(/4 numbers/);
  });
  it('builds the coverage table for the look\'s own mix', () => {
    const size = 128;
    const img = wakeLaceImage(size);
    const a = wakeLaceCdfTable(img, size, 20000);
    const b = wakeLaceCdfTable(img, size, 20000, undefined, WAKE_LOOK_ROUND2.laceWeights);
    const c = wakeLaceCdfTable(img, size, 20000, undefined, WAKE_LOOK_ROUND3.laceWeights);
    expect(b).toEqual(a);
    let diff = 0;
    for (let k = 0; k < a.length; k += 1) diff = Math.max(diff, Math.abs(c[k] - a[k]));
    expect(diff).toBeGreaterThan(0.005);
  });
});

describe('the net lace (round 6)', () => {
  const size = 128;
  const img = wakeNetImage(size);
  /** Four-connected components of a mask on the wrapping tile, areas sorted. */
  const components = (mask: Uint8Array): number[] => {
    const seen = new Uint8Array(size * size);
    const areas: number[] = [];
    for (let k = 0; k < size * size; k += 1) {
      if (!mask[k] || seen[k]) continue;
      let area = 0;
      const stack = [k];
      seen[k] = 1;
      while (stack.length) {
        const c = stack.pop()!;
        area += 1;
        const x = c % size;
        const y = (c - x) / size;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const n = ((y + dy + size) % size) * size + ((x + dx + size) % size);
          if (mask[n] && !seen[n]) { seen[n] = 1; stack.push(n); }
        }
      }
      areas.push(area);
    }
    return areas.sort((a, b) => a - b);
  };

  it('draws foam as one connected lace round windows of many sizes, where the raft draws islands', () => {
    // At a cover of 0.3 the coarse net's foam is walls: one connected
    // lace (measured 2 components, 97% in the largest), round windows
    // whose areas span more than a decade (measured 25 times the median).
    // The raft at the same cover is islands (measured 137 components):
    // the round-5b chase critic's "soft, cottony blobs".
    const foam = new Uint8Array(size * size);
    const raftFoam = new Uint8Array(size * size);
    const raft = wakeLaceImage(size);
    for (let k = 0; k < size * size; k += 1) {
      foam[k] = img[k * 4] > 0.7 * 255 ? 1 : 0;
      raftFoam[k] = raft[k * 4] > 0.7 * 255 ? 1 : 0;
    }
    const walls = components(foam);
    const total = walls.reduce((a, b) => a + b, 0);
    expect(walls.length).toBeLessThan(10);
    expect(walls[walls.length - 1] / total).toBeGreaterThan(0.9);
    expect(components(raftFoam).length).toBeGreaterThan(5 * walls.length);
    const open = new Uint8Array(size * size);
    for (let k = 0; k < size * size; k += 1) open[k] = 1 - foam[k];
    const windows = components(open).filter((a) => a >= 4);
    expect(windows.length).toBeGreaterThan(15);
    expect(windows[windows.length - 1] / windows[Math.floor(windows.length / 2)]).toBeGreaterThan(10);
  });

  it('is ranked, tiles and equalizes its mix', () => {
    for (const c of [0, 1]) {
      let lo = 0;
      for (let k = 0; k < size * size; k += 1) if (img[k * 4 + c] < 128) lo += 1;
      expect(lo / (size * size)).toBeCloseTo(0.5, 1);
      let across = 0;
      let inside = 0;
      for (let j = 0; j < size; j += 1) {
        across += Math.abs(img[(j * size + size - 1) * 4 + c] - img[(j * size) * 4 + c]);
        inside += Math.abs(img[(j * size + 60) * 4 + c] - img[(j * size + 61) * 4 + c]);
      }
      expect(across).toBeLessThan(1.6 * inside);
    }
    const table = wakeLaceCdfTable(img, size, 60000, undefined, WAKE_NET_WEIGHTS);
    let seed = 11;
    const rnd = () => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return seed / 4294967296; };
    const bins = new Array(10).fill(0);
    const n = 40000;
    for (let s = 0; s < n; s += 1) {
      let v = 0;
      for (let c = 0; c < 2; c += 1) v += WAKE_NET_WEIGHTS[c] * (img[Math.floor(rnd() * size * size) * 4 + c] / 255);
      bins[Math.min(9, Math.floor(wakeLaceRank(table, v) * 10))] += 1;
    }
    for (const b of bins) expect(Math.abs(b / n - 0.1)).toBeLessThan(0.03);
    // Deterministic.
    expect(wakeNetImage(size)).toEqual(img);
  });
});

describe('the lace\'s shape on screen (round 5)', () => {
  it('is sin(elevation) along the flow, its inverse across it, and parts the judged poses', () => {
    // Along the flow (phi 0): r = sin e; across (phi 90 degrees): 1 / sin e.
    for (const [h, d] of [[26, 30], [12, 30], [5, 100]]) {
      const sinE = h / Math.hypot(h, d);
      expect(wakeSideRatio(h, d, 0)).toBeCloseTo(sinE, 9);
      expect(wakeSideRatio(h, d, Math.PI / 2)).toBeCloseTo(1 / sinE, 9);
      expect(wakeSideRatio(h, d, Math.PI / 4)).toBeCloseTo(1, 9);
    }
    // The chase crop (26 m up, 22 to 38 m out, phi under 30 degrees) stays
    // under the key's foot of 0.85; the quarter crop (12 m up, 22 to 40 m
    // out, phi 55 to 75 degrees) is at or over its top of 1.25 but at its
    // nearest edge (1.24 at 22 m and 55 degrees).
    for (const d of [22, 30, 38]) for (const phi of [0, 10, 20, 25]) {
      expect(wakeSideRatio(26, d, (phi * Math.PI) / 180)).toBeLessThan(0.85);
    }
    for (const d of [22, 30, 40]) for (const phi of [55, 65, 75]) {
      expect(wakeSideRatio(12, d, (phi * Math.PI) / 180)).toBeGreaterThan(1.2);
    }
    expect(wakeSideRatio(12, 30, (65 * Math.PI) / 180)).toBeGreaterThan(1.5);
  });
});

describe('the mix of two uniform reads (round 5b)', () => {
  it('is the identity at w 0 and 1, continuous, and makes the mix uniform again', () => {
    for (const x of [0, 0.2, 0.5, 0.9, 1]) {
      expect(wakeMixUniformCdf(x, 0)).toBe(x);
      expect(wakeMixUniformCdf(x, 1)).toBe(x);
    }
    for (const w of [0.2, 0.5, 0.7]) {
      const p = Math.min(w, 1 - w);
      const q = Math.max(w, 1 - w);
      expect(wakeMixUniformCdf(0, w)).toBe(0);
      expect(wakeMixUniformCdf(1, w)).toBe(1);
      expect(wakeMixUniformCdf(p - 1e-9, w)).toBeCloseTo(wakeMixUniformCdf(p + 1e-9, w), 6);
      expect(wakeMixUniformCdf(q - 1e-9, w)).toBeCloseTo(wakeMixUniformCdf(q + 1e-9, w), 6);
      // Two independent uniforms mixed, then equalized: uniform in ten bins.
      let h = 0x2f6e2b1;
      const rnd = () => { h = (h + 0x9e3779b9) | 0; let t = Math.imul(h ^ (h >>> 15), 0x85ebca6b); t = Math.imul(t ^ (t >>> 13), 0xc2b2ae35); return ((t ^ (t >>> 16)) >>> 0) / 4294967296; };
      const bins = new Array(10).fill(0);
      const n = 200000;
      for (let i = 0; i < n; i += 1) {
        const m = (1 - w) * rnd() + w * rnd();
        bins[Math.min(9, Math.floor(wakeMixUniformCdf(m, w) * 10))] += 1;
      }
      for (const b of bins) expect(b / n).toBeCloseTo(0.1, 2);
    }
  });
});

describe('the foam mass (round 12)', () => {
  const size = 128;
  const m = wakeMassImage(size);
  const px = (c: number, i: number, j: number) => m.data[(((j + size) % size) * size + ((i + size) % size)) * 4 + c] / 255;

  it('is deterministic and its slope scale is finite', () => {
    const again = wakeMassImage(size);
    expect(again.data).toEqual(m.data);
    expect(again.gradScale).toBe(m.gradScale);
    expect(m.gradScale).toBeGreaterThan(0);
    expect(Number.isFinite(m.gradScale)).toBe(true);
    expect(wakeMassImage(size, 0x1234).data).not.toEqual(m.data);
  });

  it('ranks the thickness: uniform on 0 to 1', () => {
    const bins = new Array(10).fill(0);
    for (let j = 0; j < size; j += 1) for (let i = 0; i < size; i += 1) bins[Math.min(9, Math.floor(px(0, i, j) * 10))] += 1;
    for (const b of bins) expect(Math.abs(b / (size * size) - 0.1)).toBeLessThan(0.01);
  });

  it('tiles: every channel\'s edges meet', () => {
    for (let c = 0; c < 4; c += 1) {
      let across = 0;
      let inside = 0;
      for (let j = 0; j < size; j += 1) {
        across += Math.abs(px(c, size - 1, j) - px(c, 0, j)) + Math.abs(px(c, j, size - 1) - px(c, j, 0));
        inside += Math.abs(px(c, 60, j) - px(c, 61, j)) + Math.abs(px(c, j, 60) - px(c, j, 61));
      }
      expect(across).toBeLessThan(1.6 * inside + 1e-9);
    }
  });

  it('draws veins as lines, not cells: a thin share of the tile, in every part of it', () => {
    // G is 0 on the noise's zero set: lines. Under 0.05 they cover a few
    // percent of the tile, and every quarter of it has some.
    let thin = 0;
    const quarter = [0, 0, 0, 0];
    for (let j = 0; j < size; j += 1) {
      for (let i = 0; i < size; i += 1) {
        if (px(1, i, j) < 0.05) {
          thin += 1;
          quarter[(i < size / 2 ? 0 : 1) + (j < size / 2 ? 0 : 2)] += 1;
        }
      }
    }
    expect(thin / (size * size)).toBeGreaterThan(0.01);
    expect(thin / (size * size)).toBeLessThan(0.15);
    for (const q of quarter) expect(q).toBeGreaterThan(0);
  });

  it('encodes a relief whose slopes sum to zero round the tile (a height field)', () => {
    // The mean slope of a periodic height is 0 along each axis, and the
    // two slopes are of one order (the relief is not drawn out along one
    // axis only).
    let su = 0;
    let sv = 0;
    let au = 0;
    let av = 0;
    for (let j = 0; j < size; j += 1) {
      for (let i = 0; i < size; i += 1) {
        const gu = (px(2, i, j) - 0.5) * 2 * m.gradScale;
        const gv = (px(3, i, j) - 0.5) * 2 * m.gradScale;
        su += gu;
        sv += gv;
        au += Math.abs(gu);
        av += Math.abs(gv);
      }
    }
    expect(Math.abs(su) / au).toBeLessThan(0.02);
    expect(Math.abs(sv) / av).toBeLessThan(0.02);
    expect(au / av).toBeGreaterThan(0.5);
    expect(au / av).toBeLessThan(2);
  });
});

describe('the trail (round 14)', () => {
  const size = 256;
  const img = wakeTrailImage(size, undefined, WAKE_LOOK_ROUND14.trailTexture[0], WAKE_LOOK_ROUND14.trailTexture[1],
    WAKE_LOOK_ROUND14.trailTexture[2]);
  const px = (c: number, i: number, j: number) => img.data[(((j + size) % size) * size + ((i + size) % size)) * 4 + c] / 255;

  /** Connected regions (4-neighbors, wrapping) of channel c under `cut`, by area. */
  const holes = (data: Uint8Array, c: number, cut: number): number[] => {
    const open = new Uint8Array(size * size);
    for (let k = 0; k < size * size; k += 1) open[k] = data[k * 4 + c] < cut * 255 ? 1 : 0;
    const seen = new Uint8Array(size * size);
    const areas: number[] = [];
    for (let k = 0; k < size * size; k += 1) {
      if (!open[k] || seen[k]) continue;
      let area = 0;
      const stack = [k];
      seen[k] = 1;
      while (stack.length) {
        const p = stack.pop()!;
        area += 1;
        const x = p % size;
        const y = (p - x) / size;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const n = ((y + dy + size) % size) * size + ((x + dx + size) % size);
          if (open[n] && !seen[n]) { seen[n] = 1; stack.push(n); }
        }
      }
      areas.push(area);
    }
    return areas.sort((a, b) => a - b);
  };

  it('is deterministic, and its slope scale is finite', () => {
    const again = wakeTrailImage(size, undefined, WAKE_LOOK_ROUND14.trailTexture[0], WAKE_LOOK_ROUND14.trailTexture[1],
      WAKE_LOOK_ROUND14.trailTexture[2]);
    expect(again.data).toEqual(img.data);
    expect(again.gradScale).toBe(img.gradScale);
    expect(Number.isFinite(img.gradScale) && img.gradScale > 0).toBe(true);
    expect(wakeTrailImage(size, 0x1234).data).not.toEqual(img.data);
  });

  it('ranks both fields: uniform on 0 to 1, so an amount a covers a', () => {
    for (const c of [0, 1]) {
      const bins = new Array(10).fill(0);
      for (let j = 0; j < size; j += 1) for (let i = 0; i < size; i += 1) bins[Math.min(9, Math.floor(px(c, i, j) * 10))] += 1;
      for (const b of bins) expect(Math.abs(b / (size * size) - 0.1)).toBeLessThan(0.01);
    }
  });

  it('tiles: every channel\'s edges meet', () => {
    for (let c = 0; c < 4; c += 1) {
      let across = 0;
      let inside = 0;
      for (let j = 0; j < size; j += 1) {
        across += Math.abs(px(c, size - 1, j) - px(c, 0, j)) + Math.abs(px(c, j, size - 1) - px(c, j, 0));
        inside += Math.abs(px(c, 120, j) - px(c, 121, j)) + Math.abs(px(c, j, 120) - px(c, j, 121));
      }
      expect(across).toBeLessThan(1.6 * inside + 1e-9);
    }
  });

  it('encodes a relief whose slopes sum to zero round the tile (a height field)', () => {
    let su = 0;
    let sv = 0;
    let au = 0;
    let av = 0;
    for (let j = 0; j < size; j += 1) {
      for (let i = 0; i < size; i += 1) {
        const gu = (px(2, i, j) - 0.5) * 2 * img.gradScale;
        const gv = (px(3, i, j) - 0.5) * 2 * img.gradScale;
        su += gu;
        sv += gv;
        au += Math.abs(gu);
        av += Math.abs(gv);
      }
    }
    expect(Math.abs(su) / au).toBeLessThan(0.02);
    expect(Math.abs(sv) / av).toBeLessThan(0.02);
    expect(au / av).toBeGreaterThan(0.5);
    expect(au / av).toBeLessThan(2);
  });

  it('opens holes of many sizes, fewer and larger than the raft\'s popped cells', () => {
    // At the densest churn's cover (the lowest 12% of the field open, the
    // look's cap 0.88) the trail's holes span a wide range of areas; the
    // lace's raft channel at the same cut is mostly its popped cells, many
    // holes of one small size: the round-13 judges' "round holes of nearly
    // one size". Measured at 256: the trail 124 holes, 90th percentile 63
    // texels, largest 1800; the raft 457, 21 and 1831.
    const t = holes(img.data, 0, 0.12);
    const r = holes(wakeLaceImage(size), 0, 0.12);
    const p = (a: number[], f: number) => a[Math.min(a.length - 1, Math.floor(f * a.length))];
    expect(t.length).toBeGreaterThan(40);
    expect(t.length).toBeLessThan(0.5 * r.length);
    expect(p(t, 0.9)).toBeGreaterThan(2 * p(r, 0.9));
    expect(t[t.length - 1] / p(t, 0.5)).toBeGreaterThan(100);
  });

  it('shears along the flow without folding the coordinate (the jet and the lanes)', () => {
    // The read looks the texture up at s + D(n, age(s)), age = (s_hull - s)
    // / U: its slope along s is 1 - dD/dage / U (plus the lanes' wander
    // term), which must stay over 0 or the texture folds into a smear.
    const [dMax, tau, width] = WAKE_LOOK_ROUND14.trailShear;
    const [amp, lane, tauL, wander] = WAKE_LOOK_ROUND14.trailLanes;
    expect(wakeTrailShearM(0, 5, 0, tau, width)).toBe(0);
    expect(wakeTrailLanesM(0, 5, 0.5, 0, lane, tauL, wander)).toBe(0);
    // The jet is largest on the track and gone at its sides, and grows with age.
    expect(wakeTrailShearM(0, 3, dMax, tau, width)).toBeGreaterThan(wakeTrailShearM(width, 3, dMax, tau, width));
    expect(wakeTrailShearM(0, 3, dMax, tau, width)).toBeGreaterThan(wakeTrailShearM(0, 1, dMax, tau, width));
    // The lace's slow warp varies over about 24 m: a slope of 1 / 24 per
    // meter at most, taken at its worst sign.
    const slowSlope = 1 / 24;
    let worst = Infinity;
    const h = 0.01;
    for (let age = 0; age < 20; age += 0.25) {
      for (let n = -12; n <= 12; n += 0.25) {
        for (const slow of [0.1, 0.5, 0.9]) {
          for (const sg of [-1, 1]) {
            // d/ds of the label: age falls by ds / U, slow moves by sg slope ds.
            const s1 = h;
            const d0 = wakeTrailShearM(n, age, dMax, tau, width) + wakeTrailLanesM(n, age, slow, amp, lane, tauL, wander);
            const d1 = wakeTrailShearM(n, age - h / U, dMax, tau, width)
              + wakeTrailLanesM(n, age - h / U, slow + sg * slowSlope * h, amp, lane, tauL, wander);
            worst = Math.min(worst, (s1 + d1 - d0) / h);
          }
        }
      }
    }
    expect(worst).toBeGreaterThan(0.5);
  });

  it('covers the share of the water its amount asks for, capped', () => {
    // Uniform ranks under the ramp: a share a covers about a.
    const [gain, cap] = WAKE_LOOK_ROUND14.trailCover;
    const soft = WAKE_LOOK_ROUND14.trail[5];
    for (const amount of [0.2, 0.5, 0.8, 3]) {
      let cov = 0;
      const n = 2000;
      for (let k = 0; k < n; k += 1) cov += wakeTrailCover((k + 0.5) / n, amount, gain, cap, soft);
      expect(cov / n).toBeCloseTo(Math.min(amount * gain, cap), 2);
    }
  });

  it('lays one sheet down the core: full inside its band, none outside, thinning with age (round 16)', () => {
    const band = WAKE_LOOK_ROUND16.trailBand;
    const bandAge = WAKE_LOOK_ROUND16.trailBandAge;
    const [peak, half, spread, soft, wob] = band;
    // Inside the band (no wobble), young: the peak.
    expect(wakeTrailBandShare(0, 10, 0.5, 0.5, band, bandAge)).toBeCloseTo(peak, 6);
    expect(wakeTrailBandShare(half - soft - 0.01, 10, 0.5, 0.5, band, bandAge)).toBeCloseTo(peak, 6);
    // Outside it: none, even with the wobble pulling the edge out.
    expect(wakeTrailBandShare(half + spread * 10 + soft + wob + 0.01, 10, 0.5, 0, band, bandAge)).toBe(0);
    // The wobble moves the edge: a low value widens the band, a high one narrows it.
    const nEdge = half + spread * 10;
    expect(wakeTrailBandShare(nEdge, 10, 0.5, 0.1, band, bandAge)).toBeGreaterThan(wakeTrailBandShare(nEdge, 10, 0.5, 0.9, band, bandAge));
    // It grows in over the first meter behind the transom.
    expect(wakeTrailBandShare(0, 0, 0, 0.5, band, bandAge)).toBe(0);
    expect(wakeTrailBandShare(0, 0.5, 0.1, 0.5, band, bandAge)).toBeLessThan(peak);
    // It thins with age: held to t0, `floor` of the peak by t1, then decays.
    const [t0, t1, floor, tau] = bandAge;
    expect(wakeTrailBandShare(0, 10, t0, 0.5, band, bandAge)).toBeCloseTo(peak, 6);
    expect(wakeTrailBandShare(0, 10, t1, 0.5, band, bandAge)).toBeCloseTo(peak * floor, 6);
    expect(wakeTrailBandShare(0, 10, t1 + tau, 0.5, band, bandAge)).toBeCloseTo(peak * floor / Math.E, 6);
    // Off: nothing.
    expect(wakeTrailBandShare(0, 10, 1, 0.5, [0, 3, 0, 1, 0, 30], bandAge)).toBe(0);
  });

  it('thins every edge through a translucent lace, and keeps it off the open sea (round 17)', () => {
    const fr = WAKE_LOOK_ROUND17.trailFringe;
    const [reach, alpha, fine0, fine1] = fr;
    const edge = 0.3;
    // Over the threshold the sharp cover draws; the fringe adds nothing there.
    expect(wakeTrailFringe(0.5, edge, 1, 1, 0.7, fr)).toBe(0);
    // Just under it, on a filament: up to `alpha`.
    expect(wakeTrailFringe(edge - 1e-4, edge, 0, 1, 0.7, fr)).toBeCloseTo(alpha, 3);
    // It fades with the depth under the threshold and is gone past `reach`.
    expect(wakeTrailFringe(edge - reach / 2, edge, 0, 1, 0.7, fr)).toBeLessThan(alpha);
    expect(wakeTrailFringe(edge - reach - 0.01, edge, 0, 1, 0.7, fr)).toBe(0);
    // The second field cuts it into filaments.
    expect(wakeTrailFringe(edge - 0.01, edge, 0, fine0 - 0.01, 0.7, fr)).toBe(0);
    expect(wakeTrailFringe(edge - 0.01, edge, 0, fine1, 0.7, fr)).toBeGreaterThan(0);
    // None where the trail has no share (the open sea).
    expect(wakeTrailFringe(0.99, 1, 0, 1, 0, fr)).toBe(0);
    // Off: nothing.
    expect(wakeTrailFringe(edge - 0.01, edge, 0, 1, 0.7, WAKE_LOOK_ROUND16.trailFringe)).toBe(0);
  });

  it('lays the milky water under and round the sheet, fading with age (round 17)', () => {
    const [, reach, , tau] = WAKE_LOOK_ROUND17.trailMilkWater;
    const half = 3.4;
    expect(wakeTrailMilkWater(0, half, 10, 0, reach, tau)).toBeCloseTo(1, 6);
    expect(wakeTrailMilkWater(half + reach + 0.01, half, 10, 0, reach, tau)).toBe(0);
    expect(wakeTrailMilkWater(half + reach / 2, half, 10, 0, reach, tau)).toBeGreaterThan(0);
    expect(wakeTrailMilkWater(0, half, 10, tau, reach, tau)).toBeCloseTo(1 / Math.E, 6);
    expect(wakeTrailMilkWater(0, half, 0, 0, reach, tau)).toBe(0);
  });

  it('draws the arms as lines on the wake\'s own crests (round 16)', () => {
    const arm = WAKE_LOOK_ROUND16.trailArmLine;
    const [peak, spread, , tau, h0, h1, floor] = arm;
    const halfT = WAKE_TRAWLER.transomShare * WAKE_TRAWLER.beamM / 2;
    const onLine = (d: number) => halfT + spread * d;
    // On its line, on a crest, young: the peak (less the age fade).
    expect(wakeTrailArmShare(onLine(10), 10, 0, h1, halfT, arm)).toBeCloseTo(peak, 6);
    // In a trough: `floor` of it.
    expect(wakeTrailArmShare(onLine(10), 10, 0, h0 - 0.1, halfT, arm)).toBeCloseTo(peak * floor, 6);
    // Off the line: less; far off it: nothing to speak of.
    expect(wakeTrailArmShare(onLine(10) + 1, 10, 0, h1, halfT, arm)).toBeLessThan(wakeTrailArmShare(onLine(10), 10, 0, h1, halfT, arm));
    expect(wakeTrailArmShare(onLine(10) + 5, 10, 0, h1, halfT, arm)).toBeLessThan(1e-6);
    // It fades with age.
    expect(wakeTrailArmShare(onLine(10), 10, tau, h1, halfT, arm)).toBeCloseTo(peak / Math.E, 6);
  });
});

describe('the lace', () => {
  const size = 128;
  const img = wakeLaceImage(size);
  const table = wakeLaceCdfTable(img, size, 60000);

  it('opens gaps of many sizes, not one size of hole (round 2)', () => {
    // The raft channel thresholded at a cover of 0.6: the open water forms
    // connected gaps. Round 1's popped cells alone made gaps of one size
    // ("Swiss cheese"); the raft's gaps must span more than a decade of
    // area, with the largest a real stretch of open water.
    const open = new Uint8Array(size * size);
    for (let k = 0; k < size * size; k += 1) open[k] = img[k * 4] < 0.4 * 255 ? 1 : 0;
    const seen = new Uint8Array(size * size);
    const areas: number[] = [];
    for (let k = 0; k < size * size; k += 1) {
      if (!open[k] || seen[k]) continue;
      let area = 0;
      const stack = [k];
      seen[k] = 1;
      while (stack.length) {
        const c = stack.pop()!;
        area += 1;
        const x = c % size;
        const y = (c - x) / size;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const n = ((y + dy + size) % size) * size + ((x + dx + size) % size);
          if (open[n] && !seen[n]) { seen[n] = 1; stack.push(n); }
        }
      }
      areas.push(area);
    }
    areas.sort((a, b) => a - b);
    const median = areas[Math.floor(areas.length / 2)];
    expect(areas.length).toBeGreaterThan(20);
    expect(areas[areas.length - 1] / median).toBeGreaterThan(30);
    // And the channel is ranked: uniform on 0..1.
    let lo = 0;
    for (let k = 0; k < size * size; k += 1) if (img[k * 4] < 128) lo += 1;
    expect(lo / (size * size)).toBeCloseTo(0.5, 1);
  });

  it('tiles: its edges meet', () => {
    // Mean absolute step across the wrap against the mean step inside.
    let across = 0;
    let inside = 0;
    for (let j = 0; j < size; j += 1) {
      for (let c = 0; c < 4; c += 1) {
        across += Math.abs(img[(j * size + size - 1) * 4 + c] - img[(j * size) * 4 + c]);
        inside += Math.abs(img[(j * size + 60) * 4 + c] - img[(j * size + 61) * 4 + c]);
      }
    }
    expect(across).toBeLessThan(1.6 * inside);
  });

  it('equalizes: an amount a covers a', () => {
    expect(table).toHaveLength(WAKE_LACE_CDF_KNOTS + 1);
    for (let k = 1; k < table.length; k += 1) expect(table[k]).toBeGreaterThanOrEqual(table[k - 1]);
    // Draw mixed noise as the surface does and check its rank is uniform.
    let seed = 7;
    const rnd = () => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return seed / 4294967296; };
    const bins = new Array(10).fill(0);
    const n = 40000;
    for (let s = 0; s < n; s += 1) {
      let v = 0;
      for (let c = 0; c < 4; c += 1) v += WAKE_LACE_WEIGHTS[c] * (img[Math.floor(rnd() * size * size) * 4 + c] / 255);
      bins[Math.min(9, Math.floor(wakeLaceRank(table, v) * 10))] += 1;
    }
    // The table is 64 linear knots over a sampled distribution: a tenth
    // of the water in each tenth of rank, to within 3%.
    for (const b of bins) expect(Math.abs(b / n - 0.1)).toBeLessThan(0.03);
  });
});
