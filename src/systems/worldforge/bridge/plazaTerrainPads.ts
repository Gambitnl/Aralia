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
  /** The pad's plane, so a later pass can read its exact height anywhere:
   * encoded height = mean + gxPerM (x - cxM) + gzPerM (z - czM), meters. */
  plane: { cxM: number; czM: number; mean: number; gxPerM: number; gzPerM: number };
}

/** A pad to grade. `maxGradeDeg` overrides the call's limit for this pad
 * (GG-614: a churchyard is graded gentler than its natural fall, not flat). */
export interface PlazaPadInput { pointsM: readonly PlazaPoint[]; maxGradeDeg?: number }

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
  plazas: ReadonlyArray<PlazaPadInput>,
  maxGradeDeg = PLAZA_MAX_GRADE_DEG,
): Array<PlazaPadReceipt | undefined> {
  // One receipt per input pad, in order; a pad too small to grade has none.
  const receipts: Array<PlazaPadReceipt | undefined> = [];
  const graded = new Set<number>();
  const skirts = new Map<number, number[]>();
  for (const plaza of plazas) {
    const poly = plaza.pointsM;
    const maxSlope = Math.tan(((plaza.maxGradeDeg ?? maxGradeDeg) * Math.PI) / 180) * ENCODED_PER_M;
    if (poly.length < 3) { receipts.push(undefined); continue; }
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
    if (nodes.length < 3) { receipts.push(undefined); continue; }
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
    receipts.push({
      nodes: nodes.length, naturalGradeDeg: toDeg(natural), gradeDeg: toDeg(Math.hypot(gx, gz)),
      plane: { cxM: cx * cellM, czM: cz * cellM, mean, gxPerM: gx, gzPerM: gz },
    });
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

// ── GG-613: retaining walls and street ramps at pad edges ───────────────────

/** A pad edge that steps more than this (meters) gets a retaining wall.
 * 4 ft is the height above which building codes (IBC 1807.2) want an
 * engineered retaining wall rather than a graded bank. Across the two-cell
 * skirt it is a bank of about 22 degrees, near the steepest grass bank that
 * can still be mowed (about 2.5 to 1); a higher step reads as a raw cliff. */
export const PAD_WALL_STEP_M = 1.2;
/** The steepest a street may climb to reach a raised or sunken pad: 1 in 8,
 * the usual limit for a street that carts use. */
export const PAD_RAMP_GRADE = 1 / 8;
/** How far the wall stands above the higher ground: a low parapet (meters). */
const PAD_WALL_PARAPET_M = 0.4;
/** How far the wall footing sinks below the lower ground (meters). */
const PAD_WALL_FOOTING_M = 0.3;
/** Half the wall's thickness (meters). It stands across the pad edge, so it
 * hides the one-cell ramp the height grid makes between pad and ground. */
export const PAD_WALL_HALF_WIDTH_M = 1;

export interface PadEdgeStreet { points: ReadonlyArray<PlazaPoint>; widthM: number }

/** One retaining wall run, in ground meters, with its own top and base. */
export interface PadWallRun {
  points: Array<{ x: number; z: number }>;
  /** World height of the wall top at each point (meters). */
  topY: number[];
  /** World height of the wall base at each point (meters). */
  baseY: number[];
}

export interface PadEdgeReceipt {
  walls: PadWallRun[];
  /** Meters of pad edge sampled, and of that, meters walled. */
  edgeM: number;
  walledM: number;
  /** Street entries that step more than PAD_WALL_STEP_M and got a ramp. */
  rampedEntries: number;
}

const segDist = (p: PlazaPoint, a: PlazaPoint, b: PlazaPoint): number => {
  const vx = b.x - a.x, vz = b.z - a.z, L = vx * vx + vz * vz;
  const t = L > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.z - a.z) * vz) / L)) : 0;
  return Math.hypot(p.x - a.x - vx * t, p.z - a.z - vz * t);
};

/**
 * Retain the graded pads' edges (GG-613). Run after `gradePlazaTerrainPads`
 * and before the building pads, on the same encoded grid.
 *
 * Every pad edge is walked in 1 m steps. At each step the pad's own plane
 * height is set against the natural ground one cell outside it.
 * - Where a street meets the edge (within its half width plus 1 m), there is
 *   no wall. If the step there is more than PAD_WALL_STEP_M, the street's
 *   ground outside the pad is graded as a ramp of PAD_RAMP_GRADE from the
 *   pad edge down (or up) to the natural ground.
 * - Elsewhere a step of more than PAD_WALL_STEP_M is walled: consecutive
 *   steps make one run, with its top a parapet above the higher ground and
 *   its base a footing below the lower ground. The skirt blend beside a wall
 *   is undone, so the ground steps under the wall instead of making a ledge.
 * - Where the outside point lies in another pad (a forecourt against its
 *   churchyard), the two pads meet and nothing is built.
 *
 * `natural` is the height grid before any pad was graded. Mutates `heights`.
 * Deterministic: pads, edges and streets are read in their given order.
 */
export function retainPadEdges(
  heights: number[],
  natural: readonly number[],
  cols: number,
  rows: number,
  cellM: number,
  pads: ReadonlyArray<PlazaPadInput>,
  receipts: ReadonlyArray<PlazaPadReceipt | undefined>,
  streets: ReadonlyArray<PadEdgeStreet>,
): PadEdgeReceipt {
  const toM = (encoded: number) => encoded / ENCODED_PER_M;
  const nodeAt = (grid: readonly number[], x: number, z: number): number => {
    // Bilinear read of an encoded grid at ground meters.
    const gx = Math.max(0, Math.min(cols - 1, x / cellM)), gz = Math.max(0, Math.min(rows - 1, z / cellM));
    const c0 = Math.floor(gx), r0 = Math.floor(gz), c1 = Math.min(cols - 1, c0 + 1), r1 = Math.min(rows - 1, r0 + 1);
    const fx = gx - c0, fz = gz - r0;
    const h = (c: number, r: number) => grid[r * cols + c];
    return (h(c0, r0) * (1 - fx) + h(c1, r0) * fx) * (1 - fz) + (h(c0, r1) * (1 - fx) + h(c1, r1) * fx) * fz;
  };
  const inAnyPad = (p: PlazaPoint, except: number): boolean =>
    pads.some((pad, i) => i !== except && pad.pointsM.length >= 3 && insidePolygon(p.x, p.z, pad.pointsM));
  const nearStreet = (p: PlazaPoint): PadEdgeStreet | undefined => streets.find((s) => {
    for (let i = 1; i < s.points.length; i++) if (segDist(p, s.points[i - 1], s.points[i]) <= s.widthM / 2 + 1) return true;
    return false;
  });
  const walls: PadWallRun[] = [];
  const keepNatural = new Set<number>();
  /** Outside nodes under a walled edge that take the pad's own height. */
  const extendPad = new Map<number, number>();
  const ramps: Array<{ pad: number; street: PadEdgeStreet; edge: PlazaPoint; stepM: number }> = [];
  let edgeM = 0, walledM = 0;
  pads.forEach((pad, pi) => {
    const plane = receipts[pi]?.plane;
    const poly = pad.pointsM;
    if (!plane || poly.length < 3) return;
    const padY = (p: PlazaPoint) => toM(plane.mean + plane.gxPerM * (p.x - plane.cxM) + plane.gzPerM * (p.z - plane.czM));
    let run: { pts: PlazaPoint[]; top: number[]; base: number[] } | null = null;
    let rampOpen = false;
    const flush = () => {
      if (run && run.pts.length >= 3) walls.push({ points: run.pts.map((p) => ({ x: p.x, z: p.z })), topY: run.top, baseY: run.base });
      run = null;
    };
    // Walk the closed ring; a run that wraps past the first point continues.
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const L = Math.hypot(b.x - a.x, b.z - a.z);
      if (L < 1e-6) continue;
      // Outward normal: the side whose test point lies outside the pad.
      let nx = -(b.z - a.z) / L, nz = (b.x - a.x) / L;
      const mid = { x: (a.x + b.x) / 2 + nx * 0.1, z: (a.z + b.z) / 2 + nz * 0.1 };
      if (insidePolygon(mid.x, mid.z, poly)) { nx = -nx; nz = -nz; }
      for (let s = 0.5; s < L; s += 1) {
        const p = { x: a.x + ((b.x - a.x) * s) / L, z: a.z + ((b.z - a.z) * s) / L };
        const out = { x: p.x + nx * cellM, z: p.z + nz * cellM };
        edgeM += 1;
        if (inAnyPad(out, pi)) { flush(); rampOpen = false; continue; }
        // The step is judged two cells out, across the whole blended skirt.
        const hIn = padY(p), hOut = toM(nodeAt(natural, p.x + nx * cellM * 2, p.z + nz * cellM * 2));
        const step = Math.abs(hIn - hOut);
        const street = nearStreet(p);
        if (street) {
          flush();
          if (step > PAD_WALL_STEP_M && !rampOpen) ramps.push({ pad: pi, street, edge: p, stepM: hIn - hOut });
          rampOpen = step > PAD_WALL_STEP_M;
          continue;
        }
        rampOpen = false;
        if (step <= PAD_WALL_STEP_M) { flush(); continue; }
        walledM += 1;
        // The pad stays level right up to its edge: the nodes within one cell
        // outside take the pad's height, so the grid's one-cell step falls a
        // cell out (a grave or stall on the edge stands on the pad). The wall
        // stands over that step, one cell out, and the nodes past it keep
        // their natural height, so the ground steps under the wall instead of
        // making a ledge.
        const wallAt = { x: p.x + nx * cellM, z: p.z + nz * cellM };
        const outY = toM(nodeAt(natural, p.x + nx * cellM * 2, p.z + nz * cellM * 2));
        run ??= { pts: [], top: [], base: [] };
        run.pts.push(wallAt);
        run.top.push(Math.max(hIn, outY) + PAD_WALL_PARAPET_M);
        run.base.push(Math.min(hIn, outY) - PAD_WALL_FOOTING_M);
        const c0 = Math.floor(p.x / cellM), r0 = Math.floor(p.z / cellM);
        for (let r = r0 - 2; r <= r0 + 3; r++) for (let c = c0 - 2; c <= c0 + 3; c++) {
          if (c < 0 || c >= cols || r < 0 || r >= rows) continue;
          const q = { x: c * cellM, z: r * cellM };
          if (insidePolygon(q.x, q.z, poly) || inAnyPad(q, pi)) continue;
          // How far out along the edge normal, and how far along the edge.
          const outward = (q.x - p.x) * nx + (q.z - p.z) * nz, along = Math.abs((q.x - p.x) * -nz + (q.z - p.z) * nx);
          if (outward <= 0 || along > 0.75) continue;
          if (outward <= cellM) extendPad.set(r * cols + c, plane.mean + plane.gxPerM * (q.x - plane.cxM) + plane.gzPerM * (q.z - plane.czM));
          else if (outward <= cellM * 2.2) keepNatural.add(r * cols + c);
        }
      }
    }
    flush();
  });
  for (const index of keepNatural) if (!extendPad.has(index)) heights[index] = natural[index];
  for (const [index, h] of extendPad) heights[index] = h;
  // Ramps: the ground of every street beside a pad (within its half width
  // plus one cell of its line, outside every pad) takes up the step the pad
  // made at its nearest edge point, and lets it out linearly over the step
  // divided by PAD_RAMP_GRADE. So the pad adds at most 1 in 8 to the street's
  // own grade; on ground gentler than that the whole approach stays gentle.
  // One continuous rule: where the pad steps little it changes little, and a
  // street that runs along an edge never jumps where the step changes.
  let rampedEntries = 0;
  const stepped = new Set(ramps.map((r) => `${r.pad}|${streets.indexOf(r.street)}`));
  pads.forEach((pad, pi) => {
    const plane = receipts[pi]?.plane;
    const poly = pad.pointsM;
    if (!plane || poly.length < 3) return;
    const xs = poly.map((p) => p.x), zs = poly.map((p) => p.z);
    // The farthest a ramp can reach: the pad's largest step at this grade.
    const reach = 4 / PAD_RAMP_GRADE;
    const c0 = Math.max(0, Math.floor((Math.min(...xs) - reach) / cellM)), c1 = Math.min(cols - 1, Math.ceil((Math.max(...xs) + reach) / cellM));
    const r0 = Math.max(0, Math.floor((Math.min(...zs) - reach) / cellM)), r1 = Math.min(rows - 1, Math.ceil((Math.max(...zs) + reach) / cellM));
    streets.forEach((street, si) => {
      let touched = false;
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
        const index = r * cols + c;
        const q = { x: c * cellM, z: r * cellM };
        let onStreet = false;
        for (let i = 1; i < street.points.length && !onStreet; i++) onStreet = segDist(q, street.points[i - 1], street.points[i]) <= street.widthM / 2 + cellM;
        if (!onStreet || insidePolygon(q.x, q.z, poly) || inAnyPad(q, pi)) continue;
        // Distance to the pad edge, and the pad height at the nearest edge point.
        let best = Infinity, ex = q.x, ez = q.z;
        for (let i = 0; i < poly.length; i++) {
          const a = poly[i], b = poly[(i + 1) % poly.length];
          const vx = b.x - a.x, vz = b.z - a.z, L2 = vx * vx + vz * vz;
          const tt = L2 > 0 ? Math.max(0, Math.min(1, ((q.x - a.x) * vx + (q.z - a.z) * vz) / L2)) : 0;
          const d = Math.hypot(q.x - (a.x + vx * tt), q.z - (a.z + vz * tt));
          if (d < best) { best = d; ex = a.x + vx * tt; ez = a.z + vz * tt; }
        }
        if (best > reach) continue;
        const edgeH = plane.mean + plane.gxPerM * (ex - plane.cxM) + plane.gzPerM * (ez - plane.czM);
        const offset = edgeH - nodeAt(natural, ex, ez);
        const lengthM = Math.abs(offset) / ENCODED_PER_M / PAD_RAMP_GRADE;
        if (best >= lengthM) continue;
        const target = natural[index] + offset * (1 - best / lengthM);
        heights[index] = target;
        touched = true;
      }
      if (touched && stepped.has(`${pi}|${si}`)) rampedEntries++;
    });
  });
  return { walls, edgeM, walledM, rampedEntries };
}
