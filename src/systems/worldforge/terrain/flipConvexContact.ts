/**
 * Optional closed-rock contact for the local particle-water experiment.
 * Both grid and moving parcels use the same planes of an actual convex mesh.
 * Sweeps retain the side struck, replacing the prototype's floor/roof springs.
 *
 * DEBT: This contains parcel centers, not their finite liquid volume. Grid
 * support can react early, and inelastic normal projection is a numerical
 * contact closure, not measured liquid-impact dissipation. General concave
 * terrain and multiple interacting solids are deliberately rejected here.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 12/10/2026, 15:07:28
 * Dependents: systems/worldforge/terrain/flipCompute.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { If, float, int, storage, vec3, vec4 } from 'three/tsl';
import { StorageBufferAttribute } from 'three/webgpu';
import type { FlipParams } from './flipCompute';
import type { TslNode } from '@/types/tslNode';

type V3 = [number, number, number];
// Three's TSL expression types do not cover mutable shader variables reliably.
// Keep that boundary local, matching flipCompute rather than weakening callers.
type Node = TslNode; // Shared TSL alias (GG-588): see src/types/tslNode.ts.
const dot = (a: readonly number[], b: readonly number[]) => a.reduce((s, v, i) => s + v * b[i], 0);
const sub = (a: readonly number[], b: readonly number[]): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

export interface ConvexPlane { normal: V3; point: V3 }
export interface FlipConvexContact {
  geometryId: string;
  params: FlipParams;
  /** Planes and state are in solver grid coordinates; normals are unit length. */
  planes: ConvexPlane[];
  /** Persistent contact anchor xyz, supporting plane index+1 (zero = free). */
  anchors: StorageBufferAttribute;
  /** Accumulated tangential displacement xyz; w=1 flags unexplained penetration. */
  displacements: StorageBufferAttribute;
}

export function createFlipConvexContact(params: FlipParams, geometryId: string, vertices: readonly V3[], triangles: readonly [number, number, number][]): FlipConvexContact {
  if (!geometryId || vertices.length < 4 || triangles.length < 4 || !(params.dx > 0)
      || !Number.isInteger(params.count) || params.count < 1
      || !vertices.every(v => v.length === 3 && v.every(Number.isFinite))) throw Error('Invalid convex collider');
  const center = vertices.reduce((sum, v) => sum.map((x, a) => x + v[a] / vertices.length) as V3, [0, 0, 0] as V3);
  const edges = new Map<string, number>();
  const planes: ConvexPlane[] = [];
  for (const tri of triangles) {
    if (tri.some(i => !Number.isInteger(i) || i < 0 || i >= vertices.length)) throw Error('Invalid collider triangle');
    for (let e = 0; e < 3; e++) {
      const key = [tri[e], tri[(e + 1) % 3]].sort((a, b) => a - b).join(':');
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
    const pointM = vertices[tri[0]], raw = cross(sub(vertices[tri[1]], pointM), sub(vertices[tri[2]], pointM));
    const norm = Math.hypot(...raw);
    if (norm < 1e-12) throw Error('Degenerate collider triangle');
    const sign = dot(raw, sub(center, pointM)) > 0 ? -1 : 1;
    const normal = raw.map(x => sign * x / norm) as V3;
    if (vertices.some(v => dot(normal, sub(v, pointM)) > 1e-8)) throw Error('Collider is not convex or planar');
    const point = pointM.map((x, a) => (x - params.origin[a]) / params.dx) as V3;
    if (!planes.some(f => dot(f.normal, normal) > 1 - 1e-12 && Math.abs(dot(normal, sub(point, f.point))) < 1e-8)) planes.push({ normal, point });
  }
  if ([...edges.values()].some(count => count !== 2) || planes.length < 4) throw Error('Collider is not closed');
  return { geometryId, params: { ...params, origin: [...params.origin] }, planes,
    anchors: new StorageBufferAttribute(new Float32Array(params.count * 4), 4),
    displacements: new StorageBufferAttribute(new Float32Array(params.count * 4), 4) };
}

export function bindFlipConvexContact(boundary: FlipConvexContact) {
  const anchors = storage(boundary.anchors, 'vec4', boundary.params.count);
  const displacements = storage(boundary.displacements, 'vec4', boundary.params.count);
  const planes = boundary.planes.map(f => ({ normal: vec3(...f.normal), point: vec3(...f.point) }));
  // Arithmetic classification tolerance, in grid cells. It does not create an
  // exterior collision band, move water off the face or cap a correction.
  const epsilon = float(1e-5);
  const distance = (x: Node, f: { normal: Node; point: Node }) => x.sub(f.point).dot(f.normal);
  const project = (v: Node, normal: Node) => { v.subAssign(normal.mul(v.dot(normal).min(float(0)))); };
  return {
    grid: (x: Node, v: Node) => {
      const nearest = float(-1e20).toVar(), normal = vec3(0).toVar();
      for (const f of planes) {
        const d = distance(x, f).toVar();
        If(d.greaterThan(nearest), () => { nearest.assign(d); normal.assign(f.normal); });
      }
      // Strict solid membership: outside grid nodes get no terrain impulse.
      If(nearest.lessThanEqual(float(0)), () => { project(v, normal); });
    },
    particle: (p: Node, xp: Node, v: Node, dt: Node, endpoint: Node) => {
      const anchor = anchors.element(p).toVar(), displacement = displacements.element(p).toVar();
      const start = xp.toVar(), supported = int(0).toVar();
      const face = int(-1).toVar(), hit = float(0).toVar();
      const normal = vec3(0).toVar();
      // Known support is a persistent material coordinate on that finite face.
      // Reconstruct it, rather than depenetrating an endpoint in the other void.
      planes.forEach((f, i) => {
        If(anchor.w.equal(float(i + 1)), () => {
          const position = anchor.xyz.add(displacement.xyz).toVar();
          const insideFace = int(1).toVar();
          for (const other of planes) If(distance(position, other).greaterThan(epsilon), () => { insideFace.assign(int(0)); });
          If(insideFace.equal(int(1)).and(v.dot(f.normal).lessThanEqual(float(0))), () => {
            start.assign(position); supported.assign(int(1)); face.assign(int(i)); normal.assign(f.normal);
          });
        });
      });
      If(supported.equal(int(0)), () => {
        const enter = float(0).toVar(), leave = float(1).toVar(), valid = int(1).toVar();
        const maxStart = float(-1e20).toVar(), bestChange = float(1e20).toVar();
        const drift = v.mul(dt).toVar();
        planes.forEach((f, i) => {
          const d = distance(start, f).toVar(), speed = drift.dot(f.normal).toVar();
          maxStart.assign(maxStart.max(d));
          If(speed.abs().lessThanEqual(epsilon), () => {
            // A path lying on a supporting plane merely grazes the solid.
            // Crossing a different face at its edge must not stop that path.
            // The same declared arithmetic tolerance covers near-parallel
            // drift; it neither displaces the parcel nor widens the collider.
            If(d.greaterThanEqual(epsilon.negate()), () => { valid.assign(int(0)); });
          }).Else(() => {
            const t = d.negate().div(speed).toVar();
            If(speed.lessThan(float(0)), () => {
              // At a shared edge the least normal change leaves the particle
              // on one admissible supporting face of the convex exterior.
              If(t.greaterThan(enter.add(float(1e-6))).or(t.sub(enter).abs().lessThanEqual(float(1e-6)).and(speed.abs().lessThan(bestChange))), () => {
                face.assign(int(i)); normal.assign(f.normal); bestChange.assign(speed.abs());
              });
              enter.assign(enter.max(t));
            }).Else(() => { leave.assign(leave.min(t)); });
          });
        });
        If(maxStart.lessThan(epsilon.negate()), () => {
          // Fail visibly; no hidden through-rock repair or opposite-face clamp.
          displacements.element(p).w.assign(float(1)); valid.assign(int(0));
        });
        If(valid.equal(int(1)).and(enter.lessThanEqual(leave)).and(enter.lessThanEqual(float(1))).and(leave.greaterThanEqual(float(0))).and(face.greaterThanEqual(int(0))), () => {
          hit.assign(enter.max(float(0))); supported.assign(int(1));
          anchor.xyz.assign(start.add(drift.mul(hit))); displacement.xyz.assign(vec3(0));
        });
      });
      If(supported.equal(int(1)), () => {
        project(v, normal);
        displacement.xyz.addAssign(v.mul(dt).mul(float(1).sub(hit)));
        // Project roundoff in the stored tangential coordinate, not the water
        // to another surface. No offset or collision-distance adjustment.
        displacement.xyz.subAssign(normal.mul(displacement.xyz.dot(normal)));
        endpoint.assign(anchor.xyz.add(displacement.xyz));
        anchor.w.assign(float(face.add(int(1))));
        const stillOnFace = int(1).toVar();
        for (const f of planes) If(distance(endpoint, f).greaterThan(epsilon), () => { stillOnFace.assign(int(0)); });
        If(stillOnFace.equal(int(0)), () => { anchor.w.assign(float(0)); });
        anchors.element(p).assign(anchor);
        displacements.element(p).xyz.assign(displacement.xyz);
      }).Else(() => { anchors.element(p).w.assign(float(0)); });
    },
  };
}
