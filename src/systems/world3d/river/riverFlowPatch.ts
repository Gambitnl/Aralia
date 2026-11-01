/**
 * Small shared helpers for the live river's sparse pictures (2026-10-22,
 * GG-430): the far-field level marker and its coarse grid, and the row-span
 * patches the flow-map worker sends after its first picture. The page's main
 * thread imports these without the large worker-side modules.
 */

/**
 * THE FAR LEVEL MARKER (2026-10-22, GG-430). With a scratch pool, a cell
 * past the near rings no longer holds the coarse far-field level in t0.w: it
 * holds this marker, and the map returns the coarse grid instead. Readers
 * take such a cell's level from the coarse grid (`riverFarLevelAt`), with the
 * same Float32 arithmetic the whole-grid fill used.
 */
export const RIVER_FAR_LEVEL = -30000;

/** The coarse far-field level grid (q x q cells per coarse cell). */
export interface RiverCoarseLevel { readonly cx: number; readonly cz: number; readonly q: number; readonly data: Float32Array; }

/** The level the whole-grid fill gave cell (i, j): bilinear in the coarse
 * grid at the cell center, rounded to Float32 like the fill's array. */
export function riverFarLevelAt(coarse: RiverCoarseLevel, i: number, j: number): number {
  const { cx, cz, q, data } = coarse;
  const fx = Math.min(cx - 1.001, Math.max(0, (i + 0.5) / q - 0.5));
  const fz = Math.min(cz - 1.001, Math.max(0, (j + 0.5) / q - 0.5));
  const ii = Math.floor(fx);
  const jj = Math.floor(fz);
  const tx = fx - ii;
  const tz = fz - jj;
  const a = data[jj * cx + ii] + (data[jj * cx + ii + 1] - data[jj * cx + ii]) * tx;
  const b = data[(jj + 1) * cx + ii] + (data[(jj + 1) * cx + ii + 1] - data[(jj + 1) * cx + ii]) * tx;
  return Math.fround(a + (b - a) * tz);
}

/** Changed cells of a picture as row spans: `rows` holds (j, i0, i1) triples;
 * the arrays hold the spans' cells in that order (4 values a cell for t0 and
 * the half textures). */
export interface LiveFlowPatch {
  /** The grid width the rows use. */
  nx: number;
  rows: Int32Array;
  t0: Float32Array;
  t0h: Uint16Array;
  t1h: Uint16Array;
  t2h: Uint16Array;
  surface: Float32Array;
}

/** Row spans of the ascending dirty cells; a gap over 64 cells starts a new span. */
export function riverPatchRows(dirty: Int32Array, nx: number): Int32Array {
  const out: number[] = [];
  let j = -1, i0 = 0, i1 = -1;
  for (let k = 0; k < dirty.length; k += 1) {
    const c = dirty[k], i = c % nx, row = (c - i) / nx;
    if (row === j && i - i1 <= 64) { i1 = i; continue; }
    if (j >= 0) out.push(j, i0, i1);
    j = row; i0 = i; i1 = i;
  }
  if (j >= 0) out.push(j, i0, i1);
  return Int32Array.from(out);
}

/** The patch arrays for `rows`, read from full arrays. */
export function riverPatchFrom(rows: Int32Array, nx: number, t0: Float32Array, t0h: Uint16Array, t1h: Uint16Array, t2h: Uint16Array, surface: Float32Array): LiveFlowPatch {
  let cells = 0;
  for (let r = 0; r < rows.length; r += 3) cells += rows[r + 2] - rows[r + 1] + 1;
  const patch: LiveFlowPatch = { nx, rows, t0: new Float32Array(cells * 4), t0h: new Uint16Array(cells * 4), t1h: new Uint16Array(cells * 4), t2h: new Uint16Array(cells * 4), surface: new Float32Array(cells) };
  let at = 0;
  for (let r = 0; r < rows.length; r += 3) {
    const a = rows[r] * nx + rows[r + 1], len = rows[r + 2] - rows[r + 1] + 1;
    patch.t0.set(t0.subarray(a * 4, (a + len) * 4), at * 4);
    patch.t0h.set(t0h.subarray(a * 4, (a + len) * 4), at * 4);
    patch.t1h.set(t1h.subarray(a * 4, (a + len) * 4), at * 4);
    patch.t2h.set(t2h.subarray(a * 4, (a + len) * 4), at * 4);
    patch.surface.set(surface.subarray(a, a + len), at);
    at += len;
  }
  return patch;
}

/** Full picture arrays a receiver keeps between patch pictures. */
export interface LiveFlowArrays { t0: Float32Array; t0h: Uint16Array; t1h: Uint16Array; t2h: Uint16Array; surface: Float32Array }

/**
 * Write a patch picture into kept full arrays (in place). Returns the
 * surface each patched cell held before, for the blend between pictures.
 */
/** A texel rectangle of a flow texture upload. */
export interface RiverPatchRect { x: number; y: number; width: number; height: number }

/**
 * The patch's row spans as a few upload rectangles (2026-10-27, GG-430): one
 * texture write a row span would be several hundred writes a picture. A span
 * joins the open rectangle when it starts on the same or the next row and the
 * joined area stays at most twice the spans' cells plus 64 texels. The
 * rectangles cover every span; extra texels are unchanged values, sent again.
 */
export function riverPatchRects(rows: Int32Array): RiverPatchRect[] {
  const out: RiverPatchRect[] = [];
  let x0 = 0, x1 = -1, y0 = 0, y1 = -1, cells = 0;
  const flush = (): void => { if (x1 >= x0) out.push({ x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 }); };
  for (let r = 0; r < rows.length; r += 3) {
    const j = rows[r], a = rows[r + 1], b = rows[r + 2], len = b - a + 1;
    if (x1 >= x0 && j <= y1 + 1) {
      const nx0 = Math.min(x0, a), nx1 = Math.max(x1, b), ny1 = Math.max(y1, j);
      if ((nx1 - nx0 + 1) * (ny1 - y0 + 1) <= 2 * (cells + len) + 64) { x0 = nx0; x1 = nx1; y1 = ny1; cells += len; continue; }
    }
    flush();
    x0 = a; x1 = b; y0 = j; y1 = j; cells = len;
  }
  flush();
  return out;
}

export function applyRiverPatch(target: LiveFlowArrays, patch: LiveFlowPatch): (c: number) => number {
  const before = new Map<number, number>(), nx = patch.nx;
  let at = 0;
  for (let r = 0; r < patch.rows.length; r += 3) {
    const a = patch.rows[r] * nx + patch.rows[r + 1], len = patch.rows[r + 2] - patch.rows[r + 1] + 1;
    for (let k = 0; k < len; k += 1) before.set(a + k, target.surface[a + k]);
    target.t0.set(patch.t0.subarray(at * 4, (at + len) * 4), a * 4);
    target.t0h.set(patch.t0h.subarray(at * 4, (at + len) * 4), a * 4);
    target.t1h.set(patch.t1h.subarray(at * 4, (at + len) * 4), a * 4);
    target.t2h.set(patch.t2h.subarray(at * 4, (at + len) * 4), a * 4);
    target.surface.set(patch.surface.subarray(at, at + len), a);
    at += len;
  }
  const surface = target.surface;
  return (c: number) => (before.has(c) ? before.get(c)! : surface[c]);
}

