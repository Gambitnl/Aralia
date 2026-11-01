/** Raw-cell diagnostics must preserve precision and read only the requested inventory. */
import { describe, expect, it } from 'vitest';
import { copyRawRiverCells, validateRiverCellIds, type RiverCellInspectionSource } from '../riverCellInspection';

const source = (): RiverCellInspectionSource => ({
  grid: { nx: 8, nz: 8, dx: 0.5, x0: -2, z0: 10 },
  h: new Float64Array(64).fill(0.0000001234567890123),
  hu: new Float64Array(64).fill(0.123456789012345),
  hv: new Float64Array(64).fill(-0.987654321098765),
  bed: new Float64Array(64).fill(3.484099864959717),
  ground: new Float64Array(64).fill(3.4), time: 21.125, steps: 317, liveSimTime: 23.5,
});

describe('bounded current raw cell inspection', () => {
  it.each([null, {}, [], [1, 1], [-1], [64], [0.5], [NaN], [Infinity], ['1'], [Number.MAX_SAFE_INTEGER + 1], Array.from({ length: 65 }, (_, i) => i)].map(input => [input]))(
    'rejects invalid input without clamping (%j)', input => {
      expect(() => copyRawRiverCells(source(), input)).toThrow(/Cell inspection/);
    },
  );

  it('accepts exactly 64 distinct cells and returns detached scalar records with world bounds', () => {
    const state = source();
    const result = copyRawRiverCells(state, Array.from({ length: 64 }, (_, i) => i));
    expect(result.cells).toHaveLength(64);
    expect(result).toMatchObject({ solverTime: 21.125, solverSteps: 317, liveSimTime: 23.5, worldBounds: [-2, 10, 2, 14] });
    expect(result.grid).not.toBe(state.grid);
    expect(result.cells[9]).toEqual({ cellId: 9, i: 1, j: 1, h: state.h[9], hu: state.hu[9], hv: state.hv[9],
      bed: state.bed[9], ground: 3.4, cellAreaM2: 0.25, cellVolumeM3: state.h[9] * 0.25,
      center: [-1.25, 10.75], worldBounds: [-1.5, 10.5, -1, 11] });
    const old = result.cells[9].h;
    state.h[9] = 4;
    expect(result.cells[9].h).toBe(old);
    result.cells[10].h = 9;
    expect(state.h[10]).not.toBe(9);
    expect(result.cells[0].h).toBeGreaterThan(0);
    expect(result.cells[0].h).not.toBe(Math.fround(result.cells[0].h));
  });

  it('copies only requested indices, not buffers, methods or broad arrays', () => {
    const state = source(), reads: string[] = [];
    for (const name of ['h', 'hu', 'hv', 'bed', 'ground'] as const) {
      state[name] = new Proxy(state[name], {
        get(target, key) {
          if (key !== '3' && key !== '60') throw new Error(`Forbidden broad read: ${name}.${String(key)}`);
          reads.push(`${name}.${String(key)}`);
          return target[Number(key)];
        },
      });
    }
    expect(copyRawRiverCells(state, [60, 3]).cells.map(c => c.cellId)).toEqual([60, 3]);
    expect(reads).toHaveLength(10);
    reads.length = 0;
    expect(() => copyRawRiverCells(state, [3, 64])).toThrow(/inside the solver grid/);
    expect(reads).toEqual([]);
    const ids = [3, 60];
    expect(validateRiverCellIds(ids)).not.toBe(ids);
  });
});
