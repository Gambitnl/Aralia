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
}

/** One inflow cell and the share of the discharge it takes. */
export interface InflowCell {
  readonly c: number;
  /** Share of the total discharge, 0..1 (the shares sum to 1). */
  readonly share: number;
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
  private runs: Int32Array;
  private runStart: Int32Array;
  /** 1 where the bed stands under the wet ceiling (the cells water may reach). */
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
  private inflow: readonly InflowCell[];
  private inflowDir: readonly [number, number];
  private inflowSpeedMS: number;

  constructor(opts: RiverSolverOptions, wetCeiling?: Float64Array) {
    this.opts = opts;
    this.grid = opts.grid;
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

  /**
   * THE LIVE EDITOR: a new inflow (a new flow from the River shape panel, or
   * a channel moved at the west edge). The water already on the grid keeps
   * flowing; the new inflow starts with the next step.
   */
  setInflow(dischargeM3S: number, inflow: readonly InflowCell[], dir: readonly [number, number], speedMS: number): void {
    this.dischargeM3S = dischargeM3S;
    this.inflow = inflow;
    this.inflowDir = dir;
    this.inflowSpeedMS = speedMS;
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
        const reach = !wetCeiling || zNew < wetCeiling[c] ? 1 : 0;
        const d = this.h[c];
        if (d > this.hDry) {
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
  saveState(): { h: Float64Array; hu: Float64Array; hv: Float64Array; time: number } {
    return { h: this.h.slice(), hu: this.hu.slice(), hv: this.hv.slice(), time: this.time };
  }

  /** Put back a saved water state over the bed as it is now (a cell over the ceiling stays dry). */
  restoreState(s: { h: Float64Array; hu: Float64Array; hv: Float64Array }): void {
    for (let c = 0; c < this.h.length; c += 1) {
      const ok = this.reach[c] && Number.isFinite(s.h[c]) && s.h[c] > 0;
      this.h[c] = ok ? s.h[c] : 0;
      this.hu[c] = ok ? s.hu[c] : 0;
      this.hv[c] = ok ? s.hv[c] : 0;
    }
    this.lastMaxSpeed = 1;
    this.refreshWaveSpeed();
  }

  /**
   * Add one step's state to a time average: the depth, the discharges and
   * the depth-weighted speed squared, each times the step length. The steady
   * run's average and the live run's snapshot windows both use it.
   */
  addToAverage(dt: number, sh: Float64Array, shu: Float64Array, shv: Float64Array, su2: Float64Array): void {
    const { nx, nz } = this.grid;
    const { runs, runStart } = this;
    for (let j = 0; j < nz; j += 1) {
      const row = j * nx;
      for (let r = runStart[j]; r < runStart[j + 1]; r += 2) {
        for (let c = row + runs[r], e = row + runs[r + 1]; c <= e; c += 1) {
          const d = this.h[c];
          if (d <= 0) continue;
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
    let k = 0;
    for (let r = 0; r < this.runs.length; r += 2) k += this.runs[r + 1] - this.runs[r] + 1;
    return k;
  }

  /** Set the start state: depth h and velocity (u, v) per cell. */
  setState(h: Float64Array, u?: Float64Array, v?: Float64Array): void {
    for (let c = 0; c < this.h.length; c += 1) {
      const d = this.reach[c] ? Math.max(0, h[c]) : 0;
      this.h[c] = d;
      this.hu[c] = u ? d * u[c] : 0;
      this.hv[c] = v ? d * v[c] : 0;
    }
  }

  /** Water on the grid, m^3. */
  volume(): number {
    let s = 0;
    for (let c = 0; c < this.h.length; c += 1) s += this.h[c];
    return s * this.grid.dx * this.grid.dx;
  }

  /** Cells holding water past the wet ceiling (a breach): 0 when the ceiling was set high enough. */
  breachCells(): number {
    let k = 0;
    for (let c = 0; c < this.h.length; c += 1) if (!this.reach[c] && this.h[c] > 0.001) k += 1;
    return k;
  }

  /** Advance one adaptive step. Returns the step length, s. */
  step(): number {
    const { nx, nz, dx } = this.grid;
    const { bed, h, hu, hv, u, v, dh, dhu, dhv, runs, runStart, hDry } = this;
    const dt = Math.min(this.maxDt, (this.cfl * dx) / Math.max(0.5, this.lastMaxSpeed));
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
          dh[cL] -= fH * inv;
          dh[cR] += fH * inv;
          dhu[cL] -= (fN + 0.5 * G * (hL * hL - hLs * hLs)) * inv;
          dhu[cR] += (fN + 0.5 * G * (hR * hR - hRs * hRs)) * inv;
          dhv[cL] -= fT * inv;
          dhv[cR] += fT * inv;
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
            qOutStep += q * dx;
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
      const rate = (Q * cell.share) / area;
      dh[cell.c] += rate;
      dhu[cell.c] += rate * sp * ix;
      dhv[cell.c] += rate * sp * iz;
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
        }
      }
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
