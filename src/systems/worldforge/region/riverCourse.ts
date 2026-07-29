/**
 * @file riverCourse.ts — turn a river's FMG cell-center anchors into a real
 * sub-cell course.
 *
 * At canonical scale, FMG cell centers are ~70,000 ft apart while a region
 * window is 25,000 ft, so the inherited "river" is one straight chord across
 * the whole drilldown. This module generates what runs BETWEEN the anchors: a
 * dense course that sags toward valley floors and reaches the settlements whose
 * cells the atlas says carry this river.
 *
 * Division of authority: the atlas decides WHICH river runs here and how big it
 * is; this module decides WHERE IT BENDS.
 *
 * Purity: the result depends only on the anchors, the height callback, and the
 * attractors. Callers must pass the FULL unclipped anchor line and clip the
 * result afterward, or two adjacent windows will disagree at their shared edge.
 * The first and last anchors are never moved for the same reason.
 */
import type { Feet } from '../units';

export interface RiverCourseOptions {
  /** Natural terrain height, 0..1, at a world point. */
  sampleHeight: (x: Feet, y: Feet) => number;
  /** River-bearing settlements this course should reach. */
  attractors: Array<{ x: Feet; y: Feet; radiusFt: Feet }>;
  /** Desired spacing between course points. */
  targetSegmentFt: Feet;
  /** Channel width — bounds how far one relaxation step may move a point. */
  widthFt: Feet;
}

/**
 * Attraction passes. One pass only closes about half the gap to a burg sitting
 * mid-radius, which leaves the river still outside the town. Repeating the pull
 * converges the nearest points onto the settlement while leaving the falloff
 * shape — and the exactly-zero contribution of an out-of-radius attractor —
 * untouched.
 */
const ATTRACT_ITERATIONS = 4;
/** Relaxation passes. More passes hug the valley harder; 12 settles visibly. */
const RELAX_ITERATIONS = 12;
/** Chaikin passes applied at the end to remove relaxation kinks. */
const SMOOTH_ITERATIONS = 2;

type P = [Feet, Feet];

/** Split every segment so no span exceeds `targetSegmentFt`. */
function resample(anchors: P[], targetSegmentFt: Feet): P[] {
  const out: P[] = [[anchors[0][0], anchors[0][1]]];
  for (let i = 0; i < anchors.length - 1; i++) {
    const [ax, ay] = anchors[i];
    const [bx, by] = anchors[i + 1];
    const span = Math.hypot(bx - ax, by - ay);
    const steps = Math.max(1, Math.ceil(span / targetSegmentFt));
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      out.push([ax + (bx - ax) * t, ay + (by - ay) * t]);
    }
  }
  return out;
}

/**
 * Pull interior points toward any attractor within its radius, with a smooth
 * falloff so the bend eases in rather than kinking. An attractor outside its
 * radius contributes exactly zero, so distant burgs never perturb a river.
 */
function attract(points: P[], attractors: RiverCourseOptions['attractors']): P[] {
  if (attractors.length === 0) return points;
  let current = points;
  for (let iter = 0; iter < ATTRACT_ITERATIONS; iter++) current = attractOnce(current, attractors);
  return current;
}

function attractOnce(points: P[], attractors: RiverCourseOptions['attractors']): P[] {
  return points.map((p, i) => {
    if (i === 0 || i === points.length - 1) return p;
    let [x, y] = p;
    for (const a of attractors) {
      const d = Math.hypot(a.x - x, a.y - y);
      if (d >= a.radiusFt || d < 1e-6) continue;
      // Smoothstep falloff: full pull at the attractor, zero at the radius.
      const t = 1 - d / a.radiusFt;
      const pull = t * t * (3 - 2 * t);
      x += (a.x - x) * pull;
      y += (a.y - y) * pull;
    }
    return [x, y] as P;
  });
}

/**
 * Nudge each interior point PERPENDICULAR to its local flow direction, toward
 * whichever side reads lower. Constraining the move to the perpendicular keeps
 * the course advancing downstream instead of pooling, and capping it at the
 * channel half-width keeps a single pass from teleporting the river.
 */
function relax(points: P[], opts: RiverCourseOptions): P[] {
  const probe = Math.max(opts.targetSegmentFt * 0.5, opts.widthFt * 0.5);
  const maxStep = opts.widthFt * 0.5;
  let current = points;

  for (let iter = 0; iter < RELAX_ITERATIONS; iter++) {
    const next: P[] = [current[0]];
    for (let i = 1; i < current.length - 1; i++) {
      const [x, y] = current[i];
      const [px, py] = current[i - 1];
      const [nx, ny] = current[i + 1];
      let tx = nx - px;
      let ty = ny - py;
      const len = Math.hypot(tx, ty) || 1;
      tx /= len;
      ty /= len;
      // Left/right normals of the flow direction.
      const ox = -ty;
      const oy = tx;
      const left = opts.sampleHeight(x + ox * probe, y + oy * probe);
      const right = opts.sampleHeight(x - ox * probe, y - oy * probe);
      // Move toward the lower side, scaled by how pronounced the difference is.
      const bias = Math.max(-1, Math.min(1, (right - left) * 4));
      const step = bias * maxStep;
      next.push([x + ox * step, y + oy * step]);
    }
    next.push(current[current.length - 1]);
    current = next;
  }
  return current;
}

/** Chaikin corner-cutting that PRESERVES the endpoints. */
function smooth(points: P[], iterations: number): P[] {
  let current = points;
  for (let iter = 0; iter < iterations; iter++) {
    if (current.length < 3) return current;
    const out: P[] = [current[0]];
    for (let i = 0; i < current.length - 1; i++) {
      const [ax, ay] = current[i];
      const [bx, by] = current[i + 1];
      out.push([ax * 0.75 + bx * 0.25, ay * 0.75 + by * 0.25]);
      out.push([ax * 0.25 + bx * 0.75, ay * 0.25 + by * 0.75]);
    }
    out.push(current[current.length - 1]);
    current = out;
  }
  return current;
}

/**
 * The river's real course between its cell-center anchors. Pure and
 * deterministic: same inputs always produce the same array.
 */
export function generateRiverCourse(
  anchors: Array<[Feet, Feet]>,
  opts: RiverCourseOptions,
): Array<[Feet, Feet]> {
  if (anchors.length < 2) return anchors.map(([x, y]) => [x, y] as P);
  const dense = resample(anchors.map(([x, y]) => [x, y] as P), opts.targetSegmentFt);
  const pulled = attract(dense, opts.attractors);
  const relaxed = relax(pulled, opts);
  return smooth(relaxed, SMOOTH_ITERATIONS);
}
