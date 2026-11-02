/**
 * @file plazaTerrainPads.ts - grades each paved town square to a gentle pad.
 *
 * GG-593. A market square or a civic forecourt is paving the bake lays on the
 * natural ground. On a hillside that ground can slope 11 to 18 degrees, and
 * the prop surface gate refuses a built prop above 10 degrees, so the square
 * showed none of its stalls. Building plots already get level pads
 * (`flattenBuildingTerrainPads`); this pure step gives each plaza a plane of
 * its own, fitted to the ground under it and held to a gentle grade.
 *
 * What it keeps: the plane passes through the mean height of the square, so
 * the cut and the fill balance and the square stays at its natural level. A
 * square already gentler than the limit keeps its own fall. Building pads run
 * after this step, so every house keeps its level footprint.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 02/11/2026, 21:55:43
 * Dependents: systems/worldforge/bridge/groundChunkLoader.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { metersToHeight } from '../../world3d/config';

/** The steepest grade a paved square keeps (degrees). Real hillside squares
 * fall a little (one in eleven here); 5 degrees stays well under the 10 degree
 * prop surface gate, so stalls and centerpieces stand anywhere on the paving. */
export const PLAZA_MAX_GRADE_DEG = 5;

/** Encoded height (0..100 domain) per meter of rise. */
const ENCODED_PER_M = metersToHeight(1);

interface PlazaPoint { x: number; z: number }

/** Even-odd test: a square can be concave (a ward polygon), not only a quad. */
function insidePolygon(px: number, pz: number, poly: readonly PlazaPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if (a.z > pz !== b.z > pz && px < ((b.x - a.x) * (pz - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}

export interface PlazaPadReceipt {
  /** Grid nodes the plaza covers. */
  nodes: number;
  /** The natural slope of the fitted plane before the limit (degrees). */
  naturalGradeDeg: number;
  /** The grade the pad keeps (degrees). */
  gradeDeg: number;
}

/**
 * Grade every plaza in place on the encoded height grid. The grid nodes sit
 * at `(col, row) * cellM`, which is where the continuous height query and the
 * rendered chunks read terrain. Plazas are graded in order; a node that an
 * earlier plaza already graded keeps its height, so the market square (the
 * first plaza) wins where a forecourt touches it. One ring of nodes round
 * each pad blends halfway toward it, as round a building pad.
 */
export function gradePlazaTerrainPads(
  heights: number[],
  cols: number,
  rows: number,
  cellM: number,
  plazas: ReadonlyArray<{ pointsM: readonly PlazaPoint[] }>,
  maxGradeDeg = PLAZA_MAX_GRADE_DEG,
): PlazaPadReceipt[] {
  const receipts: PlazaPadReceipt[] = [];
  const graded = new Set<number>();
  const skirts = new Map<number, number[]>();
  const maxSlope = Math.tan((maxGradeDeg * Math.PI) / 180) * ENCODED_PER_M;
  for (const plaza of plazas) {
    const poly = plaza.pointsM;
    if (poly.length < 3) continue;
    const xs = poly.map((p) => p.x), zs = poly.map((p) => p.z);
    const c0 = Math.max(0, Math.floor(Math.min(...xs) / cellM)), c1 = Math.min(cols - 1, Math.ceil(Math.max(...xs) / cellM));
    const r0 = Math.max(0, Math.floor(Math.min(...zs) / cellM)), r1 = Math.min(rows - 1, Math.ceil(Math.max(...zs) / cellM));
    const nodes: number[] = [];
    for (let row = r0; row <= r1; row++) {
      for (let col = c0; col <= c1; col++) {
        const index = row * cols + col;
        if (!graded.has(index) && insidePolygon(col * cellM, row * cellM, poly)) nodes.push(index);
      }
    }
    // A plane needs three nodes; a sliver smaller than that keeps its ground.
    if (nodes.length < 3) continue;
    // Least-squares plane h = mean + gx (x - cx) + gz (z - cz) over the nodes.
    let cx = 0, cz = 0, mean = 0;
    for (const index of nodes) { cx += index % cols; cz += Math.floor(index / cols); mean += heights[index]; }
    cx /= nodes.length; cz /= nodes.length; mean /= nodes.length;
    let sxx = 0, szz = 0, sxz = 0, sxh = 0, szh = 0;
    for (const index of nodes) {
      const dx = (index % cols - cx) * cellM, dz = (Math.floor(index / cols) - cz) * cellM, dh = heights[index] - mean;
      sxx += dx * dx; szz += dz * dz; sxz += dx * dz; sxh += dx * dh; szh += dz * dh;
    }
    const det = sxx * szz - sxz * sxz;
    // A single row of nodes has no second axis: hold it level.
    let gx = 0, gz = 0;
    if (Math.abs(det) > 1e-9) { gx = (sxh * szz - szh * sxz) / det; gz = (szh * sxx - sxh * sxz) / det; }
    const natural = Math.hypot(gx, gz);
    if (natural > maxSlope) { gx *= maxSlope / natural; gz *= maxSlope / natural; }
    const planeAt = (col: number, row: number) => mean + gx * (col - cx) * cellM + gz * (row - cz) * cellM;
    const inside = new Set(nodes);
    for (const index of nodes) {
      heights[index] = planeAt(index % cols, Math.floor(index / cols));
      graded.add(index);
    }
    for (const index of nodes) {
      const col = index % cols, row = Math.floor(index / cols);
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nc = col + dx, nr = row + dz;
          if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
          const n = nr * cols + nc;
          if (inside.has(n)) continue;
          const list = skirts.get(n) ?? [];
          list.push(planeAt(nc, nr));
          skirts.set(n, list);
        }
      }
    }
    const toDeg = (s: number) => (Math.atan(s / ENCODED_PER_M) * 180) / Math.PI;
    receipts.push({ nodes: nodes.length, naturalGradeDeg: toDeg(natural), gradeDeg: toDeg(Math.hypot(gx, gz)) });
  }
  // Skirts read the natural height of their own node; a node inside any pad
  // keeps the pad's height. Several pads that share a skirt node average.
  for (const [index, targets] of skirts) {
    if (graded.has(index)) continue;
    const target = targets.reduce((s, h) => s + h, 0) / targets.length;
    heights[index] += (target - heights[index]) * 0.5;
  }
  return receipts;
}
