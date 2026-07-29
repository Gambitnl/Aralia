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
 * How far the bend toward a burg spreads ALONG the course, as a multiple of the
 * sideways distance it has to travel. A river that moves `d` sideways over `6d`
 * of its length turns about 9 degrees — a bend, not a hairpin. Lower values
 * make the river hook into town more sharply.
 */
const BEND_LENGTH_RATIO = 6;
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

/** Cumulative distance along the course, one entry per point. */
function arcLengths(points: P[]): number[] {
  const arc: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    arc.push(arc[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
  }
  return arc;
}

const smoothstep = (t: number): number => t * t * (3 - 2 * t);

/**
 * BEND the course toward each attractor, rather than pulling points onto it.
 *
 * The obvious implementation — move every point some fraction of the way to the
 * burg — is wrong, and wrong in a way that is invisible until you measure it.
 * Points near the attractor get the strongest pull, so they converge onto the
 * SAME spot: the course develops a cusp, adjacent points land exactly on top of
 * each other, and the channel polygon buffered from that centerline degenerates.
 * Measured on the first implementation: minimum segment length 0.00 ft against a
 * 125 ft median, and 129 of 213 centerline points ended up under their own
 * carved bed because the ring could no longer be filled.
 *
 * So instead: find the point on the course that already comes closest to the
 * burg, take the single offset vector that would put THAT point on the burg, and
 * apply it to the whole neighborhood with a falloff measured in ARC LENGTH along
 * the course. That is a smooth translation of one stretch of river, so spacing
 * is preserved, no cusp forms, and the result reads as a meander.
 *
 * An attractor outside its radius contributes exactly zero, so a distant burg
 * never perturbs a river at all.
 */
function attract(points: P[], attractors: RiverCourseOptions['attractors']): P[] {
  if (attractors.length === 0 || points.length < 3) return points;
  let current = points;

  for (const a of attractors) {
    // The stretch of river that already runs nearest this burg.
    let nearest = 0;
    let nearestD = Infinity;
    for (let i = 0; i < current.length; i++) {
      const d = Math.hypot(a.x - current[i][0], a.y - current[i][1]);
      if (d < nearestD) { nearestD = d; nearest = i; }
    }
    // Hard cutoff: out of range means untouched, bit for bit.
    if (nearestD >= a.radiusFt || nearestD < 1e-9) continue;

    const dx = a.x - current[nearest][0];
    const dy = a.y - current[nearest][1];

    const arc = arcLengths(current);
    const total = arc[arc.length - 1];
    const here = arc[nearest];

    // Spread the bend over enough length that it reads as a river, not a kink —
    // but never over more length than the course actually has on the short side.
    // The endpoint taper is what keeps the pinned ends pinned, so a reach wider
    // than the distance to the nearer end would tape the bend down to a fraction
    // of itself and leave the river short of the town it is meant to reach.
    const room = Math.min(here, total - here);
    const reach = Math.min(
      Math.max(a.radiusFt, nearestD * BEND_LENGTH_RATIO),
      Math.max(room, 1e-9),
    );

    current = current.map((p, i) => {
      if (i === 0 || i === current.length - 1) return p;
      const along = Math.abs(arc[i] - here);
      if (along >= reach) return p;
      // Falloff along the course from the nearest point...
      let w = smoothstep(1 - along / reach);
      // ...tapered again near the ends so the pinned endpoints stay pinned and
      // the course does not develop a step beside them.
      const toEnd = Math.min(arc[i], total - arc[i]);
      if (toEnd < reach) w *= smoothstep(toEnd / reach);
      return [p[0] + dx * w, p[1] + dy * w] as P;
    });
  }

  return current;
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
