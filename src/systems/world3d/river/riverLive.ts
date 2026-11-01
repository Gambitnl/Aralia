/**
 * @file riverLive.ts — THE LIVE RIVER (Remy, 2026-09-29: "make it so i can
 * grab the river and i can manipulate the river shape live, without
 * reloading"; before that, 2026-09-28: "controls on the rivers width and
 * depth").
 *
 * WHAT IT DOES
 *
 * 1. It keeps the flow solver RUNNING. The judged scene draws a steady,
 *    time-averaged field that was solved once; the live river steps the same
 *    solver on and on, and a few times a second it makes a flow map from the
 *    mean of the last steps, so the drawn water is the simulation as it runs.
 * 2. It changes the bed IN PLACE. An edit (the River shape panel's width,
 *    depth and flow, a moved control point of the course line, a widened or
 *    narrowed stretch) becomes a BED PATCH: the ground, the rocks and the
 *    solver's bed change only near the change, the water on the grid keeps
 *    flowing, and it fills the new shape.
 *
 * THE BED PATCH MODEL
 *
 * The ground of an edited river is a pure function of the edit, not of the
 * path the edit took, so a drag that ends where it started leaves the judged
 * ground, and a page that loads an edit from its address draws what the drag
 * drew. Per cell:
 *
 *     ground = judged + (edited - judged) x w
 *
 * - `edited` is the ground function (riverReach.ts `terrainHeightAt`) on the
 *   edited course, with the edited key table (shape, local widths).
 * - `w` is 1 in the edited channel and its floodplain (the bank plus
 *   `carveM`) and in the judged channel and its floodplain, along the
 *   stretches of the course that the edit changed; it falls to 0 over
 *   `blendM` past that and `alongM` past the ends of a changed stretch.
 *
 * So an edit carves its channel into the valley and fills the channel it
 * left; past the band the judged valley stays. (A full rebuild would move the
 * whole valley with the course: its walls are keyed on the distance to the
 * course. That costs 8 us a point over the render domain, about 2 s, and it
 * would swing mountainsides round while a point is dragged.)
 *
 * THE DESIGN S (see riverReach.ts `RiverCourseEdit`): a moved point stretches
 * the four segments round it in space but not in s, so the pool, the riffle
 * and the sill downstream keep their place.
 *
 * WHAT KEEPS IT FAST: every cell's projection on the course and its eight
 * noise values are cached (riverReach.ts `RIVER_TERRAIN_NOISE`), so a cell of
 * a patch costs about 0.4 us, not 8 us; a moved point touches only the cells
 * near its four segments.
 *
 * THE WATER ACROSS A PATCH (riverSolver.ts `updateBed`): wet cells keep their
 * surface, dry cells stay dry, and the new channel fills from upstream.
 *
 * Nothing here runs in the judged scene: its captures draw the steady field
 * (riverReachScene.ts), and this file only adds to it.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 17/10/2026, 08:41:43
 * Dependents: components/DesignPreview/steps/water/RiverScene.tsx, components/World3D/water/riverEditHandles.ts, components/World3D/water/riverLiveClient.ts, components/World3D/water/riverReachScene.ts, components/World3D/water/riverReceivingRefiner.ts, systems/world3d/river/riverMapWorker.ts, systems/world3d/river/riverWorker.ts
 * Imports: 15 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { RiverTerrainBrush, type RiverTerrainBrushCommand, type TerrainBrushBounds } from './riverTerrainBrush';
import {
  OutsideFields, RIVER_RENDER_DOMAIN, RIVER_SHAPE_DEFAULT, mainBoulderShape, boulderBounds, boulderTopAt, buildRiverReach, clampRiverShape, courseKeyAt, defaultRiverCourse,
  designLevelAt, getRiverCourseEdit, getRiverShape, isDefaultRiverShape, riverBaseHalfWidthAt, riverCeilingMarginM,
  riverCourseEditKey, riverCourseFor, riverFlowDepthFactor, riverHeightAt, riverLateralN, setRiverCourseEdit, setRiverShape,
  terrainHeightAt, terrainNoiseAt, RIVER_EDITABLE_POINTS, RIVER_TERRAIN_NOISE,
  type Boulder, type RiverCourse, type RiverCourseEdit, type RiverGridSpec, type RiverReach, type RiverShape,
} from './riverReach';
import { RiverFlowSolver, G } from './riverSolver';
import { smoothRiverFrame, smoothRiverFrameAt } from './riverFrameSmoothing';
import type { RiverGpuExecutor } from './riverGpuStep';
import type { RiverGpuResidentExecutor } from './riverGpuResident';
import { copyRawRiverCells, type RawRiverCells } from './riverCellInspection';
import { airborneHeadwater, headwatersGrid, headwaterKey, MAIN_CHANNEL_S, riverHeadwatersEnabled, riverReconstructionEnabled, setRiverHeadwaters } from './riverHeadwaters';
import { RIVER_GRID, getRiverWorldBed, riverChannelProjection } from './riverReach';
import { applyFineGroundPatch, carryRiverWater, worldBedHeightLocal, type RiverWaterExport, type RiverWorldCarry, type RiverWorldFrame, type WorldFineGroundPatch } from './riverWorldBed';
import { reconstructionLandscapeDomain } from './riverRapidsReconstruction';
import type { RiverCoarseLevel } from './riverFlowPatch';
import { applyRiverPatch, riverPatchFrom, riverPatchRows, type LiveFlowArrays, type LiveFlowPatch } from './riverFlowPatch';
import { FlowMapScratch, flowMapCore, reachInflow, reachStartState, type RiverFlowMapStats, type WaterfallImpactSource, type WaterfallLandingState } from './riverFlowField';
import { buildWaterSheetArrays, toHalfArray, type WaterSheetArrays } from './riverWaterSheet';
import { RiverSourceHistory, riverSourceAt } from './riverSourceHistory';
import { RiverFloodSurge, type RiverFloodOptions, type RiverFloodStatus } from './riverFloodSurge';
import { RiverSpillTransfer, type RiverSpillSnapshot } from './riverSpillTransfer';
import { WATERFALL, waterfallHydraulics } from './riverHeadwaters';
import { WaterfallContactFlow, type WaterfallContactSnapshot, type ContactArrival } from './waterfallContactFlow';
import { worldBedInflowM3S } from './riverWorldBed';
import type { InflowCell } from './riverSolver';

/**
 * ONE WATER (2026-10-30): the part of a total flow `q` that enters at the
 * west edge. With a world bed whose tributaries join inside the box, that is
 * the main river's share; the west-edge inflow's speed is set from it, not
 * from the whole. Otherwise all of `q`.
 */
function mainRiverShareM3S(q: number): number {
  const bed = getRiverWorldBed();
  if (!bed || bed.tributaries.length === 0) return q;
  return (q * bed.dischargeM3S) / worldBedInflowM3S(bed);
}

/**
 * ONE WATER (2026-10-30): the west edge's inflow cells keep the main river's
 * share of the flow, and each world tributary that ends inside the box adds
 * its own cells: those within its half width of its mouth, on the solver's
 * bed, sharing its flow equally and moving along the tributary. The shares
 * sum to 1, so the solver's one total flow splits as the world's rivers do.
 * Throws when a tributary's mouth has no bed cell: its water would be lost.
 */
function withWorldTributaries(grid: RiverGridSpec, bed: ArrayLike<number>, westEdge: readonly InflowCell[]): readonly InflowCell[] {
  const world = getRiverWorldBed();
  if (!world || world.tributaries.length === 0) return westEdge;
  const total = worldBedInflowM3S(world);
  const out: InflowCell[] = westEdge.map((c) => ({ ...c, share: (c.share * world.dischargeM3S) / total }));
  const { nx, nz, dx, x0, z0 } = grid;
  for (const t of world.tributaries) {
    const cells: number[] = [];
    const i0 = Math.max(0, Math.floor((t.x - t.halfW - x0) / dx));
    const i1 = Math.min(nx - 1, Math.ceil((t.x + t.halfW - x0) / dx));
    const j0 = Math.max(0, Math.floor((t.z - t.halfW - z0) / dx));
    const j1 = Math.min(nz - 1, Math.ceil((t.z + t.halfW - z0) / dx));
    for (let j = j0; j <= j1; j += 1) {
      for (let i = i0; i <= i1; i += 1) {
        const c = j * nx + i;
        if (!Number.isFinite(bed[c])) continue;
        if (Math.hypot(x0 + (i + 0.5) * dx - t.x, z0 + (j + 0.5) * dx - t.z) <= t.halfW) cells.push(c);
      }
    }
    if (cells.length === 0) throw new Error(`[river] The tributary mouth at (${t.x.toFixed(1)}, ${t.z.toFixed(1)}) m has no bed cell on the solver grid.`);
    const velocityMS: [number, number] = [t.dir[0] * t.speedMS, t.dir[1] * t.speedMS];
    for (const c of cells) out.push({ c, share: t.dischargeM3S / total / cells.length, velocityMS });
  }
  return out;
}

/** The transport receipt distinguishes crossing the pool plane from actual
 * native acceptance. Pending arrivals keep their volume until a wet receiver
 * exists; downward momentum becomes unresolved impact energy, never SWE mass. */
export interface ContactPoolSnapshot extends WaterfallContactSnapshot {
  pool: { acceptedVolume: number; pendingVolume: number; acceptedMomentum: [number, number, number]; verticalReactionNs: number; dissipatedEnergy: number; arrivalRate: number; requested: boolean; capacityBlocked: boolean };
}

/** An edit of the river: the panel's shape and the edit mode's course edit. */
export interface RiverEditState {
  shape: RiverShape;
  course: RiverCourseEdit | null;
}

/** The live river's tunables, each with its reason. */
/** The longest resident GPU interval in fast mode, s of flow (2026-10-27; was 0.2 s). */
export const RIVER_RESIDENT_INTERVAL_S = 0.8;
/** The longest resident GPU interval in real-time mode, s of flow. */
export const RIVER_RESIDENT_REALTIME_INTERVAL_S = 0.2;

export const RIVER_LIVE = Object.freeze({
  /**
   * The band past each bank that an edit carves again (the floodplain), m.
   * The floodplain runs 6 to 10 m before the valley side rises.
   */
  carveM: 10,
  /** The blend from the edited ground back to the judged valley, past the carved band, m. */
  blendM: 14,
  /** The blend past the ends of a changed stretch of the course, m. */
  alongM: 10,
  /**
   * The drawn field's smoothing, s of the flow's own time. The window mean of
   * the steps since the last flow map is smoothed again over this time, so a
   * wake that sheds behind a rock does not flicker the textures a few times
   * a second, while a filling channel still fills on screen.
   */
  smoothS: 1.5,
  /** The smoothing of the unsteady part (uRms), s: it needs several sheddings. */
  rmsSmoothS: 6,
  /**
   * THE AUTO PACE: after the start and after each edit the solver runs as
   * fast as it can for at least `fastAfterEditS` of flow, then until the
   * river SETTLES (its outflow, smoothed over 10 s of flow, within
   * `settleShare` of the inflow) or `fastMaxS` of flow pass, then in real
   * time. A moved or narrowed pool refills from upstream: at the summer
   * flow that is several hundred seconds of flow, one to two minutes here.
   */
  fastAfterEditS: 45,
  // (5 %: from the design level the live run dips to 1.23 of 1.5 m^3/s at
  // 300 s of flow while the pool fills, and settles within 1 % by 900 s.)
  settleShare: 0.05,
  fastMaxS: 900,
  /** The speed past which a run has blown up, m/s (see RiverFlowSolver.health). */
  blowUpMS: 25,
  /** How often a good state is kept, to go back to after a blow-up, s of flow. */
  keepGoodEveryS: 2,
  /**
   * THE NODE HEIGHTS' PONDS: the depth of the water over the lowest point of
   * a raised section when the whole flow spills over it, m (at the judged
   * flow; it scales with the flow's depth factor). 0.2 m carries 1.5 m^3/s
   * over a 10 m spill at about 0.75 m/s.
   */
  spillDepthM: 0.2,
});

/**
 * WHAT A RAISED OR LOWERED CONTROL POINT DOES to the water (the node heights,
 * 2026-09-29), from the ground and the design levels after the patch:
 * - 'deeper': the point is lowered, and the channel holds deeper water there;
 * - 'shallower': the point is raised, and the water still covers the middle
 *   of the channel (a riffle over it);
 * - 'split': the middle stands out of the water as a dry hump, and the water
 *   passes beside it;
 * - 'block': the water cannot pass the raised stretch at its old level, so
 *   it ponds upstream and spills over the stretch's PASS (the lowest path
 *   over it inside the solver's band); with `noPass`, no path stays inside
 *   the band, and the water rises to the wet ceiling there and stops.
 */
export interface RiverNodeReport {
  point: number;
  /** The point's height against the judged bed, m. */
  height: number;
  kind: 'deeper' | 'shallower' | 'split' | 'block';
  /** The ground at the channel's middle now, m. */
  center: number;
  /** The design water level without the heights, and with them (the pond), m. */
  base: number;
  level: number;
  /**
   * The pass over the raised stretch (LiveRiver.passLevel), m, and the side
   * its sill is on (looking downstream); NaN for a lowered point, Infinity
   * with `noPass`.
   */
  pass: number;
  passSide: 'left' | 'right' | 'middle';
  /** True when no path over the raised stretch stays inside the solver's band. */
  noPass: boolean;
  /** How far upstream the design level stands over its old value (a pond), m. */
  pondM: number;
}

/** The edited design level's table: 1 m steps of s over the design level's own range. */
const LEVEL_S0 = -140;
const LEVEL_S1 = 440;

/** The box of solver cells a patch changed, inclusive. */
export interface CellBox { i0: number; j0: number; i1: number; j1: number }

/** What the page applies after an edit (see RiverReachView.applyBedPatch). */
export interface LiveBedPatch {
  /** The edit as clamped (the page shows and stores this one). */
  shape: RiverShape;
  course: RiverCourseEdit | null;
  /** The edit's key for the address (riverCourseEditKey). */
  courseKey: string;
  /** The solver cells whose ground changed, and the new ground over that box (row-major, m). */
  box: CellBox | null;
  ground: Float32Array | null;
  /** The outer (2 m) lattice points whose height changed: a box of lattice indices and the new heights. */
  outerBox: CellBox | null;
  outer: Float32Array | null;
  /** The world box the patch touched, m (the page moves the stones and the plants in it). */
  world: { x0: number; z0: number; x1: number; z1: number } | null;
  /** Boulders that moved: index, then x, y, z (m), four numbers each. */
  boulderMoves: Float32Array;
  /** The course samples every 1 m from s = -120 to 400 (x, z, s, tx, tz), as RiverReachData.course. */
  course1m: Float32Array | null;
  /** The control points now (x, z), for the handles. */
  points: Float32Array;
  /** Cost of the patch in the worker, ms. */
  ms: number;
  /** Cells whose ground the patch computed again. */
  cells: number;
  /** The patch's time per stage in the worker, ms. */
  timings: Record<string, number>;
  /** Each control point's height against the judged bed, m (the height handles read it). */
  heights: Float32Array;
  /** What each raised or lowered point does to the water (see RiverNodeReport). */
  nodeReports: RiverNodeReport[];
  /**
   * The water the patch itself added (+) or took (-), m^3: a bed raised over
   * water takes it, a bed lowered under water adds to it. The flow does not
   * make this change; the page shows it.
   */
  volumeChange: number;
}

/** The solved flow in words: the mean over the wet cells (deeper than 3 cm). */
export interface LiveFlowReadout { meanSpeed: number; meanDepth: number; froude: number; wetAreaM2: number }

/** One live frame of the water: the flow map, the sheet and the drawn field. */
export { applyRiverPatch, riverPatchFrom, riverPatchRows, type LiveFlowArrays, type LiveFlowPatch };

export interface LiveFlowSnapshot {
  /** Exact worker-computed texture regions; consumers verify resident lineage. */
  flowDelta?: import('./riverFlowTextureDelta').RiverFlowTextureDelta;
  /** Owned native outgoing face water in flight; no added downstream source. */
  spill?: RiverSpillSnapshot | null;
  /** Crest emission and delayed landing rates; the grid receives only the latter. */
  flood?: RiverFloodStatus;
  /** The exact receiving state accepted by the solver, carried through both workers. */
  waterfallLanding?: WaterfallLandingState | null;
  contactWaterfall?: ContactPoolSnapshot | null;
  /** The flow's own time, s. */
  simTime: number;
  /** The worker's time per stage of this flow map, ms. */
  timings: Record<string, number>;
  t0: Float32Array;
  t0h: Uint16Array;
  t1h: Uint16Array;
  t2h: Uint16Array;
  surface: Float32Array;
  sheet: WaterSheetArrays;
  /**
   * SPARSE PICTURES (2026-10-22, GG-430). From the flow-map worker, a picture
   * after the first carries only the changed rows (`patch`) and empty t0,
   * t0h, t1h, t2h and surface arrays; RiverLiveClient writes the patch into
   * its kept arrays and hands consumers full arrays again, with `patch` (and
   * `surfaceBeforeAt`, the surface the patch replaced) for in-place uploads.
   */
  patch?: LiveFlowPatch;
  /** The previous surface of a patched cell (the blend reads it); other cells did not change. */
  surfaceBeforeAt?: (c: number) => number;
  /** The coarse far-field level for cells whose t0.w is RIVER_FAR_LEVEL. */
  coarse?: RiverCoarseLevel | null;
  /** The drawn (smoothed) field: depth, velocity, m and m/s. */
  h: Float32Array;
  u: Float32Array;
  v: Float32Array;
  mapStats: RiverFlowMapStats;
  readout: LiveFlowReadout;
  /** Discharge in (the inflow) and out (the outflow, over the last window), m^3/s. */
  qIn: number;
  qOut: number;
  volume: number;
  activeCells: number;
  breachCells: number;
  maxSpeed: number;
  /** Blow-ups caught and states restored since the run started, and the last check's verdict. */
  restores: number;
  healthy: boolean;
  /** Cost of the field frame in the solver's worker, and of this flow map in the mapper's, ms. */
  frameMs: number;
  ms: number;
}

const smooth01 = (t: number): number => {
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  return c * c * (3 - 2 * c);
};

/** Per course sample: where it is and what the bed key says there. */
interface SampleState {
  x: Float64Array;
  z: Float64Array;
  curv: Float64Array;
  halfW: Float64Array;
  thalweg: Float64Array;
  /** The bed's rise from the node heights, m (riverHeightAt). */
  height: Float64Array;
  /** The first sample's s (the samples are 0.25 m of s apart). */
  s0: number;
}

/**
 * A COARSE MASK (4 m) over the render domain: the places within some reach
 * of a set of points. A patch marks the samples that changed, so a cell far
 * from every change skips its projection and its ground. The test is one
 * array read a cell; a bucket search a cell cost about 100 ms a patch.
 */
class CoarseMask {
  private readonly step = 4;
  private readonly x0 = RIVER_RENDER_DOMAIN.x0;
  private readonly z0 = RIVER_RENDER_DOMAIN.z0;
  private readonly nx = Math.ceil((RIVER_RENDER_DOMAIN.x1 - RIVER_RENDER_DOMAIN.x0) / 4) + 1;
  private readonly nz = Math.ceil((RIVER_RENDER_DOMAIN.z1 - RIVER_RENDER_DOMAIN.z0) / 4) + 1;
  private readonly m = new Uint8Array(this.nx * this.nz);
  any = false;
  /** Mark every coarse cell within R (m) of (x, z), and a cell more for the coarse step. */
  stamp(x: number, z: number, R: number): void {
    const r = R + this.step * 1.5;
    const i0 = Math.max(0, Math.floor((x - r - this.x0) / this.step));
    const i1 = Math.min(this.nx - 1, Math.ceil((x + r - this.x0) / this.step));
    const j0 = Math.max(0, Math.floor((z - r - this.z0) / this.step));
    const j1 = Math.min(this.nz - 1, Math.ceil((z + r - this.z0) / this.step));
    const r2 = r * r;
    for (let j = j0; j <= j1; j += 1) {
      const dz = this.z0 + j * this.step - z;
      for (let i = i0; i <= i1; i += 1) {
        const ddx = this.x0 + i * this.step - x;
        if (ddx * ddx + dz * dz <= r2) this.m[j * this.nx + i] = 1;
      }
    }
    this.any = true;
  }
  has(x: number, z: number): boolean {
    const i = Math.round((x - this.x0) / this.step);
    const j = Math.round((z - this.z0) / this.step);
    if (i < 0 || j < 0 || i >= this.nx || j >= this.nz) return false;
    return this.m[j * this.nx + i] === 1;
  }
}

function sampleState(course: RiverCourse): SampleState {
  const m = course.samples.length;
  const st: SampleState = {
    x: new Float64Array(m), z: new Float64Array(m), curv: new Float64Array(m), halfW: new Float64Array(m), thalweg: new Float64Array(m),
    height: new Float64Array(m), s0: course.samples[0].s,
  };
  for (let k = 0; k < m; k += 1) {
    const s = course.samples[k];
    const key = courseKeyAt(s.s);
    st.x[k] = s.x; st.z[k] = s.z; st.curv[k] = s.curv; st.halfW[k] = key.halfW; st.thalweg[k] = key.thalweg;
    st.height[k] = riverHeightAt(s.s);
  }
  return st;
}

/** Two samples differ in place (a moved course) or in key (a new width or depth). */
function samplePosDiffers(a: SampleState, b: SampleState, k: number): boolean {
  return Math.abs(a.x[k] - b.x[k]) > 1e-6 || Math.abs(a.z[k] - b.z[k]) > 1e-6 || Math.abs(a.curv[k] - b.curv[k]) > 1e-9;
}
function sampleKeyDiffers(a: SampleState, b: SampleState, k: number): boolean {
  return Math.abs(a.halfW[k] - b.halfW[k]) > 1e-9 || Math.abs(a.thalweg[k] - b.thalweg[k]) > 1e-9
    || Math.abs(a.height[k] - b.height[k]) > 1e-9;
}

/** A cache of the ground's noise at fixed points (NaN = not computed yet). */
class NoiseCache {
  readonly vals: Float64Array;
  private c = 0;
  private x = 0;
  private z = 0;
  constructor(count: number, private readonly seed: number) {
    this.vals = new Float64Array(count * 8).fill(Number.NaN);
  }
  /** Point the cache at point `c`, at (x, z). */
  at_(c: number, x: number, z: number): this {
    this.c = c; this.x = x; this.z = z;
    return this;
  }
  at(k: number): number {
    const o = this.c * 8 + k;
    let v = this.vals[o];
    if (Number.isNaN(v)) { v = terrainNoiseAt(this.x, this.z, this.seed, k); this.vals[o] = v; }
    return v;
  }
}

/** Bilinear read of a row-major grid at fractional cell coordinates (clamped). */
/**
 * THE SPILL LEVEL of every cell (2026-10-24, GG-427): the lowest water level
 * at which water standing at the cell can leave the grid over its east
 * (outflow) edge. It is the highest bed on the lowest path out (a minimax),
 * found by a priority flood from the edge (Barnes, Lehman and Mulla 2014):
 * each cell enters the queue once, at max(its bed, the level it was reached
 * from). Water at rest fills a basin to exactly this level; on a slope or a
 * fall face the level equals the bed, so no water rests there. Cells with a
 * non-finite bed are walls. Returns Infinity where no path leaves the grid.
 */
export function spillLevels(bed: ArrayLike<number>, nx: number, nz: number): Float64Array {
  const n = nx * nz, level = new Float64Array(n).fill(Infinity), seen = new Uint8Array(n);
  // A binary min-heap of cells keyed by level; each cell is pushed once.
  const heap = new Int32Array(n); let size = 0;
  const up = (k: number) => { const c = heap[k]; const v = level[c];
    while (k > 0) { const pk = (k - 1) >> 1, pc = heap[pk]; if (level[pc] <= v) break; heap[k] = pc; k = pk; } heap[k] = c; };
  const down = (k: number) => { const c = heap[k]; const v = level[c];
    for (;;) { let m = 2 * k + 1; if (m >= size) break; if (m + 1 < size && level[heap[m + 1]] < level[heap[m]]) m++;
      if (level[heap[m]] >= v) break; heap[k] = heap[m]; k = m; } heap[k] = c; };
  const push = (c: number, v: number) => { level[c] = v; seen[c] = 1; heap[size] = c; up(size++); };
  for (let j = 0; j < nz; j++) { const c = j * nx + nx - 1; if (Number.isFinite(bed[c])) push(c, bed[c]); }
  while (size) {
    const c = heap[0]; heap[0] = heap[--size]; if (size) down(0);
    const i = c % nx, L = level[c];
    const visit = (nb: number) => { if (seen[nb] || !Number.isFinite(bed[nb])) return; push(nb, Math.max(L, bed[nb])); };
    if (i > 0) visit(c - 1); if (i < nx - 1) visit(c + 1); if (c >= nx) visit(c - nx); if (c + nx < n) visit(c + nx);
  }
  return level;
}

/** A checksum of the solver bed, so a saved warm start is never loaded onto a
 * changed terrain. Same bed, same number; any edit to the course changes it. */
export function bedChecksum(bed: ArrayLike<number>): number {
  let sum = 0;
  for (let c = 0; c < bed.length; c++) if (Number.isFinite(bed[c])) sum = (sum + bed[c] * ((c % 9973) + 1)) % 1e9;
  return sum;
}

/**
 * THE WARM-START FILE (2026-10-24): a 4-byte header length, a JSON header
 * padded so the arrays start on a 4-byte boundary, then the wet cells only:
 * cell index (Int32), h, hu, hv (Float32). Written by the bake script from a
 * filled start run to steady flow; read by LiveRiver.startWarm.
 */
export interface RiverWarmHeader { simTime: number; cells: number; n: number; bedSum: number; added?: number; inVolume?: number; outVolume?: number }
export function encodeRiverWarmState(head: RiverWarmHeader, h: ArrayLike<number>, hu: ArrayLike<number>, hv: ArrayLike<number>): Uint8Array {
  const wet: number[] = []; for (let c = 0; c < h.length; c++) if (h[c] > 0) wet.push(c);
  const json = JSON.stringify({ ...head, cells: wet.length });
  const pad = (4 - ((json.length + 4) % 4)) % 4, len = json.length + pad, k = wet.length;
  const out = new Uint8Array(4 + len + 16 * k), dv = new DataView(out.buffer);
  dv.setUint32(0, len, true);
  out.set(new TextEncoder().encode(json + ' '.repeat(pad)), 4);
  const idx = new Int32Array(out.buffer, 4 + len, k), H = new Float32Array(out.buffer, 4 + len + 4 * k, k);
  const HU = new Float32Array(out.buffer, 4 + len + 8 * k, k), HV = new Float32Array(out.buffer, 4 + len + 12 * k, k);
  wet.forEach((c, i) => { idx[i] = c; H[i] = h[c]; HU[i] = hu[c]; HV[i] = hv[c]; });
  return out;
}

function bilinear(a: ArrayLike<number>, nx: number, nz: number, fx: number, fz: number): number {
  const x = Math.max(0, Math.min(nx - 1.001, fx));
  const z = Math.max(0, Math.min(nz - 1.001, fz));
  const i = Math.floor(x);
  const j = Math.floor(z);
  const tx = x - i;
  const tz = z - j;
  const p = a[j * nx + i] + (a[j * nx + i + 1] - a[j * nx + i]) * tx;
  const q = a[(j + 1) * nx + i] + (a[(j + 1) * nx + i + 1] - a[(j + 1) * nx + i]) * tx;
  return p + (q - p) * tz;
}

/** The outer lattice of the render domain (RiverReachData.outer), 2 m. */
export interface OuterLattice { x0: number; z0: number; step: number; nx: number; nz: number; heights: Float32Array }

/**
 * THE LIVE RIVER. Build it once (it builds the judged reach, about 3 s, and
 * caches every cell's projection and noise, about 1 s), start its water from
 * a steady field (`startFromField`) or from the design level (`startCold`),
 * then call `advance` to step it, `applyEdit` to change it and `snapshot` to
 * draw it. The worker (riverWorker.ts) drives it; Node tests call it directly.
 */
export class LiveRiver {
  private readonly terrainBrush = new RiverTerrainBrush();
  private terrainBrushBounds: TerrainBrushBounds | null = null;

  /** Paint the worker's current ground, then use the ordinary terrain/bed
   * patch so drawn land, rocks and water see the same edited surface. */
  applyTerrainBrush(command: RiverTerrainBrushCommand): {patch: LiveBedPatch | null; undoCount: number} {
    return this.applyTerrainBrushBatch([command]);
  }

  /** Rebuild once for an ordered group, instead of once per pointer dab.
   * Intermediate brush heights are read through sparse offsets; the accepted
   * native bed, water remap and drawing patch still commit together. */
  applyTerrainBrushBatch(commands:readonly RiverTerrainBrushCommand[]): {patch: LiveBedPatch | null; undoCount: number} {
    this.frameAll = true;
    const g=this.grid,o=this.outerDef;
    const bounds=this.terrainBrush.applyBatch(commands,[
      {id:'ground',nx:g.nx,nz:g.nz,step:g.dx,x0:g.x0+g.dx/2,z0:g.z0+g.dx/2,heights:this.ground},
      {id:'outer',nx:o.nx,nz:o.nz,step:o.step,x0:o.x0,z0:o.z0,heights:this.outerHeights},
    ]);
    if(!bounds)return {patch:null,undoCount:this.terrainBrush.undoCount};
    this.terrainBrushBounds=bounds;
    try{return {patch:this.applyEdit({shape:this.shape,course:this.edit}),undoCount:this.terrainBrush.undoCount};}
    finally{this.terrainBrushBounds=null;}
  }

  /**
   * THE WORLD'S GROUND CHANGED (agora-257c, 2026-10-29, GG-533). A spell or a
   * tool cut a shape into the world's one ground (groundRecord.ts); the main
   * thread sends the new fine-ground values over the box it changed. The
   * river's default ground (the bed with no brush) is read again there from
   * the world bed, and the ordinary bed patch runs over the box: the solver
   * takes the new bed and KEEPS THE WATER'S VOLUME, as for the brush and
   * spells (updateBed keepVolume): water on raised ground runs off it, a dug
   * hole fills from its neighbors, and no water is made or deleted (the
   * patch's volumeChange is 0). The page gets the drawing patch. The river keeps no copy of the edit of its own:
   * the next read of the world bed already has it. `box` is river-local m.
   */
  applyWorldGround(patch: WorldFineGroundPatch, box: TerrainBrushBounds): LiveBedPatch {
    const bed = getRiverWorldBed();
    if (!bed?.fine) throw Error('[river] The world ground changed, but this river has no fine world bed.');
    applyFineGroundPatch(bed.fine, patch);
    const g = this.grid;
    const gDef = this.reach.ground;
    const i0 = Math.max(0, Math.floor((box.x0 - g.x0) / g.dx)), i1 = Math.min(g.nx - 1, Math.ceil((box.x1 - g.x0) / g.dx));
    const j0 = Math.max(0, Math.floor((box.z0 - g.z0) / g.dx)), j1 = Math.min(g.nz - 1, Math.ceil((box.z1 - g.z0) / g.dx));
    for (let j = j0; j <= j1; j += 1) {
      for (let i = i0; i <= i1; i += 1) gDef[j * g.nx + i] = worldBedHeightLocal(bed, g.x0 + (i + 0.5) * g.dx, g.z0 + (j + 0.5) * g.dx);
    }
    const o = this.outerDef;
    const oi0 = Math.max(0, Math.floor((box.x0 - o.x0) / o.step)), oi1 = Math.min(o.nx - 1, Math.ceil((box.x1 - o.x0) / o.step));
    const oj0 = Math.max(0, Math.floor((box.z0 - o.z0) / o.step)), oj1 = Math.min(o.nz - 1, Math.ceil((box.z1 - o.z0) / o.step));
    for (let j = oj0; j <= oj1; j += 1) {
      for (let i = oi0; i <= oi1; i += 1) o.heights[j * o.nx + i] = worldBedHeightLocal(bed, o.x0 + i * o.step, o.z0 + j * o.step);
    }
    this.frameAll = true;
    this.terrainBrushBounds = box;
    try { return this.applyEdit({ shape: this.shape, course: this.edit }); }
    finally { this.terrainBrushBounds = null; }
  }

  private readonly sourceHistory = new RiverSourceHistory();
  private sourceFlightDelayS = 0;
  private readonly floodSurge = new RiverFloodSurge();
  private floodDriving = false;
  private floodInjectedExtraM3 = 0;

  get flood(): RiverFloodStatus {
    // The helper schedules arrival; the actual receiver may reject it. Report
    // the rate accepted by the solver, alongside its integrated added volume.
    return { ...this.floodSurge.status(this.simTime, this.shape.dischargeM3S),
      source: this.sourceHistory.status(this.sourceFlightDelayS),
      sourceM3S: this.sourceAt(this.simTime),
      landingM3S: this.contactFlow ? this.contactArrivalRate : this.solver.discharge, extraLandedM3: this.floodInjectedExtraM3 };
  }

  /** Feed a temporary hydrograph without rebuilding the bed or topping up the field. */
  startFlood(options: RiverFloodOptions = {}): boolean {
    if (this.sourceHistory.paused) return false;
    const started = this.floodSurge.start(this.simTime, this.shape.dischargeM3S, this.headwaters ? this.waterfallLanding?.flightS ?? 0 : 0, options);
    if (started) {
      this.floodDriving = true;
      this.floodInjectedExtraM3 = 0;
      this.updateInflow();
    }
    return started;
  }

  /** Source pause leaves the solver clock and every admitted water cell alone. */
  setSourcePaused(paused: boolean): void {
    if (paused === this.sourceHistory.paused) return;
    this.sourceHistory.record(this.simTime, this.shape.dischargeM3S);
    if (paused) this.floodSurge.stop(this.simTime);
    this.sourceHistory.paused = paused;
    this.sourceHistory.record(this.simTime, this.shape.dischargeM3S);
    this.updateInflow();
  }

  private sourceAt(timeS: number): number {
    return riverSourceAt(this.sourceHistory.status(this.sourceFlightDelayS),
      this.floodSurge.status(this.simTime, this.shape.dischargeM3S).pulse, timeS);
  }

  cancelFlood(): void { this.floodSurge.cancel(this.simTime); this.updateInflow(); }
  private waterfallLanding: WaterfallLandingState | null = null;
  private contactFlow: WaterfallContactFlow | null = null;
  private contactRequested = false;
  private contactPending: ContactArrival[] = [];
  private contactAcceptedVolume = 0;
  private contactAcceptedMomentum: [number, number, number] = [0, 0, 0];
  private contactDissipatedEnergy = 0;
  private contactArrivalRate = 0;
  private goodContact: { state: ReturnType<WaterfallContactFlow['saveState']>; pending: ContactArrival[];
    accepted: number; momentum: [number, number, number]; energy: number; arrivalRate: number;
    inVolume: number; outVolume: number; steps: number; floodExtra: number; landing: WaterfallLandingState | null } | null = null;

  /** Start empty at the worker's present clock. Turning it off drains all
   * water admitted earlier before the ordinary inflow can resume. */
  setContactWaterfall(enabled: boolean, impactMode: 'absorb' | 'junction' = 'absorb'): void {
    if (!this.headwaters && enabled) throw Error('Contact waterfall requires headwaters');
    this.contactRequested = enabled;
    if (enabled && !this.contactFlow) {
      this.contactFlow = new WaterfallContactFlow({ startTime: this.simTime, dt: 1 / 60,
        parcelsPerStep: 6, maxParcels: 20000, maxStepsPerAdvance: 120, impactMode });
      this.contactAcceptedVolume = 0; this.contactAcceptedMomentum = [0, 0, 0]; this.contactDissipatedEnergy = 0;
    }
    this.updateInflow();
    if (enabled) this.checkHealth();
  }

  private advanceContact(dt: number): void {
    const flow = this.contactFlow;
    if (!flow) return;
    const source = waterfallHydraulics(this.shape);
    const emitting = this.contactRequested;
    const result = flow.advanceTo(this.simTime + dt, time => ({ ...source,
      q: emitting ? this.sourceAt(time) : 0,
      speed: (emitting ? this.sourceAt(time) : 0) / (source.width * source.depth), pool: WATERFALL.poolLevel }));
    this.contactPending.push(...result.arrivals);
    const crest = this.course.at(WATERFALL.crestS);
    const { nx, nz, dx, x0, z0 } = this.grid;
    const retained: ContactArrival[] = [];
    const acceptedCells = new Map<number, number>();
    let accepted = 0, verticalEnergy = 0, weightedX = 0, weightedZ = 0;
    for (const arrival of this.contactPending) {
      const [forward, , lateral] = arrival.position;
      const x = crest.x + crest.tx * forward + crest.tz * lateral;
      const z = crest.z + crest.tz * forward - crest.tx * lateral;
      const i = Math.floor((x - x0) / dx), j = Math.floor((z - z0) / dx);
      // Search only near this physical arrival. An out-of-domain trajectory
      // keeps ownership; it is never clamped into a distant arbitrary cell.
      let cell = -1, distance = Infinity;
      if (i >= 0 && i < nx && j >= 0 && j < nz) {
        const radius = Math.ceil(6 / dx);
        for (let jj = Math.max(0, j - radius); jj <= Math.min(nz - 1, j + radius); jj++) {
          for (let ii = Math.max(0, i - radius); ii <= Math.min(nx - 1, i + radius); ii++) {
            const c = jj * nx + ii;
            const d = (x0 + (ii + 0.5) * dx - x) ** 2 + (z0 + (jj + 0.5) * dx - z) ** 2;
            if (d <= 36 && d < distance && this.solver.h[c] > 0.02 && Number.isFinite(this.solver.bed[c])
              && this.solver.bed[c] < WATERFALL.poolLevel) { cell = c; distance = d; }
          }
        }
      }
      const momentum: [number, number, number] = [
        (crest.tx * arrival.momentum[0] + crest.tz * arrival.momentum[2]) / 1000,
        arrival.momentum[1] / 1000,
        (crest.tz * arrival.momentum[0] - crest.tx * arrival.momentum[2]) / 1000];
      if (cell < 0 || !this.solver.depositWater(cell, arrival.volume, momentum)) { retained.push(arrival); continue; }
      accepted += arrival.volume; weightedX += x * arrival.volume; weightedZ += z * arrival.volume;
      const energy = 0.5 * 1000 * arrival.volume * arrival.velocity[1] ** 2;
      verticalEnergy += energy; this.contactDissipatedEnergy += energy;
      this.contactAcceptedVolume += arrival.volume;
      for (let k = 0; k < 3; k++) this.contactAcceptedMomentum[k] += momentum[k] * 1000;
      acceptedCells.set(cell, (acceptedCells.get(cell) ?? 0) + arrival.volume);
    }
    this.contactPending = retained;
    this.contactArrivalRate = dt > 0 ? accepted / dt : 0;
    // Foam reads energy from the same accepted mass stencil. The prototype
    // reports all vertical kinetic energy as dissipated; no invented radial
    // momentum is added to the native pool.
    this.waterfallLanding = { x: accepted ? weightedX / accepted : crest.x, z: accepted ? weightedZ / accepted : crest.z,
      tx: crest.tx, tz: crest.tz, width: source.width, depth: source.depth, speed: source.speed, top: source.top,
      flightS: source.flightS, poolLevel: WATERFALL.poolLevel, forward: 0, crestX: crest.x, crestZ: crest.z,
      discharge: this.contactArrivalRate, impactEnergy: {
        receivingDepth: accepted ? [...acceptedCells].reduce((sum, [c, v]) => sum + this.solver.h[c] * v / accepted, 0) : 0,
        fallSpecificEnergy: accepted ? verticalEnergy / (1000 * accepted) : 0, radialSpecificEnergy: 0,
        dissipatedSpecificEnergy: accepted ? verticalEnergy / (1000 * accepted) : 0,
        cells: [...acceptedCells].map(([c, v]) => ({ c, share: v / accepted })) } };
  }

  private finishContactDrain(): void {
    const flow = this.contactFlow;
    if (flow && !this.contactRequested && flow.totalOwnedVolume === 0 && this.contactPending.length === 0) {
      // Commit the ownership transition only after both owners pass health.
      // A failed check may restore water in flight or on the ledge. Film is
      // still owned water even when no ballistic parcels remain; numerical
      // tails stay visible in the receipt instead of being silently discarded.
      this.checkHealth();
      if (flow.totalOwnedVolume === 0 && this.contactPending.length === 0) {
        this.contactFlow = null; this.goodContact = null; this.updateInflow();
      }
    }
  }

  private contactSnapshot(): ContactPoolSnapshot | null {
    return this.contactFlow ? { ...this.contactFlow.snapshot(), pool: {
      acceptedVolume: this.contactAcceptedVolume, pendingVolume: this.contactPending.reduce((v, a) => v + a.volume, 0),
      acceptedMomentum: [this.contactAcceptedMomentum[0], 0, this.contactAcceptedMomentum[2]],
      verticalReactionNs: -this.contactAcceptedMomentum[1], dissipatedEnergy: this.contactDissipatedEnergy,
      arrivalRate: this.contactArrivalRate, requested: this.contactRequested, capacityBlocked: this.contactPending.length >= 20000 } } : null;
  }
  readonly seed: number;
  readonly grid: RiverGridSpec;
  /** The judged reach. Its arrays are never changed. */
  readonly reach: RiverReach;
  readonly outerDef: OuterLattice;
  /** The ground now (no boulders), the bed now (the solver's), m. */
  readonly ground: Float64Array;
  readonly cellS: Float32Array;
  readonly cellN: Float32Array;
  readonly manning: Float32Array;
  readonly ceiling: Float64Array;
  /** The boulders now (the judged list, moved). */
  readonly boulders: Boulder[];
  readonly outerHeights: Float32Array;
  readonly solver: RiverFlowSolver;
  shape: RiverShape = RIVER_SHAPE_DEFAULT;
  course: RiverCourse;
  edit: RiverCourseEdit | null = null;
  /** The flow's time since the live run started, s. */
  simTime = 0;

  /** Read current raw cell inventory without changing the solver or its displayed mean.
   * The worker adds request/run provenance; this read cannot certify a drawn-frame pair. */
  inspectCells(cellIds: unknown): RawRiverCells {
    return copyRawRiverCells({
      grid: this.grid, h: this.solver.h, hu: this.solver.hu, hv: this.solver.hv,
      bed: this.solver.bed, ground: this.ground, time: this.solver.time,
      steps: this.solver.steps, liveSimTime: this.simTime,
    }, cellIds);
  }

  private readonly n: number;
  private readonly fieldsDef: OutsideFields;
  private fields: OutsideFields;
  private readonly defState: SampleState;
  private cur: SampleState;
  /** Per sample: 1 where the edit now differs from the judged course (place or key). */
  private changed: Uint8Array;
  /** The changed stretches of the course, as [sStart, sEnd] pairs of s (design s). */
  private intervals: number[] = [];
  /** Every cell's projection on the course now, and on the judged course (s, n, distance). */
  private readonly prS: Float64Array;
  private readonly prN: Float64Array;
  private readonly prD: Float64Array;
  private readonly defS: Float64Array;
  private readonly defN: Float64Array;
  private readonly noise: NoiseCache;
  private readonly outerNoise: NoiseCache;
  private readonly outerDefPr: Float64Array;
  /** The steps' running sums since the last flow map, and their span (s). */
  private readonly acc: { sh: Float64Array; shu: Float64Array; shv: Float64Array; su2: Float64Array };
  private accT = 0;
  private outAtSnap = 0;
  private simAtSnap = 0;
  /** The drawn field (depth, discharges, depth x speed squared), smoothed over RIVER_LIVE.smoothS. */
  private readonly disp: { h: Float32Array; qu: Float32Array; qv: Float32Array; q2: Float32Array };
  /**
   * THE LIVE CELLS (2026-10-22, GG-430): every cell whose integrals, display
   * values or water can be other than zero. `frame()` smooths and reads only
   * these; every other cell holds zeros, which the whole-grid pass would
   * leave at zero, so each frame is the same. A rare whole-grid writer
   * (start, top-up, warm start, edits, restore) sets `frameAll`: the next
   * frame takes the whole-grid pass and lists the live cells again.
   */
  private readonly liveMark: Uint8Array;
  private liveList: number[] = [];
  private liveSorted: Int32Array | null = null;
  private frameAll = true;
  private readonly markLive = (c: number): void => {
    if (this.liveMark[c]) return;
    this.liveMark[c] = 1; this.liveList.push(c); this.liveSorted = null;
  };
  private readonly W: Float32Array;
  private readonly T: Float32Array;
  private readonly L: Float32Array;
  private good: ReturnType<RiverFlowSolver['saveState']> | null = null;
  private goodAt = -1;
  /** Blow-ups caught and states restored since the run started. */
  restores = 0;
  lastHealth = { ok: true, badCells: 0, maxSpeed: 0 };
  /**
   * A DRY INFLOW (Remy, 2026-09-30: "there's an error"). An edit that lifts
   * the bed above the design level at the west edge leaves no wet inflow
   * cell, and `reachInflow` throws. That threw out of the worker's message
   * handler, the page showed a red error over the scene, and the live river
   * was dead until a reload. Now the solver keeps its last inflow and says so
   * here; the page shows the words. The next edit that wets the edge clears it.
   */
  inflowDry = false;
  /**
   * THE EDITED DESIGN LEVEL per meter of s from LEVEL_S0 (see buildLevelTable),
   * or null with no node height (then the design level is designLevelAt's).
   */
  private levelTable: Float64Array | null = null;
  /** The water the edits took and added, and the top-ups added, since the run started, m^3. */
  editLostM3 = 0;
  editAddedM3 = 0;
  topUpM3 = 0;

  private spillTransfer: RiverSpillTransfer | null = null;

  constructor(seed = 20260928, private readonly headwaters = false, private readonly spillEnabled = false, reconstructed=false) {
    this.seed = seed;
    // The browser's expanded landscape shares one solver. Tests and the
    // original comparison captures keep their original domain by default.
    setRiverHeadwaters(headwaters,reconstructed);
    // The judged reach, built with no shape and no edit.
    setRiverShape(null);
    setRiverCourseEdit(null);
    // With a world bed the default shape carries the world river's own flow
    // (one water, 2026-10-30); on the page it is RIVER_SHAPE_DEFAULT, as before.
    this.shape = getRiverShape();
    const reach = buildRiverReach(seed, headwaters ? headwatersGrid(reconstructed) : RIVER_GRID);
    this.reach = reach;
    this.grid = reach.grid;
    const { nx, nz, dx, x0, z0 } = reach.grid;
    const n = nx * nz;
    this.n = n;
    this.course = reach.course;
    this.ground = reach.ground.slice();
    this.cellS = reach.cellS.slice();
    this.cellN = reach.cellN.slice();
    this.manning = reach.manning.slice();
    this.boulders = reach.boulders.map((b) => ({ ...b }));
    this.fieldsDef = new OutsideFields(reach.course);
    this.fields = this.fieldsDef.clone();
    this.defState = sampleState(reach.course);
    this.cur = this.defState;
    this.changed = new Uint8Array(reach.course.samples.length);
    // Every cell's projection (exact, not the reach's float32 copy) and noise.
    this.prS = new Float64Array(n);
    this.prN = new Float64Array(n);
    this.prD = new Float64Array(n);
    for (let j = 0; j < nz; j += 1) {
      for (let i = 0; i < nx; i += 1) {
        const c = j * nx + i;
        const pr = reach.course.project(x0 + (i + 0.5) * dx, z0 + (j + 0.5) * dx);
        this.prS[c] = pr.s; this.prN[c] = pr.n; this.prD[c] = pr.d;
      }
    }
    this.defS = this.prS.slice();
    this.defN = this.prN.slice();
    this.noise = new NoiseCache(n, seed);
    // The outer lattice, as the worker builds it for the page.
    // Reuse the native outer-land lattice around the complete deep course.
    // Only distant landscape samples become8m; all water cells remain0.5m.
    const D = reconstructed?reconstructionLandscapeDomain():RIVER_RENDER_DOMAIN;
    const step = reconstructed?reconstructionLandscapeDomain().step:2;
    const onx = Math.floor((D.x1 - D.x0) / step) + 1;
    const onz = Math.floor((D.z1 - D.z0) / step) + 1;
    const heights = new Float32Array(onx * onz);
    for (let j = 0; j < onz; j += 1) {
      for (let i = 0; i < onx; i += 1) heights[j * onx + i] = reach.terrainHeight(D.x0 + i * step, D.z0 + j * step);
    }
    this.outerDef = { x0: D.x0, z0: D.z0, step, nx: onx, nz: onz, heights };
    this.outerHeights = heights.slice();
    this.outerNoise = new NoiseCache(onx * onz, seed);
    this.outerDefPr = new Float64Array(onx * onz * 3).fill(Number.NaN);
    // The solver on the judged bed, with the judged ceiling and inflow.
    const st = reachStartState(reach.grid, reach.bed, reach.cellS, reach.cellN, reach.course, reach.dischargeM3S);
    this.ceiling = st.ceiling;
    const inf = reachInflow(reach.grid, st.h0, reach.cellS, reach.cellN, reach.course, mainRiverShareM3S(reach.dischargeM3S), reach.bed);
    this.waterfallLanding = inf.waterfallLanding ?? null;
    this.sourceFlightDelayS = this.headwaters ? this.waterfallLanding?.flightS ?? 0 : 0;
    this.sourceHistory.record(0, this.shape.dischargeM3S);
    this.solver = new RiverFlowSolver({
      grid: reach.grid, bed: reach.bed, manning: reach.manning, dischargeM3S: reach.dischargeM3S,
      inflow: withWorldTributaries(reach.grid, reach.bed, inf.inflow), inflowDir: inf.dir, inflowSpeedMS: inf.speed, outflowEdge: 'east',
    }, st.ceiling);
    // Ordinary live flow also awakens nearby dry land when its actual surface
    // approaches it. A design-height estimate must not be an invisible flood wall.
    const allowed = new Uint8Array(n);
    for (let c = 0; c < n; c++) allowed[c] = !airborneHeadwater(this.cellS[c]) && Number.isFinite(this.solver.bed[c]) ? 1 : 0;
    this.solver.enableWetFrontExpansion(allowed);
    if (headwaters && spillEnabled) {
      // DETECTED LIPS (2026-10-21): every face on the grid may launch water,
      // and only the separation test in RiverSpillTransfer decides which do.
      // This replaced a hand list of the pool crest's faces near
      // POOL_SPILL.crestS: that list missed the seven reference falls, and
      // there the water slid down each wall as a film. The test reads only
      // the bed and the water now, so it follows edits with no refresh.
      this.spillTransfer = new RiverSpillTransfer(this.grid, [], WATERFALL.gravity, { detect: true });
      this.solver.setSpillTransfer(this.spillTransfer);
    }
    this.acc = { sh: new Float64Array(n), shu: new Float64Array(n), shv: new Float64Array(n), su2: new Float64Array(n) };
    this.disp = { h: new Float32Array(n), qu: new Float32Array(n), qv: new Float32Array(n), q2: new Float32Array(n) };
    this.liveMark = new Uint8Array(n);
    this.solver.onWater = this.markLive;
    this.W = new Float32Array(n);
    this.T = new Float32Array(n);
    this.L = new Float32Array(n);
  }

  /**
   * THE DESIGN LEVEL the solver's ceiling, the top-up and the inflow read:
   * designLevelAt's, or with node heights the edited one (buildLevelTable).
   */
  levelAt(s: number): number {
    if (s >= MAIN_CHANNEL_S || headwaterKey(s)) return designLevelAt(s);
    const T = this.levelTable;
    if (!T) return designLevelAt(s);
    const g = Math.max(0, Math.min(LEVEL_S1 - LEVEL_S0 - 1e-9, s - LEVEL_S0));
    const q = Math.floor(g);
    return T[q] + (T[Math.min(T.length - 1, q + 1)] - T[q]) * (g - q);
  }

  /** The ground now at (x, z), bilinear on the solver grid, or NaN outside it. */
  private gridGround(x: number, z: number): number {
    const { nx, nz, dx, x0, z0 } = this.grid;
    const fi = (x - x0) / dx - 0.5;
    const fj = (z - z0) / dx - 0.5;
    if (!(fi >= 0 && fi <= nx - 1 && fj >= 0 && fj <= nz - 1)) return Number.NaN;
    return bilinear(this.ground, nx, nz, fi, fj);
  }

  /** The raised stretches of the last level table: their design s, the pass over each (its level and its sill's side), or no pass. */
  private stretches: Array<{ sA: number; sB: number; pass: number; sillN: number; noPass: boolean }> = [];

  /**
   * THE PASS OVER A RAISED STRETCH (design s from sA to sB): the lowest water
   * level at which water from upstream of the stretch can reach downstream of
   * it, inside the solver's band (the bank plus 6 m, where the wet ceiling
   * lets water go). A MINIMAX FLOOD on the bed: from the cells 5 m upstream
   * of the stretch, each path's cost is the highest bed on it, and the first
   * cell 5 m downstream of the stretch that the flood reaches gives the pass
   * and the cell where that highest bed is (the SILL). The lowest point of
   * one cross-section is not enough: the lows of successive sections can lie
   * on opposite banks (a 1.6 m raise in the boulder reach: 3.43 m at the
   * crest's lowest point, and the water spilled near 4.0 m). Null when no path
   * stays inside the band.
   */
  private passLevel(sA: number, sB: number, bed: ArrayLike<number>): { z: number; sillN: number } | null {
    const { nx, nz, dx, x0, z0 } = this.grid;
    const lo = sA - 10;
    const hi = sB + 10;
    let bx0 = Infinity; let bz0 = Infinity; let bx1 = -Infinity; let bz1 = -Infinity;
    for (let s = lo; s <= hi; s += 1) {
      const smp = this.course.at(s);
      const W = courseKeyAt(s).halfW + 8;
      bx0 = Math.min(bx0, smp.x - W); bx1 = Math.max(bx1, smp.x + W);
      bz0 = Math.min(bz0, smp.z - W); bz1 = Math.max(bz1, smp.z + W);
    }
    const i0 = Math.max(0, Math.floor((bx0 - x0) / dx));
    const i1 = Math.min(nx - 1, Math.ceil((bx1 - x0) / dx));
    const j0 = Math.max(0, Math.floor((bz0 - z0) / dx));
    const j1 = Math.min(nz - 1, Math.ceil((bz1 - z0) / dx));
    if (i1 < i0 || j1 < j0) return null;
    const bw = i1 - i0 + 1;
    const cnt = bw * (j1 - j0 + 1);
    // Per region cell: 0 out of the band, 1 in it, 2 a source (upstream), 3 a target (downstream).
    const role = new Uint8Array(cnt);
    for (let j = j0; j <= j1; j += 1) {
      for (let i = i0; i <= i1; i += 1) {
        const c = j * nx + i;
        const s = this.cellS[c];
        if (s < lo || s > hi || Math.abs(this.cellN[c]) >= courseKeyAt(s).halfW + 6) continue;
        role[(j - j0) * bw + (i - i0)] = s < sA - 5 ? 2 : s > sB + 5 ? 3 : 1;
      }
    }
    const dist = new Float64Array(cnt).fill(Infinity);
    const sill = new Int32Array(cnt).fill(-1);
    // A binary heap of (cost, region cell), with stale entries skipped.
    let hk = new Float64Array(1024);
    let hv = new Int32Array(1024);
    let hn = 0;
    const push = (k: number, v: number): void => {
      if (hn === hk.length) {
        const nk = new Float64Array(hn * 2); nk.set(hk); hk = nk;
        const nv = new Int32Array(hn * 2); nv.set(hv); hv = nv;
      }
      let a = hn;
      hn += 1;
      while (a > 0) {
        const up = (a - 1) >> 1;
        if (hk[up] <= k) break;
        hk[a] = hk[up]; hv[a] = hv[up]; a = up;
      }
      hk[a] = k; hv[a] = v;
    };
    const pop = (): number => {
      const top = hv[0];
      hn -= 1;
      const k = hk[hn];
      const v = hv[hn];
      let a = 0;
      for (;;) {
        let b = 2 * a + 1;
        if (b >= hn) break;
        if (b + 1 < hn && hk[b + 1] < hk[b]) b += 1;
        if (hk[b] >= k) break;
        hk[a] = hk[b]; hv[a] = hv[b]; a = b;
      }
      hk[a] = k; hv[a] = v;
      return top;
    };
    const cellOf = (r: number): number => (j0 + Math.floor(r / bw)) * nx + i0 + (r % bw);
    for (let r = 0; r < cnt; r += 1) {
      if (role[r] !== 2) continue;
      dist[r] = bed[cellOf(r)];
      sill[r] = r;
      push(dist[r], r);
    }
    while (hn > 0) {
      const kTop = hk[0];
      const r = pop();
      if (kTop > dist[r]) continue;
      if (role[r] === 3) return { z: dist[r], sillN: this.cellN[cellOf(sill[r])] };
      const ri = r % bw;
      const nbs = [ri > 0 ? r - 1 : -1, ri < bw - 1 ? r + 1 : -1, r - bw, r + bw];
      for (const q of nbs) {
        if (q < 0 || q >= cnt || role[q] === 0) continue;
        const bq = bed[cellOf(q)];
        const nd = bq > dist[r] ? bq : dist[r];
        if (nd < dist[q]) {
          dist[q] = nd;
          sill[q] = bq > dist[r] ? q : sill[r];
          push(nd, q);
        }
      }
    }
    return null;
  }

  /**
   * THE EDITED DESIGN LEVEL (the node heights, 2026-09-29), per meter of s,
   * from the solver's new bed. A raised stretch of bed CONTROLS the water:
   * the flow must cross its pass (`passLevel`), so the water over the stretch
   * and upstream of it stands at least `spillDepthM` over the pass. A backward
   * sweep carries the highest control upstream as a POND, until the bed's
   * middle there stands over the pond. The level is the larger of
   * designLevelAt's and the pond's. The solver's wet ceiling sits on it, so
   * the water can pond and spill over the pass instead of stopping at the
   * ceiling's wall; the top-up fills the pond. A stretch with no pass inside
   * the band raises nothing: the water rises to the ceiling there and stops,
   * and its node report says so. A lowered stretch controls nothing: its
   * water stands at the level the bed downstream holds, only deeper.
   */
  private buildLevelTable(bed: ArrayLike<number>): Float64Array | null {
    const e = this.edit;
    this.stretches = [];
    if (!e || !e.heights || !e.heights.some((h) => h !== 0)) return null;
    const len = LEVEL_S1 - LEVEL_S0 + 1;
    const out = new Float64Array(len);
    for (let q = 0; q < len; q += 1) out[q] = designLevelAt(LEVEL_S0 + q);
    if (!e.heights.some((h) => h > 0)) return out;
    const control = new Float64Array(len).fill(-Infinity);
    const depth = RIVER_LIVE.spillDepthM * riverFlowDepthFactor();
    let a = -1;
    for (let q = 0; q < len; q += 1) {
      const raised = riverHeightAt(LEVEL_S0 + q) > 0.01;
      if (raised && a < 0) a = q;
      if ((!raised || q === len - 1) && a >= 0) {
        const b = raised ? q : q - 1;
        const sA = LEVEL_S0 + a;
        const sB = LEVEL_S0 + b;
        const pass = this.passLevel(sA, sB, bed);
        this.stretches.push({ sA, sB, pass: pass ? pass.z : Infinity, sillN: pass ? pass.sillN : 0, noPass: !pass });
        if (pass) for (let k = a; k <= b; k += 1) control[k] = pass.z + depth;
        a = -1;
      }
    }
    let P = -Infinity;
    for (let q = len - 1; q >= 0; q -= 1) {
      const s = LEVEL_S0 + q;
      if (control[q] > P) P = control[q];
      if (P === -Infinity) continue;
      // The bed's middle here stands over the pond: the pond ends here, and
      // upstream of it the level is its own again.
      if (courseKeyAt(s).thalweg + riverHeightAt(s) > P) P = control[q];
      if (P > out[q]) out[q] = P;
    }
    return out;
  }

  /** What each raised or lowered point does to the water (see RiverNodeReport). */
  private nodeReports(): RiverNodeReport[] {
    const e = this.edit;
    const out: RiverNodeReport[] = [];
    if (!e || !e.heights) return out;
    const pS = defaultRiverCourse().pointS;
    for (const p of RIVER_EDITABLE_POINTS) {
      const h = e.heights[p];
      if (!h) continue;
      const s = pS[p];
      const smp = this.course.at(s);
      const center = this.gridGround(smp.x, smp.z);
      if (Number.isNaN(center)) continue;
      const base = designLevelAt(s);
      const level = this.levelAt(s);
      const hw = courseKeyAt(s).halfW;
      const st = h > 0 ? this.stretches.find((q) => q.sA <= s && s <= q.sB) : undefined;
      const noPass = !!st && st.noPass;
      const pass = st ? st.pass : Number.NaN;
      const kind: RiverNodeReport['kind'] = h < 0 ? 'deeper'
        : center < base - 0.02 ? 'shallower'
          : st && !noPass && pass < base - 0.02 ? 'split' : 'block';
      let pondM = 0;
      for (let q = Math.floor(s); q >= LEVEL_S0 && this.levelAt(q) > designLevelAt(q) + 0.05; q -= 1) pondM += 1;
      const sn = st ? st.sillN : 0;
      out.push({
        point: p, height: h, kind, center, base, level, pass, noPass,
        passSide: Math.abs(sn) < 0.3 * hw ? 'middle' : sn > 0 ? 'left' : 'right', pondM,
      });
    }
    return out;
  }

  /** Compute every cell's ground noise now (about 1 s), so the first edit does not pay for it. */
  warmNoise(): void {
    const { nx, nz, dx, x0, z0 } = this.grid;
    for (let j = 0; j < nz; j += 1) {
      for (let i = 0; i < nx; i += 1) {
        const src = this.noise.at_(j * nx + i, x0 + (i + 0.5) * dx, z0 + (j + 0.5) * dx);
        for (let k = 0; k < RIVER_TERRAIN_NOISE.length; k += 1) src.at(k);
      }
    }
  }

  /**
   * START FROM A STEADY FIELD (the page's cached one): the water where the
   * steady run left it, the carried foam from its flow map (t1: white water,
   * streaks, distance, turbulence).
   */
  startFromField(f: { h: Float32Array; u: Float32Array; v: Float32Array; uRms: Float32Array; t1?: Float32Array }): void {
    this.frameAll = true;
    const n = this.n;
    const h = new Float64Array(n);
    const u = new Float64Array(n);
    const v = new Float64Array(n);
    for (let c = 0; c < n; c += 1) { h[c] = f.h[c]; u[c] = f.u[c]; v[c] = f.v[c]; }
    this.solver.setState(h, u, v);
    for (let c = 0; c < n; c += 1) {
      const d = f.h[c];
      this.disp.h[c] = d;
      this.disp.qu[c] = d * f.u[c];
      this.disp.qv[c] = d * f.v[c];
      this.disp.q2[c] = d * (f.u[c] * f.u[c] + f.v[c] * f.v[c] + f.uRms[c] * f.uRms[c]);
      if (f.t1) {
        this.W[c] = f.t1[c * 4];
        this.L[c] = f.t1[c * 4 + 1];
        this.T[c] = Math.max(0,f.t1[c * 4 + 3]);
      }
    }
    this.solver.refreshWaveSpeed();
    if (this.headwaters) this.updateInflow();
  }

  /**
   * START FROM THE DESIGN LEVEL (no cached field): the start state of the
   * steady run, and the page watches it spin up.
   */
  startCold(): void {
    this.frameAll = true;
    this.spillTransfer?.reset(this.solver.time);
    const st = reachStartState(this.grid, this.solver.bed, this.cellS, this.cellN, this.course, this.solver.discharge);
    this.solver.setState(st.h0, st.u0, st.v0);
    const n = this.n;
    for (let c = 0; c < n; c += 1) {
      const d = st.h0[c];
      this.disp.h[c] = d;
      this.disp.qu[c] = d * st.u0[c];
      this.disp.qv[c] = d * st.v0[c];
      this.disp.q2[c] = d * (st.u0[c] * st.u0[c] + st.v0[c] * st.v0[c]);
    }
    this.solver.refreshWaveSpeed();
    if (this.headwaters) this.updateInflow();
  }

  /**
   * THE WATER TO CARRY (one water, step 1, 2026-10-30): copies of the depth,
   * the discharges and the bed, so a reach placed further along the world's
   * river starts from this reach's water where the two boxes overlap.
   */
  exportWater(): RiverWaterExport {
    return {
      h: Float32Array.from(this.solver.h), hu: Float32Array.from(this.solver.hu),
      hv: Float32Array.from(this.solver.hv), bed: Float32Array.from(this.solver.bed),
    };
  }

  /**
   * AFTER `startCold`: take the previous reach's water where its box covers
   * this one (`carryRiverWater`); the rest keeps the design level. Returns the
   * cells taken.
   */
  overlayCarry(carry: RiverWorldCarry, frame: RiverWorldFrame): number {
    const n = this.n;
    const h = Float64Array.from(this.solver.h);
    const u = new Float64Array(n);
    const v = new Float64Array(n);
    for (let c = 0; c < n; c += 1) {
      const d = h[c];
      if (d > 1e-6) { u[c] = this.solver.hu[c] / d; v[c] = this.solver.hv[c] / d; }
    }
    const taken = carryRiverWater(carry, frame, this.grid, this.solver.bed, { h, u, v });
    if (taken === 0) return 0;
    this.frameAll = true;
    this.solver.setState(h, u, v);
    for (let c = 0; c < n; c += 1) {
      const d = h[c];
      this.disp.h[c] = d;
      this.disp.qu[c] = d * u[c];
      this.disp.qv[c] = d * v[c];
      this.disp.q2[c] = d * (u[c] * u[c] + v[c] * v[c]);
    }
    this.solver.refreshWaveSpeed();
    if (this.headwaters) this.updateInflow();
    return taken;
  }

  /** A new, genuinely empty run. No design-level water or cached flow is
   * admitted. The existing upstream source and delayed landing remain the
   * only admission path; source shutoff preserves water already in transit.
   * Call only before advancing a fresh LiveRiver, never to erase live water. */
  startDry(): void {
    this.frameAll = true;
    if(this.solver.time!==0||this.solver.inVolume!==0||this.solver.outVolume!==0||this.solver.h.some(h=>h>0))
      throw Error('Dry start requires a fresh river; existing inventory must be retained');
    // Empty ground also means no water was released before this run began.
    // Keep the first pool admission behind its real flight delay, rather than
    // inheriting the steady source's pre-time-zero history.
    this.sourceHistory.beginDry(this.shape.dischargeM3S);
    this.solver.setState(new Float64Array(this.n));
    this.disp.h.fill(0);this.disp.qu.fill(0);this.disp.qv.fill(0);this.disp.q2.fill(0);
    this.solver.refreshWaveSpeed();
    if(this.headwaters)this.updateInflow();
  }

  /**
   * TOP UP TO THE DESIGN LEVEL: every cell of the channel (its half width and
   * 4 m past it) that stands under the design level (`levelAt`: with node
   * heights, their ponds too) takes water up to it, at
   * rest where it was dry; the water already higher keeps its level. A
   * narrowed channel loses the water over its new banks, and a widened one
   * starts dry: at the low summer flow the inflow needs about 20 minutes of
   * flow to fill a pool of 2,000 m^3 again. This skips the wait on purpose
   * (the page's "Top up" button, and "Reset river"). It adds water; the
   * solver then settles the level. Returns the water added, m^3.
   */
  topUpToDesignLevel(): number {
    this.frameAll = true;
    // The seven-falls course's design level stands above the rock on every
    // fall face; water put there slid past the blow-up limit (GG-427).
    if (riverReconstructionEnabled()) return this.fillBasinsToSpill();
    const s = this.solver;
    const { nx, nz, dx } = this.grid;
    let added = 0;
    const h = new Float64Array(s.h);
    const u = new Float64Array(nx * nz);
    const v = new Float64Array(nx * nz);
    for (let c = 0; c < nx * nz; c += 1) {
      const d = s.h[c];
      if (d > 1e-4) { u[c] = s.hu[c] / d; v[c] = s.hv[c] / d; }
      const sc = this.cellS[c];
      if (airborneHeadwater(sc)) continue;
      if (Math.abs(this.cellN[c]) >= courseKeyAt(sc).halfW + 4) continue;
      const want = this.levelAt(sc) - s.bed[c];
      if (want > d) {
        added += (want - d) * dx * dx;
        h[c] = want;
      }
    }
    s.setState(h, u, v);
    s.refreshWaveSpeed();
    this.topUpM3 += added;
    for (let c = 0; c < nx * nz; c += 1) {
      const d = s.h[c];
      this.disp.h[c] = d;
      this.disp.qu[c] = s.hu[c];
      this.disp.qv[c] = s.hv[c];
      this.disp.q2[c] = d > 1e-4 ? (s.hu[c] * s.hu[c] + s.hv[c] * s.hv[c]) / d : 0;
    }
    return added;
  }

  /**
   * THE WARM START (2026-10-24; Remy: "it seems a long time to wait"): the
   * water of a saved steady run (encodeRiverWarmState) on a dry river, so
   * every fall runs from the first frame. The file must match this river's
   * grid and bed exactly (bedChecksum); otherwise nothing changes and the
   * reason comes back for the page to show. Airborne parcels are not saved;
   * the lips launch again within the first step. Returns null when loaded.
   */
  startWarm(buf: ArrayBuffer): string | null {
    this.frameAll = true;
    if (buf.byteLength < 8) return 'the warm-start file is empty';
    const len = new DataView(buf).getUint32(0, true);
    const head = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, len))) as RiverWarmHeader;
    const k = head.cells, off = 4 + len;
    if (head.n !== this.n) return `the warm start holds ${head.n} cells, this river ${this.n}`;
    if (buf.byteLength !== off + 16 * k) return 'the warm-start file is cut short';
    const bedSum = bedChecksum(this.solver.bed);
    // The browser worker and Node round a few last bits of the terrain math
    // differently (checksums ...620.9000052 baked, ...620.9000067 in the page:
    // about 1e-13 m of bed). A real course edit moves the sum by at least about
    // 0.01, so a gap under 0.001 is the same bed.
    if (!(Math.abs(head.bedSum - bedSum) < 1e-3)) return `the river bed changed since the warm start was saved (checksum ${head.bedSum} saved, ${bedSum} now)`;
    const idx = new Int32Array(buf, off, k), h = new Float32Array(buf, off + 4 * k, k);
    const hu = new Float32Array(buf, off + 8 * k, k), hv = new Float32Array(buf, off + 12 * k, k);
    this.startDry();
    const n = this.n, H = new Float64Array(n), U = new Float64Array(n), V = new Float64Array(n);
    let added = 0;
    for (let i = 0; i < k; i++) { const c = idx[i]; H[c] = h[i]; U[c] = hu[i] / h[i]; V[c] = hv[i] / h[i]; added += h[i]; }
    this.solver.setState(H, U, V);
    this.solver.refreshWaveSpeed();
    // The panel's ledger counts the saved water with the top-ups.
    this.topUpM3 += added * this.grid.dx * this.grid.dx;
    for (let c = 0; c < n; c += 1) {
      const d = this.solver.h[c];
      this.disp.h[c] = d; this.disp.qu[c] = this.solver.hu[c]; this.disp.qv[c] = this.solver.hv[c];
      this.disp.q2[c] = d > 1e-4 ? (this.solver.hu[c] ** 2 + this.solver.hv[c] ** 2) / d : 0;
    }
    return null;
  }

  /**
   * FILL THE BASINS TO THEIR SPILL LEVEL (2026-10-24, GG-427): every channel
   * cell (the same band as the top-up) under its spill level (spillLevels)
   * takes water up to it, at rest; water already higher keeps its level.
   * This is the state of a river whose lakes and plunge pools are full and
   * whose flow has stopped: each pool stands at the lip of the fall below it,
   * and the fall faces and rapids stay dry. Inflow then spills at once, so
   * every fall runs within the flow's travel time, instead of the 41 minutes
   * a dry start needs to fill the raised pool. Returns the water added, m^3.
   */
  fillBasinsToSpill(): number {
    this.frameAll = true;
    const s = this.solver, { nx, nz, dx } = this.grid, n = nx * nz;
    const spill = spillLevels(s.bed, nx, nz);
    const h = new Float64Array(s.h), u = new Float64Array(n), v = new Float64Array(n);
    let added = 0;
    for (let c = 0; c < n; c += 1) {
      const d = s.h[c];
      if (d > 1e-4) { u[c] = s.hu[c] / d; v[c] = s.hv[c] / d; }
      const sc = this.cellS[c];
      if (airborneHeadwater(sc) || !Number.isFinite(spill[c])) continue;
      if (Math.abs(this.cellN[c]) >= courseKeyAt(sc).halfW + 4) continue;
      const want = spill[c] - s.bed[c];
      // The added water is at rest: the cell keeps its momentum (h u).
      if (want > d) { added += (want - d) * dx * dx; h[c] = want; u[c] *= d / want; v[c] *= d / want; }
    }
    s.setState(h, u, v);
    s.refreshWaveSpeed();
    this.topUpM3 += added;
    for (let c = 0; c < n; c += 1) {
      const d = s.h[c];
      this.disp.h[c] = d; this.disp.qu[c] = s.hu[c]; this.disp.qv[c] = s.hv[c];
      this.disp.q2[c] = d > 1e-4 ? (s.hu[c] * s.hu[c] + s.hv[c] * s.hv[c]) / d : 0;
    }
    return added;
  }

  /**
   * STEP THE SOLVER for at most `maxWallMs` of work or `maxSimS` of flow,
   * whichever ends first. The steps add to the running sums of the next
   * flow map. Every `keepGoodEveryS` of flow the solver's own stability check
   * runs; a blown-up run goes back to the last good state (and `restores`
   * counts it).
   */
  advance(maxWallMs: number, maxSimS = Infinity): { simS: number; steps: number } {
    const batch = this.advanceSteps(maxWallMs, maxSimS);
    let next = batch.next();
    while (!next.done) next = batch.next(this.solver.step());
    return next.value;
  }

  /** Same source history, flood clock, averaging and recovery as CPU advance.
   * The worker serializes edits while a shared-device calculation is pending. */
  async advanceOnGpu(execute: RiverGpuExecutor, maxWallMs: number, maxSimS = Infinity): Promise<{ simS: number; steps: number }> {
    const batch = this.advanceSteps(maxWallMs, maxSimS);
    let next = batch.next();
    while (!next.done) next = batch.next(await this.solver.stepOnGpu(execute));
    return next.value;
  }

  /** Explicit candidate cadence: refresh the measured inlet at each bounded
   * interval (at most RIVER_RESIDENT_MAX_STEPS steps / RIVER_RESIDENT_INTERVAL_S,
   * with the native last-step overshoot).
   * This cadence is shared by replay checks; it is not asserted equivalent to
   * independently timed wall-budget batches. Per-step CPU-coupled modes retain
   * the synchronized GPU path and report why, without silently using CPU flow.
   * The device keeps the water between intervals (see RiverFlowSolver.intervalOnGpu).
   */
  residentSynchronization: string|null=null;
  async advanceResidentOnGpu(execute:RiverGpuResidentExecutor,synchronized:RiverGpuExecutor,maxWallMs:number,maxSimS=Infinity):Promise<{simS:number;steps:number}>{
    // Detected spill lips run inside the device interval (GG-429); a listed
    // face set keeps the per-step synchronized path.
    this.residentSynchronization=this.spillTransfer&&!this.spillTransfer.detect?'airborne spill':this.contactFlow||this.contactRequested?'contact waterfall':this.floodDriving?'flood waveform':null;
    if(this.residentSynchronization)return this.advanceOnGpu(synchronized,maxWallMs,maxSimS);
    if(!(maxSimS>0))return{simS:0,steps:0};
    if(this.headwaters)this.updateInflow();
    const releasedAt=this.simTime-this.sourceFlightDelayS;
    // RETARDED SOURCE HISTORY (2026-10-21). The CPU path samples the released
    // source at the start of each step. A resident interval does the same: it
    // takes the source now, and it ends before the first step that would start
    // at or after the next recorded change, so that step takes the new flow in
    // the next interval. This replaced a per-step synchronized fallback that
    // copied the whole grid each step (0.14 GB free RAM at a dry start).
    // The interval clock is Float32: a step that starts within about 1e-7 s
    // of a change can fall on the other side of it.
    let untilSource=Infinity;
    if(this.sourceHistory.hasChanges){
      if(this.sourceAt(releasedAt)!==this.solver.discharge)this.updateInflow();
      for(const change of this.sourceHistory.status(this.sourceFlightDelayS).changes)if(change.timeS>releasedAt){untilSource=change.timeS-releasedAt;break;}
    }
    const untilHealth=RIVER_LIVE.keepGoodEveryS-(this.simTime-this.goodAt);
    // 2026-10-27: with no flow-time budget (fast mode) an interval may run
    // 0.8 s of flow, up to RIVER_RESIDENT_MAX_STEPS steps (warm start: fast
    // 1.55x -> 2.28x). Remy approved the less frequent inflow refresh this
    // gives. Real-time mode keeps 0.2 s: the GPU queue runs one interval
    // before the next frame, and 0.8 s intervals dropped the page from 46 to
    // 29 fps there. (Chunked submits with a wait between them cost about
    // 20 ms a wait, so they were not kept.)
    const cap=maxSimS===Infinity?RIVER_RESIDENT_INTERVAL_S:RIVER_RESIDENT_REALTIME_INTERVAL_S;
    const result=await this.solver.intervalOnGpu(execute,Math.min(cap,maxSimS,untilSource,Math.max(1e-6,untilHealth)));
    // Only changed cells carry integrals (2026-10-21); every other cell's is zero.
    const {sh,shu,shv,su2}=this.acc,records=result.records,average=new Float32Array(records.buffer,records.byteOffset,records.length);
    for(let p=0;p<records.length;p+=8){const c=records[p]>>>4;this.markLive(c);sh[c]+=average[p+4];shu[c]+=average[p+5];shv[c]+=average[p+6];su2[c]+=average[p+7];}
    this.accT+=result.duration;this.simTime+=result.duration;
    if(this.simTime-this.goodAt>=RIVER_LIVE.keepGoodEveryS)this.checkHealth();
    return{simS:result.duration,steps:result.steps};
  }

  private *advanceSteps(maxWallMs: number, maxSimS: number): Generator<void, { simS: number; steps: number }, number> {
    const t0 = performance.now();
    // The worker calls advance repeatedly, including without shape edits.
    // Freeze one measured receiving state for this batch so its mass, foam and
    // airborne drawing agree; the next batch follows the pool as it changes.
    if (this.headwaters) this.updateInflow();
    let simS = 0;
    let steps = 0;
    // A rejected transport experiment preserves both owners. Retry at the
    // current native time so a reverted geometry edit can repair the source,
    // then keep the native clock stopped while the explicit failure remains.
    if (this.contactFlow?.failureReason) {
      this.advanceContact(0);
      if (this.contactFlow?.failureReason) return { simS, steps };
    }
    // Keep source history intact under receiver backpressure. Retry retained
    // water against edited native geometry, then freeze both clocks if full.
    if (this.contactPending.length >= 20000) {
      this.advanceContact(0);
      if (this.contactPending.length >= 20000) return { simS, steps };
    }
    const { sh, shu, shv, su2 } = this.acc;
    while (simS < maxSimS && performance.now() - t0 < maxWallMs) {
      if (this.contactFlow?.failureReason) break;
      if (this.contactPending.length >= 20000) break;
      // Sample the retarded source on each adaptive step. No downstream
      // depth or speed is prescribed; existing faces carry the surge onward.
      if (this.sourceHistory.hasChanges && this.sourceAt(this.simTime - this.sourceFlightDelayS) !== this.solver.discharge) this.updateInflow();
      if (this.floodDriving) {
        const status = this.flood;
        // Before the first emitted excess reaches the pool, use exactly the
        // ordinary batch update path. The flood must not perturb receiving
        // geometry or momentum simply because its button was pressed.
        if (this.floodSurge.landingAt(this.simTime, this.shape.dischargeM3S) > status.baseM3S || status.phase === 'idle') this.updateInflow();
        this.floodDriving = status.phase !== 'idle';
      }
      const dt = yield;
      this.advanceContact(dt);
      this.floodInjectedExtraM3 += Math.max(0, (this.contactFlow ? this.contactArrivalRate : this.solver.discharge) - this.shape.dischargeM3S) * dt;
      this.solver.addToAverage(dt, sh, shu, shv, su2, this.markLive);
      this.accT += dt;
      simS += dt;
      steps += 1;
      this.simTime += dt;
      if (this.simTime - this.goodAt >= RIVER_LIVE.keepGoodEveryS) this.checkHealth();
      this.finishContactDrain();
    }
    return { simS, steps };
  }

  /** The solver's own stability check, and a restore of the last good state if it failed. */
  checkHealth(): void {
    const hl = this.solver.health(RIVER_LIVE.blowUpMS);
    this.lastHealth = hl;
    if (hl.ok) {
      this.good = this.solver.saveState();
      this.goodContact = this.contactFlow ? {
        state: this.contactFlow.saveState(), pending: structuredClone(this.contactPending),
        accepted: this.contactAcceptedVolume, momentum: [...this.contactAcceptedMomentum], energy: this.contactDissipatedEnergy,
        arrivalRate: this.contactArrivalRate, inVolume: this.solver.inVolume, outVolume: this.solver.outVolume,
        steps: this.solver.steps, floodExtra: this.floodInjectedExtraM3, landing: structuredClone(this.waterfallLanding) } : null;
      this.goodAt = this.simTime;
      return;
    }
    this.restores += 1;
    this.frameAll = true;
    if (this.contactFlow && !this.goodContact) throw Error('Contact recovery requires both water owners');
    if (this.good) {
      this.solver.restoreState(this.good);
      if (this.contactFlow && this.goodContact) {
        const contact = this.goodContact;
        this.contactFlow.restoreState(contact.state); this.contactPending = structuredClone(contact.pending);
        this.solver.time = this.good.time;
        this.contactAcceptedVolume = contact.accepted; this.contactAcceptedMomentum = [...contact.momentum];
        this.contactDissipatedEnergy = contact.energy; this.contactArrivalRate = contact.arrivalRate;
        this.solver.inVolume = contact.inVolume; this.solver.outVolume = contact.outVolume; this.solver.steps = contact.steps;
        this.waterfallLanding = structuredClone(contact.landing);
        this.floodInjectedExtraM3 = contact.floodExtra;
        this.simTime = this.solver.time; this.simAtSnap = this.simTime; this.outAtSnap = this.solver.outVolume;
      }
      if (this.spillTransfer) {
        this.simTime = this.solver.time;
        this.simAtSnap = this.simTime; this.outAtSnap = this.solver.outVolume;
      }
    }
    else this.startCold();
    this.goodAt = this.simTime;
    this.acc.sh.fill(0); this.acc.shu.fill(0); this.acc.shv.fill(0); this.acc.su2.fill(0);
    this.accT = 0;
  }

  // -------------------------------------------------------------------------
  // Edits
  // -------------------------------------------------------------------------

  /** The distance in s from s to the nearest changed stretch (0 inside one; Infinity with none). */
  private alongDist(s: number): number {
    const iv = this.intervals;
    let best = Infinity;
    for (let k = 0; k < iv.length; k += 2) {
      const d = s < iv[k] ? iv[k] - s : s > iv[k + 1] ? s - iv[k + 1] : 0;
      if (d < best) best = d;
      if (best === 0) break;
    }
    return best;
  }

  /** The sample index nearest a design s. */
  private sampleAt(s: number): number {
    const s0 = this.defState.s0;
    return Math.max(0, Math.min(this.defState.x.length - 1, Math.round((s - s0) / 0.25)));
  }

  /**
   * The blend weight of the edited ground at a point from its two projections
   * (see the file header). The half widths are the nearest sample's (0.125 m
   * away at most), read from the per-sample tables.
   */
  private weight(sNow: number, nNow: number, sDef: number, nDef: number): number {
    const L = RIVER_LIVE;
    let w = 0;
    const aNow = this.alongDist(sNow);
    if (aNow < L.alongM) {
      const hw = this.cur.halfW[this.sampleAt(sNow)];
      w = (1 - smooth01((Math.abs(nNow) - hw - L.carveM) / L.blendM)) * (1 - smooth01(aNow / L.alongM));
    }
    const aDef = this.alongDist(sDef);
    if (aDef < L.alongM && w < 1) {
      const hw = this.defState.halfW[this.sampleAt(sDef)];
      const wd = (1 - smooth01((Math.abs(nDef) - hw - L.carveM) / L.blendM)) * (1 - smooth01(aDef / L.alongM));
      if (wd > w) w = wd;
    }
    return w;
  }

  /**
   * APPLY AN EDIT: set the shape and the course edit, change the ground, the
   * rocks, the solver's bed, its ceiling and its inflow near what changed,
   * and return the patch the page applies. The water keeps running.
   */
  applyEdit(next: RiverEditState): LiveBedPatch {
    this.frameAll = true;
    const t0 = performance.now();
    const L = RIVER_LIVE;
    const prevShape = this.shape;
    const prevEdit = this.edit;
    const prevState = this.cur;
    const prevCourse = this.course;
    // THE WATER ACROSS A SHAPE CHANGE: a new width or depth moves the design
    // level (the thalweg and the flow's depth move with it). The kept water
    // surface moves by the same amount at each s, so a shallower channel
    // keeps its water instead of losing it over its raised bed (a depth of
    // x0.5 and back emptied the pool: about 2,000 s of flow to fill again).
    // The flow is held at its old value here: a new flow keeps the surface,
    // and the river rises as the new inflow comes down.
    const D0 = riverHeadwatersEnabled() ? -230 : -140;
    const D1 = 440;
    const levelsOf = (): Float64Array => {
      const a = new Float64Array(D1 - D0 + 1);
      for (let q = 0; q <= D1 - D0; q += 1) a[q] = designLevelAt(D0 + q);
      return a;
    };
    const nextShape = clampRiverShape(next.shape);
    const geomChanged = prevShape.widthScale !== nextShape.widthScale || prevShape.depthScale !== nextShape.depthScale;
    const levelBefore = geomChanged ? levelsOf() : null;
    let levelAfter: Float64Array | null = null;
    if (geomChanged) {
      setRiverShape({ ...next.shape, dischargeM3S: prevShape.dischargeM3S });
      levelAfter = levelsOf();
    }
    setRiverShape(next.shape);
    setRiverCourseEdit(next.course);
    const shape = getRiverShape();
    const edit = getRiverCourseEdit();
    this.shape = shape;
    this.edit = edit;
    const shapeChanged = !(prevShape.widthScale === shape.widthScale && prevShape.depthScale === shape.depthScale && prevShape.dischargeM3S === shape.dischargeM3S);
    const offsetsKey = (e: RiverCourseEdit | null): string => (e ? e.offsets.map((o) => `${o[0]},${o[1]}`).join(';') : '');
    const courseMoved = offsetsKey(prevEdit) !== offsetsKey(edit);
    const course = courseMoved ? riverCourseFor(edit) : prevCourse;
    this.course = course;
    const cur = sampleState(course);
    this.cur = cur;
    const def = this.defState;
    const m = cur.x.length;
    // The samples that changed from the judged course, as stretches of s;
    // and the samples that changed since the last edit.
    const changed = new Uint8Array(m);
    const iv: number[] = [];
    let open = -1;
    for (let k = 0; k < m; k += 1) {
      changed[k] = samplePosDiffers(cur, def, k) || sampleKeyDiffers(cur, def, k) ? 1 : 0;
      if (changed[k] && open < 0) open = k;
      if ((!changed[k] || k === m - 1) && open >= 0) {
        const end = changed[k] ? k : k - 1;
        iv.push(course.samples[open].s, course.samples[end].s);
        open = -1;
      }
    }
    this.changed = changed;
    this.intervals = iv;
    // Stage times (they change no value).
    const timings: Record<string, number> = {};
    let tq = performance.now();
    const mark = (k: string): void => { const now = performance.now(); timings[k] = (timings[k] ?? 0) + now - tq; tq = now; };
    mark('samples');
    // THE BOX: every sample that changed since the last edit (its judged,
    // last and new places), widened by the band's reach. THE MASKS: where a
    // cell needs a new projection (near a sample that moved since the last
    // edit), and where the edited ground can reach at all (near a sample that
    // differs from the judged course).
    let bx0 = Infinity; let bz0 = Infinity; let bx1 = -Infinity; let bz1 = -Infinity;
    const moved = new CoarseMask();
    const reachMask = new CoarseMask();
    for (let k = 0; k < m; k += 1) {
      const R = Math.max(cur.halfW[k], prevState.halfW[k], def.halfW[k]) + L.carveM + L.blendM + L.alongM + 2;
      // One point a meter is enough for a reach of 20 m and more.
      if (changed[k] && k % 4 === 0) {
        reachMask.stamp(cur.x[k], cur.z[k], R);
        reachMask.stamp(def.x[k], def.z[k], R);
      }
      const pos = samplePosDiffers(cur, prevState, k);
      const key = sampleKeyDiffers(cur, prevState, k);
      if (!pos && !key) continue;
      if (pos && k % 4 === 0) {
        // A cell needs a new projection only where the edited ground can
        // reach it (the band across the channel; the along-course blend reads
        // the projection of a cell whose nearest sample did not move) or
        // where the ceiling reads it (6 m past the bank, inside the band).
        const Rp = R - L.alongM;
        moved.stamp(cur.x[k], cur.z[k], Rp);
        moved.stamp(prevState.x[k], prevState.z[k], Rp);
      }
      for (const [x, z] of [[cur.x[k], cur.z[k]], [prevState.x[k], prevState.z[k]], [def.x[k], def.z[k]]] as const) {
        if (x - R < bx0) bx0 = x - R;
        if (x + R > bx1) bx1 = x + R;
        if (z - R < bz0) bz0 = z - R;
        if (z + R > bz1) bz1 = z + R;
      }
    }
    // PATH INDEPENDENCE: the outside fields at a lattice point blend every
    // course sample, weighted 1 / (d^2 + 16)^2, so a change reaches a little
    // past the band (at 40 m from a 60 % wider stretch, about 5 mm of ground).
    // The box takes the cells 20 m past the band again, and the fields 40 m,
    // so a drag ends on the ground a jump to the same edit draws (within a
    // few mm; riverLive.test.ts holds the bound).
    // A brush can reach land beyond the river's control-point band.
    const brush=this.terrainBrushBounds;
    if(brush){bx0=Math.min(bx0,brush.x0);bz0=Math.min(bz0,brush.z0);bx1=Math.max(bx1,brush.x1);bz1=Math.max(bz1,brush.z1);}
    const pad = 20;
    bx0 -= pad; bz0 -= pad; bx1 += pad; bz1 += pad;
    const { nx, nz, dx, x0, z0 } = this.grid;
    let box: CellBox | null = null;
    let groundOut: Float32Array | null = null;
    let outerBox: CellBox | null = null;
    let outerOut: Float32Array | null = null;
    let world: LiveBedPatch['world'] = null;
    let cells = 0;
    const moves: number[] = [];
    if (bx0 < bx1) {
      world = { x0: bx0, z0: bz0, x1: bx1, z1: bz1 };
      mark('masks');
      // THE FIELDS. An edit that keeps the judged course and widths (only node
      // heights, or the judged river again) keeps the judged fields: the
      // heights do not enter them. The copy is exact, and the refresh's 120 m
      // cut moves the ground by up to about 1 cm (OutsideFields.refresh), so
      // a height changes the ground only under its mound.
      const fieldsJudged = shape.widthScale === 1
        && (!edit || (edit.offsets.every((o) => o[0] === 0 && o[1] === 0) && edit.widths.every((w) => w === 1)));
      if (fieldsJudged) this.fields.copyBox(this.fieldsDef, bx0 - 20, bz0 - 20, bx1 + 20, bz1 + 20);
      else this.fields.refresh(course, bx0 - 20, bz0 - 20, bx1 + 20, bz1 + 20);
      mark('fields');
      const i0 = Math.max(0, Math.floor((bx0 - x0) / dx));
      const i1 = Math.min(nx - 1, Math.ceil((bx1 - x0) / dx));
      const j0 = Math.max(0, Math.floor((bz0 - z0) / dx));
      const j1 = Math.min(nz - 1, Math.ceil((bz1 - z0) / dx));
      if (i0 <= i1 && j0 <= j1) {
        box = { i0, j0, i1, j1 };
        const bw = i1 - i0 + 1;
        groundOut = new Float32Array(bw * (j1 - j0 + 1));
        const gDef = this.reach.ground;
        for (let j = j0; j <= j1; j += 1) {
          const z = z0 + (j + 0.5) * dx;
          for (let i = i0; i <= i1; i += 1) {
            const c = j * nx + i;
            const x = x0 + (i + 0.5) * dx;
            if (courseMoved && moved.has(x, z)) {
              const pr = course.project(x, z);
              this.prS[c] = pr.s; this.prN[c] = pr.n; this.prD[c] = pr.d;
              const channel = riverChannelProjection(course, x, z);
              this.cellS[c] = channel.s;
              this.cellN[c] = channel.n;
              this.manning[c] = courseKeyAt(channel.s).manning;
            }
            const w = reachMask.has(x, z) ? this.weight(this.prS[c], this.prN[c], this.defS[c], this.defN[c]) : 0;
            let g = gDef[c];
            if (w > 0) {
              const pr = { s: this.prS[c], n: this.prN[c], d: this.prD[c] };
              const gNew = terrainHeightAt(course, this.fields, x, z, pr, this.noise.at_(c, x, z));
              g = gDef[c] + (gNew - gDef[c]) * w;
              cells += 1;
            }
            g += this.terrainBrush.offset('ground',c);
            this.ground[c] = g;
            groundOut[(j - j0) * bw + (i - i0)] = g;
          }
        }
      }
      mark('cells');
      // THE OUTER LATTICE past the solver grid (and in its 6 m edge band, whose
      // quads the outer mesh draws).
      const o = this.outerDef;
      const oi0 = Math.max(0, Math.floor((bx0 - o.x0) / o.step));
      const oi1 = Math.min(o.nx - 1, Math.ceil((bx1 - o.x0) / o.step));
      const oj0 = Math.max(0, Math.floor((bz0 - o.z0) / o.step));
      const oj1 = Math.min(o.nz - 1, Math.ceil((bz1 - o.z0) / o.step));
      const gx0 = x0 + 6;
      const gx1 = x0 + nx * dx - 6;
      const gz0 = z0 + 6;
      const gz1 = z0 + nz * dx - 6;
      if (oi0 <= oi1 && oj0 <= oj1) {
        const ow = oi1 - oi0 + 1;
        const vals = new Float32Array(ow * (oj1 - oj0 + 1));
        let any = false;
        for (let j = oj0; j <= oj1; j += 1) {
          const z = o.z0 + j * o.step;
          for (let i = oi0; i <= oi1; i += 1) {
            const q = j * o.nx + i;
            const x = o.x0 + i * o.step;
            let g = o.heights[q];
            if (!(x > gx0 && x < gx1 && z > gz0 && z < gz1) && reachMask.has(x, z)) {
              const dp = this.outerDefPr;
              if (Number.isNaN(dp[q * 3])) {
                const pd = defaultRiverCourse().project(x, z);
                dp[q * 3] = pd.s;
                dp[q * 3 + 1] = pd.n;
                dp[q * 3 + 2] = pd.d;
              }
              const pr = course === this.reach.course ? { s: dp[q * 3], n: dp[q * 3 + 1], d: dp[q * 3 + 2] } : course.project(x, z);
              const w = this.weight(pr.s, pr.n, dp[q * 3], dp[q * 3 + 1]);
              if (w > 0) {
                const gNew = terrainHeightAt(course, this.fields, x, z, pr, this.outerNoise.at_(q, x, z));
                g = o.heights[q] + (gNew - o.heights[q]) * w;
                any = true;
              }
            }
            g += this.terrainBrush.offset('outer',q);
            if (g !== this.outerHeights[q]) any = true;
            this.outerHeights[q] = g;
            vals[(j - oj0) * ow + (i - oi0)] = g;
          }
        }
        if (any) { outerBox = { i0: oi0, j0: oj0, i1: oi1, j1: oj1 }; outerOut = vals; }
      }
      mark('outer');
      // THE BOULDERS: each rides its place (s, n) on the course where the
      // course or the width changed, and its ground's change everywhere.
      const gDefArr = this.reach.ground;
      const groundAt = (arr: ArrayLike<number>, outer: ArrayLike<number>, x: number, z: number): number => {
        const fi = (x - x0) / dx - 0.5;
        const fj = (z - z0) / dx - 0.5;
        if (fi > 0 && fi < nx - 1 && fj > 0 && fj < nz - 1) return bilinear(arr, nx, nz, fi, fj);
        return bilinear(outer, o.nx, o.nz, (x - o.x0) / o.step, (z - o.z0) / o.step);
      };
      const sMin = course.samples[0].s;
      const inBox = (x: number, z: number): boolean => x >= bx0 && x <= bx1 && z >= bz0 && z <= bz1;
      for (let k = 0; k < this.boulders.length; k += 1) {
        const b0 = this.reach.boulders[k];
        const b = this.boulders[k];
        if (!inBox(b0.x, b0.z) && !inBox(b.x, b.z)) continue;
        let x = b0.x;
        let z = b0.z;
        if (b0.s !== undefined && b0.n !== undefined && b0.s < MAIN_CHANNEL_S) {
          const ks = Math.max(0, Math.min(m - 1, Math.round((course.at(b0.s).s - sMin) / 0.25)));
          if (changed[ks]) {
            const smp = course.at(b0.s);
            const nn = riverLateralN(b0.s, b0.n);
            x = smp.x + smp.tz * nn;
            z = smp.z - smp.tx * nn;
          }
        }
        const y = b0.y + (groundAt(this.ground, this.outerHeights, x, z) - groundAt(gDefArr, o.heights, b0.x, b0.z));
        if (x !== b.x || z !== b.z || y !== b.y) {
          b.x = x; b.y = y; b.z = z;
          moves.push(k, x, y, z);
        }
      }
    }
    mark('boulders');
    // THE SOLVER'S NEW BED, as a full-grid array: the old bed, and over the
    // box the new ground raised by every boulder top. The solver still holds
    // the old bed, which `updateBed` reads to keep the water's surface.
    const bedNew = this.solver.bed.slice();
    if (box) {
      for (let j = box.j0; j <= box.j1; j += 1) {
        for (let i = box.i0; i <= box.i1; i += 1) bedNew[j * nx + i] = this.ground[j * nx + i];
      }
      for (const b of this.boulders) {
        if (!b.inChannel) continue;
        // Fetch once per rock; cell queries do not allocate cache keys.
        const mainShape = b.s !== undefined && b.s >= MAIN_CHANNEL_S ? mainBoulderShape(b) : undefined;
        const bounds = boulderBounds(b);
        const ii0 = Math.max(box.i0, Math.floor((bounds.minX - x0) / dx));
        const ii1 = Math.min(box.i1, Math.ceil((bounds.maxX - x0) / dx));
        const jj0 = Math.max(box.j0, Math.floor((bounds.minZ - z0) / dx));
        const jj1 = Math.min(box.j1, Math.ceil((bounds.maxZ - z0) / dx));
        for (let j = jj0; j <= jj1; j += 1) {
          for (let i = ii0; i <= ii1; i += 1) {
            const x = x0 + (i + 0.5) * dx, z = z0 + (j + 0.5) * dx;
            const top = mainShape ? mainShape.heightAt(x, z) : boulderTopAt(b, x, z);
            const c = j * nx + i;
            if (top > bedNew[c]) bedNew[c] = top;
          }
        }
      }
    }
    mark('bed');
    // THE EDITED DESIGN LEVEL (the node heights), on the new bed: a raised
    // stretch ponds the water behind it. A change of it moves the ceiling
    // over the whole grid (a pond can reach far upstream of the patch's box).
    const prevTable = this.levelTable;
    this.levelTable = this.buildLevelTable(bedNew);
    let levelChanged = false;
    if (!prevTable !== !this.levelTable) levelChanged = true;
    else if (prevTable && this.levelTable) {
      for (let q = 0; q < prevTable.length; q += 1) if (prevTable[q] !== this.levelTable[q]) { levelChanged = true; break; }
    }
    mark('level');
    // THE CEILING: the whole grid when the shape changed (the design level
    // follows the flow), else the box.
    const margin = riverCeilingMarginM();
    const ceil = (c: number): number => {
      const s = this.cellS[c];
      return !airborneHeadwater(s) && Math.abs(this.cellN[c]) < courseKeyAt(s).halfW + 6 ? this.levelAt(s) + margin : -Infinity;
    };
    const ub: CellBox | null = shapeChanged || levelChanged ? { i0: 0, j0: 0, i1: nx - 1, j1: nz - 1 } : box;
    let volumeChange = 0;
    if (ub) {
      for (let j = ub.j0; j <= ub.j1; j += 1) {
        for (let i = ub.i0; i <= ub.i1; i += 1) this.ceiling[j * nx + i] = ceil(j * nx + i);
      }
      // The kept surface moves with the design level (see levelBefore).
      let shift: Float64Array | null = null;
      if (levelBefore && levelAfter) {
        shift = new Float64Array(nx * nz);
        for (let j = ub.j0; j <= ub.j1; j += 1) {
          for (let i = ub.i0; i <= ub.i1; i += 1) {
            const c = j * nx + i;
            // Shape controls belong to the offshoot and source. The fixed
            // main branch must retain its waterline and stored volume.
            if (this.cellS[c] >= MAIN_CHANNEL_S) continue;
            const g = Math.max(0, Math.min(D1 - D0 - 1e-9, this.cellS[c] - D0));
            const q = Math.floor(g);
            const f = g - q;
            const a = levelAfter[q] - levelBefore[q];
            const b = levelAfter[Math.min(D1 - D0, q + 1)] - levelBefore[Math.min(D1 - D0, q + 1)];
            shift[c] = a + (b - a) * f;
          }
        }
      }
      const vol0 = this.solver.volume();
      // A brush or spell edit keeps the water's volume; course and shape edits
      // keep its surface, as the editor has always done (see updateBed).
      this.solver.updateBed(ub.i0, ub.j0, ub.i1, ub.j1, bedNew, this.manning, this.ceiling, shift, this.terrainBrushBounds !== null);
      volumeChange = this.solver.volume() - vol0;
      if (volumeChange < 0) this.editLostM3 -= volumeChange; else this.editAddedM3 += volumeChange;
      // The drawn field follows the solver at once where the bed changed.
      for (let j = ub.j0; j <= ub.j1; j += 1) {
        for (let i = ub.i0; i <= ub.i1; i += 1) {
          const c = j * nx + i;
          const d = this.solver.h[c];
          if (d === this.disp.h[c]) continue;
          const uu = d > 1e-4 ? this.solver.hu[c] / d : 0;
          const vv = d > 1e-4 ? this.solver.hv[c] / d : 0;
          this.disp.h[c] = d;
          this.disp.qu[c] = this.solver.hu[c];
          this.disp.qv[c] = this.solver.hv[c];
          this.disp.q2[c] = d * (uu * uu + vv * vv);
        }
      }
    }
    mark('solver');
    // THE INFLOW: again when the flow changed or the box reaches the west edge.
    // The waterfall lands inside the grid, so any local bed edit can affect
    // its receiving cells. The older reach retains its west-edge shortcut.
    if (shapeChanged || (box && (riverHeadwatersEnabled() || box.i0 <= 2))) this.updateInflow();
    mark('inflow');
    const pts = new Float32Array(course.points.length * 2);
    course.points.forEach((p, k) => { pts[k * 2] = p[0]; pts[k * 2 + 1] = p[1]; });
    const heights = new Float32Array(course.points.length);
    edit?.heights?.forEach((h, k) => { heights[k] = h; });
    const nodeReports = this.nodeReports();
    mark('reports');
    return {
      shape,
      course: edit,
      courseKey: riverCourseEditKey(edit),
      box,
      ground: groundOut,
      outerBox,
      outer: outerOut,
      world,
      boulderMoves: Float32Array.from(moves),
      course1m: courseMoved ? this.course1m() : null,
      points: pts,
      ms: performance.now() - t0,
      cells,
      timings,
      heights,
      nodeReports,
      volumeChange,
    };
  }

  /** The inflow from the design level at the west edge, and the flow now. */
  // refreshSpillFaces (the pool crest's hand list, rebuilt at each inflow
  // update) was removed on 2026-10-21: the transfer now detects its lips from
  // the bed and the water each step (see the constructor). The old list is in
  // git history before that date if a listed-face study needs it again.

  private updateInflow(): void {
    this.sourceHistory.record(this.simTime, this.shape.dischargeM3S);
    if (this.contactFlow) {
      this.solver.setInflow(0, [], [0, 0], 0);
      this.inflowDry = this.contactPending.length > 0;
      return;
    }
    const arrivingQ = this.sourceAt(this.simTime - this.sourceFlightDelayS);
    if (arrivingQ === 0) {
      // A closed source is intentional. Retain the trajectory for released
      // airborne water, but stop pool impact forcing once no water arrives.
      // Drawing and foam must report the same zero rate as the receiving solver.
      if (this.waterfallLanding) this.waterfallLanding = { ...this.waterfallLanding, discharge: 0 };
      this.inflowDry = false;
      this.solver.setInflow(0, [], [0, 0], 0);
      return;
    }
    if (this.headwaters) {
      const inf = reachInflow(this.grid, this.solver.h, this.cellS, this.cellN,
        this.course, arrivingQ, this.solver.bed);
      this.waterfallLanding = inf.waterfallLanding ?? null;
      const accepted = this.waterfallLanding?.discharge ?? 0;
      this.inflowDry = accepted === 0;
      this.solver.setInflow(accepted, inf.inflow, inf.dir, inf.speed);
      return;
    }
    const { nx, nz } = this.grid;
    const h0 = new Float64Array(nx * nz);
    for (let j = 0; j < nz; j += 1) {
      for (let i = 0; i < (riverHeadwatersEnabled() ? nx : 3); i += 1) {
        const c = j * nx + i;
        const s = this.cellS[c];
        if (!airborneHeadwater(s) && Math.abs(this.cellN[c]) < courseKeyAt(s).halfW + 4) {
          const d = this.levelAt(s) - this.solver.bed[c];
          if (d > 0) h0[c] = d;
        }
      }
    }
    const q = arrivingQ;
    let inf: ReturnType<typeof reachInflow>;
    try {
      inf = reachInflow(this.grid, h0, this.cellS, this.cellN, this.course, mainRiverShareM3S(q));
    } catch (err) {
        // A blocked waterfall landing cannot accept water. Pause that source
        // and report it; never continue an old discharge into an old footprint.
        // The original west-edge river retains its existing fallback behavior.
      if (!(err instanceof Error) || !/no wet inflow/.test(err.message)) throw err;
      this.inflowDry = true;
        if (riverHeadwatersEnabled()) this.solver.setInflow(0, [], [0, 0], 0);
      return;
    }
    this.inflowDry = false;
    this.solver.setInflow(q, withWorldTributaries(this.grid, this.solver.bed, inf.inflow), inf.dir, inf.speed);
  }

  /** The course samples every 1 m from s = -120 to 400 (x, z, s, tx, tz). */
  course1m(): Float32Array {
    const cs: number[] = [];
    for (let s = -120; s <= 400; s += 1) {
      const p = this.course.at(s);
      cs.push(p.x, p.z, p.s, p.tx, p.tz);
    }
    // Keep the original sample indexes used by the boat and cameras. Append
    // the new reaches so placement queries also recognize their banks.
    if (riverHeadwatersEnabled()) {
      for (const [a, b] of [[-230, -121], [MAIN_CHANNEL_S, MAIN_CHANNEL_S + 420]]) {
        for (let s = a; s <= b; s += 1) {
          const p = this.course.at(s);
          cs.push(p.x, p.z, p.s, p.tx, p.tz);
        }
      }
    }
    return Float32Array.from(cs);
  }

  // -------------------------------------------------------------------------
  // Drawing
  // -------------------------------------------------------------------------

  /**
   * THE FIELD FRAME: the mean of the steps since the last frame, smoothed
   * over RIVER_LIVE.smoothS, with the readouts. Smoothing uses one pass; the flow
   * map is made from it by a LiveFlowMapper, which the page runs in a worker
   * of its own so the solver never waits for it (the map costs about 180 ms).
   */
  frame(): LiveFieldFrame {
    const t0 = performance.now();
    const n = this.n;
    const span = this.accT;
    const d = this.disp;
    const all = this.frameAll;
    const cells = all ? null : this.liveCells();
    if (span > 0) {
      const a = 1 - Math.exp(-span / RIVER_LIVE.smoothS);
      const ar = 1 - Math.exp(-span / RIVER_LIVE.rmsSmoothS);
      // Retain the old Float32 mean rounding without allocating four full
      // temporary maps. Physical steps and outgoing fields are unchanged.
      if (cells) smoothRiverFrameAt(this.acc, d, span, a, ar, cells);
      else smoothRiverFrame(this.acc, d, span, a, ar);
    }
    const h = new Float32Array(n);
    const u = new Float32Array(n);
    const v = new Float32Array(n);
    const uRms = new Float32Array(n);
    let wn = 0; let sh = 0; let sv = 0; let sf = 0;
    const wetList: number[] = [];
    for (let k = 0, end = cells ? cells.length : n; k < end; k += 1) {
      const c = cells ? cells[k] : k;
      const hh = d.h[c];
      if (!(hh > 1e-4)) continue;
      h[c] = hh;
      wetList.push(c);
      const uu = d.qu[c] / hh;
      const vv = d.qv[c] / hh;
      u[c] = uu;
      v[c] = vv;
      uRms[c] = Math.sqrt(Math.max(0, d.q2[c] / hh - uu * uu - vv * vv));
      if (hh > 0.03) {
        const sp = Math.hypot(uu, vv);
        wn += 1; sh += hh; sv += sp; sf += sp / Math.sqrt(G * hh);
      }
    }
    const dtS = this.simTime - this.simAtSnap;
    const qOut = dtS > 0 ? (this.solver.outVolume - this.outAtSnap) / dtS : 0;
    this.simAtSnap = this.simTime;
    this.outAtSnap = this.solver.outVolume;
    this.accT = 0;
    // The readouts sum over the live cells (ascending), which hold all water.
    if (all) this.relistLive();
    const live = this.liveCells();
    // Cells whose display has decayed to exact zeros leave the list.
    this.pruneLive();
    return {
      waterfallLanding: this.waterfallLanding,
      contactWaterfall: this.contactSnapshot(),
      spill: this.spillTransfer?.snapshot({ volume: this.solver.volumeAt(live), momentum: this.solver.wetMomentumAt(live) }) ?? null,
      waterfallImpact: this.waterfallLanding,
      simTime: this.simTime,
      flood: this.flood,
      dtS,
      h, u, v, uRms,
      cells: Int32Array.from(wetList),
      readout: wn === 0
        ? { meanSpeed: 0, meanDepth: 0, froude: 0, wetAreaM2: 0 }
        : { meanSpeed: sv / wn, meanDepth: sh / wn, froude: sf / wn, wetAreaM2: wn * this.grid.dx * this.grid.dx },
      qIn: this.contactFlow ? this.contactArrivalRate : this.solver.discharge,
      qOut,
      volume: (this.spillTransfer ? this.solver.totalWetPlusAirVolumeAt(live) : this.solver.volumeAt(live))
        + (this.contactFlow?.totalOwnedVolume ?? 0) + this.contactPending.reduce((v, a) => v + a.volume, 0),
      activeCells: this.solver.activeCells,
      breachCells: this.solver.breachCellsAt(live),
      maxSpeed: this.solver.maxSpeedNow,
      restores: this.restores,
      healthy: this.lastHealth.ok,
      inflowDry: this.inflowDry,
      edgeWetCells: this.edgeWetCells(),
      editLostM3: this.editLostM3,
      editAddedM3: this.editAddedM3,
      topUpM3: this.topUpM3,
      ms: performance.now() - t0,
    };
  }

  /** The live cells, ascending (the whole-grid sums' order). */
  private liveCells(): Int32Array {
    return this.liveSorted ??= Int32Array.from(this.liveList).sort();
  }

  /** List again every cell with water, integrals or display values (after a whole-grid writer). */
  private relistLive(): void {
    const { h, hu, hv } = this.solver, d = this.disp, a = this.acc;
    this.liveMark.fill(0); this.liveList = []; this.liveSorted = null;
    for (let c = 0; c < this.n; c += 1) {
      if (h[c] !== 0 || hu[c] !== 0 || hv[c] !== 0 || d.h[c] !== 0 || d.qu[c] !== 0 || d.qv[c] !== 0 || d.q2[c] !== 0
        || a.sh[c] !== 0 || a.shu[c] !== 0 || a.shv[c] !== 0 || a.su2[c] !== 0) this.markLive(c);
    }
    this.frameAll = false;
  }

  /** Drop live cells that hold only zeros now (their display has decayed to 0). */
  private pruneLive(): void {
    const { h, hu, hv } = this.solver, d = this.disp, a = this.acc;
    let kept = 0;
    for (const c of this.liveList) {
      if (h[c] !== 0 || hu[c] !== 0 || hv[c] !== 0 || d.h[c] !== 0 || d.qu[c] !== 0 || d.qv[c] !== 0 || d.q2[c] !== 0
        || a.sh[c] !== 0 || a.shu[c] !== 0 || a.shv[c] !== 0 || a.su2[c] !== 0) this.liveList[kept++] = c;
      else this.liveMark[c] = 0;
    }
    if (kept !== this.liveList.length) { this.liveList.length = kept; this.liveSorted = null; }
  }

  /**
   * Wet cells (over 2 cm) on the solver grid's north and south edges: water
   * that stands against the edge of the simulated area (a pond or a channel
   * pushed there; the edge is a wall, GG-343). The west edge takes the inflow
   * and the east edge lets the water out.
   */
  edgeWetCells(): number {
    const { nx, nz } = this.grid;
    const h = this.solver.h;
    let k = 0;
    for (let i = 0; i < nx; i += 1) {
      if (h[i] > 0.02) k += 1;
      if (h[(nz - 1) * nx + i] > 0.02) k += 1;
    }
    return k;
  }

  /** What a flow mapper starts from: this river's ground, bed, roughness and rocks, as copies. */
  mapperInit(t1?: Float32Array): LiveMapperInit {
    return {
      grid: this.grid,
      ground: Float32Array.from(this.ground),
      bed: Float32Array.from(this.solver.bed),
      manning: this.manning.slice(),
      // Copy addresses once; transferring mapper payloads must never detach
      // the live solver's branch ownership array.
      cellS: this.headwaters ? this.cellS.slice() : undefined,
      boulders: this.boulders.map((b) => ({ ...b })),
      W: this.W.slice(),
      T: this.T.slice(),
      L: this.L.slice(),
      t1,
    };
  }

  /** What a flow mapper needs of a patch: the box's ground, bed and roughness, and the rocks' moves (copies). */
  mapperPatch(p: LiveBedPatch): LiveMapperPatch {
    const box = p.box;
    if (!box) return { box: null, ground: null, bed: null, manning: null, boulderMoves: p.boulderMoves.slice() };
    const { nx } = this.grid;
    const bw = box.i1 - box.i0 + 1;
    const bh = box.j1 - box.j0 + 1;
    const bed = new Float32Array(bw * bh);
    const manning = new Float32Array(bw * bh);
    const cellS = this.headwaters ? new Float32Array(bw * bh) : undefined;
    for (let j = 0; j < bh; j += 1) {
      for (let i = 0; i < bw; i += 1) {
        const c = (j + box.j0) * nx + i + box.i0;
        bed[j * bw + i] = this.solver.bed[c];
        manning[j * bw + i] = this.manning[c];
        if (cellS) cellS[j * bw + i] = this.cellS[c];
      }
    }
    return { box, ground: p.ground ? p.ground.slice() : null, bed, manning, cellS, boulderMoves: p.boulderMoves.slice() };
  }

  private mapper: LiveFlowMapper | null = null;

  /**
   * A frame through this river's own flow mapper, in one call (Node tests; the
   * page's workers split the two). The mapper follows every patch applied
   * through `applyEditAndMap`.
   */
  snapshot(): LiveFlowSnapshot {
    if (!this.mapper) this.mapper = new LiveFlowMapper(this.mapperInit());
    return this.mapper.map(this.frame());
  }

  /** `applyEdit`, and the in-process mapper told of the patch (Node tests). */
  applyEditAndMap(next: RiverEditState): LiveBedPatch {
    const p = this.applyEdit(next);
    this.mapper?.applyPatch(this.mapperPatch(p));
    return p;
  }

  /** The first data of a cold start: the ground, the outer lattice, the rocks, the course. */
  initialData(): { ground: Float32Array; outer: OuterLattice; boulders: Boulder[]; course: Float32Array } {
    return {
      ground: Float32Array.from(this.ground),
      outer: { ...this.outerDef, heights: this.outerHeights.slice() },
      boulders: this.boulders.map((b) => ({ ...b })),
      course: this.course1m(),
    };
  }

  /** True when the edit is the judged river (no shape change, no course edit). */
  get isJudged(): boolean {
    return isDefaultRiverShape(this.shape) && !this.edit;
  }
}

/** One field frame of the live run (see LiveRiver.frame). */
export interface LiveFieldFrame {
  spill?: RiverSpillSnapshot | null;
  flood?: RiverFloodStatus;
  waterfallLanding?: WaterfallLandingState | null;
  contactWaterfall?: ContactPoolSnapshot | null;
  waterfallImpact?: WaterfallImpactSource | null;
  simTime: number;
  /** The flow's time since the last frame, s (the carried foam moves on by it). */
  dtS: number;
  h: Float32Array;
  u: Float32Array;
  v: Float32Array;
  uRms: Float32Array;
  /** Every cell with h != 0, ascending (2026-10-22, GG-430): the mapper reads
   * only these for its wet scan. Absent from older senders. */
  cells?: Int32Array;
  readout: LiveFlowReadout;
  qIn: number;
  qOut: number;
  volume: number;
  activeCells: number;
  breachCells: number;
  maxSpeed: number;
  /** Blow-ups caught and states restored since the run started, and the last check's verdict. */
  restores: number;
  healthy: boolean;
  /** True while an edit has left no wet inflow cell at the west edge (LiveRiver.inflowDry). */
  inflowDry: boolean;
  /** Wet cells on the grid's north and south edges (LiveRiver.edgeWetCells). */
  edgeWetCells: number;
  /** The water the edits took and added, and the top-ups added, since the run started, m^3. */
  editLostM3: number;
  editAddedM3: number;
  topUpM3: number;
  /** Cost of the frame in the solver's worker, ms. */
  ms: number;
}

/** What a LiveFlowMapper starts from. */
export interface LiveMapperInit {
  /** Optional copied solver branch addresses; old mapper payloads stay valid. */
  cellS?: Float32Array;
  grid: RiverGridSpec;
  ground: Float32Array;
  bed: Float32Array;
  manning: Float32Array;
  boulders: Boulder[];
  /** The carried foam now (white water, turbulence, streaks); or none, with `t1` a steady flow map's. */
  W: Float32Array;
  T: Float32Array;
  L: Float32Array;
  t1?: Float32Array;
}

/** What a LiveFlowMapper takes of a bed patch (the same box as LiveBedPatch.box). */
export interface LiveMapperPatch {
  cellS?: Float32Array;
  box: CellBox | null;
  ground: Float32Array | null;
  bed: Float32Array | null;
  manning: Float32Array | null;
  boulderMoves: Float32Array;
}

/**
 * THE LIVE FLOW MAPPER: from field frames to what the page draws (the flow
 * map through riverFlowField.ts `flowMapCore`, with the carried foam moved on
 * by each frame's time; the water sheet; the half-float textures). It keeps
 * its own copy of the ground, the bed, the roughness and the rocks, which the
 * bed patches update, so it can run in a worker of its own.
 */
export class LiveFlowMapper {
  private readonly cellS?: Float32Array;
  private readonly grid: RiverGridSpec;
  private readonly ground: Float32Array;
  private readonly bed: Float32Array;
  private readonly manning: Float32Array;
  private readonly boulders: Boulder[];
  private readonly W: Float32Array;
  private readonly T: Float32Array;
  private readonly L: Float32Array;
  private readonly scratch = new FlowMapScratch();
  /** The kept full arrays of the last map (the receiving refiner reads them in this worker). */
  lastFull: { t0: Float32Array; t0h: Uint16Array; t1h: Uint16Array; t2h: Uint16Array; surface: Float32Array } | null = null;

  constructor(init: LiveMapperInit) {
    this.cellS = init.cellS;
    this.grid = init.grid;
    this.ground = init.ground;
    this.bed = init.bed;
    this.manning = init.manning;
    this.boulders = init.boulders;
    this.W = init.W;
    this.T = init.T;
    this.L = init.L;
    if (init.t1) {
      const n = this.W.length;
      for (let c = 0; c < n; c += 1) {
        this.W[c] = init.t1[c * 4];
        this.L[c] = init.t1[c * 4 + 1];
        this.T[c] = Math.max(0,init.t1[c * 4 + 3]);
      }
    }
  }

  applyPatch(p: LiveMapperPatch): void {
    const { nx } = this.grid;
    if (p.box && p.ground && p.bed && p.manning) {
      const b = p.box;
      const bw = b.i1 - b.i0 + 1;
      for (let j = b.j0; j <= b.j1; j += 1) {
        for (let i = b.i0; i <= b.i1; i += 1) {
          const q = (j - b.j0) * bw + (i - b.i0);
          const c = j * nx + i;
          this.ground[c] = p.ground[q];
          this.bed[c] = p.bed[q];
          this.manning[c] = p.manning[q];
          if (this.cellS && p.cellS) this.cellS[c] = p.cellS[q];
        }
      }
    }
    const mv = p.boulderMoves;
    for (let q = 0; q + 3 < mv.length; q += 4) {
      const bo = this.boulders[mv[q]];
      if (!bo) continue;
      bo.x = mv[q + 1];
      bo.y = mv[q + 2];
      bo.z = mv[q + 3];
    }
  }

  /** The flow map, the sheet and the textures of a frame. */
  map(f: LiveFieldFrame): LiveFlowSnapshot {
    const t0 = performance.now();
    const timings: Record<string, number> = {};
    const core = flowMapCore(
      { grid: this.grid, h: f.h, u: f.u, v: f.v, uRms: f.uRms, cells: f.cells, bed: this.bed, cellS: this.cellS, waterfallImpact: f.waterfallImpact ? { ...f.waterfallImpact, discharge: f.qIn } : null },
      this.ground, this.manning, this.boulders,
      { kind: 'step', dtS: f.dtS, W: this.W, T: this.T, L: this.L },
      timings,
      // 2026-10-21: reused work arrays (FlowMapScratch); t1/t2 are copied to
      // half floats below before the next map.
      this.scratch,
    );
    let tq = performance.now();
    const sp = core.sparse!;
    const sheet = buildWaterSheetArrays(this.grid, core.map.surface, sp.surfaceCells);
    timings.sheet = performance.now() - tq;
    tq = performance.now();
    // The core keeps its arrays; the picture carries copies (first or after a
    // full rewrite) or only the changed rows.
    const fullCopy = sp.full;
    const patch = fullCopy ? undefined : riverPatchFrom(riverPatchRows(sp.dirty, this.grid.nx), this.grid.nx, core.map.t0, sp.t0h, sp.t1h, sp.t2h, core.map.surface);
    const none32 = new Float32Array(0), none16 = new Uint16Array(0);
    const picT0 = fullCopy ? core.map.t0.slice() : none32;
    const t0h = fullCopy ? sp.t0h.slice() : none16;
    const t1h = fullCopy ? sp.t1h.slice() : none16;
    const t2h = fullCopy ? sp.t2h.slice() : none16;
    const surface = fullCopy ? core.map.surface.slice() : none32;
    timings.half = performance.now() - tq;
    this.lastFull = { t0: core.map.t0, t0h: sp.t0h, t1h: sp.t1h, t2h: sp.t2h, surface: core.map.surface };
    return {
      patch,
      coarse: sp.coarse ? { ...sp.coarse, data: sp.coarse.data.slice() } : null,
      waterfallLanding: f.waterfallLanding ? { ...f.waterfallLanding } : null,
      contactWaterfall: f.contactWaterfall ? structuredClone(f.contactWaterfall) : null,
      spill: f.spill ? structuredClone(f.spill) : null,
      flood: f.flood ? { ...f.flood } : undefined,
      simTime: f.simTime,
      timings,
      t0: picT0,
      t0h,
      t1h,
      t2h,
      surface,
      sheet,
      h: f.h,
      u: f.u,
      v: f.v,
      mapStats: core.map.stats,
      readout: f.readout,
      qIn: f.qIn,
      qOut: f.qOut,
      volume: f.volume,
      activeCells: f.activeCells,
      breachCells: f.breachCells,
      maxSpeed: f.maxSpeed,
      restores: f.restores,
      healthy: f.healthy,
      frameMs: f.ms,
      ms: performance.now() - t0,
    };
  }
}

/** The transfer list of a frame's buffers. */
export function liveFrameTransfer(f: LiveFieldFrame): ArrayBuffer[] {
  return [f.h, f.u, f.v, f.uRms, ...(f.cells ? [f.cells] : [])].map((a) => a.buffer as ArrayBuffer);
}

/** The transfer list of a snapshot's buffers. */
export function liveSnapshotTransfer(s: LiveFlowSnapshot): ArrayBuffer[] {
  // (h, u and v are the frame's own arrays, moved on to the page.)
  const patch = s.patch ? [s.patch.rows, s.patch.t0, s.patch.t0h, s.patch.t1h, s.patch.t2h, s.patch.surface] : [];
  const arrays = [s.t0, s.t0h, s.t1h, s.t2h, s.surface, s.sheet.pos, s.sheet.nor, s.sheet.index, s.h, s.u, s.v, ...patch, ...(s.coarse ? [s.coarse.data] : [])];
  // Zero-length placeholders share no buffer worth moving; transfer each buffer once.
  return [...new Set(arrays.filter(a => a.byteLength > 0).map(a => a.buffer as ArrayBuffer))];
}

/** The transfer list of a patch's buffers (to the page). */
export function livePatchTransfer(p: LiveBedPatch): ArrayBuffer[] {
  const out: ArrayBuffer[] = [p.boulderMoves.buffer as ArrayBuffer, p.points.buffer as ArrayBuffer];
  if (p.ground) out.push(p.ground.buffer as ArrayBuffer);
  if (p.outer) out.push(p.outer.buffer as ArrayBuffer);
  if (p.course1m) out.push(p.course1m.buffer as ArrayBuffer);
  return out;
}

/** The transfer list of a mapper patch's buffers. */
export function liveMapperPatchTransfer(p: LiveMapperPatch): ArrayBuffer[] {
  const out: ArrayBuffer[] = [p.boulderMoves.buffer as ArrayBuffer];
  for (const a of [p.ground, p.bed, p.manning, p.cellS]) if (a) out.push(a.buffer as ArrayBuffer);
  return out;
}
