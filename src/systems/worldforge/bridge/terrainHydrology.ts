/**
 * @file terrainHydrology.ts
 * @description Let the LAND decide where water goes.
 *
 * Every previous attempt invented a rule for where water sits — crude channel
 * quads, then one flat level per body, then a level per cell from the nearest
 * bank. Each produced water in the wrong place: 52 m slabs laid over the
 * landscape, then a river pinned to its downstream height and buried under 13 m
 * of hillside. Rules about water lose to the shape of the ground.
 *
 * This computes the two things real terrain-water needs, both standard and both
 * deterministic:
 *
 *   1. DEPRESSION FILLING (priority flood, Barnes et al). Every hollow is raised
 *      to the lowest point of its rim — the height at which it would spill. A
 *      basin's filled height IS its lake surface, and it comes out flat across
 *      the basin by construction rather than by a rule.
 *   2. FLOW ACCUMULATION. On the filled surface every cell drains to its
 *      steepest downhill neighbour, and flow adds up downstream. Cells carrying
 *      enough flow are river; a river therefore appears where water genuinely
 *      collects, and grows as it descends.
 *
 * Water can no longer sit above its bank or below the ground, because its height
 * comes from the surface it is standing on.
 */

export interface HydrologyInput {
  cols: number;
  rows: number;
  /** Encoded 0..100 terrain heights, row-major. */
  heights: readonly number[];
  /**
   * How much upstream land must drain through a cell before it counts as river,
   * measured in cells. Higher means fewer, larger rivers.
   */
  riverThreshold?: number;
  /** How far a lake's surface sits below its spill point, encoded units. */
  lakeDropEnc?: number;
}

export interface HydrologyResult {
  /** Depression-filled heights: hollows raised to their spill level. */
  filled: number[];
  /** Cells of upstream land draining through each cell, including itself. */
  accumulation: number[];
  /** Wet cell index → water surface height, encoded units. */
  water: Map<number, number>;
  /** Wet cells that are standing water rather than flowing. */
  lakeCells: Set<number>;
}

const DEFAULT_RIVER_THRESHOLD = 60;
const DEFAULT_LAKE_DROP = 0;

/** Minimal binary min-heap keyed by height. */
class MinHeap {
  private h: Array<{ idx: number; key: number }> = [];
  get size(): number { return this.h.length; }
  push(idx: number, key: number): void {
    this.h.push({ idx, key });
    let i = this.h.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.h[p].key <= this.h[i].key) break;
      [this.h[p], this.h[i]] = [this.h[i], this.h[p]];
      i = p;
    }
  }
  pop(): { idx: number; key: number } | undefined {
    const top = this.h[0];
    const last = this.h.pop();
    if (this.h.length > 0 && last) {
      this.h[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let s = i;
        if (l < this.h.length && this.h[l].key < this.h[s].key) s = l;
        if (r < this.h.length && this.h[r].key < this.h[s].key) s = r;
        if (s === i) break;
        [this.h[s], this.h[i]] = [this.h[i], this.h[s]];
        i = s;
      }
    }
    return top;
  }
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

/**
 * Raise every hollow to the lowest point of its rim.
 *
 * Flooding inward from the edges, always taking the lowest unvisited cell,
 * means each cell is reached over the lowest possible barrier — which is
 * exactly the height water would have to reach to escape that way.
 */
export function fillDepressions(input: HydrologyInput): number[] {
  const { cols, rows, heights } = input;
  const total = cols * rows;
  const filled = new Array<number>(total);
  const seen = new Uint8Array(total);
  const heap = new MinHeap();

  for (let idx = 0; idx < total; idx++) {
    const col = idx % cols;
    const row = (idx - col) / cols;
    const onEdge = col === 0 || row === 0 || col === cols - 1 || row === rows - 1;
    if (onEdge) {
      filled[idx] = heights[idx];
      seen[idx] = 1;
      heap.push(idx, heights[idx]);
    }
  }

  while (heap.size > 0) {
    const cur = heap.pop()!;
    for (const n of neighboursOf(cur.idx, cols, rows)) {
      if (seen[n]) continue;
      seen[n] = 1;
      // Either its own height, or the barrier it had to be flooded over.
      filled[n] = Math.max(heights[n], cur.key);
      heap.push(n, filled[n]);
    }
  }

  return filled;
}

/**
 * How many cells of land drain through each cell.
 *
 * Processing from the highest ground down means every cell's own upstream total
 * is complete before it passes water on.
 */
export function flowAccumulation(
  filled: readonly number[],
  cols: number,
  rows: number,
): number[] {
  const total = cols * rows;
  const acc = new Array<number>(total).fill(1);
  const order = Array.from({ length: total }, (_, i) => i)
    .sort((a, b) => filled[b] - filled[a] || a - b); // ties by index, for determinism

  for (const idx of order) {
    let lowest = -1;
    let lowestH = filled[idx];
    for (const n of neighboursOf(idx, cols, rows)) {
      if (filled[n] < lowestH) {
        lowestH = filled[n];
        lowest = n;
      }
    }
    if (lowest >= 0) acc[lowest] += acc[idx];
  }
  return acc;
}

/**
 * Where water sits, and how high, taken from the terrain alone.
 *
 * A cell is LAKE when filling raised it — standing water, its surface the
 * filled (spill) height, flat across the basin. A cell is RIVER when enough
 * upstream land drains through it; its surface is the ground it runs over, so
 * it descends with the valley and can never be buried by it.
 */
export function deriveHydrology(input: HydrologyInput): HydrologyResult {
  const { cols, rows, heights } = input;
  const riverThreshold = input.riverThreshold ?? DEFAULT_RIVER_THRESHOLD;
  const lakeDrop = input.lakeDropEnc ?? DEFAULT_LAKE_DROP;

  const filled = fillDepressions(input);
  const accumulation = flowAccumulation(filled, cols, rows);
  const water = new Map<number, number>();
  const lakeCells = new Set<number>();

  for (let idx = 0; idx < cols * rows; idx++) {
    const raised = filled[idx] - heights[idx];
    if (raised > 1e-9) {
      // Standing water: the surface is the spill height for the whole basin.
      water.set(idx, Math.max(0, filled[idx] - lakeDrop));
      lakeCells.add(idx);
    } else if (accumulation[idx] >= riverThreshold) {
      // Flowing water: rides the ground it crosses.
      water.set(idx, heights[idx]);
    }
  }

  return { filled, accumulation, water, lakeCells };
}
