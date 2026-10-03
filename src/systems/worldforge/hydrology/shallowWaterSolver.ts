/**
 * @file shallowWaterSolver.ts — the seam between the notebook and real fluid.
 *
 * WHY THIS FILE IS A COUPLING AND NOT A SOLVER
 *
 * The task that produced this file asked for "a simple shallow-water solver
 * over the terrain grid". One already exists and is better than a simple one:
 * `../terrain/shallowWater.ts` — virtual-pipe fluxes, an exact conservation
 * limiter, Torricelli discharge under head, `editBed` that conserves volume
 * when a spell moves the ground, a boundary ledger so water leaving the domain
 * is recorded rather than deleted, and eleven tests including three
 * conservation bugs it has already caught (ADR 0002, revision 2026-08-07).
 * Writing a second, worse solver beside it would give the world two opinions
 * about how water moves — the exact fault GG-129 records for how water is
 * CLASSIFIED. So this file makes the existing solver the local window of the
 * water notebook instead.
 *
 * WHAT THE SEAM HAS TO GUARANTEE
 *
 * Remy's condition on the design was that the window and the notebook can never
 * disagree about a cubic meter. That means every crossing is a MOVE:
 *
 *   - OPENING withdraws the water standing over the window's ground from the
 *     lakes that were holding it, and puts it in the field as real depth.
 *   - RUNNING pulls the notebook's routed inflow out of `WindowLedger.transitM3`
 *     and turns it into depth at the cells where the rivers actually enter.
 *   - SHEDDING reads the growth of `ShallowWaterField.boundaryLedgerM3` — water
 *     that ran off the window edge — and hands it to `WindowLedger.returnM3`,
 *     which the next notebook step routes onward from the window's outlet.
 *   - CLOSING gives everything back: water over a lake cell returns to that
 *     lake, the rest joins `returnM3`.
 *
 * `coupledTotalM3` sums both sides, and a test holds it flat across a run that
 * opens a window, rains on the map, spills a lake through it, and closes it.
 *
 * ONE WINDOW FIRST, by the task's own instruction. Nothing here assumes a
 * single window — `WaterBudget.windows` is a list and the ledger is per-window
 * — but only one has been exercised.
 *
 * KNOWN SEAM LIMIT, deferred deliberately: a lake that extends past the window
 * edge is owned by the window for the part inside it, so the notebook's level
 * for that lake drops while the window shows the old surface. Volume is still
 * exact; only the shoreline outside the window is briefly stale. Splitting a
 * body across the seam needs the notebook to hold a partial level, which is a
 * bigger change than this slice.
 */

import {
  ShallowWaterField,
  DRY_DEPTH_M,
} from "../terrain/shallowWater";
import {
  type WaterBudget,
  type WindowLedger,
  lakeLevelM,
  registerWindow,
  retireWindow,
} from "./waterBudget";

export interface LocalWindowSpec {
  /** Top-left grid cell of the window in world-grid coordinates. */
  originCol: number;
  originRow: number;
  /** Window edge in cells. The field is n × n. */
  n: number;
}

/** Where a river walks into the window, and how hard. */
export interface WindowInflow {
  /** Local field index. */
  localIdx: number;
  reachId: number;
  /** The reach's flow when the window opened, m³/s. Used only as a weight. */
  weightM3s: number;
}

export interface LocalWaterWindow {
  budget: WaterBudget;
  ledger: WindowLedger;
  field: ShallowWaterField;
  originCol: number;
  originRow: number;
  n: number;
  inflows: WindowInflow[];
  /** Volume withdrawn from lakes to seed the field, m³. */
  seededM3: number;
  /** Last `boundaryLedgerM3` reading, so only the growth is handed back. */
  lastLedgerM3: number;
}

export interface LocalWindowStep {
  /** Volume taken out of the notebook's transit bucket this step, m³. */
  inflowM3: number;
  /** Volume that ran off the window edge this step, m³. */
  outflowM3: number;
  /** Water standing in the field after the step, m³. */
  volumeM3: number;
  /** The step actually taken, seconds — clamped to the field's CFL limit. */
  dtUsed: number;
}

/** Field index → world grid index. */
export function worldCellOf(win: LocalWaterWindow, localIdx: number): number {
  const x = localIdx % win.n;
  const z = (localIdx - x) / win.n;
  return (win.originRow + z) * win.budget.cols + (win.originCol + x);
}

/** Water standing in the window's field, m³. */
export function windowWaterM3(win: LocalWaterWindow): number {
  return win.field.volume();
}

/**
 * Every cubic meter on both sides of the seam.
 *
 * The notebook's own `totalWaterM3` already counts the transit and return
 * buckets, so this only adds the water the real solver is holding.
 */
export function coupledTotalM3(
  notebookTotalM3: number,
  windows: readonly LocalWaterWindow[],
): number {
  let t = notebookTotalM3;
  for (const w of windows) t += w.field.volume();
  return t;
}

/**
 * Open the live window: build the real field on the notebook's own ground.
 *
 * The bed comes from `WaterBudget.bedM`, which came from the same encoded
 * heights `deriveHydrology` and the renderer read. There is no second
 * heightfield anywhere in this path (GG-129).
 */
export function openLocalWindow(
  budget: WaterBudget,
  spec: LocalWindowSpec,
): LocalWaterWindow {
  const { n } = spec;
  const field = new ShallowWaterField(n, budget.cellM);
  const ledger = registerWindow(budget, spec);

  // Bed straight off the notebook. Cells outside the map keep the nearest
  // in-map height, so the window never has a phantom cliff at the world edge.
  for (let z = 0; z < n; z++) {
    const row = clamp(spec.originRow + z, 0, budget.rows - 1);
    for (let x = 0; x < n; x++) {
      const col = clamp(spec.originCol + x, 0, budget.cols - 1);
      field.bed[z * n + x] = budget.bedM[row * budget.cols + col];
    }
  }

  // Standing water: withdraw it from the lake that was holding it, so the
  // notebook total does not double-count what the field now owns.
  let seededM3 = 0;
  const cellArea = budget.cellM * budget.cellM;
  const wantByLake = new Map<number, number>();
  const depthByLocal = new Map<number, number>();
  for (let z = 0; z < n; z++) {
    const row = spec.originRow + z;
    if (row < 0 || row >= budget.rows) continue;
    for (let x = 0; x < n; x++) {
      const col = spec.originCol + x;
      if (col < 0 || col >= budget.cols) continue;
      const world = row * budget.cols + col;
      const lakeId = budget.lakeIdByCell.get(world);
      if (lakeId === undefined) continue;
      const lake = budget.lakes[lakeId];
      const depth = lakeLevelM(lake, cellArea) - budget.bedM[world];
      if (depth <= 0) continue;
      depthByLocal.set(z * n + x, depth);
      wantByLake.set(lakeId, (wantByLake.get(lakeId) ?? 0) + depth * cellArea);
    }
  }
  for (const [localIdx, depth] of depthByLocal) {
    const world = (spec.originRow + Math.floor(localIdx / n)) * budget.cols +
      (spec.originCol + (localIdx % n));
    const lakeId = budget.lakeIdByCell.get(world)!;
    const want = wantByLake.get(lakeId)!;
    const lake = budget.lakes[lakeId];
    // If the lake holds less than the window wants (a partially drained basin
    // whose level solve rounds up), scale rather than mint water.
    const affordable = Math.min(1, want > 0 ? lake.storedM3 / want : 0);
    const d = depth * affordable;
    field.depth[localIdx] = d;
    seededM3 += d * cellArea;
  }
  for (const [lakeId, want] of wantByLake) {
    const lake = budget.lakes[lakeId];
    lake.storedM3 = Math.max(0, lake.storedM3 - Math.min(want, lake.storedM3));
  }

  return {
    budget,
    ledger,
    field,
    originCol: spec.originCol,
    originRow: spec.originRow,
    n,
    inflows: findInflows(budget, spec),
    seededM3,
    lastLedgerM3: field.boundaryLedgerM3,
  };
}

/**
 * Where the notebook's rivers cross into the window.
 *
 * A reach enters the window at the first of its downstream-ordered cells that
 * lies inside it, provided the cell before it lay outside. A reach that starts
 * inside the window has no border crossing — its water is local rain, and the
 * routing sweep already hands that over as transit.
 */
function findInflows(budget: WaterBudget, spec: LocalWindowSpec): WindowInflow[] {
  const inflows: WindowInflow[] = [];
  const inside = (world: number): boolean => {
    const col = world % budget.cols;
    const row = (world - col) / budget.cols;
    return (
      col >= spec.originCol &&
      col < spec.originCol + spec.n &&
      row >= spec.originRow &&
      row < spec.originRow + spec.n
    );
  };
  for (const reach of budget.reaches) {
    for (let k = 0; k < reach.cells.length; k++) {
      if (!inside(reach.cells[k])) continue;
      if (k === 0) break; // starts inside: rain, not a crossing
      const world = reach.cells[k];
      const col = world % budget.cols;
      const row = (world - col) / budget.cols;
      inflows.push({
        localIdx: (row - spec.originRow) * spec.n + (col - spec.originCol),
        reachId: reach.id,
        weightM3s: Math.max(reach.flowM3s, 0),
      });
      break;
    }
  }
  return inflows;
}

/**
 * Advance the live window, taking its inflow from the notebook and giving its
 * outflow back.
 *
 * `dt` is clamped to `field.maxStableStep()`. Ignoring that limit fills the
 * field with NaN rather than raising an error, so the clamp is not optional.
 */
export function stepLocalWindow(
  win: LocalWaterWindow,
  dtSeconds: number,
): LocalWindowStep {
  const dt = Math.min(dtSeconds, win.field.maxStableStep());
  const cellArea = win.budget.cellM * win.budget.cellM;

  // ---- inflow: the notebook's routed water becomes real depth -----------
  const inflowM3 = win.ledger.transitM3;
  if (inflowM3 > 0) {
    win.ledger.transitM3 = 0;
    const targets = win.inflows.length > 0 ? win.inflows : [];
    if (targets.length > 0) {
      let weight = 0;
      for (const t of targets) weight += t.weightM3s;
      for (const t of targets) {
        const share = weight > 0 ? t.weightM3s / weight : 1 / targets.length;
        win.field.depth[t.localIdx] += (inflowM3 * share) / cellArea;
      }
    } else {
      // No river crosses the border: this is rain on the window's own ground.
      // Spreading it evenly is the honest reading of "it rained here".
      const per = inflowM3 / (win.n * win.n) / cellArea;
      for (let i = 0; i < win.field.depth.length; i++) win.field.depth[i] += per;
    }
  }

  win.field.step(dt);

  // ---- outflow: only the GROWTH of the ledger is new water --------------
  const shed = win.field.boundaryLedgerM3 - win.lastLedgerM3;
  win.lastLedgerM3 = win.field.boundaryLedgerM3;
  if (shed > 0) win.ledger.returnM3 += shed;

  return {
    inflowM3,
    outflowM3: Math.max(0, shed),
    volumeM3: win.field.volume(),
    dtUsed: dt,
  };
}

/**
 * Close the window and give every cubic meter back to the notebook.
 *
 * Water standing over a lake cell returns to that lake — that is where it came
 * from, and returning it downstream instead would drain basins every time the
 * player walked away. Everything else joins the return bucket and is routed
 * onward from the window's outlet on the next notebook step.
 */
export function closeLocalWindow(win: LocalWaterWindow): number {
  const cellArea = win.budget.cellM * win.budget.cellM;
  let returned = 0;
  for (let i = 0; i < win.field.depth.length; i++) {
    const d = win.field.depth[i];
    if (d <= 0) continue;
    const v = d * cellArea;
    win.field.depth[i] = 0;
    const world = worldCellOf(win, i);
    const lakeId = win.budget.lakeIdByCell.get(world);
    if (lakeId !== undefined) win.budget.lakes[lakeId].storedM3 += v;
    else win.ledger.returnM3 += v;
    returned += v;
  }
  // `retireWindow` unregisters the ledger and routes BOTH buckets onward in one
  // move, so anything the notebook handed over but the window never picked up
  // is returned rather than dropped with the ledger.
  retireWindow(win.budget, win.ledger);
  return returned;
}

/** Cells the window currently counts as wet. Mirrors the solver's dry cutoff. */
export function wetCellCount(win: LocalWaterWindow): number {
  let wet = 0;
  for (let i = 0; i < win.field.depth.length; i++) {
    if (win.field.depth[i] > DRY_DEPTH_M) wet++;
  }
  return wet;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
