/**
 * @file townLots.ts — DEEP LOTS: one town block cut into narrow lots that run
 * from the street back to the block's rear line (GG-545, "Watabou grain").
 *
 * WHY THIS EXISTS (town-look pass, 2026-10-31). The old packer
 * (`townEngine.packWardFrontage`) laid ONE shallow row of lots along each block
 * edge and left the middle bare except for a small court cluster. A census of
 * all 813 towns of world 903674813 measured a median building cover of 0.44 per
 * built block (walled towns). The Watabou benchmark reads as solid fabric: the
 * lots run deep and meet at the back. Remy chose that grain on the town-look
 * sheet (q6, "Watabou grain"), accepting lots narrower than the five-cell 3D
 * room minimum.
 *
 * THE RULE. Every point of a block belongs to the street it is nearest to. For
 * a block edge `i`, the signed distance to its LINE is an affine function
 * d_i(p). The block points where d_i is the smallest of all edges form edge
 * i's TERRITORY. "d_i ≤ d_j" is a half-plane, so each territory is the block
 * clipped by n−1 half-planes, and the territories tile the block exactly — the
 * rear line where two rows meet is the bisector between their streets. Each
 * territory is then cut into strips perpendicular to its street, one strip per
 * lot, with a depth cap so a very large block keeps a back court.
 *
 * WORKS ON CONCAVE BLOCKS. Sutherland–Hodgman against a single HALF-PLANE is
 * exact for any simple subject polygon, convex or not. 41% of the measured
 * blocks are not strictly convex, so every cut here is a half-plane cut of the
 * real block — a lot can never leave its block. On a concave block a few
 * points can sit behind every street line they are "nearest" to; the
 * `d_i ≥ 0` cut leaves those as yard, not as a building in the wrong place.
 *
 * CONTRACT KEPT. Each lot lists its street edge first (`polygon[0]→[1]`, in
 * the edge's own direction) and its last vertex on the same side cut, so the
 * ensemble pass and the 3D adapter read width and depth the way they read the
 * old rectangles. A lot that is not a clean rectangle is a `wedge`, which the
 * adapter already clamps inside its polygon. Neighboring lots on one street
 * share their side cut exactly, so party walls are detected as before.
 *
 * Pure: no React, no DOM, no import of `townEngine` at run time.
 */
import { fnv1a, rngFromPath, streamPath, type SeedPath } from '../seedPath';
import { pointInPolygon, type Pt } from '../submap/submapEngine';
import type { BuildingPlot } from './townEngine';

/** Keeps the points p where `nx * p.x + ny * p.y <= c`. */
export interface HalfPlane {
  nx: number;
  ny: number;
  c: number;
}

/**
 * Sutherland–Hodgman clip of `poly` against ONE half-plane. Exact for a convex
 * or concave simple subject (the clip region, a half-plane, is convex).
 */
export function clipHalfPlane(poly: readonly Pt[], h: HalfPlane): Pt[] {
  const out: Pt[] = [];
  const n = poly.length;
  if (n === 0) return out;
  const f = (p: Pt): number => h.nx * p[0] + h.ny * p[1] - h.c;
  for (let i = 0; i < n; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % n];
    const fp = f(p);
    const fq = f(q);
    const pIn = fp <= 0;
    const qIn = fq <= 0;
    if (pIn) out.push([p[0], p[1]]);
    if (pIn !== qIn) {
      const t = fp / (fp - fq);
      out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
  }
  return out;
}

/** Clip by several half-planes in order; stops early when nothing is left. */
export function clipHalfPlanes(poly: readonly Pt[], planes: readonly HalfPlane[]): Pt[] {
  let out: Pt[] = poly.map((p) => [p[0], p[1]] as Pt);
  for (const h of planes) {
    if (out.length < 3) return [];
    out = clipHalfPlane(out, h);
  }
  return out.length >= 3 ? out : [];
}

/** Signed shoelace area (positive counter-clockwise). */
export function signedArea(poly: readonly Pt[]): number {
  let a = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    a += poly[j][0] * poly[i][1] - poly[i][0] * poly[j][1];
  }
  return a / 2;
}

/** Drop consecutive duplicate vertices a clip can leave behind. */
function dedupe(poly: Pt[], eps: number): Pt[] {
  const out: Pt[] = [];
  for (const p of poly) {
    const last = out[out.length - 1];
    if (last && Math.abs(last[0] - p[0]) <= eps && Math.abs(last[1] - p[1]) <= eps) continue;
    out.push(p);
  }
  while (out.length > 1) {
    const a = out[0];
    const b = out[out.length - 1];
    if (Math.abs(a[0] - b[0]) <= eps && Math.abs(a[1] - b[1]) <= eps) out.pop();
    else break;
  }
  return out;
}

export interface DeepLotOptions {
  /** Target street frontage of one lot, in plan units, before the roll. */
  lotWidth: number;
  /** Narrowest lot. A remainder smaller than this joins the lot before it. */
  minLotWidth: number;
  /** Widest lot. A remainder that would exceed it is split in two. */
  maxLotWidth: number;
  /** Deepest a lot runs from its street. A deeper block keeps a back court. */
  maxDepth: number;
  /** Cell grid the frontage snaps to (plan units); 0 = no snap. */
  snap: number;
  /** Chance that a passage (an alley to the back court) follows a lot. */
  alleyChance: number;
  /** Width of that passage, in plan units. */
  alleyWidth: number;
  /**
   * Whether a street edge can carry lots at all. The engine's slope rule
   * (`heightAt` + `maxGrade`) refuses an edge too steep to build along, as
   * the old frontage packer did. Absent = every edge builds.
   */
  edgeAllowed?: (a: Pt, b: Pt) => boolean;
  /**
   * Deepest a row may run from street edge `i`, when something stands in the
   * block's middle (a temple, keep or citadel). Absent = `maxDepth`.
   */
  edgeDepth?: (i: number) => number;
  /**
   * Narrowest a house may be across its narrow side, in plan units (GG-563).
   * Absent = 80% of `minLotWidth`. The engine passes 12 ft.
   */
  minHouseWidth?: number;
  /** Sharpest corner a house may have, in degrees (GG-563). Absent = 30. */
  minCornerDeg?: number;
}

/** Sharpest house corner allowed by default, in degrees (GG-563). */
export const MIN_HOUSE_CORNER_DEG = 30;

/**
 * Width of a polygon across its narrowest side: the smallest extent over the
 * directions of its own edges (rotating calipers, exact for a convex ring and
 * close for the near-convex lots here).
 */
export function minWidth(poly: readonly Pt[]): number {
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < 1e-12) continue;
    const nx = -(b[1] - a[1]) / L, ny = (b[0] - a[0]) / L;
    let lo = Infinity, hi = -Infinity;
    for (const p of poly) {
      const v = nx * p[0] + ny * p[1];
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    best = Math.min(best, hi - lo);
  }
  return isFinite(best) ? best : 0;
}

/** Interior angle at each corner, in degrees (for a simple ring of either winding). */
export function cornerAngles(poly: readonly Pt[]): number[] {
  const n = poly.length;
  const orient = signedArea(poly) >= 0 ? 1 : -1;
  return poly.map((b, k) => {
    const a = poly[(k + n - 1) % n], c = poly[(k + 1) % n];
    const ux = a[0] - b[0], uy = a[1] - b[1], vx = c[0] - b[0], vy = c[1] - b[1];
    const lu = Math.hypot(ux, uy), lv = Math.hypot(vx, vy);
    if (lu < 1e-12 || lv < 1e-12) return 180;
    const ang = (Math.acos(Math.max(-1, Math.min(1, (ux * vx + uy * vy) / (lu * lv)))) * 180) / Math.PI;
    // A reflex corner (concave ring) reads as 360 - angle.
    const turn = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    return turn * orient < 0 ? 360 - ang : ang;
  });
}

/**
 * A house a builder would make (GG-563, Remy 2026-11-01: "pie shapes and
 * really squished houses"): at least four corners, no corner sharper than
 * `minDeg`, and at least `minW` across its narrow side.
 */
export function houseShapeOk(poly: readonly Pt[], minW: number, minDeg: number): boolean {
  if (poly.length < 4) return false;
  if (minWidth(poly) < minW) return false;
  return cornerAngles(poly).every((a) => a >= minDeg);
}

/**
 * Merge the near-straight corners of a block into longer street edges
 * (GG-563, Remy's block-shape ruling). A suburb block clamped to the wall's
 * curve carries a corner every few feet; the lot cutter treated each short
 * piece as its own street and cut lots too small for a square house, and
 * blocks of nine or more corners lost 57% of their houses. A CONVEX corner
 * that lies within `tol` of the line through its neighbors is removed, the
 * smallest first. Removing a convex corner cuts a sliver off the block, so
 * the result stays inside the block. Concave corners always stay.
 */
export function simplifyConvexCorners(poly: readonly Pt[], tol: number): Pt[] {
  const out = poly.map((p) => [p[0], p[1]] as Pt);
  if (!(tol > 0)) return out;
  const orient = signedArea(out) >= 0 ? 1 : -1;
  for (;;) {
    if (out.length <= 4) return out;
    let best = -1, bestDev = tol;
    for (let k = 0; k < out.length; k++) {
      const a = out[(k + out.length - 1) % out.length], b = out[k], c = out[(k + 1) % out.length];
      const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
      if (cross * orient < 0) continue; // concave: keep
      const L = Math.hypot(c[0] - a[0], c[1] - a[1]);
      if (L < 1e-12) continue;
      const dev = Math.abs((c[0] - a[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (c[1] - a[1])) / L;
      if (dev < bestDev) { bestDev = dev; best = k; }
    }
    if (best < 0) return out;
    out.splice(best, 1);
  }
}

/** How far a corner may be from square and still read as built (GG-563). */
export const SQUARE_CORNER_TOLERANCE_DEG = 15;

/**
 * THE SQUARISH GUARD (GG-563, Remy 2026-11-01: "stick with MOSTLY squares or
 * squarish (rectangles or L shapes ... not all buildings should have a weird
 * triangular shape)"). A house passes when every corner is within
 * `SQUARE_CORNER_TOLERANCE_DEG` of a right angle: 90 degrees, or 270 for the
 * notch of an L. Wedges and triangles fail.
 */
export function isSquarish(poly: readonly Pt[], tolDeg = SQUARE_CORNER_TOLERANCE_DEG): boolean {
  if (poly.length < 4) return false;
  return cornerAngles(poly).every((a) => Math.abs(a - 90) <= tolDeg || Math.abs(a - 270) <= tolDeg);
}

/**
 * The biggest rectangle a builder would put on a lot (GG-563). The lot's
 * first edge is its street front (the lot contract); the rectangle stands on
 * that front, square to it, and reaches back as far as the lot allows. A
 * narrow end of the front may be left out when that buys more depth. Returns
 * the rectangle with its street edge first, or null when no rectangle at
 * least `minW` wide and deep fits. What the rectangle leaves is yard.
 */
export function rectangleOnFront(poly: readonly Pt[], minW: number): Pt[] | null {
  if (poly.length < 3) return null;
  const p0 = poly[0], p1 = poly[1];
  const L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
  if (L < minW) return null;
  const u: Pt = [(p1[0] - p0[0]) / L, (p1[1] - p0[1]) / L];
  let n: Pt = [-u[1], u[0]];
  let cx = 0, cy = 0;
  for (const q of poly) { cx += q[0]; cy += q[1]; }
  cx /= poly.length; cy /= poly.length;
  if ((cx - p0[0]) * n[0] + (cy - p0[1]) * n[1] < 0) n = [u[1], -u[0]];
  const at = (x: number, y: number): Pt => [p0[0] + u[0] * x + n[0] * y, p0[1] + u[1] * x + n[1] * y];
  let maxDepth = 0;
  for (const q of poly) maxDepth = Math.max(maxDepth, (q[0] - p0[0]) * n[0] + (q[1] - p0[1]) * n[1]);
  const eps = L * 1e-4;
  // Inside: sample points along the four sides, just within them, and no lot
  // corner strictly inside (a concave lot can bite into a rectangle).
  const fits = (a: number, b: number, d: number): boolean => {
    const samples: Pt[] = [];
    for (let k = 0; k <= 8; k++) {
      const x = a + eps + ((b - a - 2 * eps) * k) / 8;
      const y = eps + ((d - 2 * eps) * k) / 8;
      samples.push(at(x, eps), at(x, d - eps), at(a + eps, y), at(b - eps, y));
    }
    if (!samples.every((s) => pointInPolygon(s, poly as Pt[]))) return false;
    for (const q of poly) {
      const x = (q[0] - p0[0]) * u[0] + (q[1] - p0[1]) * u[1];
      const y = (q[0] - p0[0]) * n[0] + (q[1] - p0[1]) * n[1];
      if (x > a + eps && x < b - eps && y > eps && y < d - eps) return false;
    }
    return true;
  };
  // A hair over the minimum, so float error cannot leave an 11.99 ft house.
  const floor = minW * 1.0001;
  if (maxDepth < floor) return null;
  // How deep the lot is at each of 11 points along its front: the highest
  // crossing of a line square to the front. For a convex lot the deepest
  // rectangle over [a, b] is limited at its two ends, so its depth is the
  // smaller of the two; a concave lot is caught by the exact `fits` test.
  // (A 36-candidate bisection here made a capital take 3.9 s instead of 0.6.)
  const local = poly.map((q) => [
    (q[0] - p0[0]) * u[0] + (q[1] - p0[1]) * u[1],
    (q[0] - p0[0]) * n[0] + (q[1] - p0[1]) * n[1],
  ] as Pt);
  const topAt = (x: number): number => {
    let top = -Infinity;
    for (let k = 0; k < local.length; k++) {
      const s = local[k], e = local[(k + 1) % local.length];
      if ((s[0] - x) * (e[0] - x) > 0 || Math.abs(e[0] - s[0]) < 1e-12) continue;
      top = Math.max(top, s[1] + ((x - s[0]) / (e[0] - s[0])) * (e[1] - s[1]));
    }
    return top;
  };
  const tops: number[] = [];
  for (let k = 0; k <= 10; k++) tops.push(topAt(Math.min(L - eps, Math.max(eps, (L * k) / 10))));
  const options: Array<{ a: number; b: number; d: number }> = [];
  for (let i = 0; i <= 5; i++) {
    for (let j = 0; j <= 5; j++) {
      const a = (L * i) / 10, b = L - (L * j) / 10;
      const d = Math.min(tops[i], tops[10 - j], maxDepth);
      if (b - a >= floor && d >= floor) options.push({ a, b, d });
    }
  }
  options.sort((x, y) => (y.b - y.a) * y.d - (x.b - x.a) * x.d);
  for (const o of options) {
    if (fits(o.a, o.b, o.d)) return [at(o.a, 0), at(o.b, 0), at(o.b, o.d), at(o.a, o.d)];
    // A concave lot: the deepest rectangle that does fit over [a, b].
    if (!fits(o.a, o.b, floor)) continue;
    let lo = floor, hi = o.d;
    for (let k = 0; k < 16; k++) { const mid = (lo + hi) / 2; if (fits(o.a, o.b, mid)) lo = mid; else hi = mid; }
    return [at(o.a, 0), at(o.b, 0), at(o.b, lo), at(o.a, lo)];
  }
  return null;
}

/**
 * Cut off every corner sharper than `minDeg` (GG-563). The tip of a pie slice
 * becomes open ground, and the cut leaves two corners of 90° plus half the old
 * angle. A triangle also loses the tip of its sharpest corner, so every house
 * has at least four corners (the 3D adapters read four). `r` is how far along
 * each edge the cut starts, capped at 40% of the shorter edge.
 */
export function chamferSharpCorners(poly: readonly Pt[], minDeg: number, r: number): Pt[] {
  const ang = cornerAngles(poly);
  let sharp = ang.map((a) => a < minDeg);
  if (poly.length === 3 && !sharp.some(Boolean)) {
    const k = ang.indexOf(Math.min(...ang));
    sharp = ang.map((_, i) => i === k);
  }
  const n = poly.length;
  const out: Pt[] = [];
  for (let k = 0; k < n; k++) {
    const b = poly[k];
    if (!sharp[k]) { out.push([b[0], b[1]]); continue; }
    const a = poly[(k + n - 1) % n], c = poly[(k + 1) % n];
    const la = Math.hypot(a[0] - b[0], a[1] - b[1]), lc = Math.hypot(c[0] - b[0], c[1] - b[1]);
    const rr = Math.min(r, la * 0.4, lc * 0.4);
    if (!(rr > 0)) { out.push([b[0], b[1]]); continue; }
    out.push([b[0] + ((a[0] - b[0]) / la) * rr, b[1] + ((a[1] - b[1]) / la) * rr]);
    out.push([b[0] + ((c[0] - b[0]) / lc) * rr, b[1] + ((c[1] - b[1]) / lc) * rr]);
  }
  return out;
}

/**
 * Cut a block into deep lots (see the file header). Deterministic per
 * `seedPath`. Lots tile each street territory edge to edge, so the caller must
 * NOT run its generic overlap test between them — shared boundaries are party
 * walls, not collisions.
 */
export function packBlockDeep(
  block: readonly Pt[],
  seedPath: SeedPath,
  o: DeepLotOptions,
): BuildingPlot[] {
  const n = block.length;
  if (n < 3) return [];
  const area0 = signedArea(block);
  if (Math.abs(area0) < 1e-12) return [];
  // Inward normal: left of a→b on a counter-clockwise ring, right on a clockwise one.
  const orient = area0 > 0 ? 1 : -1;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of block) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const span = Math.max(maxX - minX, maxY - minY) || 1;
  const eps = span * 1e-7;
  const onLineEps = span * 1e-5;

  const edges = block.map((a, i) => {
    const b = block[(i + 1) % n];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const ux = L > 0 ? (b[0] - a[0]) / L : 0;
    const uy = L > 0 ? (b[1] - a[1]) / L : 0;
    const nx = -uy * orient;
    const ny = ux * orient;
    return { a, L, ux, uy, nx, ny, off: nx * a[0] + ny * a[1] };
  });
  // A STREET is an edge whose inward side is inside the block. The ward
  // clip can leave a tiny backward sliver (two vertices out of order); its
  // "inward" normal points out of the block, so its distance is negative at
  // every interior point and the nearest-street rule handed it the whole
  // block — Hafting had six bare blocks from this. Such an edge neither owns
  // lots nor competes for ground; dropping it from both roles keeps the
  // territories a partition.
  const street = edges.map((e) => {
    if (e.L <= eps) return false;
    const step = Math.min(e.L * 0.25, span * 1e-3);
    const m: Pt = [e.a[0] + e.ux * e.L * 0.5 + e.nx * step, e.a[1] + e.uy * e.L * 0.5 + e.ny * step];
    return pointInPolygon(m, block as Pt[]);
  });
  const d = (i: number, p: Pt): number => edges[i].nx * p[0] + edges[i].ny * p[1] - edges[i].off;
  const s = (i: number, p: Pt): number =>
    edges[i].ux * (p[0] - edges[i].a[0]) + edges[i].uy * (p[1] - edges[i].a[1]);

  const rng = rngFromPath(streamPath(seedPath, 'deep-lots'));
  const snapW = (w: number): number =>
    o.snap > 0 ? Math.max(o.minLotWidth, Math.round(w / o.snap) * o.snap) : Math.max(o.minLotWidth, w);
  const plots: BuildingPlot[] = [];

  for (let i = 0; i < n; i++) {
    const e = edges[i];
    if (!street[i]) continue;
    if (o.edgeAllowed && !o.edgeAllowed(block[i], block[(i + 1) % n])) continue;
    // One shared rear line per row, varied between rows by a stable hash, so a
    // street of attached houses keeps one envelope (the party-wall contract).
    const rowRoll = fnv1a(`${seedPath}|deep:${i}|row-depth`) / 0xffffffff;
    const rowDepth = Math.min(o.maxDepth, o.edgeDepth ? o.edgeDepth(i) : Infinity) * (0.82 + rowRoll * 0.18);
    if (!(rowDepth > 0)) continue;
    const planes: HalfPlane[] = [];
    for (let j = 0; j < n; j++) {
      if (j === i || !street[j]) continue;
      const qx = e.nx - edges[j].nx;
      const qy = e.ny - edges[j].ny;
      if (Math.hypot(qx, qy) < 1e-9) continue; // same street direction: no bisector
      planes.push({ nx: qx, ny: qy, c: e.off - edges[j].off });
    }
    // In front of the street, and no deeper than the row's rear line.
    planes.push({ nx: -e.nx, ny: -e.ny, c: -e.off });
    planes.push({ nx: e.nx, ny: e.ny, c: e.off + rowDepth });
    const territory = clipHalfPlanes(block, planes);
    if (territory.length < 3) continue;

    let sMin = Infinity, sMax = -Infinity;
    for (const p of territory) {
      const sv = s(i, p);
      if (sv < sMin) sMin = sv;
      if (sv > sMax) sMax = sv;
    }
    sMin = Math.max(0, sMin);
    sMax = Math.min(e.L, sMax);
    if (sMax - sMin < o.minLotWidth * 0.6) continue;

    // The row's lot ranges along the street first, then the houses. The
    // random draws stay in the same order as before GG-563.
    const ranges: Array<{ t0: number; t1: number }> = [];
    let t = sMin;
    while (sMax - t > eps) {
      let w = snapW(o.lotWidth * (0.75 + rng.next() * 0.75));
      const rest = sMax - t - w;
      if (rest < o.minLotWidth) {
        // Absorb the remainder rather than leave a sliver; split a long one.
        const all = sMax - t;
        w = all > o.maxLotWidth * 1.5 ? all / 2 : all;
      }
      ranges.push({ t0: t, t1: t + w });
      t += w;
      // A passage to the back court now and then, never at a row's end.
      if (sMax - t > o.minLotWidth * 2 && rng.next() < o.alleyChance) t += o.alleyWidth;
    }
    const lotFor = (t0: number, t1: number): BuildingPlot | null => {
      const lot = clipHalfPlanes(territory, [
        { nx: -e.ux, ny: -e.uy, c: -(e.ux * e.a[0] + e.uy * e.a[1] + t0) },
        { nx: e.ux, ny: e.uy, c: e.ux * e.a[0] + e.uy * e.a[1] + t1 },
      ]);
      const plot = lot.length >= 3 ? frontFirst(dedupe(lot, eps), i, (p) => d(i, p), (p) => s(i, p), onLineEps) : null;
      return plot && Math.abs(signedArea(plot.polygon)) >= o.minLotWidth * o.minLotWidth * 0.35 ? plot : null;
    };
    // NO SLIVERS, NO PIES (GG-563, Remy 2026-11-01). A lot is a house only
    // when a builder would make it: at least `minHouseWidth` across and no
    // corner under `minCornerDeg`. A lot that fails first joins its neighbor
    // in the row (the lot before it, else the one after it), as long as the
    // two still make one house of sensible frontage. Failing that, a sharp
    // corner is cut off and left as open ground. What is still too thin
    // after that is yard, not a house. At Hafting the deep lots made 56
    // houses under 12 ft and 8 pies; revision 1 had none.
    const minW = o.minHouseWidth ?? o.minLotWidth * 0.8;
    const minDeg = o.minCornerDeg ?? MIN_HOUSE_CORNER_DEG;
    // A wedge must also hold a square house on its front (Remy's squarish
    // ruling); one that cannot joins its neighbor, as a sliver does, and
    // the engine squares the joined lot later.
    const ok = (p: BuildingPlot | null): p is BuildingPlot => !!p && houseShapeOk(p.polygon, minW, minDeg)
      && (isSquarish(p.polygon) || rectangleOnFront(p.polygon, minW) !== null);
    const repaired = (p: BuildingPlot | null): BuildingPlot | null => {
      if (!p) return null;
      const cut = chamferSharpCorners(p.polygon, minDeg, minW);
      const again = frontFirst(dedupe(cut, eps), i, (q) => d(i, q), (q) => s(i, q), onLineEps);
      return again ? { ...again, shape: 'wedge' } : null;
    };
    const mergeCap = o.maxLotWidth * 2;
    const row: Array<{ t0: number; t1: number; plot: BuildingPlot }> = [];
    let pending: { t0: number; t1: number } | null = null;
    for (const r of ranges) {
      // A failed lot waits for the next one; the two are tried together.
      const t0: number = pending &&Math.abs(pending.t1 - r.t0) <= eps && r.t1 - pending.t0 <= mergeCap ? pending.t0 : r.t0;
      pending = null;
      const plot = lotFor(t0, r.t1);
      if (ok(plot)) { row.push({ t0, t1: r.t1, plot }); continue; }
      const prev = row[row.length - 1];
      if (prev && Math.abs(prev.t1 - t0) <= eps && r.t1 - prev.t0 <= mergeCap) {
        const merged = lotFor(prev.t0, r.t1);
        if (ok(merged)) { row[row.length - 1] = { t0: prev.t0, t1: r.t1, plot: merged }; continue; }
      }
      const fixed = repaired(plot);
      if (ok(fixed)) { row.push({ t0, t1: r.t1, plot: fixed }); continue; }
      pending = { t0, t1: r.t1 };
    }
    for (const r of row) plots.push(r.plot);
  }
  return plots;
}

/**
 * Cut a block both ways and keep the cut with more houses (GG-563 block
 * shapes). Rectangle rows win on a near-rectangular block; the
 * nearest-street cut (whose wedges the engine squares later) can win on a
 * many-sided one. A tie goes to the rows, whose lots are already square.
 */
export function packBlockSquare(block: readonly Pt[], seedPath: SeedPath, o: DeepLotOptions): BuildingPlot[] {
  const rows = packBlockRows(block, seedPath, o);
  const deep = packBlockDeep(block, seedPath, o);
  return rows.length >= deep.length ? rows : deep;
}

/**
 * RECTANGLE ROWS (GG-563, Remy's block-shape ruling 2026-11-01: "change block
 * shapes", keep the 15-degree square rule). The nearest-street cutter above
 * gives every street the block points nearest it, so two rows meet on the
 * bisector of each block corner. A Voronoi block has five to seven corners of
 * about 120 degrees, so every row ended in wedge lots, and the squarish guard
 * turned them into yard: Borieborum kept 986 of 1,563 houses.
 *
 * Here every street cuts a row of true rectangles, square to the street. The
 * longest street goes first and takes its corners; the next row starts where
 * the earlier lots end, as an old town gives a corner house to one street.
 * A lot reaches back to its row's rear line, or less where the block or a lot
 * already placed stops it; a lot that cannot be `minHouseWidth` deep is yard.
 * Every lot is a `rect`, its street edge first, and the lots of one row share
 * their side cuts (party walls). Same options and contract as `packBlockDeep`.
 */
export function packBlockRows(
  block: readonly Pt[],
  seedPath: SeedPath,
  o: DeepLotOptions,
): BuildingPlot[] {
  const n = block.length;
  if (n < 3) return [];
  const area0 = signedArea(block);
  if (Math.abs(area0) < 1e-12) return [];
  const orient = area0 > 0 ? 1 : -1;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of block) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const span = Math.max(maxX - minX, maxY - minY) || 1;
  const eps = span * 1e-6;
  const minW = o.minHouseWidth ?? o.minLotWidth * 0.8;
  const rng = rngFromPath(streamPath(seedPath, 'deep-lots'));
  const snapW = (w: number): number =>
    o.snap > 0 ? Math.max(o.minLotWidth, Math.round(w / o.snap) * o.snap) : Math.max(o.minLotWidth, w);

  const edges = block.map((a, i) => {
    const b = block[(i + 1) % n];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const ux = L > 0 ? (b[0] - a[0]) / L : 0;
    const uy = L > 0 ? (b[1] - a[1]) / L : 0;
    return { i, a, L, ux, uy, nx: -uy * orient, ny: ux * orient };
  });
  // A street edge's inward side must be inside the block (see packBlockDeep).
  const street = edges.map((e) => {
    if (e.L <= eps) return false;
    const step = Math.min(e.L * 0.25, span * 1e-3);
    const m: Pt = [e.a[0] + e.ux * e.L * 0.5 + e.nx * step, e.a[1] + e.uy * e.L * 0.5 + e.ny * step];
    return pointInPolygon(m, block as Pt[]);
  });

  const placed: Pt[][] = [];
  const plots: BuildingPlot[] = [];
  // Longest street first; ties keep the ring order.
  const order = edges.filter((e) => street[e.i]).sort((p, q) => q.L - p.L || p.i - q.i);
  for (const e of order) {
    if (o.edgeAllowed && !o.edgeAllowed(block[e.i], block[(e.i + 1) % n])) continue;
    const rowRoll = fnv1a(`${seedPath}|deep:${e.i}|row-depth`) / 0xffffffff;
    const rowDepth = Math.min(o.maxDepth, o.edgeDepth ? o.edgeDepth(e.i) : Infinity) * (0.82 + rowRoll * 0.18);
    if (!(rowDepth >= minW)) continue;
    // Local frame: x along the street from its start, y inward from it.
    const at = (x: number, y: number): Pt => [e.a[0] + e.ux * x + e.nx * y, e.a[1] + e.uy * x + e.ny * y];
    const toLocal = (p: Pt): Pt => [(p[0] - e.a[0]) * e.ux + (p[1] - e.a[1]) * e.uy, (p[0] - e.a[0]) * e.nx + (p[1] - e.a[1]) * e.ny];
    const localBlock = block.map(toLocal);
    // Depth the block allows over [x0, x1]: the lowest crossing above the
    // street of any block edge inside the strip, or of the strip's sides.
    const blockDepth = (x0: number, x1: number): number => {
      let d = rowDepth;
      for (let k = 0; k < n; k++) {
        const p = localBlock[k], q = localBlock[(k + 1) % n];
        if (k === e.i) continue;
        // The part of edge k inside the strip x0 <= x <= x1.
        // Open strip: a corner that only touches a side of the strip (where
        // the next street starts) does not stop the lot.
        const lo = Math.max(x0 + eps, Math.min(p[0], q[0])), hi = Math.min(x1 - eps, Math.max(p[0], q[0]));
        if (hi < lo) continue;
        const yAt = (x: number): number => (Math.abs(q[0] - p[0]) < 1e-12 ? Math.min(p[1], q[1]) : p[1] + ((x - p[0]) / (q[0] - p[0])) * (q[1] - p[1]));
        const y = Math.min(yAt(lo), yAt(hi));
        if (y <= eps) return 0; // the block closes in at the street itself
        d = Math.min(d, y);
      }
      return d;
    };
    // Depth the lots already placed allow over [x0, x1].
    const lotDepth = (x0: number, x1: number): number => {
      let d = Infinity;
      for (const lot of placed) {
        const loc = lot.map(toLocal);
        let lx = Infinity, hx = -Infinity;
        for (const p of loc) { lx = Math.min(lx, p[0]); hx = Math.max(hx, p[0]); }
        if (hx <= x0 + eps || lx >= x1 - eps) continue;
        const inStrip = clipHalfPlanes(loc, [{ nx: -1, ny: 0, c: -(x0 + eps) }, { nx: 1, ny: 0, c: x1 - eps }]);
        if (inStrip.length < 3) continue;
        let ly = Infinity, hy = -Infinity;
        for (const p of inStrip) { ly = Math.min(ly, p[1]); hy = Math.max(hy, p[1]); }
        if (hy <= eps) continue; // behind the street: another block side
        d = Math.min(d, Math.max(0, ly));
      }
      return d;
    };
    let t = 0;
    while (e.L - t > eps) {
      let w = snapW(o.lotWidth * (0.75 + rng.next() * 0.75));
      const rest = e.L - t - w;
      if (rest < o.minLotWidth) {
        const all = e.L - t;
        w = all > o.maxLotWidth * 1.5 ? all / 2 : all;
      }
      const x0 = t, x1 = t + w;
      t += w;
      if (w >= minW) {
        const d = Math.min(blockDepth(x0, x1), lotDepth(x0, x1));
        if (d >= minW) {
          const polygon = [at(x0, 0), at(x1, 0), at(x1, d), at(x0, d)];
          placed.push(polygon);
          plots.push({ polygon, frontageEdge: e.i, kind: 'frontage', shape: 'rect' });
        }
      }
      if (e.L - t > o.minLotWidth * 2 && rng.next() < o.alleyChance) t += o.alleyWidth;
    }
  }
  return plots;
}

/**
 * Rotate a lot so its street edge comes first and runs in the street's own
 * direction. Returns null for a piece with no street frontage (a landlocked
 * piece is back yard, not a building).
 */
function frontFirst(
  poly: Pt[],
  edge: number,
  dist: (p: Pt) => number,
  along: (p: Pt) => number,
  eps: number,
): BuildingPlot | null {
  const m = poly.length;
  if (m < 3) return null;
  let best = -1;
  let bestLen = 0;
  for (let k = 0; k < m; k++) {
    const p = poly[k];
    const q = poly[(k + 1) % m];
    if (Math.abs(dist(p)) > eps || Math.abs(dist(q)) > eps) continue;
    const len = Math.abs(along(q) - along(p));
    if (len > bestLen) { bestLen = len; best = k; }
  }
  if (best < 0) return null;
  let ring = [...poly.slice(best), ...poly.slice(0, best)];
  if (along(ring[1]) < along(ring[0])) {
    // Walk the ring the other way, keeping the street edge first.
    ring = [ring[1], ring[0], ...ring.slice(2).reverse()];
  }
  return { polygon: ring, frontageEdge: edge, kind: 'frontage', shape: isRect(ring) ? 'rect' : 'wedge' };
}

/** Four corners, all right angles: the adapter's plain rectangle. */
function isRect(poly: readonly Pt[]): boolean {
  if (poly.length !== 4) return false;
  for (let k = 0; k < 4; k++) {
    const a = poly[(k + 3) % 4];
    const b = poly[k];
    const c = poly[(k + 1) % 4];
    const ux = a[0] - b[0], uy = a[1] - b[1];
    const vx = c[0] - b[0], vy = c[1] - b[1];
    const lu = Math.hypot(ux, uy), lv = Math.hypot(vx, vy);
    if (lu < 1e-12 || lv < 1e-12) return false;
    if (Math.abs((ux * vx + uy * vy) / (lu * lv)) > 1e-3) return false;
  }
  return true;
}
