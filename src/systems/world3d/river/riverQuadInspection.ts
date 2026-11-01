/**
 * Copies one native water quad for diagnosis without changing water or terrain.
 * The view supplies its existing CPU arrays. This never builds geometry, samples
 * the GPU, or certifies that an installed snapshot has reached the screen.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 10/10/2026, 03:46:22
 * Dependents: components/World3D/water/riverReachScene.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { RiverGridSpec } from './riverReach';

export interface QuadGeometrySource {
  pos: ArrayLike<number>;
  index: ArrayLike<number> | null;
}
export interface QuadSnapshotCertificate {
  simTime: number;
  application: number;
  kind: 'applyFlowSnapshot-returned-successfully';
}
interface QuadInspectionSource {
  grid: RiverGridSpec;
  h: ArrayLike<number>;
  ground: ArrayLike<number>;
  surface: ArrayLike<number>;
  raw: QuadGeometrySource | null;
  installed: QuadGeometrySource | null;
  certificate: QuadSnapshotCertificate | null;
}

// A query has finite CPU and output costs, even if experimental refinement
// produces a huge sheet. An exhausted scan is reported rather than hidden.
const MAX_TRIANGLES_SCANNED = 500_000;
const MAX_TRIANGLES_RETURNED = 128;

function geometryInQuad(source: QuadGeometrySource | null, bounds: number[]) {
  if (!source) return { available: false, reason: 'CPU geometry unavailable', vertices: [], triangleIndices: [], sourceVertexIds: [], sourceTriangleIds: [], truncated: false, scannedTriangles: 0 };
  const vertices: number[] = [], triangleIndices: number[] = [], sourceVertexIds: number[] = [], sourceTriangleIds: number[] = [];
  const local = new Map<number, number>();
  const total = Math.floor((source.index?.length ?? source.pos.length / 3) / 3);
  let scannedTriangles = 0, truncated = false;
  for (let t = 0; t < Math.min(total, MAX_TRIANGLES_SCANNED); t += 1) {
    scannedTriangles += 1;
    const ids = [0, 1, 2].map(k => source.index ? source.index[t * 3 + k] : t * 3 + k);
    const xs = ids.map(id => source.pos[id * 3]), zs = ids.map(id => source.pos[id * 3 + 2]);
    // Strict overlap omits neighboring quads that only touch this boundary.
    // These are bounding-box candidates, not a claim of triangle containment.
    if (Math.max(...xs) <= bounds[0] || Math.min(...xs) >= bounds[2]
      || Math.max(...zs) <= bounds[1] || Math.min(...zs) >= bounds[3]) continue;
    if (sourceTriangleIds.length === MAX_TRIANGLES_RETURNED) { truncated = true; break; }
    sourceTriangleIds.push(t);
    for (const id of ids) {
      let n = local.get(id);
      if (n === undefined) {
        n = sourceVertexIds.length; local.set(id, n); sourceVertexIds.push(id);
        vertices.push(source.pos[id * 3], source.pos[id * 3 + 1], source.pos[id * 3 + 2]);
      }
      triangleIndices.push(n);
    }
  }
  truncated ||= scannedTriangles < total;
  return { available: true, vertices, triangleIndices, sourceVertexIds, sourceTriangleIds, truncated, scannedTriangles,
    selection: 'triangle bounding boxes strictly overlap quad; CPU positions before shader displacement' };
}

/** Reject the outer half-cell rim: there is no four-center quad there. */
export function inspectRiverQuad(source: QuadInspectionSource, x: number, z: number) {
  const { nx, nz, dx, x0, z0 } = source.grid;
  if (!Number.isFinite(x) || !Number.isFinite(z)) return { ok: false as const, reason: 'Coordinates must be finite' };
  const i = Math.floor((x - x0) / dx - 0.5), j = Math.floor((z - z0) / dx - 0.5);
  if (i < 0 || j < 0 || i >= nx - 1 || j >= nz - 1) return { ok: false as const, reason: 'Outside the four-cell-center quad domain' };
  const bounds = [x0 + (i + 0.5) * dx, z0 + (j + 0.5) * dx, x0 + (i + 1.5) * dx, z0 + (j + 1.5) * dx];
  const cells = [[i, j], [i + 1, j], [i, j + 1], [i + 1, j + 1]].map(([ci, cj]) => {
    const cellId = cj * nx + ci;
    const finite = (a: ArrayLike<number>) => Number.isFinite(a[cellId]) ? a[cellId] : null;
    return { cellId, i: ci, j: cj, center: [x0 + (ci + 0.5) * dx, z0 + (cj + 0.5) * dx],
      h: finite(source.h), ground: finite(source.ground), surface: finite(source.surface),
      availability: { h: finite(source.h) !== null, ground: finite(source.ground) !== null, surface: finite(source.surface) !== null } };
  });
  return { ok: true as const, x, z, grid: { ...source.grid }, bounds, cells,
    groundProvenance: 'Current view ground; bed patches may update it independently of the installed water snapshot',
    bed: null, bedAvailable: false, bedReason: 'Exact solver bed is not transferred to this view',
    raw: geometryInQuad(source.raw, bounds), installed: geometryInQuad(source.installed, bounds),
    installedSnapshot: source.certificate ? { ...source.certificate } : null,
    rendered: { certified: false, reason: 'CPU installation does not certify a completed rendered frame or shader displacement' },
    limits: { maxTrianglesScannedPerGeometry: MAX_TRIANGLES_SCANNED, maxTrianglesReturnedPerGeometry: MAX_TRIANGLES_RETURNED } };
}
