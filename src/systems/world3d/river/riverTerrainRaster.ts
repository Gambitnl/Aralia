/** Samples the rock triangles actually drawn in the waterfall landscape.
 * Native river water needs a bed everywhere it can flow, including shoulders
 * and the basin. This upper-surface adapter cannot represent an overhang's
 * underside or two separate water layers; those remain explicit model limits.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 16/10/2026, 07:56:21
 * Dependents: systems/world3d/river/riverTerrainCourse.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { RiverSolverGrid } from './riverSolver';
import type { RiverSpillFace } from './riverSpillTransfer';
import { riverCellX, riverMinimumSpacing } from './riverRectGrid';

type Triangle = { x: number[]; y: number[]; z: number[]; determinant: number };
export function rasterizeRiverTerrain(positions: ArrayLike<number>, grid: RiverSolverGrid) {
  if (positions.length % 9 || !Number.isFinite(grid.dx) || !(grid.dx > 0) || !Number.isInteger(grid.nx) || !Number.isInteger(grid.nz) || grid.nx<1 || grid.nz<1 || !Number.isFinite(grid.x0) || !Number.isFinite(grid.z0)) throw Error('Invalid native terrain mesh/grid');
  riverMinimumSpacing(grid);
  const triangles: Triangle[] = [], bins = new Map<string, number[]>(), binSize = Math.max(2, grid.dx * 4);
  const key = (x: number, z: number) => `${Math.floor(x / binSize)}:${Math.floor(z / binSize)}`;
  for (let k = 0; k < positions.length; k += 9) {
    const x = [positions[k], positions[k + 3], positions[k + 6]], y = [positions[k + 1], positions[k + 4], positions[k + 7]], z = [positions[k + 2], positions[k + 5], positions[k + 8]];
    if (![...x, ...y, ...z].every(Number.isFinite)) throw Error('Nonfinite native terrain triangle');
    const determinant = (z[1] - z[2]) * (x[0] - x[2]) + (x[2] - x[1]) * (z[0] - z[2]);
    // Vertical cliff sides have no horizontal area. Their upper edges still
    // appear as discontinuities between the neighboring supported triangles.
    if (Math.abs(determinant) < 1e-12) continue;
    const id = triangles.length; triangles.push({ x, y, z, determinant });
    for (let j = Math.floor(Math.min(...z) / binSize); j <= Math.floor(Math.max(...z) / binSize); j++) for (let i = Math.floor(Math.min(...x) / binSize); i <= Math.floor(Math.max(...x) / binSize); i++) {
      const bin = `${i}:${j}`; if (!bins.has(bin)) bins.set(bin, []); bins.get(bin)!.push(id);
    }
  }
  const heightAt = (x: number, z: number): number | null => {
    let height = -Infinity;
    for (const id of bins.get(key(x, z)) ?? []) {
      const t = triangles[id];
      const a = ((t.z[1] - t.z[2]) * (x - t.x[2]) + (t.x[2] - t.x[1]) * (z - t.z[2])) / t.determinant;
      const b = ((t.z[2] - t.z[0]) * (x - t.x[2]) + (t.x[0] - t.x[2]) * (z - t.z[2])) / t.determinant;
      if (a >= -1e-9 && b >= -1e-9 && a + b <= 1 + 1e-9) height = Math.max(height, a * t.y[0] + b * t.y[1] + (1 - a - b) * t.y[2]);
    }
    return height === -Infinity ? null : height;
  };
  const n = grid.nx * grid.nz, bed = new Float64Array(n), spillFaces: RiverSpillFace[] = [];
  const point = (c: number) => [riverCellX(grid,c%grid.nx), grid.z0 + (Math.floor(c / grid.nx) + .5) * grid.dx];
  for (let c = 0; c < n; c++) { const [x,z] = point(c), h = heightAt(x,z); if (h === null) throw Error(`Native terrain uncovered cell ${c}`); bed[c] = h; }
  function exposed(a: number, b: number): boolean {
    const [x,z] = point(a), [xx,zz] = point(b), dx = xx-x, dz = zz-z, candidates = new Set<number>();
    for (const [px,pz] of [[x,z],[xx,zz],[(x+xx)/2,(z+zz)/2]]) for (const id of bins.get(key(px,pz)) ?? []) candidates.add(id);
    // Test real triangle boundaries, not a bed-drop threshold. Otherwise a
    // continuous steep incline would become a staircase of artificial falls.
    for (const id of candidates) { const tri = triangles[id]; for (let e = 0; e < 3; e++) {
      const next = (e+1)%3, ex = tri.x[next]-tri.x[e], ez = tri.z[next]-tri.z[e], det = dx*ez-dz*ex;
      if (Math.abs(det) < 1e-12) continue;
      const rx = tri.x[e]-x, rz = tri.z[e]-z, t = (rx*ez-rz*ex)/det, u = (rx*dz-rz*dx)/det;
      // A cliff may pass exactly through a cell center. Its uppermost height
      // still belongs to the high donor, so include endpoint intersections.
      if (t < -1e-9 || t > 1+1e-9 || u < -1e-9 || u > 1+1e-9) continue;
      const epsilon = 1e-5 / Math.hypot(dx,dz);
      const before = heightAt(x+(t-epsilon)*dx,z+(t-epsilon)*dz), after = heightAt(x+(t+epsilon)*dx,z+(t+epsilon)*dz);
      if (before !== null && after !== null && Math.abs(before-after) > .35) return true;
    }}
    return false;
  }
  for (let j = 0; j < grid.nz; j++) for (let i = 0; i < grid.nx; i++) {
    const a = j*grid.nx+i;
    for (const [b,axis] of [[i+1<grid.nx?a+1:-1,'x'],[j+1<grid.nz?a+grid.nx:-1,'z']] as const) if (b >= 0 && Math.abs(bed[a]-bed[b]) > .35 && exposed(a,b)) spillFaces.push({from:bed[a]>bed[b]?a:b,to:bed[a]>bed[b]?b:a,axis});
  }
  return { bed, spillFaces, heightAt, triangleCount: triangles.length };
}
