/**
 * @file townRiverCut.ts — cut a town's river channel out of its wards (GG-561).
 *
 * WHY THIS EXISTS (Remy 2026-11-01, Borieborum: "why are these docks in the
 * middle of the river?"). The town plan cut its wards over the river as if
 * the river were not there. Only the houses were carved off the water, so
 * the river showed in the gaps between blocks: at Borieborum 120 of 1,995
 * buildings had their center in the channel, 32 of 199 wards reached into
 * it, and every dock sat on a ward edge near the river's CENTER LINE.
 *
 * Now the channel (the center line, plus half the river's width, plus a bank
 * margin) is cut out of the town land before the wards are used. Each ward
 * the channel crosses is split along the two bank lines, and the pieces in
 * the water are dropped, so the banks become ward edges: the riverside
 * streets, the quays, and the edges the docks stand on.
 *
 * A ward edge that crossed the river is a street that now stops at the bank
 * on each side. Its two bank ends are the honest place for a bridge, so the
 * cut also returns them as LINKS; the engine chooses which ones to build.
 *
 * Pure geometry: no React, no three.js, no import of `townEngine`.
 */
import type { Pt } from '../submap/submapEngine';

const dist = (a: Pt, b: Pt): number => Math.hypot(b[0] - a[0], b[1] - a[1]);

function segDist(p: Pt, a: Pt, b: Pt): number {
  const vx = b[0] - a[0], vy = b[1] - a[1];
  const L2 = vx * vx + vy * vy;
  const t = L2 > 1e-12 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / L2)) : 0;
  return Math.hypot(p[0] - a[0] - t * vx, p[1] - a[1] - t * vy);
}

/** Shortest distance from a point to any of the lines. */
export function distToLines(p: Pt, lines: readonly Pt[][]): number {
  let best = Infinity;
  for (const L of lines) for (let i = 0; i < L.length - 1; i++) best = Math.min(best, segDist(p, L[i], L[i + 1]));
  return best;
}

function signedArea(poly: readonly Pt[]): number {
  let a = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) a += poly[j][0] * poly[i][1] - poly[i][0] * poly[j][1];
  return a / 2;
}

function centroid(poly: readonly Pt[]): Pt {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    const c = x1 * y2 - x2 * y1;
    a += c; cx += (x1 + x2) * c; cy += (y1 + y2) * c;
  }
  if (Math.abs(a) < 1e-12) {
    const n = poly.length || 1;
    return [poly.reduce((s, p) => s + p[0], 0) / n, poly.reduce((s, p) => s + p[1], 0) / n];
  }
  return [cx / (3 * a), cy / (3 * a)];
}

/** Point where segments p1p2 and p3p4 cross, with both parameters, or null. */
function cross(p1: Pt, p2: Pt, p3: Pt, p4: Pt): { p: Pt; t: number; u: number } | null {
  const d1x = p2[0] - p1[0], d1y = p2[1] - p1[1];
  const d2x = p4[0] - p3[0], d2y = p4[1] - p3[1];
  const den = d1x * d2y - d1y * d2x;
  if (Math.abs(den) < 1e-12) return null;
  const t = ((p3[0] - p1[0]) * d2y - (p3[1] - p1[1]) * d2x) / den;
  const u = ((p3[0] - p1[0]) * d1y - (p3[1] - p1[1]) * d1x) / den;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { p: [p1[0] + t * d1x, p1[1] + t * d1y], t, u };
}

/**
 * A polyline offset `d` to its left (negative `d`: to its right), each end
 * run on straight by `ext` so the offset line reaches past the town. Corners
 * are mitred, with the miter capped at twice `d`.
 */
export function offsetPolyline(line: readonly Pt[], d: number, ext: number): Pt[] {
  const n = line.length;
  if (n < 2) return [];
  const normals: Pt[] = [];
  for (let i = 0; i < n - 1; i++) {
    const L = dist(line[i], line[i + 1]) || 1;
    normals.push([-(line[i + 1][1] - line[i][1]) / L, (line[i + 1][0] - line[i][0]) / L]);
  }
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = normals[Math.max(0, i - 1)], b = normals[Math.min(n - 2, i)];
    let mx = a[0] + b[0], my = a[1] + b[1];
    const ml = Math.hypot(mx, my) || 1;
    mx /= ml; my /= ml;
    const cos = mx * b[0] + my * b[1];
    const k = Math.min(2, 1 / Math.max(cos, 0.5));
    out.push([line[i][0] + mx * d * k, line[i][1] + my * d * k]);
  }
  const t0: Pt = [line[1][0] - line[0][0], line[1][1] - line[0][1]];
  const t1: Pt = [line[n - 1][0] - line[n - 2][0], line[n - 1][1] - line[n - 2][1]];
  const l0 = Math.hypot(t0[0], t0[1]) || 1, l1 = Math.hypot(t1[0], t1[1]) || 1;
  out.unshift([out[0][0] - (t0[0] / l0) * ext, out[0][1] - (t0[1] / l0) * ext]);
  out.push([out[out.length - 1][0] + (t1[0] / l1) * ext, out[out.length - 1][1] + (t1[1] / l1) * ext]);
  return out;
}

/**
 * Split a simple polygon along a polyline. Every run of the line inside the
 * polygon (from one crossing of its boundary to the next) is a chord, and
 * each chord splits a piece in two. A line that never enters the polygon
 * leaves it whole. Works on concave polygons.
 */
export function splitPolygonByPolyline(poly: readonly Pt[], line: readonly Pt[], depth = 0): Pt[][] {
  if (poly.length < 3 || line.length < 2 || depth > 24) return [poly.map((p) => [p[0], p[1]] as Pt)];
  // Every crossing of the line with the boundary, in order along the line.
  const hits: Array<{ s: number; seg: number; edge: number; u: number; p: Pt }> = [];
  for (let i = 0; i < line.length - 1; i++) {
    for (let e = 0; e < poly.length; e++) {
      const x = cross(line[i], line[i + 1], poly[e], poly[(e + 1) % poly.length]);
      if (!x) continue;
      const s = i + x.t;
      if (hits.some((h) => Math.abs(h.s - s) < 1e-9)) continue; // a corner hit twice
      hits.push({ s, seg: i, edge: e, u: x.u, p: x.p });
    }
  }
  hits.sort((a, b) => a.s - b.s);
  for (let k = 0; k < hits.length - 1; k++) {
    const h1 = hits[k], h2 = hits[k + 1];
    // Inside run? Test the line point halfway between the two crossings.
    const sm = (h1.s + h2.s) / 2;
    const si = Math.min(line.length - 2, Math.floor(sm));
    const f = sm - si;
    const mid: Pt = [line[si][0] + (line[si + 1][0] - line[si][0]) * f, line[si][1] + (line[si + 1][1] - line[si][1]) * f];
    if (!pointIn(mid, poly)) continue;
    if (dist(h1.p, h2.p) < 1e-9 && h2.seg === h1.seg) continue;
    // The chord: h1, the line's own corners between, h2.
    const chord: Pt[] = [h1.p];
    for (let i = h1.seg + 1; i <= h2.seg; i++) chord.push([line[i][0], line[i][1]]);
    chord.push(h2.p);
    // Boundary walk from h1 forward to h2, and from h2 forward to h1.
    const walk = (from: typeof h1, to: typeof h1): Pt[] => {
      const out: Pt[] = [from.p];
      if (from.edge === to.edge && from.u < to.u) { out.push(to.p); return out; }
      let e = from.edge;
      for (let guard = 0; guard <= poly.length; guard++) {
        e = (e + 1) % poly.length;
        out.push([poly[e][0], poly[e][1]]);
        if (e === to.edge) break;
      }
      out.push(to.p);
      return out;
    };
    const a = [...walk(h1, h2), ...chord.slice(1, -1).reverse()];
    const b = [...walk(h2, h1), ...chord.slice(1, -1)];
    // Only the line past this chord can cut again. Re-testing the chord
    // itself would ask whether a point ON the new boundary is inside.
    const rest: Pt[] = [h2.p, ...line.slice(h2.seg + 1).map((p) => [p[0], p[1]] as Pt)];
    const parts: Pt[][] = [];
    for (const piece of [a, b]) {
      const clean = dedupe(piece);
      if (clean.length >= 3 && Math.abs(signedArea(clean)) > 1e-9) parts.push(...splitPolygonByPolyline(clean, rest, depth + 1));
    }
    return parts.length > 0 ? parts : [poly.map((p) => [p[0], p[1]] as Pt)];
  }
  return [poly.map((p) => [p[0], p[1]] as Pt)];
}

function dedupe(poly: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const p of poly) {
    const last = out[out.length - 1];
    if (last && Math.abs(last[0] - p[0]) < 1e-9 && Math.abs(last[1] - p[1]) < 1e-9) continue;
    out.push(p);
  }
  while (out.length > 1 && Math.abs(out[0][0] - out[out.length - 1][0]) < 1e-9 && Math.abs(out[0][1] - out[out.length - 1][1]) < 1e-9) out.pop();
  return out;
}

function pointIn(p: Pt, poly: readonly Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** A street end on each bank where a ward edge crossed the channel. */
export interface RiverLink {
  /** Bank end on the left bank line. */
  a: Pt;
  /** Bank end on the right bank line. */
  b: Pt;
}

export interface RiverCut {
  /**
   * The town land outside the channel, as pieces of the input polygons in
   * input order. `from[i]` is the input polygon piece `i` came from.
   */
  polys: Pt[][];
  from: number[];
  links: RiverLink[];
  /** The two bank lines of each river, left then right. */
  banks: Pt[][];
}

/**
 * Cut the channel (`half` either side of each river line) out of the polygons.
 * Pieces whose center lies in the channel, and pieces smaller than `minArea`,
 * are dropped. `ext` runs the bank lines on past the ends of each river line.
 */
export function cutRiverChannel(polys: readonly Pt[][], rivers: readonly Pt[][], half: number, minArea: number, ext: number): RiverCut {
  const banks: Pt[][] = [];
  for (const r of rivers) {
    if (r.length < 2) continue;
    banks.push(offsetPolyline(r, half, ext), offsetPolyline(r, -half, ext));
  }
  const out: Pt[][] = [];
  const from: number[] = [];
  polys.forEach((poly, i) => {
    let pieces: Pt[][] = [poly.map((p) => [p[0], p[1]] as Pt)];
    for (const bank of banks) pieces = pieces.flatMap((p) => splitPolygonByPolyline(p, bank));
    for (const p of pieces) {
      if (Math.abs(signedArea(p)) < minArea) continue;
      if (distToLines(centroid(p), rivers as Pt[][]) < half) continue;
      out.push(p);
      from.push(i);
    }
  });
  // Links: each distinct input edge that crosses both bank lines of a river.
  const links: RiverLink[] = [];
  const seen = new Set<string>();
  const key = (p: Pt): string => `${p[0].toFixed(4)},${p[1].toFixed(4)}`;
  for (const poly of polys) {
    for (let e = 0; e < poly.length; e++) {
      const p = poly[e], q = poly[(e + 1) % poly.length];
      const k = [key(p), key(q)].sort().join('|');
      if (seen.has(k)) continue;
      seen.add(k);
      for (let r = 0; r + 1 < banks.length; r += 2) {
        const hitA = firstCross(p, q, banks[r]);
        const hitB = firstCross(p, q, banks[r + 1]);
        if (hitA && hitB) links.push({ a: hitA, b: hitB });
      }
    }
  }
  // Links between bank corners. When no ward site stands in the river, the
  // river runs ALONG Voronoi edges and no edge crosses it. A street that meets
  // a bank still ends at a ward corner there; the corner on the far bank
  // nearest the point straight across is its other end. `reach` keeps a link
  // close to square: the far corner may lie at most `half` off the straight
  // line across.
  const corners = new Map<string, Pt>();
  for (const p of out) for (const q of p) corners.set(key(q), q);
  const sideOf = (p: Pt): { side: number; foot: Pt; n: Pt } | null => {
    let best = Infinity, foot: Pt = p, tan: Pt = [1, 0];
    for (const r of rivers) for (let i = 0; i < r.length - 1; i++) {
      const a = r[i], b = r[i + 1];
      const vx = b[0] - a[0], vy = b[1] - a[1];
      const L2 = vx * vx + vy * vy;
      if (L2 < 1e-12) continue;
      const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / L2));
      const q: Pt = [a[0] + vx * t, a[1] + vy * t];
      const d = dist(p, q);
      if (d < best) { best = d; foot = q; const L = Math.sqrt(L2); tan = [vx / L, vy / L]; }
    }
    if (!isFinite(best) || Math.abs(best - half) > half * 0.02) return null; // not on a bank line
    const n: Pt = [-tan[1], tan[0]];
    const side = (p[0] - foot[0]) * n[0] + (p[1] - foot[1]) * n[1] >= 0 ? 1 : -1;
    return { side, foot, n };
  };
  const bankCorners = [...corners.values()].map((p) => ({ p, s: sideOf(p) })).filter((c) => c.s !== null) as Array<{ p: Pt; s: { side: number; foot: Pt; n: Pt } }>;
  const linkSeen = new Set<string>();
  for (const c of bankCorners) {
    if (c.s.side < 0) continue; // from the left bank only; each pair once
    const across: Pt = [c.s.foot[0] - c.s.n[0] * half, c.s.foot[1] - c.s.n[1] * half];
    let best: Pt | null = null, bestD = half;
    for (const o of bankCorners) {
      if (o.s.side > 0) continue;
      const d = dist(o.p, across);
      if (d < bestD) { bestD = d; best = o.p; }
    }
    if (!best) continue;
    const k = `${key(c.p)}|${key(best)}`;
    if (linkSeen.has(k)) continue;
    linkSeen.add(k);
    links.push({ a: c.p, b: best });
  }
  return { polys: out, from, links, banks };
}

function firstCross(p: Pt, q: Pt, line: readonly Pt[]): Pt | null {
  let best: { p: Pt; t: number } | null = null;
  for (let i = 0; i < line.length - 1; i++) {
    const x = cross(p, q, line[i], line[i + 1]);
    if (x && (!best || x.t < best.t)) best = { p: x.p, t: x.t };
  }
  return best ? best.p : null;
}
