/**
 * @file spanField.ts — the volume's open spans, packed flat for a GPU kernel.
 *
 * WHY THIS EXISTS
 *
 * `flipCompute.ts` collides its water against a HEIGHT buffer: one float per
 * column, one floor per column. That is the heightfield assumption, and it is
 * the exact assumption ADR 0002 says a volume exists to break. Bore a tunnel
 * through a hill and the column has two places water can lie — the hillside on
 * top and the tunnel floor underneath — and a single height seals the tunnel
 * shut. Water cannot get in, ever, whatever the voxels say.
 *
 * `volumeSurface.ts` already reads a column as a list of SPANS (floor, ceiling,
 * substance). It returns an array of objects per column, which is the right
 * shape for a mesher and the wrong shape for a compute kernel. This file is the
 * translation: the same spans, from the same reader, in one flat Float32Array a
 * storage buffer can bind directly.
 *
 * THE ENCODING, AND WHY IT NEEDS NO COUNT
 *
 * Each column gets a FIXED `slots` pairs of (floorY, ceilY), ordered top-down —
 * `columnSpans`' own order. Columns with fewer real spans pad by REPLICATING
 * the last real pair.
 *
 * That replication is the whole trick. The resolve is:
 *
 *     pick the FIRST slot whose floor is at or below y;
 *     if none, use the LAST slot.
 *
 * With the pad being a copy of the last real span, "the last slot" is always
 * the deepest real span, so the fallback needs no count, no branch on a length,
 * and no separate buffer. One unrolled chain of selects, identical on the CPU
 * and in TSL. A count array is still produced, for tests and diagnostics — the
 * kernel never reads it.
 *
 * Then, with (floorY, ceilY) resolved:
 *
 *     free  <=>  floorY <= y <= ceilY
 *
 * Above the top floor, ceilY is SPAN_SKY and the point is open air. Between a
 * tunnel's ceiling and the hillside above it, the resolve picks the tunnel span
 * and y is above its ceiling: solid, and the push is DOWN. Below a tunnel's
 * floor the resolve falls back to that same span and y is under its floor:
 * solid, and the push is UP. Three cases, one rule, no special-casing.
 *
 * HOW WIDE, MEASURED
 *
 * Column span counts over the worlds this repo actually builds, 256² columns
 * each (`.agent/scratch/impl3-span-census.ts`):
 *
 *   shafts proving ground   max 1   (a vertical well is still open sky)
 *   cell 785, untouched     max 1
 *   cell 785 + blast crater max 2   (1.98% of columns)
 *   cell 785 + one bore     max 2   (4.69% of columns)
 *   + a second bore under   max 3
 *   + a third bore under    max 4
 *
 * The rule the data shows: one span, plus one more for every void in the column
 * that has rock above it. Everything the repo builds today needs 2, so
 * `SPAN_SLOTS` is 2 — which packs one column into exactly one vec4 and costs
 * the kernel the SAME number of buffer reads as the single height it replaces.
 * Stacked bores would need 4 and cost two reads per column. `packSpanField`
 * counts `overflow` so that day is a number, not a silent wrong picture.
 *
 * A column that overflows keeps its TOP `slots` spans. The dropped ones become
 * solid rock, so the failure is water that cannot enter a deep passage — never
 * water leaking into stone.
 */
import { columnSpans, type SurfaceTarget } from './volumeSurface';

/**
 * Spans kept per column. See the measurement in the file header: 2 covers every
 * world in the repo and packs a column into one vec4.
 */
export const SPAN_SLOTS = 2;

/**
 * The ceiling of an open-sky span. `columnSpans` says Infinity; a Float32Array
 * can hold that, but `Infinity - Infinity` appears the moment anything measures
 * headroom, and one NaN in a velocity buffer poisons a whole pool. A large
 * finite number is 1e9 meters above the world and behaves under arithmetic.
 */
export const SPAN_SKY = 1e9;

export interface SpanField {
  /** Columns per edge — the volume's own lattice. */
  n: number;
  /** Pairs per column. */
  slots: number;
  /**
   * (floorY, ceilY) pairs, world meters, laid out
   * `((z * n + x) * slots + s) * 2 + {0: floor, 1: ceil}`.
   *
   * With `slots = 2` the per-column stride is 4 floats, which a WebGPU storage
   * buffer binds as one vec4 element.
   */
  data: Float32Array;
  /** Real spans found per column, before padding. Diagnostics and tests only. */
  count: Uint8Array;
  /** Columns whose real span count exceeded `slots`. Spans below the top N were dropped. */
  overflow: number;
  /**
   * Columns with no solid cell at all — a hole clean through the volume.
   *
   * There is no matching "sealed" count, and that is worth stating because its
   * absence looks like an oversight. A column solid to the very top comes back
   * from `columnSpans` as ONE span floored at the top of the volume, because
   * the walk starts in a gap. That is already the right answer — the ground is
   * higher than the volume reaches — so it needs no special case here.
   */
  bottomless: number;
}

/**
 * Read every column of a volume and pack its spans.
 *
 * Walks the whole lattice, so this is a build-time or edit-time call, never a
 * per-frame one. At 80³ it is a few milliseconds; at 256³ it is seconds.
 */
export function packSpanField(t: SurfaceTarget, slots: number = SPAN_SLOTS): SpanField {
  const n = t.volume.cells;
  const stride = slots * 2;
  const data = new Float32Array(n * n * stride);
  const count = new Uint8Array(n * n);
  let overflow = 0;
  let bottomless = 0;

  for (let z = 0; z < n; z++) {
    for (let x = 0; x < n; x++) {
      const col = z * n + x;
      const base = col * stride;
      const spans = columnSpans(t, x, z);
      count[col] = Math.min(255, spans.length);

      if (spans.length === 0) {
        /* Air all the way down: nothing in this column can hold water.
         *
         * `columnSpans` refuses to emit a gap with no solid under it, on
         * purpose — handing the solver a floor that is not there would let
         * water pour out through the bottom of the volume. But a sim needs
         * SOME floor at every column or a particle falls forever, so the
         * volume's own base is it. That is exactly where the box floor sat
         * before this file existed, and it is the honest answer: the volume
         * has no more ground to offer here. */
        bottomless++;
        for (let s = 0; s < slots; s++) {
          data[base + s * 2] = t.originM[1];
          data[base + s * 2 + 1] = SPAN_SKY;
        }
        continue;
      }

      if (spans.length > slots) overflow++;
      const kept = Math.min(spans.length, slots);
      for (let s = 0; s < slots; s++) {
        // Past the real spans, REPLICATE the last one. See the file header:
        // that is what makes the fallback need no count.
        const sp = spans[Math.min(s, kept - 1)];
        data[base + s * 2] = sp.floorY;
        data[base + s * 2 + 1] = Number.isFinite(sp.ceilY) ? sp.ceilY : SPAN_SKY;
      }
    }
  }
  return { n, slots, data, count, overflow, bottomless };
}

/**
 * The same field in GRID units — heights measured in cells above `originY`.
 *
 * Both sims run in grid units (dx = 1, gravity 0.3 per sim-time unit), so the
 * conversion happens ONCE here rather than per node per substep. SPAN_SKY stays
 * SPAN_SKY: it is a sentinel, not a height, and scaling it would make the
 * "is this open sky" test depend on the cell size.
 */
export function spanFieldToGrid(f: SpanField, originY: number, dxM: number): Float32Array {
  const out = new Float32Array(f.data.length);
  for (let i = 0; i < f.data.length; i += 2) {
    out[i] = (f.data[i] - originY) / dxM;
    out[i + 1] = f.data[i + 1] >= SPAN_SKY ? SPAN_SKY : (f.data[i + 1] - originY) / dxM;
  }
  return out;
}

/** Build a single-span field from a plain height per column — the heightfield
 * this file replaces, expressed in the new encoding. Nothing in the kernels
 * changes shape when a caller only has heights, which is what let the change
 * land without a second collision path.
 *
 * Heights and the output are in whatever unit the caller passes in. */
export function spanFieldFromHeights(
  heights: Float32Array,
  n: number,
  slots: number = SPAN_SLOTS,
): Float32Array {
  const stride = slots * 2;
  const out = new Float32Array(n * n * stride);
  for (let col = 0; col < n * n; col++) {
    for (let s = 0; s < slots; s++) {
      out[col * stride + s * 2] = heights[col];
      out[col * stride + s * 2 + 1] = SPAN_SKY;
    }
  }
  return out;
}

/**
 * Resolve ONE column at height y. Writes [floor, ceil] into `out`.
 *
 * THE reference implementation of the rule the whole design rests on, and the
 * thing the TSL in `flipCompute.ts` mirrors select for select. Any change here
 * is a change there.
 */
export function resolveColumn(
  data: Float32Array,
  slots: number,
  col: number,
  y: number,
  out: Float32Array,
): void {
  const base = col * slots * 2;
  // Start at the LAST slot: with replication padding that is the deepest real
  // span, which is what a y below every floor must fall back to.
  let floorY = data[base + (slots - 1) * 2];
  let ceilY = data[base + (slots - 1) * 2 + 1];
  // Walk UP so the last assignment is the smallest qualifying slot — the
  // highest floor at or below y.
  for (let s = slots - 1; s >= 0; s--) {
    const f = data[base + s * 2];
    if (f <= y) {
      floorY = f;
      ceilY = data[base + s * 2 + 1];
    }
  }
  out[0] = floorY;
  out[1] = ceilY;
}

/**
 * Resolve at a continuous grid position: the FLOOR bilinear over the four
 * nearest columns, the CEILING from the nearest column alone.
 *
 * Why the two are sampled differently, and it is not an oversight:
 *
 * The floor must be smooth. A nearest-cell floor turns every slope into a
 * staircase, and the hard clamp then lifts a sliding particle up each riser
 * without decelerating it — potential energy injected forever. That was the
 * last residual boil in the GPU sim before round 3, and the bilinear lookup is
 * what fixed it.
 *
 * A ceiling has no such pump. Water does not rest on a roof, gravity has no
 * along-ceiling component to delete, and clamping DOWN under a roof removes
 * potential energy rather than adding it. Blending it, on the other hand, is
 * actively wrong: a column beside a tunnel mouth is open sky, so its ceiling is
 * SPAN_SKY, and lerping 1e9 with a real roof height gives a roof half a million
 * meters up. Nearest is the honest read.
 *
 * The bilinear floor is also what CONFINES a tunnel sideways. Approach the rock
 * wall beside a bore and the resolved floor climbs from the tunnel floor to the
 * hillside above, in one cell — a near-vertical wall whose tangent plane points
 * back into the passage. No separate lateral-wall test exists, or is needed.
 */
export function resolveSpanAt(
  data: Float32Array,
  slots: number,
  n: number,
  gx: number,
  gy: number,
  gz: number,
  out: Float32Array,
  scratch: Float32Array,
): void {
  const fx = gx - 0.5;
  const fz = gz - 0.5;
  let ix0 = Math.floor(fx);
  let iz0 = Math.floor(fz);
  const tx = fx - ix0;
  const tz = fz - iz0;
  ix0 = ix0 < 0 ? 0 : ix0 > n - 1 ? n - 1 : ix0;
  iz0 = iz0 < 0 ? 0 : iz0 > n - 1 ? n - 1 : iz0;
  const ix1 = ix0 + 1 > n - 1 ? n - 1 : ix0 + 1;
  const iz1 = iz0 + 1 > n - 1 ? n - 1 : iz0 + 1;

  resolveColumn(data, slots, iz0 * n + ix0, gy, scratch);
  const f00 = scratch[0];
  const c00 = scratch[1];
  resolveColumn(data, slots, iz0 * n + ix1, gy, scratch);
  const f01 = scratch[0];
  const c01 = scratch[1];
  resolveColumn(data, slots, iz1 * n + ix0, gy, scratch);
  const f10 = scratch[0];
  const c10 = scratch[1];
  resolveColumn(data, slots, iz1 * n + ix1, gy, scratch);
  const f11 = scratch[0];
  const c11 = scratch[1];

  const h0 = f00 * (1 - tx) + f01 * tx;
  const h1 = f10 * (1 - tx) + f11 * tx;
  out[0] = h0 * (1 - tz) + h1 * tz;
  // Nearest column for the ceiling.
  out[1] = tz < 0.5 ? (tx < 0.5 ? c00 : c01) : tx < 0.5 ? c10 : c11;
}
