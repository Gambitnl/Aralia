/**
 * @file partition.ts — split a footprint into rooms on the 5 ft cell grid.
 *
 * Task 3 of the Building Blueprint Pipeline. BSP-splits the footprint's
 * bounding box, clips each leaf to the occupied cells, flood-fills each
 * leaf's occupied region into connected rooms (a leaf spanning a notch
 * yields two rooms), then merges slivers (< 3 cells) into the neighbor
 * they share the most edge with. With `keepMainWhole`, the largest fully
 * occupied rectangle (the main wing) — capped at roughly 30-45% of the
 * total area so it stays dominant without starving the rest of the floor
 * of rooms — is reserved as ONE un-split room so the hall/common-room/nave
 * stays dominant.
 *
 * Deterministic: all randomness derives from the 'partition' stream of the
 * given seed path. Pure data — no three.js, no rendering concerns.
 */
import type { Footprint } from './footprint';
import type { BuildingType } from './blueprintTypes';
import { rngFromPath, streamPath, type SeedPath } from '../seedPath';
import type { SeededRandom } from '../../../utils/random/seededRandom';

interface Rect { x: number; y: number; w: number; h: number; }

const MIN_ROOM_CELLS = 3;

/**
 * Hard per-type ceiling on final room count. Notch-splitting can inflate the
 * BSP's area-based target (17-room manors were observed against a 10-room
 * intent); the merge-down pass in partition() enforces these caps.
 */
const ROOM_CAP: Record<BuildingType, number> = {
  cottage: 5,
  shop: 6,
  workshop: 6,
  tavern: 9,
  manor: 10,
  townhouse: 6,
  tenement: 10,
  farmstead: 6,
  smithy: 5,
  inn: 10,
  storehouse: 4,
  temple: 6,
  keep: 9,
  civic: 7,
};

/** Hard ceiling on room count for a building type (merge-down cap). */
export function roomCapFor(type: BuildingType): number {
  return ROOM_CAP[type];
}

/** Largest axis-aligned rectangle of fully occupied cells (histogram method). */
function maximalRect(fp: Footprint): Rect {
  const heights = new Array<number>(fp.cols).fill(0);
  let best: Rect = { x: 0, y: 0, w: 0, h: 0 };
  let bestArea = 0;
  for (let y = 0; y < fp.rows; y++) {
    for (let x = 0; x < fp.cols; x++) {
      heights[x] = fp.occ[y][x] ? heights[x] + 1 : 0;
    }
    // Largest rectangle in histogram via monotonic stack.
    const stack: number[] = [];
    for (let x = 0; x <= fp.cols; x++) {
      const h = x < fp.cols ? heights[x] : 0;
      while (stack.length > 0 && heights[stack[stack.length - 1]] >= h) {
        const top = stack.pop() as number;
        const height = heights[top];
        const left = stack.length > 0 ? stack[stack.length - 1] + 1 : 0;
        const width = x - left;
        if (height * width > bestArea) {
          bestArea = height * width;
          best = { x: left, y: y - height + 1, w: width, h: height };
        }
      }
      stack.push(x);
    }
  }
  return best;
}

/**
 * BSP: recursively split a rect at a jittered near-middle line until leaves
 * fall under maxLeafArea (or can no longer split at min side 2).
 */
function bspLeaves(rng: SeededRandom, root: Rect, maxLeafArea: number): Rect[] {
  const leaves: Rect[] = [];
  const recurse = (r: Rect): void => {
    const canSplitW = r.w >= 4;
    const canSplitH = r.h >= 4;
    if (r.w * r.h <= maxLeafArea || (!canSplitW && !canSplitH)) {
      leaves.push(r);
      return;
    }
    // Prefer cutting the long axis so rooms stay squarish.
    const vertical = canSplitW && (!canSplitH || r.w >= r.h);
    if (vertical) {
      const cut = rng.nextInt(2, r.w - 1); // max-EXCLUSIVE → cut in [2, w-2]
      recurse({ x: r.x, y: r.y, w: cut, h: r.h });
      recurse({ x: r.x + cut, y: r.y, w: r.w - cut, h: r.h });
    } else {
      const cut = rng.nextInt(2, r.h - 1);
      recurse({ x: r.x, y: r.y, w: r.w, h: cut });
      recurse({ x: r.x, y: r.y + cut, w: r.w, h: r.h - cut });
    }
  };
  recurse(root);
  return leaves;
}

/** Dominant-room area band, as fractions of the total occupied area. */
const MAIN_MAX_FRACTION = 0.45;
const MAIN_MIN_FRACTION = 0.32;

/**
 * Shrink the maximal fully occupied rectangle toward the 30-45% band by
 * trimming one row/column at a time from its longest axis. Never trims
 * below MAIN_MIN_FRACTION (the dominant room must stay >= 30% of area)
 * and never below a 2-cell side. The trimmed edge (near vs far) is picked
 * once from the RNG so main-room placement varies by seed.
 */
function shrinkMainToward(rng: SeededRandom, rect: Rect, total: number): Rect {
  const r = { ...rect };
  // 0 → keep near edge (trim far), 1 → keep far edge (trim near).
  const keepFar = rng.nextInt(0, 2) === 1;
  while (r.w * r.h > MAIN_MAX_FRACTION * total) {
    const trimW = r.w >= r.h;
    const side = trimW ? r.w : r.h;
    if (side <= 2) break;
    const nextArea = trimW ? (r.w - 1) * r.h : r.w * (r.h - 1);
    if (nextArea < MAIN_MIN_FRACTION * total) break;
    if (trimW) {
      r.w -= 1;
      if (keepFar) r.x += 1;
    } else {
      r.h -= 1;
      if (keepFar) r.y += 1;
    }
  }
  return r;
}

/**
 * Partition a footprint into rooms. Returns rg[y][x]: room id per cell,
 * -1 outside the footprint; ids compact from 0.
 *
 * `maxRooms` (optional, additive) is a hard ceiling on the final room count:
 * a merge-down pass folds the smallest room into its longest-shared-edge
 * neighbor until the count fits. Callers with a building type should pass
 * `roomCapFor(type)`.
 */
export function partition(
  path: SeedPath,
  fp: Footprint,
  opts: { keepMainWhole: boolean; maxRooms?: number },
): number[][] {
  const rng = rngFromPath(streamPath(path, 'partition'));
  const total = fp.cells.length;

  const rg: number[][] = Array.from({ length: fp.rows }, () =>
    new Array<number>(fp.cols).fill(-1),
  );

  // Reserved dominant room: the largest fully occupied rectangle, shrunk
  // toward ~30-45% of the total area. Taking the maximal rectangle whole
  // ate 65-75% of the footprint and left too little space for other rooms.
  let main: Rect | null = null;
  const inMain = (x: number, y: number): boolean =>
    main !== null &&
    x >= main.x && x < main.x + main.w &&
    y >= main.y && y < main.y + main.h;
  let nextId = 0;
  if (opts.keepMainWhole) {
    main = shrinkMainToward(rng, maximalRect(fp), total);
    const mainId = nextId++;
    for (let y = main.y; y < main.y + main.h; y++) {
      for (let x = main.x; x < main.x + main.w; x++) rg[y][x] = mainId;
    }
  }

  // Bias the BSP stop by area so big footprints do not shred:
  // small footprints → few rooms, large → still modest (3..10 rooms).
  // maxLeafArea is computed from the UNRESERVED residual area — sizing it
  // from the total starved the residual of leaves once the main room was
  // carved out (buildings landed at 2-3 rooms instead of 3-10).
  const targetRooms = Math.min(9, Math.max(4, Math.round(total / 12)));
  const mainArea = main !== null ? main.w * main.h : 0;
  const residual = total - mainArea;
  const residualRooms = Math.max(2, targetRooms - (main !== null ? 1 : 0));
  const maxLeafArea = Math.max(MIN_ROOM_CELLS + 1, Math.ceil(residual / residualRooms));

  const leaves = bspLeaves(rng, { x: 0, y: 0, w: fp.cols, h: fp.rows }, maxLeafArea);

  // Flood-fill each leaf's occupied, unreserved cells into connected rooms.
  const claimable = (x: number, y: number): boolean =>
    x >= 0 && x < fp.cols && y >= 0 && y < fp.rows &&
    fp.occ[y][x] && rg[y][x] === -1 && !inMain(x, y);
  for (const leaf of leaves) {
    for (let y = leaf.y; y < leaf.y + leaf.h; y++) {
      for (let x = leaf.x; x < leaf.x + leaf.w; x++) {
        if (!claimable(x, y)) continue;
        const id = nextId++;
        const stack: Array<[number, number]> = [[x, y]];
        rg[y][x] = id;
        while (stack.length > 0) {
          const [cx, cy] = stack.pop() as [number, number];
          for (const [nx, ny] of [
            [cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1],
          ] as Array<[number, number]>) {
            if (
              nx >= leaf.x && nx < leaf.x + leaf.w &&
              ny >= leaf.y && ny < leaf.y + leaf.h &&
              claimable(nx, ny)
            ) {
              rg[ny][nx] = id;
              stack.push([nx, ny]);
            }
          }
        }
      }
    }
  }

  mergeSlivers(rg, fp);

  // Guarantee at least MIN_ROOMS rooms: tiny footprints can collapse to two
  // rooms when chained sliver merges inflate one neighbor. Deterministically
  // split the largest splittable room until the floor is met (bounded, in
  // case a split immediately re-merges).
  for (let pass = 0; pass < 8; pass++) {
    const areas = roomAreas(rg, fp);
    if (areas.size >= MIN_ROOMS) break;
    const candidate = [...areas.entries()]
      .filter(([, a]) => a >= 2 * MIN_ROOM_CELLS)
      .sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
    if (!candidate) break;
    // Safe running allocator: new rooms start just past the current max id
    // (the old `nextId += rows * cols` stride relied on an unchecked
    // invariant that a split never creates more components than grid cells).
    const maxId = Math.max(...areas.keys());
    if (!splitRoom(rg, fp, candidate[0], maxId + 1)) break;
    mergeSlivers(rg, fp);
  }

  // Merge-down hard cap: notch-splitting can push the room count well past
  // the BSP target (17-room manors were observed). While over the cap, fold
  // the smallest room into the neighbor it shares the most edge with. Like
  // sliver merging this is intentionally RNG-free — pure geometry with id
  // tie-breaks — so it never disturbs the partition seed stream. The largest
  // room (the reserved main when keepMainWhole) is never the merge SOURCE
  // (we always pick the smallest), so the dominant room's identity survives;
  // it may absorb neighbors, which only strengthens its dominance.
  if (opts.maxRooms !== undefined) {
    const cap = Math.max(MIN_ROOMS, opts.maxRooms);
    for (;;) {
      const areas = roomAreas(rg, fp);
      if (areas.size <= cap) break;
      const [sid] = [...areas.entries()]
        .sort((a, b) => a[1] - b[1] || a[0] - b[0])[0];
      mergeInto(rg, fp, sid);
    }
  }

  // Compact ids to 0..n-1 in first-encounter (row-major) order.
  const remap = new Map<number, number>();
  for (let y = 0; y < fp.rows; y++) {
    for (let x = 0; x < fp.cols; x++) {
      const id = rg[y][x];
      if (id < 0) continue;
      let compact = remap.get(id);
      if (compact === undefined) {
        compact = remap.size;
        remap.set(id, compact);
      }
      rg[y][x] = compact;
    }
  }
  return rg;
}

const MIN_ROOMS = 3;

/** Cell count per room id currently present in rg. */
function roomAreas(rg: number[][], fp: Footprint): Map<number, number> {
  const areas = new Map<number, number>();
  for (let y = 0; y < fp.rows; y++) {
    for (let x = 0; x < fp.cols; x++) {
      const id = rg[y][x];
      if (id >= 0) areas.set(id, (areas.get(id) ?? 0) + 1);
    }
  }
  return areas;
}

/**
 * Split room `id` in two along the longest axis of its bounding box, cutting
 * at the position that best balances the halves while keeping both at or
 * above MIN_ROOM_CELLS. Each half is then re-labeled by connected component
 * (a straight cut through an L-shape can disconnect a half). Returns false
 * if no cut keeps both halves at MIN_ROOM_CELLS. Deterministic — no RNG.
 */
function splitRoom(
  rg: number[][],
  fp: Footprint,
  id: number,
  idBase: number,
): boolean {
  const cells: Array<[number, number]> = [];
  for (let y = 0; y < fp.rows; y++) {
    for (let x = 0; x < fp.cols; x++) {
      if (rg[y][x] === id) cells.push([x, y]);
    }
  }
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of cells) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  const alongX = maxX - minX >= maxY - minY;
  const coord = (c: [number, number]): number => (alongX ? c[0] : c[1]);
  const lo = alongX ? minX : minY;
  const hi = alongX ? maxX : maxY;
  // Pick the cut (first half = coord < cut) balancing the halves best.
  let bestCut = -1;
  let bestSkew = Infinity;
  for (let cut = lo + 1; cut <= hi; cut++) {
    const a = cells.filter((c) => coord(c) < cut).length;
    const b = cells.length - a;
    if (a < MIN_ROOM_CELLS || b < MIN_ROOM_CELLS) continue;
    const skew = Math.abs(a - b);
    if (skew < bestSkew) { bestSkew = skew; bestCut = cut; }
  }
  if (bestCut < 0) return false;
  // Re-label BOTH halves by connected component so each room stays connected.
  for (const [x, y] of cells) rg[y][x] = -2; // pending marker
  const half = (c: [number, number]): number => (coord(c) < bestCut ? 0 : 1);
  let next = idBase;
  for (const [sx, sy] of cells) {
    if (rg[sy][sx] !== -2) continue;
    const which = half([sx, sy]);
    const roomId = next++;
    const stack: Array<[number, number]> = [[sx, sy]];
    rg[sy][sx] = roomId;
    while (stack.length > 0) {
      const [cx, cy] = stack.pop() as [number, number];
      for (const [nx, ny] of [
        [cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1],
      ] as Array<[number, number]>) {
        if (
          nx >= 0 && nx < fp.cols && ny >= 0 && ny < fp.rows &&
          rg[ny][nx] === -2 && half([nx, ny]) === which
        ) {
          rg[ny][nx] = roomId;
          stack.push([nx, ny]);
        }
      }
    }
  }
  return true;
}

/**
 * Merge slivers (< MIN_ROOM_CELLS) into the neighbor sharing the most edge.
 * Iterates until stable; the footprint is 4-connected so every room that is
 * not the sole room has at least one neighbor. Mutates rg in place.
 *
 * Intentionally RNG-free: sliver merging is pure geometry (smallest sliver
 * first, longest shared edge wins, ids break ties) so it never consumes from
 * the partition seed stream and cannot shift later draws.
 */
function mergeSlivers(rg: number[][], fp: Footprint): void {
  for (;;) {
    const areas = new Map<number, number>();
    for (let y = 0; y < fp.rows; y++) {
      for (let x = 0; x < fp.cols; x++) {
        const id = rg[y][x];
        if (id >= 0) areas.set(id, (areas.get(id) ?? 0) + 1);
      }
    }
    if (areas.size <= 1) break;
    const sliver = [...areas.entries()]
      .filter(([, a]) => a < MIN_ROOM_CELLS)
      .sort((a, b) => a[1] - b[1] || a[0] - b[0])[0];
    if (!sliver) break;
    mergeInto(rg, fp, sliver[0]);
  }
}

/**
 * Merge room `sid` into the neighbor it shares the most edge with (lowest id
 * on ties). RNG-free geometry; mutates rg in place. Throws if the room has no
 * neighbor (impossible on a 4-connected footprint with 2+ rooms).
 */
function mergeInto(rg: number[][], fp: Footprint, sid: number): void {
  const shared = new Map<number, number>();
  for (let y = 0; y < fp.rows; y++) {
    for (let x = 0; x < fp.cols; x++) {
      if (rg[y][x] !== sid) continue;
      for (const [nx, ny] of [
        [x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1],
      ] as Array<[number, number]>) {
        if (nx < 0 || nx >= fp.cols || ny < 0 || ny >= fp.rows) continue;
        const nid = rg[ny][nx];
        if (nid >= 0 && nid !== sid) shared.set(nid, (shared.get(nid) ?? 0) + 1);
      }
    }
  }
  if (shared.size === 0) {
    throw new Error(`partition: room ${sid} has no neighbor to merge into`);
  }
  const target = [...shared.entries()]
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
  for (let y = 0; y < fp.rows; y++) {
    for (let x = 0; x < fp.cols; x++) {
      if (rg[y][x] === sid) rg[y][x] = target;
    }
  }
}
