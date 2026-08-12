/**
 * @file surfaceProbe.ts — the second stage of scatter placement.
 *
 * Aralia scatters in ONE stage: sample candidates inside a layout mask at the
 * region target density. That stage cannot see the ground it aims at, so a tree
 * lands on a cliff face and a rock hovers over a ridge.
 *
 * This file adds the missing stage. A `SurfaceProbe` reads the LOCAL surface at
 * a candidate — elevation, slope and normal. A `SurfaceGate` then REJECTS the
 * candidate, or the caller ADJUSTS its tilt and sink to fit the surface.
 *
 * Units: FEET, everywhere. Worldforge is feet-canon. Callers that hold meters
 * convert at the boundary (`FEET_PER_METER` below).
 *
 * Perf: a probe is a pure sampler over data the caller already holds. Bake the
 * result at scatter time. NEVER call `sampleAt` per frame.
 */

// ── The contract (imported by other placement passes — do not rename) ────────

export interface SurfaceSample {
  elevationFt: number;
  slopeRad: number;                  // 0 = flat, PI/2 = vertical wall
  normal: [number, number, number];  // unit vector, Y-up
}

export interface SurfaceProbe {
  sampleAt(xFt: number, zFt: number): SurfaceSample;
}

// ── Unit bridge ─────────────────────────────────────────────────────────────

/** One meter in feet. World3D and the props engine hold meters; probes hold feet. */
export const FEET_PER_METER = 1 / 0.3048;

// ── Probe factories ─────────────────────────────────────────────────────────

/** Row-major elevation grid input for `makeGridSurfaceProbe`. */
export interface GridSurfaceProbeOptions {
  /** Elevation in FEET, row-major, length cols*rows. */
  elevationsFt: ArrayLike<number>;
  cols: number;
  rows: number;
  /** Ground distance in feet between two adjacent samples on X. */
  cellSizeXFt: number;
  /** Ground distance in feet between two adjacent samples on Z. */
  cellSizeZFt: number;
  /** World X of grid column 0. Defaults to 0. */
  originXFt?: number;
  /** World Z of grid row 0. Defaults to 0. */
  originZFt?: number;
}

/**
 * A probe over a rasterized heightfield. Elevation is bilinear; the gradient is
 * a central difference on the same bilinear field, so slope stays continuous
 * across cell edges and two neighboring candidates cannot disagree.
 *
 * Queries outside the grid EXTRAPOLATE the edge gradient linearly. Clamping to
 * the edge sample instead would flatten the central difference at the border to
 * half its true value, and a cliff-edge grid would then keep a rim of instances
 * along its own seam.
 */
export function makeGridSurfaceProbe(opts: GridSurfaceProbeOptions): SurfaceProbe {
  const { elevationsFt, cols, rows } = opts;
  if (cols < 2 || rows < 2) {
    throw new Error(`[surfaceProbe] grid probe needs at least 2x2 samples, got ${cols}x${rows}`);
  }
  if (elevationsFt.length < cols * rows) {
    throw new Error(
      `[surfaceProbe] elevation grid holds ${elevationsFt.length} samples, needs ${cols * rows}`,
    );
  }
  const cellX = opts.cellSizeXFt;
  const cellZ = opts.cellSizeZFt;
  if (!(cellX > 0) || !(cellZ > 0)) {
    throw new Error(`[surfaceProbe] cell size must be positive, got ${cellX} x ${cellZ}`);
  }
  const originX = opts.originXFt ?? 0;
  const originZ = opts.originZFt ?? 0;

  const raw = (c: number, r: number): number => elevationsFt[r * cols + c] ?? 0;

  /** One sample, with the edge gradient extrapolated outside the grid. */
  const at = (c: number, r: number): number => {
    const rr = r < 0 ? 0 : r > rows - 1 ? rows - 1 : r;
    let v: number;
    if (c < 0) v = raw(0, rr) + c * (raw(1, rr) - raw(0, rr));
    else if (c > cols - 1) v = raw(cols - 1, rr) + (c - (cols - 1)) * (raw(cols - 1, rr) - raw(cols - 2, rr));
    else v = raw(c, rr);
    if (r < 0) return v + r * (at2(c, 1) - at2(c, 0));
    if (r > rows - 1) return v + (r - (rows - 1)) * (at2(c, rows - 1) - at2(c, rows - 2));
    return v;
  };

  /** Column-extrapolated sample on a VALID row — the helper `at` leans on. */
  const at2 = (c: number, r: number): number => {
    if (c < 0) return raw(0, r) + c * (raw(1, r) - raw(0, r));
    if (c > cols - 1) return raw(cols - 1, r) + (c - (cols - 1)) * (raw(cols - 1, r) - raw(cols - 2, r));
    return raw(c, r);
  };

  const elevation = (xFt: number, zFt: number): number => {
    const fx = (xFt - originX) / cellX;
    const fz = (zFt - originZ) / cellZ;
    const c0 = Math.floor(fx);
    const r0 = Math.floor(fz);
    const tx = fx - c0;
    const tz = fz - r0;
    const h00 = at(c0, r0);
    const h10 = at(c0 + 1, r0);
    const h01 = at(c0, r0 + 1);
    const h11 = at(c0 + 1, r0 + 1);
    const top = h00 + (h10 - h00) * tx;
    const bottom = h01 + (h11 - h01) * tx;
    return top + (bottom - top) * tz;
  };

  return makeFieldSurfaceProbe(elevation, { epsilonXFt: cellX * 0.5, epsilonZFt: cellZ * 0.5 });
}

/** Finite-difference spacing for `makeFieldSurfaceProbe`. */
export interface FieldSurfaceProbeOptions {
  /** Half-step used on X. Default 5 ft (one combat cell). */
  epsilonXFt?: number;
  /** Half-step used on Z. Default 5 ft. */
  epsilonZFt?: number;
}

/**
 * A probe over an ANALYTIC height field — the region terrain samplers, the
 * town pad, any function of world feet. Slope comes from a central difference,
 * so the step size sets the scale of relief the gate can see. A step near the
 * instance footprint is right: a tree should read the slope of the ground it
 * stands on, not of a pebble.
 */
export function makeFieldSurfaceProbe(
  elevationFtAt: (xFt: number, zFt: number) => number,
  opts: FieldSurfaceProbeOptions = {},
): SurfaceProbe {
  const ex = opts.epsilonXFt ?? 5;
  const ez = opts.epsilonZFt ?? 5;
  if (!(ex > 0) || !(ez > 0)) {
    throw new Error(`[surfaceProbe] finite-difference step must be positive, got ${ex} x ${ez}`);
  }
  return {
    sampleAt(xFt: number, zFt: number): SurfaceSample {
      const elevationFt = elevationFtAt(xFt, zFt);
      // dY/dX and dY/dZ, feet per foot — a pure ratio, so no unit sneaks in.
      const dydx = (elevationFtAt(xFt + ex, zFt) - elevationFtAt(xFt - ex, zFt)) / (2 * ex);
      const dydz = (elevationFtAt(xFt, zFt + ez) - elevationFtAt(xFt, zFt - ez)) / (2 * ez);
      return { elevationFt, slopeRad: slopeFromGradient(dydx, dydz), normal: normalFromGradient(dydx, dydz) };
    },
  };
}

/** A probe over one constant elevation. For flat test beds and flat interiors. */
export function makeFlatSurfaceProbe(elevationFt = 0): SurfaceProbe {
  const sample: SurfaceSample = { elevationFt, slopeRad: 0, normal: [0, 1, 0] };
  return { sampleAt: () => ({ ...sample, normal: [0, 1, 0] }) };
}

// ── Gradient math ───────────────────────────────────────────────────────────

/** Surface normal for a height gradient. Unit length, Y-up, Y always positive. */
export function normalFromGradient(dydx: number, dydz: number): [number, number, number] {
  const len = Math.sqrt(dydx * dydx + dydz * dydz + 1);
  // `+ 0` normalizes -0 to 0: flat ground must produce ONE canonical up normal,
  // or two byte-equal surfaces compare unequal.
  return [-dydx / len + 0, 1 / len, -dydz / len + 0];
}

/** Slope angle from the horizontal, radians. 0 = flat, PI/2 = vertical wall. */
export function slopeFromGradient(dydx: number, dydz: number): number {
  return Math.atan(Math.hypot(dydx, dydz));
}

/**
 * Compass-style aspect of a sample: the direction the slope FACES (downhill),
 * radians in [0, 2PI). 0 = faces +Z, PI/2 = faces +X. A flat sample has no
 * aspect and returns `null`.
 */
export function aspectRadOf(sample: SurfaceSample): number | null {
  const [nx, , nz] = sample.normal;
  if (Math.hypot(nx, nz) < 1e-6) return null;
  const a = Math.atan2(nx, nz);
  return a < 0 ? a + Math.PI * 2 : a;
}

// ── The gate ────────────────────────────────────────────────────────────────

/**
 * A species' surface tolerance. Every scatter pass reads one of these before it
 * keeps a candidate. A tree carries a low `maxSlopeRad` and a low `maxTiltRad`.
 * A rock carries a high `maxSlopeRad` and a full `maxTiltRad`, so it lies flat
 * on whatever it landed on.
 */
export interface SurfaceGate {
  /** Reject below this elevation. Default -Infinity. */
  minElevationFt?: number;
  /** Reject above this elevation. Default +Infinity. */
  maxElevationFt?: number;
  /** Reject where the ground is steeper than this. Required — it is the point. */
  maxSlopeRad: number;
  /**
   * Optional aspect preference: the slope face this species likes, radians,
   * measured like `aspectRadOf`. Candidates outside `aspectToleranceRad` are
   * kept only with probability `aspectOffChance`.
   */
  preferredAspectRad?: number;
  /** Half-width of the preferred aspect band. Default PI/2. */
  aspectToleranceRad?: number;
  /** Keep-probability for a candidate facing the wrong way. Default 0.25. */
  aspectOffChance?: number;
  /**
   * How far the instance may lean to follow the normal, radians. A tree grows
   * toward the sky, so 0.1–0.2 rad. A rock takes the ground, so PI/2.
   */
  maxTiltRad: number;
  /**
   * Radius of the instance's base in feet. The instance sinks by the drop its
   * own base spans on this slope, so it MEETS the ground instead of touching at
   * one point. 0 = a point-footed instance that never sinks.
   */
  baseRadiusFt: number;
  /**
   * Optional slope-driven shrink. At `maxSlopeRad` the instance scales to this
   * factor. Default 1 (no shrink). A tree on marginal ground is a small tree.
   */
  slopeScaleFloor?: number;
}

/** Why a candidate was rejected. `null` in `SurfaceFit` means it was kept. */
export type SurfaceRejectReason = 'too-low' | 'too-high' | 'too-steep' | 'wrong-aspect';

/** The adjusted instance, for a candidate the gate kept. */
export interface SurfaceFit {
  /** Ground elevation under the instance, feet. */
  elevationFt: number;
  /** Lean toward the surface normal, radians. Never above `maxTiltRad`. */
  tiltRad: number;
  /** Horizontal axis the tilt turns about, unit length in XZ. */
  tiltAxis: [number, number];
  /** Sink depth in feet — subtract from Y so the base meets the slope. */
  sinkFt: number;
  /** Extra uniform scale from the slope-driven shrink. 1 when no shrink. */
  scaleMultiplier: number;
}

/**
 * Run the gate on one sample. Returns `null` for a candidate that passes, or
 * the reason it failed. `roll` is a 0..1 draw from the pass's own seeded stream,
 * used ONLY by the aspect preference; pass 0 for a hard aspect gate.
 */
export function rejectReasonFor(
  sample: SurfaceSample,
  gate: SurfaceGate,
  roll = 0,
): SurfaceRejectReason | null {
  if (sample.elevationFt < (gate.minElevationFt ?? -Infinity)) return 'too-low';
  if (sample.elevationFt > (gate.maxElevationFt ?? Infinity)) return 'too-high';
  if (sample.slopeRad > gate.maxSlopeRad) return 'too-steep';
  if (gate.preferredAspectRad !== undefined) {
    const aspect = aspectRadOf(sample);
    // Flat ground faces nowhere, so an aspect preference cannot reject it.
    if (aspect !== null) {
      const tol = gate.aspectToleranceRad ?? Math.PI / 2;
      let diff = Math.abs(aspect - gate.preferredAspectRad) % (Math.PI * 2);
      if (diff > Math.PI) diff = Math.PI * 2 - diff;
      if (diff > tol && roll >= (gate.aspectOffChance ?? 0.25)) return 'wrong-aspect';
    }
  }
  return null;
}

/**
 * Fit a KEPT candidate to the surface: lean it toward the normal up to the
 * species tilt limit, sink it by the drop its base spans, and shrink it on
 * marginal ground. Call only after `rejectReasonFor` returned `null`.
 */
export function fitToSurface(sample: SurfaceSample, gate: SurfaceGate): SurfaceFit {
  const tiltRad = Math.min(sample.slopeRad, gate.maxTiltRad);
  const [nx, , nz] = sample.normal;
  // Turn about the horizontal axis perpendicular to the downhill direction, so
  // +tiltRad leans the instance downhill.
  const len = Math.hypot(nx, nz);
  const tiltAxis: [number, number] = len < 1e-6 ? [1, 0] : [-nz / len, nx / len];
  // A disc of radius r on ground of slope s spans r*tan(s) of drop. Sinking by
  // half of that puts the base plane through the ground plane at its center.
  const sinkFt = gate.baseRadiusFt <= 0 ? 0 : 0.5 * gate.baseRadiusFt * Math.tan(sample.slopeRad);
  const floor = gate.slopeScaleFloor ?? 1;
  const t = gate.maxSlopeRad > 0 ? Math.min(1, sample.slopeRad / gate.maxSlopeRad) : 0;
  return {
    elevationFt: sample.elevationFt,
    tiltRad,
    tiltAxis,
    sinkFt,
    scaleMultiplier: 1 + (floor - 1) * t,
  };
}

// ── Instrumentation (a gate that rejects nothing is not wired) ──────────────

/** Per-pass rejection counters. `kept + rejected === considered`. */
export interface SurfaceGateStats {
  considered: number;
  kept: number;
  rejected: number;
  byReason: Record<SurfaceRejectReason, number>;
  /** rejected / considered, 0 when nothing was considered. */
  rejectionRate: number;
}

/** A mutable tally a scatter pass feeds while it walks its candidates. */
export interface SurfaceGateTally {
  note(reason: SurfaceRejectReason | null): void;
  stats(): SurfaceGateStats;
}

export function makeSurfaceGateTally(): SurfaceGateTally {
  let considered = 0;
  let kept = 0;
  const byReason: Record<SurfaceRejectReason, number> = {
    'too-low': 0,
    'too-high': 0,
    'too-steep': 0,
    'wrong-aspect': 0,
  };
  return {
    note(reason) {
      considered += 1;
      if (reason === null) kept += 1;
      else byReason[reason] += 1;
    },
    stats() {
      const rejected = considered - kept;
      return {
        considered,
        kept,
        rejected,
        byReason: { ...byReason },
        rejectionRate: considered === 0 ? 0 : rejected / considered,
      };
    },
  };
}
