/**
 * @file granularSettle.ts — loose ground finds its own angle of repose.
 *
 * WHY THIS EXISTS
 *
 * A voxel carve removes matter perfectly. Perfect removal leaves a sculpted
 * cliff: bore a shaft into soil and the wall stands at ninety degrees forever,
 * which is the most CNC-looking thing a dig can do. Teardown's rubble slides,
 * piles and buries the floor it lands on; ours did not move at all.
 *
 * The registry already knew the answer — every substance carries
 * `angleOfReposeDeg`, and the comment on it has said "this is what stops a dug
 * pit in sand from keeping the sheer walls a voxel edit would give it" since the
 * file was written. Nothing read it. This file reads it.
 *
 * WHAT IT IS: AN AVALANCHE, NOT A DIFFUSION
 *
 * The first version of this solver was a shallow-water-shaped relaxation: every
 * column shipped a capped fraction of its overhang to its eight neighbours, and
 * the field converged on the repose angle over many sweeps. It converged
 * correctly and it was USELESS, because diffusion needs O(L²) sweeps to move
 * material L cells: measured on the live page at 25 cm cells, a 1.5 m bore was
 * still churning after two minutes and never reached its own sweep ceiling. A
 * slump that takes minutes is not a slump.
 *
 * Real loose material does not diffuse. A clod that comes off a wall rolls to
 * the bottom in one motion. So a cell here is lifted off an unstable column and
 * WALKED downhill — steepest descent, hop by hop — until it reaches a column
 * where the substance's own repose angle says it can rest, and it is set down
 * there. One cell, one whole journey, one pass. The same bore now settles in
 * about fifteen slices instead of twelve hundred sweeps.
 *
 * FOUR RULES, EACH ONE LOAD-BEARING
 *
 * 1. MATTER IS CONSERVED IN CELL COUNT, EXACTLY, AND BY CONSTRUCTION. Lifting
 *    and setting down are one operation on one cell: the removal and the deposit
 *    happen in the same statement, carrying the same material byte. There is no
 *    in-flight term to leak, no float height field to round, and nothing to
 *    reconcile. Total cells before equals total cells after, per substance, and
 *    the moved volume is `moved * cellM³` — printed, not estimated.
 *
 * 2. ROCK DOES NOT FLOW. A column may only shed while its exposed cell is a
 *    granular substance soft enough to move (`LOOSE_MAX_HARDNESS`). A granite
 *    overhang stays an overhang; a soil overhang slumps. Hardpan, permafrost,
 *    turf and ice are all `solid` and immobile for the same reason. Immobile
 *    columns can still RECEIVE — soil slides onto a granite floor and piles
 *    there, which is what a real quarry floor looks like.
 *
 * 3. EVERY MOVE STRICTLY LOWERS THE PILE, SO IT CANNOT CYCLE. A cell is only
 *    set down at least two cells below where it was lifted from, which means the
 *    sum of squared column heights strictly decreases on every single move. That
 *    is the termination proof, and it is why no cap on the flux is needed: two
 *    cells cannot swap forever because a swap would have to raise the sum. (The
 *    shallow-water field had to learn this the hard way, with a checkerboard.)
 *
 * 4. THE GRID'S OWN STAIRCASE IS NOT A CLIFF. Whole cells cannot draw a
 *    35-degree slope except as a staircase, so a naive criterion would quietly
 *    sand every natural hillside inside the window into a ramp — at 25 cm cells
 *    a single one-cell step already reads as 45 degrees. A column therefore only
 *    sheds when it overhangs its repose slope by more than a whole cell, which
 *    no staircase ever does and every carved wall does immediately. Material
 *    still comes to rest at the TRUE angle, because the walk's stopping rule has
 *    no such slack — the threshold gates starting, not resting.
 *
 * A CELL IS NOT A CUBE ANY MORE, AND THE ANGLE IS AN ANGLE IN THE WORLD
 *
 * Column tops are cell INDICES and neighbour distances are cell COUNTS, so
 * `h[i] - h[j] > tan(repose) * dist` is only the repose angle while one cell is
 * as tall as it is wide. The combat arena's cells are 0.469 m across and 0.15 m
 * tall — a ratio of 3.13 — and read raw, that criterion calls a 17-degree slope
 * a 45-degree cliff and sands the whole board flat inside the settling window.
 * So the metre-slope is converted into cells-per-horizontal-cell once, by
 * `cellM / cellHM`, and everything downstream compares cells against cells.
 * `cellHM` defaults to `cellM`, so a cubic volume is arithmetically identical
 * and the sandbox's call site never learns this happened.
 *
 * AND A BUBBLE HAS A FLOOR THAT IS NOT ITS GROUND
 *
 * The live World3D bubble is a 64 m cube of matter with the terrain surface
 * running through its middle, and on steep ground a column near its edge can be
 * EMPTY — the land there is below the cube. Left alone the walk would happily
 * roll a clod thirty metres down into that hole, out of the ~30 cm lid the
 * bubble draws and under the heightfield, where it is matter nobody can ever
 * see again. `floorCell` is the bound: a column whose top is below it is out of
 * the field entirely — nothing sheds from it, nothing lands in it — so material
 * comes to rest at the last column above the bound instead of vanishing over
 * the edge. `-1` (the default) can never bite, because an empty column is -1.
 */
import { BRICK, Material, VoxelVolume } from './voxelVolume';
import { SUBSTANCES, substance } from './materials';

/**
 * Hardness above which a substance never flows, however granular it is.
 *
 * Gravel (0.25) is the hardest thing that still slides; hardpan (0.45) is
 * cemented and permafrost (0.50) is frozen, and both are `solid` anyway. The
 * gate is on hardness rather than on the state alone so that a granular
 * substance added to the registry with rock-class hardness gets the rock answer
 * for free — the same total-over-the-enum discipline the registry keeps.
 */
export const LOOSE_MAX_HARDNESS = 0.3;

/** Does this substance slide when it is left standing too steep? */
export function isLooseMaterial(m: Material): boolean {
  const s = substance(m);
  return s.state === 'granular' && s.hardness <= LOOSE_MAX_HARDNESS;
}

/**
 * tan(angle of repose) per material, or 0 for anything that does not flow.
 *
 * A table rather than a call, because the walk asks for it once per hop and
 * `Math.tan` of the same eighteen values is not work worth repeating.
 */
const REPOSE_TAN: Float64Array = (() => {
  const t = new Float64Array(32);
  for (const key of Object.keys(SUBSTANCES)) {
    const m = Number(key) as Material;
    const s = SUBSTANCES[m];
    t[m] = isLooseMaterial(m) ? Math.tan((s.angleOfReposeDeg * Math.PI) / 180) : 0;
  }
  return t;
})();

/**
 * How far a column must overhang its repose slope, in cells, before it sheds.
 * See rule 4 above: below one whole cell the criterion cannot tell a carved
 * wall from the grid's own staircase.
 */
export const ACTIVATION_EXCESS_CELLS = 1;

/** How far a single cell may walk before it is set down regardless. */
const MAX_HOPS = 64;

/** How deep below the exposed cell the loose-cap scan looks. */
const MAX_LOOSE_DEPTH_CELLS = 96;

/** Flattest repose the padding has to plan a runout for (about 27 degrees). */
const FLATTEST_SLOPE = 0.5;

/** Padding floor around an edit, in cells. */
const MIN_PAD_CELLS = 6;

/** Padding ceiling, so one deep shaft cannot arm a whole bubble. */
const MAX_PAD_CELLS = 48;

/**
 * Cells a slice may move: a floor, plus a share of the columns still waiting.
 *
 * The share is what paces the motion. A big collapse has a long queue and moves
 * proportionally more per frame, so it finishes in about the same number of
 * slices as a small one — roughly fifteen to twenty-five, which at sixty frames
 * a second is the few hundred milliseconds a slump should take to watch.
 */
const CELLS_PER_STEP_MIN = 24;
const CELLS_PER_STEP_SHARE = 1 / 6;
/**
 * And a ceiling, so the FIRST slice cannot be the whole slump.
 *
 * The share is taken against the seed queue, which on real terrain is every
 * column the carve destabilized at once — a share of that is a slice large
 * enough to be felt. The ceiling costs nothing when the work is small and caps
 * the worst frame when it is not.
 */
const CELLS_PER_STEP_MAX = 192;

/** Milliseconds one `settleStep` may spend. Far under the 40 ms remesh slice. */
export const DEFAULT_BUDGET_MS = 4;

/** Eight neighbours. A diagonal is a longer run, so it holds a taller step. */
const NB_DX = [1, -1, 0, 0, 1, 1, -1, -1] as const;
const NB_DZ = [0, 0, 1, -1, 1, -1, 1, -1] as const;
const SQ2 = Math.SQRT2;
const NB_DIST = [1, 1, 1, 1, SQ2, SQ2, SQ2, SQ2] as const;

/** Inclusive cell bounds of an edit — the shape `applyBrush` already returns. */
export interface SettleRegion {
  min: readonly [number, number, number];
  max: readonly [number, number, number];
}

export interface SettleOptions {
  /** Override the per-slice cell budget. Tests use it; frames should not. */
  cellsPerStep?: number;
  budgetMs?: number;
}

/** What the volume's own geometry tells the solver. See the file header. */
export interface SettleSetup {
  /**
   * Height of one cell, meters, when the lattice is not cubic. Defaults to
   * `cellM`, which is what every cubic caller means and costs them nothing.
   */
  cellHM?: number;
  /**
   * Lowest cell ROW material may come to rest on.
   *
   * Columns whose top is below it are out of the field: not seeded, never
   * walked into. `-1` — the default — cannot bite, because the lowest a column
   * top can read is -1 for an empty one.
   */
  floorCell?: number;
}

/**
 * The slump, as plain arrays.
 *
 * Per-column arrays are indexed `(z - z0) * w + (x - x0)` over the padded
 * window. Nothing here is a class with behavior; `settleStep` is the only thing
 * that touches it and the hot loop fits on one screen.
 */
export interface SettleField {
  readonly volume: VoxelVolume;
  readonly cellM: number;
  /** Height of one cell, meters. Equal to `cellM` on a cubic volume. */
  readonly cellHM: number;
  /**
   * Vertical cells per horizontal cell — `cellM / cellHM`.
   *
   * The one number that turns a repose angle in the WORLD into the comparison
   * this solver makes between cell indices. 1 on a cubic lattice.
   */
  readonly slopeScale: number;
  readonly x0: number;
  readonly z0: number;
  readonly w: number;
  readonly d: number;
  /** Topmost non-air cell per column, or -1 for an empty column. */
  readonly h: Int32Array;
  /** Top cell that is NOT loose. Cells above it, up to `h`, may move. */
  readonly bedrock: Int32Array;
  /** Columns waiting to be re-checked, oldest first. */
  queue: Int32Array;
  qHead: number;
  qTail: number;
  /** 1 while a column sits in the queue, so it is never queued twice. */
  readonly queued: Uint8Array;
  /** 1 where the floor bound put this column out of the field. */
  readonly blocked: Uint8Array;
  readonly floorCell: number;
  /** Columns the floor bound excluded when the window was scanned. */
  readonly blockedColumns: number;
  /** Downhill hops the floor bound refused. Where the bound BITES. */
  boundStops: number;
  /** Cells lifted and set down. One number, because it is one operation. */
  moved: number;
  steps: number;
  done: boolean;
}

/** What one time slice did. */
export interface SettleStepResult {
  done: boolean;
  /** Cells moved so far. Removal and deposit are one operation — see rule 1. */
  moved: number;
  /** Columns still waiting to be re-checked. */
  waiting: number;
  /** Did this slice write any voxel? */
  changed: boolean;
  /** Inclusive cell bounds written this slice; `max[0] < min[0]` when none. */
  min: [number, number, number];
  max: [number, number, number];
  ms: number;
}

/** Cubic meters of matter that has moved so far. */
export function movedVolumeM3(f: SettleField): number {
  return f.moved * f.cellM * f.cellM * f.cellHM;
}

/**
 * Topmost non-air cell in a column, using the brick headers to skip air.
 *
 * The plain cell-by-cell scan `voxelBrush.topSolidCell` runs is fine for a
 * handful of columns and far too slow for a settling window: at 240 cells per
 * edge it is 240 reads per column and a 120 x 120 window is three and a half
 * million of them before the first slice. A brick that is uniform air answers
 * for eight cells at once, and a bubble is mostly uniform air above the ground.
 */
function topSolidFast(vol: VoxelVolume, x: number, z: number): number {
  const bx = Math.floor(x / BRICK);
  const bz = Math.floor(z / BRICK);
  /* `bricksY` / `cellsY`, not `bricks` / `cells`. The volume stopped being a
   * cube when the land got a width and a height of its own, and starting this
   * scan at the horizontal brick count walks rows that do not exist — harmless
   * on a slab, where the extra rows read as Air, and a MISSED SURFACE on
   * anything taller than it is wide. */
  for (let by = vol.bricksY - 1; by >= 0; by--) {
    const bm = vol.brickMaterial(bx, by, bz);
    if (bm === Material.Air) continue;
    const yTop = Math.min(vol.cellsY - 1, by * BRICK + BRICK - 1);
    if (bm !== null) return yTop;
    for (let y = yTop; y >= by * BRICK; y--) {
      if (vol.get(x, y, z) !== Material.Air) return y;
    }
  }
  return -1;
}

/**
 * Where the loose cap of a column ends. Cells above this may move.
 *
 * Air is not loose, so a solid ledge over a void ends the cap at the void: only
 * the contiguous run of movable substance under the exposed cell can slide.
 */
function bedrockBelow(vol: VoxelVolume, x: number, z: number, top: number): number {
  const floor = Math.max(-1, top - MAX_LOOSE_DEPTH_CELLS);
  let y = top;
  while (y > floor && isLooseMaterial(vol.get(x, y, z))) y--;
  return y;
}

/** Push a column onto the re-check queue, once. */
function push(f: SettleField, i: number): void {
  if (i < 0 || i >= f.queued.length || f.queued[i]) return;
  if (f.qTail >= f.queue.length) {
    // Compact, then grow only if compacting did not free anything.
    if (f.qHead > 0) {
      f.queue.copyWithin(0, f.qHead, f.qTail);
      f.qTail -= f.qHead;
      f.qHead = 0;
    }
    if (f.qTail >= f.queue.length) {
      const bigger = new Int32Array(f.queue.length * 2);
      bigger.set(f.queue);
      f.queue = bigger;
    }
  }
  f.queue[f.qTail++] = i;
  f.queued[i] = 1;
}

/**
 * The steepest overhang at a column, and where it points.
 *
 * Returns the neighbour index, or -1 when the column is stable, cannot flow, or
 * has nothing loose left to give. `slopeCells` is the sliding material's own
 * repose expressed in VERTICAL CELLS per horizontal cell — it is the clod that
 * decides how far it can rest, and it decides in the world's units, not the
 * lattice's.
 */
function worstNeighbour(f: SettleField, i: number, slopeCells: number): number {
  const { w, d, h, blocked } = f;
  const x = i % w;
  const z = (i / w) | 0;
  let best = -1;
  let bestExcess = ACTIVATION_EXCESS_CELLS;
  for (let k = 0; k < 8; k++) {
    const nx = x + NB_DX[k];
    const nz = z + NB_DZ[k];
    if (nx < 0 || nz < 0 || nx >= w || nz >= d) continue;
    const j = nz * w + nx;
    const excess = h[i] - h[j] - slopeCells * NB_DIST[k];
    if (excess < bestExcess) continue;
    // Below the floor bound. The clod stops here rather than leaving the world.
    if (blocked[j]) {
      f.boundStops++;
      continue;
    }
    bestExcess = excess;
    best = j;
  }
  return best;
}

/** The next hop of a sliding cell, or -1 when it has found its rest. */
function nextHop(f: SettleField, i: number, slopeCells: number): number {
  const { w, d, h, blocked } = f;
  const x = i % w;
  const z = (i / w) | 0;
  let best = -1;
  let bestExcess = 0;
  for (let k = 0; k < 8; k++) {
    const nx = x + NB_DX[k];
    const nz = z + NB_DZ[k];
    if (nx < 0 || nz < 0 || nx >= w || nz >= d) continue;
    const j = nz * w + nx;
    const excess = h[i] - h[j] - slopeCells * NB_DIST[k];
    if (excess <= bestExcess) continue;
    if (blocked[j]) {
      f.boundStops++;
      continue;
    }
    bestExcess = excess;
    best = j;
  }
  return best;
}

/**
 * Build the slump for one edit, or return null when nothing can move.
 *
 * Null is the common case and the cheap one: a bore in granite finds no
 * unstable loose column, so the caller pays one window scan and no frames.
 */
export function beginSettle(
  volume: VoxelVolume,
  region: SettleRegion,
  cellM: number,
  setup: SettleSetup = {},
): SettleField | null {
  const n = volume.cells;
  const cellHM = setup.cellHM ?? cellM;
  const slopeScale = cellM / cellHM;
  const floorCell = setup.floorCell ?? -1;
  /* Pad for the RUNOUT, not just for the edit. Material shed from a wall of
   * depth D travels about D / tan(repose) cells before it comes to rest, so a
   * fixed pad would dam a deep bore behind an invisible wall at the window
   * edge. The flattest substance in the registry sets the multiplier.
   *
   * The runout is a distance in METERS on both axes, so a lattice whose cells
   * are three times shorter than they are wide has three times as many vertical
   * cells for the same wall — and padding on the raw count would arm three
   * times the window a slump can ever reach. `/ slopeScale` is the conversion,
   * and it is 1 on a cube. */
  const depthCells = (region.max[1] - region.min[1] + 1) / slopeScale;
  const pad = Math.min(
    MAX_PAD_CELLS,
    Math.max(MIN_PAD_CELLS, Math.ceil(depthCells / FLATTEST_SLOPE)),
  );
  const x0 = Math.max(0, region.min[0] - pad);
  const x1 = Math.min(n - 1, region.max[0] + pad);
  const z0 = Math.max(0, region.min[2] - pad);
  const z1 = Math.min(n - 1, region.max[2] + pad);
  const w = x1 - x0 + 1;
  const d = z1 - z0 + 1;
  if (w <= 1 || d <= 1) return null;

  const h = new Int32Array(w * d);
  const bedrock = new Int32Array(w * d);
  const blocked = new Uint8Array(w * d);
  let blockedColumns = 0;
  for (let z = 0; z < d; z++) {
    for (let x = 0; x < w; x++) {
      const i = z * w + x;
      const top = topSolidFast(volume, x0 + x, z0 + z);
      h[i] = top;
      bedrock[i] = top < 0 ? -1 : bedrockBelow(volume, x0 + x, z0 + z, top);
      if (top < floorCell) {
        blocked[i] = 1;
        blockedColumns++;
      }
    }
  }

  const f: SettleField = {
    volume, cellM, cellHM, slopeScale, x0, z0, w, d, h, bedrock,
    queue: new Int32Array(Math.max(64, w * d)),
    qHead: 0,
    qTail: 0,
    queued: new Uint8Array(w * d),
    blocked,
    floorCell,
    blockedColumns,
    boundStops: 0,
    moved: 0,
    steps: 0,
    done: false,
  };

  // Seed with every column that is standing too steep for what it is made of.
  for (let i = 0; i < h.length; i++) {
    if (blocked[i] || h[i] <= bedrock[i]) continue;
    const slope = REPOSE_TAN[volume.get(x0 + (i % w), h[i], z0 + ((i / w) | 0))];
    if (slope <= 0) continue;
    if (worstNeighbour(f, i, slope * slopeScale) >= 0) push(f, i);
  }
  /* The seeding scan's own bound hits are KEPT. A column that would have shed
   * toward a below-floor neighbour and was refused is precisely where the bound
   * bites, and it is refused here before it is ever refused in a walk. */
  if (f.qTail === f.qHead) return null;
  return f;
}

/** Bounds accumulator for the voxels a slice writes. */
interface Written {
  minX: number; minY: number; minZ: number;
  maxX: number; maxY: number; maxZ: number;
  any: boolean;
}

function note(wr: Written, x: number, y: number, z: number): void {
  if (x < wr.minX) wr.minX = x;
  if (y < wr.minY) wr.minY = y;
  if (z < wr.minZ) wr.minZ = z;
  if (x > wr.maxX) wr.maxX = x;
  if (y > wr.maxY) wr.maxY = y;
  if (z > wr.maxZ) wr.maxZ = z;
  wr.any = true;
}

/**
 * Advance the slump by one time slice.
 *
 * Bounded twice over: a cell budget that scales with the work left, so the
 * motion is paced and READS as a slump rather than a snap, and a millisecond
 * budget, so a huge collapse on a slow machine yields instead of blocking. The
 * caller re-meshes the returned bounds through the dirty-chunk pump it owns.
 */
export function settleStep(f: SettleField, opts: SettleOptions = {}): SettleStepResult {
  const t0 = performance.now();
  const wr: Written = {
    minX: Infinity, minY: Infinity, minZ: Infinity,
    maxX: -Infinity, maxY: -Infinity, maxZ: -Infinity,
    any: false,
  };
  const { volume, w, x0, z0, h, bedrock, queued, blocked, slopeScale } = f;
  /* The CEILING of the volume, which is not its width.
   *
   * This read `volume.cells` while the volume was always a cube. On a volume
   * TALLER than it is wide the roof test below then refuses every landing above
   * row `cells`, which on a 16 x 48 volume is every landing there is: measured,
   * the slump moved ZERO cells and reported itself done. A wide slab is only
   * saved from the mirror fault by arithmetic — a grain has to fall two rows to
   * be set down, so `dy` cannot reach `cellsY` when `cellsY - 1` is already the
   * highest column — which is luck, not a guarantee, and not something the next
   * edit to the hop rule should have to rediscover. */
  const nY = volume.cellsY;
  const waiting = f.qTail - f.qHead;
  const budgetCells =
    opts.cellsPerStep ??
    Math.min(
      CELLS_PER_STEP_MAX,
      Math.max(CELLS_PER_STEP_MIN, Math.ceil(waiting * CELLS_PER_STEP_SHARE)),
    );
  const budgetMs = opts.budgetMs ?? DEFAULT_BUDGET_MS;

  let spent = 0;
  while (f.qHead < f.qTail && spent < budgetCells) {
    const i = f.queue[f.qHead++];
    queued[i] = 0;

    const sx = x0 + (i % w);
    const sz = z0 + ((i / w) | 0);
    if (blocked[i] || h[i] <= bedrock[i]) continue;
    const m = volume.get(sx, h[i], sz);
    const slope = REPOSE_TAN[m];
    if (slope <= 0) continue;
    /* The repose angle, converted from the world into this lattice ONCE per
     * lifted cell. See the file header: on the arena's 0.469 x 0.15 m cells the
     * raw comparison is wrong by a factor of 3.13 and flattens honest ground. */
    const slopeCells = slope * slopeScale;
    const first = worstNeighbour(f, i, slopeCells);
    if (first < 0) continue;

    /* Walk the cell downhill until the substance's own repose says it can lie
     * still. The start needed a whole cell of overhang (rule 4); the walk does
     * not, so the material comes to rest on the TRUE angle. */
    let at = first;
    for (let hop = 1; hop < MAX_HOPS; hop++) {
      const nxt = nextHop(f, at, slopeCells);
      if (nxt < 0) break;
      at = nxt;
    }

    /* Rule 3, enforced rather than assumed: a cell is only ever set down at
     * least two cells below where it was lifted, so the sum of squared heights
     * strictly falls and the walk cannot become a cycle. */
    if (h[i] - h[at] < 2) continue;
    const dx = x0 + (at % w);
    const dz = z0 + ((at / w) | 0);
    const dy = h[at] + 1;
    // A roof over the landing column: the cell will not fit, so it stays put.
    if (dy >= nY || volume.get(dx, dy, dz) !== Material.Air) continue;

    const sy = h[i];
    volume.set(sx, sy, sz, Material.Air);
    volume.set(dx, dy, dz, m);
    note(wr, sx, sy, sz);
    note(wr, dx, dy, dz);
    h[i] = sy - 1;
    h[at] = dy;

    /* THE CAP CAME OFF A LEDGE, AND `h` MUST NOT LIE ABOUT IT.
     *
     * `h` is "topmost non-air cell", and stepping it down by one is only that
     * while the cell below is solid. A carve that undercuts a column leaves a
     * void with matter over it, and shedding the last of that matter drops `h`
     * onto AIR — the column then reports a surface a cell higher than the one
     * it has. It never bites the column itself, which is finished, and it bites
     * every NEIGHBOUR: one cell of overstated height is exactly the difference
     * between "sheds" and "stable" at the activation threshold, and a wall that
     * should have come down stands there instead. Measured on the arena: a
     * fireball crater came to rest, and a fresh field over the same region
     * immediately found eight unstable columns and moved seventeen more cells.
     *
     * So the column falls to its real top and re-derives its own loose cap. The
     * cost is one brick-skipping scan, in the rare case only. */
    if (h[i] >= 0 && volume.get(sx, h[i], sz) === Material.Air) {
      const t = topSolidFast(volume, sx, sz);
      h[i] = t;
      bedrock[i] = t < 0 ? -1 : bedrockBelow(volume, sx, sz, t);
    }
    f.moved++;
    spent++;

    /* Both columns changed shape, and so did the balance of everything around
     * them. Re-check the pair and their neighbourhoods; a column that is still
     * too steep comes straight back around. */
    push(f, i);
    push(f, at);
    for (let k = 0; k < 8; k++) {
      const ix = (i % w) + NB_DX[k];
      const iz = ((i / w) | 0) + NB_DZ[k];
      if (ix >= 0 && iz >= 0 && ix < w && iz < f.d) push(f, iz * w + ix);
      const ax = (at % w) + NB_DX[k];
      const az = ((at / w) | 0) + NB_DZ[k];
      if (ax >= 0 && az >= 0 && ax < w && az < f.d) push(f, az * w + ax);
    }

    // Every eighth cell, so even the smallest budget honors the clock.
    if ((spent & 7) === 0 && performance.now() - t0 >= budgetMs) break;
  }

  f.steps++;
  if (f.qHead >= f.qTail) f.done = true;

  return {
    done: f.done,
    moved: f.moved,
    waiting: f.qTail - f.qHead,
    changed: wr.any,
    min: [wr.minX, wr.minY, wr.minZ],
    max: [wr.maxX, wr.maxY, wr.maxZ],
    ms: performance.now() - t0,
  };
}

/**
 * Run a slump to completion in one call. For tests and headless callers — never
 * for a frame, which is what `settleStep` is for.
 */
export function settleToRest(
  volume: VoxelVolume,
  region: SettleRegion,
  cellM: number,
  setup: SettleSetup = {},
): SettleStepResult | null {
  const f = beginSettle(volume, region, cellM, setup);
  if (!f) return null;
  let r = settleStep(f, { cellsPerStep: 1 << 20, budgetMs: Infinity });
  let guard = 0;
  while (!r.done && guard++ < 4096) {
    r = settleStep(f, { cellsPerStep: 1 << 20, budgetMs: Infinity });
  }
  return r;
}
