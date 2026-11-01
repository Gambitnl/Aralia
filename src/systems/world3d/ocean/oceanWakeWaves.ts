/**
 * @file oceanWakeWaves.ts
 * The original hull, course, following window and closed-form wake waves.
 * The CPU field mirror, Fourier arithmetic, taper and measurements stay together.
 * No course geometry, pressure equation, timing or FFT order changes.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 25/10/2026, 03:15:52
 * Dependents: systems/world3d/ocean/oceanWakeFoam.ts, systems/world3d/ocean/oceanWakeMath.ts, systems/world3d/ocean/oceanWakeTextures.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { GRAVITY_MS2 } from './oceanConfig';
import { fft1d } from './oceanFftReference';


/* ------------------------------------------------------------------ */
/* The hull                                                            */
/* ------------------------------------------------------------------ */

/** A hull, as the wake and the model both need it. Meters. */
export interface WakeHull {
  /** Waterline length, meters. */
  readonly lengthM: number;
  /** Waterline beam, meters. */
  readonly beamM: number;
  /** Draft at midship, meters. */
  readonly draftM: number;
  /** Block coefficient: displaced volume over L x B x T. */
  readonly blockCoefficient: number;
  /** Waterline half-breadth at the transom, over the half-beam. */
  readonly transomShare: number;
}

/**
 * The wake's hull: a stern trawler, 30 m on the waterline, 8 m beam, 2.8 m
 * draft. The size is set by the reference, not chosen freely: Water Pro's
 * boat-mode frames (wake/ref/boat-w-*.png) show a foam band 13 m wide at 20
 * to 25 m behind a galleon's stern, and a 30 m hull with an 8 m beam makes
 * a stern churn of that order in the same framing. A block coefficient of
 * 0.55 is a displacement trawler's (0.50 to 0.60 in the fishing-vessel
 * series of Doust, 1962). The transom keeps 0.75 of the half-beam, a wide
 * working stern.
 */
export const WAKE_TRAWLER: WakeHull = {
  lengthM: 30,
  beamM: 8,
  draftM: 2.8,
  blockCoefficient: 0.55,
  transomShare: 0.75,
};

/**
 * The trawler's speed, m/s: 6.0 m/s is 11.7 knots, a Froude number
 * U / sqrt(g L) of 0.35. A displacement trawler steams at 0.30 to 0.40;
 * at 0.40 its transverse wave is one hull length long and the wave-making
 * wall begins. Under 0.5 the wake's brightest line is Kelvin's cusp line
 * (Rabaud and Moisy 2013), so the half-angle this speed shows must measure
 * 19.47 degrees.
 */
export const WAKE_TRAWLER_SPEED_MS = 6.0;

/** Froude number on the waterline length. */
export function wakeFroude(hull: WakeHull, speedMs: number): number {
  return speedMs / Math.sqrt(GRAVITY_MS2 * hull.lengthM);
}

/**
 * Waterline half-breadth at xi, meters. xi runs from -1 (the transom) to
 * +1 (the stem). A fine entrance, (1 - xi^2)^0.7 forward of midship, so the
 * bow comes to a point, and a full run aft that narrows to the transom's
 * share: (1 - (1 - share) xi^4). The boat mesh and the foam both read this
 * one function, so the white water hugs the hull that is drawn.
 */
export function hullHalfBreadth(hull: WakeHull, xi: number): number {
  const half = hull.beamM / 2;
  if (xi >= 1 || xi < -1) return 0;
  if (xi >= 0) return half * Math.pow(1 - xi * xi, 0.7);
  return half * (1 - (1 - hull.transomShare) * xi * xi * xi * xi);
}

/* ------------------------------------------------------------------ */
/* The pressure that stands for the hull                               */
/* ------------------------------------------------------------------ */

/**
 * The hull as a surface pressure, in meters of head (p / (rho g)).
 *
 * Along the hull: a box of the waterline length, its ends smoothed by a
 * Gaussian of `endSmoothM`. The ends are where a hull makes its waves: the
 * pressure rises at the stem and falls at the transom, and each end
 * radiates its own Kelvin system (the bow and stern waves), which
 * interfere as a real hull's do. Across: a Gaussian of `sigmaYM`.
 *
 * The transform is separable and closed-form, so the GPU evaluates it per
 * mode with no table.
 */
export interface WakePressure {
  readonly lengthM: number;
  readonly endSmoothM: number;
  readonly sigmaYM: number;
  /** Head at the center of the patch, meters. */
  readonly headM: number;
}

/**
 * Share of the hydrostatic pressure that makes waves. 1 would put the whole
 * displaced volume into the patch; a linear pressure patch then makes the
 * waves of a thin ship, and thin-ship theory over-predicts a real hull's
 * waves because the boundary layer and the separated flow at the stern
 * soak up the stern wave (Michell theory runs 1.25 to 2 times high near
 * Fr 0.35; Tuck 1989). 0.8 is the low end of that correction. Checked in
 * the tests: the highest wave one hull length abeam is 0.3 to 0.9 m, the
 * range measured for 20 to 35 m vessels at 10 to 12 knots (PIANC WG 41,
 * 2003); this hull gives 0.73 m. At 0.6 (0.54 m) the wave field broke only
 * behind the transom and the diverging crests, the V's white lines, never
 * spilled; at 0.8 (0.84 m) they broke 80 m back and whitened the whole V,
 * the wake of a planing hull, not of a trawler.
 */
export const WAKE_WAVE_MAKING = 0.7;

/**
 * The pressure patch for a hull. The lateral sigma is a quarter of the beam,
 * so the patch at the waterline (+-B/2) is down to e^-2 = 13%: the side of
 * the hull. The end smoothing is 6% of the length, 1.8 m, the run over which
 * a trawler's waterline closes at the stem: the smoothing sets how short a
 * diverging wave the bow can make (e^{-k^2 s^2 / 2} is 0.14 at a 6 m wave).
 * The head is set so the patch holds the displaced volume, Cb L B T, times
 * WAKE_WAVE_MAKING.
 */
export function wakePressureForHull(hull: WakeHull, waveMaking = WAKE_WAVE_MAKING): WakePressure {
  const sigmaYM = hull.beamM / 4;
  const volume = hull.blockCoefficient * hull.lengthM * hull.beamM * hull.draftM;
  // Integral of the patch = head * L * sqrt(2 pi) sigmaY.
  const headM = (waveMaking * volume) / (hull.lengthM * Math.sqrt(2 * Math.PI) * sigmaYM);
  return { lengthM: hull.lengthM, endSmoothM: 0.06 * hull.lengthM, sigmaYM, headM };
}

/**
 * THE MODES THE HULL CANNOT DRIVE. The patch's transform is at most
 * exp(-k^2 m^2 / 2), m the smaller of its two smoothing lengths; past
 * WAKE_PRESSURE_CUT e-folds (1.2e-4 of the peak) a mode's forcing is
 * dropped. For the trawler that is k > 2.36 rad/m, wavelengths under
 * 2.7 m: 56% of the window's modes, which the pack kernel then skips (the
 * cost of a turn, where it sums up to 48 pieces per mode, halves). A
 * touch's modes are never cut: its splash is smaller than the hull's.
 */
export const WAKE_PRESSURE_CUT = 9;
export function wakePressureCutK(p: WakePressure): number {
  return Math.sqrt(2 * WAKE_PRESSURE_CUT) / Math.min(p.endSmoothM, p.sigmaYM);
}

/** sin(x) / x with its limit. */
export function sinc(x: number): number {
  return Math.abs(x) < 1e-6 ? 1 - (x * x) / 6 : Math.sin(x) / x;
}

/**
 * The continuous Fourier transform of the patch, INT p(x) e^{-i k.x} dx, in
 * the hull's own frame (kAlong on the heading, kAcross to the side). Real,
 * because the patch is symmetric about its center. Meters of head times
 * square meters.
 */
export function wakePressureTransform(p: WakePressure, kAlong: number, kAcross: number): number {
  const along = p.lengthM * sinc((kAlong * p.lengthM) / 2)
    * Math.exp(-0.5 * kAlong * kAlong * p.endSmoothM * p.endSmoothM);
  const across = Math.sqrt(2 * Math.PI) * p.sigmaYM
    * Math.exp(-0.5 * kAcross * kAcross * p.sigmaYM * p.sigmaYM);
  return p.headM * along * across;
}

/* ------------------------------------------------------------------ */
/* The course                                                          */
/* ------------------------------------------------------------------ */

/**
 * A racetrack course: a straight leg, a half turn, the straight back, a
 * half turn, round again, at constant speed. It is a closed loop so the
 * live viewer never runs the hull off the dense part of the sea for good,
 * and it has turns so the wake's curved case is on screen, not only proven.
 */
export interface WakeCourseSpec {
  readonly speedMs: number;
  /** Length of each straight leg, meters. */
  readonly straightM: number;
  /** Radius of each half turn, meters. */
  readonly turnRadiusM: number;
  /** +1 turns toward the hull's left (heading angle grows), -1 the other way. */
  readonly turnSign: 1 | -1;
  /** Where the hull's center is at `refTimeS`, world meters. */
  readonly refXM: number;
  readonly refZM: number;
  /**
   * The heading of the first straight leg, radians, measured from +X toward
   * +Z (the ocean's wind convention). -pi/2 heads down -Z, away from a
   * camera that looks down -Z.
   */
  readonly refHeadingRad: number;
  readonly refTimeS: number;
  /** How far into the first straight leg the hull is at `refTimeS`, meters. */
  readonly refAlongM: number;
  /**
   * Angle between polyline vertices on a turn, radians. 9 degrees on a 150 m
   * radius leaves a chord 0.46 m inside the arc, a fifth of the patch's
   * smallest scale (1.8 m); 6 degrees (0.21 m) cost half as many pieces
   * again in a turn for no change a capture showed.
   */
  readonly arcStepRad: number;
}

/**
 * The wake's course. The judged frames pin the sea at 42.0 s
 * (shootOurs.mjs); at that time the hull is 480 m into a 1400 m straight,
 * heading down -Z, its center 15 m out, so its stern and the young wake
 * sit on the dense center of the ocean mesh and the last turn is 80 s
 * behind it, past the window. A 150 m turn radius is 5 hull lengths, a
 * trawler's working turn.
 */
export const WAKE_COURSE: WakeCourseSpec = {
  speedMs: WAKE_TRAWLER_SPEED_MS,
  straightM: 1400,
  turnRadiusM: 150,
  turnSign: 1,
  refXM: 0,
  refZM: -15,
  refHeadingRad: -Math.PI / 2,
  refTimeS: 42,
  refAlongM: 480,
  arcStepRad: (9 * Math.PI) / 180,
};

/** Where the hull is at one time. */
export interface WakeCoursePoint {
  readonly xM: number;
  readonly zM: number;
  /** Heading, radians from +X toward +Z. */
  readonly headingRad: number;
  /** Arc length along the course from its origin, meters, unbounded. */
  readonly arcM: number;
}

/** A vertex of the course polyline: the hull's center at time `tS`. */
export interface WakeVertex {
  readonly tS: number;
  readonly xM: number;
  readonly zM: number;
}

export interface WakeCourse {
  readonly spec: WakeCourseSpec;
  readonly perimeterM: number;
  /** The hull's center at time t. */
  at(tS: number): WakeCoursePoint;
  /**
   * The course from t back to t - historyS as a polyline, youngest first:
   * the hull now, then every fixed vertex (leg ends, turn steps) in between,
   * then the point at t - historyS. The fixed vertices sit at fixed arc
   * lengths, so they do not move from frame to frame and the wake does not
   * shimmer; on a straight the whole history is one piece.
   */
  polyline(tS: number, historyS: number): WakeVertex[];
}

/** Build a racetrack course. */
export function createWakeCourse(spec: WakeCourseSpec = WAKE_COURSE): WakeCourse {
  const { speedMs: u, straightM: ls, turnRadiusM: r, turnSign: sgn } = spec;
  if (!(u > 0) || !(ls > 0) || !(r > 0)) {
    throw new Error('[ocean] A wake course needs a positive speed, straight length and turn radius.');
  }
  const turnM = Math.PI * r;
  const perimeterM = 2 * ls + 2 * turnM;
  const h0 = spec.refHeadingRad;
  // Start of the first straight: the reference point minus refAlong.
  const p0x = spec.refXM - spec.refAlongM * Math.cos(h0);
  const p0z = spec.refZM - spec.refAlongM * Math.sin(h0);

  /** Position and heading at loop arc length s in [0, perimeter). */
  const local = (s: number): { x: number; z: number; h: number } => {
    let x = p0x;
    let z = p0z;
    let h = h0;
    // Straight 1.
    if (s < ls) return { x: x + s * Math.cos(h), z: z + s * Math.sin(h), h };
    x += ls * Math.cos(h);
    z += ls * Math.sin(h);
    // Turn 1: the center sits R to the side the hull turns toward.
    const turn = (sx: number, sz: number, sh: number, a: number) => {
      const lx = -Math.sin(sh);
      const lz = Math.cos(sh);
      const cx = sx + sgn * r * lx;
      const cz = sz + sgn * r * lz;
      const hh = sh + sgn * (a / r);
      return { x: cx - sgn * r * -Math.sin(hh), z: cz - sgn * r * Math.cos(hh), h: hh };
    };
    if (s < ls + turnM) return turn(x, z, h, s - ls);
    const e1 = turn(x, z, h, turnM);
    x = e1.x; z = e1.z; h = e1.h;
    // Straight 2.
    const s2 = s - ls - turnM;
    if (s2 < ls) return { x: x + s2 * Math.cos(h), z: z + s2 * Math.sin(h), h };
    x += ls * Math.cos(h);
    z += ls * Math.sin(h);
    // Turn 2.
    return turn(x, z, h, s2 - ls);
  };

  const arcAt = (tS: number) => spec.refAlongM + u * (tS - spec.refTimeS);
  const wrap = (s: number) => s - Math.floor(s / perimeterM) * perimeterM;

  // Fixed break points of one lap, in loop arc length.
  const breaks: number[] = [0, ls];
  const turnSteps = Math.max(1, Math.ceil(Math.PI / spec.arcStepRad));
  for (let i = 1; i < turnSteps; i += 1) breaks.push(ls + (turnM * i) / turnSteps);
  breaks.push(ls + turnM, 2 * ls + turnM);
  for (let i = 1; i < turnSteps; i += 1) breaks.push(2 * ls + turnM + (turnM * i) / turnSteps);

  return {
    spec,
    perimeterM,
    at(tS) {
      const s = arcAt(tS);
      const p = local(wrap(s));
      return { xM: p.x, zM: p.z, headingRad: p.h, arcM: s };
    },
    polyline(tS, historyS) {
      const sHead = arcAt(tS);
      const sTail = arcAt(tS - historyS);
      const out: WakeVertex[] = [];
      const push = (s: number) => {
        const p = local(wrap(s));
        out.push({ tS: spec.refTimeS + (s - spec.refAlongM) / u, xM: p.x, zM: p.z });
      };
      push(sHead);
      const lapHi = Math.floor(sHead / perimeterM);
      const lapLo = Math.floor(sTail / perimeterM);
      for (let lap = lapHi; lap >= lapLo; lap -= 1) {
        for (let b = breaks.length - 1; b >= 0; b -= 1) {
          const s = lap * perimeterM + breaks[b];
          if (s < sHead - 1e-6 && s > sTail + 1e-6) push(s);
        }
      }
      push(sTail);
      // A vertex whose neighbors are on one straight line with it adds
      // nothing: drop it, so a straight history is one piece.
      const merged: WakeVertex[] = [out[0]];
      for (let i = 1; i < out.length - 1; i += 1) {
        const a = merged[merged.length - 1];
        const b = out[i];
        const c = out[i + 1];
        const cross = (b.xM - a.xM) * (c.zM - b.zM) - (b.zM - a.zM) * (c.xM - b.xM);
        const len = Math.hypot(b.xM - a.xM, b.zM - a.zM) * Math.hypot(c.xM - b.xM, c.zM - b.zM);
        if (len > 0 && Math.abs(cross) / len < 1e-9) continue;
        merged.push(b);
      }
      merged.push(out[out.length - 1]);
      return merged;
    },
  };
}

/* ------------------------------------------------------------------ */
/* The window the field lives on                                       */
/* ------------------------------------------------------------------ */

/** The size of the wake's grid. */
export interface WakeGrid {
  /** Texels along the heading. A power of two. */
  readonly nu: number;
  /** Texels across. A power of two. */
  readonly nv: number;
  readonly texelM: number;
}

/**
 * 512 x 256 texels at 1 m: a 512 m by 256 m window. 1 m resolves every wave
 * the patch makes: its transform is down to 0.001 at the 2 m Nyquist
 * wavelength. 256 m across holds the whole wedge (+-0.354 d wide at d
 * behind the hull) to 360 m back. 512 m along lets the history run 75 s at
 * this speed (`wakeHistoryFor`).
 */
export const WAKE_GRID: WakeGrid = { nu: 512, nv: 256, texelM: 1 };

/**
 * Meters of window kept ahead of the hull's STEM. The linear field has a
 * rise a hull length ahead of the stem; 30 m holds it, and beyond it the
 * window is masked, which hides the only place the periodic transform could
 * fold the far tail of the wake back into view.
 */
export const WAKE_WINDOW_AHEAD_M = 30;

/** Meters at the window's rear edge over which the field fades out. */
export const WAKE_WINDOW_REAR_FADE_M = 48;
/** Meters at each side edge over which the field fades out. */
export const WAKE_WINDOW_SIDE_FADE_M = 20;

/** A window placed on the water: corner C0, heading axis h and side axis l. */
export interface WakeWindow {
  readonly grid: WakeGrid;
  /** World position of texel (0, 0), meters. */
  readonly oxM: number;
  readonly ozM: number;
  /** Unit heading axis (texel i grows along it). */
  readonly hx: number;
  readonly hz: number;
  /** Unit side axis (texel j grows along it): h turned +90 degrees. */
  readonly lx: number;
  readonly lz: number;
  /** Along-window coordinate of the hull's center, meters from the rear edge. */
  readonly hullUM: number;
}

/**
 * Share of the history whose chord sets the window's axis. On a straight
 * the chord is the heading. In a turn the axis follows the chord of the
 * youngest 35% of the history instead of the heading, so the bent track
 * stays inside the window longer: on the 150 m turn the wave history held
 * went from 32 s (heading-aligned) to the value the tests report.
 */
export const WAKE_WINDOW_CHORD_SHARE = 0.35;

/**
 * Place the window on a hull: the hull's center on the window's axis, its
 * stem WAKE_WINDOW_AHEAD_M from the front edge. The axis is the chord from
 * the course point `chordS` seconds ago to the hull now (the heading when
 * `chordS` is 0 or the course is straight).
 */
export function wakeWindowFor(
  p: WakeCoursePoint, hull: WakeHull, grid: WakeGrid = WAKE_GRID, back?: WakeCoursePoint,
): WakeWindow {
  let hx = Math.cos(p.headingRad);
  let hz = Math.sin(p.headingRad);
  if (back) {
    const cx = p.xM - back.xM;
    const cz = p.zM - back.zM;
    const len = Math.hypot(cx, cz);
    if (len > 1) { hx = cx / len; hz = cz / len; }
  }
  const lx = -hz;
  const lz = hx;
  const lu = grid.nu * grid.texelM;
  const lv = grid.nv * grid.texelM;
  const hullUM = lu - WAKE_WINDOW_AHEAD_M - hull.lengthM / 2;
  return {
    grid,
    oxM: p.xM - hullUM * hx - (lv / 2) * lx,
    ozM: p.zM - hullUM * hz - (lv / 2) * lz,
    hx, hz, lx, lz,
    hullUM,
  };
}

/** The window for a course at time t, with the chord axis. */
export function wakeWindowAt(
  course: WakeCourse, tS: number, hull: WakeHull, historyS: number, grid: WakeGrid = WAKE_GRID,
): WakeWindow {
  return wakeWindowFor(course.at(tS), hull, grid, course.at(tS - WAKE_WINDOW_CHORD_SHARE * historyS));
}

/** World XZ to window (u, v) meters. */
export function wakeWorldToWindow(w: WakeWindow, xM: number, zM: number): [number, number] {
  const dx = xM - w.oxM;
  const dz = zM - w.ozM;
  return [dx * w.hx + dz * w.hz, dx * w.lx + dz * w.lz];
}

/**
 * How long a history the window holds, and the coherence time of the waves.
 *
 * S: the oldest pressure must stay inside the window, or the periodic
 * transform would put it in front of the hull. So S is the window's length
 * behind the hull, less the rear fade, over the speed: 75 s at 6 m/s.
 *
 * T = S / 3. Cutting the history at S is the same as adding the wake of a
 * second, negative hull at the cut, scaled by e^{-S/T}: at S / 3 that copy
 * is 5% and sits in the rear fade. T also ages the wake: the transverse
 * waves d behind the hull were made 2 d / U ago and keep e^{-2 d / (U T)}
 * (0.37 at 75 m), the cusp waves e^{-1.41 d / (U T)} (0.37 at 106 m). A
 * real wake in a 1 to 2 m sea is lost in the waves at about that range.
 */
export function wakeHistoryFor(
  hull: WakeHull, speedMs: number, grid: WakeGrid = WAKE_GRID,
): { historyS: number; coherenceS: number } {
  const lu = grid.nu * grid.texelM;
  const behindM = lu - WAKE_WINDOW_AHEAD_M - hull.lengthM / 2 - WAKE_WINDOW_REAR_FADE_M;
  const historyS = behindM / Math.max(speedMs, 0.5);
  return { historyS, coherenceS: historyS / 3 };
}

/** The window's rear and side fades at (u, v) meters: the foam's mask. */
export function wakeEdgeFade(w: WakeWindow, uM: number, vM: number): number {
  const lv = w.grid.nv * w.grid.texelM;
  const rear = smoothstep(0, WAKE_WINDOW_REAR_FADE_M, uM);
  const side = smoothstep(0, WAKE_WINDOW_SIDE_FADE_M, vM) * smoothstep(0, WAKE_WINDOW_SIDE_FADE_M, lv - vM);
  return rear * side;
}

/**
 * The window's mask at (u, v) meters: 1 inside, fading to 0 over the rear
 * and side edges and from WAKE_WINDOW_AHEAD_M / 3 ahead of the stem. The
 * waves' mask; the foam takes the edge fades only.
 */
export function wakeWindowMask(w: WakeWindow, hull: WakeHull, uM: number, vM: number): number {
  const lu = w.grid.nu * w.grid.texelM;
  const stemU = w.hullUM + hull.lengthM / 2;
  const ahead = 1 - smoothstep(stemU + WAKE_WINDOW_AHEAD_M / 3, lu - 2, uM);
  return ahead * wakeEdgeFade(w, uM, vM);
}

/** GLSL smoothstep, for the CPU mirror. */
export function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1);
  return t * t * (3 - 2 * t);
}

/* ------------------------------------------------------------------ */
/* The course as pieces, in the window's frame                         */
/* ------------------------------------------------------------------ */

/**
 * One straight piece of the course, as the kernels read it. Window-frame
 * meters. The piece runs from age `ageS` (its young end, at d) to age
 * `ageS + durS` (its old end, at d + v durS).
 */
export interface WakeSegment {
  /** Young end, window (u, v) meters. */
  readonly du: number;
  readonly dv: number;
  /** dX/ds: the hull's velocity reversed (s is age), window frame, m/s. */
  readonly vu: number;
  readonly vv: number;
  readonly ageS: number;
  readonly durS: number;
  /**
   * The piece's weight in the wave sum times e^{-ageS / T}, so the GPU
   * spends no exp on it. The weight is 1 except in the taper (see
   * `wakeSegments`).
   */
  readonly decayAge: number;
  /** e^{-durS / T}. */
  readonly decayDur: number;
  /** The weight alone: 1, a taper step, or 0 past the wave history. */
  readonly weight: number;
  /** The hull's heading on this piece, a unit vector in the window frame. */
  readonly cosH: number;
  readonly sinH: number;
  /** Course length from the hull now to the young end, meters. */
  readonly arcM: number;
  /** Speed on this piece, m/s. */
  readonly speedMs: number;
}

/** The pieces for one frame. */
export interface WakeSegmentSet {
  /** Youngest first. The first `waveCount` make waves; the rest only foam. */
  readonly segs: WakeSegment[];
  readonly waveCount: number;
  /** The wave history actually used, seconds (under `historyS` in a turn). */
  readonly waveHistoryS: number;
}

/**
 * Most pieces the kernels take. A straight history is one piece; the worst
 * case is a history that spans a whole turn: 30 turn steps, two legs and
 * the taper's splits.
 */
export const WAKE_MAX_SEGMENTS = 48;

/**
 * Steps of the taper that fades a cut history. In a turn the course bends
 * out of the side of the window long before S, and a pressure outside the
 * window would come back in on the far side. So the wave history is cut
 * where the course leaves the window's inner box, and its oldest 40% fades
 * out in these steps (weights 7/8, 5/8, 3/8, 1/8, the midpoints of a
 * linear ramp): each step starts a transient an eighth of the hull's, where
 * a plain cut starts one e^{-s/T} of it, 0.2 at a 36 s cut.
 */
export const WAKE_TAPER_STEPS = 4;
export const WAKE_TAPER_SHARE = 0.4;

/**
 * The course from t back S seconds, as window-frame pieces, youngest first.
 *
 * The wave history ends at S or where the course leaves the window's inner
 * box (inside the rear and side fades), whichever is younger; when the box
 * cuts it, the taper above fades it out. Every piece to S is kept for the
 * foam, which has no periodic transform and so no need to stop.
 */
export function wakeSegments(
  course: WakeCourse, tS: number, w: WakeWindow, historyS: number, coherenceS: number,
): WakeSegmentSet {
  const poly = course.polyline(tS, historyS);
  const lv = w.grid.nv * w.grid.texelM;
  const lu = w.grid.nu * w.grid.texelM;
  const inBox = (u: number, v: number) => u >= WAKE_WINDOW_REAR_FADE_M - 1 && u <= lu
    && v >= WAKE_WINDOW_SIDE_FADE_M && v <= lv - WAKE_WINDOW_SIDE_FADE_M;

  // Raw pieces, young to old, window frame.
  interface Raw { a: number; b: number; au: number; av: number; bu: number; bv: number }
  const raw: Raw[] = [];
  for (let i = 0; i + 1 < poly.length; i += 1) {
    const pa = poly[i];
    const pb = poly[i + 1];
    if (!(pa.tS - pb.tS > 1e-9)) continue;
    const [au, av] = wakeWorldToWindow(w, pa.xM, pa.zM);
    const [bu, bv] = wakeWorldToWindow(w, pb.xM, pb.zM);
    raw.push({ a: tS - pa.tS, b: tS - pb.tS, au, av, bu, bv });
  }

  // Where the course first leaves the inner box: bisect the first piece
  // whose old end is out.
  let waveS = historyS;
  for (const r of raw) {
    if (inBox(r.bu, r.bv)) continue;
    let lo = 0;
    let hi = 1;
    for (let it = 0; it < 30; it += 1) {
      const m = (lo + hi) / 2;
      if (inBox(r.au + (r.bu - r.au) * m, r.av + (r.bv - r.av) * m)) lo = m; else hi = m;
    }
    waveS = Math.min(historyS, r.a + lo * (r.b - r.a));
    break;
  }
  // A cut within 3% of S is the straight case's own rear end: no taper.
  const cut = waveS < 0.97 * historyS;
  if (!cut) waveS = historyS;
  // Age boundaries of the taper steps, and the weight of each band.
  const edges: number[] = [];
  if (cut) {
    const t0 = (1 - WAKE_TAPER_SHARE) * waveS;
    for (let k = 0; k <= WAKE_TAPER_STEPS; k += 1) edges.push(t0 + (k * (waveS - t0)) / WAKE_TAPER_STEPS);
  } else {
    edges.push(waveS);
  }
  const weightAt = (age: number): number => {
    if (age >= waveS - 1e-9) return 0;
    if (!cut) return 1;
    for (let k = 0; k < WAKE_TAPER_STEPS; k += 1) {
      if (age < edges[k]) return 1;
      if (age < edges[k + 1]) return 1 - (k + 0.5) / WAKE_TAPER_STEPS;
    }
    return 0;
  };

  const segs: WakeSegment[] = [];
  let waveCount = 0;
  let arc = 0;
  for (const r of raw) {
    // Split the piece at every weight boundary inside it.
    const cuts = [r.a];
    for (const e of edges) if (e > r.a + 1e-9 && e < r.b - 1e-9) cuts.push(e);
    cuts.push(r.b);
    const vu = (r.bu - r.au) / (r.b - r.a);
    const vv = (r.bv - r.av) / (r.b - r.a);
    const speed = Math.hypot(vu, vv);
    for (let c = 0; c + 1 < cuts.length && segs.length < WAKE_MAX_SEGMENTS; c += 1) {
      const ageS = cuts[c];
      const durS = cuts[c + 1] - cuts[c];
      const weight = weightAt(ageS + durS / 2);
      if (weight > 0) waveCount = segs.length + 1;
      segs.push({
        du: r.au + vu * (ageS - r.a),
        dv: r.av + vv * (ageS - r.a),
        vu, vv, ageS, durS,
        decayAge: weight * Math.exp(-ageS / coherenceS),
        decayDur: Math.exp(-durS / coherenceS),
        weight,
        cosH: speed > 0 ? -vu / speed : 1,
        sinH: speed > 0 ? -vv / speed : 0,
        arcM: arc,
        speedMs: speed,
      });
      arc += speed * durS;
    }
  }
  return { segs, waveCount, waveHistoryS: waveS };
}

/* ------------------------------------------------------------------ */
/* Touches: ripples from a point                                       */
/* ------------------------------------------------------------------ */

/**
 * A touch: a brief press on the water at one point, the source of a ring
 * of ripples (something dropped in, a splash, a hand). The same forced
 * oscillator the hull drives, with a round Gaussian pressure that stands
 * still for `durS` seconds from `tS`: its piece integral is the hull's with
 * no velocity, so the rings come out of the dispersion relation too. Long
 * waves outrun short ones (Cauchy and Poisson), which a height-field
 * ripple with one ripple speed cannot do.
 */
export interface WakeTouch {
  readonly xM: number;
  readonly zM: number;
  readonly tS: number;
  /** Gaussian sigma of the press, meters. */
  readonly radiusM: number;
  /** Pressure head at its center, meters. */
  readonly headM: number;
  /** How long it presses, seconds. */
  readonly durS: number;
}

/**
 * THE DEFAULT TOUCH: a body of a person's size going in. A sigma of 0.4 m
 * is a splash about a meter across; a head of 2 m (the body's own length
 * of water pushed aside) pressing for 0.25 s gives a first ring about 7 cm
 * high 5 to 10 m out after 8 s: the rings a swimmer's jump leaves on flat
 * water. Set, not measured.
 */
export const WAKE_TOUCH_DEFAULT = { radiusM: 0.4, headM: 2, durS: 0.25 } as const;

/** Most touches the kernels take at once; the oldest drop first. */
export const WAKE_MAX_TOUCHES = 16;

/** A touch as the kernels read it: a still piece and its round footprint. */
export interface WakeTouchPiece {
  /** Window (u, v) meters. */
  readonly du: number;
  readonly dv: number;
  /** Age of the press's end (0 while it presses) and its duration so far. */
  readonly ageS: number;
  readonly durS: number;
  readonly decayAge: number;
  readonly decayDur: number;
  readonly radiusM: number;
  /** The footprint's transform at k = 0: head 2 pi sigma^2. */
  readonly volumeM3: number;
}

/**
 * The touches still ringing at time t, as window pieces: started by t and
 * younger than three coherence times (5% left). A touch outside the window
 * is dropped: the window is periodic.
 */
export function wakeTouchPieces(
  touches: readonly WakeTouch[], tS: number, w: WakeWindow, coherenceS: number,
): WakeTouchPiece[] {
  const lu = w.grid.nu * w.grid.texelM;
  const lv = w.grid.nv * w.grid.texelM;
  const out: WakeTouchPiece[] = [];
  for (let k = touches.length - 1; k >= 0 && out.length < WAKE_MAX_TOUCHES; k -= 1) {
    const t = touches[k];
    const since = tS - t.tS;
    if (!(since > 0) || since > 3 * coherenceS) continue;
    const [du, dv] = wakeWorldToWindow(w, t.xM, t.zM);
    if (du < 0 || du > lu || dv < 0 || dv > lv) continue;
    const ageS = Math.max(since - t.durS, 0);
    const durS = Math.min(since, t.durS);
    out.push({
      du, dv, ageS, durS,
      decayAge: Math.exp(-ageS / coherenceS),
      decayDur: Math.exp(-durS / coherenceS),
      radiusM: t.radiusM,
      volumeM3: t.headM * 2 * Math.PI * t.radiusM * t.radiusM,
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* The closed form, per mode                                           */
/* ------------------------------------------------------------------ */

/** (e^z - 1) / z for complex z, into out; with its series near 0. */
export function expm1OverZ(zr: number, zi: number, out: [number, number]): [number, number] {
  const m2 = zr * zr + zi * zi;
  if (m2 < 1e-8) {
    // 1 + z/2 + z^2/6.
    out[0] = 1 + zr / 2 + (zr * zr - zi * zi) / 6;
    out[1] = zi / 2 + (2 * zr * zi) / 6;
    return out;
  }
  const e = Math.exp(zr);
  const nr = e * Math.cos(zi) - 1;
  const ni = e * Math.sin(zi);
  // (nr + i ni) / (zr + i zi)
  out[0] = (nr * zr + ni * zi) / m2;
  out[1] = (ni * zr - nr * zi) / m2;
  return out;
}

/**
 * INT_seg e^{-s/T} sin(omega s) e^{-i k.(X(t-s) - C0)} ds for one piece, in
 * closed form. With s = a + sigma on the piece and beta = -1/T +- i omega
 * - i k.v, the integral is
 *
 *   e^{-i k.d} e^{-a/T} dur [e^{i omega a} E(beta+ dur)
 *                            - e^{-i omega a} E(beta- dur)] / (2 i)
 *
 * where E(z) = (e^z - 1) / z. Re(beta) = -1/T, so beta never vanishes and
 * the resonance where the hull keeps station with a wave (omega = k.U,
 * Kelvin's condition) is finite: it grows with the piece's length up to T.
 *
 * THIS IS THE FUNCTION THE PACK KERNEL MIRRORS. Keep them identical.
 */
export function wakeSegmentIntegral(
  ku: number, kv: number, omega: number, seg: WakeSegment, coherenceS: number,
  out: [number, number],
): [number, number] {
  const kdotV = ku * seg.vu + kv * seg.vv;
  const invT = 1 / coherenceS;
  const ep: [number, number] = [0, 0];
  const em: [number, number] = [0, 0];
  expm1OverZ(-invT * seg.durS, (omega - kdotV) * seg.durS, ep);
  expm1OverZ(-invT * seg.durS, (-omega - kdotV) * seg.durS, em);
  const ca = Math.cos(omega * seg.ageS);
  const sa = Math.sin(omega * seg.ageS);
  // q = e^{i w a} ep - e^{-i w a} em
  const qr = (ca * ep[0] - sa * ep[1]) - (ca * em[0] + sa * em[1]);
  const qi = (ca * ep[1] + sa * ep[0]) - (ca * em[1] - sa * em[0]);
  // / (2 i) = -i q / 2
  const hr = qi / 2;
  const hi = -qr / 2;
  const scale = seg.decayAge * seg.durS;
  const ph = -(ku * seg.du + kv * seg.dv);
  const pc = Math.cos(ph);
  const ps = Math.sin(ph);
  out[0] = scale * (pc * hr - ps * hi);
  out[1] = scale * (pc * hi + ps * hr);
  return out;
}

/**
 * The wake's Fourier coefficient at window wavevector (ku, kv): the sum of
 * every piece's integral, each with the patch turned to that piece's
 * heading, and every touch's with its round footprint, times
 * -k g / (omega A). A is the window's area, the factor that
 * turns a continuous transform into a coefficient of the periodic sum.
 * The mean (k = 0) is 0: the patch pushes water aside, it does not remove it.
 */
export function wakeModeAmplitude(
  ku: number, kv: number, segs: readonly WakeSegment[], pr: WakePressure,
  coherenceS: number, areaM2: number, out: [number, number],
  touches: readonly WakeTouchPiece[] = [],
): [number, number] {
  const k = Math.hypot(ku, kv);
  out[0] = 0;
  out[1] = 0;
  if (k < 1e-9) return out;
  const omega = Math.sqrt(GRAVITY_MS2 * k);
  const tmp: [number, number] = [0, 0];
  let sr = 0;
  let si = 0;
  const hullCut = k > wakePressureCutK(pr);
  for (const seg of segs) {
    if (seg.decayAge === 0 || hullCut) continue;
    const kAlong = ku * seg.cosH + kv * seg.sinH;
    const kAcross = -ku * seg.sinH + kv * seg.cosH;
    const f = wakePressureTransform(pr, kAlong, kAcross);
    wakeSegmentIntegral(ku, kv, omega, seg, coherenceS, tmp);
    sr += f * tmp[0];
    si += f * tmp[1];
  }
  for (const t of touches) {
    const f = t.volumeM3 * Math.exp(-0.5 * (ku * ku + kv * kv) * t.radiusM * t.radiusM);
    const still: WakeSegment = {
      du: t.du, dv: t.dv, vu: 0, vv: 0, ageS: t.ageS, durS: t.durS,
      decayAge: t.decayAge, decayDur: t.decayDur, weight: 1, cosH: 1, sinH: 0, arcM: 0, speedMs: 0,
    };
    wakeSegmentIntegral(ku, kv, omega, still, coherenceS, tmp);
    sr += f * tmp[0];
    si += f * tmp[1];
  }
  const g = -(k * GRAVITY_MS2) / (omega * areaM2);
  out[0] = g * sr;
  out[1] = g * si;
  return out;
}

/**
 * Low-pass length of the height the MESH carries, meters. The ocean mesh's
 * vertices are 1 to 3 m apart where the wake is seen, so the height it
 * displaces is the wake times e^{-k^2 l^2 / 2}: at l = 1.5 m a 6 m wave
 * keeps 29% and a 4 m wave 4%. The shading reads the full slope, so the
 * short diverging waves still show; they are just not bent into a mesh that
 * would alias them.
 */
export const WAKE_VERTEX_SMOOTH_M = 1.5;

/* ------------------------------------------------------------------ */
/* The CPU realization (tests and the GPU cross-check)                 */
/* ------------------------------------------------------------------ */

/** The wavevector of spectrum index p on an axis of n texels. Centered: p = n/2 is k = 0. */
export function wakeKOf(p: number, n: number, texelM: number): number {
  return ((p - n / 2) * 2 * Math.PI) / (n * texelM);
}

/** The field on the window grid, row-major (u fastest), meters and slopes. */
export interface WakeFieldCpu {
  readonly nu: number;
  readonly nv: number;
  readonly eta: Float64Array;
  /** d eta / du, d eta / dv (window frame). */
  readonly etaU: Float64Array;
  readonly etaV: Float64Array;
  /** The mesh's low-passed height (WAKE_VERTEX_SMOOTH_M). */
  readonly etaLp: Float64Array;
}

/**
 * The wake on the window grid, on the CPU, in float64: every mode by
 * `wakeModeAmplitude`, then the same Stockham inverse transform the GPU runs
 * (`fft1d` from oceanFftReference.ts, rows then columns), then the
 * (-1)^(i+j) of the centered wavevector grid. No mask is applied. This is
 * the oracle for the kernels and the field the tests measure.
 */
export function realizeWakeCpu(
  segs: readonly WakeSegment[], pr: WakePressure, grid: WakeGrid, coherenceS: number,
  touches: readonly WakeTouchPiece[] = [],
): WakeFieldCpu {
  const { nu, nv, texelM } = grid;
  const cells = nu * nv;
  const area = nu * nv * texelM * texelM;
  // Two packed complex planes, as on the GPU: A = eta + i etaU,
  // B = etaV + i etaLp. Interleaved complex.
  const a = new Float64Array(cells * 2);
  const b = new Float64Array(cells * 2);
  const amp: [number, number] = [0, 0];
  for (let q = 0; q < nv; q += 1) {
    const kv = wakeKOf(q, nv, texelM);
    for (let p = 0; p < nu; p += 1) {
      const ku = wakeKOf(p, nu, texelM);
      wakeModeAmplitude(ku, kv, segs, pr, coherenceS, area, amp, touches);
      const hr = amp[0];
      const hi = amp[1];
      // d/du: i ku hhat = (-ku hi, ku hr); d/dv likewise.
      const ur = -ku * hi;
      const ui = ku * hr;
      const vr = -kv * hi;
      const vi = kv * hr;
      const lp = Math.exp(-0.5 * (ku * ku + kv * kv) * WAKE_VERTEX_SMOOTH_M * WAKE_VERTEX_SMOOTH_M);
      const lr = hr * lp;
      const li = hi * lp;
      const o = 2 * (q * nu + p);
      // Pack X + i Y: (X.re - Y.im, X.im + Y.re).
      a[o] = hr - ui;
      a[o + 1] = hi + ur;
      b[o] = vr - li;
      b[o + 1] = vi + lr;
    }
  }
  const ifft = (buf: Float64Array) => {
    const scratch = new Float64Array(buf.length);
    for (let q = 0; q < nv; q += 1) {
      const res = fft1d(buf, scratch, nu, true, q * nu, 1);
      if (res !== buf) for (let p = 0; p < nu; p += 1) { const o = 2 * (q * nu + p); buf[o] = res[o]; buf[o + 1] = res[o + 1]; }
    }
    for (let p = 0; p < nu; p += 1) {
      const res = fft1d(buf, scratch, nv, true, p, nu);
      if (res !== buf) for (let q = 0; q < nv; q += 1) { const o = 2 * (q * nu + p); buf[o] = res[o]; buf[o + 1] = res[o + 1]; }
    }
  };
  ifft(a);
  ifft(b);
  const eta = new Float64Array(cells);
  const etaU = new Float64Array(cells);
  const etaV = new Float64Array(cells);
  const etaLp = new Float64Array(cells);
  for (let j = 0; j < nv; j += 1) {
    for (let i = 0; i < nu; i += 1) {
      const c = j * nu + i;
      const sg = ((i + j) & 1) === 0 ? 1 : -1;
      eta[c] = sg * a[2 * c];
      etaU[c] = sg * a[2 * c + 1];
      etaV[c] = sg * b[2 * c];
      etaLp[c] = sg * b[2 * c + 1];
    }
  }
  return { nu, nv, eta, etaU, etaV, etaLp };
}

/* ------------------------------------------------------------------ */
/* Measurements (tests and the capture reports)                        */
/* ------------------------------------------------------------------ */

/**
 * The wake's half-angles from a realized field, degrees, read off the SLOPE
 * envelope, since slope is what the shading shows.
 *
 * The envelope at a texel is the largest |grad eta| within half a
 * transverse wavelength (pi U^2 / g) along the track, so a crest and a
 * trough count alike. For each row from `fromM` to `toM` behind the hull's
 * center, and each side of the track (past 0.05 of the distance, so the
 * track itself is not picked):
 *
 *   peak  the angle of the envelope's maximum: the line of steepest waves
 *         (Rabaud and Moisy's measure).
 *   edge  the angle of the outermost point where the envelope is still half
 *         its maximum: the side of the V. Kelvin's wedge ends at 19.47
 *         degrees, with an Airy tail outside it.
 *
 * Each is the median over rows and sides.
 */
export function measureWakeHalfAngleDeg(
  f: WakeFieldCpu, w: WakeWindow, fromM: number, toM: number, speedMs: number,
): { peakDeg: number; edgeDeg: number } {
  const t = w.grid.texelM;
  const v0 = (w.grid.nv * t) / 2;
  const halfWave = Math.max(1, Math.round((Math.PI * speedMs * speedMs) / GRAVITY_MS2 / t));
  const peaks: number[] = [];
  const edges: number[] = [];
  const env = new Float64Array(f.nv);
  for (let d = fromM; d <= toM; d += t) {
    const i = Math.round((w.hullUM - d) / t);
    if (i - halfWave < 0 || i + halfWave >= f.nu) continue;
    for (let j = 0; j < f.nv; j += 1) {
      let e = 0;
      for (let di = -halfWave; di <= halfWave; di += 1) {
        const c = j * f.nu + i + di;
        e = Math.max(e, Math.hypot(f.etaU[c], f.etaV[c]));
      }
      env[j] = e;
    }
    for (const side of [-1, 1]) {
      let best = 0;
      let bestOff = 0;
      for (let j = 0; j < f.nv; j += 1) {
        const off = side * (j * t - v0);
        if (off < 0.05 * d || off > 0.9 * d) continue;
        if (env[j] > best) { best = env[j]; bestOff = off; }
      }
      if (!(best > 0)) continue;
      let edgeOff = bestOff;
      for (let j = 0; j < f.nv; j += 1) {
        const off = side * (j * t - v0);
        if (off > edgeOff && off <= 0.9 * d && env[j] >= 0.5 * best) edgeOff = off;
      }
      peaks.push((Math.atan(bestOff / d) * 180) / Math.PI);
      edges.push((Math.atan(edgeOff / d) * 180) / Math.PI);
    }
  }
  const med = (a: number[]) => {
    a.sort((x, y) => x - y);
    return a.length ? a[Math.floor(a.length / 2)] : NaN;
  };
  return { peakDeg: med(peaks), edgeDeg: med(edges) };
}
