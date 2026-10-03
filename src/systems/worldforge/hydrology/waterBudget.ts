/**
 * @file waterBudget.ts — THE WATER NOTEBOOK.
 *
 * WHAT THIS IS, AND WHAT IT DELIBERATELY IS NOT
 *
 * Remy's 2026-08-10 design (planmap topic "World hydrology: the water
 * notebook") asked two questions that a pretty water shader cannot answer: if
 * rivers truly flow, what stops the sea from depleting, and how does a river
 * dry when its lake drops below its bed? Both are BOOKKEEPING questions, so the
 * answer is a book, not a simulation.
 *
 * Far water is therefore a NOTEBOOK:
 *
 *   - every lake or sea is ONE fullness number (`storedM3`) plus the shape of
 *     its basin, so its surface height is derived, never invented;
 *   - every river is a chain of REACHES, each carrying one flow-per-second;
 *   - every lake exit is a DOORSTEP height — the lake feeds its river only
 *     while its water stands above that height, which makes drying automatic
 *     rather than a special case;
 *   - the SKY BUCKET closes the books. The sun lifts water off open water into
 *     it; rain pays it back onto the land. Nothing is created or destroyed, so
 *     the world total never changes and the sea cannot deplete.
 *
 * Real fluid — `ShallowWaterField` in `../terrain/shallowWater.ts` — runs only
 * inside the LIVE WINDOW around the player. `shallowWaterSolver.ts` beside this
 * file is the coupling: the notebook hands the window its inflow and takes back
 * whatever leaves it, so the window and the notebook can never disagree about a
 * cubic meter. This file does not simulate; it accounts.
 *
 * WHY IT READS `deriveHydrology` AND NOTHING ELSE
 *
 * GG-129 (`docs/projects/GLOBAL_GAPS.md`) records a live divergence: the combat
 * referee decides "is this water?" from `ground.biomeIds` while the renderer
 * draws from `ground.waterRuns`, which comes from the HEIGHTFIELD via
 * `deriveHydrology`. Two water opinions in one world is exactly the bug class
 * this notebook would otherwise triple. So the budget derives its basins,
 * doorsteps and river network from the SAME `deriveHydrology` pass over the
 * SAME encoded heights the renderer already uses. It adds a third opinion to
 * nothing.
 *
 * PRESERVED: `terrainHydrology.ts` (fill-to-spill + flow accumulation) and
 * `terrain/shallowWater.ts` (the conservative 2D solver, 11 tests) are both
 * kept and reused as-is. Nothing here reimplements either.
 *
 * CONSERVATION IS THE INVARIANT, as it is in every other water file here:
 *
 *     sky + Σ lake stored + sea + Σ window transit/return  ===  constant
 *
 * `totalWaterM3` is that sum, and a test holds it flat across a long run.
 */

import { deriveHydrology } from "../bridge/terrainHydrology";
import { GROUND_METERS_PER_CELL } from "../bridge/groundWorldAdapter";
import { heightToMeters } from "../../world3d/config";

/**
 * Weather, as rates rather than events.
 *
 * A notebook does not need storms to be honest about totals; a storm is a
 * schedule laid over these numbers later, not a different model.
 */
export interface WaterClimate {
  /** Rain depth landing on every cell, meters per second. */
  precipMPerSec: number;
  /** Depth the sun lifts off OPEN WATER, meters per second. */
  evapMPerSec: number;
  /**
   * Share of rain that reaches the channel network rather than soaking away.
   *
   * The remainder is not deleted — it never leaves the sky bucket in the first
   * place, which keeps the books closed without a soil model this layer has no
   * business owning yet.
   */
  runoffFraction: number;
}

export const DEFAULT_CLIMATE: WaterClimate = {
  // ~1 m of rain a year, spread evenly. Earth-ish, and the units are checkable.
  precipMPerSec: 1 / (365 * 24 * 3600),
  // Open water loses rather more than the land receives; the sea is the sink.
  evapMPerSec: 1.4 / (365 * 24 * 3600),
  runoffFraction: 0.35,
};

/** One standing body: a lake, or the sea when a basin reaches the map edge. */
export interface LakeBody {
  id: number;
  /** Grid indices in the basin, ascending. */
  cells: number[];
  /** Bed elevation per basin cell, meters, sorted ASCENDING for the level solve. */
  sortedBedM: number[];
  areaM2: number;
  /** Spill height, meters — the DOORSTEP. Water above this leaves. */
  doorstepM: number;
  /** Cell the spill runs into, outside the basin. `-1` when it spills off-map. */
  outletCell: number;
  /** Volume held at exactly the doorstep. */
  capacityM3: number;
  /** Water held now. Level is derived from it, never set directly. */
  storedM3: number;
  /** Discharge over the doorstep during the last step, m³/s. */
  outflowM3s: number;
}

/** One stretch of river between two points on the notebook. */
export interface Reach {
  id: number;
  /** River cells in DOWNSTREAM order. */
  cells: number[];
  headCell: number;
  mouthCell: number;
  /**
   * Cell the mouth drains into: a lake cell, the head of another reach, or
   * `-1` when the reach runs off the map.
   */
  drainsToCell: number;
  /** Lake this reach ends in, or `-1`. */
  drainsToLakeId: number;
  /**
   * Cells whose rain routes through this reach's mouth without passing a lake
   * first. This is the reach's own catchment, and it is what makes discharge
   * checkable against precipitation.
   */
  catchmentCells: number;
  /** Flow at the mouth during the last step, m³/s. */
  flowM3s: number;
}

/**
 * A live window's ledger inside the notebook.
 *
 * The window is not a lake and not a reach — it is a hole in the notebook where
 * the real solver runs. These two buckets are how water crosses the seam:
 * `transitM3` is what the notebook has routed INTO the window and the window
 * has not yet picked up; `returnM3` is what the window has shed and the
 * notebook has not yet routed onward. Both are counted in `totalWaterM3`, so
 * water in flight across the seam is never briefly missing.
 */
export interface WindowLedger {
  id: number;
  originCol: number;
  originRow: number;
  n: number;
  /** Grid indices the window covers. */
  cells: Set<number>;
  /** Cell just downstream of the window, where its outflow rejoins. `-1` off-map. */
  outletCell: number;
  transitM3: number;
  returnM3: number;
}

export interface WaterBudget {
  cols: number;
  rows: number;
  cellM: number;
  cellAreaM2: number;
  /** Bed elevation, meters, from the SAME encoded heights the renderer uses. */
  bedM: number[];
  /** Depression-filled surface, meters. A basin's filled height IS its doorstep. */
  filledM: number[];
  /** Cells of upstream land draining through each cell (terrainHydrology). */
  accumulation: number[];
  /** Steepest-descent receiver per cell on the filled surface; `-1` at a sink. */
  receiver: number[];
  /** Cells in descending filled order — upstream before downstream. */
  topoOrder: number[];
  lakes: LakeBody[];
  lakeIdByCell: Map<number, number>;
  reaches: Reach[];
  reachIdByCell: Map<number, number>;
  climate: WaterClimate;
  /** The sky bucket: water the sun is holding. Rain is drawn from here. */
  skyM3: number;
  /** Water that has left the map. The world's terminal sink. */
  seaM3: number;
  windows: WindowLedger[];
  /** Rain the sky could not pay for last step, m³. Non-zero means a dry sky. */
  rainShortfallM3: number;
}

export interface WaterBudgetInput {
  cols: number;
  rows: number;
  /**
   * Encoded 0..100 heights, row-major — the exact array
   * `resolveGroundWater`/`deriveHydrology` read. Passing anything else
   * reintroduces GG-129 at a new layer.
   */
  heights: readonly number[];
  /** World meters per cell. Defaults to the walking-scale ground cell (5 ft). */
  cellM?: number;
  /** Upstream cells needed before a cell counts as river. See terrainHydrology. */
  riverThreshold?: number;
  climate?: Partial<WaterClimate>;
  /** Starting sky bucket. Defaults to 1 m of water over the whole map. */
  initialSkyM3?: number;
  /** Fill every lake to this fraction of its capacity at build time. */
  initialLakeFill?: number;
  /** Encoded height → meters. Swappable so a test can read in plain meters. */
  toMeters?: (encoded: number) => number;
}

export interface WaterBudgetStep {
  rainM3: number;
  evaporatedM3: number;
  lakeOutflowM3: number;
  toSeaM3: number;
  toWindowsM3: number;
}

const neighboursOf = (idx: number, cols: number, rows: number): number[] => {
  const col = idx % cols;
  const row = (idx - col) / cols;
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const c = col + dc;
      const r = row + dr;
      if (c < 0 || c >= cols || r < 0 || r >= rows) continue;
      out.push(r * cols + c);
    }
  }
  return out;
};

const isEdge = (idx: number, cols: number, rows: number): boolean => {
  const col = idx % cols;
  const row = (idx - col) / cols;
  return col === 0 || row === 0 || col === cols - 1 || row === rows - 1;
};

/**
 * The surface height a basin holds `storedM3` at.
 *
 * A lake is not a box: the first cubic meter covers only the deepest cell,
 * and each rise floods more of the floor. Sorting the bed ascending turns that
 * into a walk — at each step the area is "every cell at or below here", so the
 * volume to reach the next bed height is exact.
 *
 * Pure, and exported because it is the one piece of lake physics worth testing
 * on its own.
 */
export function levelForStorage(
  sortedBedM: readonly number[],
  cellAreaM2: number,
  storedM3: number,
): number {
  if (sortedBedM.length === 0) return 0;
  if (storedM3 <= 0) return sortedBedM[0];
  let remaining = storedM3;
  for (let i = 0; i < sortedBedM.length - 1; i++) {
    const rise = sortedBedM[i + 1] - sortedBedM[i];
    // Cells 0..i are already flooded, so they are the area that rises.
    const stepVolume = rise * (i + 1) * cellAreaM2;
    if (remaining <= stepVolume) {
      return sortedBedM[i] + remaining / ((i + 1) * cellAreaM2);
    }
    remaining -= stepVolume;
  }
  // Past the highest bed cell the whole floor rises together.
  return sortedBedM[sortedBedM.length - 1] + remaining / (sortedBedM.length * cellAreaM2);
}

/** Volume a basin holds at `levelM`. Inverse of `levelForStorage`. */
export function storageForLevel(
  sortedBedM: readonly number[],
  cellAreaM2: number,
  levelM: number,
): number {
  let v = 0;
  for (const bed of sortedBedM) {
    if (bed >= levelM) break;
    v += (levelM - bed) * cellAreaM2;
  }
  return v;
}

/** The lake's current surface height, meters. Derived, never stored. */
export function lakeLevelM(lake: LakeBody, cellAreaM2: number): number {
  return levelForStorage(lake.sortedBedM, cellAreaM2, lake.storedM3);
}

/** Every cubic meter the notebook knows about. Must not drift. */
export function totalWaterM3(b: WaterBudget): number {
  let total = b.skyM3 + b.seaM3;
  for (const lake of b.lakes) total += lake.storedM3;
  for (const w of b.windows) total += w.transitM3 + w.returnM3;
  return total;
}

/**
 * Build the notebook from the terrain the renderer already draws.
 *
 * Everything structural — basins, doorsteps, the river network — falls out of
 * `deriveHydrology`. Nothing here re-derives where water goes; it only decides
 * how much of it there is.
 */
export function buildWaterBudget(input: WaterBudgetInput): WaterBudget {
  const { cols, rows, heights } = input;
  const cellM = input.cellM ?? GROUND_METERS_PER_CELL;
  const cellAreaM2 = cellM * cellM;
  const toMeters = input.toMeters ?? heightToMeters;
  const climate: WaterClimate = { ...DEFAULT_CLIMATE, ...input.climate };
  const total = cols * rows;

  const hydro = deriveHydrology({
    cols,
    rows,
    heights,
    riverThreshold: input.riverThreshold,
  });

  const bedM = new Array<number>(total);
  const filledM = new Array<number>(total);
  for (let i = 0; i < total; i++) {
    bedM[i] = toMeters(heights[i]);
    filledM[i] = toMeters(hydro.filled[i]);
  }

  // Steepest descent on the FILLED surface — the same surface flow accumulation
  // used, so the routing graph and the accumulation numbers agree by
  // construction rather than by luck.
  const receiver = new Array<number>(total).fill(-1);
  for (let i = 0; i < total; i++) {
    let best = -1;
    let bestH = filledM[i];
    for (const n of neighboursOf(i, cols, rows)) {
      if (filledM[n] < bestH) {
        bestH = filledM[n];
        best = n;
      }
    }
    receiver[i] = best;
  }

  const topoOrder = Array.from({ length: total }, (_, i) => i).sort(
    (a, b) => filledM[b] - filledM[a] || a - b,
  );

  // ---- basins → lakes ---------------------------------------------------
  const lakeIdByCell = new Map<number, number>();
  const lakes: LakeBody[] = [];
  const seen = new Set<number>();
  for (const start of hydro.lakeCells) {
    if (seen.has(start)) continue;
    // One basin is one connected run of raised cells.
    const cells: number[] = [];
    const stack = [start];
    seen.add(start);
    while (stack.length > 0) {
      const cur = stack.pop()!;
      cells.push(cur);
      for (const n of neighboursOf(cur, cols, rows)) {
        if (seen.has(n) || !hydro.lakeCells.has(n)) continue;
        seen.add(n);
        stack.push(n);
      }
    }
    cells.sort((a, b) => a - b);

    // The doorstep is the spill height, which is what filling produced.
    let doorstepM = -Infinity;
    for (const c of cells) doorstepM = Math.max(doorstepM, filledM[c]);

    // The spill runs into the lowest non-basin neighbour of the whole rim.
    const inBasin = new Set(cells);
    let outletCell = -1;
    let outletH = Infinity;
    let spillsOffMap = false;
    for (const c of cells) {
      if (isEdge(c, cols, rows)) spillsOffMap = true;
      for (const n of neighboursOf(c, cols, rows)) {
        if (inBasin.has(n)) continue;
        if (filledM[n] < outletH) {
          outletH = filledM[n];
          outletCell = n;
        }
      }
    }
    if (spillsOffMap) outletCell = -1;

    const sortedBedM = cells.map((c) => bedM[c]).sort((a, b) => a - b);
    const areaM2 = cells.length * cellAreaM2;
    const capacityM3 = storageForLevel(sortedBedM, cellAreaM2, doorstepM);
    const id = lakes.length;
    for (const c of cells) lakeIdByCell.set(c, id);
    lakes.push({
      id,
      cells,
      sortedBedM,
      areaM2,
      doorstepM,
      outletCell,
      capacityM3,
      storedM3: capacityM3 * (input.initialLakeFill ?? 1),
      outflowM3s: 0,
    });
  }

  // ---- river cells → reaches -------------------------------------------
  const riverThreshold = input.riverThreshold ?? 60;
  const isRiver = new Uint8Array(total);
  for (let i = 0; i < total; i++) {
    if (!lakeIdByCell.has(i) && hydro.accumulation[i] >= riverThreshold) isRiver[i] = 1;
  }
  // How many river cells drain INTO each river cell. A cell with exactly one
  // is mid-reach; anything else starts a new reach (source, or confluence).
  const riverInDeg = new Int32Array(total);
  for (let i = 0; i < total; i++) {
    if (!isRiver[i]) continue;
    const r = receiver[i];
    if (r >= 0 && isRiver[r]) riverInDeg[r]++;
  }

  const reaches: Reach[] = [];
  const reachIdByCell = new Map<number, number>();
  for (let i = 0; i < total; i++) {
    if (!isRiver[i] || riverInDeg[i] === 1) continue;
    const cells: number[] = [];
    let cur = i;
    for (;;) {
      cells.push(cur);
      const next = receiver[cur];
      if (next < 0 || !isRiver[next] || riverInDeg[next] !== 1) break;
      cur = next;
    }
    const mouthCell = cur;
    const drainsToCell = receiver[mouthCell];
    const id = reaches.length;
    for (const c of cells) reachIdByCell.set(c, id);
    reaches.push({
      id,
      cells,
      headCell: cells[0],
      mouthCell,
      drainsToCell: drainsToCell ?? -1,
      drainsToLakeId:
        drainsToCell >= 0 ? (lakeIdByCell.get(drainsToCell) ?? -1) : -1,
      // Filled in below by the lake-aware routing count.
      catchmentCells: 0,
      flowM3s: 0,
    });
  }

  const budget: WaterBudget = {
    cols,
    rows,
    cellM,
    cellAreaM2,
    bedM,
    filledM,
    accumulation: hydro.accumulation,
    receiver,
    topoOrder,
    lakes,
    lakeIdByCell,
    reaches,
    reachIdByCell,
    climate,
    skyM3: input.initialSkyM3 ?? total * cellAreaM2 * 1,
    seaM3: 0,
    windows: [],
    rainShortfallM3: 0,
  };

  // A reach's catchment is the cells whose rain reaches its mouth WITHOUT
  // passing through a lake — lakes are sinks in the notebook, so counting
  // plain flow accumulation here would credit a reach with water its upstream
  // lake is actually holding.
  const routed = routedCellCounts(budget);
  for (const reach of reaches) reach.catchmentCells = routed[reach.mouthCell];

  return budget;
}

/**
 * Upstream cells whose water passes through each cell before meeting a lake.
 *
 * This is flow accumulation with lakes as sinks. It is separated out because
 * it is the number that makes "river discharge consistent with precipitation"
 * a checkable equation rather than a vibe:
 *
 *     flow at a mouth (m³/s) = precip × runoff × cellArea × routedCells
 */
export function routedCellCounts(b: WaterBudget): Float64Array {
  const total = b.cols * b.rows;
  const count = new Float64Array(total);
  for (let i = 0; i < total; i++) count[i] = b.lakeIdByCell.has(i) ? 0 : 1;
  for (const i of b.topoOrder) {
    if (b.lakeIdByCell.has(i)) continue;
    const r = b.receiver[i];
    if (r >= 0 && !b.lakeIdByCell.has(r)) count[r] += count[i];
  }
  return count;
}

/**
 * Register a live window so the notebook stops routing water through the
 * ground it covers and hands it over instead.
 *
 * The window's outlet is the cell the covered ground drained into — found by
 * following the receiver chain out of the window from its lowest covered cell.
 * Whatever the real solver sheds rejoins the notebook exactly there.
 */
export function registerWindow(
  b: WaterBudget,
  spec: { originCol: number; originRow: number; n: number },
): WindowLedger {
  const cells = new Set<number>();
  for (let r = 0; r < spec.n; r++) {
    const row = spec.originRow + r;
    if (row < 0 || row >= b.rows) continue;
    for (let c = 0; c < spec.n; c++) {
      const col = spec.originCol + c;
      if (col < 0 || col >= b.cols) continue;
      cells.add(row * b.cols + col);
    }
  }
  // Lowest covered cell, then walk downhill until we are outside the window.
  let lowest = -1;
  let lowestH = Infinity;
  for (const c of cells) {
    if (b.filledM[c] < lowestH) {
      lowestH = b.filledM[c];
      lowest = c;
    }
  }
  let outletCell = -1;
  let cur = lowest;
  const guard = new Set<number>();
  while (cur >= 0 && !guard.has(cur)) {
    guard.add(cur);
    const next = b.receiver[cur];
    if (next < 0) break;
    if (!cells.has(next)) {
      outletCell = next;
      break;
    }
    cur = next;
  }
  const ledger: WindowLedger = {
    id: b.windows.length,
    originCol: spec.originCol,
    originRow: spec.originRow,
    n: spec.n,
    cells,
    outletCell,
    transitM3: 0,
    returnM3: 0,
  };
  b.windows.push(ledger);
  return ledger;
}

/** Remove a window. Its buckets must already be drained by the caller. */
export function unregisterWindow(b: WaterBudget, ledger: WindowLedger): void {
  const at = b.windows.indexOf(ledger);
  if (at >= 0) b.windows.splice(at, 1);
}

/**
 * Close a window's ledger and route whatever is still in it onward.
 *
 * The window is unregistered FIRST, so the routing sweep does not hand the
 * water straight back to the ground the window has just stopped owning. Both
 * buckets are emptied in one move, which is why closing a window cannot lose a
 * cubic meter even if the caller closes it mid-flow.
 */
export function retireWindow(b: WaterBudget, ledger: WindowLedger): number {
  unregisterWindow(b, ledger);
  const pending = ledger.transitM3 + ledger.returnM3;
  ledger.transitM3 = 0;
  ledger.returnM3 = 0;
  if (pending <= 0) return 0;
  if (ledger.outletCell < 0) {
    b.seaM3 += pending;
    return pending;
  }
  const total = b.cols * b.rows;
  const carry = new Float64Array(total);
  const through = new Float64Array(total);
  carry[ledger.outletCell] = pending;
  routeCarry(b, carry, through, {
    rainM3: 0,
    evaporatedM3: 0,
    lakeOutflowM3: 0,
    toSeaM3: 0,
    toWindowsM3: 0,
  });
  return pending;
}

/**
 * Advance the notebook by `dtSeconds`.
 *
 * The order is the whole model, and it is four moves:
 *
 *   1. RAIN, drawn out of the sky bucket. Rain landing on open water goes
 *      straight into that lake; rain on land is carried by the routing pass.
 *   2. ROUTE. One downstream sweep in topological order. Carry stops at a lake
 *      (deposit), at a live window (hand over), or at the map edge (the sea).
 *   3. SPILL. Lakes resolved from the highest doorstep down, so an upper lake's
 *      overflow reaches a lower one within the same step. Anything above the
 *      doorstep leaves at the outlet and is routed onward the same way.
 *   4. EVAPORATE, off open water only, back into the sky bucket.
 *
 * Every one of those is a MOVE between named buckets. That is why
 * `totalWaterM3` can be asserted flat.
 */
export function stepWaterBudget(b: WaterBudget, dtSeconds: number): WaterBudgetStep {
  const dt = Math.max(0, dtSeconds);
  const out: WaterBudgetStep = {
    rainM3: 0,
    evaporatedM3: 0,
    lakeOutflowM3: 0,
    toSeaM3: 0,
    toWindowsM3: 0,
  };
  if (dt === 0) return out;

  const total = b.cols * b.rows;
  const perCellRainM3 = b.climate.precipMPerSec * dt * b.cellAreaM2;
  const landCells = total - b.lakeIdByCell.size;
  const lakeCells = b.lakeIdByCell.size;
  const wantedM3 =
    perCellRainM3 * (landCells * b.climate.runoffFraction + lakeCells);
  // A sky bucket that cannot pay scales every drop down together, so a dry sky
  // starves the whole map evenly instead of the first cells in index order.
  const payable = Math.min(wantedM3, Math.max(0, b.skyM3));
  const scale = wantedM3 > 0 ? payable / wantedM3 : 0;
  b.rainShortfallM3 = wantedM3 - payable;
  b.skyM3 -= payable;
  out.rainM3 = payable;

  // ---- 2. route land rain downstream ------------------------------------
  const carry = new Float64Array(total);
  const throughM3 = new Float64Array(total);
  for (let i = 0; i < total; i++) {
    if (b.lakeIdByCell.has(i)) continue;
    carry[i] = perCellRainM3 * b.climate.runoffFraction * scale;
  }
  // Rain that fell directly on open water never becomes runoff.
  for (const lake of b.lakes) {
    lake.storedM3 += perCellRainM3 * scale * lake.cells.length;
  }
  // A window's own returned water rejoins here, one step behind — the seam is
  // explicit rather than hidden inside the sweep.
  for (const w of b.windows) {
    if (w.returnM3 <= 0) continue;
    if (w.outletCell >= 0) carry[w.outletCell] += w.returnM3;
    else {
      b.seaM3 += w.returnM3;
      out.toSeaM3 += w.returnM3;
    }
    w.returnM3 = 0;
  }
  routeCarry(b, carry, throughM3, out);

  // ---- 3. lakes spill over their doorsteps ------------------------------
  const byDoorstep = [...b.lakes].sort((x, y) => y.doorstepM - x.doorstepM);
  const spill = new Float64Array(total); // one scratch buffer, reused per lake
  for (const lake of byDoorstep) {
    const excess = lake.storedM3 - lake.capacityM3;
    if (excess <= 0) {
      lake.outflowM3s = 0;
      continue;
    }
    lake.storedM3 = lake.capacityM3;
    lake.outflowM3s = excess / dt;
    out.lakeOutflowM3 += excess;
    if (lake.outletCell >= 0) {
      spill[lake.outletCell] = excess;
      routeCarry(b, spill, throughM3, out);
    } else {
      b.seaM3 += excess;
      out.toSeaM3 += excess;
    }
  }

  // ---- 4. the sun takes its share --------------------------------------
  for (const lake of b.lakes) {
    if (lake.storedM3 <= 0) continue;
    const lifted = Math.min(
      lake.storedM3,
      b.climate.evapMPerSec * dt * wetAreaM2(lake, b),
    );
    lake.storedM3 -= lifted;
    b.skyM3 += lifted;
    out.evaporatedM3 += lifted;
  }

  for (const reach of b.reaches) reach.flowM3s = throughM3[reach.mouthCell] / dt;
  return out;
}

/**
 * The area the sun can actually reach.
 *
 * A half-empty basin does not evaporate at its full footprint: only the cells
 * genuinely under water count. Using the basin footprint instead made a
 * shrinking lake evaporate FASTER as it dried, which is backwards and would
 * have emptied every pond in the world.
 */
function wetAreaM2(lake: LakeBody, b: WaterBudget): number {
  const level = lakeLevelM(lake, b.cellAreaM2);
  let wet = 0;
  for (const bed of lake.sortedBedM) {
    if (bed >= level) break;
    wet++;
  }
  return wet * b.cellAreaM2;
}

/**
 * One downstream sweep. `carry` is consumed; `throughM3` accumulates what
 * passed each cell, which is what a reach's discharge is read from.
 */
function routeCarry(
  b: WaterBudget,
  carry: Float64Array,
  throughM3: Float64Array,
  out: WaterBudgetStep,
): void {
  for (const i of b.topoOrder) {
    const v = carry[i];
    if (v <= 0) continue;
    carry[i] = 0;
    const lakeId = b.lakeIdByCell.get(i);
    if (lakeId !== undefined) {
      b.lakes[lakeId].storedM3 += v;
      continue;
    }
    const window = b.windows.find((w) => w.cells.has(i));
    if (window) {
      window.transitM3 += v;
      out.toWindowsM3 += v;
      continue;
    }
    throughM3[i] += v;
    const r = b.receiver[i];
    if (r < 0) {
      b.seaM3 += v;
      out.toSeaM3 += v;
      continue;
    }
    carry[r] += v;
  }
}
