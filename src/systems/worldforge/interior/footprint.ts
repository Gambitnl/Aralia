// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 14/07/2026, 22:01:48
 * Dependents: systems/worldforge/interior/blueprintTypes.ts, systems/worldforge/interior/buildingExtensions.ts, systems/worldforge/interior/buildingHistory.ts, systems/worldforge/interior/generateBuilding.ts, systems/worldforge/interior/partition.ts, systems/worldforge/interior/roofPlan.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file footprint.ts — irregular building footprints on the 5 ft cell grid.
 *
 * Task 2 of the Building Blueprint Pipeline. A footprint is the union of a
 * main rectangle plus 0–4 wings/towers chosen by building type, snapped to
 * whole 5 ft cells. Guarantees pinned by tests:
 *   - deterministic per seed path (all randomness via the 'footprint' stream)
 *   - single 4-connected region (wings overlap the main by one cell)
 *   - never a bare rectangle (a wing is forced when none breaks the shape)
 *   - normalized so the min occupied cell is (0,0)
 *
 * Pure data — no three.js, no rendering concerns.
 */
import type { BuildingLotProfile, BuildingType, Cell } from './blueprintTypes';
import { rngFromPath, streamPath, type SeedPath } from '../seedPath';
import type { SeededRandom } from '../../../utils/random/seededRandom';

export type MassKind = 'main' | 'wing' | 'tower';

export interface FootprintMass {
  kind: MassKind;
  /** Post-normalize cell coords (same frame as Footprint.cells). */
  x: number; y: number; w: number; h: number;
  /** Ordered event that introduced this mass; absent on canonical generation. */
  extensionEventIndex?: number;
}

export interface Footprint {
  cols: number;
  rows: number;
  /** occ[y][x], row-major over the normalized bounding box. */
  occ: boolean[][];
  cells: Cell[];
  /** Exact decomposition, main first. Union of masses === cells. */
  masses: FootprintMass[];
}

/** Axis-aligned rectangle in (possibly negative) cell coords, pre-normalize. */
interface Rect { x: number; y: number; w: number; h: number; }
/** A rect tagged with the kind of mass it contributes (main/wing/tower). */
interface KindedRect extends Rect { kind: MassKind; }

interface TypeConfig {
  /** Main rectangle size ranges (inclusive), in cells. */
  mainW: [number, number];
  mainH: [number, number];
  /** Wing count range (inclusive). */
  wings: [number, number];
  /** Manor-style square corner tower. */
  tower: boolean;
}

const TYPE_CONFIG: Record<BuildingType, TypeConfig> = {
  cottage:  { mainW: [4, 6],  mainH: [3, 5], wings: [0, 1], tower: false },
  shop:     { mainW: [4, 6],  mainH: [4, 6], wings: [1, 1], tower: false },
  workshop: { mainW: [5, 7],  mainH: [4, 6], wings: [1, 1], tower: false },
  tavern:   { mainW: [6, 9],  mainH: [5, 7], wings: [1, 2], tower: false },
  manor:    { mainW: [8, 12], mainH: [6, 9], wings: [0, 2], tower: true },
  // v2 additions
  townhouse:  { mainW: [4, 5],  mainH: [5, 8], wings: [0, 1], tower: false }, // narrow, deep
  tenement:   { mainW: [6, 9],  mainH: [6, 9], wings: [0, 1], tower: false },
  farmstead:  { mainW: [5, 8],  mainH: [4, 6], wings: [1, 2], tower: false },
  smithy:     { mainW: [5, 7],  mainH: [4, 6], wings: [1, 1], tower: false },
  inn:        { mainW: [7, 10], mainH: [6, 8], wings: [1, 2], tower: false },
  storehouse: { mainW: [6, 9],  mainH: [5, 8], wings: [0, 1], tower: false },
  temple:     { mainW: [6, 8],  mainH: [8, 12], wings: [0, 2], tower: true },  // long nave axis
  keep:       { mainW: [7, 10], mainH: [7, 10], wings: [0, 1], tower: true },
  civic:      { mainW: [6, 9],  mainH: [5, 8], wings: [0, 1], tower: false },
};

/** Inclusive-range draw (SeededRandom.nextInt is max-EXCLUSIVE). */
const rollInt = (rng: SeededRandom, min: number, max: number): number =>
  rng.nextInt(min, max + 1);

/**
 * Roll a wing flush against one side of the main rectangle, overlapping it by
 * one cell so the union is 4-connected. The wing's run along the side is at
 * most sideLen - 1 cells, so a single wing always breaks the rectangle.
 */
function rollWing(rng: SeededRandom, main: Rect): Rect {
  const side = rollInt(rng, 0, 3); // 0=N, 1=E, 2=S, 3=W
  const horizontal = side === 0 || side === 2;
  const sideLen = horizontal ? main.w : main.h;
  const run = rollInt(rng, 2, Math.max(2, sideLen - 1));
  const depth = rollInt(rng, 2, 3) + 1; // +1 = the overlap cell into the main
  const offset = rollInt(rng, 0, sideLen - run);
  switch (side) {
    case 0: return { x: main.x + offset, y: main.y - (depth - 1), w: run, h: depth };
    case 2: return { x: main.x + offset, y: main.y + main.h - 1, w: run, h: depth };
    case 1: return { x: main.x + main.w - 1, y: main.y + offset, w: depth, h: run };
    default: return { x: main.x - (depth - 1), y: main.y + offset, w: depth, h: run };
  }
}

/** Roll a square tower on one corner of the main, overlapping it by one cell. */
function rollTower(rng: SeededRandom, main: Rect): Rect {
  const size = rollInt(rng, 2, 3);
  const corner = rollInt(rng, 0, 3); // 0=NW, 1=NE, 2=SE, 3=SW
  const left = corner === 0 || corner === 3;
  const top = corner === 0 || corner === 1;
  return {
    x: left ? main.x - (size - 1) : main.x + main.w - 1,
    y: top ? main.y - (size - 1) : main.y + main.h - 1,
    w: size,
    h: size,
  };
}

/** True when the union of rects exactly fills its bounding box. */
function isBareRectangle(rects: Rect[]): boolean {
  const occupied = occupiedSet(rects);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const key of occupied) {
    const [x, y] = key.split(',').map(Number);
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  return occupied.size === (maxX - minX + 1) * (maxY - minY + 1);
}

function occupiedSet(rects: Rect[]): Set<string> {
  const occupied = new Set<string>();
  for (const r of rects) {
    for (let y = r.y; y < r.y + r.h; y++) {
      for (let x = r.x; x < r.x + r.w; x++) occupied.add(`${x},${y}`);
    }
  }
  return occupied;
}

/** Rasterize an exact mass recipe into the canonical normalized footprint. */
function rasterizeMasses(rects: KindedRect[]): Footprint {
  const occupied = occupiedSet(rects);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const key of occupied) {
    const [x, y] = key.split(',').map(Number);
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  const cols = maxX - minX + 1;
  const rows = maxY - minY + 1;
  const occ: boolean[][] = Array.from({ length: rows }, () =>
    new Array<boolean>(cols).fill(false),
  );
  const cells: Cell[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (occupied.has(`${x + minX},${y + minY}`)) {
        occ[y][x] = true;
        cells.push({ cx: x, cy: y });
      }
    }
  }
  const masses: FootprintMass[] = rects.map((rect) => ({
    kind: rect.kind,
    x: rect.x - minX,
    y: rect.y - minY,
    w: rect.w,
    h: rect.h,
  }));
  return { cols, rows, occ, cells, masses };
}

/**
 * Build directly inside a town-negotiated lot. The street-facing main mass
 * fills the frontage. Returns extend only on their named side, while a rear
 * court keeps both party-wall columns complete and removes only the rear
 * center. Small lots degrade to a full envelope rather than producing a
 * disconnected or one-cell decorative appendage.
 */
export function footprintForLotProfile(
  profile: BuildingLotProfile,
  maxCols: number,
  maxRows: number,
): Footprint {
  const cols = Math.max(1, Math.floor(maxCols));
  const rows = Math.max(1, Math.floor(maxRows));
  const full = (): Footprint => rasterizeMasses([
    { kind: 'main', x: 0, y: 0, w: cols, h: rows },
  ]);
  if (profile === 'full-envelope' || cols < 3 || rows < 3) return full();

  const frontRows = Math.max(2, rows - 2);
  const returnRows = rows - frontRows + 1;
  const returnWidth = Math.max(2, Math.min(cols - 1, Math.ceil(cols * 0.4)));
  const main: KindedRect = { kind: 'main', x: 0, y: 0, w: cols, h: frontRows };
  if (profile === 'left-return') {
    return rasterizeMasses([
      main,
      { kind: 'wing', x: 0, y: frontRows - 1, w: returnWidth, h: returnRows },
    ]);
  }
  if (profile === 'right-return') {
    return rasterizeMasses([
      main,
      {
        kind: 'wing',
        x: cols - returnWidth,
        y: frontRows - 1,
        w: returnWidth,
        h: returnRows,
      },
    ]);
  }
  // A three-cell-wide urban lot can still preserve both shared side runs with
  // one 5 ft rear bay on each side and an open rear-center cell.
  const sideWidth = Math.max(1, Math.min(Math.floor((cols - 1) / 2), returnWidth));
  return rasterizeMasses([
    main,
    { kind: 'wing', x: 0, y: frontRows - 1, w: sideWidth, h: returnRows },
    {
      kind: 'wing',
      x: cols - sideWidth,
      y: frontRows - 1,
      w: sideWidth,
      h: returnRows,
    },
  ]);
}

const MAX_SHAPE_ATTEMPTS = 16;

/**
 * Clamp a footprint into a maxCols × maxRows cell window (lot fit — Task 10 /
 * C3-T2). Cells outside the window anchored at (0,0) are dropped, then only
 * the largest 4-connected component is kept (a crop can sever a wing), and
 * the result is re-normalized so the min occupied cell is (0,0). RNG-free and
 * deterministic; returns the input unchanged when it already fits. The
 * "never a bare rectangle" shape guarantee does NOT survive clamping — a
 * tight lot may legitimately force a plain rectangle.
 */
export function clampFootprint(fp: Footprint, maxCols: number, maxRows: number): Footprint {
  const capC = Math.max(1, Math.floor(maxCols));
  const capR = Math.max(1, Math.floor(maxRows));
  if (fp.cols <= capC && fp.rows <= capR) return fp;

  // Slide the capC × capR window to the offset that keeps the most cells
  // (row-major first on ties). Anchoring at (0,0) can miss every cell when
  // the origin corner of the bounding box is a notch.
  let bestOx = 0, bestOy = 0, bestCount = -1;
  for (let oy = 0; oy <= Math.max(0, fp.rows - capR); oy++) {
    for (let ox = 0; ox <= Math.max(0, fp.cols - capC); ox++) {
      let count = 0;
      for (const c of fp.cells) {
        if (c.cx >= ox && c.cx < ox + capC && c.cy >= oy && c.cy < oy + capR) count++;
      }
      if (count > bestCount) { bestCount = count; bestOx = ox; bestOy = oy; }
    }
  }
  const kept = new Set<string>();
  for (const c of fp.cells) {
    if (c.cx >= bestOx && c.cx < bestOx + capC && c.cy >= bestOy && c.cy < bestOy + capR) {
      kept.add(`${c.cx},${c.cy}`);
    }
  }
  if (kept.size === 0) {
    throw new Error(`clampFootprint: no cells survive a ${capC}x${capR} window`);
  }

  // Largest 4-connected component (row-major first-seed wins ties).
  const seen = new Set<string>();
  let bestComp: Array<[number, number]> = [];
  for (const c of fp.cells) {
    const startKey = `${c.cx},${c.cy}`;
    if (!kept.has(startKey) || seen.has(startKey)) continue;
    const comp: Array<[number, number]> = [];
    const stack: Array<[number, number]> = [[c.cx, c.cy]];
    seen.add(startKey);
    while (stack.length > 0) {
      const [x, y] = stack.pop() as [number, number];
      comp.push([x, y]);
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as Array<[number, number]>) {
        const key = `${nx},${ny}`;
        if (kept.has(key) && !seen.has(key)) {
          seen.add(key);
          stack.push([nx, ny]);
        }
      }
    }
    if (comp.length > bestComp.length) bestComp = comp;
  }

  // Re-normalize to (0,0) and rebuild occ/cells (row-major cell order).
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of bestComp) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  const cols = maxX - minX + 1;
  const rows = maxY - minY + 1;
  const occ: boolean[][] = Array.from({ length: rows }, () =>
    new Array<boolean>(cols).fill(false),
  );
  for (const [x, y] of bestComp) occ[y - minY][x - minX] = true;
  const cells: Cell[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (occ[y][x]) cells.push({ cx: x, cy: y });
    }
  }

  // Transform masses the SAME way as cells: clip each to the kept component's
  // bounding box (the same [minX..maxX] × [minY..maxY] frame the cells were
  // re-normalized into), re-normalize by (minX, minY), and drop any mass that
  // clips away entirely. A very tight lot can slide the window onto a wing and
  // clip the MAIN out completely; the kept component still forms a valid
  // (smaller) building, so rather than reject the lot we promote the largest
  // surviving mass to 'main' — the decomposition MUST lead with a main. The
  // hard contradiction (no cells survive) is already thrown above.
  const keptMasses: FootprintMass[] = [];
  for (const m of fp.masses) {
    const clipX0 = Math.max(m.x, minX);
    const clipY0 = Math.max(m.y, minY);
    const clipX1 = Math.min(m.x + m.w, maxX + 1);
    const clipY1 = Math.min(m.y + m.h, maxY + 1);
    if (clipX1 <= clipX0 || clipY1 <= clipY0) continue; // empty after clip
    keptMasses.push({
      kind: m.kind,
      x: clipX0 - minX,
      y: clipY0 - minY,
      w: clipX1 - clipX0,
      h: clipY1 - clipY0,
    });
  }
  if (keptMasses.length === 0) {
    // Unreachable while kept.size > 0 (the union of masses covers every cell),
    // but guard the invariant that a footprint always has at least a main.
    throw new Error(`clampFootprint: no mass survives a ${capC}x${capR} window`);
  }
  if (!keptMasses.some((m) => m.kind === 'main')) {
    // The main clipped out; hand its role to the largest surviving mass so the
    // decomposition still leads with a main (main-first invariant).
    let biggest = 0;
    for (let i = 1; i < keptMasses.length; i++) {
      if (keptMasses[i].w * keptMasses[i].h > keptMasses[biggest].w * keptMasses[biggest].h) {
        biggest = i;
      }
    }
    keptMasses[biggest].kind = 'main';
  }
  // Main first (matches genFootprint's ordering contract).
  const masses = [
    ...keptMasses.filter((m) => m.kind === 'main'),
    ...keptMasses.filter((m) => m.kind !== 'main'),
  ];
  return { cols, rows, occ, cells, masses };
}

/**
 * Generate an irregular footprint for a building. Deterministic: all
 * randomness derives from the 'footprint' stream of the given seed path.
 */
export function genFootprint(path: SeedPath, type: BuildingType): Footprint {
  const rng = rngFromPath(streamPath(path, 'footprint'));
  const cfg = TYPE_CONFIG[type];

  // ── RNG DRAW-ORDER CONTRACT (do not reorder) ────────────────────────────
  // The draw count is data-dependent, so the ORDER below is a compatibility
  // contract pinned by footprint.golden.test.ts. Reordering, adding, or
  // removing a draw rerolls every footprint in every existing world:
  //   1. main width, then main height            (2 draws, always)
  //   2. wing count, then each wing              (1 + 4 draws per wing)
  //   3. tower probability roll                  (manor only; +2 draws if hit)
  //   4. bare-rectangle repair wings             (0..N extra wings, 4 draws each)
  // ─────────────────────────────────────────────────────────────────────────

  const main: KindedRect = {
    kind: 'main',
    x: 0,
    y: 0,
    w: rollInt(rng, cfg.mainW[0], cfg.mainW[1]),
    h: rollInt(rng, cfg.mainH[0], cfg.mainH[1]),
  };

  // Carry each rect WITH its kind: the roof solver keys off the decomposition
  // (main first). KindedRect extends Rect, so occupiedSet/isBareRectangle read
  // it unchanged — carrying kinds adds ZERO rng draws (the draw-order golden
  // stays byte-stable).
  const rects: KindedRect[] = [main];
  const wingCount = rollInt(rng, cfg.wings[0], cfg.wings[1]);
  for (let i = 0; i < wingCount; i++) rects.push({ kind: 'wing', ...rollWing(rng, main) });
  if (cfg.tower && rng.next() < 0.75) rects.push({ kind: 'tower', ...rollTower(rng, main) });

  // Shape guarantee: never a bare rectangle. If nothing rolled (or the rolls
  // happened to fill the bounding box back in), force wings until broken.
  let attempts = 0;
  while (isBareRectangle(rects)) {
    if (attempts++ >= MAX_SHAPE_ATTEMPTS) {
      throw new Error(`genFootprint: could not break rectangle for ${type} at ${path}`);
    }
    rects.push({ kind: 'wing', ...rollWing(rng, main) });
  }

  return rasterizeMasses(rects);
}
