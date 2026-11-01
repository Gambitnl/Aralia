/** Native sheet regressions cover waterline corners, smoothing across scratch
 * pages and rectangular coordinates used by the descending course. */
import { describe, expect, it } from 'vitest';
import { buildWaterSheetArrays } from '../riverWaterSheet';

const grid = { nx: 2, nz: 2, dx: 1, x0: 0, z0: 0 };

describe('native water sheet', () => {
  it.each(Array.from({ length: 16 }, (_, mask) => mask))('preserves wet-corner topology for mask %i', mask => {
    const surface = Float32Array.from({ length: 4 }, (_, c) => mask & (1 << c) ? 3 : NaN);
    const sheet = buildWaterSheetArrays(grid, surface);
    const expected: Record<number, number[]> = {
      7: [0, 2, 1], 11: [0, 2, 1], 13: [0, 1, 2], 14: [0, 1, 2],
      15: [0, 2, 1, 1, 2, 3],
    };
    expect(Array.from(sheet.index)).toEqual(expected[mask] ?? []);
    const cells = [0, 1, 2, 3].filter(c => mask & (1 << c));
    expect(Array.from(sheet.pos)).toEqual(cells.flatMap(c => [c % 2 + .5, 3, Math.floor(c / 2) + .5]));
  });

  it('keeps isolated water and degenerate grids without inventing triangles', () => {
    for (const [nx, nz] of [[1, 1], [1, 17], [17, 1]]) {
      const surface = new Float32Array(nx * nz).fill(NaN);
      surface[surface.length - 1] = 0;
      const sheet = buildWaterSheetArrays({ ...grid, nx, nz }, surface);
      expect(sheet.pos.length).toBe(3);
      expect(sheet.index.length).toBe(0);
      expect(sheet.nor[1]).toBe(1);
    }
  });

  it('keeps Float64-smoothed normals across 256-cell scratch pages', () => {
    const nx = 257, nz = 5;
    const surface = new Float32Array(nx * nz).fill(NaN);
    for (let j = 0; j < nz; j += 1) for (let i = 250; i < nx; i += 1) surface[j * nx + i] = 2 * i + .5 * j;
    const sheet = buildWaterSheetArrays({ ...grid, nx, nz }, surface);
    const cell = 768, vertex = 18, length = Math.hypot(2, 1, .5);
    expect(Array.from(sheet.nor.subarray(vertex * 3, vertex * 3 + 3))).toEqual([
      Math.fround(-2 / length), Math.fround(1 / length), Math.fround(-.5 / length),
    ]);
    expect(sheet.pos[vertex * 3 + 1]).toBe(surface[cell]);
    expect(sheet.index.length).toBe(6 * (nz - 1) * 6);
    expect(Math.max(...sheet.index)).toBe(7 * nz - 1);
  });

  it('uses actual rectangular cell centers and their spacing', () => {
    const rectangular = { ...grid, nx: 3, nz: 3, xEdges: [0, 1, 3, 7] };
    const sheet = buildWaterSheetArrays(rectangular, new Float32Array(9).fill(4));
    expect(Array.from(sheet.pos.subarray(0, 9))).toEqual([.5, 4, .5, 2, 4, .5, 5, 4, .5]);
    expect(sheet.index.length).toBe(24);
    expect(sheet.nor[4 * 3 + 1]).toBe(1);
  });

  it('does not treat nonfinite heights as dry when they are not NaN', () => {
    const sheet = buildWaterSheetArrays(grid, Float32Array.from([Infinity, -Infinity, 0, NaN]));
    expect(Array.from(sheet.index)).toEqual([0, 2, 1]);
    expect(sheet.pos.length).toBe(9);
    expect(sheet.pos[1]).toBe(Infinity);
    expect(sheet.pos[4]).toBe(-Infinity);
  });
});
