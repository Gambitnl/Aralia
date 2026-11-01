/** Render the canonical walking surface close to accepted feet. The existing
 * coarse triangles remain the partition: shared edges refine by one geometric
 * rule, so stitched chunk borders still meet and no second heightfield overlaps.
 * This changes render buffers only, never the source grid or a body's height. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/10/2026, 03:08:13
 * Dependents: components/World3D/World3DScene.tsx, systems/world3d/roadGeometry.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { TerrainMesh } from './types';

export interface TerrainFootingDetail {
  centerX: number;
  centerZ: number;
  innerRadius: number;
  outerRadius: number;
  maxEdgeM: number;
  heightAt(xM: number, zM: number): number;
}

type Point = { x: number; z: number };
type Vertex = Point & { baseY: number; y: number; color: [number, number, number]; normal: [number, number, number] };
type Bounds = { minX: number; maxX: number; minZ: number; maxZ: number };

export function footingDetailBounds(detail: TerrainFootingDetail): Bounds {
  return { minX: detail.centerX - detail.outerRadius, maxX: detail.centerX + detail.outerRadius,
    minZ: detail.centerZ - detail.outerRadius, maxZ: detail.centerZ + detail.outerRadius };
}

/** Admit the entire patch plus a chunk ring at once. Frontier skirts retain
 * their existing geometry; no refined edge can meet an unloaded neighbor. */
export function footingDetailReady(detail: TerrainFootingDetail, loadedKeys: ReadonlySet<string>, chunkSize: number): boolean {
  const bounds = footingDetailBounds(detail);
  for (let cx = Math.floor(bounds.minX / chunkSize) - 1; cx <= Math.floor(bounds.maxX / chunkSize) + 1; cx++) {
    for (let cy = Math.floor(bounds.minZ / chunkSize) - 1; cy <= Math.floor(bounds.maxZ / chunkSize) + 1; cy++) {
      if (!loadedKeys.has(`${cx}|${cy}`)) return false;
    }
  }
  return true;
}

/** Clip one convex source-face polygon without changing its plane. */
function clipPolygon(points: Point[], axis: 'x' | 'z', bound: number, sign: number): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i], q = points[(i + 1) % points.length];
    const pin = (p[axis] - bound) * sign >= 0, qin = (q[axis] - bound) * sign >= 0;
    if (pin) out.push(p);
    if (pin !== qin) {
      const t = (bound - p[axis]) / (q[axis] - p[axis]);
      const hit = { x: p.x + (q.x - p.x) * t, z: p.z + (q.z - p.z) * t };
      hit[axis] = bound;
      out.push(hit);
    }
  }
  return out;
}

/** Intersect the original faces with a finite detail grid. This preserves the
 * coarse partition and shared border cuts without recursive corner chains.
 * Source buffers and walking height stay untouched; the vertex cap still rejects
 * work that cannot fit, rather than publishing a coarse substitute. */
export function refineTerrainForFooting(mesh: TerrainMesh, origin: Point, detail: TerrainFootingDetail): TerrainMesh {
  if (![detail.centerX, detail.centerZ, detail.innerRadius, detail.outerRadius, detail.maxEdgeM].every(Number.isFinite)
    || detail.innerRadius < 0 || detail.outerRadius <= detail.innerRadius || detail.maxEdgeM <= 0) throw Error('Invalid footing detail bounds');
  const bounds = footingDetailBounds(detail), count = mesh.positions.length / 3;
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < count; i++) {
    const x = mesh.positions[i * 3] + origin.x, z = mesh.positions[i * 3 + 2] + origin.z;
    minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
  }
  const overlap = maxX >= bounds.minX && minX <= bounds.maxX && maxZ >= bounds.minZ && minZ <= bounds.maxZ;
  // The four partition lines must agree on adjacent chunks even outside the
  // patch. Their exterior faces retain exactly the original affine surface.
  const crossesLine = [bounds.minX, bounds.maxX].some(x => x >= minX && x <= maxX)
    || [bounds.minZ, bounds.maxZ].some(z => z >= minZ && z <= maxZ);
  if (!overlap && !crossesLine) return mesh;
  const cells = Math.ceil((detail.outerRadius * 2) / (detail.maxEdgeM / Math.SQRT2));
  if (count > 250000 || !Number.isSafeInteger(cells) || cells > 250000) throw Error('Footing detail exceeds bounded mesh budget');
  const step = detail.outerRadius * 2 / cells;
  const gridX = Array.from({ length: cells + 1 }, (_, i) => i === cells ? bounds.maxX : bounds.minX + i * step);
  const gridZ = Array.from({ length: cells + 1 }, (_, i) => i === cells ? bounds.maxZ : bounds.minZ + i * step);
  const planes = [['x', bounds.minX, 1], ['x', bounds.maxX, -1], ['z', bounds.minZ, 1], ['z', bounds.maxZ, -1]] as const;
  const vertices: Vertex[] = [], indices: number[] = [], topVertices = new Set<number>();
  const renderHeight = (x: number, z: number, baseY: number) => {
    const radius = Math.max(Math.abs(x - detail.centerX), Math.abs(z - detail.centerZ));
    if (radius >= detail.outerRadius) return baseY;
    const t = Math.max(0, Math.min(1, (detail.outerRadius - radius) / (detail.outerRadius - detail.innerRadius)));
    const blend = t * t * (3 - 2 * t), canonicalY = detail.heightAt(x, z);
    if (!Number.isFinite(canonicalY)) throw Error('Nonfinite canonical footing surface');
    return baseY + (canonicalY - baseY) * blend;
  };
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const [a, b, c] = [mesh.indices[i], mesh.indices[i + 1], mesh.indices[i + 2]], p = mesh.positions;
    if ((p[b * 3] - p[a * 3]) * (p[c * 3 + 2] - p[a * 3 + 2]) - (p[b * 3 + 2] - p[a * 3 + 2]) * (p[c * 3] - p[a * 3]) < -1e-10) {
      topVertices.add(a); topVertices.add(b); topVertices.add(c);
    }
  }
  for (let i = 0; i < count; i++) {
    const x = mesh.positions[i * 3] + origin.x, z = mesh.positions[i * 3 + 2] + origin.z, baseY = mesh.positions[i * 3 + 1];
    vertices.push({ x, z, baseY, y: topVertices.has(i) ? renderHeight(x, z, baseY) : baseY,
      color: [mesh.colors[i * 3], mesh.colors[i * 3 + 1], mesh.colors[i * 3 + 2]],
      normal: [mesh.normals[i * 3], mesh.normals[i * 3 + 1], mesh.normals[i * 3 + 2]] });
  }
  const localPoint = (p: Point): Point => ({ x: Math.fround(Number((p.x - origin.x).toFixed(9))) + origin.x,
    z: Math.fround(Number((p.z - origin.z).toFixed(9))) + origin.z });
  const key = (p: Point) => (p.x - origin.x) + '|' + (p.z - origin.z);
  const cache = new Map<string, number>();
  for (const i of topVertices) cache.set(key(vertices[i]), i);
  let work = 0;
  for (let f = 0; f < mesh.indices.length; f += 3) {
    const faceIds = [mesh.indices[f], mesh.indices[f + 1], mesh.indices[f + 2]];
    const [a, b, c] = faceIds.map(i => vertices[i]);
    const area = (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
    if (area >= -1e-12) { indices.push(...faceIds); continue; }
    const vertexAt = (point: Point): number => {
      const p = localPoint(point), k = key(p), old = cache.get(k);
      if (old != null) return old;
      if (vertices.length >= 250000) throw Error('Footing detail exceeds bounded mesh budget');
      const wb = ((p.x - a.x) * (c.z - a.z) - (p.z - a.z) * (c.x - a.x)) / area;
      const wc = ((b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x)) / area;
      const wa = 1 - wb - wc, baseY = a.baseY * wa + b.baseY * wb + c.baseY * wc;
      const index = vertices.length;
      vertices.push({ ...p, baseY, y: renderHeight(p.x, p.z, baseY),
        color: a.color.map((v, i) => v * wa + b.color[i] * wb + c.color[i] * wc) as Vertex['color'],
        normal: a.normal.map((v, i) => v * wa + b.normal[i] * wb + c.normal[i] * wc) as Vertex['normal'] });
      cache.set(k, index); return index;
    };
    const emit = (polygon: Point[]) => {
      const ids = [...new Set(polygon.map(vertexAt))];
      if (ids.length < 3) return;
      const p = vertices[ids[0]];
      let signed = 0;
      for (let i = 1; i + 1 < ids.length; i++) {
        const q = vertices[ids[i]], r = vertices[ids[i + 1]];
        signed += (q.x - p.x) * (r.z - p.z) - (q.z - p.z) * (r.x - p.x);
      }
      if (Math.abs(signed) < 1e-12) return;
      if (signed > 0) ids.reverse();
      if (ids.length === 3) { indices.push(...ids); return; }
      // An interior fan retains every collinear boundary cut, so neighboring
      // pieces share whole edges rather than hanging grid vertices.
      const center = vertexAt({ x: ids.reduce((s, i) => s + vertices[i].x, 0) / ids.length,
        z: ids.reduce((s, i) => s + vertices[i].z, 0) / ids.length });
      for (let i = 0; i < ids.length; i++) {
        const u = ids[i], v = ids[(i + 1) % ids.length];
        if (center === u || center === v) continue;
        const p = vertices[center], q = vertices[u], r = vertices[v];
        const cross = (q.x - p.x) * (r.z - p.z) - (q.z - p.z) * (r.x - p.x);
        if (cross < -1e-12) indices.push(center, u, v);
        else if (cross > 1e-12) indices.push(center, v, u);
      }
    };
    const boundaryCuts = (polygon: Point[]): Point[] => {
      const out: Point[] = [];
      for (let i = 0; i < polygon.length; i++) {
        const p = polygon[i], q = polygon[(i + 1) % polygon.length];
        const cuts: Array<{ t: number; p: Point }> = [{ t: 0, p }];
        if (Math.abs(p.x - q.x) < 1e-8 && [bounds.minX, bounds.maxX].some(x => Math.abs(x - p.x) < 1e-8) && p.z !== q.z) {
          for (const z of gridZ) { const t = (z - p.z) / (q.z - p.z); if (t > 1e-10 && t < 1 - 1e-10) cuts.push({ t, p: { x: p.x, z } }); }
        }
        if (Math.abs(p.z - q.z) < 1e-8 && [bounds.minZ, bounds.maxZ].some(z => Math.abs(z - p.z) < 1e-8) && p.x !== q.x) {
          for (const x of gridX) { const t = (x - p.x) / (q.x - p.x); if (t > 1e-10 && t < 1 - 1e-10) cuts.push({ t, p: { x, z: p.z } }); }
        }
        cuts.sort((u, v) => u.t - v.t); out.push(...cuts.map(c => c.p));
      }
      return out;
    };
    let inside: Point[] = [a, b, c];
    for (const [axis, bound, sign] of planes) {
      emit(boundaryCuts(clipPolygon(inside, axis, bound, -sign)));
      inside = clipPolygon(inside, axis, bound, sign);
      if (inside.length < 3) break;
    }
    if (inside.length < 3) continue;
    const x0 = Math.max(0, Math.floor((Math.min(...inside.map(p => p.x)) - bounds.minX) / step));
    const x1 = Math.min(cells - 1, Math.floor((Math.max(...inside.map(p => p.x)) - bounds.minX) / step));
    const z0 = Math.max(0, Math.floor((Math.min(...inside.map(p => p.z)) - bounds.minZ) / step));
    const z1 = Math.min(cells - 1, Math.floor((Math.max(...inside.map(p => p.z)) - bounds.minZ) / step));
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      if (++work > 2000000) throw Error('Footing detail exceeds bounded mesh budget');
      let cell = clipPolygon(inside, 'x', gridX[x], 1);
      cell = clipPolygon(cell, 'x', gridX[x + 1], -1);
      cell = clipPolygon(cell, 'z', gridZ[z], 1);
      cell = clipPolygon(cell, 'z', gridZ[z + 1], -1);
      emit(cell);
    }
  }

  const positions = new Float32Array(vertices.length * 3), colors = new Float32Array(vertices.length * 3), normals = new Float32Array(vertices.length * 3);
  vertices.forEach((v, i) => { positions.set([v.x - origin.x, v.y, v.z - origin.z], i * 3); colors.set(v.color, i * 3); });
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i] * 3, b = indices[i + 1] * 3, c = indices[i + 2] * 3;
    const ux = positions[b] - positions[a], uy = positions[b + 1] - positions[a + 1], uz = positions[b + 2] - positions[a + 2];
    const vx = positions[c] - positions[a], vy = positions[c + 1] - positions[a + 1], vz = positions[c + 2] - positions[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const vertex of [a, b, c]) { normals[vertex] += nx; normals[vertex + 1] += ny; normals[vertex + 2] += nz; }
  }
  for (let i = 0; i < normals.length; i += 3) {
    const vertex = vertices[i / 3];
    const radius = Math.max(Math.abs(vertex.x - detail.centerX), Math.abs(vertex.z - detail.centerZ));
    // Unchanged land keeps its original shading too. Within the canonical
    // core, sample its continuous slope so long transition faces cannot bias
    // the near-foot normal. The annulus uses the actual blended mesh faces.
    if (radius >= detail.outerRadius || (i / 3 < count && !topVertices.has(i / 3))) { normals.set(vertex.normal, i); continue; }
    if (radius < detail.innerRadius) {
      const h = Math.min(.05, detail.maxEdgeM / 4);
      const dx = detail.heightAt(vertex.x + h, vertex.z) - detail.heightAt(vertex.x - h, vertex.z);
      const dz = detail.heightAt(vertex.x, vertex.z + h) - detail.heightAt(vertex.x, vertex.z - h);
      if (!Number.isFinite(dx) || !Number.isFinite(dz)) throw Error('Nonfinite canonical footing normal');
      normals.set([-dx, h * 2, -dz], i);
    }
    const length = Math.hypot(normals[i], normals[i + 1], normals[i + 2]) || 1;
    normals[i] /= length; normals[i + 1] /= length; normals[i + 2] /= length;
  }
  return { ...mesh, positions, colors, normals, indices: new Uint32Array(indices) };
}

/**
 * THE DRAWN GROUND OVER A GROUND EDIT (agora-257c, 2026-10-29, GG-533). A spell
 * or a tool cuts its shape into the world's one ground (groundRecord.ts), whose
 * grid holds a value every 1.524 m. The drawn terrain holds one every 8 m, so a
 * 3 m hole fell between its vertices and did not show. The fix reuses the
 * footing patch: the coarse faces are cut into a finer grid over the edit's box,
 * whose heights come from the ground itself, and they ease back to the coarse
 * faces over GROUND_EDIT_BLEND_M past the box. The ground grid stays the only
 * height source, so the land drawn, the land walked and the river's bed agree.
 */
/** How far past an edit's box the drawn ground eases back to the coarse faces, m: one coarse lattice step, so the ease ends where no coarse face reaches a vertex inside the box. */
export const GROUND_EDIT_BLEND_M = 8;

/** The footing-style patch that draws one edited box from the ground (`heightAt`), at most `maxEdgeM` per triangle edge. */
export function groundEditDetail(
  box: { x0: number; z0: number; x1: number; z1: number }, maxEdgeM: number,
  heightAt: (xM: number, zM: number) => number,
): TerrainFootingDetail {
  const innerRadius = Math.max(box.x1 - box.x0, box.z1 - box.z0) / 2;
  return {
    centerX: (box.x0 + box.x1) / 2, centerZ: (box.z0 + box.z1) / 2,
    innerRadius, outerRadius: innerRadius + GROUND_EDIT_BLEND_M, maxEdgeM, heightAt,
  };
}

/** Refine one chunk's mesh for several patches in order (the player's footing, then each edit). */
export function refineTerrainForDetails(mesh: TerrainMesh, origin: Point, details: readonly TerrainFootingDetail[]): TerrainMesh {
  let out = mesh;
  for (const detail of details) out = refineTerrainForFooting(out, origin, detail);
  return out;
}
