/**
 * @file marchingSquares.ts
 * Generic scalar-field → closed-polygon extraction via the marching squares algorithm.
 *
 * The field is sampled at integer cell coords. A cell is "inside" if field(x,y) >= threshold.
 * Returns one polygon per connected region of inside cells; each polygon is a closed loop
 * traced along cell boundaries.
 *
 * Connectivity convention: 4-neighbor (cells touching only at a diagonal corner are NOT
 * considered connected — they each get their own polygon, EXCEPT when the corner is a
 * shared boundary vertex, in which case the tracer may merge them into a figure-8.
 * For Aralia's use (coastlines bounded by ocean flood-fill, biome zones over contiguous
 * grids) this case is rare; if it becomes a problem, switch the next-edge selection in
 * the chain loop to prefer the right-hand-turn candidate by winding angle.
 */

import type { Polygon, Vec2 } from './types';

type Field = (x: number, y: number) => number;

interface Edge {
  a: Vec2;
  b: Vec2;
}

const KEY = (v: Vec2): string => `${v.x.toFixed(2)},${v.y.toFixed(2)}`;

export function extractPolygons(field: Field, cols: number, rows: number, threshold: number): Polygon[] {
  const inside = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= cols || y >= rows) return false;
    return field(x, y) >= threshold;
  };

  const edges: Edge[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (!inside(x, y)) continue;
      if (!inside(x, y - 1)) edges.push({ a: { x, y }, b: { x: x + 1, y } });
      if (!inside(x + 1, y)) edges.push({ a: { x: x + 1, y }, b: { x: x + 1, y: y + 1 } });
      if (!inside(x, y + 1)) edges.push({ a: { x: x + 1, y: y + 1 }, b: { x, y: y + 1 } });
      if (!inside(x - 1, y)) edges.push({ a: { x, y: y + 1 }, b: { x, y } });
    }
  }

  const edgesByStart = new Map<string, Edge[]>();
  for (const e of edges) {
    const k = KEY(e.a);
    const list = edgesByStart.get(k) ?? [];
    list.push(e);
    edgesByStart.set(k, list);
  }

  const used = new Set<Edge>();
  const polygons: Polygon[] = [];

  const seedKey = (e: Edge) => KEY(e.a);
  for (const seed of edges) {
    if (used.has(seed)) continue;
    const startKey = seedKey(seed);
    const loop: Vec2[] = [seed.a];
    let current: Edge | undefined = seed;
    let guard = edges.length + 1;
    while (current && guard-- > 0) {
      used.add(current);
      loop.push(current.b);
      if (KEY(current.b) === startKey) break;
      const candidates = edgesByStart.get(KEY(current.b));
      const next = candidates?.find((e) => !used.has(e));
      if (!next) break;
      current = next;
    }
    // Only accept properly closed loops — discard open chains caused by
    // degenerate input (e.g., isolated vertices with no edge-adjacent
    // inside neighbors).
    const closed = loop.length >= 4 && KEY(loop[loop.length - 1]) === KEY(seed.a);
    if (closed) {
      const simplified = simplifyClosed(loop);
      if (simplified.length >= 3) polygons.push(simplified);
    }
  }

  return polygons;
}

function simplifyClosed(loop: Vec2[]): Polygon {
  // Drop trailing duplicate of the start vertex so we don't double-count it.
  const pts =
    loop.length > 1 && KEY(loop[0]) === KEY(loop[loop.length - 1])
      ? loop.slice(0, -1)
      : loop.slice();
  const out: Vec2[] = [];
  for (let i = 0; i < pts.length; i++) {
    const prev = pts[(i - 1 + pts.length) % pts.length];
    const cur = pts[i];
    const next = pts[(i + 1) % pts.length];
    const dx1 = cur.x - prev.x;
    const dy1 = cur.y - prev.y;
    const dx2 = next.x - cur.x;
    const dy2 = next.y - cur.y;
    if (dx1 * dy2 - dy1 * dx2 === 0) continue;
    out.push(cur);
  }
  return out;
}
