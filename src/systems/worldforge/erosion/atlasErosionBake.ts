/**
 * @file atlasErosionBake.ts — one landscape-evolution run over the whole atlas.
 *
 * This file runs a macro-scale landscape evolution simulation across the world atlas.
 *
 * In procedural terrain generation, local window generators lack global hydrology context:
 * they cannot tell which valley drains a continental river basin and which carries a tiny trickle.
 * This file performs a single global landscape evolution pass over the atlas Voronoi graph.
 * Using priority-flood depression filling, multiple-flow-direction routing, stream power incision,
 * and threshold talus diffusion, it determines accumulated discharge and settled flow paths.
 *
 * Called by: generateRegion.ts, regionCompositeField.ts, and world forge pipelines.
 * Depends on: rockHardness.ts for rock strength and slope stability.
 */

import { computeRockHardness, talusScaleOf, type HardnessAtlasInput } from './rockHardness';

// ============================================================================
// Types and Interfaces
// ============================================================================
// Input definitions for the atlas graph and the resulting baked erosion fields.
// ============================================================================

/** The subset of the FMG pack graph the bake reads. */
export interface ErosionAtlasInput extends HardnessAtlasInput {
  /** Cell centers, in atlas pixels. */
  p: ReadonlyArray<readonly [number, number] | undefined>;
  /** Cell area, atlas pixels squared. */
  area: ArrayLike<number> | undefined;
  /** Map-border flag. Border cells drain off the map. */
  b: ArrayLike<number> | undefined;
  /** Grid parent cell id, for reading precipitation. */
  g: ArrayLike<number> | undefined;
  /** Precipitation per GRID cell. Indexed through `g`. */
  gridPrecipitation: ArrayLike<number> | undefined;
}

/** The bake result. One entry per pack cell, index-aligned. */
export interface AtlasErosionField {
  /** Rock hardness, 0..1. 0.5 is the reference rock. */
  hardness: Float64Array;
  /**
   * Normalized discharge, 0..1. Log-compressed, because raw accumulated flow
   * spans four orders of magnitude and a linear scale would leave every cell
   * but the trunk at zero.
   */
  discharge: Float64Array;
  /** Raw accumulated flow, in units of mean cell rainfall. Diagnostics only. */
  rawDischarge: Float64Array;
  /** Mean cell spacing, atlas pixels. The distance unit of the simulation. */
  spacingPx: number;
}

// ============================================================================
// Geomorphic Constants and Tuning
// ============================================================================
// Physical parameters for stream power incision, multiple flow direction,
// and hillslope repose.
// ============================================================================

/** MFD exponent: steep-weighted multiple flow direction routing. */
const MFD_P = 6;

/** Stream-power discharge exponent (standard published geomorphic value). */
const INCISION_M = 0.45;

/** Stream-power slope exponent. */
const INCISION_N = 1.0;

/** Combined incision rate (K0 * dt) calibrated for the normalized atlas mesh. */
const INCISION_RATE = 3.0e-2;

/** Number of water incision simulation sweeps. */
const INCISION_SWEEPS = 60;

/** Hillslope transfer rate for sediment diffusion above the talus angle. */
const HILLSLOPE_RATE = 0.03;

/** Number of hillslope diffusion sweeps. */
const HILLSLOPE_SWEEPS = 80;

/** Base talus slope angle in normalized elevation units per mean cell spacing. */
const TALUS_BASE = 0.055;

/** Priority-flood fill increment to guarantee strictly monotonic drainage paths. */
const FILL_EPS = 1e-9;

/** Atlas waterline threshold (FMG height 20 out of 100). */
const WATER_LEVEL = 0.2;

/** Log compression knee for discharge normalization (spends half the 0..1 range on 1..6 rainfall units). */
const DISCHARGE_KNEE = 6;

/** Reference discharge representing an unchanneled hillslope receiving base rainfall. */
export const REFERENCE_DISCHARGE = Math.log1p(1 / DISCHARGE_KNEE) / Math.log1p(1000 / DISCHARGE_KNEE);

// ============================================================================
// Min-Heap Priority Queue
// ============================================================================
// High-performance binary heap keyed on (elevation, id) for priority-flood
// depression filling. Tie-breaking on cell ID guarantees bit-identical reproducibility.
// ============================================================================

class MinHeap {
  private readonly key: Float64Array;
  private readonly id: Int32Array;
  private size = 0;

  constructor(capacity: number) {
    this.key = new Float64Array(capacity);
    this.id = new Int32Array(capacity);
  }

  get length(): number {
    return this.size;
  }

  private less(a: number, b: number): boolean {
    if (this.key[a] !== this.key[b]) return this.key[a] < this.key[b];
    return this.id[a] < this.id[b];
  }

  private swap(a: number, b: number): void {
    const k = this.key[a];
    this.key[a] = this.key[b];
    this.key[b] = k;
    const i = this.id[a];
    this.id[a] = this.id[b];
    this.id[b] = i;
  }

  push(key: number, id: number): void {
    let i = this.size++;
    this.key[i] = key;
    this.id[i] = id;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!this.less(i, parent)) break;
      this.swap(i, parent);
      i = parent;
    }
  }

  pop(): number {
    const top = this.id[0];
    this.size--;
    if (this.size > 0) {
      this.key[0] = this.key[this.size];
      this.id[0] = this.id[this.size];
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let small = i;
        if (l < this.size && this.less(l, small)) small = l;
        if (r < this.size && this.less(r, small)) small = r;
        if (small === i) break;
        this.swap(i, small);
        i = small;
      }
    }
    return top;
  }
}

// ============================================================================
// Atlas Erosion Simulation Bake
// ============================================================================
// Runs depression filling, MFD accumulation, stream-power incision, and hillslope
// relaxation across the entire atlas mesh.
// ============================================================================

/**
 * Run the atlas-scale erosion simulation.
 *
 * @param atlas - Input graph, cell heights, biomes, areas, and precipitation.
 * @returns Baked rock hardness and accumulated water discharge for every cell.
 */
export function bakeAtlasErosion(atlas: ErosionAtlasInput): AtlasErosionField {
  const { p, h, c, b, area, g, gridPrecipitation } = atlas;
  const n = h.length;
  const hardness = computeRockHardness(atlas);

  // Mean cell spacing, the distance unit. Derived from the mesh extent and cell count.
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let placed = 0;

  for (let i = 0; i < n; i++) {
    const q = p[i];
    if (!q) continue;
    placed++;
    if (q[0] < minX) minX = q[0];
    if (q[0] > maxX) maxX = q[0];
    if (q[1] < minY) minY = q[1];
    if (q[1] > maxY) maxY = q[1];
  }
  if (placed === 0) throw new Error('[atlasErosionBake] atlas has no cell points');
  const spacingPx = Math.max(1, Math.sqrt(((maxX - minX) * (maxY - minY)) / placed));

  // Flatten mesh adjacency and calculate inter-cell Euclidean distances in spacing units.
  const offset = new Int32Array(n + 1);
  for (let i = 0; i < n; i++) offset[i + 1] = offset[i] + c[i].length;
  const total = offset[n];
  const nbr = new Int32Array(total);
  const dist = new Float64Array(total);

  for (let i = 0; i < n; i++) {
    const pi = p[i];
    for (let k = 0; k < c[i].length; k++) {
      const j = c[i][k];
      const slot = offset[i] + k;
      nbr[slot] = j;
      const pj = p[j];
      if (!pi || !pj) {
        throw new Error(`[atlasErosionBake] cell ${!pi ? i : j} has no position`);
      }
      const dx = (pj[0] - pi[0]) / spacingPx;
      const dy = (pj[1] - pi[1]) / spacingPx;
      const d = Math.hypot(dx, dy);
      if (!(d > 0)) throw new Error(`[atlasErosionBake] zero-length edge ${i}-${j}`);
      dist[slot] = d;
    }
  }

  // Rainfall per cell in units of mean land rainfall.
  const rain = new Float64Array(n);
  const hasPrec = !!(g && gridPrecipitation);
  let rainSum = 0;
  let landCount = 0;

  for (let i = 0; i < n; i++) {
    const isLand = h[i] / 100 >= WATER_LEVEL;
    if (!isLand) continue;
    const areaTerm = area ? area[i] / (spacingPx * spacingPx) : 1;
    const precTerm = hasPrec ? gridPrecipitation![g![i]] : 1;
    const r = Math.max(1e-6, areaTerm * precTerm);
    rain[i] = r;
    rainSum += r;
    landCount++;
  }
  if (landCount === 0) throw new Error('[atlasErosionBake] atlas has no land cells');
  const rainScale = landCount / rainSum;
  for (let i = 0; i < n; i++) rain[i] *= rainScale;

  // Working elevation surface (scaled to 0..1).
  const elev = new Float64Array(n);
  for (let i = 0; i < n; i++) elev[i] = h[i] / 100;

  const filled = new Float64Array(n);
  const closed = new Uint8Array(n);
  const order = new Int32Array(n); // fill order: ascending filled elevation
  const discharge = new Float64Array(n);
  const steepSlope = new Float64Array(n);
  const lowestDrop = new Float64Array(n);
  const heap = new MinHeap(n);

  let maxDegree = 0;
  for (let i = 0; i < n; i++) if (c[i].length > maxDegree) maxDegree = c[i].length;
  const isLand = new Uint8Array(n);
  for (let i = 0; i < n; i++) isLand[i] = elev[i] >= WATER_LEVEL ? 1 : 0;

  const wBuf = new Float64Array(maxDegree);
  const jBuf = new Int32Array(maxDegree);

  // Flow routing pass: priority flood depression fill + backward MFD flow accumulation.
  const routeFlow = (): void => {
    closed.fill(0);
    let filledCount = 0;

    // Seed priority queue with all ocean and border outlet cells.
    for (let i = 0; i < n; i++) {
      if (isLand[i] && !(b && b[i])) continue;
      filled[i] = elev[i];
      closed[i] = 1;
      heap.push(filled[i], i);
    }

    while (heap.length > 0) {
      const i = heap.pop();
      order[filledCount++] = i;
      const end = offset[i + 1];
      for (let s = offset[i]; s < end; s++) {
        const j = nbr[s];
        if (closed[j]) continue;
        closed[j] = 1;
        // Priority flood rule: cell elevation cannot be lower than the lowest path out of it.
        filled[j] = Math.max(elev[j], filled[i] + FILL_EPS);
        heap.push(filled[j], j);
      }
    }

    if (filledCount !== n) {
      throw new Error(
        `[atlasErosionBake] priority-flood reached ${filledCount} of ${n} cells`,
      );
    }

    // MFD flow accumulation: process cells from highest to lowest.
    for (let i = 0; i < n; i++) discharge[i] = rain[i];
    for (let i = 0; i < n; i++) steepSlope[i] = 0;

    for (let k = n - 1; k >= 0; k--) {
      const i = order[k];
      if (!isLand[i]) continue;
      const end = offset[i + 1];
      let hits = 0;
      let wSum = 0;
      let steepest = 0;
      let deepest = 0;

      for (let s = offset[i]; s < end; s++) {
        const j = nbr[s];
        const drop = filled[i] - filled[j];
        if (drop <= 0) continue;
        const slope = drop / dist[s];
        if (slope > steepest) steepest = slope;
        if (drop > deepest) deepest = drop;
        const w = Math.pow(slope, MFD_P);
        wBuf[hits] = w;
        jBuf[hits] = j;
        wSum += w;
        hits++;
      }

      steepSlope[i] = steepest;
      lowestDrop[i] = deepest;
      if (hits === 0 || wSum <= 0) continue;

      const q = discharge[i];
      for (let a = 0; a < hits; a++) discharge[jBuf[a]] += (q * wBuf[a]) / wSum;
    }
  };

  // Landscape evolution: alternate incision and hillslope diffusion sweeps.
  const talus = new Float64Array(n);
  for (let i = 0; i < n; i++) talus[i] = TALUS_BASE * talusScaleOf(hardness[i]);
  const erodibility = new Float64Array(n);
  for (let i = 0; i < n; i++) erodibility[i] = 1 + 1.2 * (0.5 - hardness[i]);

  const delta = new Float64Array(n);
  const sweeps = Math.max(INCISION_SWEEPS, HILLSLOPE_SWEEPS);
  const incisionEvery = sweeps / INCISION_SWEEPS;
  const hillslopeEvery = sweeps / HILLSLOPE_SWEEPS;
  let incisionDue = 0;
  let hillslopeDue = 0;

  for (let sweep = 0; sweep < sweeps; sweep++) {
    routeFlow();

    incisionDue += 1;
    if (incisionDue >= incisionEvery) {
      incisionDue -= incisionEvery;
      for (let i = 0; i < n; i++) {
        if (!isLand[i]) continue;
        const s = steepSlope[i];
        if (s <= 0) continue;
        const cut =
          INCISION_RATE *
          erodibility[i] *
          Math.pow(discharge[i], INCISION_M) *
          Math.pow(s, INCISION_N);
        const headroom = lowestDrop[i] * 0.5;
        elev[i] = Math.max(WATER_LEVEL, elev[i] - Math.min(cut, headroom));
      }
    }

    hillslopeDue += 1;
    if (hillslopeDue >= hillslopeEvery) {
      hillslopeDue -= hillslopeEvery;
      delta.fill(0);
      for (let i = 0; i < n; i++) {
        if (!isLand[i]) continue;
        const end = offset[i + 1];
        for (let s = offset[i]; s < end; s++) {
          const j = nbr[s];
          const drop = elev[i] - elev[j];
          if (drop <= 0) continue;
          const slope = drop / dist[s];
          const limit = talus[i];
          if (slope <= limit) continue;
          const move = HILLSLOPE_RATE * (slope - limit) * 0.5 * dist[s];
          delta[i] -= move;
          delta[j] += move;
        }
      }
      for (let i = 0; i < n; i++) {
        if (!isLand[i]) continue;
        elev[i] = Math.max(WATER_LEVEL, elev[i] + delta[i]);
      }
    }
  }

  // Final routing on the settled surface to obtain exported discharge.
  routeFlow();

  const rawDischarge = Float64Array.from(discharge);
  const norm = Math.log1p(1000 / DISCHARGE_KNEE);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const v = Math.log1p(rawDischarge[i] / DISCHARGE_KNEE) / norm;
    out[i] = v < 0 ? 0 : v > 1 ? 1 : v;
  }

  return { hardness, discharge: out, rawDischarge, spacingPx };
}
