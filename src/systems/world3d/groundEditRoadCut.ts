/**
 * @file groundEditRoadCut.ts - a ground edit removes the paving it cuts through
 * (agora-257c, 2026-10-29, GG-533).
 *
 * WHY. A spell that digs a hole in a paved square takes the paving with it, and
 * a wall raised across a street buries the street. The first try draped the
 * road ribbons into the edit with the footing patch, 3 mm over the ground. On a
 * hole's steep wall the road's and the ground's fine triangles split each cell
 * on different lines, the two surfaces parted by more than 3 mm, and the ground
 * showed through the paving in a stepped dark pattern. Removing the paving
 * where the ground changed is both the physical truth and free of that fight.
 *
 * THE RULE. The paving leaves the drawn mesh where it overlaps a ground edit's
 * footprint: the points within the shape's radius of its center line (a hole's
 * point, a trench's or a wall's segment; a crater's rim, see
 * `groundShapeFootprintRadius`), which is where `groundShapeDeltas`
 * moves the ground. A road triangle that crosses the footprint's outline is
 * split in four, again and again, down to CUT_EDGE_M; the pieces inside go and
 * the pieces outside stay, with every attribute interpolated on the triangle's
 * own plane. So a 20 m plaza face loses a hole the edit's size, not the whole
 * face (the first rule dropped whole faces and bared a 20 m patch around a 4 m
 * hole). A triangle with all three corners inside the footprint goes at once:
 * the footprint is convex. Untouched faces keep their vertices and order.
 */

/** The cut's finest piece, m: the paving's edge along an edit is this jagged at most. */
export const CUT_EDGE_M = 0.4;
import { groundShapeFootprintRadius, type GroundShape } from '@/systems/worldforge/terrain/groundShapeProfile';
import type { ChunkGeometryArrays } from './types';

type P = readonly [number, number];

/** Distance from point p to segment ab. */
function pointSegment(p: P, a: P, b: P): number {
  const ex = b[0] - a[0], ez = b[1] - a[1], len2 = ex * ex + ez * ez;
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * ex + (p[1] - a[1]) * ez) / len2)) : 0;
  return Math.hypot(p[0] - a[0] - ex * t, p[1] - a[1] - ez * t);
}

const cross = (o: P, a: P, b: P) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

/** True when segments ab and cd cross or touch. */
function segmentsMeet(a: P, b: P, c: P, d: P): boolean {
  const d1 = cross(c, d, a), d2 = cross(c, d, b), d3 = cross(a, b, c), d4 = cross(a, b, d);
  return ((d1 > 0) !== (d2 > 0) || d1 === 0 || d2 === 0) && ((d3 > 0) !== (d4 > 0) || d3 === 0 || d4 === 0);
}

/** Distance between segments ab and cd (0 when they meet). */
function segmentSegment(a: P, b: P, c: P, d: P): number {
  if (segmentsMeet(a, b, c, d)) return 0;
  return Math.min(pointSegment(a, c, d), pointSegment(b, c, d), pointSegment(c, a, b), pointSegment(d, a, b));
}

/** True when point p lies inside (or on) triangle abc. */
function inTriangle(p: P, a: P, b: P, c: P): boolean {
  const s1 = cross(a, b, p), s2 = cross(b, c, p), s3 = cross(c, a, p);
  return (s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0);
}

/** True when triangle abc overlaps the shape's footprint (where it changes the ground). */
export function triangleMeetsGroundShape(s: GroundShape, a: P, b: P, c: P): boolean {
  const s0: P = [s.x, s.z];
  const s1: P = [s.x2 ?? s.x, s.z2 ?? s.z];
  if (inTriangle(s0, a, b, c) || inTriangle(s1, a, b, c)) return true;
  const r = groundShapeFootprintRadius(s);
  return segmentSegment(a, b, s0, s1) < r
    || segmentSegment(b, c, s0, s1) < r
    || segmentSegment(c, a, s0, s1) < r;
}

/** True when a point lies inside the shape's footprint. */
function insideShape(s: GroundShape, p: P): boolean {
  return pointSegment(p, [s.x, s.z], [s.x2 ?? s.x, s.z2 ?? s.z]) < groundShapeFootprintRadius(s);
}

/**
 * The mesh without the paving a ground edit cut through. `origin` is the
 * mesh's world offset (chunk-local positions plus origin are world meters).
 * Every per-vertex float array of the mesh (positions, normals and any of
 * colors, road, terrainLift) is carried to new vertices; a `road` array's
 * fourth value is a surface kind and is copied, not blended. The same mesh
 * object comes back when nothing is cut.
 */
export function cutRoadMeshByGroundShapes<M extends ChunkGeometryArrays>(
  mesh: M, origin: { x: number; z: number }, shapes: readonly GroundShape[],
): M {
  if (shapes.length === 0 || mesh.indices.length === 0) return mesh;
  const p = mesh.positions;
  const count = p.length / 3;
  // Only shapes whose box meets the mesh's box can cut it.
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < p.length; i += 3) {
    const x = p[i] + origin.x, z = p[i + 2] + origin.z;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  const near = shapes.filter((sh) => {
    const bx = sh.x2 ?? sh.x, bz = sh.z2 ?? sh.z;
    return Math.max(sh.x, bx) + sh.radius >= minX && Math.min(sh.x, bx) - sh.radius <= maxX
      && Math.max(sh.z, bz) + sh.radius >= minZ && Math.min(sh.z, bz) - sh.radius <= maxZ;
  });
  if (near.length === 0) return mesh;

  // The per-vertex arrays to carry, with their strides.
  const attrs: Array<{ key: string; src: Float32Array; stride: number; out: number[] }> = [];
  for (const [key, value] of Object.entries(mesh)) {
    if (key === 'indices' || !(value instanceof Float32Array) || value.length % count !== 0) continue;
    attrs.push({ key, src: value, stride: value.length / count, out: Array.from(value) });
  }
  let next = count;
  // A new vertex at the midpoint of edge ab, on the source triangle's plane.
  // A shared edge gets its midpoint twice, with equal values: no crack.
  type V = { id: number; p: P };
  const blend = (a: V, b: V): V => {
    for (const x of attrs) {
      for (let k = 0; k < x.stride; k += 1) {
        const va = x.out[a.id * x.stride + k], vb = x.out[b.id * x.stride + k];
        x.out.push(x.key === 'road' && k === 3 ? va : (va + vb) / 2);
      }
    }
    const id = next;
    next += 1;
    return { id, p: [(a.p[0] + b.p[0]) / 2, (a.p[1] + b.p[1]) / 2] };
  };
  const at = (v: number): V => ({ id: v, p: [p[v * 3] + origin.x, p[v * 3 + 2] + origin.z] });
  const kept: number[] = [];
  let changed = false;
  const walk = (a: V, b: V, c: V, hits: readonly GroundShape[]): void => {
    const meeting = hits.filter((sh) => triangleMeetsGroundShape(sh, a.p, b.p, c.p));
    if (meeting.length === 0) { kept.push(a.id, b.id, c.id); return; }
    changed = true;
    if (meeting.some((sh) => insideShape(sh, a.p) && insideShape(sh, b.p) && insideShape(sh, c.p))) return;
    const edge = Math.max(Math.hypot(a.p[0] - b.p[0], a.p[1] - b.p[1]), Math.hypot(b.p[0] - c.p[0], b.p[1] - c.p[1]), Math.hypot(c.p[0] - a.p[0], c.p[1] - a.p[1]));
    if (edge <= CUT_EDGE_M) return;
    const ab = blend(a, b), bc = blend(b, c), ca = blend(c, a);
    walk(a, ab, ca, meeting);
    walk(ab, b, bc, meeting);
    walk(ca, bc, c, meeting);
    walk(ab, bc, ca, meeting);
  };
  const I = mesh.indices;
  for (let t = 0; t < I.length; t += 3) walk(at(I[t]), at(I[t + 1]), at(I[t + 2]), near);
  if (!changed) return mesh;
  const out = { ...mesh, indices: new Uint32Array(kept) } as M;
  for (const x of attrs) (out as unknown as Record<string, Float32Array>)[x.key] = new Float32Array(x.out);
  return out;
}
