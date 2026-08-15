/**
 * @file atlasErosionBake.ts — one landscape-evolution run over the whole atlas.
 *
 * WHY THIS EXISTS. The region composite had no discharge term. Without one,
 * every channel it cuts is the same width, because nothing tells it which
 * valley carries a river and which carries a trickle. That is the
 * "uniform-width" half of the open `region-terrain` verdict.
 *
 * WHY IT RUNS AT ATLAS SCALE. A region window is generated on demand, is
 * window-local, and must be deterministic. An iterative simulation is none of
 * those: water arrives from outside the window, and the answer at a point
 * depends on the whole upstream basin. So the simulation runs ONCE over the
 * atlas graph, and the window READS its result. Flow accumulation becomes an
 * atlas property, exactly like elevation and biome already are.
 *
 * WHAT IT EXPORTS, AND WHAT IT DOES NOT.
 *
 *   EXPORTS   `discharge` (normalized accumulated flow) and `hardness`.
 *   DISCARDS  the eroded elevation.
 *
 * The atlas stays authoritative over mean elevation. The simulation's own
 * surface exists only so that the flow network can CONVERGE — so channels
 * deepen, divides migrate, and captures happen — which is what turns a raw
 * flow-accumulation map into a realistic river network. Exporting that surface
 * would overwrite the atlas, so it is thrown away.
 *
 * THE METHOD. Published geomorphology, implemented here from the laws, not
 * ported from any source:
 *
 *   Depression fill   Priority-flood (Barnes, Lehman & Mulla 2014). Without it
 *                     every closed basin is a discharge dead end and the river
 *                     network breaks into disconnected stubs.
 *   Flow routing      Multiple-flow-direction. All strictly lower neighbors
 *                     share the flow, weighted by `slope^MFD_P` and normalized.
 *                     Single-direction routing on an irregular graph prints the
 *                     mesh itself as a set of straight lines.
 *   Incision          Stream power: `dt * K0 * erodibility * Q^m * S^n`.
 *   Hillslope         Threshold-angle diffusion above a talus angle that
 *                     hardness scales.
 *
 * THE GRAPH. The FMG pack Voronoi mesh, ~5,800 cells at mean degree 6. It is
 * the atlas's own mesh, so the result lands exactly on the cells the region
 * tier already interpolates between. No resampling, no second grid.
 *
 * UNITS. The simulation works in NORMALIZED units, not feet:
 *   elevation  — the atlas 0..1 scale, the same one the region composite uses.
 *   distance   — mean cell spacing, so a typical edge has length ~1.
 * That choice is deliberate. In feet, a slope is ~2e-6, and `slope^6` underflows
 * to zero, which silently kills the MFD weighting. Normalizing puts slopes in
 * the 0.01..0.5 band, where the published constants were calibrated.
 *
 * DETERMINISM. Pure function of the atlas pack. The heap breaks elevation ties
 * on ascending cell id, and every sweep visits cells in a fixed order, so two
 * runs are bit-identical.
 */
import { computeRockHardness, talusScaleOf, type HardnessAtlasInput } from './rockHardness';

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

// ── Constants ────────────────────────────────────────────────────────────────
//
// The demiurge readings that seeded these are marked. Every retune is stated
// with its reason. Their numbers were calibrated on a 256-per-face regular grid
// with its own elevation scale; ours is an irregular ~5,800-cell mesh on the
// atlas 0..1 scale, so several had to move.

/** MFD exponent. Unchanged: `slope^6` is the standard steep-weighted MFD. */
const MFD_P = 6;
/** Stream-power discharge exponent. Unchanged at 0.45. */
const INCISION_M = 0.45;
/** Stream-power slope exponent. Unchanged at 1.0. */
const INCISION_N = 1.0;
/**
 * `K0 * dt` combined.
 *
 * RETUNED from `K0 = 0.35, dt = 0.005` (product 1.75e-3). At our scale a
 * typical land slope is ~0.02 per spacing and Q^0.45 is ~1.5, so their product
 * cuts 5e-5 per sweep. Over 60 sweeps that is 3e-3 of a 0..1 elevation range —
 * about 30 ft. Invisible. The retune raises the product to 3.0e-2, which cuts
 * roughly 0.05 normalized (~500 ft) into the trunk valleys over the full run.
 * That is a real gorge at atlas scale and it is what lets the network capture.
 */
const INCISION_RATE = 3.0e-2;
/** Incision sweeps. Unchanged at 60. */
const INCISION_SWEEPS = 60;
/**
 * Hillslope transfer rate.
 *
 * RETUNED from 0.0005 to 0.03. Theirs is per sweep on a grid whose neighbor
 * spacing is one cell; ours is per sweep on a normalized mesh, and at 0.0005
 * eighty sweeps move 4% of one excess-slope unit, which is not a visible
 * relaxation. 0.03 relaxes an over-steep face by roughly half over the run,
 * which is what a threshold hillslope actually does.
 */
const HILLSLOPE_RATE = 0.03;
/** Hillslope sweeps. Unchanged at 80. */
const HILLSLOPE_SWEEPS = 80;
/**
 * Base talus angle, normalized elevation per unit spacing.
 *
 * NEW — demiurge takes talus from its own environment model, which we do not
 * have. 0.055 is the slope at which our atlas cells start to look like a
 * mountain face: over a ~5,000 ft spacing it is about 275 ft of drop, near the
 * repose angle a rock slope holds at this sampling.
 */
const TALUS_BASE = 0.055;
/** Priority-flood fill increment. Unchanged at 1e-9. */
const FILL_EPS = 1e-9;
/** Atlas waterline, matching `regionCompositeField`'s WATER_THRESHOLD. */
const WATER_LEVEL = 0.2;
/**
 * Log compression knee for the discharge normalization.
 *
 * NEW. Discharge is measured in mean-cell rainfalls, so 1 is an unchanneled
 * hillslope cell and the trunk rivers reach the low thousands. A knee at 6
 * spends the first half of the 0..1 output on the 1..6 band, which is where
 * every ordinary valley lives, and the second half on the trunks.
 */
const DISCHARGE_KNEE = 6;

/**
 * Reference discharge — the value that leaves the region operator unchanged.
 *
 * It is the normalized discharge of a cell carrying exactly the mean rainfall
 * and nothing else, which is what an unchanneled hillslope carries.
 */
export const REFERENCE_DISCHARGE = Math.log1p(1 / DISCHARGE_KNEE) / Math.log1p(1000 / DISCHARGE_KNEE);

// ── Binary heap, keyed on (elevation, id) ────────────────────────────────────
//
// A plain array sort per pop would dominate the run. The tie-break on ascending
// id is not cosmetic: two cells at exactly equal filled elevation must always
// be popped in the same order, or the fill is not reproducible.

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

  /** Pops the smallest and returns its cell id. */
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

// ── The bake ─────────────────────────────────────────────────────────────────

/**
 * Run the atlas-scale erosion simulation.
 *
 * Cost is about 5,800 cells x 140 sweeps x degree 6, plus one priority-flood
 * per sweep. That is a few tens of milliseconds, and it runs ONCE per atlas —
 * never per window.
 */
export function bakeAtlasErosion(atlas: ErosionAtlasInput): AtlasErosionField {
  const { p, h, c, b, area, g, gridPrecipitation } = atlas;
  const n = h.length;
  const hardness = computeRockHardness(atlas);

  // Mean cell spacing, the distance unit. Derived from the mesh extent and the
  // cell count, the same way `computeRegionSpacingFt` does it, so the two
  // tiers agree on what "one cell across" means.
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

  // Edge lengths in spacing units, flattened. Computed once; the mesh never
  // moves, only the elevation on it.
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
        // No-fallback: a neighbor link with no geometry means the pack graph is
        // malformed. Guessing a length would hide it.
        throw new Error(`[atlasErosionBake] cell ${!pi ? i : j} has no position`);
      }
      const dx = (pj[0] - pi[0]) / spacingPx;
      const dy = (pj[1] - pi[1]) / spacingPx;
      const d = Math.hypot(dx, dy);
      if (!(d > 0)) throw new Error(`[atlasErosionBake] zero-length edge ${i}-${j}`);
      dist[slot] = d;
    }
  }

  // Rainfall per cell, in units of the mean land cell. Real precipitation when
  // the atlas carries it, cell area otherwise — both are atlas facts, and the
  // choice is made once, here, not per cell.
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

  // The working surface. Discarded at the end — the atlas owns elevation.
  const elev = new Float64Array(n);
  for (let i = 0; i < n; i++) elev[i] = h[i] / 100;

  const filled = new Float64Array(n);
  const closed = new Uint8Array(n);
  const order = new Int32Array(n); // fill order: ascending filled elevation
  const discharge = new Float64Array(n);
  const steepSlope = new Float64Array(n);
  /** Elevation drop from a cell to its lowest neighbor, on the filled surface. */
  const lowestDrop = new Float64Array(n);
  const heap = new MinHeap(n);
  let maxDegree = 0;
  for (let i = 0; i < n; i++) if (c[i].length > maxDegree) maxDegree = c[i].length;
  const isLand = new Uint8Array(n);
  for (let i = 0; i < n; i++) isLand[i] = elev[i] >= WATER_LEVEL ? 1 : 0;

  /**
   * Priority-flood, then MFD accumulation, over the current surface.
   *
   * The two run together because the fill already produces the exact traversal
   * order accumulation needs: a cell is popped only after every cell that can
   * drain through it. Doing them in one pass removes a whole sort per sweep.
   */
  const wBuf = new Float64Array(maxDegree);
  const jBuf = new Int32Array(maxDegree);
  const routeFlow = (): void => {
    closed.fill(0);
    let filledCount = 0;

    // Seeds: the sea, and any cell on the map border. Both are real outlets.
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
        // The fill: a cell can never sit below the lowest way out of it.
        filled[j] = Math.max(elev[j], filled[i] + FILL_EPS);
        heap.push(filled[j], j);
      }
    }
    // No-fallback: an unreachable cell means the graph is disconnected, which
    // would silently strand its basin's water.
    if (filledCount !== n) {
      throw new Error(
        `[atlasErosionBake] priority-flood reached ${filledCount} of ${n} cells`,
      );
    }

    // MFD accumulation, walking the fill order BACKWARDS — highest first, so a
    // cell's own discharge is complete before it gives any away.
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

  // ── Landscape evolution ────────────────────────────────────────────────────
  //
  // Incision and hillslope alternate, so a valley that incision cuts is
  // immediately given walls that relax to the talus angle. Running them in two
  // separate phases produced slot canyons with no flanks.
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
        // Never cut a cell more than halfway down to its own lowest neighbor:
        // that would dig a new pit the next fill has to undo, and the network
        // would never settle.
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
          // Hard rock holds a steeper face before it sheds material. This is
          // the SECOND effect of the one hardness field, and it is why hard
          // ridges stay sharp while soft ground rounds off.
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

  // Final routing on the settled surface. This is the discharge we export.
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
