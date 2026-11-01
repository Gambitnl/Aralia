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

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 16/10/2026, 07:56:21
 * Dependents: components/World3D/water/riverExperimentPool.ts, components/World3D/water/riverReachScene.ts, components/World3D/water/riverWaterMaterial.ts, components/World3D/water/riverWaterfallView.ts, systems/world3d/river/riverLive.ts, systems/world3d/river/riverTerrainCourse.ts, systems/world3d/river/riverWorker.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { RiverFlowSolver, G, type InflowCell, type RiverSteadyField, type RiverSolverGrid } from './riverSolver';
import { mainBoulderShape, courseKeyAt, designLevelAt, getRiverShape, riverCeilingMarginM, type RiverReach } from './riverReach';
import { airborneHeadwater, MAIN_CHANNEL_S, projectMainRapids, riverHeadwatersEnabled, waterfallHydraulics, waterfallLanding, WATERFALL } from './riverHeadwaters';
import { riverCellX,riverCellWidth,riverMinimumSpacing,riverRectWetDistance } from './riverRectGrid';
import { toHalfBits } from './riverWaterSheet';
import { RIVER_FAR_LEVEL, type RiverCoarseLevel } from './riverFlowPatch';
export { RIVER_FAR_LEVEL, riverFarLevelAt, type RiverCoarseLevel } from './riverFlowPatch';

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
  // The upstream waterfall and the main branch have their own addresses.
  // Separate bins keep one branch's start velocity from using the other's area.
  const sMin = -260;
  const bins = new Float64Array(1800);
  const ceilingMargin = riverCeilingMarginM();
  for (let c = 0; c < n; c += 1) {
    const s = cellS[c];
    const key = courseKeyAt(s);
    const lvl = designLevelAt(s);
    const inBand = !airborneHeadwater(s) && Math.abs(cellN[c]) < key.halfW + 6;
    // THE WET CEILING: 0.8 m over the design level, inside a band 6 m past
    // the banks. The design level is calibrated to the steady level (within
    // 0.15 m on the 430 s run), so no water is ever cut off, and a cell the
    // ceiling rules out costs the step nothing.
    // 0.8 m at the default shape; higher for a shape the panel changed,
    // whose design level is only an estimate (riverCeilingMarginM).
    ceiling[c] = inBand ? lvl + ceilingMargin : -Infinity;
    if (inBand && Math.abs(cellN[c]) < key.halfW + 4) {
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
  waterfallLanding?: WaterfallLandingState;
}

/** The accepted source and receiving water used by injection, foam and drawing.
 * This is a tangent ballistic approximation, not a vertical fluid solver. */
export interface WaterfallLandingState extends WaterfallImpactSource {
  /** Opening depth at launch, distinct from the receiving pool depth. */
  depth: number;
  speed: number;
  top: number;
  flightS: number;
  poolLevel: number;
  forward: number;
  crestX: number;
  crestZ: number;
}

/** A deliberately small unresolved impact closure. These coefficients are
 * empirical safeguards, not measurements calibrated from the Yosemite film.
 * Most downward energy still dissipates; this is not a 3D plunge-jet solver. */
export const WATERFALL_IMPACT = {
  radialEnergyShare: 0.02,
  maxRadialSpeedMS: 3,
  wetDepthM: 0.02,
  /** Dissipation per receiving water mass giving one aeration response, W/kg.
   * This sets a bounded source response; it does not multiply optical opacity. */
  aerationPowerWKg: 20,
} as const;

export interface WaterfallImpactEnergy {
  receivingDepth: number;
  fallSpecificEnergy: number;
  radialSpecificEnergy: number;
  dissipatedSpecificEnergy: number;
  /** The same accepted mass stencil; foam has no independent emitter. */
  cells: ReadonlyArray<{ c: number; share: number }>;
}

/** Redirect a little accepted fall energy into the pool, without accepting or
 * rejecting water here. Dry receiving cells retain their mass and tangent
 * momentum; the extra impact closure starts only after they become wet. */
export function coupleWaterfallImpact(
  grid: RiverSolverGrid, cells: readonly InflowCell[], depths: ArrayLike<number>,
  landing: { x: number; z: number; tx: number; tz: number; speed: number; depth: number; top: number; poolLevel: number; discharge: number },
): { inflow: InflowCell[]; energy: WaterfallImpactEnergy } {
  const P = WATERFALL_IMPACT;
  const fallSpecificEnergy = landing.discharge > 0 ? G * Math.max(0, landing.top - landing.poolLevel) : 0;
  const wet = cells.filter(p => landing.discharge > 0 && depths[p.c] > P.wetDepthM && Number.isFinite(depths[p.c]));
  const wetShare = wet.reduce((sum, p) => sum + p.share, 0);
  const receivingDepth = wetShare > 0 ? wet.reduce((sum, p) => sum + p.share * depths[p.c], 0) / wetShare : 0;
  const raw = wet.map(p => {
    const x = grid.x0 + (p.c % grid.nx + 0.5) * grid.dx - landing.x;
    const z = grid.z0 + (Math.floor(p.c / grid.nx) + 0.5) * grid.dx - landing.z;
    const length = Math.hypot(x, z);
    return { ...p, x: length > 0 ? x / length : 0, z: length > 0 ? z / length : 0 };
  });
  const meanX = wetShare > 0 ? raw.reduce((sum, p) => sum + p.share * p.x, 0) / wetShare : 0;
  const meanZ = wetShare > 0 ? raw.reduce((sum, p) => sum + p.share * p.z, 0) / wetShare : 0;
  let variance = 0, maxLength = 0;
  for (const p of raw) {
    p.x -= meanX; p.z -= meanZ;
    variance += p.share * (p.x * p.x + p.z * p.z);
    maxLength = Math.max(maxLength, Math.hypot(p.x, p.z));
  }
  // Center before applying one common scale: independent speed clamps would
  // destroy zero net impulse on an asymmetric wet stencil. Deep pools dilute
  // the landing jet. The scale never spends more than 2% of its fall energy.
  const dilution = landing.depth / Math.max(landing.depth + receivingDepth, 0.001);
  const budget = P.radialEnergyShare * fallSpecificEnergy * wetShare * Math.max(0, Math.min(1, dilution));
  const scale = variance > 1e-12 && maxLength > 0
    ? Math.min(Math.sqrt(2 * budget / variance), P.maxRadialSpeedMS / maxLength) : 0;
  const velocities = new Map(raw.map(p => [p.c, [landing.speed * landing.tx + scale * p.x,
    landing.speed * landing.tz + scale * p.z] as const]));
  const radialSpecificEnergy = 0.5 * variance * scale * scale;
  return {
    inflow: cells.map(p => ({ ...p, ...(velocities.has(p.c) ? { velocityMS: velocities.get(p.c)! } : {}) })),
    energy: { receivingDepth, fallSpecificEnergy, radialSpecificEnergy,
      dissipatedSpecificEnergy: Math.max(0, fallSpecificEnergy - radialSpecificEnergy),
      cells: cells.map(p => ({ c: p.c, share: p.share })) },
  };
}

/**
 * THE INFLOW: the first three columns of the channel, each cell's share
 * weighted by its depth to the power 5/3 (Manning conveyance), so the deep
 * middle takes more of the water than the shallow margins, as it would.
 */
export function reachInflow(
  grid: RiverSolverGrid, h0: ArrayLike<number>, cellS: ArrayLike<number>, cellN: ArrayLike<number>,
  course: RiverReach['course'], dischargeM3S: number, bed?: ArrayLike<number>,
): ReachInflow {
  const { nx, nz, dx } = grid;
  const inflowRaw: Array<{ c: number; w: number }> = [];
  // The falling stream supplies the same selected discharge once, inside
  // its landing patch. There is no second source along the mountain face.
  if (riverHeadwatersEnabled()) {
    const crest = course.at(WATERFALL.crestS);
    let poolLevel = designLevelAt(-160);
    let h = waterfallHydraulics({ ...getRiverShape(), dischargeM3S }, poolLevel);
    let impact = waterfallLanding(crest, h);
    // Only the small receiving patch needs a scan. Revisit its measured surface
    // as flight moves the patch; this avoids imposing a design pool on live water.
    const scan = (): Array<{ c: number; w: number }> => {
      const cells: Array<{ c: number; w: number }> = [];
      const radius = h.width * 0.5 + 1.5;
      const i0 = Math.max(0, Math.floor((impact.x - radius - grid.x0) / dx));
      const i1 = Math.min(nx - 1, Math.ceil((impact.x + radius - grid.x0) / dx));
      const j0 = Math.max(0, Math.floor((impact.z - radius - grid.z0) / dx));
      const j1 = Math.min(nz - 1, Math.ceil((impact.z + radius - grid.z0) / dx));
      for (let j = j0; j <= j1; j += 1) for (let i = i0; i <= i1; i += 1) {
      const c = j * nx + i;
      const x = grid.x0 + (c % nx + 0.5) * dx;
      const z = grid.z0 + (Math.floor(c / nx) + 0.5) * dx;
      const forward = (x - impact.x) * crest.tx + (z - impact.z) * crest.tz;
      const lateral = (x - impact.x) * crest.tz - (z - impact.z) * crest.tx;
      if (Math.abs(forward) < 1.5 && Math.abs(lateral) < h.width * 0.5
        && !airborneHeadwater(cellS[c]) && h0[c] >= 0 && Number.isFinite(h0[c])
        && (!bed || Number.isFinite(bed[c]))) cells.push({ c, w: (1 - Math.abs(forward) / 1.5) * Math.max(WATERFALL_IMPACT.wetDepthM, h0[c]) ** (5 / 3) });
      }
      return cells;
    };
    // A bounded local iteration follows the average surface, rather than
    // claiming to intersect every turbulent crest along the falling sheet.
    if (bed) for (let iteration = 0; iteration < 8; iteration += 1) {
      const cells = scan();
      const weight = cells.reduce((sum, p) => sum + p.w, 0);
      if (weight <= 0) break;
      const measured = cells.reduce((sum, p) => sum + (bed[p.c] + h0[p.c]) * p.w, 0) / weight;
      if (!Number.isFinite(measured)) break;
      const change = Math.abs(poolLevel - measured);
      poolLevel = measured;
      h = waterfallHydraulics({ ...getRiverShape(), dischargeM3S }, poolLevel);
      impact = waterfallLanding(crest, h);
      if (change < 0.001) break;
    }
    inflowRaw.push(...scan());
    const sum = inflowRaw.reduce((a, b) => a + b.w, 0);
    const accepted = sum > 0 && poolLevel < h.top ? dischargeM3S : 0;
    if (sum <= 0 && !bed) throw new Error('[river] The waterfall landing has no wet inflow cells.');
    // A receiving surface above the launch still blocks the source. A dry
    // receiving pool must accept the existing falling mass so it can refill;
    // the old wet-only stencil paused precisely when that water was needed.
    if (accepted === 0) {
      h = waterfallHydraulics({ ...getRiverShape(), dischargeM3S: 0 }, poolLevel);
      impact = waterfallLanding(crest, h);
    }
    const landing: WaterfallLandingState = { ...impact, ...h, poolLevel,
      crestX: crest.x, crestZ: crest.z, tx: crest.tx, tz: crest.tz, discharge: accepted };
    const coupling = coupleWaterfallImpact(grid,
      accepted > 0 ? inflowRaw.map(r => ({ c: r.c, share: r.w / sum })) : [], h0, landing);
    landing.impactEnergy = coupling.energy;
    // Mass and tangent momentum enter once. The centered radial increment
    // borrows only its declared share of vertical energy at eligible wet cells.
    return { inflow: coupling.inflow,
      dir: [crest.tx, crest.tz], speed: h.speed, waterfallLanding: landing };
  }
  for (let j = 0; j < nz; j += 1) {
    if (riverHeadwatersEnabled()) break;
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
   * Turbulence is -1 only where the extended level is unavailable; bank
   * shaders use that explicit validity instead of rejecting deep elevations.
   * The distance took the vorticity's place (round 7): the banks' wet band
   * must know how near real water is. The turbulence took the Froude
   * number's place (rivers round 2): the shader computes the Froude number
   * from the speed and the depth it already reads.
   */
  readonly t1: Float32Array;
  /**
   * Rivers round 3: the water's shape around the rocks: surface height (m,
   * pillows and boils up, troughs down) and the V-wakes' ridge lines (0..1).
   * Added main-corridor channels: local standing-wave forcing (0..1), then
   * friction micro-ripple RMS slope. Both require explicit headwater input;
   * the renderer's ownership mask keeps original/source optics unchanged.
   */
  readonly t2: Float32Array;
  /**
   * Drawn surface height per cell, m, or NaN where no water surface is drawn.
   * Wet cells retain their physical free-surface level, including thin films.
   * Only the dry extension is tucked under the bank to hide it from view.
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

/** Main-channel subgrid surface energy, separate from native carried foam.
 * Friction contributes small ripples; large stationary disturbances require
 * a rock, a falling surface, or a compressive transition. Uniform speed alone
 * does not create a standing wave. This is a calibrated closure, not resolved
 * three-dimensional turbulence: 0.01% of friction loss over 0.25 s feeds the
 * fine ripple band, bounded to its measured 0.10 RMS slope. */
export const MAIN_SURFACE_ENERGY = { frictionShare: 0.0001, residenceS: 0.25, microHeightPerSlope: 0.016, microSlopeMax: 0.10 } as const;
export function mainRiverSurfaceEnergy(input: {
  speed: number; depth: number; dissipation: number; froude: number;
  downSlope: number; upSlope: number; compression: number;
  contact: number; wake: number; rockCover: number; unsteadySpeed: number;
}): { forcing: number; microSlope: number; breakingCover: number } {
  const drop = smoothstep(0.07, 0.25, input.downSlope) * smoothstep(0.6, 1.2, input.froude);
  const jump = smoothstep(0.03, 0.18, input.upSlope) * smoothstep(0.2, 1.2, input.compression)
    * smoothstep(0.6, 1.1, input.froude);
  const unsteady = smoothstep(0.12, 0.5, input.unsteadySpeed);
  const forcing = Math.min(1, Math.max(input.contact, input.wake, input.rockCover, drop, jump, unsteady));
  // Potential wave energy per unit water mass is g*etaRms^2/(2*depth).
  // The fine noise's measured height/slope ratio converts that energy into
  // an RMS optical slope; excess friction energy stays dissipated as heat.
  const etaRms = Math.sqrt(2 * Math.max(0, input.depth) * Math.max(0, input.dissipation)
    * MAIN_SURFACE_ENERGY.frictionShare * MAIN_SURFACE_ENERGY.residenceS / G);
  // Air entrainment is separate from wave roughness. A lateral tilt, a smooth
  // supercritical glide or bed friction alone does not make a white sheet.
  // Contact and the same rock's pillow are alternative observations of one
  // breaking zone, so do not add them twice. Native weights/decay are retained.
  const breakingCover = Math.min(1, Math.max(RIVER_FOAM.wImpinge * input.contact, input.rockCover,
    RIVER_FOAM.wSteep * drop, RIVER_FOAM.wSteep * jump, RIVER_FOAM.wRms * unsteady));
  return { forcing, breakingCover, microSlope: Math.min(MAIN_SURFACE_ENERGY.microSlopeMax, etaRms / MAIN_SURFACE_ENERGY.microHeightPerSlope) };
}

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
const TUCK_M = 0.03;

/**
 * BUILD THE FLOW MAP from a steady field.
 *
 * Steps: the wet set; a depth-weighted 5 x 5 smoothing of the velocity (the
 * textures ride it, and a raw cell-to-cell jump behind a rock would tear
 * them); the velocity carried 4 cells past the wet edge, so the texture filter
 * never pulls in a zero; the Froude number; the white-water source and its
 * steady advection with decay; the streak foam, conservative, so it collects
 * where the surface converges; the vorticity; the drawn wet surface and a
 * 2-cell dry extension under the banks, and the level carried 8 cells
 * (4 m) past the edge for the banks' wet band.
 */
export function buildFlowMap(
  field: FlowMapInput,
  ground?: Float64Array | Float32Array,
  manning?: Float32Array,
  boulders?: ReadonlyArray<{ x: number; z: number; y: number; rx: number; ry: number; rz: number; s?: number; seed?: number; rot?: number }>,
): RiverFlowMap {
  return flowMapCore(field, ground, manning, boulders, { kind: 'steady' }).map;
}

/** What the flow map reads of a flow field: the steady field, or the live run's window mean. */
export interface WaterfallImpactSource { x: number; z: number; tx: number; tz: number; width: number; discharge: number; impactEnergy?: WaterfallImpactEnergy }

export interface FlowMapInput {
  /** Explicit worker-frame input: no ambient shape/headwater state in mapper. */
  readonly waterfallImpact?: WaterfallImpactSource | null;
  /** Solver-owned branch addresses, copied into the mapper. Missing metadata
   * keeps legacy white-water generation, including older worker callers. */
  readonly cellS?: Float32Array;
  readonly grid: RiverSolverGrid;
  readonly h: Float32Array;
  readonly u: Float32Array;
  readonly v: Float32Array;
  readonly uRms: Float32Array;
  readonly bed: Float32Array | Float64Array;
  /** Optional: every cell with h != 0, ascending (the live frame's list). The
   * wet scan then reads only these; every other h is zero. */
  readonly cells?: Int32Array;
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

/**
 * REUSED WORK ARRAYS for repeated maps of one grid (the live river,
 * 2026-10-21). A map of the seven-falls grid made about 600 MB of new
 * whole-grid work arrays; their page faults, zero fills and garbage
 * collection cost more than the map's arithmetic. An array taken from here
 * starts filled with the same value a new array had, so every map value is
 * the same. Never pass one pool to two maps that run at the same time.
 */
export class FlowMapScratch {
  private readonly arrays = new Map<string, Float32Array | Float64Array | Int32Array | Uint8Array>();
  private take<T extends Float32Array | Float64Array | Int32Array | Uint8Array>(name: string, make: () => T, fill: number): T {
    let a = this.arrays.get(name) as T | undefined;
    const fresh = !a;
    if (!a) { a = make(); this.arrays.set(name, a); }
    if (!fresh || fill !== 0) a.fill(fill);
    return a;
  }
  f32(name: string, n: number, fill = 0): Float32Array { const a = this.take(name, () => new Float32Array(n), fill); if (a.length !== n) throw Error('Flow map scratch size changed'); return a; }
  /**
   * KEPT ARRAYS (2026-10-22, GG-430): made once with `initial`, never filled
   * again. The map resets only the cells the previous map wrote (`prev`), so
   * each array starts every map with the same values a new one would have.
   */
  keep(name: string, n: number, initial = 0): Float32Array {
    let a = this.arrays.get(name) as Float32Array | undefined;
    if (!a) { a = new Float32Array(n); if (initial !== 0) a.fill(initial); this.arrays.set(name, a); }
    if (a.length !== n) throw Error('Flow map scratch size changed');
    return a;
  }
  keepU8(name: string, n: number): Uint8Array {
    let a = this.arrays.get(name) as Uint8Array | undefined;
    if (!a) { a = new Uint8Array(n); this.arrays.set(name, a); }
    if (a.length !== n) throw Error('Flow map scratch size changed');
    return a;
  }
  keepI32(name: string, n: number): Int32Array {
    let a = this.arrays.get(name) as Int32Array | undefined;
    if (!a) { a = new Int32Array(n); this.arrays.set(name, a); }
    if (a.length !== n) throw Error('Flow map scratch size changed');
    return a;
  }
  keepF64(name: string, n: number): Float64Array {
    let a = this.arrays.get(name) as Float64Array | undefined;
    if (!a) { a = new Float64Array(n); this.arrays.set(name, a); }
    if (a.length !== n) throw Error('Flow map scratch size changed');
    return a;
  }
  keepU16(name: string, n: number): Uint16Array {
    let a = this.arrays.get(name) as unknown as Uint16Array | undefined;
    if (!a) { a = new Uint16Array(n); this.arrays.set(name, a as unknown as Uint8Array); }
    if (a.length !== n) throw Error('Flow map scratch size changed');
    return a;
  }
  /** The cells the previous map wrote: wet cells, velocity rings, distance
   * rings, and every cell whose outputs it wrote (`region`, ascending). */
  prev: { active: Int32Array; rings: Int32Array; dist: Int32Array; region: Int32Array } | null = null;
  /** Whether the previous map had any wet cell (it decides every far cell's values). */
  lastAnyWet: boolean | null = null;
  /** The foam arrays may hold values outside the wet cells (a cached start) until one full reset. */
  foamClean = false;
  f64(name: string, n: number): Float64Array { const a = this.take(name, () => new Float64Array(n), 0); if (a.length !== n) throw Error('Flow map scratch size changed'); return a; }
  i32(name: string, n: number): Int32Array { const a = this.take(name, () => new Int32Array(n), 0); if (a.length !== n) throw Error('Flow map scratch size changed'); return a; }
  u8(name: string, n: number): Uint8Array { const a = this.take(name, () => new Uint8Array(n), 0); if (a.length !== n) throw Error('Flow map scratch size changed'); return a; }
}

/** One pseudo-time step of advectRelax (2026-10-27: moved out of flowMapCore unchanged; see smoothVelocity). */
function advectRelaxStep(active: Int32Array, wet: Uint8Array, us: Float32Array, vs: Float32Array, Q: Float32Array, Qn: Float32Array,
  cover: Float32Array, rate: Float32Array, life: number, dq: number, inv: number, grid: RiverSolverGrid): void {
  const { nx } = grid;
  const n = nx * grid.nz;
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
    const invX=grid.xEdges?1/(ux>0?(i>0?riverCellX(grid,i)-riverCellX(grid,i-1):riverCellWidth(grid,i)):(i<nx-1?riverCellX(grid,i+1)-riverCellX(grid,i):riverCellWidth(grid,i))):inv;
    const gx = ux > 0 ? (q0 - ql) * invX : (qr - q0) * invX;
    const gz = vz > 0 ? (q0 - qd) * inv : (qu - q0) * inv;
    const relax = rate[c] * Math.max(0, cover[c] - q0);
    Qn[c] = Math.max(0, q0 + dq * (relax - ux * gx - vz * gz - q0 / life));
  }
  for (const c of active) Q[c] = Math.min(1, Qn[c]);
}

/** One step of the streak transport (2026-10-27: moved out of flowMapCore unchanged; see smoothVelocity). */
function streakStep(active: Int32Array, fx: Float32Array, fz: Float32Array, L: Float32Array, Ln: Float32Array, W: Float32Array,
  dL: number, inv: number, grid: RiverSolverGrid): void {
  const { nx } = grid;
  const n = nx * grid.nz;
  const P = RIVER_FOAM;
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
    const div = grid.xEdges?(inW-outE)/riverCellWidth(grid,i)+(inN-outS)*inv:(inW - outE + inN - outS) * inv;
    const src = (P.streakShare * W[c]) / P.whiteLifeS;
    Ln[c] = Math.max(0, l0 + dL * (div + src - l0 / P.streakLifeS));
  }
  for (const c of active) L[c] = Ln[c];
}

/** The sparse map's pack of the dirty cells (2026-10-27: moved out of flowMapCore unchanged; see smoothVelocity). */
function packCells(dirty: Int32Array,
  src: { bump: Float32Array; lines: Float32Array; mainForcing: Float32Array; mainMicroSlope: Float32Array; us: Float32Array; vs: Float32Array; wet: Uint8Array;
    h: ArrayLike<number>; level: Float32Array; W: Float32Array; L: Float32Array; wetDist: Float32Array; T: Float32Array },
  out: { t0: Float32Array; t1: Float32Array; t2: Float32Array; t0h: Uint16Array; t1h: Uint16Array; t2h: Uint16Array },
  farLevel: number, farT: number): void {
  const { bump, lines, mainForcing, mainMicroSlope, us, vs, wet, h, level, W, L, wetDist, T } = src;
  const { t0, t1, t2, t0h, t1h, t2h } = out;
  for (let k = 0; k < dirty.length; k += 1) {
    const c = dirty[k], p = c * 4;
    t2[p] = bump[c];
    t2[p + 1] = Math.min(1, lines[c]);
    t2[p + 2] = mainForcing[c];
    t2[p + 3] = mainMicroSlope[c];
    t0[p] = us[c];
    t0[p + 1] = vs[c];
    t0[p + 2] = wet[c] ? h[c] : 0;
    t0[p + 3] = Number.isNaN(level[c]) ? farLevel : level[c];
    t1[p] = W[c];
    t1[p + 1] = Math.min(1, L[c]);
    t1[p + 2] = wetDist[c];
    t1[p + 3] = Number.isNaN(level[c]) ? farT : wet[c] ? T[c] : 0;
    for (let q = 0; q < 4; q += 1) { t0h[p + q] = toHalfBits(t0[p + q]); t1h[p + q] = toHalfBits(t1[p + q]); t2h[p + q] = toHalfBits(t2[p + q]); }
  }
}

/**
 * The depth-weighted Gaussian velocity over each wet cell's 5 x 5 window
 * (2026-10-27: moved out of flowMapCore unchanged, for the same V8 reason as
 * coarseJacobi; on the warm seven-falls start it ran 280 to 470 ms inside).
 */
function smoothVelocity(active: Int32Array, wet: Uint8Array, h: ArrayLike<number>, u: ArrayLike<number>, v: ArrayLike<number>,
  us: Float32Array, vs: Float32Array, gauss: Float64Array, grid: RiverSolverGrid): void {
  const { nx, nz, dx } = grid;
  for (let q = 0; q < active.length; q += 1) {
    const c = active[q];
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
        const spatial=grid.xEdges?Math.exp(-(((riverCellX(grid,ii)-riverCellX(grid,i))/dx)**2+dj*dj)/2):gauss[(dj + 2) * 5 + di + 2];
        const w = spatial * Math.min(1, h[k] / 0.3);
        su += w * u[k];
        sv += w * v[k];
        sw += w;
      }
    }
    if (sw > 0) { us[c] = su / sw; vs[c] = sv / sw; }
  }
}

/**
 * The marked cells, ascending, with their marks cleared: the same list as
 * `Int32Array.from(new Set(cells)).sort()` over the given lists, by a scan of
 * the mark array between their least and greatest cell (2026-10-27: two
 * sorts of about 400,000 cells cost most of the pack stage on the warm start).
 */
function collectMarked(mark: Uint8Array, ...lists: ArrayLike<number>[]): Int32Array {
  let lo = Infinity, hi = -1, total = 0;
  for (const list of lists) {
    total += list.length;
    for (let k = 0; k < list.length; k += 1) { const c = list[k]; if (c < lo) lo = c; if (c > hi) hi = c; }
  }
  const out = new Int32Array(total);
  let m = 0;
  for (let c = lo; c <= hi; c += 1) if (mark[c]) { mark[c] = 0; out[m++] = c; }
  return out.subarray(0, m);
}

/**
 * `rings` rings of the 4-neighbor mean past the known (non-NaN) cells of
 * `arr`, from `start`; returns the cells it added. With `underBedOnly` a cell
 * takes the value only under its bed, tucked TUCK_M below it. (2026-10-27:
 * moved out of flowMapCore with neighborsOf inlined, same candidates in the
 * same order; see smoothVelocity.) Each ring reads all its candidates'
 * neighbors before it writes, so the result does not depend on the order.
 */
function extendRings(arr: Float32Array, rings: number, underBedOnly: boolean, start: ArrayLike<number>, bed: ArrayLike<number>,
  ringMark: Uint8Array, addC: Int32Array, addA: Float64Array, nx: number, nz: number): number[] {
  const n = nx * nz;
  let front: ArrayLike<number> = start;
  const added: number[] = [];
  const out: number[] = [];
  for (let ring = 0; ring < rings; ring += 1) {
    out.length = 0;
    for (let k = 0; k < front.length; k += 1) {
      const c = front[k], i = c % nx;
      if (i > 0 && !ringMark[c - 1] && Number.isNaN(arr[c - 1])) { ringMark[c - 1] = 1; out.push(c - 1); }
      if (i < nx - 1 && !ringMark[c + 1] && Number.isNaN(arr[c + 1])) { ringMark[c + 1] = 1; out.push(c + 1); }
      if (c >= nx && !ringMark[c - nx] && Number.isNaN(arr[c - nx])) { ringMark[c - nx] = 1; out.push(c - nx); }
      if (c + nx < n && !ringMark[c + nx] && Number.isNaN(arr[c + nx])) { ringMark[c + nx] = 1; out.push(c + nx); }
    }
    for (let k = 0; k < out.length; k += 1) ringMark[out[k]] = 0;
    let na = 0;
    for (let q0 = 0; q0 < out.length; q0 += 1) {
      const c = out[q0];
      const i = c % nx, j = (c - i) / nx;
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
    for (let q = 0; q < na; q += 1) { arr[addC[q]] = addA[q]; added.push(addC[q]); }
    front = addC.slice(0, na);
  }
  return added;
}

/** The distinct values of `list`, ascending (the same set and order as `Int32Array.from(new Set(list)).sort()`). */
function sortedUnique(list: number[]): Int32Array {
  const all = Int32Array.from(list).sort();
  let m = 0;
  for (let k = 0; k < all.length; k += 1) if (k === 0 || all[k] !== all[k - 1]) all[m++] = all[k];
  return all.subarray(0, m);
}

/**
 * The coarse level grid before the Jacobi sweeps: each bin holds the mean of
 * its known levels and is fixed; every other bin holds the mean of the fixed
 * bins. `known` (ascending) lists the only cells that can hold a level; null
 * scans the whole grid. Visited ascending, each bin adds the same values in
 * the same order as the whole-grid scan. A separate function for the same
 * V8 reason as coarseJacobi (2026-10-22).
 */
function coarseBins(level: Float32Array, known: Int32Array | null, n: number, nx: number, cx: number, cz: number, q: number): { coarse: Float32Array; fixed: Uint8Array } {
  const coarse = new Float32Array(cx * cz);
  const fixed = new Uint8Array(cx * cz);
  const cnt = new Float32Array(cx * cz);
  for (let k0 = 0, end = known ? known.length : n; k0 < end; k0 += 1) {
    const cell = known ? known[k0] : k0;
    const v = level[cell];
    if (Number.isNaN(v)) continue;
    const i = cell % nx, j = (cell - i) / nx;
    const k = Math.floor(j / q) * cx + Math.floor(i / q);
    coarse[k] += v;
    cnt[k] += 1;
  }
  let mean = 0;
  let mk = 0;
  for (let k = 0; k < coarse.length; k += 1) {
    if (cnt[k] > 0) { coarse[k] /= cnt[k]; fixed[k] = 1; mean += coarse[k]; mk += 1; }
  }
  mean = mk ? mean / mk : 0;
  for (let k = 0; k < coarse.length; k += 1) if (!fixed[k]) coarse[k] = mean;
  return { coarse, fixed };
}

/**
 * 60 Jacobi sweeps over the coarse level grid; the result ends in `coarse`.
 * 2026-10-22: the same sums in the same order as the old whole-grid loop,
 * with two buffers swapped instead of a copy after each sweep and the free
 * interior cells in row runs with no edge tests. It is a separate function
 * because V8 optimized the loop badly inside the large flowMapCore (about
 * 200 ms there against 50 ms here). A fixed cell keeps its value in both
 * buffers; 60 is even, so the last sweep writes `coarse`.
 */
function coarseJacobi(coarse: Float32Array, fixed: Uint8Array, cx: number, cz: number): void {
  const tmp = coarse.slice();
  const runList: number[] = [], freeEdge: number[] = [];
  for (let j = 0; j < cz; j += 1) {
    let runStart = -1;
    for (let i = 0; i < cx; i += 1) {
      const k = j * cx + i;
      const inner = !fixed[k] && i > 0 && i < cx - 1 && j > 0 && j < cz - 1;
      if (inner) { if (runStart < 0) runStart = k; continue; }
      if (runStart >= 0) { runList.push(runStart, k); runStart = -1; }
      if (!fixed[k]) freeEdge.push(k);
    }
    if (runStart >= 0) runList.push(runStart, j * cx + cx);
  }
  const runs = Int32Array.from(runList), edge = Int32Array.from(freeEdge);
  let from: Float32Array = coarse, to: Float32Array = tmp;
  for (let it = 0; it < 60; it += 1) {
    for (let r = 0; r < runs.length; r += 2) {
      for (let k = runs[r], end = runs[r + 1]; k < end; k += 1) {
        to[k] = (from[k - 1] + from[k + 1] + from[k - cx] + from[k + cx]) / 4;
      }
    }
    for (let q2 = 0; q2 < edge.length; q2 += 1) {
      const k = edge[q2], i = k % cx, j = (k - i) / cx;
      let s = 0;
      let w = 0;
      if (i > 0) { s += from[k - 1]; w += 1; }
      if (i < cx - 1) { s += from[k + 1]; w += 1; }
      if (j > 0) { s += from[k - cx]; w += 1; }
      if (j < cz - 1) { s += from[k + cx]; w += 1; }
      to[k] = s / w;
    }
    const swap = from; from = to; to = swap;
  }
}

/** What a scratch-pool map wrote: the cells whose outputs changed (ascending;
 * all cells when `full`), the half-float textures and the coarse level. */
export interface RiverFlowMapSparse {
  readonly full: boolean;
  readonly dirty: Int32Array;
  readonly t0h: Uint16Array;
  readonly t1h: Uint16Array;
  readonly t2h: Uint16Array;
  readonly coarse: RiverCoarseLevel | null;
  /** Cells with a drawn surface, ascending (for the sheet). */
  readonly surfaceCells: Int32Array;
}

/** The flow map and its carried fields (see FlowMapFoam). With `scratch`,
 * the work arrays and the t1/t2 textures come from it: the caller must copy
 * t1 and t2 before the next map. t0 and the surface are always new arrays. */
export function flowMapCore(
  field: FlowMapInput,
  ground: Float64Array | Float32Array | undefined,
  manning: Float32Array | undefined,
  boulders: ReadonlyArray<{ x: number; z: number; y: number; rx: number; ry: number; rz: number; s?: number; seed?: number; rot?: number }> | undefined,
  foam: FlowMapFoam,
  timings?: Record<string, number>,
  scratch?: FlowMapScratch,
): { map: RiverFlowMap; W: Float32Array; T: Float32Array; L: Float32Array; sparse?: RiverFlowMapSparse } {
  // Stage times, ms, when asked (the live river shows them; they change no value).
  let tMark = timings ? performance.now() : 0;
  const mark = (stage: string): void => {
    if (!timings) return;
    const now = performance.now();
    timings[stage] = (timings[stage] ?? 0) + (now - tMark);
    tMark = now;
  };
  const { grid, h, u, v, uRms, bed } = field;
  // This terrain candidate has no authored boulder or main-river impact map.
  // Those adapters still assume uniform world coordinates; refuse accidental
  // reuse until their geometry and energy attribution have matching proof.
  if(grid.xEdges&&((boulders?.length??0)>0||field.waterfallImpact))throw Error('Rectangular terrain optics do not yet support authored rock/impact maps');
  // Roughness for the dissipation source: the reach's own, or a cobble bed.
  const manningOf = (c: number): number => (manning ? manning[c] : 0.04);
  const { nx, nz, dx } = grid;
  const n = nx * nz;
  const f32 = (name: string, fill = 0): Float32Array => scratch ? scratch.f32(name, n, fill) : fill === 0 ? new Float32Array(n) : new Float32Array(n).fill(fill);
  /** A kept array (live) or a new one: either starts this map with `initial` in every cell. */
  const kept = (name: string, initial = 0): Float32Array => scratch ? scratch.keep(name, n, initial) : initial === 0 ? new Float32Array(n) : new Float32Array(n).fill(initial);
  const prev = scratch?.prev ?? null;
  const wet = scratch ? scratch.keepU8('wet', n) : new Uint8Array(n);
  if (prev) for (let q = 0; q < prev.active.length; q += 1) wet[prev.active[q]] = 0;
  let wetCells = 0;
  if (field.cells) {
    for (let q = 0; q < field.cells.length; q += 1) { const c = field.cells[q]; if (h[c] > WET_M) { wet[c] = 1; wetCells += 1; } }
  } else {
    for (let c = 0; c < n; c += 1) {
      if (h[c] > WET_M) { wet[c] = 1; wetCells += 1; }
    }
  }
  const active = new Int32Array(wetCells);
  // The wet cells, ascending. (2026-10-22: the wet box and its row spans
  // gave way to rings grown from the last ring, below.)
  {
    let q = 0;
    const order = field.cells;
    for (let k = 0, end = order ? order.length : n; k < end; k += 1) {
      const c = order ? order[k] : k;
      if (!wet[c]) continue;
      active[q] = c;
      q += 1;
    }
  }
  // Ring updates, as typed arrays (a tuple per cell was most of their cost).
  // Each holds values only for the indices a ring just wrote: no reset.
  const addC = scratch ? scratch.keepI32('addC', n) : new Int32Array(n);
  const addA = scratch ? scratch.keepF64('addA', n) : new Float64Array(n);
  const addB = scratch ? scratch.keepF64('addB', n) : new Float64Array(n);
  /** Reset the previous map's cells of a kept array to its start value. */
  const reset = (a: Float32Array | Uint8Array, cells: Int32Array | undefined, value = 0): void => {
    if (cells) for (let q = 0; q < cells.length; q += 1) a[cells[q]] = value;
  };
  /**
   * RINGS FROM THE LAST RING (2026-10-22, GG-430): a cell can change in ring
   * r only if a 4-neighbor changed in ring r - 1 (ring 0: a neighbor in the
   * start set). The candidates are those cells, once each; every ring still
   * reads all four neighbors and applies its changes after it has read them
   * all, so the result equals a scan of the whole grid in any order.
   */
  const ringMark = scratch ? scratch.keepU8('ringMark', n) : new Uint8Array(n);
  const neighborsOf = (front: ArrayLike<number>, open: (c: number) => boolean): number[] => {
    const out: number[] = [];
    for (let k = 0; k < front.length; k += 1) {
      const c = front[k], i = c % nx;
      if (i > 0 && !ringMark[c - 1] && open(c - 1)) { ringMark[c - 1] = 1; out.push(c - 1); }
      if (i < nx - 1 && !ringMark[c + 1] && open(c + 1)) { ringMark[c + 1] = 1; out.push(c + 1); }
      if (c >= nx && !ringMark[c - nx] && open(c - nx)) { ringMark[c - nx] = 1; out.push(c - nx); }
      if (c + nx < n && !ringMark[c + nx] && open(c + nx)) { ringMark[c + nx] = 1; out.push(c + nx); }
    }
    for (const c of out) ringMark[c] = 0;
    return out;
  };

  // ---- smoothed velocity -------------------------------------------------
  const us = kept('us');
  const vs = kept('vs');
  if (prev) { reset(us, prev.active); reset(vs, prev.active); reset(us, prev.rings); reset(vs, prev.rings); }
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
  smoothVelocity(active, wet, h, u, v, us, vs, gauss, grid);
  // Carry the velocity past the wet edge (4 rings).
  const known = scratch ? scratch.keepU8('known', n) : new Uint8Array(n);
  if (prev) { reset(known, prev.active); reset(known, prev.rings); }
  for (let q = 0; q < active.length; q += 1) known[active[q]] = 1;
  const velocityRings: number[] = [];
    let front: ArrayLike<number> = active;
    for (let ring = 0; ring < 4; ring += 1) {
      let na = 0;
      for (const c of neighborsOf(front, q => !known[q])) {
          const i = c % nx, j = (c - i) / nx;
          let su = 0;
          let sv = 0;
          let k = 0;
          if (i > 0 && known[c - 1]) { su += us[c - 1]; sv += vs[c - 1]; k += 1; }
          if (i < nx - 1 && known[c + 1]) { su += us[c + 1]; sv += vs[c + 1]; k += 1; }
          if (j > 0 && known[c - nx]) { su += us[c - nx]; sv += vs[c - nx]; k += 1; }
          if (j < nz - 1 && known[c + nx]) { su += us[c + nx]; sv += vs[c + nx]; k += 1; }
          if (k > 0) { addC[na] = c; addA[na] = su / k; addB[na] = sv / k; na += 1; }
      }
      for (let q = 0; q < na; q += 1) { const c = addC[q]; us[c] = addA[q]; vs[c] = addB[q]; known[c] = 1; velocityRings.push(c); }
      front = addC.slice(0, na);
    }

  mark('velocity');
  // ---- vorticity (the shear source reads it) ------------------------------------
  const vort = kept('vort');
  if (prev) reset(vort, prev.active);
  for (const c of active) {
    const i = c % nx;
    if (i === 0 || i === nx - 1 || c - nx < 0 || c + nx >= n) continue;
    vort[c] = (vs[c + 1] - vs[c - 1]) / (grid.xEdges?riverCellX(grid,i+1)-riverCellX(grid,i-1):2*dx) - (us[c + nx] - us[c - nx]) / (2 * dx);
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
  const bump = kept('bump');
  const lines = kept('lines');
  const rockCover = kept('rockCover');
  // The rock features write wet cells only.
  if (prev) { reset(bump, prev.active); reset(lines, prev.active); reset(rockCover, prev.active); }
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
    // Old mapper payloads and original rocks retain the old feature geometry.
    const shape = b.s !== undefined && b.s >= MAIN_CHANNEL_S && b.seed !== undefined && b.rot !== undefined
      ? mainBoulderShape({ ...b, seed: b.seed, rot: b.rot, inChannel: true }) : undefined;
    let R = shape ? shape.contactAt(-Infinity, 1, 0).radius : Math.max(b.rx, b.rz);
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
    const top = shape ? shape.bounds.maxY : b.y + b.ry;
    const sub = level - top;
    if (sub > 0.35 || U < 0.25) continue;
    rockFeatures += 1;
    const dX = sU / Math.hypot(sU, sV);
    const dZ = sV / Math.hypot(sU, sV);
    const pX = -dZ;
    const pZ = dX;
    // Features begin at the actual waterline, not at an invisible ellipsoid cap.
    const contact = shape?.contactAt(level, dX, dZ);
    if (contact) R = contact.radius;
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
      const pcx = contact ? contact.upstream[0] - dX * 0.25 : b.x - dX * (R + 0.25);
      const pcz = contact ? contact.upstream[1] - dZ * 0.25 : b.z - dZ * (R + 0.25);
      const sa = 0.35 + 0.2 * R;
      const sc = 0.3 + 0.6 * R;
      splat(pcx, pcz, 3 * sc, (x, z, c) => {
        const ax = (x - pcx) * dX + (z - pcz) * dZ;
        const cx2 = (x - pcx) * pX + (z - pcz) * pZ;
        const g = Math.exp(-0.5 * ((ax / sa) ** 2 + (cx2 / sc) ** 2));
        bump[c] += head * g;
        rockCover[c] = Math.max(rockCover[c], white * g);
      });
      const tcx = contact ? contact.downstream[0] + dX * (0.5 + 0.3 * U) : b.x + dX * (R + 0.5 + 0.3 * U);
      const tcz = contact ? contact.downstream[1] + dZ * (0.5 + 0.3 * U) : b.z + dZ * (R + 0.5 + 0.3 * U);
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
      const ox = contact ? (side > 0 ? contact.left[0] : contact.right[0]) : b.x + pX * side * R * 0.9;
      const oz = contact ? (side > 0 ? contact.left[1] : contact.right[1]) : b.z + pZ * side * R * 0.9;
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
  const mainForcing = kept('mainForcing');
  const mainMicroSlope = kept('mainMicroSlope');
  const coverW = kept('coverW');
  const rateW = kept('rateW');
  /** The same for the surface turbulence. */
  const coverT = kept('coverT');
  const rateT = kept('rateT');
  // The sources write wet cells only.
  if (prev) for (const a of [mainForcing, mainMicroSlope, coverW, rateW, coverT, rateT]) reset(a, prev.active);
  const PT = RIVER_TURB;
  const P = RIVER_FOAM;
  // The solver receives mass, tangent momentum, and a bounded radial share
  // once. Remaining vertical energy drives the existing carried W/T fields.
  // W/T are bounded surface-response indicators of the same dissipation,
  // not two additional energy sinks or a resolved bubble-energy calculation.
  const fallImpact = field.waterfallImpact;
  const impactPower = new Map<number, number>();
  if (fallImpact?.impactEnergy && fallImpact.discharge > 0) {
    for (const p of fallImpact.impactEnergy.cells) {
      if (p.c < 0 || p.c >= n || h[p.c] <= WATERFALL_IMPACT.wetDepthM) continue;
      // Available dissipated power divided by the actual receiving water mass.
      // Water density cancels. This uses the same accepted cells and Q as the
      // solver; neither dry ground nor a second Gaussian creates aeration.
      impactPower.set(p.c, fallImpact.discharge * p.share * fallImpact.impactEnergy.dissipatedSpecificEnergy
        / (dx * dx * h[p.c]));
    }
  }
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
    const xSpan=grid.xEdges?riverCellX(grid,Math.min(nx-1,i+1))-riverCellX(grid,Math.max(0,i-1)):2*dx;
    const steep = grid.xEdges?Math.hypot((etaR-etaL)/xSpan,(etaU-etaD)/(2*dx)):Math.hypot(etaR - etaL, etaU - etaD) / (2 * dx);
    const st = smoothstep(P.steepOn, P.steepFull, steep);
    const sh = smoothstep(P.shearOn, P.shearFull, Math.abs(vort[c])) * smoothstep(0.5, 1.5, sp);
    const diss = (G * manningOf(c) * manningOf(c) * sp * sp * sp) / Math.cbrt(Math.max(d, 0.02));
    const ds = smoothstep(P.dissOn, P.dissFull, diss);
    // A thin sheet over a rock face cannot hold much air: fade the source in
    // water under 4 cm so a film on a bank never reads as white water.
    const thin = smoothstep(0.01, 0.04, d);
    const xx = riverCellX(grid,i); const zz = grid.z0 + (j + 0.5) * dx;
    const impactForward = fallImpact ? (xx - fallImpact.x) * fallImpact.tx + (zz - fallImpact.z) * fallImpact.tz : 1000;
    const impactLateral = fallImpact ? (xx - fallImpact.x) * fallImpact.tz - (zz - fallImpact.z) * fallImpact.tx : 1000;
    const impactResponse = (impactPower.get(c) ?? 0) / WATERFALL_IMPACT.aerationPowerWKg;
    // Older frames lack the energy budget; retain their source compatibility.
    // Current landing frames use energetic production and native carried W/T/L.
    const impactCover = fallImpact?.impactEnergy ? 0.95 * (1 - Math.exp(-impactResponse))
      : fallImpact ? Math.min(0.95, fallImpact.discharge / 3) * Math.exp(-0.5 * (impactForward / 2) ** 2 - 0.5 * (impactLateral / Math.max(0.7, fallImpact.width * 0.42)) ** 2) : 0;
    const cover = Math.min(1, impactCover + P.froudeCover * a + P.wImpinge * b + P.wRms * r + P.wSteep * st + P.wShear * sh + P.wDiss * ds + rockCover[c]) * thin;
    // THE SURFACE TURBULENCE's local cover: the same physics at lower
    // thresholds (a surface is broken long before it is white).
    const tDiss = smoothstep(PT.dissOn, PT.dissFull, diss);
    const tShear = smoothstep(PT.shearOn, PT.shearFull, Math.abs(vort[c])) * smoothstep(0.2, 1.0, sp);
    const tRms = smoothstep(PT.rmsOn, PT.rmsFull, uRms[c]);
    const tSteep = smoothstep(PT.steepOn, PT.steepFull, steep);
    const tCover = Math.min(1, impactCover * 1.6 + 0.8 * tDiss + 0.6 * tShear + 0.8 * tRms + 0.7 * tSteep + b + cover);
    let whiteCover = cover;
    // The worker frame explicitly identifies headwaters. These extra channels
    // carry physical surface drivers in the fixed main corridor; the renderer's
    // editable ownership mask is the final authority, excluding original/source
    // fragments. Wave drivers leave hydraulic arrays and native T unchanged; main-owned W generation below uses the shared transport.
    if (fallImpact && xx >= 10 && xx <= 88) {
      const main = projectMainRapids(xx, zz), mainU = main.s - MAIN_CHANNEL_S;
      if (mainU >= 35 && mainU <= 113 && main.d < 8.5) {
        const dirX = sp > 0.03 ? u[c] / sp : 1, dirZ = sp > 0.03 ? v[c] / sp : 0;
        const alongSlope = ((etaR - etaL) * dirX + (etaU - etaD) * dirZ) / (2 * dx);
        const left = i > 0 ? c - 1 : c, right = i < nx - 1 ? c + 1 : c;
        const below = c >= nx ? c - nx : c, above = c + nx < n ? c + nx : c;
        const compression = Math.max(0, -(dirX * ((us[right] - us[left]) * dirX + (us[above] - us[below]) * dirZ)
          + dirZ * ((vs[right] - vs[left]) * dirX + (vs[above] - vs[below]) * dirZ)) / (2 * dx));
        const surfaceEnergy = mainRiverSurfaceEnergy({ speed: sp, depth: d, dissipation: diss, froude: F,
          downSlope: Math.max(0, -alongSlope), upSlope: Math.max(0, alongSlope), compression,
          contact: b, wake: Math.min(1, lines[c]), rockCover: rockCover[c], unsteadySpeed: uRms[c] });
        mainForcing[c] = surfaceEnergy.forcing; mainMicroSlope[c] = surfaceEnergy.microSlope;
        // Change only cells the current solver actually assigns to the added
        // branch, not a guessed original curve. The single native W transport
        // carries the result onward; the original/source source expression and
        // native T/L equations remain intact. Any downstream foam difference
        // is real advection, not an optical clear-water mask.
        if (field.cellS && field.cellS[c] >= MAIN_CHANNEL_S) {
          const edge = smoothstep(35, 41, mainU) * (1 - smoothstep(107, 113, mainU));
          const localized = Math.min(1, impactCover + surfaceEnergy.breakingCover) * thin;
          whiteCover += (localized - cover) * edge;
        }
      }
    }
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
    coverW[c] = whiteCover;
    // Energetic production sets the target cover, while the existing bounded
    // relaxation keeps thin newly wetted cells from shrinking every map step.
    rateW[c] = whiteCover > 0 ? Math.max(1 / P.whiteLifeS, sp / P.genZoneM) : 0;
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
  const dtp = Math.min((0.4 * (grid.xEdges?riverMinimumSpacing(grid):dx)) / maxUV, 0.5 / maxK);
  const inv = 1 / dx;
  // THE LIVE RIVER: the carried fields move on by the flow's time since the
  // last map, in steps no longer than the steady run's (so neither the
  // advection nor the relaxation overshoots); a dry cell keeps none.
  const live = foam.kind === 'step';
  const liveSteps = live ? Math.max(1, Math.ceil(Math.min(RIVER_LIVE_FOAM_MAX_DT_S, foam.dtS) / dtp)) : 0;
  const liveDt = live ? Math.min(RIVER_LIVE_FOAM_MAX_DT_S, foam.dtS) / liveSteps : 0;
  if (live) {
    // After one full pass, foam can be nonzero only where the last map was
    // wet (advection writes wet cells only), so only those cells can need it.
    if (scratch?.foamClean && prev) {
      for (let q = 0; q < prev.active.length; q += 1) {
        const c = prev.active[q];
        if (wet[c]) continue;
        foam.W[c] = 0;
        foam.T[c] = 0;
        foam.L[c] = 0;
      }
    } else {
      for (let c = 0; c < n; c += 1) {
        if (wet[c]) continue;
        foam.W[c] = 0;
        foam.T[c] = 0;
        foam.L[c] = 0;
      }
      if (scratch) scratch.foamClean = true;
    }
  }
  /**
   * The steady solution of dQ/dt + u . grad Q = k max(0, cover - Q) - Q / life
   * (upwind, pseudo-time to five lives); or, live, `steps` steps of `dq`
   * seconds from Q's last values.
   */
  const advectRelax = (cover: Float32Array, rate: Float32Array, life: number, Qlive?: Float32Array): Float32Array => {
    const Q = Qlive ?? new Float32Array(n);
    // Written for each wet cell before it is read: no reset.
    const Qn = scratch ? scratch.keep('Qn', n) : new Float32Array(n);
    const steps = Qlive ? liveSteps : Math.ceil((5 * life) / dtp);
    const dq = Qlive ? liveDt : dtp;
    for (let it = 0; it < steps; it += 1) advectRelaxStep(active, wet, us, vs, Q, Qn, cover, rate, life, dq, inv, grid);
    return Q;
  };
  const W = advectRelax(coverW, rateW, P.whiteLifeS, live ? foam.W : undefined);
  const T = advectRelax(coverT, rateT, RIVER_TURB.lifeS, live ? foam.T : undefined);
  // Streak foam: conservative form, d L / dt + div(U L) = S - L / life.
  const L = live ? foam.L : new Float32Array(n);
  const Ln = scratch ? scratch.keep('Ln', n) : new Float32Array(n);
  const stepsL = live ? liveSteps : Math.ceil((3 * P.streakLifeS) / dtp);
  const dL = live ? liveDt : dtp;
  // Face velocities (x faces at i - 1/2, z faces at j - 1/2), averaged from
  // the smoothed velocity; zero on a face with a dry side.
  const fx = kept('fx');
  const fz = kept('fz');
  if (prev) { reset(fx, prev.active); reset(fz, prev.active); }
  for (const c of active) {
    const i = c % nx;
    if (i > 0 && wet[c - 1]) fx[c] = 0.5 * (us[c] + us[c - 1]);
    if (c - nx >= 0 && wet[c - nx]) fz[c] = 0.5 * (vs[c] + vs[c - nx]);
  }
  for (let it = 0; it < stepsL; it += 1) streakStep(active, fx, fz, L, Ln, W, dL, inv, grid);

  mark('advection');
  // ---- surface -----------------------------------------------------------------
  // With a scratch pool both are kept: only the previous map's region can
  // hold a value, so resetting it gives arrays that are NaN everywhere else.
  const surface = scratch ? scratch.keep('surface', n, NaN) : new Float32Array(n).fill(NaN);
  const level = scratch ? scratch.keep('level', n, NaN) : f32('level', NaN);
  if (prev) { reset(surface, prev.region, NaN); reset(level, prev.region, NaN); }
  for (const c of active) {
    const eta = bed[c] + h[c];
    level[c] = eta;
    // An active cell already contains water. Tucking a thin wet corner below
    // its bed cuts a triangular hole beside deeper neighbors. Keep its actual
    // level here; the separate dry-bank extension below retains its hiding guard.
    surface[c] = eta;
  }
  // Extend the level 8 rings past the wet edge (the wet band reads it) and
  // the drawn surface 2 rings, under the bank, so the sheet meets the bank in
  // a line the depth test cuts cleanly.
  // (`reach`: how far past the wet box the known cells can be by the last
  // ring, so the loop covers every cell the full grid's loop would add.)
  const extend = (arr: Float32Array, rings: number, underBedOnly: boolean, start: ArrayLike<number>): number[] =>
    extendRings(arr, rings, underBedOnly, start, bed, ringMark, addC, addA, nx, nz);
  /** Cells with a known level before the rings: the wet cells and the rock footprints. */
  const levelStart: number[] = Array.from(active);
  // THE BOULDERS: the water runs on over a rock's footprint, at the level
  // around it. The solver's rock is an ellipsoid and the drawn rock carries a
  // bump of up to 11 %, so a rock whose top stands 5 cm out of the water in
  // the solver can stand under it when drawn; a hole in the sheet over such a
  // rock showed the rock dry, as a dark pit (round 1). Where the drawn rock is
  // higher than the water it hides the sheet, and the depth test draws the
  // waterline around it. Needs the ground (the bed without the rocks).
  if (ground) {
    /** A neighbor the footprint fill takes its level from: known, and wet or a rock's footprint. */
    const takes = (q: number): boolean => !Number.isNaN(level[q]) && (wet[q] === 1 || bed[q] >= ground[q] + 0.01);
    let front: ArrayLike<number> = active;
    for (let ring = 0; ring < 12; ring += 1) {
      let na = 0;
      for (const c of neighborsOf(front, q => Number.isNaN(surface[q]) && bed[q] >= ground[q] + 0.01)) {
          const i = c % nx, j = (c - i) / nx;
          let sum = 0;
          let k = 0;
          if (i > 0 && takes(c - 1)) { sum += level[c - 1]; k += 1; }
          if (i < nx - 1 && takes(c + 1)) { sum += level[c + 1]; k += 1; }
          if (j > 0 && takes(c - nx)) { sum += level[c - nx]; k += 1; }
          if (j < nz - 1 && takes(c + nx)) { sum += level[c + nx]; k += 1; }
          if (k > 0) { addC[na] = c; addA[na] = sum / k; na += 1; }
      }
      if (na === 0) break;
      for (let q = 0; q < na; q += 1) { const c = addC[q]; surface[c] = addA[q]; level[c] = addA[q]; levelStart.push(c); }
      front = addC.slice(0, na);
    }
  }
  const surfaceAdded = extend(surface, 2, true, levelStart);
  const levelAdded = extend(level, 8, false, levelStart);
  /** Every cell with a known level or surface (the sparse map's near region). */
  const nearCells = scratch ? [...levelStart, ...surfaceAdded, ...levelAdded] : null;
  // THE LEVEL FIELD past the 8 rings: every other cell of the grid takes a
  // smoothed level from the water around it (Jacobi averaging, 60 sweeps at a
  // quarter resolution), so the bank's height over the water is a smooth
  // field and the grass line has no steps (round 2: the line went in
  // staircase steps where the 8-ring extension ended). With no real water
  // there is no donor level: keep the field unavailable rather than creating
  // a valid zero-elevation waterline throughout an empty landscape.
  let coarseOut: RiverCoarseLevel | null = null;
  const levelCellsSorted = nearCells ? sortedUnique(nearCells) : null;
  if(wetCells>0) {
    const q = 4;
    const cx = Math.ceil(nx / q);
    const cz = Math.ceil(nz / q);
    // Bin the known levels and fill free bins with their mean (see coarseBins).
    const { coarse, fixed } = coarseBins(level, levelCellsSorted, n, nx, cx, cz, q);
    // 60 Jacobi sweeps; the result ends in `coarse` (see coarseJacobi).
    coarseJacobi(coarse, fixed, cx, cz);
    coarseOut = { cx, cz, q, data: coarse };
    // The live map keeps far cells unfilled (RIVER_FAR_LEVEL); readers use the coarse grid.
    if (!scratch) for (let j = 0; j < nz; j += 1) {
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
  const wetDist = grid.xEdges?riverRectWetDistance(grid,wet):kept('wetDist', 8);
  const distCells: number[] = [];
  if(!grid.xEdges){
    if (prev) reset(wetDist, prev.dist, 8);
    let front: number[] = [];
    for (const c of active) { wetDist[c] = 0; front.push(c); distCells.push(c); }
    for (let ring = 1; ring <= 16 && front.length; ring += 1) {
      const next: number[] = [];
      for (const c of front) {
        const i = c % nx;
        const nb = [i > 0 ? c - 1 : -1, i < nx - 1 ? c + 1 : -1, c - nx, c + nx];
        for (const q of nb) {
          if (q < 0 || q >= n || wetDist[q] <= ring * dx) continue;
          wetDist[q] = ring * dx;
          next.push(q);
          distCells.push(q);
        }
      }
      front = next;
    }
  }

  mark('distance');
  // ---- pack -------------------------------------------------------------------
  if (scratch) {
    /**
     * THE SPARSE PACK (2026-10-22, GG-430). Outside this map's region and
     * the previous map's, every output holds its far value: no velocity,
     * depth, foam or rock feature; distance 8; and a level that only the
     * coarse grid gives (RIVER_FAR_LEVEL). Those far values change only when
     * the river gains or loses all of its wet cells; then every cell is written.
     */
    const anyWet = wetCells > 0;
    const full = !prev || scratch.lastAnyWet !== anyWet;
    const regionMark = scratch.keepU8('regionMark', n);
    const regionList: number[] = [];
    const add = (c: number): void => { if (!regionMark[c]) { regionMark[c] = 1; regionList.push(c); } };
    for (const c of active) add(c);
    for (const c of velocityRings) add(c);
    for (const c of distCells) add(c);
    if (nearCells) for (const c of nearCells) add(c);
    // Ascending by a scan of the marks (2026-10-27): the same list as a sort, for a few ms.
    const region = collectMarked(regionMark, regionList);
    let dirty: Int32Array;
    if (full) { dirty = new Int32Array(n); for (let c = 0; c < n; c += 1) dirty[c] = c; }
    else {
      for (let k = 0; k < region.length; k += 1) regionMark[region[k]] = 1;
      const pr = prev!.region;
      for (let k = 0; k < pr.length; k += 1) regionMark[pr[k]] = 1;
      dirty = collectMarked(regionMark, region, pr);
    }
    const t0 = scratch.keep('t0', n * 4), t1 = scratch.keep('t1', n * 4), t2 = scratch.keep('t2', n * 4);
    const t0h = scratch.keepU16('t0h', n * 4), t1h = scratch.keepU16('t1h', n * 4), t2h = scratch.keepU16('t2h', n * 4);
    const farLevel = anyWet ? RIVER_FAR_LEVEL : -100, farT = anyWet ? 0 : -1;
    packCells(dirty, { bump, lines, mainForcing, mainMicroSlope, us, vs, wet, h, level, W, L, wetDist, T }, { t0, t1, t2, t0h, t1h, t2h }, farLevel, farT);
    // Foam lives only on wet cells: the whole-grid maxima equal these.
    let maxWhite = 0, maxStreak = 0;
    for (const c of active) { const w = W[c], l = Math.min(1, L[c]); if (w > maxWhite) maxWhite = w; if (l > maxStreak) maxStreak = l; }
    const surfaceCells = Int32Array.from(region.filter(c => !Number.isNaN(surface[c])));
    scratch.prev = { active, rings: Int32Array.from(velocityRings), dist: Int32Array.from(distCells), region };
    scratch.lastAnyWet = anyWet;
    mark('pack');
    return {
      map: { grid, t0, t1, t2, surface, stats: { wetCells, eddyCells: 0, maxWhite, maxStreak, meanSpeedWet: wetCells ? speedSum / wetCells : 0 } },
      W, T, L,
      sparse: { full, dirty, t0h, t1h, t2h, coarse: coarseOut, surfaceCells },
    };
  }
  const t0 = new Float32Array(n * 4);
  const t1 = new Float32Array(n * 4);
  const t2 = new Float32Array(n * 4);
  for (let c = 0; c < n; c += 1) {
    t2[c * 4] = bump[c];
    t2[c * 4 + 1] = Math.min(1, lines[c]);
    t2[c * 4 + 2] = mainForcing[c];
    t2[c * 4 + 3] = mainMicroSlope[c];
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
    t1[c * 4 + 3] = Number.isNaN(level[c]) ? -1 : wet[c] ? T[c] : 0;
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
