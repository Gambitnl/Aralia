/**
 * @file dropletWater.ts — the water itself as droplets, not a sheet with curtains.
 *
 * `mpmDomain.ts` gave the campaign a SPLASH: a 12 m box at the foot of one fall,
 * with the sheet still drawing the jet, the fall and the pool. Remy's answer was
 * that the splash is not the thing — he wants to look at the water itself as
 * droplets, spring to pool, and judge it beside the thin layer.
 *
 * This file is that window. It is the same solver; what changes is the SIZE of
 * the box, the SIZE of a droplet, and the RULE for when a droplet stops being a
 * droplet.
 *
 * WHY A BIGGER BOX IS AFFORDABLE, MEASURED
 *
 * The splash domain's budget note reads "a fixed 0.3 ms floor for the 24³ grid".
 * That floor is not real, and the measurement says so. `stepDomain` clears the
 * node arrays and then SKIPS every node with no mass (`if (m <= 0) continue`), so
 * an empty grid costs a `fill(0)` and nothing else. Benched in node on this
 * machine, milliseconds per substep at zero particles:
 *
 *   |   n | nodes   | ms    |
 *   |-----|---------|-------|
 *   |  24 |  13,824 | 0.002 |
 *   |  40 |  64,000 | 0.013 |
 *   |  48 | 110,592 | 0.022 |
 *   |  64 | 262,144 | 0.049 |
 *
 * The whole cost is the PARTICLES — 1.8 to 2.4 µs per particle-substep, flat
 * across every grid size in the table. So the box may be as large as the scene
 * needs; only the droplet count is bought. That single number is what turns "a
 * splash at the fall foot" into "the water, spring to pool".
 *
 * WHAT IT BUYS, AND WHAT IT CANNOT
 *
 * A droplet carries `dx³ / 4` cubic meters. Widening the window widens the
 * droplet, and the two trade against each other on one line:
 *
 *   | dx    | droplet m³ | span at n=40 | 1,200 droplets carry |
 *   |-------|------------|--------------|----------------------|
 *   | 0.5 m |      0.031 |         20 m |               37 m³  |
 *   | 1.5 m |      0.844 |         60 m |            1,013 m³  |
 *   | 2.5 m |      3.906 |        100 m |            4,688 m³  |
 *
 * So a droplet water is honest at a fixed BUDGET, not at a fixed volume: the
 * droplets carry what the budget holds and the sheet keeps the rest. That
 * remainder is not hidden — it stays in the sheet, draws as the thin layer, and
 * the page says which is which.
 *
 * GRAVITY IS CALIBRATED HERE, AND IT HAS TO BE
 *
 * The vendor cadence (`MPM_DT` 0.2, two substeps a frame) is tuned for a tank a
 * few cells across and says nothing about meters per second. Worked through, it
 * puts the splash domain's effective gravity at about 86 m/s² — nine g — which
 * a 12 m box at the foot of a fall hides. Widen `dx` to 2.5 m at the same
 * cadence and it becomes 345 m/s²: the droplets would not fall, they would be
 * fired. `dropletTimestep` picks the substep so that
 * `MPM_GRAVITY * dx * (sim-time per second)²` comes out at 9.81, which is the
 * only value a waterfall can be judged against.
 *
 * THE RETIREMENT RULE INVERTS
 *
 * In the splash domain a particle that comes to rest is handed back, because a
 * resting body of water was the sheet's job. Here the resting body IS the
 * picture — a pool of droplets is exactly what Remy asked to see — so a droplet
 * is handed back only when it reaches the EDGE of the window, which is water
 * genuinely leaving the pictured region for the wider world. Everything else
 * stays a droplet for as long as the budget allows.
 *
 * MASS IS THE SAME CONTRACT AS BEFORE
 *
 * Every crossing goes through `waterHandoff.ts`: the sheet is debited in whole
 * quanta, each droplet carries exactly one quantum for its whole life, and every
 * retirement credits a cell or is booked as stranded. Nothing in this file adds
 * a place for a cubic meter to hide.
 */

import {
  MPM_GRAVITY,
  MPM_REST_DENSITY,
  SETTLE_MOVE,
  SETTLE_STEPS,
  createDomain,
  drainAll,
  spawnBall,
  stepDomain,
  type MpmDomain,
} from './mpmDomain';
import {
  creditSheet,
  debitSheet,
  particleVolumeM3,
  type HandoffLedger,
  type HandoffRegion,
  type SheetTarget,
} from './waterHandoff';

/** The acceleration a falling droplet is judged against, m/s². */
export const DROPLET_GRAVITY_MS2 = 9.81;
/** Frames per second the timestep is calibrated for. */
export const DROPLET_FPS = 60;

/**
 * Sim-time per substep so that a droplet falls at `DROPLET_GRAVITY_MS2`.
 *
 * `stepDomain` subtracts `MPM_GRAVITY * dt` from a node's vertical velocity each
 * substep, in GRID units per sim-time. Over `t` seconds the domain advances
 * `S = fps * substeps * dt` sim-time, so the world drop is
 * `0.5 * MPM_GRAVITY * dx * S² * t²` — real gravity is `S = sqrt(g / (MPM_GRAVITY * dx))`.
 */
export function dropletTimestep(dxM: number, substeps: number, fps = DROPLET_FPS): number {
  const simPerSecond = Math.sqrt(DROPLET_GRAVITY_MS2 / (MPM_GRAVITY * dxM));
  return simPerSecond / (fps * substeps);
}

/** The gravity a domain at this spacing and cadence actually applies, m/s². */
export function effectiveGravityMS2(dxM: number, dtSim: number, substeps: number, fps = DROPLET_FPS): number {
  const simPerSecond = fps * substeps * dtSim;
  return MPM_GRAVITY * dxM * simPerSecond * simPerSecond;
}

export interface DropletWindow {
  readonly domain: MpmDomain;
  /** World meters per node — also the diameter a droplet reads as. */
  readonly dxM: number;
  /** The volume one droplet carries, m³. Fixed for the window's whole life. */
  readonly quantumM3: number;
  /** Sim-time per substep. */
  readonly dtSim: number;
  readonly substeps: number;
  /** World meters a velocity of 1 m/s becomes, in grid units per sim-time. */
  readonly velToGrid: number;
  /** Window span on a side, meters. */
  readonly spanM: number;
  /** The sheet cell the window was anchored on. A jet that moves rebuilds it. */
  readonly anchorCell: number;
  /** Milliseconds the last `stepDropletWindow` cost. Measured, never modeled. */
  ms: number;
}

export interface DropletWindowSpec {
  /** Nodes per edge. The grid is nearly free; see the header table. */
  nodes: number;
  dxM: number;
  substeps: number;
  originM: [number, number, number];
  capacity: number;
  anchorCell: number;
  /** Ground height at a world (x, z) — the SHEET's bed, never the voxel column. */
  floorYAt: (xM: number, zM: number) => number;
}

export function createDropletWindow(spec: DropletWindowSpec): DropletWindow {
  const dtSim = dropletTimestep(spec.dxM, spec.substeps);
  const simPerSecond = DROPLET_FPS * spec.substeps * dtSim;
  return {
    domain: createDomain({
      n: spec.nodes,
      dxM: spec.dxM,
      originM: spec.originM,
      capacity: spec.capacity,
      floorYAt: spec.floorYAt,
      /* The rest test measures displacement per substep, and this substep is a
       * fraction of the vendor's. Scaling the threshold with it keeps the
       * question the same one: has this droplet stopped moving through the
       * WORLD — not, has the integrator taken a small step. */
      settleMoveG: SETTLE_MOVE * (dtSim / 0.2),
      /* One droplet's own diameter above the floor. At a 2.5 m spacing the
       * default three cells would call a droplet seven meters up "resting". */
      settleHeightG: 1.2,
    }),
    dxM: spec.dxM,
    quantumM3: particleVolumeM3(spec.dxM, MPM_REST_DENSITY),
    dtSim,
    substeps: spec.substeps,
    velToGrid: 1 / (spec.dxM * simPerSecond),
    spanM: spec.nodes * spec.dxM,
    anchorCell: spec.anchorCell,
    ms: 0,
  };
}

/** The window's footprint on the sheet grid, inclusive cell bounds. */
export function windowFootprint(
  win: DropletWindow,
  sheetOriginM: readonly [number, number, number],
  sheet: SheetTarget,
  insetCells = 0,
): HandoffRegion {
  const d = win.domain;
  const toCellX = (xM: number): number => Math.floor((xM - sheetOriginM[0]) / sheet.cellM);
  const toCellZ = (zM: number): number => Math.floor((zM - sheetOriginM[2]) / sheet.cellM);
  const x0 = toCellX(d.originM[0]) + insetCells;
  const z0 = toCellZ(d.originM[2]) + insetCells;
  const x1 = toCellX(d.originM[0] + win.spanM) - insetCells;
  const z1 = toCellZ(d.originM[2] + win.spanM) - insetCells;
  return {
    x0: Math.max(0, x0),
    z0: Math.max(0, z0),
    x1: Math.min(sheet.n - 1, x1),
    z1: Math.min(sheet.n - 1, z1),
  };
}

/* Scratch. Module-level, so a running window allocates nothing per frame. */
let drainIdx = new Int32Array(0);
let drainVol = new Float32Array(0);
let drainXZ = new Float32Array(0);
function ensureScratch(capacity: number): void {
  if (drainIdx.length >= capacity) return;
  drainIdx = new Int32Array(capacity);
  drainVol = new Float32Array(capacity);
  drainXZ = new Float32Array(capacity * 2);
}

export interface DropletFeed {
  /** Droplets actually placed. */
  launched: number;
  /** Volume the sheet lost for them, m³. */
  takenM3: number;
  /** Volume debited that the budget refused, returned to the sheet the same frame. */
  returnedM3: number;
}

const NO_FEED: DropletFeed = { launched: 0, takenM3: 0, returnedM3: 0 };

/**
 * Buy droplets from a region of the sheet and put them in the window.
 *
 * The ONE crossing every feed goes through. Volume leaves the sheet in whole
 * quanta; anything the budget then refuses is credited straight back into
 * `returnCell` in the same frame, because a debit whose particles never
 * appeared is exactly the silent loss the handoff contract exists to prevent.
 */
function buyDroplets(
  win: DropletWindow,
  sheet: SheetTarget,
  ledger: HandoffLedger,
  region: HandoffRegion,
  budgetM3: number,
  maxParticles: number,
  keepDepthM: number,
  returnCell: number,
  centerG: readonly [number, number, number],
  radiusG: number,
  velG: readonly [number, number, number],
  rand: () => number,
): DropletFeed {
  const d = win.domain;
  const room = Math.min(maxParticles, d.capacity - d.live);
  if (room <= 0) return NO_FEED;
  const request = Math.min(budgetM3, room * win.quantumM3);
  if (!(request > 0)) return NO_FEED;

  const debit = debitSheet(sheet, ledger, region, request, win.quantumM3, keepDepthM);
  if (debit.particles <= 0) return NO_FEED;

  const put = spawnBall(d, debit.particles, centerG, radiusG, velG, rand);
  let returnedM3 = 0;
  if (put < debit.particles) {
    const back = debit.particles - put;
    ensureScratch(d.capacity);
    for (let k = 0; k < back; k++) {
      drainIdx[k] = returnCell;
      drainVol[k] = win.quantumM3;
    }
    creditSheet(sheet, ledger, drainIdx, drainVol, back);
    returnedM3 = back * win.quantumM3;
  }
  return { launched: put, takenM3: debit.takenM3, returnedM3 };
}

/**
 * The jet, as droplets.
 *
 * The spring's water is added to the sheet at its own cell by the caller; this
 * takes it back out and launches it from the spout on a real ballistic arc, at
 * the velocity that reaches the aim point under `DROPLET_GRAVITY_MS2`. What the
 * budget will not take stays in the sheet, and the caller sends it on to the
 * landing cell the way the drawn arc already claims it goes.
 */
export function feedSpout(
  win: DropletWindow,
  sheet: SheetTarget,
  ledger: HandoffLedger,
  springCell: number,
  budgetM3: number,
  maxParticles: number,
  spoutM: readonly [number, number, number],
  velMS: readonly [number, number, number],
  rand: () => number,
): DropletFeed {
  const d = win.domain;
  const n = sheet.n;
  const region: HandoffRegion = {
    x0: springCell % n,
    z0: (springCell / n) | 0,
    x1: springCell % n,
    z1: (springCell / n) | 0,
  };
  /* The spout can stand above the window's roof — the spring is draggable and
   * the relief is whatever the ground is. Clamping the spawn to just inside the
   * roof reads as a jet entering the frame from above, which is honest; the
   * alternative is a spawn outside the grid, which the stencil would fold back
   * onto the boundary nodes and turn into a wall of water. */
  const clampG = (v: number): number => (v < 2 ? 2 : v > d.n - 3 ? d.n - 3 : v);
  const centerG: [number, number, number] = [
    clampG((spoutM[0] - d.originM[0]) / win.dxM),
    clampG((spoutM[1] - d.originM[1]) / win.dxM),
    clampG((spoutM[2] - d.originM[2]) / win.dxM),
  ];
  const velG: [number, number, number] = [
    velMS[0] * win.velToGrid,
    velMS[1] * win.velToGrid,
    velMS[2] * win.velToGrid,
  ];
  return buyDroplets(
    win, sheet, ledger, region, budgetM3, maxParticles,
    0, springCell, centerG, 0.9, velG, rand,
  );
}

/**
 * What the spring is holding at its own cell, waiting to become a droplet.
 *
 * A quantum is indivisible and a pour is not. At a 2.5 m spacing one droplet is
 * 3.9 m³ while a frame of a modest spring is a fraction of that, so a spout that
 * only ever looked at THIS FRAME'S pour would find less than a quantum every
 * frame, launch nothing, and send the entire spring down the sheet path — a
 * droplets mode with no droplets in it, failing silently and looking like a
 * design limit rather than a bug.
 *
 * So the pour accumulates until it is worth a droplet. The carry is capped at
 * ONE quantum: past that the water is passed on to the landing cell the way the
 * drawn arc says it goes, so a full budget never grows a pond under the spout
 * that the thin layer would not have grown there.
 *
 * IT IS HELD OUTSIDE THE SHEET, AND THAT IS THE WHOLE POINT.
 *
 * The first cut parked the carry in the spring's own cell and let it build up
 * there. On flat ground that works; on a SLOPE — which is where anyone drags a
 * spring — the sheet solver drains the cell between frames, the carry never
 * reaches a quantum, and droplets mode quietly produces no droplets at all. So
 * the carry is a number here, `poured` counts it, and the page prints it as its
 * own ledger term. It enters the sheet only in the instant it is spent: a whole
 * number of quanta is added to the spring's cell and debited straight back out
 * in the same call, so the crossing's own books stay true and the sheet's depth
 * is unchanged by the round trip.
 */
export interface SpringCarry {
  /** Volume waiting to be worth a droplet, m³. Bounded by one quantum. */
  m3: number;
  /** The cell it belongs to. A dragged spring starts a fresh carry. */
  cell: number;
}

export function newSpringCarry(): SpringCarry {
  return { m3: 0, cell: -1 };
}

export interface SpringPour extends DropletFeed {
  /** Volume sent on to the landing cell because the droplets could not take it. */
  passedOnM3: number;
  /** Volume still waiting to be worth a droplet, m³. A printed ledger term. */
  carryM3: number;
}

/**
 * One frame of the spring, in droplets mode.
 *
 * The caller counts `pouredM3` as poured and hands it here INSTEAD of adding it
 * to the sheet. Every cubic meter then ends in exactly one of three places: a
 * droplet, the carry, or the landing cell — and the caller's printed identity
 * has a term for each.
 */
export function pourThroughSpout(
  win: DropletWindow,
  sheet: SheetTarget,
  ledger: HandoffLedger,
  carry: SpringCarry,
  springCell: number,
  pouredM3: number,
  landingCell: number,
  maxParticles: number,
  spoutM: readonly [number, number, number],
  velMS: readonly [number, number, number],
  rand: () => number,
): SpringPour {
  if (carry.cell !== springCell) {
    /* The spring moved. Its carry moves with it — the water has not gone
     * anywhere and neither has the number that stands for it. */
    carry.cell = springCell;
  }
  carry.m3 += Math.max(0, pouredM3);

  const area = sheet.cellM * sheet.cellM;
  const d = win.domain;
  const room = Math.min(maxParticles, d.capacity - d.live);
  let feed: DropletFeed = NO_FEED;
  const wanted = Math.min(room, Math.floor(carry.m3 / win.quantumM3));
  if (wanted > 0) {
    /* Spend the carry THROUGH the sheet, in and out in one call, so the
     * crossing's own books (`toParticles = inFlight + toSheet + stranded`) stay
     * true. The cell's depth is the same on both sides of this pair unless the
     * budget refuses a droplet, in which case the refused volume is left in the
     * sheet on purpose — that is where a droplet that could not exist belongs. */
    const spendM3 = wanted * win.quantumM3;
    sheet.depth[springCell] += spendM3 / area;
    carry.m3 -= spendM3;
    feed = feedSpout(
      win, sheet, ledger, springCell, spendM3, wanted, spoutM, velMS, rand,
    );
  }

  let passedOnM3 = 0;
  const over = carry.m3 - win.quantumM3;
  if (over > 0 && landingCell >= 0) {
    // The budget is full. The rest of the spring continues as thin layer, at
    // the place the drawn arc has always put it.
    passedOnM3 = over;
    sheet.depth[landingCell] += over / area;
    carry.m3 -= over;
  }
  return { ...feed, passedOnM3, carryM3: carry.m3 };
}

/**
 * The standing pool, as droplets.
 *
 * Water already lying in the sheet inside the window is bought a few droplets at
 * a time from the DEEPEST cell it holds, so flipping the toggle turns a pond
 * into a pond of droplets over about a second instead of leaving the old picture
 * beside the new one. It sources from one place per frame on purpose: the
 * deepest cell moves as the pool drains into droplets, so consecutive frames
 * walk the pool rather than scraping a film off all of it at once.
 *
 * `region` must EXCLUDE the window's edge band. A droplet retires when it
 * reaches the edge, and a feed that could buy from the same cells would pick it
 * straight back up — a loop that moves water nowhere at full frame rate.
 */
export function feedPool(
  win: DropletWindow,
  sheet: SheetTarget,
  ledger: HandoffLedger,
  region: HandoffRegion,
  bedY: Float32Array,
  sheetOriginM: readonly [number, number, number],
  maxParticles: number,
  minDepthM: number,
  rand: () => number,
): DropletFeed {
  const d = win.domain;
  if (d.live >= d.capacity || maxParticles <= 0) return NO_FEED;
  const n = sheet.n;
  const x0 = Math.max(0, region.x0);
  const x1 = Math.min(n - 1, region.x1);
  const z0 = Math.max(0, region.z0);
  const z1 = Math.min(n - 1, region.z1);
  if (x1 < x0 || z1 < z0) return NO_FEED;

  let best = -1;
  let bestDepth = minDepthM;
  for (let z = z0; z <= z1; z++) {
    for (let x = x0; x <= x1; x++) {
      const i = z * n + x;
      if (sheet.depth[i] > bestDepth) {
        bestDepth = sheet.depth[i];
        best = i;
      }
    }
  }
  if (best < 0) return NO_FEED;

  const bx = best % n;
  const bz = (best / n) | 0;
  const patch: HandoffRegion = {
    x0: Math.max(x0, bx - 2),
    x1: Math.min(x1, bx + 2),
    z0: Math.max(z0, bz - 2),
    z1: Math.min(z1, bz + 2),
  };
  // Spawned AT THE SURFACE it came from, not at the bed: a droplet that
  // appeared under the water it replaced would be launched out by the pressure.
  const surfaceY = bedY[best] + sheet.depth[best];
  const centerG: [number, number, number] = [
    (sheetOriginM[0] + (bx + 0.5) * sheet.cellM - d.originM[0]) / win.dxM,
    (surfaceY - d.originM[1]) / win.dxM,
    (sheetOriginM[2] + (bz + 0.5) * sheet.cellM - d.originM[2]) / win.dxM,
  ];
  return buyDroplets(
    win, sheet, ledger, patch,
    maxParticles * win.quantumM3, maxParticles,
    // Leave the source cell wet. Scraping it to bare bed makes the sheet's own
    // dry test flicker the pool's rim on and off at frame rate.
    minDepthM, best, centerG, 1.6, [0, 0, 0], rand,
  );
}

/** Advance the window. Returns the milliseconds it cost, measured. */
export function stepDropletWindow(win: DropletWindow): number {
  const t0 = performance.now();
  for (let s = 0; s < win.substeps; s++) stepDomain(win.domain, win.dtSim);
  win.ms = performance.now() - t0;
  return win.ms;
}

export interface DropletRetire {
  /** Droplets handed back to the sheet. */
  retired: number;
  /** Volume that landed in a cell, m³. */
  creditedM3: number;
  /** Volume whose cell was off the sheet grid, m³. The caller books it. */
  strandedM3: number;
}

/**
 * Hand back the droplets that have reached the window's edge.
 *
 * The rule that makes this a WATER and not a terrarium. A droplet at rest in the
 * middle of the window is the pool and stays a droplet; a droplet at rest inside
 * the edge band has arrived at the boundary of the pictured region, and beyond
 * that boundary the world's water is the sheet.
 *
 * `edgeCells` counts in from the wall the solver already pushes against, so a
 * droplet is judged by the same geometry that stopped it.
 */
export function retireAtEdge(
  win: DropletWindow,
  sheet: SheetTarget,
  ledger: HandoffLedger,
  sheetOriginM: readonly [number, number, number],
  edgeCells = 4,
): DropletRetire {
  const d = win.domain;
  ensureScratch(d.capacity);
  const lo = edgeCells;
  const hi = d.n - 1 - edgeCells;
  let out = 0;
  let p = 0;
  while (p < d.live) {
    const gx = d.pos[p * 3];
    const gy = d.pos[p * 3 + 1];
    const gz = d.pos[p * 3 + 2];
    const atEdge = gx < lo || gx > hi || gz < lo || gz > hi || gy < lo;
    if (!(atEdge && d.still[p] >= SETTLE_STEPS)) {
      p++;
      continue;
    }
    drainXZ[out * 2] = d.originM[0] + gx * d.dxM;
    drainXZ[out * 2 + 1] = d.originM[2] + gz * d.dxM;
    out++;
    // Swap-remove, the same retirement `drainSettled` uses: identity across
    // frames is not something the domain promises anyone.
    const last = d.live - 1;
    if (p !== last) {
      for (let k = 0; k < 3; k++) {
        d.pos[p * 3 + k] = d.pos[last * 3 + k];
        d.vel[p * 3 + k] = d.vel[last * 3 + k];
        d.c0[p * 3 + k] = d.c0[last * 3 + k];
        d.c1[p * 3 + k] = d.c1[last * 3 + k];
        d.c2[p * 3 + k] = d.c2[last * 3 + k];
      }
      d.still[p] = d.still[last];
    }
    d.live = last;
  }
  if (out === 0) return { retired: 0, creditedM3: 0, strandedM3: 0 };
  fillDeposits(sheet, sheetOriginM, out, win.quantumM3);
  const c = creditSheet(sheet, ledger, drainIdx, drainVol, out);
  return { retired: out, creditedM3: c.creditedM3, strandedM3: c.strandedM3 };
}

/**
 * Empty the window back into the sheet.
 *
 * The toggle's other half: switching back to the thin layer must return the
 * water, not a rounded approximation of it. Every live droplet is credited into
 * the column it is standing over, so the pool the sheet draws afterwards holds
 * exactly what it held before, plus whatever the droplets carried.
 */
export function drainWindow(
  win: DropletWindow,
  sheet: SheetTarget,
  ledger: HandoffLedger,
  sheetOriginM: readonly [number, number, number],
): DropletRetire {
  const d = win.domain;
  ensureScratch(d.capacity);
  let retired = 0;
  let credited = 0;
  let stranded = 0;
  let guard = 0;
  while (d.live > 0 && guard++ < 64) {
    const got = drainAll(d, drainXZ);
    if (got === 0) break;
    fillDeposits(sheet, sheetOriginM, got, win.quantumM3);
    const c = creditSheet(sheet, ledger, drainIdx, drainVol, got);
    retired += got;
    credited += c.creditedM3;
    stranded += c.strandedM3;
  }
  return { retired, creditedM3: credited, strandedM3: stranded };
}

/** Turn the drained world XZ pairs into sheet cell indices and volumes. */
function fillDeposits(
  sheet: SheetTarget,
  sheetOriginM: readonly [number, number, number],
  count: number,
  quantumM3: number,
): void {
  const n = sheet.n;
  for (let k = 0; k < count; k++) {
    const cx = Math.floor((drainXZ[k * 2] - sheetOriginM[0]) / sheet.cellM);
    const cz = Math.floor((drainXZ[k * 2 + 1] - sheetOriginM[2]) / sheet.cellM);
    drainIdx[k] = cx < 0 || cz < 0 || cx >= n || cz >= n ? -1 : cz * n + cx;
    drainVol[k] = quantumM3;
  }
}

/**
 * The velocity that carries a droplet from the spout to the aim point, m/s.
 *
 * A real projectile, not the drawn arc's parametrization. The flight time is
 * chosen from the horizontal reach at a walking-pace throw, floored so that a
 * spring aimed at its own feet still produces a jet rather than a vertical
 * dribble.
 */
export function spoutVelocityMS(
  spoutM: readonly [number, number, number],
  aimM: readonly [number, number, number],
  horizontalSpeedMS = 9,
): [number, number, number] {
  const dx = aimM[0] - spoutM[0];
  const dy = aimM[1] - spoutM[1];
  const dz = aimM[2] - spoutM[2];
  const reach = Math.hypot(dx, dz);
  const t = Math.max(0.45, reach / horizontalSpeedMS);
  return [dx / t, dy / t + 0.5 * DROPLET_GRAVITY_MS2 * t, dz / t];
}
