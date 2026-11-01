/**
 * @file riverSolver.ts — the flow of a river over its bed: depth and velocity
 * at every cell, from the shallow water equations WITH momentum, run to a
 * steady state and averaged.
 *
 * WHY A SOLVER AND NOT A DRAWN FLOW FIELD
 *
 * A river's surface reads as moving because its features move at the speed
 * of the water under them, and that speed follows from the bed: fast where the
 * channel is narrow, steep or shallow, slow where it is wide, flat or deep,
 * slow at the banks, and turned back behind a rock or a bend. A drawn field
 * would need each of those facts authored and would still disagree with the
 * bed somewhere. The solver gets all of them from the bed and one discharge,
 * and its speeds are the "model's speed" the gauntlet measures the drawn
 * speed against.
 *
 * WHY NOT THE LAND PAGE'S SOLVER. `shallowWater.ts` is a virtual-pipe grid: it
 * holds no momentum, so its water only runs downhill of its own surface. Water
 * that keeps its speed past a rock, piles up on the rock's face and leaves a
 * slow wake behind it is momentum, and so is an eddy. This is the same scheme
 * as the beach swash (`oceanBeachMath.ts`, `SwashField`), which it follows
 * term by term, cut down to a river: no sand, no waves, an inflow and an
 * outflow.
 *
 * THE SCHEME. First-order finite volumes. HLL fluxes (Harten, Lax and van
 * Leer 1983) with the hydrostatic reconstruction of Audusse et al. (2004), so
 * still water over any bed stays still and no depth goes negative at a wet
 * and dry front under the time step's bound. Manning friction is applied
 * semi-implicitly, so a thin sheet stops without ringing. The time step is
 * adaptive (Courant number 0.45), and the step sequence is a pure function of
 * the start state, so a run always ends on the same field.
 *
 * WHAT IS STILL OPEN. First order is diffusive: an eddy behind a 1 m boulder
 * is weaker and shorter than a real one (the eddy behind the 5 m spur is
 * resolved). A second-order reconstruction (MUSCL) would sharpen both.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * CRITICAL CORE SYSTEM: Changes here ripple across the entire city.
 *
 * Last Sync: 16/10/2026, 07:56:21
 * Dependents: components/World3D/water/riverExperimentPool.ts, components/World3D/water/riverSpillView.ts, components/World3D/water/riverWaterMaterial.ts, systems/world3d/river/riverCellInspection.ts, systems/world3d/river/riverFlowField.ts, systems/world3d/river/riverLive.ts, systems/world3d/river/riverRectGrid.ts, systems/world3d/river/riverSpillTransfer.ts, systems/world3d/river/riverSubcellBankExperiment.ts, systems/world3d/river/riverTerrainCourse.ts, systems/world3d/river/riverTerrainRaster.ts, systems/world3d/river/riverWaterSheet.ts, systems/world3d/river/riverWorker.ts, systems/world3d/river/waterfallMaterialReceiver.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { RiverSpillTransfer, RiverSpillState } from './riverSpillTransfer';
import type { RiverGpuExecutor, RiverGpuFaces } from './riverGpuStep';
import type { RiverGpuResidentExecutor, RiverGpuResidentOutput, RiverGpuResidentUpload } from './riverGpuResident';
import { riverCellArea, riverCellWidth, riverIndexX, riverMinimumSpacing } from './riverRectGrid';
import { residentSlots, RIVER_RESIDENT_MAX_STEPS } from './riverGpuLimits';

export const G = 9.81;

/**
 * The mean field of a time average (see RiverFlowSolver.addToAverage): mean
 * depth, mean velocity (mean discharge over mean depth) and the speed's
 * spread about its mean, over `span` seconds of steps.
 */
export function meanOfAverage(
  sh: Float64Array, shu: Float64Array, shv: Float64Array, su2: Float64Array, span: number,
): { h: Float32Array; u: Float32Array; v: Float32Array; uRms: Float32Array } {
  const n = sh.length;
  const hOut = new Float32Array(n);
  const uOut = new Float32Array(n);
  const vOut = new Float32Array(n);
  const rms = new Float32Array(n);
  for (let c = 0; c < n; c += 1) {
    const hm = sh[c] / span;
    hOut[c] = hm;
    if (sh[c] > 1e-6) {
      const um = shu[c] / sh[c];
      const vm = shv[c] / sh[c];
      uOut[c] = um;
      vOut[c] = vm;
      const meanSq = su2[c] / sh[c];
      rms[c] = Math.sqrt(Math.max(0, meanSq - um * um - vm * vm));
    }
  }
  return { h: hOut, u: uOut, v: vOut, uRms: rms };
}

/** Flux results of the last `hll` call (module scope, as in the beach solver: no allocation per face). */
let fH = 0;
let fN = 0;
let fT = 0;
let fS = 0;

/**
 * THE HLL FLUX across one face, in the face's normal (n) and tangent (t)
 * directions. Wave speeds from Davis (1988), with the dry-bed speeds of Toro
 * (2001, sec. 10.6) when one side holds no water. The tangential momentum is
 * carried upwind of the mass flux: HLL alone smears a shear layer, and a
 * shear layer is exactly where an eddy line lives.
 */
function hll(hL: number, uL: number, vL: number, hR: number, uR: number, vR: number): void {
  const cL = Math.sqrt(G * hL);
  const cR = Math.sqrt(G * hR);
  let sL: number;
  let sR: number;
  if (hL <= 0) {
    sL = uR - 2 * cR;
    sR = uR + cR;
  } else if (hR <= 0) {
    sL = uL - cL;
    sR = uL + 2 * cL;
  } else {
    sL = Math.min(uL - cL, uR - cR);
    sR = Math.max(uL + cL, uR + cR);
  }
  const qL = hL * uL;
  const qR = hR * uR;
  const pL = qL * uL + 0.5 * G * hL * hL;
  const pR = qR * uR + 0.5 * G * hR * hR;
  if (sL >= 0) {
    fH = qL;
    fN = pL;
  } else if (sR <= 0) {
    fH = qR;
    fN = pR;
  } else {
    const inv = 1 / (sR - sL);
    fH = (sR * qL - sL * qR + sL * sR * (hR - hL)) * inv;
    fN = (sR * pL - sL * pR + sL * sR * (qR - qL)) * inv;
  }
  fT = fH > 0 ? fH * vL : fH * vR;
  const aL = Math.abs(sL);
  const aR = Math.abs(sR);
  fS = aL > aR ? aL : aR;
}

export interface RiverSolverGrid {
  readonly x0: number;
  readonly z0: number;
  readonly dx: number;
  readonly nx: number;
  readonly nz: number;
  /** Optional physical X edges for the CPU terrain experiment. Z remains dx.
   * Callers must use the matching geometry adapter; GPU paths reject this. */
  readonly xEdges?: readonly number[];
}

/** One inflow cell and the share of the discharge it takes. */
export interface InflowCell {
  readonly c: number;
  /** Share of the total discharge, 0..1 (the shares sum to 1). */
  readonly share: number;
  /** Optional landing velocity: redirects the same incoming water at impact.
   * Ordinary river inlets retain their shared tangent direction and speed. */
  readonly velocityMS?: readonly [number, number];
}

export interface RiverSolverOptions {
  readonly grid: RiverSolverGrid;
  /** Bed height at each cell center, m (index j * nx + i). */
  readonly bed: Float64Array;
  /** Manning n per cell, s/m^(1/3). */
  readonly manning: Float32Array;
  /** Discharge, m^3/s. */
  readonly dischargeM3S: number;
  /** The cells the discharge enters through. */
  readonly inflow: readonly InflowCell[];
  /** Unit direction of the inflow's momentum (the course tangent at the inlet). */
  readonly inflowDir: readonly [number, number];
  /** Inflow speed, m/s: the momentum the new water brings. */
  readonly inflowSpeedMS: number;
  /** Which grid edge lets water out (the others are walls). */
  readonly outflowEdge: 'east' | 'west' | 'north' | 'south';
  /** Courant number of the adaptive step. 0.45 keeps HLL positive (the bound is 0.5). */
  readonly cfl?: number;
  /** Longest step, s. */
  readonly maxDtS?: number;
  /** Candidate terrain adapter: actual supported rock at the contact point.
   * Cell depth remains depth-averaged; this does not resolve 3D pool pressure. */
  readonly spillBedAt?: (x:number,z:number)=>number|null;
}

/** The time-averaged steady field. */
export interface RiverSteadyField {
  readonly grid: RiverSolverGrid;
  /** Mean depth, m. */
  readonly h: Float32Array;
  /** Mean velocity (x, z), m/s: mean discharge over mean depth. */
  readonly u: Float32Array;
  readonly v: Float32Array;
  /** Root-mean-square of the velocity's change about its mean, m/s: the unsteady part (shedding behind rocks). */
  readonly uRms: Float32Array;
  /** Bed, m (a copy of the input). */
  readonly bed: Float32Array;
  readonly stats: RiverSolverStats;
}

export interface RiverSolverStats {
  simSeconds: number;
  steps: number;
  /** Mean discharge in and out over the averaging window, m^3/s. */
  qIn: number;
  qOut: number;
  /** Change of stored volume over the averaging window per second, m^3/s. */
  dVdt: number;
  /** Volume on the grid at the end, m^3. */
  volume: number;
  /** Largest speed on the grid at the end, m/s. */
  maxSpeed: number;
  /** Cells the step visits (the ceiling's cells and their margin). */
  activeCells: number;
  /** Cells holding water past the wet ceiling at the end (0 when the ceiling held). */
  breachCells: number;
  wallMs: number;
}

export class RiverFlowSolver {
  readonly grid: RiverSolverGrid;
  readonly bed: Float64Array;
  readonly h: Float64Array;
  readonly hu: Float64Array;
  readonly hv: Float64Array;
  time = 0;
  steps = 0;
  /** Water in and out since the start, m^3. */
  inVolume = 0;
  outVolume = 0;
  /** Largest speed after the last step, m/s. */
  maxSpeedNow = 0;

  private readonly n2: Float64Array;
  private readonly u: Float64Array;
  private readonly v: Float64Array;
  private readonly dh: Float64Array;
  private readonly dhu: Float64Array;
  private readonly dhv: Float64Array;
  /**
   * THE ACTIVE CELLS, as runs per row: row j's runs are
   * runs[runStart[j] .. runStart[j + 1]) in (first, last) pairs, inclusive.
   * A cell is active when its bed stands under the wet ceiling, or when it is
   * next to such a cell (one cell of margin, 8-neighbors), so every face
   * with water on one side has both of its cells in the runs.
   * (Not readonly since the live editor: a bed patch builds them again.)
   */
  // 2026-10-21: the resident GPU path reports reach changes without a CPU
  // rebuild; the runs are then built again on their next read (`runsStale`).
  private _runs!: Int32Array;
  private _runStart!: Int32Array;
  private runsStale = false;
  private get runs(): Int32Array { this.freshRuns(); return this._runs; }
  private set runs(value: Int32Array) { this._runs = value; this.runsStale = false; }
  private get runStart(): Int32Array { this.freshRuns(); return this._runStart; }
  private set runStart(value: Int32Array) { this._runStart = value; this.runsStale = false; }
  private freshRuns(): void {
    if (!this.runsStale) return;
    this.runsStale = false;
    const built = this.buildRuns(); this._runs = built.runs; this._runStart = built.runStart;
  }
  /**
   * THE RESIDENT DEVICE COPY (2026-10-21): the GPU keeps the water between
   * intervals, so the CPU records what it changed since the last accepted
   * interval and uploads only that. Every CPU change to the water, the bed,
   * the roughness, the reach flags or the inlets must mark it here.
   */
  private static residentSessions = 0;
  private readonly residentSession = ++RiverFlowSolver.residentSessions;
  private residentFull = true;
  private residentRows: [number, number] | null = null;
  /** Cells whose inlet source or water changed (inlets, landed spill water);
   * true when their reach flags changed too. */
  private readonly residentCells = new Map<number, boolean>();
  /** The inlet cells of the last accepted upload. */
  private residentInlets = new Set<number>();
  private residentDatum = 0;
  /** The device's awake-cell count while the CPU runs are stale. */
  private residentAwake = -1;
  private markResidentRows(j0: number, j1: number): void {
    this.residentRows = this.residentRows ? [Math.min(this.residentRows[0], j0), Math.max(this.residentRows[1], j1)] : [j0, j1];
  }
  /** Steady mode: the design band. Adaptive live mode: awake wet cells and nearby dry receivers. */
  private readonly reach: Uint8Array;
  private readonly opts: RiverSolverOptions;
  private readonly cfl: number;
  private readonly maxDt: number;
  private readonly hDry = 1e-4;
  private lastMaxSpeed = 1;
  /**
   * THE INFLOW, from the options; the live editor changes it (a new flow, or
   * a channel moved at the west edge). The step reads these, not `opts`.
   */
  private dischargeM3S: number;
  private floodAllowed: Uint8Array | null = null;
  private transientReach: Uint8Array | null = null;
  private inflow: readonly InflowCell[];
  private inflowDir: readonly [number, number];
  private inflowSpeedMS: number;
  private spillTransfer: RiverSpillTransfer | null = null;
  private gpuStepPending = false;
  private readonly minimumSpacing:number;

  /** Opt-in exposed-lip coupling. Switching it off with water in flight would
   * abandon owned water, so callers must retain the transport until it drains. */
  setSpillTransfer(transfer: RiverSpillTransfer | null): void {
    if (this.spillTransfer && transfer !== this.spillTransfer && this.spillTransfer.receipt().airborneVolume > 0) throw Error('Cannot abandon airborne spill water');
    this.spillTransfer = transfer;
  }

  totalWetPlusAirVolume(): number { return this.volume() + (this.spillTransfer?.receipt().airborneVolume ?? 0); }

  /** Volume-weighted momentum inventory. Multiplying by water density gives
   * SI momentum; transfer and reaction receipts use the same omitted density. */
  wetMomentum(): [number, number, number] {
    if(this.grid.xEdges){let x=0,z=0;for(let c=0;c<this.h.length;c++){const area=riverCellArea(this.grid,c);x+=this.hu[c]*area;z+=this.hv[c]*area;}return [x,0,z];}
    let x = 0, z = 0;
    for (let c = 0; c < this.h.length; c++) { x += this.hu[c]; z += this.hv[c]; }
    const area = this.grid.dx ** 2;
    return [x * area, 0, z * area];
  }

  constructor(opts: RiverSolverOptions, wetCeiling?: Float64Array) {
    this.opts = opts;
    this.grid = opts.grid;
    this.minimumSpacing=riverMinimumSpacing(this.grid);
    const { nx, nz } = opts.grid;
    const n = nx * nz;
    if (opts.bed.length !== n || opts.manning.length !== n) {
      throw new Error(`[river] The bed and the roughness need ${n} cells each.`);
    }
    this.bed = opts.bed.slice();
    this.h = new Float64Array(n);
    this.hu = new Float64Array(n);
    this.hv = new Float64Array(n);
    this.u = new Float64Array(n);
    this.v = new Float64Array(n);
    this.dh = new Float64Array(n);
    this.dhu = new Float64Array(n);
    this.dhv = new Float64Array(n);
    this.n2 = new Float64Array(n);
    for (let c = 0; c < n; c += 1) this.n2[c] = opts.manning[c] * opts.manning[c];
    this.cfl = opts.cfl ?? 0.45;
    this.maxDt = opts.maxDtS ?? 0.05;
    this.dischargeM3S = opts.dischargeM3S;
    this.inflow = opts.inflow;
    this.inflowDir = opts.inflowDir;
    this.inflowSpeedMS = opts.inflowSpeedMS;
    // A cell whose bed stands over the wet ceiling can never hold water and
    // costs the step nothing. With no ceiling given, every cell is active.
    this.reach = new Uint8Array(n);
    for (let c = 0; c < n; c += 1) this.reach[c] = !wetCeiling || this.bed[c] < wetCeiling[c] ? 1 : 0;
    const built = this.buildRuns();
    this.runs = built.runs;
    this.runStart = built.runStart;
  }

  /** The active cells' runs from `reach` (see `runs`). */
  private buildRuns(): { runs: Int32Array; runStart: Int32Array } {
    const { nx, nz } = this.grid;
    const n = nx * nz;
    const act = new Uint8Array(n);
    for (let j = 0; j < nz; j += 1) {
      for (let i = 0; i < nx; i += 1) {
        if (!this.reach[j * nx + i]) continue;
        for (let dj = -1; dj <= 1; dj += 1) {
          const jj = j + dj;
          if (jj < 0 || jj >= nz) continue;
          for (let di = -1; di <= 1; di += 1) {
            const ii = i + di;
            if (ii >= 0 && ii < nx) act[jj * nx + ii] = 1;
          }
        }
      }
    }
    const runs: number[] = [];
    const runStart = new Int32Array(nz + 1);
    for (let j = 0; j < nz; j += 1) {
      runStart[j] = runs.length;
      let i = 0;
      while (i < nx) {
        while (i < nx && !act[j * nx + i]) i += 1;
        if (i >= nx) break;
        const a = i;
        while (i < nx && act[j * nx + i]) i += 1;
        runs.push(a, i - 1);
      }
    }
    runStart[nz] = runs.length;
    return { runs: Int32Array.from(runs), runStart };
  }

  /** The discharge the inflow feeds in now, m^3/s. */
  get discharge(): number {
    return this.dischargeM3S;
  }
  /** A conservative horizon for queued source events, not a prescribed dt. */
  get maximumStepS():number{return this.maxDt;}

  /**
   * THE LIVE EDITOR: a new inflow (a new flow from the River shape panel, or
   * a channel moved at the west edge). The water already on the grid keeps
   * flowing; the new inflow starts with the next step.
   */
  setInflow(dischargeM3S: number, inflow: readonly InflowCell[], dir: readonly [number, number], speedMS: number): void {
    // The device copy needs the old inlets cleared and the new ones written.
    for (const cell of this.inflow) if (!this.residentCells.has(cell.c)) this.residentCells.set(cell.c, false);
    for (const cell of inflow) if (!this.residentCells.has(cell.c)) this.residentCells.set(cell.c, false);
    this.dischargeM3S = dischargeM3S;
    this.inflow = inflow;
    this.inflowDir = dir;
    this.inflowSpeedMS = speedMS;
    // A ballistic landing can move beyond the old active runs. Wake only
    // those actual receiving cells before the conservative source is applied.
    if (this.floodAllowed && dischargeM3S > 0) {
      let changed = false;
      for (const cell of inflow) if (!this.reach[cell.c] && this.floodAllowed[cell.c]) {
        this.reach[cell.c] = 1; this.transientReach![cell.c] = 1; changed = true; this.residentCells.set(cell.c, true);
      }
      if (changed) { const built = this.buildRuns(); this.runs = built.runs; this.runStart = built.runStart; }
    }
    // A suddenly stronger source must enter the next CFL bound before its
    // momentum has appeared in the existing wet cells.
    this.lastMaxSpeed = Math.max(this.lastMaxSpeed, speedMS,
      ...inflow.map(cell => cell.velocityMS ? Math.hypot(...cell.velocityMS) : 0));
  }

  /** Enable local wet-front expansion, without raising every ceiling or adding water. */
  enableWetFrontExpansion(allowed: Uint8Array): void {
    this.floodAllowed = allowed; this.transientReach ??= new Uint8Array(this.h.length);
    this.residentFull = true;
  }

  private expandFloodFront(): void {
    if (!this.floodAllowed) return;
    const { nx, nz } = this.grid;
    const added: number[] = [];
    let retired = false;
    const inlets = new Set(this.inflow.map(cell => cell.c));
    for (let j = 0; j < nz; j++) for (let r = this.runStart[j]; r < this.runStart[j + 1]; r += 2) {
      for (let c = j * nx + this.runs[r], end = j * nx + this.runs[r + 1]; c <= end; c++) {
        // Even a retained sub-dry film needs an awake owner when its wet neighbor drains.
        if (this.h[c] > 0 && !this.reach[c] && this.floodAllowed[c]) added.push(c);
        if (this.h[c] <= this.hDry) {
          // Every fully dry cell can sleep, including the original design band.
          // Positive films are retained: sleeping never discards stored mass.
          const i = c % nx;
          if (this.reach[c] && this.h[c] === 0 && !inlets.has(c)
            && (i === 0 || this.h[c - 1] === 0) && (i === nx - 1 || this.h[c + 1] === 0)
            && (j === 0 || this.h[c - nx] === 0) && (j === nz - 1 || this.h[c + nx] === 0)) {
            this.reach[c] = 0; this.transientReach![c] = 0; retired = true;
          }
          continue;
        }
        const i = c % nx, eta = this.bed[c] + this.h[c];
        for (let side = 0; side < 4; side++) {
          const n = side === 0 ? (i > 0 ? c - 1 : -1) : side === 1 ? (i < nx - 1 ? c + 1 : -1)
            : side === 2 ? (j > 0 ? c - nx : -1) : (j < nz - 1 ? c + nx : -1);
          if (n >= 0 && !this.reach[n] && this.floodAllowed[n] && Number.isFinite(this.bed[n]) && eta > this.bed[n] + this.hDry) added.push(n);
        }
      }
    }
    if (!added.length && !retired) return;
    for (const c of added) if (!this.reach[c]) { this.reach[c] = 1; this.transientReach![c] = 1; }
    const built = this.buildRuns(); this.runs = built.runs; this.runStart = built.runStart;
    // Wet land remains available after cancellation; only genuinely dry
    // cells sleep, so arrived water drains through the same conservative faces.
  }

  /**
   * THE LIVE EDITOR: CHANGE THE BED IN PLACE over the box of cells
   * [i0..i1] x [j0..j1] (inclusive), from full-grid arrays of the new bed,
   * the new roughness and the new wet ceiling. The water keeps its SURFACE
   * where it stays wet: a raised bed leaves less water over it (none where
   * it stands over the old surface), a lowered bed more; the water keeps its
   * velocity. A film under 2 cm keeps its depth where the bed drops. A cell
   * that the new ceiling rules out loses its water. A dry cell stays dry,
   * and water flows into a new channel from upstream, so the page shows the
   * water filling the new shape. The active runs are built
   * again for the whole grid (under 5 ms). Mass is not kept across a patch:
   * the stats' in and out volumes are the inflow's and the outflow's only.
   */
  updateBed(
    i0: number, j0: number, i1: number, j1: number,
    bed: ArrayLike<number>, manning: ArrayLike<number>, wetCeiling: ArrayLike<number> | null,
    // A shift of the kept surface per cell, m (the live editor's shape change
    // moves the surface with the design level, so a deeper or a shallower
    // channel keeps its water's depth). None: the surface stays where it is.
    surfaceShift: ArrayLike<number> | null = null,
    // KEEP THE WATER'S VOLUME (2026-10-25, terrain brush and spells): each
    // cell keeps its depth and momentum while its ground moves, so no water is
    // made or lost. Water on raised ground then runs off it, and a dug hole
    // fills from its neighbors, by the solver's own flow. A wet cell stays
    // active even outside the design band, so its water is never deleted.
    keepVolume = false,
  ): void {
    const { nx, nz } = this.grid;
    const a0 = Math.max(0, i0);
    const a1 = Math.min(nx - 1, i1);
    const b0 = Math.max(0, j0);
    const b1 = Math.min(nz - 1, j1);
    for (let j = b0; j <= b1; j += 1) {
      for (let i = a0; i <= a1; i += 1) {
        const c = j * nx + i;
        const zNew = bed[c];
        const inDesignBand = !wetCeiling || zNew < wetCeiling[c];
        // A live edit may change the bed, but an estimated ceiling must not
        // erase floodwater which has already reached this allowed cell.
        const keepWet = (keepVolume || !!this.floodAllowed?.[c]) && this.h[c] > 0;
        const reach = inDesignBand || keepWet ? 1 : 0;
        if (keepWet && !inDesignBand && this.transientReach) this.transientReach[c] = 1;
        const d = this.h[c];
        if (keepVolume) {
          // Depth and momentum stay; only the ground under them moves.
        } else if (d > this.hDry) {
          const eta = this.bed[c] + d + (surfaceShift ? surfaceShift[c] : 0);
          // A FILM (under 2 cm, a wet bank or a drying bar) keeps its depth
          // where the bed drops: its surface is its bed, and keeping it would
          // fill every carved bank with a pool at once. Deeper water keeps
          // its surface.
          const film = d < 0.02 && zNew < this.bed[c];
          const dNew = !reach ? 0 : film ? d : Math.max(0, eta - zNew);
          const k = dNew / d;
          this.h[c] = dNew;
          this.hu[c] *= k;
          this.hv[c] *= k;
        } else if (!reach) {
          this.h[c] = 0;
          this.hu[c] = 0;
          this.hv[c] = 0;
        }
        this.bed[c] = zNew;
        this.n2[c] = manning[c] * manning[c];
        this.reach[c] = reach;
      }
    }
    if (b0 <= b1) this.markResidentRows(b0, b1);
    const built = this.buildRuns();
    this.runs = built.runs;
    this.runStart = built.runStart;
    this.refreshWaveSpeed();
  }

  /**
   * The wave speed the next step's size comes from, taken from the state as
   * it is now. The step uses the last step's fastest wave; after a bed patch
   * the water can be deeper or faster than that, and a step sized for the old
   * state could pass the Courant bound (a depth under zero, then NaN).
   */
  refreshWaveSpeed(): void {
    const { nx, nz } = this.grid;
    const { h, hu, hv, runs, runStart, hDry } = this;
    let m = 0.5;
    for (let j = 0; j < nz; j += 1) {
      const row = j * nx;
      for (let r = runStart[j]; r < runStart[j + 1]; r += 2) {
        for (let c = row + runs[r], e = row + runs[r + 1]; c <= e; c += 1) {
          const d = h[c];
          if (d <= hDry) continue;
          const s = Math.hypot(hu[c], hv[c]) / d + Math.sqrt(G * d);
          if (s > m) m = s;
        }
      }
    }
    this.lastMaxSpeed = Math.max(this.lastMaxSpeed, m);
  }

  /**
   * THE SOLVER'S OWN STABILITY CHECK, for the live run: a cell with a depth
   * or a discharge that is not a finite number, a depth under zero, or a
   * speed past `maxSpeedMS` (a real river reach tops out near 6 m/s; the
   * judged reach's fastest cell runs 2.3 m/s) means the run has blown up.
   */
  health(maxSpeedMS = 25): { ok: boolean; badCells: number; maxSpeed: number } {
    const { nx, nz } = this.grid;
    const { h, hu, hv, runs, runStart, hDry } = this;
    let bad = 0;
    let top = 0;
    for (let j = 0; j < nz; j += 1) {
      const row = j * nx;
      for (let r = runStart[j]; r < runStart[j + 1]; r += 2) {
        for (let c = row + runs[r], e = row + runs[r + 1]; c <= e; c += 1) {
          const d = h[c];
          if (!Number.isFinite(d) || d < 0 || !Number.isFinite(hu[c]) || !Number.isFinite(hv[c])) { bad += 1; continue; }
          if (d <= hDry) continue;
          const s = Math.hypot(hu[c], hv[c]) / d;
          if (s > top) top = s;
          if (s > maxSpeedMS) bad += 1;
        }
      }
    }
    return { ok: bad === 0, badCells: bad, maxSpeed: top };
  }

  /** A copy of the water state (depth, discharges), to restore after a blow-up. */
  saveState(): { h: Float64Array; hu: Float64Array; hv: Float64Array; time: number; spill?: RiverSpillState; spillLedger?: { inVolume: number; outVolume: number; steps: number } } {
    return { h: this.h.slice(), hu: this.hu.slice(), hv: this.hv.slice(), time: this.time, ...(this.spillTransfer ? { spill: this.spillTransfer.saveState(), spillLedger: { inVolume: this.inVolume, outVolume: this.outVolume, steps: this.steps } } : {}) };
  }

  /** Put back saved water; eligible sleeping live cells wake instead of losing their saved volume. */
  restoreState(s: { h: Float64Array; hu: Float64Array; hv: Float64Array; time?: number; spill?: RiverSpillState; spillLedger?: { inVolume: number; outVolume: number; steps: number } }): void {
    if (this.spillTransfer && !s.spill) throw Error('Spill recovery requires both water owners');
    if (s.spill && !this.spillTransfer) throw Error('Spill recovery requires its transport');
    if (s.spill) {
      this.spillTransfer!.restoreState(s.spill);
      // Both phases roll back to one epoch. Ordinary opt-out recovery keeps
      // its existing clock/ledger behavior exactly as before.
      this.time = s.time ?? s.spill.time;
      if (s.spillLedger) { this.inVolume = s.spillLedger.inVolume; this.outVolume = s.spillLedger.outVolume; this.steps = s.spillLedger.steps; }
    }
    let woke = false;
    this.residentFull = true;
    for (let c = 0; c < this.h.length; c += 1) {
      const ok = (this.reach[c] || this.floodAllowed?.[c]) && Number.isFinite(s.h[c]) && s.h[c] > 0;
      if (ok && !this.reach[c]) { this.reach[c] = 1; this.transientReach![c] = 1; woke = true; }
      this.h[c] = ok ? s.h[c] : 0;
      this.hu[c] = ok ? s.hu[c] : 0;
      this.hv[c] = ok ? s.hv[c] : 0;
    }
    if (woke) { const built = this.buildRuns(); this.runs = built.runs; this.runStart = built.runStart; }
    this.lastMaxSpeed = 1;
    this.refreshWaveSpeed();
  }

  /**
   * Add one step's state to a time average: the depth, the discharges and
   * the depth-weighted speed squared, each times the step length. The steady
   * run's average and the live run's snapshot windows both use it.
   */
  addToAverage(dt: number, sh: Float64Array, shu: Float64Array, shv: Float64Array, su2: Float64Array, live?: (c: number) => void): void {
    const { nx, nz } = this.grid;
    const { runs, runStart } = this;
    for (let j = 0; j < nz; j += 1) {
      const row = j * nx;
      for (let r = runStart[j]; r < runStart[j + 1]; r += 2) {
        for (let c = row + runs[r], e = row + runs[r + 1]; c <= e; c += 1) {
          const d = this.h[c];
          if (d <= 0) continue;
          // The live river's sparse frame needs every cell that gains an integral.
          if (live) live(c);
          sh[c] += dt * d;
          shu[c] += dt * this.hu[c];
          shv[c] += dt * this.hv[c];
          if (d > this.hDry) {
            const uu = this.hu[c] / d;
            const vv = this.hv[c] / d;
            su2[c] += dt * d * (uu * uu + vv * vv);
          }
        }
      }
    }
  }

  /** Number of active cells (the step's work). */
  get activeCells(): number {
    // The device counts the same cells (any 8-neighbor in reach) after each step.
    if (this.runsStale && this.residentAwake >= 0) return this.residentAwake;
    let k = 0;
    for (let r = 0; r < this.runs.length; r += 2) k += this.runs[r + 1] - this.runs[r] + 1;
    return k;
  }

  /** Set the start state: depth h and velocity (u, v) per cell. */
  setState(h: Float64Array, u?: Float64Array, v?: Float64Array): void {
    let woke = false;
    this.residentFull = true;
    for (let c = 0; c < this.h.length; c += 1) {
      const d = this.reach[c] || this.floodAllowed?.[c] ? Math.max(0, h[c]) : 0;
      if (d > 0 && !this.reach[c]) { this.reach[c] = 1; this.transientReach![c] = 1; woke = true; }
      this.h[c] = d;
      this.hu[c] = u ? d * u[c] : 0;
      this.hv[c] = v ? d * v[c] : 0;
    }
    if (woke) { const built = this.buildRuns(); this.runs = built.runs; this.runStart = built.runStart; }
  }

  /** Admit an external parcel exactly once. Momentum omits density, like
   * wetMomentum; vertical impact is reported by the airborne owner because
   * this depth-averaged solver has no vertical momentum state. Invalid cells
   * reject the entire parcel, leaving ownership with the caller. */
  depositWater(c: number, volume: number, momentum: readonly [number, number, number]): boolean {
    if (!Number.isInteger(c) || c < 0 || c >= this.h.length || !(volume > 0)
      || !Number.isFinite(volume) || !momentum.every(Number.isFinite) || !Number.isFinite(this.bed[c])
      || (!this.reach[c] && !this.floodAllowed?.[c])) return false;
    if (!this.reach[c]) {
      this.reach[c] = 1; if (this.transientReach) this.transientReach[c] = 1;
      const built = this.buildRuns(); this.runs = built.runs; this.runStart = built.runStart;
    }
    const area = riverCellArea(this.grid,c);
    this.markResidentRows(Math.floor(c / this.grid.nx), Math.floor(c / this.grid.nx));
    this.onWater?.(c);
    this.h[c] += volume / area;
    this.hu[c] += momentum[0] / area; this.hv[c] += momentum[2] / area;
    const speed = Math.hypot(this.hu[c], this.hv[c]) / this.h[c];
    this.lastMaxSpeed = Math.max(this.lastMaxSpeed, speed + Math.sqrt(G * this.h[c]));
    this.maxSpeedNow = Math.max(this.maxSpeedNow, speed);
    this.inVolume += volume;
    return true;
  }

  /** Eligibility includes allowed dry cells; checking it never wakes a cell. */
  canDepositWater(c: number): boolean {
    return Number.isInteger(c) && c >= 0 && c < this.h.length && Number.isFinite(this.bed[c])
      && !!(this.reach[c] || this.floodAllowed?.[c]);
  }

  /** Accept every finite-support hit together. Duplicate cells are combined
   * before checking the resulting state. Any rejected hit leaves all water
   * with the source, including dry cells that would otherwise have awakened.
   * Momentum uses volume times velocity, with density omitted, as above. */
  depositWaterBatch(hits: readonly { c: number; volume: number; momentum: readonly [number, number, number] }[]): boolean {
    if (!hits.length) return false;
    const area = this.grid.dx ** 2;
    if (!(area > 0) || !Number.isFinite(area)) return false;
    const combined = new Map<number, { volume: number; x: number; z: number }>();
    let total = 0;
    const totalMomentum = [0, 0, 0];
    for (const hit of hits) {
      if (!this.canDepositWater(hit.c) || !(hit.volume > 0) || !Number.isFinite(hit.volume)
        || hit.momentum.length !== 3 || !hit.momentum.every(Number.isFinite)) return false;
      const value = combined.get(hit.c) ?? { volume: 0, x: 0, z: 0 };
      value.volume += hit.volume; value.x += hit.momentum[0]; value.z += hit.momentum[2];
      combined.set(hit.c, value); total += hit.volume;
      for (let k = 0; k < 3; k++) totalMomentum[k] += hit.momentum[k];
    }
    if (!Number.isFinite(total) || !totalMomentum.every(Number.isFinite) || !Number.isFinite(this.inVolume + total)) return false;
    const next: { c: number; h: number; hu: number; hv: number; speed: number; wave: number }[] = [];
    for (const [c, value] of combined) {
      const area=riverCellArea(this.grid,c);
      const h = this.h[c] + value.volume / area, hu = this.hu[c] + value.x / area, hv = this.hv[c] + value.z / area;
      const speed = Math.hypot(hu, hv) / h, wave = speed + Math.sqrt(G * h);
      if (!(h > 0) || ![h, hu, hv, speed, wave].every(Number.isFinite)) return false;
      next.push({ c, h, hu, hv, speed, wave });
    }
    let woke = false;
    for (const value of next) {
      this.markResidentRows(Math.floor(value.c / this.grid.nx), Math.floor(value.c / this.grid.nx));
      if (!this.reach[value.c]) { this.reach[value.c] = 1; if (this.transientReach) this.transientReach[value.c] = 1; woke = true; }
      this.h[value.c] = value.h; this.hu[value.c] = value.hu; this.hv[value.c] = value.hv; this.onWater?.(value.c);
      this.lastMaxSpeed = Math.max(this.lastMaxSpeed, value.wave); this.maxSpeedNow = Math.max(this.maxSpeedNow, value.speed);
    }
    if (woke) { const built = this.buildRuns(); this.runs = built.runs; this.runStart = built.runStart; }
    this.inVolume += total;
    return true;
  }

  /**
   * THE LIVE RIVER'S SPARSE READOUTS (2026-10-22, GG-430): `onWater` hears
   * every cell that gains water outside a native step (landed spill and
   * contact water), and the sums below run over an ascending cell list that
   * holds every cell with water. Adding the skipped zeros changes no bit, so
   * each sum equals its whole-grid twin.
   */
  onWater: ((c: number) => void) | null = null;
  volumeAt(cells: ArrayLike<number>): number {
    if(this.grid.xEdges){let volume=0;for(let k=0;k<cells.length;k++){const c=cells[k];volume+=this.h[c]*riverCellArea(this.grid,c);}return volume;}
    let s = 0;
    for (let k = 0; k < cells.length; k += 1) s += this.h[cells[k]];
    return s * this.grid.dx * this.grid.dx;
  }
  breachCellsAt(cells: ArrayLike<number>): number {
    let k = 0;
    for (let q = 0; q < cells.length; q += 1) { const c = cells[q]; if (!this.reach[c] && this.h[c] > 0.001
      && (!this.floodAllowed || !this.floodAllowed[c])) k += 1; }
    return k;
  }
  wetMomentumAt(cells: ArrayLike<number>): [number, number, number] {
    if(this.grid.xEdges){let x=0,z=0;for(let k=0;k<cells.length;k++){const c=cells[k],area=riverCellArea(this.grid,c);x+=this.hu[c]*area;z+=this.hv[c]*area;}return [x,0,z];}
    let x = 0, z = 0;
    for (let k = 0; k < cells.length; k += 1) { const c = cells[k]; x += this.hu[c]; z += this.hv[c]; }
    const area = this.grid.dx ** 2;
    return [x * area, 0, z * area];
  }
  totalWetPlusAirVolumeAt(cells: ArrayLike<number>): number { return this.volumeAt(cells) + (this.spillTransfer?.receipt().airborneVolume ?? 0); }

  /** Water on the grid, m^3. */
  volume(): number {
    if(this.grid.xEdges){let volume=0;for(let c=0;c<this.h.length;c++)volume+=this.h[c]*riverCellArea(this.grid,c);return volume;}
    let s = 0;
    for (let c = 0; c < this.h.length; c += 1) s += this.h[c];
    return s * this.grid.dx * this.grid.dx;
  }

  /** With adaptive live coverage, only water in forbidden cells is a breach.
   * Eligible margin cells awaken next step and are not a design-ceiling failure. */
  breachCells(): number {
    let k = 0;
    for (let c = 0; c < this.h.length; c += 1) if (!this.reach[c] && this.h[c] > 0.001
      && (!this.floodAllowed || !this.floodAllowed[c])) k += 1;
    return k;
  }

  /** Advance one adaptive step. Returns the step length, s. */
  step(): number {
    if (this.gpuStepPending) throw Error('River GPU step must finish before another step');
    this.residentFull = true;
    this.spillTransfer?.beginStep();
    this.expandFloodFront();
    const { nx, nz, dx } = this.grid;
    const { bed, h, hu, hv, u, v, dh, dhu, dhv, runs, runStart, hDry } = this;
    const dt = Math.min(this.maxDt, (this.cfl * this.minimumSpacing) / Math.max(0.5, this.lastMaxSpeed));
    const inv = 1 / dx;

    for (let j = 0; j < nz; j += 1) {
      const row = j * nx;
      for (let r = runStart[j]; r < runStart[j + 1]; r += 2) {
        for (let c = row + runs[r], e = row + runs[r + 1]; c <= e; c += 1) {
          const d = h[c];
          if (d > hDry) {
            u[c] = hu[c] / d;
            v[c] = hv[c] / d;
          } else {
            u[c] = 0;
            v[c] = 0;
          }
          dh[c] = 0;
          dhu[c] = 0;
          dhv[c] = 0;
        }
      }
    }

    let maxS = 0;
    // ---- faces across x (inside each run) ------------------------------------
    for (let j = 0; j < nz; j += 1) {
      const row = j * nx;
      for (let r = runStart[j]; r < runStart[j + 1]; r += 2) {
        for (let cR = row + runs[r] + 1, e = row + runs[r + 1]; cR <= e; cR += 1) {
          const cL = cR - 1;
          const hL = h[cL];
          const hR = h[cR];
          if (hL <= hDry && hR <= hDry) continue;
          const zL = bed[cL];
          const zR = bed[cR];
          const zM = zL > zR ? zL : zR;
          let hLs = hL + zL - zM; if (hLs < 0) hLs = 0;
          let hRs = hR + zR - zM; if (hRs < 0) hRs = 0;
          hll(hLs, u[cL], v[cL], hRs, u[cR], v[cR]);
          // One shared physical face flux, divided by each receiving cell's
          // own width. Equal depth changes would create mass in unequal cells.
          const invL=this.grid.xEdges?1/riverCellWidth(this.grid,cL%nx):inv,invR=this.grid.xEdges?1/riverCellWidth(this.grid,cR%nx):inv;
          dh[cL] -= fH * invL;
          dh[cR] += fH * invR;
          dhu[cL] -= (fN + 0.5 * G * (hL * hL - hLs * hLs)) * invL;
          dhu[cR] += (fN + 0.5 * G * (hR * hR - hRs * hRs)) * invR;
          dhv[cL] -= fT * invL;
          dhv[cR] += fT * invR;
          // Keep the native donor's exact HLL debit. Its receiving advective
          // mass/momentum now belong to the airborne phase until contact;
          // local hydrostatic bed corrections remain in the SWE cells.
          const spill = this.spillTransfer?.launch(cL, cR, 'x', fH, fN, fT, h, bed, u, v, this.time, dt) ?? 0;
          if (spill === 1) { dh[cR] -= fH * invR; dhu[cR] -= fN * invR; dhv[cR] -= fT * invR; }
          else if (spill === -1) { dh[cL] += fH * invL; dhu[cL] += fN * invL; dhv[cL] += fT * invL; }
          if (fS > maxS) maxS = fS;
        }
      }
    }
    // ---- faces across z (between row j - 1 and row j, over row j's runs) -----
    // Every face with water on one side has its row-j cell in row j's runs,
    // by the one-cell margin.
    for (let j = 1; j < nz; j += 1) {
      const row = j * nx;
      for (let r = runStart[j]; r < runStart[j + 1]; r += 2) {
        for (let cR = row + runs[r], e = row + runs[r + 1]; cR <= e; cR += 1) {
          const cL = cR - nx;
          const hL = h[cL];
          const hR = h[cR];
          if (hL <= hDry && hR <= hDry) continue;
          const zL = bed[cL];
          const zR = bed[cR];
          const zM = zL > zR ? zL : zR;
          let hLs = hL + zL - zM; if (hLs < 0) hLs = 0;
          let hRs = hR + zR - zM; if (hRs < 0) hRs = 0;
          hll(hLs, v[cL], u[cL], hRs, v[cR], u[cR]);
          dh[cL] -= fH * inv;
          dh[cR] += fH * inv;
          dhv[cL] -= (fN + 0.5 * G * (hL * hL - hLs * hLs)) * inv;
          dhv[cR] += (fN + 0.5 * G * (hR * hR - hRs * hRs)) * inv;
          dhu[cL] -= fT * inv;
          dhu[cR] += fT * inv;
          const spill = this.spillTransfer?.launch(cL, cR, 'z', fH, fN, fT, h, bed, u, v, this.time, dt) ?? 0;
          if (spill === 1) { dh[cR] -= fH * inv; dhv[cR] -= fN * inv; dhu[cR] -= fT * inv; }
          else if (spill === -1) { dh[cL] += fH * inv; dhv[cL] += fN * inv; dhu[cL] += fT * inv; }
          if (fS > maxS) maxS = fS;
        }
      }
    }
    // ---- walls: the mirror state pushes back with the wall pressure --------
    // A run's two ends are walls in x, and so is every grid edge but the
    // outflow edge. (A run end inside the grid holds water only past a
    // breach of the ceiling, which `breachCells` reports.)
    const out = this.opts.outflowEdge;
    let qOutStep = 0;
    for (let j = 0; j < nz; j += 1) {
      const row = j * nx;
      for (let r = runStart[j]; r < runStart[j + 1]; r += 2) {
        for (let end = 0; end < 2; end += 1) {
          const i = runs[r + end];
          const c = row + i;
          const inv=this.grid.xEdges?1/riverCellWidth(this.grid,i):1/dx;
          const d = h[c];
          if (d <= hDry) continue;
          const sign = end === 1 ? 1 : -1;
          const isOut = (end === 1 && i === nx - 1 && out === 'east') || (end === 0 && i === 0 && out === 'west');
          if (isOut) {
            // TRANSMISSIVE: the ghost is a copy of the cell, so the face carries
            // the cell's own physical flux out. Water never flows back in.
            const un = Math.max(0, sign * u[c]);
            const q = d * un;
            dh[c] -= q * inv;
            dhu[c] -= sign * (q * un + 0.5 * G * d * d) * inv;
            dhv[c] -= q * v[c] * inv;
            qOutStep += q * dx;
          } else {
            dhu[c] -= sign * 0.5 * G * d * d * inv;
          }
        }
      }
    }
    for (let side = 0; side < 2; side += 1) {
      const j = side === 0 ? 0 : nz - 1;
      const isOut = (side === 1 && out === 'south') || (side === 0 && out === 'north');
      const sign = side === 1 ? 1 : -1;
      const row = j * nx;
      for (let r = runStart[j]; r < runStart[j + 1]; r += 2) {
        for (let c = row + runs[r], e = row + runs[r + 1]; c <= e; c += 1) {
          const d = h[c];
          if (d <= hDry) continue;
          if (isOut) {
            const un = Math.max(0, sign * v[c]);
            const q = d * un;
            dh[c] -= q * inv;
            dhv[c] -= sign * (q * un + 0.5 * G * d * d) * inv;
            dhu[c] -= q * u[c] * inv;
            qOutStep += q * riverCellWidth(this.grid,c%nx);
          } else {
            dhv[c] -= sign * 0.5 * G * d * d * inv;
          }
        }
      }
    }
    // ---- inflow: mass and its momentum ---------------------------------------
    const Q = this.dischargeM3S;
    const [ix, iz] = this.inflowDir;
    const sp = this.inflowSpeedMS;
    const area = dx * dx;
    for (const cell of this.inflow) {
      const rate = (Q * cell.share) / (this.grid.xEdges?riverCellArea(this.grid,cell.c):area);
      dh[cell.c] += rate;
      // The waterfall can spend a bounded part of its fall energy on outward
      // motion. Its per-cell velocity changes momentum, never the mass rate.
      dhu[cell.c] += rate * (cell.velocityMS?.[0] ?? sp * ix);
      dhv[cell.c] += rate * (cell.velocityMS?.[1] ?? sp * iz);
    }

    // ---- update and friction --------------------------------------------------
    let maxSpeed = 0;
    const n2 = this.n2;
    for (let j = 0; j < nz; j += 1) {
      const row = j * nx;
      for (let r = runStart[j]; r < runStart[j + 1]; r += 2) {
        for (let c = row + runs[r], e = row + runs[r + 1]; c <= e; c += 1) {
          const d = h[c] + dt * dh[c];
          if (d <= hDry) {
            // A cell that dries keeps its last film at rest; the film is below
            // 0.1 mm, so dropping its momentum loses no visible water.
            h[c] = d > 0 ? d : 0;
            hu[c] = 0;
            hv[c] = 0;
            continue;
          }
          let qx = hu[c] + dt * dhu[c];
          let qz = hv[c] + dt * dhv[c];
          // Semi-implicit Manning: the friction slope g n^2 |u| u / h^(4/3).
          const spd = Math.sqrt(qx * qx + qz * qz) / d;
          const k = (G * n2[c] * spd) / (d * Math.cbrt(d));
          const damp = 1 / (1 + dt * k);
          qx *= damp;
          qz *= damp;
          h[c] = d;
          hu[c] = qx;
          hv[c] = qz;
          const s = spd * damp;
          if (s > maxSpeed) maxSpeed = s;
          // Source injection changes depth after the face solve. Its new gravity
          // wave must constrain the next step, especially at a narrow receiver.
          const updatedWave = s + Math.sqrt(G * d);
          if (updatedWave > maxS) maxS = updatedWave;
        }
      }
    }
    return this.finishStep(dt, maxS, maxSpeed, qOutStep, Q);
  }

  /**
   * Run the existing face, depth and friction laws on the scene's device.
   * The live owner must queue terrain/source edits until this promise settles.
   * Only validated output is committed; a device failure restores airborne
   * ownership and leaves depths, clocks and volume ledgers untouched.
   */
  async stepOnGpu(execute: RiverGpuExecutor): Promise<number> {
    if(this.grid.xEdges)throw Error('Rectangular river cells require the CPU experiment; GPU geometry is unqualified');
    if (this.gpuStepPending) throw Error('A river GPU step is already pending');
    this.gpuStepPending = true;
    this.residentFull = true;
    const spillState = this.spillTransfer?.saveState();
    try {
      const prepareStart = performance.now();
      this.spillTransfer?.beginStep();
      this.expandFloodFront();
      const { nx, nz, dx } = this.grid;
      const n = this.h.length;
      const dt = Math.min(this.maxDt, this.cfl * dx / Math.max(0.5, this.lastMaxSpeed));
      const state = new Float32Array(n * 4);
      const source = new Float32Array(n * 4);
      const topology = new Uint32Array(n);
      // The GPU request transfers its packed buffers to the page. Retain the
      // acceptance list locally: transferred topology is detached on return.
      const activeCells: number[] = [];
      // Relative elevation retains shallow water precision high above sea level.
      // The datum changes representation only, never the terrain or its slope.
      const datum = this.bed.find(Number.isFinite) ?? 0;
      for (let c = 0; c < n; c++) {
        const p = c * 4;
        state[p] = this.h[c]; state[p + 1] = this.hu[c]; state[p + 2] = this.hv[c]; state[p + 3] = this.bed[c] - datum;
        source[c * 4 + 3] = this.n2[c];
        this.u[c] = this.h[c] > this.hDry ? this.hu[c] / this.h[c] : 0;
        this.v[c] = this.h[c] > this.hDry ? this.hv[c] / this.h[c] : 0;
      }
      for (let j = 0; j < nz; j++) {
        for (let r = this.runStart[j]; r < this.runStart[j + 1]; r += 2) {
          const first = j * nx + this.runs[r], last = j * nx + this.runs[r + 1];
          for (let c = first; c <= last; c++) { topology[c] = 1; activeCells.push(c); }
          topology[first] |= 2; topology[last] |= 4;
        }
      }
      const Q = this.dischargeM3S;
      for (const cell of this.inflow) {
        const rate = Q * cell.share / (dx * dx), p = cell.c * 4;
        source[p] += rate;
        source[p + 1] += rate * (cell.velocityMS?.[0] ?? this.inflowSpeedMS * this.inflowDir[0]);
        source[p + 2] += rate * (cell.velocityMS?.[1] ?? this.inflowSpeedMS * this.inflowDir[1]);
      }
      const spill = this.spillTransfer;
      const removeAirborneReceiver = spill ? (faces: RiverGpuFaces): void => {
        const launch = (left: number, right: number, axis: 'x' | 'z', flux: Float32Array): void => {
          if (this.h[left] <= this.hDry && this.h[right] <= this.hDry) return;
          const p = right * 4, fh = flux[p], fn = flux[p + 1], ft = flux[p + 2];
          const sign = spill.launch(left, right, axis, fh, fn, ft, this.h, this.bed, this.u, this.v, this.time, dt);
          if (!sign) return;
          const target = (sign === 1 ? right : left) * 4;
          const scale = -sign / dx;
          faces.delta[target] += scale * fh;
          faces.delta[target + 1] += scale * (axis === 'x' ? fn : ft);
          faces.delta[target + 2] += scale * (axis === 'x' ? ft : fn);
        };
        // Keep native x-then-z face order: parcel admission is capacity bounded.
        for (let j = 0; j < nz; j++) for (let r = this.runStart[j]; r < this.runStart[j + 1]; r += 2)
          for (let c = j * nx + this.runs[r] + 1, end = j * nx + this.runs[r + 1]; c <= end; c++) launch(c - 1, c, 'x', faces.x);
        for (let j = 1; j < nz; j++) for (let r = this.runStart[j]; r < this.runStart[j + 1]; r += 2)
          for (let c = j * nx + this.runs[r], end = j * nx + this.runs[r + 1]; c <= end; c++) launch(c - nx, c, 'z', faces.z);
      } : undefined;
      const packedActive = Uint32Array.from(activeCells);
      const output = await execute({ nx, nz, dx, dt, outEdge: ['east', 'west', 'north', 'south'].indexOf(this.opts.outflowEdge), state, source, topology, activeCells: packedActive, prepareMs: performance.now() - prepareStart }, removeAirborneReceiver);
      if (output.cells.length !== (output.compact ? activeCells.length : n) * 8 || !output.cells.every(Number.isFinite)) throw Error('Invalid river GPU result');
      let maxS = 0, maxSpeed = 0, qOutStep = 0;
      for (let k = 0; k < activeCells.length; k++) {
        const p = (output.compact ? k : activeCells[k]) * 8;
        if (output.cells[p] < 0 || output.cells[p + 3] < 0 || output.cells[p + 4] < 0 || output.cells[p + 5] < 0) throw Error('Negative river GPU depth or diagnostic');
        maxS = Math.max(maxS, output.cells[p + 3]); maxSpeed = Math.max(maxSpeed, output.cells[p + 4]); qOutStep += output.cells[p + 5];
      }
      for (let k = 0; k < activeCells.length; k++) {
        const c = activeCells[k], p = (output.compact ? k : c) * 8;
        this.h[c] = output.cells[p]; this.hu[c] = output.cells[p + 1]; this.hv[c] = output.cells[p + 2];
      }
      return this.finishStep(dt, maxS, maxSpeed, qOutStep, Q);
    } catch (error) {
      if (spillState) this.spillTransfer!.restoreState(spillState);
      throw error;
    } finally {
      this.gpuStepPending = false;
    }
  }

  /** Accept one bounded device interval atomically. Source and terrain controls
   * stay queued until return. CPU arrays remain the last accepted snapshot,
   * and the device's per-step integrals supply the ordinary flow mapper.
   * Airborne coupling must use stepOnGpu at its existing synchronization points.
   *
   * 2026-10-21: the device keeps the water between intervals. The request
   * carries only the CPU changes since the last accepted interval, and the
   * result carries only the cells the device changed. After this returns, the
   * CPU arrays equal the device water, so edits, health checks, restores and
   * the synchronized fallback read and write the same state as before.
   * Any failure leaves the CPU arrays at the last accepted interval and makes
   * the next request upload every cell.
   */
  async intervalOnGpu(execute: RiverGpuResidentExecutor, duration: number): Promise<RiverGpuResidentOutput> {
    if(this.grid.xEdges)throw Error('Rectangular river cells require the CPU experiment; GPU geometry is unqualified');
    if (this.gpuStepPending) throw Error('A river GPU step is already pending');
    // Listed spill faces keep the synchronized path; detected lips run on the
    // device and replay here (GG-429).
    if (this.spillTransfer && !this.spillTransfer.detect) throw Error('Listed spill faces require synchronized GPU steps');
    this.gpuStepPending = true;
    try {
      const {nx,nz,dx}=this.grid,n=this.h.length;
      const spill=this.spillTransfer;
      const {upload,inlets}=this.residentUpload();
      let output:RiverGpuResidentOutput;
      try{
        output=await execute({session:this.residentSession,nx,nz,dx,outEdge:['east','west','north','south'].indexOf(this.opts.outflowEdge),expansion:!!this.floodAllowed,cfl:this.cfl,maxDt:this.maxDt,lastMaxSpeed:this.lastMaxSpeed,discharge:this.dischargeM3S,slots:residentSlots(duration,this.maxDt,this.cfl,dx,this.lastMaxSpeed),duration,upload,spill:spill?{gravity:spill.gravity}:null});
      }catch(error){this.residentFull=true;throw error;}
      // Validate every transferred field before changing any native owner.
      const records=output.records,changed=records.length/8,values=new Float32Array(records.buffer,records.byteOffset,records.length);
      const fail=(message:string):never=>{this.residentFull=true;throw Error(message);};
      if(!Number.isInteger(changed)||changed>n||output.journal.length!==output.steps*8
        ||!Number.isInteger(output.steps)||output.steps<1||output.steps>RIVER_RESIDENT_MAX_STEPS||!output.journal.every(Number.isFinite)
        ||!Number.isInteger(output.awakeCells)||output.awakeCells<0||output.awakeCells>n
        ||![output.duration,output.inVolume,output.outVolume,output.lastMaxSpeed].every(Number.isFinite)||output.duration<=0||output.inVolume<0||output.outVolume<0||output.lastMaxSpeed<.5)fail('Invalid resident river interval');
      for(let k=0;k<changed;k++){
        const p=k*8,c=records[p]>>>4;
        if(c>=n)fail('Invalid resident cell');
        for(let q=1;q<8;q++)if(!Number.isFinite(values[p+q]))fail('Invalid resident water or frontier');
        if(values[p+1]<0||values[p+4]<0||values[p+7]<0)fail('Invalid resident water or frontier');
      }
      let clock=0;for(let k=0;k<output.steps;k++){const dt=output.journal[k*8];if(!(dt>0&&dt<=this.maxDt*1.00001))fail('Invalid resident timestep');clock+=dt;}
      if(Math.abs(clock-output.duration)>1e-5*Math.max(1,clock))fail('Resident interval clock mismatch');
      // Spill launches: each names a real face of this grid, a run step and finite values.
      const launches=output.launches??new Uint32Array(0),launchValues=new Float32Array(launches.buffer,launches.byteOffset,launches.length);
      if(launches.length%12!==0||(!spill&&launches.length))fail('Invalid resident spill launches');
      for(let p=0;p<launches.length;p+=12){
        const R=launches[p],code=launches[p+1],step=launches[p+2],axis=code&1;
        if(R>=n||code>3||step>=output.steps||(axis===0?R%nx===0:R<nx))fail('Invalid resident spill face');
        for(let q=4;q<11;q++)if(!Number.isFinite(launchValues[p+q]))fail('Invalid resident spill launch values');
        if(!(launchValues[p+7]>0)||launchValues[p+10]<0)fail('Invalid resident spill donor');
      }
      let reachChanged=false;
      for(let k=0;k<changed;k++){
        const p=k*8,c=records[p]>>>4,flags=records[p]&15,reach=flags&1;
        this.h[c]=values[p+1];this.hu[c]=values[p+2];this.hv[c]=values[p+3];
        if(this.reach[c]!==reach){this.reach[c]=reach;reachChanged=true;}
        if(this.transientReach)this.transientReach[c]=flags&8?1:0;
      }
      // The device built the same runs from these flags; the CPU copy waits
      // for its next reader (health, wave speed, a CPU step) instead of a
      // whole-grid rebuild after every interval.
      if(reachChanged)this.runsStale=true;
      this.residentAwake=output.awakeCells;
      this.residentFull=false;this.residentRows=null;this.residentCells.clear();this.residentInlets=inlets;
      const start=this.time;
      this.time+=output.duration;this.steps+=output.steps;this.inVolume+=output.inVolume;this.outVolume+=output.outVolume;this.lastMaxSpeed=output.lastMaxSpeed;this.maxSpeedNow=output.journal[(output.steps-1)*8+7];
      if(spill)this.replaySpill(spill,start,output,launches,launchValues);
      return output;
    } finally {this.gpuStepPending=false;}
  }

  /**
   * THE AIRBORNE SPILL OF A DEVICE INTERVAL (GG-429). The device ran the
   * separation test of each face and kept the launched water from its
   * receiver. Here, step by step, the same transfer releases each launch
   * (native face order: x faces, then z faces, by cell) and moves its parcels
   * to the step's end. Landed water joins the CPU copy at once and reaches the
   * device as a cell patch before the next interval, so it enters the device
   * water up to one interval later than in riverSolver.step. The transfer's
   * volume and momentum ledger is the same code as the CPU path.
   */
  private replaySpill(spill: RiverSpillTransfer, start: number, output: RiverGpuResidentOutput, launches: Uint32Array, values: Float32Array): void {
    const { nx } = this.grid;
    const order: number[] = [];
    for (let p = 0; p < launches.length; p += 12) order.push(p);
    order.sort((a, b) => launches[a + 2] - launches[b + 2] || (launches[a + 1] & 1) - (launches[b + 1] & 1) || launches[a] - launches[b]);
    let time = start, q = 0, maxWave = 0;
    for (let k = 0; k < output.steps; k++) {
      // A device step equal to the Float32 longest step IS the longest step.
      // Its Float32 value (0.0500000007 for 0.05 s) would push two steps past
      // the exact 0.1 s merge window that the CPU path reaches.
      const raw = output.journal[k * 8], dt = raw === Math.fround(this.maxDt) ? this.maxDt : raw;
      spill.beginStep();
      for (; q < order.length && launches[order[q] + 2] === k; q++) {
        const p = order[q], R = launches[p], axis = launches[p + 1] & 1 ? 'z' : 'x', plus = (launches[p + 1] & 2) === 0;
        const L = axis === 'x' ? R - 1 : R - nx, from = plus ? L : R, to = plus ? R : L;
        spill.release(from, to, axis, plus ? 1 : -1, values[p + 4], values[p + 5], values[p + 6], values[p + 7], values[p + 8], values[p + 9], values[p + 10], this.bed[from], time, dt);
      }
      spill.advance(time + dt, (x, z) => this.spillSurface(x, z), (c, volume, velocity) => {
        const landed = this.spillDeposit(c, volume, velocity);
        this.residentCells.set(c, (this.residentCells.get(c) ?? false) || landed.woke);
        if (landed.woke) this.runsStale = true;
        maxWave = Math.max(maxWave, landed.wave);
      });
      time += dt;
    }
    this.lastMaxSpeed = Math.max(this.lastMaxSpeed, maxWave);
  }

  /** The CPU changes the device copy still lacks (see residentFull). Builds
   * arrays only; the marks clear when the device accepts the interval. */
  private residentUpload(): { upload: RiverGpuResidentUpload; inlets: Set<number> } {
    const {nx,dx}=this.grid,n=this.h.length;
    // Same Float32 accumulation as the earlier per-interval source array.
    const rates=new Map<number,Float32Array>();
    for(const cell of this.inflow){
      const rate=this.dischargeM3S*cell.share/(dx*dx),v=rates.get(cell.c)??new Float32Array(3);
      v[0]+=rate;v[1]+=rate*(cell.velocityMS?.[0]??this.inflowSpeedMS*this.inflowDir[0]);v[2]+=rate*(cell.velocityMS?.[1]??this.inflowSpeedMS*this.inflowDir[1]);
      rates.set(cell.c,v);
    }
    const flagsOf=(c:number):number=>(this.reach[c]?1:0)|(this.floodAllowed?.[c]?2:0)|(rates.has(c)?4:0)|(this.transientReach?.[c]?8:0);
    const sourceOf=(c:number,out:Float32Array,p:number):void=>{const v=rates.get(c);out[p]=v?v[0]:0;out[p+1]=v?v[1]:0;out[p+2]=v?v[2]:0;out[p+3]=this.n2[c];};
    const fill=(first:number,count:number)=>{
      const state=new Float32Array(count*4),source=new Float32Array(count*4),flags=new Uint32Array(count);
      for(let k=0;k<count;k++){const c=first+k,p=k*4;state[p]=this.h[c];state[p+1]=this.hu[c];state[p+2]=this.hv[c];state[p+3]=this.bed[c]-this.residentDatum;sourceOf(c,source,p);flags[k]=flagsOf(c);}
      return{state,source,flags};
    };
    const inlets=new Set(rates.keys());
    if(this.residentFull){
      // Relative elevation retains shallow water precision high above sea level.
      // The datum changes representation only, never the terrain or its slope.
      this.residentDatum=this.bed.find(Number.isFinite)??0;
      return{upload:{full:fill(0,n),resync:true},inlets};
    }
    const rows=this.residentRows?{j0:this.residentRows[0],j1:this.residentRows[1],...fill(this.residentRows[0]*nx,(this.residentRows[1]-this.residentRows[0]+1)*nx)}:null;
    let resync=!!rows;
    const cells=[...this.residentCells];
    const index=new Uint32Array(cells.length),source=new Float32Array(cells.length*4),flags=new Uint32Array(cells.length),state=new Float32Array(cells.length*4);
    cells.forEach(([c,woke],k)=>{
      index[k]=c;sourceOf(c,source,k*4);flags[k]=flagsOf(c);
      state[k*4]=this.h[c];state[k*4+1]=this.hu[c];state[k*4+2]=this.hv[c];state[k*4+3]=this.bed[c]-this.residentDatum;
      if(woke||this.residentInlets.has(c)!==inlets.has(c))resync=true;
    });
    return{upload:{rows,cells:cells.length?{index,source,flags,state}:null,resync},inlets};
  }

  /** The landing surface for airborne spill water: the cell under (x, z) and
   * its water level over the supported rock (or the bed). */
  private spillSurface(x: number, z: number): { cell: number; level: number } | null {
    const { nx, nz, dx } = this.grid;
    const i = riverIndexX(this.grid,x), j = Math.floor((z - this.grid.z0) / dx);
    if (i < 0 || i >= nx || j < 0 || j >= nz) return null;
    const c = j * nx + i;
    const rock=this.opts.spillBedAt?this.opts.spillBedAt(x,z):this.bed[c];
    return rock!==null&&Number.isFinite(rock) ? { cell: c, level: rock + this.h[c] } : null;
  }

  /** Landed spill water joins its cell (volume, horizontal momentum); a dry
   * eligible cell wakes. Returns whether it woke and its new wave speed. */
  private spillDeposit(c: number, volume: number, velocity: readonly [number, number, number]): { woke: boolean; wave: number } {
    let woke = false;
    if (!this.reach[c]) { this.reach[c] = 1; if (this.transientReach) this.transientReach[c] = 1; woke = true; }
    const depth = volume / (this.grid.xEdges?riverCellArea(this.grid,c):this.grid.dx*this.grid.dx);
    this.h[c] += depth; this.hu[c] += depth * velocity[0]; this.hv[c] += depth * velocity[2];
    this.onWater?.(c);
    return { woke, wave: Math.hypot(this.hu[c], this.hv[c]) / this.h[c] + Math.sqrt(G * this.h[c]) };
  }

  /** Both backends hand arrivals and accounting to the same native owner. */
  private finishStep(dt: number, maxS: number, maxSpeed: number, qOutStep: number, Q: number): number {
    const { nx, nz, dx } = this.grid;
    const { bed, h, hu, hv } = this;
    if (this.spillTransfer) {
      let woke = false;
      // The current finite-volume bed/surface owns contact. Edited geometry
      // is read here each step; old airborne parcels never adopt a new path.
      this.spillTransfer.advance(this.time + dt, (x, z) => this.spillSurface(x, z), (c, volume, velocity) => {
        const landed = this.spillDeposit(c, volume, velocity);
        if (landed.woke) woke = true;
        maxS = Math.max(maxS, landed.wave);
      });
      if (woke) { const built = this.buildRuns(); this.runs = built.runs; this.runStart = built.runStart; }
    }
    this.lastMaxSpeed = Math.max(maxS, 0.5);
    this.time += dt;
    this.steps += 1;
    this.inVolume += Q * dt;
    this.outVolume += qOutStep * dt;
    this.maxSpeedNow = maxSpeed;
    return dt;
  }

  /**
   * RUN TO A STEADY STATE, then average. The first `spinUpS` seconds carry the
   * start state to the flow the bed sets; the next `averageS` seconds are
   * averaged, time-weighted by each step, so a wake that sheds behind a rock
   * leaves its mean and its spread (uRms) instead of one snapshot of it.
   */
  runSteady(spinUpS: number, averageS: number, onProgress?: (done: number) => void): RiverSteadyField {
    const t0 = Date.now();
    const n = this.h.length;
    let nextReport = 0;
    const total = spinUpS + averageS;
    while (this.time < spinUpS) {
      this.step();
      if (onProgress && this.time > nextReport) { onProgress(this.time / total); nextReport += 1; }
    }
    const sh = new Float64Array(n);
    const shu = new Float64Array(n);
    const shv = new Float64Array(n);
    const su2 = new Float64Array(n);
    const tA = this.time;
    const vA = this.volume();
    const inA = this.inVolume;
    const outA = this.outVolume;
    let wSum = 0;
    while (this.time < tA + averageS) {
      const dt = this.step();
      wSum += dt;
      this.addToAverage(dt, sh, shu, shv, su2);
      if (onProgress && this.time > nextReport) { onProgress(this.time / total); nextReport += 1; }
    }
    const { h: hOut, u: uOut, v: vOut, uRms: rms } = meanOfAverage(sh, shu, shv, su2, wSum);
    const span = this.time - tA;
    let maxSpeed = 0;
    for (let c = 0; c < n; c += 1) {
      const s = Math.hypot(uOut[c], vOut[c]);
      if (hOut[c] > 0.01 && s > maxSpeed) maxSpeed = s;
    }
    return {
      grid: this.grid,
      h: hOut,
      u: uOut,
      v: vOut,
      uRms: rms,
      bed: Float32Array.from(this.bed),
      stats: {
        simSeconds: this.time,
        steps: this.steps,
        qIn: (this.inVolume - inA) / span,
        qOut: (this.outVolume - outA) / span,
        dVdt: (this.volume() - vA) / span,
        volume: this.volume(),
        maxSpeed,
        activeCells: this.activeCells,
        breachCells: this.breachCells(),
        wallMs: Date.now() - t0,
      },
    };
  }
}
