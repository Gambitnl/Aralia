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
import type { BuildingType, Cell } from './blueprintTypes';
import { rngFromPath, streamPath, type SeedPath } from '../seedPath';
import type { SeededRandom } from '../../../utils/random/seededRandom';

export interface Footprint {
  cols: number;
  rows: number;
  /** occ[y][x], row-major over the normalized bounding box. */
  occ: boolean[][];
  cells: Cell[];
}

/** Axis-aligned rectangle in (possibly negative) cell coords, pre-normalize. */
interface Rect { x: number; y: number; w: number; h: number; }

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

const MAX_SHAPE_ATTEMPTS = 16;

/**
 * Generate an irregular footprint for a building. Deterministic: all
 * randomness derives from the 'footprint' stream of the given seed path.
 */
export function genFootprint(path: SeedPath, type: BuildingType): Footprint {
  const rng = rngFromPath(streamPath(path, 'footprint'));
  const cfg = TYPE_CONFIG[type];

  const main: Rect = {
    x: 0,
    y: 0,
    w: rollInt(rng, cfg.mainW[0], cfg.mainW[1]),
    h: rollInt(rng, cfg.mainH[0], cfg.mainH[1]),
  };

  const rects: Rect[] = [main];
  const wingCount = rollInt(rng, cfg.wings[0], cfg.wings[1]);
  for (let i = 0; i < wingCount; i++) rects.push(rollWing(rng, main));
  if (cfg.tower && rng.next() < 0.75) rects.push(rollTower(rng, main));

  // Shape guarantee: never a bare rectangle. If nothing rolled (or the rolls
  // happened to fill the bounding box back in), force wings until broken.
  let attempts = 0;
  while (isBareRectangle(rects)) {
    if (attempts++ >= MAX_SHAPE_ATTEMPTS) {
      throw new Error(`genFootprint: could not break rectangle for ${type} at ${path}`);
    }
    rects.push(rollWing(rng, main));
  }

  // Rasterize + normalize so the min occupied cell is (0,0).
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
  return { cols, rows, occ, cells };
}
