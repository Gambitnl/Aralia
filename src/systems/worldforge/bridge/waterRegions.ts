/**
 * @file waterRegions.ts
 * @description Group a ground grid's water cells into BODIES, and give each body
 * one flat surface level.
 *
 * Why this exists: the open world marks water only as a biome tint on the
 * terrain, so a lake is blue ground rather than a surface. An in-game look at
 * burg Hajdured photographed a sea-sized expanse that raycasts proved was
 * terrain — no water mesh anywhere in the frame. Laying real sheets needs two
 * things this file provides: which cells belong to the same body, and what one
 * height that body sits at.
 *
 * Levels are resolved HERE, over the whole grid, rather than per chunk. A body
 * that spans several chunks must get the same level in each of them or the
 * surface steps at every chunk seam.
 *
 * Pure and deterministic: same grid in, identical regions out, in a stable order.
 */

/** One connected body of water and the flat height its surface sits at. */
export interface WaterRegion {
  /** Cell indices (row * cols + col) that belong to this body. */
  cells: number[];
  /** Flat surface height for the whole body, in ENCODED grid units (0..100). */
  surfaceEnc: number;
  /** Lowest surrounding land height in encoded units — the body's rim. */
  shoreEnc: number;
}

export interface FindWaterRegionsInput {
  cols: number;
  rows: number;
  /** Per-cell biome id; 'water' and 'ocean' are the wet ones. */
  biomeIds: readonly string[];
  /** Per-cell encoded terrain height (0..100). */
  heights: readonly number[];
  /** How far below its rim a surface sits, in encoded units. */
  surfaceDropEnc: number;
}

const isWet = (biome: string | undefined): boolean => biome === 'water' || biome === 'ocean';

/**
 * Cells covered by a watercourse of the given width, following a centerline.
 *
 * A town's river is AUTHORED — the atlas knows where it runs, and the 2D map
 * draws it there. Terrain flow-accumulation alone will not find it inside a
 * small, flat town window: switching to hydrology-only left Hajdured with
 * ponds and no river at all. So the COURSE comes from the authored line here,
 * while the HEIGHT still comes from the land (see `waterLevelsByCell`).
 *
 * Walks each segment in half-cell steps so no cell is skipped on a diagonal.
 */
export function rasterizeChannel(
  centerline: ReadonlyArray<{ x: number; z: number }>,
  halfWidthM: number,
  cols: number,
  rows: number,
  metersPerCell: number,
): Set<number> {
  const cells = new Set<number>();
  if (centerline.length === 0) return cells;
  const radiusCells = Math.max(0, Math.round(halfWidthM / metersPerCell));

  const stamp = (xM: number, zM: number) => {
    const col0 = Math.round(xM / metersPerCell);
    const row0 = Math.round(zM / metersPerCell);
    for (let dr = -radiusCells; dr <= radiusCells; dr++) {
      for (let dc = -radiusCells; dc <= radiusCells; dc++) {
        // Round brush: a square one leaves visibly boxy banks.
        if (dc * dc + dr * dr > radiusCells * radiusCells + 0.5) continue;
        const c = col0 + dc;
        const r = row0 + dr;
        if (c < 0 || c >= cols || r < 0 || r >= rows) continue;
        cells.add(r * cols + c);
      }
    }
  };

  if (centerline.length === 1) {
    stamp(centerline[0].x, centerline[0].z);
    return cells;
  }
  for (let i = 0; i < centerline.length - 1; i++) {
    const a = centerline[i];
    const b = centerline[i + 1];
    const dist = Math.hypot(b.x - a.x, b.z - a.z);
    const steps = Math.max(1, Math.ceil((dist / metersPerCell) * 2));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      stamp(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t);
    }
  }
  return cells;
}

/**
 * A surface height for EVERY wet cell, taken from the bank beside it.
 *
 * One flat level per body is right for a lake and wrong for a river. A river
 * descends, so a body's lowest rim is downstream — and giving the whole body
 * that single level sank the river under the hillside everywhere upstream.
 * Measured in-game 2026-07-28: all 8 sheets pinned at y=2.03 with ground from
 * 4.82 to 15.04 above them, up to 13 m of rock over the water.
 *
 * So each wet cell takes the LOWEST land height touching it, minus the drop.
 * That follows a valley down naturally, and stays flat across a true lake whose
 * banks all stand at one height. Cells with no land neighbour inherit from wet
 * neighbours that do, spreading inward, so the middle of a wide body still gets
 * a level from its own shore.
 */
export function waterLevelsByCell(input: FindWaterRegionsInput): Map<number, number> {
  const { cols, rows, biomeIds, heights, surfaceDropEnc } = input;
  const level = new Map<number, number>();
  const frontier: number[] = [];

  // Pass 1: cells that touch land read their own bank.
  for (let idx = 0; idx < cols * rows; idx++) {
    if (!isWet(biomeIds[idx])) continue;
    const col = idx % cols;
    const row = (idx - col) / cols;
    let bank = Infinity;
    const neighbours = [
      col > 0 ? idx - 1 : -1,
      col < cols - 1 ? idx + 1 : -1,
      row > 0 ? idx - cols : -1,
      row < rows - 1 ? idx + cols : -1,
    ];
    for (const n of neighbours) {
      if (n < 0 || isWet(biomeIds[n])) continue;
      bank = Math.min(bank, heights[n] ?? 0);
    }
    if (Number.isFinite(bank)) {
      level.set(idx, Math.max(0, bank - surfaceDropEnc));
      frontier.push(idx);
    }
  }

  // Pass 2: fill cells that touch no land at all, from the NEAREST cell that
  // does. Only cells still without a level are filled — a cell that read its
  // own bank in pass 1 keeps it. Letting this wave overwrite lower would drag
  // the whole body down to its lowest point, which is the flattening that put
  // the river under the hill in the first place.
  let wave = frontier;
  while (wave.length > 0) {
    const next: number[] = [];
    for (const idx of wave) {
      const here = level.get(idx)!;
      const col = idx % cols;
      const row = (idx - col) / cols;
      const neighbours = [
        col > 0 ? idx - 1 : -1,
        col < cols - 1 ? idx + 1 : -1,
        row > 0 ? idx - cols : -1,
        row < rows - 1 ? idx + cols : -1,
      ];
      for (const n of neighbours) {
        if (n < 0 || !isWet(biomeIds[n]) || level.has(n)) continue;
        level.set(n, here);
        next.push(n);
      }
    }
    wave = next;
  }

  return level;
}

/** An axis-aligned run of wet cells on one grid row, in ground meters. */
export interface WaterRun {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  /** The body's flat surface height, encoded units. */
  surfaceEnc: number;
}

/**
 * Turn per-cell water levels into rectangles a renderer can emit.
 *
 * Cells merge into a run only while they sit at the SAME height, so a lake
 * becomes long flat strips while a descending river breaks into short steps
 * that follow it down. Merging across differing levels would flatten the river
 * again — the exact mistake that buried it.
 */
export function waterRunsFromLevels(
  water: ReadonlyMap<number, number>,
  cols: number,
  metersPerCell: number,
): WaterRun[] {
  const byRow = new Map<number, number[]>();
  for (const idx of water.keys()) {
    const col = idx % cols;
    const row = (idx - col) / cols;
    const list = byRow.get(row);
    if (list) list.push(col);
    else byRow.set(row, [col]);
  }

  const runs: WaterRun[] = [];
  const sameLevel = (a: number, b: number) => Math.abs(a - b) < 1e-6;

  for (const row of [...byRow.keys()].sort((a, b) => a - b)) {
    const colsInRow = byRow.get(row)!.sort((a, b) => a - b);
    let start = colsInRow[0];
    let prev = start;
    let level = water.get(row * cols + start)!;
    const flush = (endCol: number) => {
      runs.push({
        minX: start * metersPerCell,
        maxX: (endCol + 1) * metersPerCell,
        minZ: row * metersPerCell,
        maxZ: (row + 1) * metersPerCell,
        surfaceEnc: level,
      });
    };
    for (let i = 1; i < colsInRow.length; i++) {
      const col = colsInRow[i];
      const here = water.get(row * cols + col)!;
      if (col !== prev + 1 || !sameLevel(here, level)) {
        flush(prev);
        start = col;
        level = here;
      }
      prev = col;
    }
    flush(prev);
  }
  return runs;
}

/**
 * Turn regions into rectangles a renderer can emit, merging each row's
 * contiguous cells into ONE run.
 *
 * A cell is 1.524 m, so a modest lake is thousands of cells; emitting a quad
 * apiece would bury the chunk payload in polygons that share an edge and a
 * height. Row runs keep the exact same silhouette at a fraction of the count.
 */
export function waterRunsForRegion(
  region: WaterRegion,
  cols: number,
  metersPerCell: number,
): WaterRun[] {
  const byRow = new Map<number, number[]>();
  for (const idx of region.cells) {
    const col = idx % cols;
    const row = (idx - col) / cols;
    const list = byRow.get(row);
    if (list) list.push(col);
    else byRow.set(row, [col]);
  }

  const runs: WaterRun[] = [];
  // Sorted row order keeps output stable for the same region.
  for (const row of [...byRow.keys()].sort((a, b) => a - b)) {
    const colsInRow = byRow.get(row)!.sort((a, b) => a - b);
    let start = colsInRow[0];
    let prev = start;
    const flush = (endCol: number) => {
      runs.push({
        minX: start * metersPerCell,
        maxX: (endCol + 1) * metersPerCell,
        minZ: row * metersPerCell,
        maxZ: (row + 1) * metersPerCell,
        surfaceEnc: region.surfaceEnc,
      });
    };
    for (let i = 1; i < colsInRow.length; i++) {
      const col = colsInRow[i];
      if (col !== prev + 1) {
        flush(prev);
        start = col;
      }
      prev = col;
    }
    flush(prev);
  }
  return runs;
}

/**
 * Find every connected body of water and the level its surface sits at.
 *
 * Connectivity is 4-way on purpose: two ponds touching only at a corner are two
 * ponds, and joining them would force one flat level across a diagonal ridge.
 *
 * A body's level comes from the LOWEST land cell around its rim, minus the
 * surface drop — the point where it would spill. Taking the water cells' own
 * heights instead would put the surface at the bed, and taking the highest rim
 * cell would let it flood over the low side.
 */
export function findWaterRegions(input: FindWaterRegionsInput): WaterRegion[] {
  const { cols, rows, biomeIds, heights, surfaceDropEnc } = input;
  const total = cols * rows;
  const seen = new Uint8Array(total);
  const regions: WaterRegion[] = [];

  for (let start = 0; start < total; start++) {
    if (seen[start] || !isWet(biomeIds[start])) continue;

    // Flood fill this body. An explicit stack keeps a lake the size of a chunk
    // grid from blowing the call stack.
    const cells: number[] = [];
    let shoreEnc = Infinity;
    let highestWaterEnc = 0;
    const stack = [start];
    seen[start] = 1;

    while (stack.length > 0) {
      const idx = stack.pop()!;
      cells.push(idx);
      highestWaterEnc = Math.max(highestWaterEnc, heights[idx] ?? 0);

      const col = idx % cols;
      const row = (idx - col) / cols;
      const neighbours = [
        col > 0 ? idx - 1 : -1,
        col < cols - 1 ? idx + 1 : -1,
        row > 0 ? idx - cols : -1,
        row < rows - 1 ? idx + cols : -1,
      ];
      for (const n of neighbours) {
        if (n < 0) continue;
        if (isWet(biomeIds[n])) {
          if (!seen[n]) {
            seen[n] = 1;
            stack.push(n);
          }
        } else {
          // Land neighbour — part of this body's rim.
          shoreEnc = Math.min(shoreEnc, heights[n] ?? 0);
        }
      }
    }

    // A body with no land around it (it reaches every edge of the grid) has no
    // rim to read, so fall back to its own highest cell.
    const rim = Number.isFinite(shoreEnc) ? shoreEnc : highestWaterEnc;
    cells.sort((a, b) => a - b); // stable output regardless of fill order
    regions.push({
      cells,
      shoreEnc: rim,
      surfaceEnc: Math.max(0, rim - surfaceDropEnc),
    });
  }

  return regions;
}
