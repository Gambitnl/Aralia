import { describe, expect, it } from 'vitest';
import { applyRiverPatch, riverFarLevelAt, riverPatchFrom, riverPatchRects, riverPatchRows, type LiveFlowArrays } from '../riverFlowPatch';

// GG-430 sparse live pictures: the helpers the worker and the page share.
const arrays = (n: number, seed: number): LiveFlowArrays => ({
  t0: Float32Array.from({ length: n * 4 }, (_, k) => seed + k),
  t0h: Uint16Array.from({ length: n * 4 }, (_, k) => (seed * 7 + k) & 0xffff),
  t1h: Uint16Array.from({ length: n * 4 }, (_, k) => (seed * 11 + k) & 0xffff),
  t2h: Uint16Array.from({ length: n * 4 }, (_, k) => (seed * 13 + k) & 0xffff),
  surface: Float32Array.from({ length: n }, (_, k) => seed * 100 + k),
});

describe('river picture patches', () => {
  it('splits ascending dirty cells into row spans, with a new span past a 64-cell gap', () => {
    const nx = 200;
    const dirty = Int32Array.from([3, 4, 5, 60, 150, nx + 1, 5 * nx + 199]);
    expect(Array.from(riverPatchRows(dirty, nx))).toEqual([0, 3, 60, 0, 150, 150, 1, 1, 1, 5, 199, 199]);
  });

  it('rebuilds the full arrays from a patch and reports the replaced surface', () => {
    const nx = 16, nz = 9, n = nx * nz;
    const before = arrays(n, 1), after = arrays(n, 2);
    const dirty = Int32Array.from([2, 3, 4, 40, 41, 100, 143]);
    // Only the dirty cells changed; every other cell is the same in both.
    const changed = arrays(n, 1);
    for (const c of dirty) {
      changed.surface[c] = after.surface[c];
      for (let q = 0; q < 4; q += 1) {
        changed.t0[c * 4 + q] = after.t0[c * 4 + q];
        changed.t0h[c * 4 + q] = after.t0h[c * 4 + q];
        changed.t1h[c * 4 + q] = after.t1h[c * 4 + q];
        changed.t2h[c * 4 + q] = after.t2h[c * 4 + q];
      }
    }
    const rows = riverPatchRows(dirty, nx);
    const patch = riverPatchFrom(rows, nx, changed.t0, changed.t0h, changed.t1h, changed.t2h, changed.surface);
    const kept = arrays(n, 1);
    const surfaceBefore = applyRiverPatch(kept, patch);
    expect(kept).toEqual(changed);
    for (const c of dirty) expect(surfaceBefore(c)).toBe(before.surface[c]);
    expect(surfaceBefore(50)).toBe(kept.surface[50]);
  });

  it('merges row spans into upload rectangles that cover every span and stay near its area', () => {
    const rows: number[] = [];
    // A diagonal band of 6-cell spans down 40 rows, then a far span.
    for (let j = 10; j < 50; j += 1) rows.push(j, j * 2, j * 2 + 5);
    rows.push(400, 1000, 1003);
    const spans = Int32Array.from(rows);
    const rects = riverPatchRects(spans);
    let spanCells = 0;
    for (let r = 0; r < spans.length; r += 3) {
      const j = spans[r], a = spans[r + 1], b = spans[r + 2];
      spanCells += b - a + 1;
      for (let i = a; i <= b; i += 1) {
        expect(rects.some(R => i >= R.x && i < R.x + R.width && j >= R.y && j < R.y + R.height)).toBe(true);
      }
    }
    const area = rects.reduce((s, R) => s + R.width * R.height, 0);
    expect(area).toBeLessThanOrEqual(2 * spanCells + 64 * rects.length);
    expect(rects.length).toBeLessThan(spans.length / 3);
  });

  it('reads the coarse far level as the old whole-grid fill did', () => {
    const coarse = { cx: 3, cz: 2, q: 4, data: Float32Array.from([1, 2, 4, 8, 16, 32]) };
    // Cell (2, 2) sits at coarse (0.125, 0.125): 1 + 1/8 of each step.
    const a = 1 + (2 - 1) * 0.125, b = 8 + (16 - 8) * 0.125;
    expect(riverFarLevelAt(coarse, 2, 2)).toBe(Math.fround(a + (b - a) * 0.125));
    // Past the last coarse cell the read clamps at the edge.
    expect(Number.isFinite(riverFarLevelAt(coarse, 11, 7))).toBe(true);
  });
});
