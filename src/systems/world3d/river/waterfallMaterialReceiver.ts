/**
 * Shares an already resolved horizontal water crossing among its actual grid
 * overlaps. This does not find collisions or choose a landing from a centroid.
 * Callers supply nonoverlapping triangles with uniform volume per area and
 * linear vertex velocities. Convex polygons can be supplied as a triangle fan.
 * Momentum omits density to match RiverFlowSolver; spatial moments retain the
 * resolved footprint even though the receiving solver stores cell averages.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 11/10/2026, 16:51:07
 * Dependents: None (Orphan)
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { RiverFlowSolver, RiverSolverGrid } from './riverSolver';
import { WATER_REACH_LAW } from './waterfallMaterialReach';

export type ReceiverVector = readonly [number, number, number];
export interface ReceiverVertex { position: ReceiverVector; velocity: ReceiverVector }
export interface ReceiverTriangle {
  sourceId: string;
  vertices: readonly [ReceiverVertex, ReceiverVertex, ReceiverVertex];
  volume: number;
}
export interface ReceiverShare {
  sourceId: string;
  volume: number;
  /** Integral of velocity times volume, m^4/s; multiply by water density
   * (kg/m^3) for SI momentum (kg m/s). Solver batches use this omitted-density form. */
  momentum: [number, number, number];
  /** Integral of position times volume, m^4; divide by volume for the centroid.
   * Density is omitted, consistently with the solver's volume inventory. */
  spatialMoment: [number, number, number];
  centroid: [number, number, number];
  /** Resolved incoming kinetic energy in Joules, using WATER_REACH_LAW.density. */
  kineticEnergy: number;
}
export interface ReceiverHit extends ReceiverShare { c: number }
export interface MaterialReceiverStencil {
  hits: ReceiverHit[];
  outside: ReceiverShare[];
  ineligible: ReceiverShare[];
  bypass: ReceiverShare[];
}
export interface MaterialReceiverOptions {
  grid: RiverSolverGrid;
  /** Hard bound on visited cell intersections, including rejected cells. */
  maxCells: number;
  classifyCell(c: number): 'hit' | 'ineligible' | 'bypass';
}

// Edge clipping interpolates velocity together with position. A linear field
// therefore keeps its exact momentum and kinetic integral after subdivision.
function clip(poly: ReceiverVertex[], axis: 0 | 2, bound: number, greater: boolean): ReceiverVertex[] {
  const result: ReceiverVertex[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const insideA = greater ? a.position[axis] >= bound : a.position[axis] <= bound;
    const insideB = greater ? b.position[axis] >= bound : b.position[axis] <= bound;
    if (insideA) result.push(a);
    if (insideA !== insideB) {
      const t = (bound - a.position[axis]) / (b.position[axis] - a.position[axis]);
      result.push({ position: a.position.map((p, k) => p + t * (b.position[k] - p)) as [number, number, number],
        velocity: a.velocity.map((v, k) => v + t * (b.velocity[k] - v)) as [number, number, number] });
    }
  }
  return result;
}
function integrate(poly: ReceiverVertex[], sourceId: string, densityPerArea: number): ReceiverShare | null {
  let area = 0, kineticEnergy = 0;
  const momentum: [number, number, number] = [0, 0, 0], spatialMoment: [number, number, number] = [0, 0, 0];
  for (let i = 1; i + 1 < poly.length; i++) {
    const triangle = [poly[0], poly[i], poly[i + 1]], [a, b, c] = triangle.map(v => v.position);
    const weight = Math.abs((b[0] - a[0]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[0] - a[0])) * .5 * densityPerArea;
    area += weight;
    for (let k = 0; k < 3; k++) {
      const velocities = triangle.map(v => v.velocity[k]);
      momentum[k] += weight * velocities.reduce((s, v) => s + v, 0) / 3;
      spatialMoment[k] += weight * triangle.reduce((s, v) => s + v.position[k], 0) / 3;
      // Barycentric squared weights integrate to 1/6 and pair products to
      // 1/12. This is resolved incoming motion, not invented breakup heat.
      kineticEnergy += WATER_REACH_LAW.density * weight * (velocities.reduce((s, v) => s + v * v, 0)
        + velocities[0] * velocities[1] + velocities[0] * velocities[2] + velocities[1] * velocities[2]) / 12;
    }
  }
  if (!(area > 0)) return null;
  const centroid = spatialMoment.map(v => v / area) as [number, number, number];
  if (![area, kineticEnergy, ...momentum, ...spatialMoment, ...centroid].every(Number.isFinite)) throw Error('Receiver integral overflow');
  return { sourceId, volume: area, momentum, spatialMoment, centroid, kineticEnergy };
}

/** Missing and declined overlaps keep their original shares. There is no
 * nearest-wet search, extrapolation, or renormalization onto surviving cells. */
export function buildMaterialReceiverStencil(triangles: readonly ReceiverTriangle[], options: MaterialReceiverOptions): MaterialReceiverStencil {
  const { grid: g, maxCells } = options;
  if (!Number.isSafeInteger(maxCells) || maxCells < 1 || !Number.isSafeInteger(g.nx) || !Number.isSafeInteger(g.nz)
    || g.nx < 1 || g.nz < 1 || !(g.dx > 0) || ![g.dx, g.x0, g.z0, g.x0 + g.nx * g.dx, g.z0 + g.nz * g.dx].every(Number.isFinite)) throw Error('Invalid receiver capacity or grid');
  const result: MaterialReceiverStencil = { hits: [], outside: [], ineligible: [], bypass: [] };
  let visited = 0;
  for (const triangle of triangles) {
    const vertices = triangle.vertices;
    if (!triangle.sourceId.trim() || vertices.length !== 3 || !(triangle.volume > 0) || !Number.isFinite(triangle.volume)
      || vertices.some(v => v.position.length !== 3 || v.velocity.length !== 3 || ![...v.position, ...v.velocity].every(Number.isFinite))
      || vertices.some(v => v.position[1] !== vertices[0].position[1])) throw Error('Receiver requires a finite horizontal crossing triangle');
    const full = integrate([...vertices], triangle.sourceId, 1);
    if (!full) throw Error('Degenerate receiver footprint');
    const density = triangle.volume / full.volume;
    if (!Number.isFinite(density)) throw Error('Receiver volume per area overflow');
    let inside = [...vertices];
    // Remove four disjoint exterior strips in order, retaining each integral.
    for (const [axis, bound, greater] of [[0, g.x0, true], [0, g.x0 + g.nx * g.dx, false], [2, g.z0, true], [2, g.z0 + g.nz * g.dx, false]] as const) {
      const exterior = integrate(clip(inside, axis, bound, !greater), triangle.sourceId, density);
      if (exterior) result.outside.push(exterior);
      inside = clip(inside, axis, bound, greater);
    }
    if (inside.length < 3) continue;
    const xs = inside.map(v => v.position[0]), zs = inside.map(v => v.position[2]);
    const i0 = Math.max(0, Math.floor((Math.min(...xs) - g.x0) / g.dx)), i1 = Math.min(g.nx - 1, Math.floor((Math.max(...xs) - g.x0) / g.dx));
    const j0 = Math.max(0, Math.floor((Math.min(...zs) - g.z0) / g.dx)), j1 = Math.min(g.nz - 1, Math.floor((Math.max(...zs) - g.z0) / g.dx));
    if (visited + (i1 - i0 + 1) * (j1 - j0 + 1) > maxCells) throw Error('Receiver cell capacity exceeded; source ownership retained');
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      visited++;
      let poly = clip(inside, 0, g.x0 + i * g.dx, true);
      poly = clip(poly, 0, g.x0 + (i + 1) * g.dx, false);
      poly = clip(poly, 2, g.z0 + j * g.dx, true);
      poly = clip(poly, 2, g.z0 + (j + 1) * g.dx, false);
      const share = integrate(poly, triangle.sourceId, density);
      if (!share) continue;
      const c = j * g.nx + i, kind = options.classifyCell(c);
      if (kind === 'hit') result.hits.push({ ...share, c });
      else if (kind === 'ineligible' || kind === 'bypass') result[kind].push(share);
      else throw Error('Invalid receiver classification');
    }
  }
  return result;
}

export interface MaterialReceiverReceipt {
  transactionId: string;
  stencil: MaterialReceiverStencil;
  /** Receiving bed/environment takes this volume-weighted vertical impulse,
   * m^4/s. Multiply by WATER_REACH_LAW.density for SI impulse (N s) before
   * applying it to an owner that accounts for physical mass. */
  verticalImpulse: number;
  energyQualification: 'kinetic-mixing-and-surface-energy-unqualified';
}

/** Bounded admission ledger. Preparing and aborting never debit the source.
 * A successful commit is the sole authorization to debit its acknowledged hit
 * shares; outside/ineligible/bypass water remains with the original owner.
 * Completed identities are never evicted to make room for duplicate transfers.
 */
export class MaterialReceiverAdapter {
  private readonly prepared = new Map<string, MaterialReceiverStencil>();
  private readonly completed = new Set<string>();
  constructor(private readonly solver: RiverFlowSolver, private readonly maxTransactions: number) {
    if (!Number.isSafeInteger(maxTransactions) || maxTransactions < 1) throw Error('Invalid receiver transaction capacity');
  }
  prepare(id: string, triangles: readonly ReceiverTriangle[], maxCells: number,
    classifyCell: MaterialReceiverOptions['classifyCell'] = c => this.solver.canDepositWater(c) ? 'hit' : 'ineligible'): MaterialReceiverStencil {
    if (!id.trim() || this.prepared.has(id) || this.completed.has(id)) throw Error('Duplicate receiver transaction');
    if (this.prepared.size + this.completed.size >= this.maxTransactions) throw Error('Receiver transaction capacity exceeded');
    const stencil = buildMaterialReceiverStencil(triangles, { grid: this.solver.grid, maxCells, classifyCell });
    this.prepared.set(id, structuredClone(stencil));
    return stencil;
  }
  abort(id: string): boolean { return this.prepared.delete(id); }
  commit(id: string): MaterialReceiverReceipt | null {
    const stencil = this.prepared.get(id);
    if (!stencil) throw Error('Unknown or completed receiver transaction');
    if (stencil.hits.length && !this.solver.depositWaterBatch(stencil.hits)) return null;
    this.prepared.delete(id); this.completed.add(id);
    return { transactionId: id, stencil, verticalImpulse: stencil.hits.reduce((s, hit) => s + hit.momentum[1], 0),
      energyQualification: 'kinetic-mixing-and-surface-energy-unqualified' };
  }
}
