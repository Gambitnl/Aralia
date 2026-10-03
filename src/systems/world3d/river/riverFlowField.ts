/**
 * @file riverFlowField.ts — from a bed and a discharge to the flow map the
 * river's look reads: velocity, depth, the extended water surface, white
 * water, foam streaks and the eddy measure.
 *
 * TWO STEPS
 *
 * 1. `solveReach` sets up the flow solver for a reach (the inflow cells, the
 *    ceiling that bounds where water can go, a start state near the answer)
 *    and runs it to a steady, time-averaged field.
 * 2. `buildFlowMap` turns that field into what the renderer samples, one
 *    texel per solver cell. Every value is a pure function of the field, so
 *    the look is a pure function of (seed, time): the time only moves the
 *    textures along the flow, never the fields.
 *
 * THE FOAM IS CARRIED, NOT PAINTED
 *
 * White water starts where the flow breaks: where the Froude number passes 1
 * over shallow fast water, where the flow hits the face of a rock that stands
 * out of the water, and where the flow sheds eddies behind a rock (the
 * solver's unsteady part, uRms). It then rides the flow and clears with a
 * life of 2 s: at 2 m/s it fades over about 4 m, which is the length of the
 * white tongue below a Merced boulder at summer flow. A share of it leaves a
 * long-lived foam (life 40 s) that the flow carries on and collects where the
 * surface converges: along eddy lines, in the eddies and at the banks. Both
 * are steady solutions of an advection with decay, solved on the grid.
 */
import { RiverFlowSolver, G, type InflowCell, type RiverSteadyField, type RiverSolverGrid } from './riverSolver';
import { courseKeyAt, designLevelAt, riverCeilingMarginM, type RiverReach } from './riverReach';

/** Spin-up and averaging times of the judged reach's run, s. See `solveReach`. */
export const RIVER_SPIN_UP_S = 60;
export const RIVER_AVERAGE_S = 20;

/**
 * SOLVE THE REACH. The start state is the design level (`designLevelAt`,
 * calibrated on a 430 s run) with the discharge spread over each
 * cross-section, so the run starts near its answer; 60 s of spin-up and 20 s
 * of averaging then end within a few percent of steady (the outflow and the
 * storage change are in the field's stats, and riverFlowField.test.ts holds
 * the bound). The 20 s average spans about six sheddings of a 1 m boulder at
 * 1.5 m/s (a Strouhal number of 0.2).
 */
export function solveReach(
  reach: RiverReach,
  opts: { spinUpS?: number; averageS?: number; onProgress?: (f: number) => void } = {},
): RiverSteadyField {
  const { solver, h0, u0, v0 } = setupReachSolver(reach);
  solver.setState(h0, u0, v0);
  return solver.runSteady(opts.spinUpS ?? RIVER_SPIN_UP_S, opts.averageS ?? RIVER_AVERAGE_S, opts.onProgress);
}

/** What the flow solver of a reach starts from: the wet ceiling and the design-level start state. */
export interface ReachStartState {
  ceiling: Float64Array;
  h0: Float64Array;
  u0: Float64Array;
  v0: Float64Array;
}

/**
 * THE WET CEILING AND THE START STATE of a reach (see solveReach), from its
 * bed and each cell's place on the course. The live editor calls it again
 * after a bed patch, for the ceiling and the inflow.
 */
export function reachStartState(
  grid: RiverSolverGrid, bed: ArrayLike<number>, cellS: ArrayLike<number>, cellN: ArrayLike<number>,
  course: RiverReach['course'], dischargeM3S: number,
): ReachStartState {
  const { nx, nz, dx } = grid;
  const n = nx * nz;
  const ceiling = new Float64Array(n);
  const h0 = new Float64Array(n);
  const u0 = new Float64Array(n);
  const v0 = new Float64Array(n);
  // Cross-section areas of the start state, per 1 m of s.
  const sMin = -80;
  const bins = new Float64Array(600);
  const ceilingMargin = riverCeilingMarginM();
  for (let c = 0; c < n; c += 1) {
    const s = cellS[c];
    const key = courseKeyAt(s);
    const lvl = designLevelAt(s);
    const inBand = Math.abs(cellN[c]) < key.halfW + 6;
    // THE WET CEILING: 0.8 m over the design level, inside a band 6 m past
    // the banks. The design level is calibrated to the steady level (within
    // 0.15 m on the 430 s run), so no water is ever cut off, and a cell the
    // ceiling rules out costs the step nothing.
    // 0.8 m at the default shape; higher for a shape the panel changed,
    // whose design level is only an estimate (riverCeilingMarginM).
    ceiling[c] = inBand ? lvl + ceilingMargin : -Infinity;
    if (Math.abs(cellN[c]) < key.halfW + 4) {
      const d = lvl - bed[c];
      if (d > 0) {
        h0[c] = d;
        const b = Math.floor(s - sMin);
        if (b >= 0 && b < bins.length) bins[b] += d * dx * dx;
      }
    }
  }
  for (let c = 0; c < n; c += 1) {
    if (h0[c] <= 0) continue;
    const s = cellS[c];
    const b = Math.floor(s - sMin);
    const area = b >= 0 && b < bins.length ? bins[b] : 0;
    const sp = area > 0.5 ? Math.min(3, dischargeM3S / area) : 0;
    const smp = course.at(s);
    u0[c] = sp * smp.tx;
    v0[c] = sp * smp.tz;
  }
  return { ceiling, h0, u0, v0 };
}

/** The inflow of a reach: its cells, its direction and its speed. */
export interface ReachInflow {
  inflow: InflowCell[];
  dir: [number, number];
  speed: number;
}

/**
 * THE INFLOW: the first three columns of the channel, each cell's share
 * weighted by its depth to the power 5/3 (Manning conveyance), so the deep
 * middle takes more of the water than the shallow margins, as it would.
 */
export function reachInflow(
  grid: RiverSolverGrid, h0: ArrayLike<number>, cellS: ArrayLike<number>, cellN: ArrayLike<number>,
  course: RiverReach['course'], dischargeM3S: number,
): ReachInflow {
  const { nx, nz, dx } = grid;
  const inflowRaw: Array<{ c: number; w: number }> = [];
  for (let j = 0; j < nz; j += 1) {
    for (let i = 0; i < 3; i += 1) {
      const c = j * nx + i;
      if (h0[c] > 0.02 && Math.abs(cellN[c]) < courseKeyAt(cellS[c]).halfW) {
        inflowRaw.push({ c, w: Math.pow(h0[c], 5 / 3) });
      }
    }
  }
  const wSum = inflowRaw.reduce((a, b) => a + b.w, 0);
  if (inflowRaw.length === 0 || wSum <= 0) throw new Error('[river] The reach has no wet inflow cells at its west edge.');
  const inflow: InflowCell[] = inflowRaw.map((r) => ({ c: r.c, share: r.w / wSum }));
  const cIn = inflowRaw[Math.floor(inflowRaw.length / 2)].c;
  const tIn = course.at(cellS[cIn]);
  let inArea = 0;
  for (const r of inflowRaw) inArea += h0[r.c] * dx;
  // The inflow's speed: discharge over the inflow's cross-section (3 columns wide).
  const speed = Math.min(2.5, dischargeM3S / Math.max(0.5, inArea / 3));
  return { inflow, dir: [tIn.tx, tIn.tz], speed };
}

/** The flow solver of a reach, set up (ceiling, inflow) but not started, and its start state. */
export function setupReachSolver(reach: RiverReach): ReachStartState & { solver: RiverFlowSolver } {
  const { grid, bed, cellS, cellN, course } = reach;
  const st = reachStartState(grid, bed, cellS, cellN, course, reach.dischargeM3S);
  const inf = reachInflow(grid, st.h0, cellS, cellN, course, reach.dischargeM3S);
  const solver = new RiverFlowSolver({
    grid,
    bed,
    manning: reach.manning,
    dischargeM3S: reach.dischargeM3S,
    inflow: inf.inflow,
    inflowDir: inf.dir,
    inflowSpeedMS: inf.speed,
    outflowEdge: 'east',
  }, st.ceiling);
  return { ...st, solver };
}

/** What the renderer samples. One texel per solver cell, RGBA, row-major (j * nx + i). */
export interface RiverFlowMap {
  readonly grid: RiverSolverGrid;
  /** (u, v) smoothed velocity m/s, depth m, water surface height m (extended past the banks). */
  readonly t0: Float32Array;
  /**
   * white water 0..1, foam streaks 0..1, distance to the nearest wet cell
   * (m, 0 in the water, capped at 8), surface turbulence 0..1 (RIVER_TURB).
   * The distance took the vorticity's place (round 7): the banks' wet band
   * must know how near real water is. The turbulence took the Froude
   * number's place (rivers round 2): the shader computes the Froude number
   * from the speed and the depth it already reads.
   */
  readonly t1: Float32Array;
  /**
   * Rivers round 3: the water's shape around the rocks: surface height (m,
   * pillows and boils up, troughs down) and the V-wakes' ridge lines (0..1).
   */
  readonly t2: Float32Array;
  /**
   * Drawn surface height per cell, m, or NaN where no water surface is drawn.
   * Film cells (under 2 cm) are tucked 3 cm under their bed, so the drawn
   * sheet never lies on the ground it covers (the land page's shore rule).
   */
  readonly surface: Float32Array;
  readonly stats: RiverFlowMapStats;
}

export interface RiverFlowMapStats {
  wetCells: number;
  /** Cells whose mean flow runs against the course (an eddy), with depth over 5 cm. */
  eddyCells: number;
  maxWhite: number;
  maxStreak: number;
  meanSpeedWet: number;
}

/** Tunables of the foam, each with its reason. */
export const RIVER_FOAM = {
  /** Life of white water, s: bubbles rise out in 1 to 3 s below a riffle. */
  // (Rivers round 4: 1.3 s, not 2 s. At the low summer flow the Merced's
  // white water is "tight, torn tongues just downstream of rocks and at
  // steps"; 2 s carried it 2 to 3 m and joined the tongues of the packed rock
  // field into sheets.)
  whiteLifeS: 1.3,
  /** Life of the foam streaks, s: surfactant foam on a river lasts minutes; 40 s keeps them in the judged reach. */
  streakLifeS: 40,
  /**
   * Share of the white water's decay that stays behind as streak foam. 0.06:
   * at 0.18 the streaks reached full cover over half of every reach (round 4)
   * once the rocks made their white water; the Nerang pool shows a few faint
   * lines, not a blanket.
   */
  streakShare: 0.06,
  /**
   * Froude numbers over which the surface starts to break and is fully
   * broken, and the most this alone may cover. A riffle at F = 1.1 is NOT a
   * white sheet in the Merced frames: its white water sits at the rocks and
   * the chutes, and the open riffle shows standing waves with a few white
   * crests. So the Froude term starts at 1.0, is full at 1.9 and covers at
   * most 45 %; the rocks and the wakes (local terms) make the rest.
   */
  /*
   * ROUND 2: the broad terms (Froude, friction dissipation) cover whole
   * riffles, and three blind judges read the result as speckle "sprayed on
   * the gravel, tied to no rock". White water now grows where the water MEETS
   * something: a rock's upstream face, a drop over a submerged rock or a bed
   * step, a wake's shear edge. The broad terms keep a small share, and the
   * rest of a riffle's roughness is the turbulence field (below), which only
   * breaks the surface and paints no foam.
   */
  froudeOn: 1.3,
  froudeFull: 2.2,
  froudeCover: 0.15,
  /**
   * THE ROCK FACE. The water's speed toward an emergent rock within 1 m
   * (two cells): the cell's own speed times the cosine between the flow and
   * the direction to the rock. The solver's flow stagnates AT the face, so
   * the speed into the face cell itself was near zero (round 1); the approach
   * speed one cell out is what piles up the white collar.
   */
  impingeOn: 0.25,
  impingeFull: 0.9,
  /** Unsteady speed (uRms), m/s, over which a wake sheds white water. */
  rmsOn: 0.12,
  rmsFull: 0.5,
  /** Length of the zone where a rock or a chute makes its white water, m. */
  genZoneM: 1.0,
  /**
   * THE THREE SOURCES A DEPTH-AVERAGED SOLVER CAN SEE. At a rock's face the
   * solver's flow stagnates, so the speed into the rock stays small (round 3:
   * the boulder reach averaged a white-water cover of 0.014). The white water
   * of the Merced boulders is in their wakes and chutes, and there the field
   * shows it three ways:
   *   - a STEEP SURFACE: the water drops over and behind a rock; a surface
   *     slope over 6 % breaks, over 25 % is white (the mean riffle slope is 4 %);
   *   - SHEAR at a wake's edge in fast water: vorticity over 0.8 /s breaks,
   *     over 3 /s is white;
   *   - FRICTION DISSIPATION g n^2 |u|^3 / h^(1/3) (per unit mass and depth):
   *     fast water over a shallow cobble bar breaks. 2 m/s over 0.3 m of a
   *     n = 0.045 bed gives 0.24 W/kg; 1 m/s over 0.5 m gives 0.025. It starts
   *     at 0.15 and is full at 0.8, with a weight of 0.35: at 0.08 / 0.4 / 0.5
   *     the whole riffle went white (median cover 0.72; the Merced riffle is
   *     white in tongues, about a quarter of it).
   */
  steepOn: 0.07,
  steepFull: 0.25,
  shearOn: 0.8,
  shearFull: 3.0,
  dissOn: 0.4,
  dissFull: 1.4,
  /** Weights of the sources in the local cover (see buildFlowMap). */
  // (Round 3: the steep-surface and wake terms went down, 0.65 to 0.3 and
  // 0.4 to 0.2: over submerged rocks they drew white patches "with no rock
  // under" them. The emergent rocks' pillows and V-wakes carry the white
  // water now; see the rock surface features.)
  // (Round 4: the wake terms down again, shear 0.25 to 0.15, unsteady wake
  // 0.2 to 0.1, dissipation 0.08 to 0.03: the white water starts AT the
  // rock faces and the steps, and a judge read the rest as "foam patches with
  // no rock causing them".)
  wImpinge: 1.0,
  wSteep: 0.3,
  wShear: 0.15,
  wRms: 0.1,
  wDiss: 0.03,
} as const;

/**
 * THE TURBULENCE FIELD: how broken the SURFACE is, 0 (a glassy pool) to 1
 * (a riffle's chop). It paints no foam; the look turns it into ripple slope,
 * reflection breakup and roughness. It is made where the water loses energy
 * (friction over a shallow bed, shear at a wake's edge, the unsteady wake
 * behind a rock, a drop) and carried downstream with a 6 s life, so a rock
 * leaves a rough wake several meters long and a riffle's tail breaks the head
 * of the pool below it, as the Merced frames show. Round 1 had no such field:
 * the ripple amplitude followed the local speed only, and the still frames
 * read as a mirror.
 */
export const RIVER_TURB = {
  lifeS: 6.0,
  /** Generation zone, m: the rate is the larger of 1 / life and speed / zone. */
  zoneM: 2.0,
  dissOn: 0.02,
  dissFull: 0.35,
  shearOn: 0.3,
  shearFull: 2.0,
  rmsOn: 0.03,
  rmsFull: 0.25,
  steepOn: 0.02,
  steepFull: 0.12,
} as const;

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Depth of a cell that counts as wet for the look, m. */
const WET_M = 0.003;
/** Film depth under which the drawn sheet tucks under the bed, m. */
const FILM_M = 0.02;
const TUCK_M = 0.03;

/**
 * BUILD THE FLOW MAP from a steady field.
 *
 * Steps: the wet set; a depth-weighted 5 x 5 smoothing of the velocity (the
 * textures ride it, and a raw cell-to-cell jump behind a rock would tear
 * them); the velocity carried 4 cells past the wet edge, so the texture filter
 * never pulls in a zero; the Froude number; the white-water source and its
 * steady advection with decay; the streak foam, conservative, so it collects
 * where the surface converges; the vorticity; the drawn surface with the film
 * tuck and a 2-cell extension under the banks, and the level carried 8 cells
 * (4 m) past the edge for the banks' wet band.
 */
export function buildFlowMap(
  field: FlowMapInput,
  ground?: Float64Array | Float32Array,
  manning?: Float32Array,
  boulders?: ReadonlyArray<{ x: number; z: number; y: number; rx: number; ry: number; rz: number }>,
): RiverFlowMap {
  return flowMapCore(field, ground, manning, boulders, { kind: 'steady' }).map;
}

/** What the flow map reads of a flow field: the steady field, or the live run's window mean. */
export interface FlowMapInput {
  readonly grid: RiverSolverGrid;
  readonly h: Float32Array;
  readonly u: Float32Array;
  readonly v: Float32Array;
  readonly uRms: Float32Array;
  readonly bed: Float32Array | Float64Array;
}

/**
 * HOW THE CARRIED FIELDS ARE FOUND: the white water (W), the surface
 * turbulence (T) and the streak foam (L).
 * - `steady`: each is the steady solution of its advection with decay, from
 *   zero (a pseudo-time run to five lives; the judged scene).
 * - `step` (the live river, 2026-09-29): each moves on from its last value by
 *   `dtS` seconds of the flow's own time, with the same update. The arrays
 *   are the live run's own, updated in place. A cell that is dry now keeps
 *   none. The steady run's pseudo-time is also real time for these equations,
 *   so a long enough live run ends on the same fields.
 */
export type FlowMapFoam =
  | { readonly kind: 'steady' }
  | { readonly kind: 'step'; readonly dtS: number; readonly W: Float32Array; readonly T: Float32Array; readonly L: Float32Array };

/** The longest step the live flow map takes the carried fields in one call, s (a longer gap moves them less). */
export const RIVER_LIVE_FOAM_MAX_DT_S = 4;

/** The flow map and its carried fields (see FlowMapFoam). */
export function flowMapCore(
  field: FlowMapInput,
  ground: Float64Array | Float32Array | undefined,
  manning: Float32Array | undefined,
  boulders: ReadonlyArray<{ x: number; z: number; y: number; rx: number; ry: number; rz: number }> | undefined,
  foam: FlowMapFoam,
  timings?: Record<string, number>,
): { map: RiverFlowMap; W: Float32Array; T: Float32Array; L: Float32Array } {
  // Stage times, ms, when asked (the live river shows them; they change no value).
  let tMark = timings ? performance.now() : 0;
  const mark = (stage: string): void => {
    if (!timings) return;
    const now = performance.now();
    timings[stage] = (timings[stage] ?? 0) + (now - tMark);
    tMark = now;
  };
  const { grid, h, u, v, uRms, bed } = field;
  // Roughness for the dissipation source: the reach's own, or a cobble bed.
  const manningOf = (c: number): number => (manning ? manning[c] : 0.04);
  const { nx, nz, dx } = grid;
  const n = nx * nz;
  const wet = new Uint8Array(n);
  let wetCells = 0;
  for (let c = 0; c < n; c += 1) {
    if (h[c] > WET_M) { wet[c] = 1; wetCells += 1; }
  }
  const active = new Int32Array(wetCells);
  // THE WET BOX (the live river, 2026-09-29): the rows and columns that hold
  // wet cells. Every ring below grows only from the wet cells, so a loop over
  // this box, widened by its number of rings, reaches every cell the full
  // grid's loop would change, in the same order (the judged map is the same
  // bit for bit, and the live map costs a third).
  let wi0 = nx;
  let wi1 = -1;
  let wj0 = nz;
  let wj1 = -1;
  {
    let q = 0;
    for (let c = 0; c < n; c += 1) {
      if (!wet[c]) continue;
      active[q] = c;
      q += 1;
      const i = c % nx;
      const j = (c - i) / nx;
      if (i < wi0) wi0 = i;
      if (i > wi1) wi1 = i;
      if (j < wj0) wj0 = j;
      if (j > wj1) wj1 = j;
    }
  }
  /** The wet box widened by `r` cells, clamped to the grid. */
  const wetBox = (r: number): [number, number, number, number] => (wi1 < 0
    ? [0, -1, 0, -1]
    : [Math.max(0, wi0 - r), Math.min(nx - 1, wi1 + r), Math.max(0, wj0 - r), Math.min(nz - 1, wj1 + r)]);
  // Ring updates, as typed arrays (a tuple per cell was most of their cost).
  const addC = new Int32Array(n);
  const addA = new Float64Array(n);
  const addB = new Float64Array(n);

  // ---- smoothed velocity -------------------------------------------------
  const us = new Float32Array(n);
  const vs = new Float32Array(n);
  // Gaussian of sigma 1 cell, and the distances of a 5 x 5 window (the
  // tables hold Math.exp's and Math.hypot's own values).
  const gauss = new Float64Array(25);
  const hypot5 = new Float64Array(25);
  for (let dj = -2; dj <= 2; dj += 1) {
    for (let di = -2; di <= 2; di += 1) {
      gauss[(dj + 2) * 5 + di + 2] = Math.exp(-(di * di + dj * dj) / 2);
      hypot5[(dj + 2) * 5 + di + 2] = Math.hypot(di, dj);
    }
  }
  for (const c of active) {
    const i = c % nx;
    const j = (c - i) / nx;
    let su = 0;
    let sv = 0;
    let sw = 0;
    for (let dj = -2; dj <= 2; dj += 1) {
      const jj = j + dj;
      if (jj < 0 || jj >= nz) continue;
      for (let di = -2; di <= 2; di += 1) {
        const ii = i + di;
        if (ii < 0 || ii >= nx) continue;
        const k = jj * nx + ii;
        if (!wet[k]) continue;
        // Gaussian of sigma 1 cell, times depth (a deep cell carries more of
        // the flow and should weigh more).
        const w = gauss[(dj + 2) * 5 + di + 2] * Math.min(1, h[k] / 0.3);
        su += w * u[k];
        sv += w * v[k];
        sw += w;
      }
    }
    if (sw > 0) { us[c] = su / sw; vs[c] = sv / sw; }
  }
  // Carry the velocity past the wet edge (4 rings).
  const known = wet.slice();
  {
    const [bi0, bi1, bj0, bj1] = wetBox(4);
    for (let ring = 0; ring < 4; ring += 1) {
      let na = 0;
      for (let j = bj0; j <= bj1; j += 1) {
        for (let i = bi0; i <= bi1; i += 1) {
          const c = j * nx + i;
          if (known[c]) continue;
          let su = 0;
          let sv = 0;
          let k = 0;
          if (i > 0 && known[c - 1]) { su += us[c - 1]; sv += vs[c - 1]; k += 1; }
          if (i < nx - 1 && known[c + 1]) { su += us[c + 1]; sv += vs[c + 1]; k += 1; }
          if (j > 0 && known[c - nx]) { su += us[c - nx]; sv += vs[c - nx]; k += 1; }
          if (j < nz - 1 && known[c + nx]) { su += us[c + nx]; sv += vs[c + nx]; k += 1; }
          if (k > 0) { addC[na] = c; addA[na] = su / k; addB[na] = sv / k; na += 1; }
        }
      }
      for (let q = 0; q < na; q += 1) { const c = addC[q]; us[c] = addA[q]; vs[c] = addB[q]; known[c] = 1; }
    }
  }

  mark('velocity');
  // ---- vorticity (the shear source reads it) ------------------------------------
  const vort = new Float32Array(n);
  for (const c of active) {
    const i = c % nx;
    if (i === 0 || i === nx - 1 || c - nx < 0 || c + nx >= n) continue;
    vort[c] = (vs[c + 1] - vs[c - 1]) / (2 * dx) - (us[c + nx] - us[c - nx]) / (2 * dx);
  }

  mark('vorticity');
  // ---- rock surface features (rivers round 3) ------------------------------------
  // THE WATER'S SHAPE AROUND EACH ROCK that stands out of the water or lies
  // within 0.35 m under it. A depth-averaged solver at 0.5 m smears these
  // away, and three judges asked for them by name: a PILLOW where the water
  // piles up against the rock's upstream face (stagnation head U^2 / 2g, at
  // most 0.25 m), a TROUGH in its lee, and a V-WAKE of two ridges that leave
  // its flanks at the wave angle asin(1 / F) (35 degrees when the flow is
  // subcritical, whose V is short-crested) and fade over 2 to 8 m. A rock
  // under the surface raises a BOIL downstream of it instead of a pillow.
  // The heights go into t2.x (m; the look takes their gradient as surface
  // slope), the ridge lines into t2.y (0..1), and the pillow crests and the
  // wake roots feed the white water's cover, so white water starts AT the
  // rocks and is carried downstream from there.
  const bump = new Float32Array(n);
  const lines = new Float32Array(n);
  const rockCover = new Float32Array(n);
  const splat = (cx: number, cz: number, rad: number, fn: (x: number, z: number, c: number) => void): void => {
    const i0 = Math.max(0, Math.floor((cx - rad - grid.x0) / dx));
    const i1 = Math.min(nx - 1, Math.ceil((cx + rad - grid.x0) / dx));
    const j0 = Math.max(0, Math.floor((cz - rad - grid.z0) / dx));
    const j1 = Math.min(nz - 1, Math.ceil((cz + rad - grid.z0) / dx));
    for (let j = j0; j <= j1; j += 1) {
      for (let i = i0; i <= i1; i += 1) {
        const c = j * nx + i;
        if (!wet[c]) continue;
        fn(grid.x0 + (i + 0.5) * dx, grid.z0 + (j + 0.5) * dx, c);
      }
    }
  };
  let rockFeatures = 0;
  for (const b of boulders ?? []) {
    const R = Math.max(b.rx, b.rz);
    // The water around it: level, velocity and depth over a ring 0.5 to 2 m
    // out from its edge.
    let sEta = 0;
    let sU = 0;
    let sV = 0;
    let sH = 0;
    let k = 0;
    splat(b.x, b.z, R + 2, (x, z, c) => {
      const dist = Math.hypot(x - b.x, z - b.z);
      if (dist < R + 0.5) return;
      sEta += bed[c] + h[c];
      sU += u[c];
      sV += v[c];
      sH += h[c];
      k += 1;
    });
    if (k < 4) continue;
    const level = sEta / k;
    const U = Math.hypot(sU, sV) / k;
    const depth = sH / k;
    const top = b.y + b.ry;
    const sub = level - top;
    if (sub > 0.35 || U < 0.25) continue;
    rockFeatures += 1;
    const dX = sU / Math.hypot(sU, sV);
    const dZ = sV / Math.hypot(sU, sV);
    const pX = -dZ;
    const pZ = dX;
    const emergent = sub < 0;
    const fade = emergent ? 1 : 1 - sub / 0.35;
    const head = Math.min(0.25, (0.9 * U * U) / (2 * G)) * fade;
    const F = U / Math.sqrt(G * Math.max(depth, 0.05));
    const theta = F > 1.05 ? Math.min(0.75, Math.max(0.3, Math.asin(1 / F))) : 0.6;
    const L = Math.min(8, Math.max(2, 2 + 2.5 * U));
    // A submerged rock makes little white (0.15): white patches with no rock
    // in sight read as "stamps on open water" to two judges.
    const white = smoothstep(0.4, 1.4, U) * (emergent ? 1 : 0.15);
    if (emergent) {
      // Pillow on the upstream face, trough in the lee.
      const pcx = b.x - dX * (R + 0.25);
      const pcz = b.z - dZ * (R + 0.25);
      const sa = 0.35 + 0.2 * R;
      const sc = 0.3 + 0.6 * R;
      splat(pcx, pcz, 3 * sc, (x, z, c) => {
        const ax = (x - pcx) * dX + (z - pcz) * dZ;
        const cx2 = (x - pcx) * pX + (z - pcz) * pZ;
        const g = Math.exp(-0.5 * ((ax / sa) ** 2 + (cx2 / sc) ** 2));
        bump[c] += head * g;
        rockCover[c] = Math.max(rockCover[c], white * g);
      });
      const tcx = b.x + dX * (R + 0.5 + 0.3 * U);
      const tcz = b.z + dZ * (R + 0.5 + 0.3 * U);
      splat(tcx, tcz, 3 * (0.3 + 0.5 * R), (x, z, c) => {
        const ax = (x - tcx) * dX + (z - tcz) * dZ;
        const cx2 = (x - tcx) * pX + (z - tcz) * pZ;
        bump[c] -= 0.6 * head * Math.exp(-0.5 * ((ax / (0.4 + 0.5 * R)) ** 2 + (cx2 / (0.3 + 0.5 * R)) ** 2));
      });
    } else {
      // A boil: a low dome downstream of the submerged rock.
      const bcx = b.x + dX * (0.3 + sub * U);
      const bcz = b.z + dZ * (0.3 + sub * U);
      const sb = 0.4 + 0.6 * R;
      splat(bcx, bcz, 3 * sb, (x, z, c) => {
        bump[c] += 0.7 * head * Math.exp(-0.5 * (((x - bcx) ** 2 + (z - bcz) ** 2) / (sb * sb)));
      });
    }
    // The V: two ridges from the flanks.
    for (const side of [-1, 1]) {
      const ox = b.x + pX * side * R * 0.9;
      const oz = b.z + pZ * side * R * 0.9;
      const aX = dX * Math.cos(theta) + pX * side * Math.sin(theta);
      const aZ = dZ * Math.cos(theta) + pZ * side * Math.sin(theta);
      const mx = ox + aX * L * 0.5;
      const mz = oz + aZ * L * 0.5;
      splat(mx, mz, L * 0.5 + 1.2, (x, z, c) => {
        const t = (x - ox) * aX + (z - oz) * aZ;
        if (t < 0 || t > L) return;
        const off = (x - ox) * -aZ + (z - oz) * aX;
        const w = 0.35 + 0.05 * t;
        const g = Math.exp(-0.5 * (off / w) ** 2) * Math.exp((-1.5 * t) / L);
        bump[c] += 0.5 * head * g;
        // A submerged rock's V is half as strong (and makes no white line).
        lines[c] = Math.max(lines[c], g * (emergent ? 1 : 0.5 * fade));
        if (t < 0.6 * L) rockCover[c] = Math.max(rockCover[c], 0.7 * white * g);
      });
    }
  }

  mark('rocks');
  // ---- sources ----------------------------------------------------------------
  /** The local cover the white water relaxes toward, and the relaxation rate (1/s). */
  const coverW = new Float32Array(n);
  const rateW = new Float32Array(n);
  /** The same for the surface turbulence. */
  const coverT = new Float32Array(n);
  const rateT = new Float32Array(n);
  const PT = RIVER_TURB;
  const P = RIVER_FOAM;
  let speedSum = 0;
  for (const c of active) {
    const d = h[c];
    const sp = Math.hypot(u[c], v[c]);
    speedSum += sp;
    const F = sp / Math.sqrt(G * Math.max(d, 0.01));
    // Impingement: the approach speed toward an emergent rock (a dry cell
    // whose bed stands 5 cm over this cell's water surface) within two cells,
    // weighted by the cosine between the flow and the direction to it and
    // by 1 / distance in cells (the collar is thickest at the face).
    const i = c % nx;
    const j = (c - i) / nx;
    const eta = bed[c] + d;
    let imp = 0;
    if (sp > 0.05) {
      const ux = u[c] / sp;
      const vz = v[c] / sp;
      for (let dj = -2; dj <= 2; dj += 1) {
        const jj = j + dj;
        if (jj < 0 || jj >= nz) continue;
        for (let di = -2; di <= 2; di += 1) {
          if (di === 0 && dj === 0) continue;
          const ii = i + di;
          if (ii < 0 || ii >= nx) continue;
          const k = jj * nx + ii;
          if (wet[k] || bed[k] <= eta + 0.05) continue;
          const dist = hypot5[(dj + 2) * 5 + di + 2];
          if (dist > 2.3) continue;
          const cos = (ux * di + vz * dj) / dist;
          if (cos <= 0) continue;
          const into = sp * cos / Math.max(1, dist * 0.8);
          if (into > imp) imp = into;
        }
      }
    }
    const a = smoothstep(P.froudeOn, P.froudeFull, F);
    const b = smoothstep(P.impingeOn, P.impingeFull, imp);
    const r = smoothstep(P.rmsOn, P.rmsFull, uRms[c]);
    // Surface slope from the wet neighbors (central where both are wet).
    const etaL = i > 0 && wet[c - 1] ? bed[c - 1] + h[c - 1] : eta;
    const etaR = i < nx - 1 && wet[c + 1] ? bed[c + 1] + h[c + 1] : eta;
    const etaD = c - nx >= 0 && wet[c - nx] ? bed[c - nx] + h[c - nx] : eta;
    const etaU = c + nx < n && wet[c + nx] ? bed[c + nx] + h[c + nx] : eta;
    const steep = Math.hypot(etaR - etaL, etaU - etaD) / (2 * dx);
    const st = smoothstep(P.steepOn, P.steepFull, steep);
    const sh = smoothstep(P.shearOn, P.shearFull, Math.abs(vort[c])) * smoothstep(0.5, 1.5, sp);
    const diss = (G * manningOf(c) * manningOf(c) * sp * sp * sp) / Math.cbrt(Math.max(d, 0.02));
    const ds = smoothstep(P.dissOn, P.dissFull, diss);
    // A thin sheet over a rock face cannot hold much air: fade the source in
    // water under 4 cm so a film on a bank never reads as white water.
    const thin = smoothstep(0.01, 0.04, d);
    const cover = Math.min(1, P.froudeCover * a + P.wImpinge * b + P.wRms * r + P.wSteep * st + P.wShear * sh + P.wDiss * ds + rockCover[c]) * thin;
    // THE SURFACE TURBULENCE's local cover: the same physics at lower
    // thresholds (a surface is broken long before it is white).
    const tDiss = smoothstep(PT.dissOn, PT.dissFull, diss);
    const tShear = smoothstep(PT.shearOn, PT.shearFull, Math.abs(vort[c])) * smoothstep(0.2, 1.0, sp);
    const tRms = smoothstep(PT.rmsOn, PT.rmsFull, uRms[c]);
    const tSteep = smoothstep(PT.steepOn, PT.steepFull, steep);
    const tCover = Math.min(1, 0.8 * tDiss + 0.6 * tShear + 0.8 * tRms + 0.7 * tSteep + b + cover);
    coverT[c] = tCover;
    rateT[c] = tCover > 0 ? Math.max(1 / PT.lifeS, sp / PT.zoneM) : 0;
    // THE SOURCE IS A RELAXATION toward the local cover:
    //   dW/dt + u . grad W = k max(0, cover - W) - W / life,
    // with k the larger of 1 / life and speed / 1 m (the water spends
    // 1 m / speed in a generation zone). A lone rock brings its white water
    // up to its cover even at 2 m/s, and the tongue then fades downstream
    // over speed x life; a riffle whose every cell is a source stays AT its
    // cover. Round 3 used a rate of cover / life (a rock's foam reached an
    // eighth of its cover); round 4 used cover x k at every cell (a riffle
    // piled up to four times its cover and went white).
    coverW[c] = cover;
    rateW[c] = cover > 0 ? Math.max(1 / P.whiteLifeS, sp / P.genZoneM) : 0;
  }

  mark('sources');
  // ---- steady advection with decay (upwind) ---------------------------------
  // Pseudo-time step at a Courant number of 0.4 on the smoothed velocity.
  let maxUV = 0.5;
  for (const c of active) {
    const s = Math.abs(us[c]) + Math.abs(vs[c]);
    if (s > maxUV) maxUV = s;
  }
  let maxK = Math.max(1 / P.whiteLifeS, 1 / RIVER_TURB.lifeS);
  for (const c of active) {
    const k = Math.max(rateW[c], rateT[c]);
    if (k > maxK) maxK = k;
  }
  // Courant number 0.4 on the smoothed velocity, and a relaxation step dtp k
  // under 0.5, so neither the advection nor the relaxation overshoots.
  const dtp = Math.min((0.4 * dx) / maxUV, 0.5 / maxK);
  const inv = 1 / dx;
  // THE LIVE RIVER: the carried fields move on by the flow's time since the
  // last map, in steps no longer than the steady run's (so neither the
  // advection nor the relaxation overshoots); a dry cell keeps none.
  const live = foam.kind === 'step';
  const liveSteps = live ? Math.max(1, Math.ceil(Math.min(RIVER_LIVE_FOAM_MAX_DT_S, foam.dtS) / dtp)) : 0;
  const liveDt = live ? Math.min(RIVER_LIVE_FOAM_MAX_DT_S, foam.dtS) / liveSteps : 0;
  if (live) {
    for (let c = 0; c < n; c += 1) {
      if (wet[c]) continue;
      foam.W[c] = 0;
      foam.T[c] = 0;
      foam.L[c] = 0;
    }
  }
  /**
   * The steady solution of dQ/dt + u . grad Q = k max(0, cover - Q) - Q / life
   * (upwind, pseudo-time to five lives); or, live, `steps` steps of `dq`
   * seconds from Q's last values.
   */
  const advectRelax = (cover: Float32Array, rate: Float32Array, life: number, Qlive?: Float32Array): Float32Array => {
    const Q = Qlive ?? new Float32Array(n);
    const Qn = new Float32Array(n);
    const steps = Qlive ? liveSteps : Math.ceil((5 * life) / dtp);
    const dq = Qlive ? liveDt : dtp;
    for (let it = 0; it < steps; it += 1) {
      for (const c of active) {
        const i = c % nx;
        const ux = us[c];
        const vz = vs[c];
        // Upwind gradients; a dry upwind neighbor holds none.
        const ql = i > 0 && wet[c - 1] ? Q[c - 1] : 0;
        const qr = i < nx - 1 && wet[c + 1] ? Q[c + 1] : 0;
        const qd = c - nx >= 0 && wet[c - nx] ? Q[c - nx] : 0;
        const qu = c + nx < n && wet[c + nx] ? Q[c + nx] : 0;
        const q0 = Q[c];
        const gx = ux > 0 ? (q0 - ql) * inv : (qr - q0) * inv;
        const gz = vz > 0 ? (q0 - qd) * inv : (qu - q0) * inv;
        const relax = rate[c] * Math.max(0, cover[c] - q0);
        Qn[c] = Math.max(0, q0 + dq * (relax - ux * gx - vz * gz - q0 / life));
      }
      for (const c of active) Q[c] = Math.min(1, Qn[c]);
    }
    return Q;
  };
  const W = advectRelax(coverW, rateW, P.whiteLifeS, live ? foam.W : undefined);
  const T = advectRelax(coverT, rateT, RIVER_TURB.lifeS, live ? foam.T : undefined);
  // Streak foam: conservative form, d L / dt + div(U L) = S - L / life.
  const L = live ? foam.L : new Float32Array(n);
  const Ln = new Float32Array(n);
  const stepsL = live ? liveSteps : Math.ceil((3 * P.streakLifeS) / dtp);
  const dL = live ? liveDt : dtp;
  // Face velocities (x faces at i - 1/2, z faces at j - 1/2), averaged from
  // the smoothed velocity; zero on a face with a dry side.
  const fx = new Float32Array(n);
  const fz = new Float32Array(n);
  for (const c of active) {
    const i = c % nx;
    if (i > 0 && wet[c - 1]) fx[c] = 0.5 * (us[c] + us[c - 1]);
    if (c - nx >= 0 && wet[c - nx]) fz[c] = 0.5 * (vs[c] + vs[c - nx]);
  }
  for (let it = 0; it < stepsL; it += 1) {
    for (const c of active) {
      const i = c % nx;
      const l0 = L[c];
      // Flux through the west face (into c when positive).
      const fW = fx[c];
      const inW = fW > 0 ? fW * (i > 0 ? L[c - 1] : 0) : fW * l0;
      const fE = i < nx - 1 ? fx[c + 1] : 0;
      const outE = fE > 0 ? fE * l0 : fE * (i < nx - 1 ? L[c + 1] : 0);
      const fN = fz[c];
      const inN = fN > 0 ? fN * (c - nx >= 0 ? L[c - nx] : 0) : fN * l0;
      const fSo = c + nx < n ? fz[c + nx] : 0;
      const outS = fSo > 0 ? fSo * l0 : fSo * (c + nx < n ? L[c + nx] : 0);
      const div = (inW - outE + inN - outS) * inv;
      const src = (P.streakShare * W[c]) / P.whiteLifeS;
      Ln[c] = Math.max(0, l0 + dL * (div + src - l0 / P.streakLifeS));
    }
    for (const c of active) L[c] = Ln[c];
  }

  mark('advection');
  // ---- surface -----------------------------------------------------------------
  const surface = new Float32Array(n).fill(NaN);
  const level = new Float32Array(n).fill(NaN);
  for (const c of active) {
    const eta = bed[c] + h[c];
    level[c] = eta;
    surface[c] = h[c] < FILM_M ? Math.min(eta, bed[c] - TUCK_M) : eta;
  }
  // Extend the level 8 rings past the wet edge (the wet band reads it) and
  // the drawn surface 2 rings, under the bank, so the sheet meets the bank in
  // a line the depth test cuts cleanly.
  // (`reach`: how far past the wet box the known cells can be by the last
  // ring, so the loop covers every cell the full grid's loop would add.)
  const extend = (arr: Float32Array, rings: number, underBedOnly: boolean, reach: number): void => {
    const [bi0, bi1, bj0, bj1] = wetBox(reach);
    for (let ring = 0; ring < rings; ring += 1) {
      let na = 0;
      for (let j = bj0; j <= bj1; j += 1) {
        for (let i = bi0; i <= bi1; i += 1) {
          const c = j * nx + i;
          if (!Number.isNaN(arr[c])) continue;
          let s = 0;
          let k = 0;
          if (i > 0 && !Number.isNaN(arr[c - 1])) { s += arr[c - 1]; k += 1; }
          if (i < nx - 1 && !Number.isNaN(arr[c + 1])) { s += arr[c + 1]; k += 1; }
          if (j > 0 && !Number.isNaN(arr[c - nx])) { s += arr[c - nx]; k += 1; }
          if (j < nz - 1 && !Number.isNaN(arr[c + nx])) { s += arr[c + nx]; k += 1; }
          if (k === 0) continue;
          let val = s / k;
          // The drawn sheet may only pass UNDER the ground past the edge;
          // over a hollow it would draw water where there is none.
          if (underBedOnly) {
            if (bed[c] < val + 0.01) continue;
            val = Math.min(val, bed[c] - TUCK_M);
          }
          addC[na] = c;
          addA[na] = val;
          na += 1;
        }
      }
      for (let q = 0; q < na; q += 1) arr[addC[q]] = addA[q];
    }
  };
  // THE BOULDERS: the water runs on over a rock's footprint, at the level
  // around it. The solver's rock is an ellipsoid and the drawn rock carries a
  // bump of up to 11 %, so a rock whose top stands 5 cm out of the water in
  // the solver can stand under it when drawn; a hole in the sheet over such a
  // rock showed the rock dry, as a dark pit (round 1). Where the drawn rock is
  // higher than the water it hides the sheet, and the depth test draws the
  // waterline around it. Needs the ground (the bed without the rocks).
  if (ground) {
    const [bi0, bi1, bj0, bj1] = wetBox(12);
    /** A neighbor the footprint fill takes its level from: known, and wet or a rock's footprint. */
    const takes = (q: number): boolean => !Number.isNaN(level[q]) && (wet[q] === 1 || bed[q] >= ground[q] + 0.01);
    for (let ring = 0; ring < 12; ring += 1) {
      let na = 0;
      for (let j = bj0; j <= bj1; j += 1) {
        for (let i = bi0; i <= bi1; i += 1) {
          const c = j * nx + i;
          if (!Number.isNaN(surface[c]) || bed[c] < ground[c] + 0.01) continue;
          let sum = 0;
          let k = 0;
          if (i > 0 && takes(c - 1)) { sum += level[c - 1]; k += 1; }
          if (i < nx - 1 && takes(c + 1)) { sum += level[c + 1]; k += 1; }
          if (j > 0 && takes(c - nx)) { sum += level[c - nx]; k += 1; }
          if (j < nz - 1 && takes(c + nx)) { sum += level[c + nx]; k += 1; }
          if (k > 0) { addC[na] = c; addA[na] = sum / k; na += 1; }
        }
      }
      if (na === 0) break;
      for (let q = 0; q < na; q += 1) { const c = addC[q]; surface[c] = addA[q]; level[c] = addA[q]; }
    }
  }
  extend(surface, 2, true, 14);
  extend(level, 8, false, 20);
  // THE LEVEL FIELD past the 8 rings: every other cell of the grid takes a
  // smoothed level from the water around it (Jacobi averaging, 60 sweeps at a
  // quarter resolution), so the bank's height over the water is a smooth
  // field and the grass line has no steps (round 2: the line went in
  // staircase steps where the 8-ring extension ended).
  {
    const q = 4;
    const cx = Math.ceil(nx / q);
    const cz = Math.ceil(nz / q);
    const coarse = new Float32Array(cx * cz);
    const fixed = new Uint8Array(cx * cz);
    const cnt = new Float32Array(cx * cz);
    for (let j = 0; j < nz; j += 1) {
      for (let i = 0; i < nx; i += 1) {
        const v = level[j * nx + i];
        if (Number.isNaN(v)) continue;
        const k = Math.floor(j / q) * cx + Math.floor(i / q);
        coarse[k] += v;
        cnt[k] += 1;
      }
    }
    let mean = 0;
    let mk = 0;
    for (let k = 0; k < coarse.length; k += 1) {
      if (cnt[k] > 0) { coarse[k] /= cnt[k]; fixed[k] = 1; mean += coarse[k]; mk += 1; }
    }
    mean = mk ? mean / mk : 0;
    for (let k = 0; k < coarse.length; k += 1) if (!fixed[k]) coarse[k] = mean;
    const tmp = new Float32Array(coarse.length);
    for (let it = 0; it < 60; it += 1) {
      for (let j = 0; j < cz; j += 1) {
        for (let i = 0; i < cx; i += 1) {
          const k = j * cx + i;
          if (fixed[k]) { tmp[k] = coarse[k]; continue; }
          let s = 0;
          let w = 0;
          if (i > 0) { s += coarse[k - 1]; w += 1; }
          if (i < cx - 1) { s += coarse[k + 1]; w += 1; }
          if (j > 0) { s += coarse[k - cx]; w += 1; }
          if (j < cz - 1) { s += coarse[k + cx]; w += 1; }
          tmp[k] = s / w;
        }
      }
      coarse.set(tmp);
    }
    for (let j = 0; j < nz; j += 1) {
      for (let i = 0; i < nx; i += 1) {
        const c = j * nx + i;
        if (!Number.isNaN(level[c])) continue;
        // Bilinear read of the coarse field at the cell center.
        const fx = Math.min(cx - 1.001, Math.max(0, (i + 0.5) / q - 0.5));
        const fz = Math.min(cz - 1.001, Math.max(0, (j + 0.5) / q - 0.5));
        const ii = Math.floor(fx);
        const jj = Math.floor(fz);
        const tx = fx - ii;
        const tz = fz - jj;
        const a = coarse[jj * cx + ii] + (coarse[jj * cx + ii + 1] - coarse[jj * cx + ii]) * tx;
        const b = coarse[(jj + 1) * cx + ii] + (coarse[(jj + 1) * cx + ii + 1] - coarse[(jj + 1) * cx + ii]) * tx;
        level[c] = a + (b - a) * tz;
      }
    }
  }

  mark('surface');
  // ---- distance to the nearest wet cell (4-neighbor rings, m) ---------------------
  const wetDist = new Float32Array(n).fill(8);
  {
    let front: number[] = [];
    for (const c of active) { wetDist[c] = 0; front.push(c); }
    for (let ring = 1; ring <= 16 && front.length; ring += 1) {
      const next: number[] = [];
      for (const c of front) {
        const i = c % nx;
        const nb = [i > 0 ? c - 1 : -1, i < nx - 1 ? c + 1 : -1, c - nx, c + nx];
        for (const q of nb) {
          if (q < 0 || q >= n || wetDist[q] <= ring * dx) continue;
          wetDist[q] = ring * dx;
          next.push(q);
        }
      }
      front = next;
    }
  }

  mark('distance');
  // ---- pack -------------------------------------------------------------------
  const t0 = new Float32Array(n * 4);
  const t1 = new Float32Array(n * 4);
  const t2 = new Float32Array(n * 4);
  for (let c = 0; c < n; c += 1) {
    t2[c * 4] = bump[c];
    t2[c * 4 + 1] = Math.min(1, lines[c]);
  }
  let maxWhite = 0;
  let maxStreak = 0;
  for (let c = 0; c < n; c += 1) {
    t0[c * 4] = us[c];
    t0[c * 4 + 1] = vs[c];
    t0[c * 4 + 2] = wet[c] ? h[c] : 0;
    t0[c * 4 + 3] = Number.isNaN(level[c]) ? -100 : level[c];
    const w = W[c];
    const l = Math.min(1, L[c]);
    t1[c * 4] = w;
    t1[c * 4 + 1] = l;
    t1[c * 4 + 2] = wetDist[c];
    t1[c * 4 + 3] = wet[c] ? T[c] : 0;
    if (w > maxWhite) maxWhite = w;
    if (l > maxStreak) maxStreak = l;
  }
  mark('pack');
  return {
    map: {
      grid,
      t0,
      t1,
      t2,
      surface,
      stats: {
        wetCells,
        eddyCells: 0,
        maxWhite,
        maxStreak,
        meanSpeedWet: wetCells ? speedSum / wetCells : 0,
      },
    },
    W,
    T,
    L,
  };
}

/**
 * Count the eddy cells: wet over 5 cm, with the mean flow running against the
 * course's downstream direction. Separate from `buildFlowMap` because it needs
 * the course, which the flow map does not.
 */
export function countEddyCells(field: RiverSteadyField, reach: RiverReach): number {
  let k = 0;
  const n = field.h.length;
  for (let c = 0; c < n; c += 1) {
    if (field.h[c] < 0.05) continue;
    const t = reach.course.at(reach.cellS[c]);
    if (field.u[c] * t.tx + field.v[c] * t.tz < -0.05) k += 1;
  }
  return k;
}
