/**
 * @file bubbleTintField.test.ts — the table both threads mesh the bubble's top
 * surface from.
 *
 * `settle-hooks.md` gap 1: a carve, and much more visibly a slump, left a
 * darker, rougher patch that spread as more slabs were re-meshed. The cause was
 * ownership — the per-column tint is sampled from the `GroundWorld`, which
 * lives in the worker, so the main thread's re-mesh passed `undefined` and
 * `tintSlab` repainted the slab's whole sixteen-metre footprint at the
 * reference tint of 1.
 *
 * These tests pin the fix where the fix has to hold: the sampler rebuilt from
 * the transferred field returns EXACTLY what the worker's own baked lookup
 * returns, so a re-meshed slab is byte-equivalent to the one it replaced.
 */
import { describe, it, expect } from 'vitest';
import {
  bakeTintField,
  tintFromField,
  tintSlab,
  tintRatio,
  transfersOfTintField,
} from '../volumeBubbleCore';

const ORIGIN = [-8, 0, -8] as const;
const CELL = 0.25;
const N = 64;

/** Two grounds split down the middle of the bubble, as a river bar would. */
function twoGrounds(x: number, _z: number): readonly [number, number, number] {
  return x < 0 ? [1, 1, 1] : [1.3, 0.9, 0.7];
}

/**
 * What a tint looks like once it has been through the palette.
 *
 * The palette is `Float32Array`, so 1.3 comes back as 1.2999999523162842. That
 * is not a rounding to shrug at — it is the point: BOTH threads read the same
 * float32 table, so both draw the same number. A test that compared against the
 * float64 source would be asserting the one thing the fix does not promise.
 */
function through32(c: readonly [number, number, number]): number[] {
  return Array.from(new Float32Array(c));
}

describe('bakeTintField', () => {
  it('keeps one palette entry per distinct tint', () => {
    const f = bakeTintField(twoGrounds, ORIGIN, CELL, N);
    expect(f.palette).toHaveLength(6); // two tints, three floats each
    expect(f.index).toHaveLength(N * N);
    expect(f.cellsPerEdge).toBe(N);
    expect(f.cellM).toBe(CELL);
  });

  it('reproduces the sampler it was baked from, column for column', () => {
    const f = bakeTintField(twoGrounds, ORIGIN, CELL, N);
    const at = tintFromField(f);
    for (let z = 0; z < N; z++) {
      for (let x = 0; x < N; x++) {
        const wx = ORIGIN[0] + (x + 0.5) * CELL;
        const wz = ORIGIN[2] + (z + 0.5) * CELL;
        expect(Array.from(at(wx, wz))).toEqual(through32(twoGrounds(wx, wz)));
      }
    }
  });

  it('is stable for a single-ground bubble — every column reads exactly 1', () => {
    /* The whole tint mechanism is a ratio against the bubble's own stack, so a
     * bubble standing on one ground must be bit-identical to one with the tint
     * switched off. That property has to survive the bake. */
    const f = bakeTintField(() => [1, 1, 1], ORIGIN, CELL, N);
    const at = tintFromField(f);
    expect(f.palette).toHaveLength(3);
    expect(at(0, 0)).toEqual([1, 1, 1]);
    expect(at(-7.9, 7.9)).toEqual([1, 1, 1]);
  });

  it('clamps outside the bubble instead of reading past the index', () => {
    const f = bakeTintField(twoGrounds, ORIGIN, CELL, N);
    const at = tintFromField(f);
    expect(Array.from(at(-1e6, -1e6))).toEqual([1, 1, 1]);
    expect(Array.from(at(1e6, 1e6))).toEqual(through32([1.3, 0.9, 0.7]));
  });

  it('survives a structured-clone round trip, which is how it crosses', () => {
    const f = bakeTintField(twoGrounds, ORIGIN, CELL, N);
    const crossed = {
      ...f,
      index: new Uint8Array(f.index),
      palette: new Float32Array(f.palette),
    };
    const a = tintFromField(f);
    const b = tintFromField(crossed);
    for (const [x, z] of [
      [-4, -4],
      [4, 4],
      [0.1, -2],
      [-0.1, 3],
    ]) {
      expect(b(x, z)).toEqual(a(x, z));
    }
  });

  it('offers both buffers for transfer', () => {
    const f = bakeTintField(twoGrounds, ORIGIN, CELL, N);
    const t = transfersOfTintField(f);
    expect(t).toHaveLength(2);
    expect(t[0]).toBe(f.index.buffer);
    expect(t[1]).toBe(f.palette.buffer);
  });
});

describe('the re-mesh is byte-equivalent to the worker build', () => {
  /** Four vertices spread across the seam, as one slab's would be. */
  const positions = new Float32Array([
    -4, 2, -4,
     4, 2, -4,
    -0.2, 2, 1,
     0.2, 2, 1,
  ]);

  it('a slab tinted from the field matches one tinted by the worker path', () => {
    const f = bakeTintField(twoGrounds, ORIGIN, CELL, N);
    const worker = tintSlab(positions, tintFromField(f));
    /* The main thread rebuilds the sampler from the arrived copy — a different
     * object, the same numbers. This is the assertion the seam failed. */
    const arrived = {
      ...f,
      index: new Uint8Array(f.index),
      palette: new Float32Array(f.palette),
    };
    const remesh = tintSlab(positions, tintFromField(arrived));
    expect(Array.from(remesh)).toEqual(Array.from(worker));
  });

  it('and a re-mesh WITHOUT the field is the seam it used to draw', () => {
    /* Kept as the negative: this is exactly what the main thread produced
     * before, and it is why the patch read darker. If this ever stops
     * differing, the tint has stopped doing anything and the test above is
     * proving nothing. */
    const f = bakeTintField(twoGrounds, ORIGIN, CELL, N);
    const withField = tintSlab(positions, tintFromField(f));
    const without = tintSlab(positions, undefined);
    expect(Array.from(without)).toEqual([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
    expect(Array.from(withField)).not.toEqual(Array.from(without));
  });
});

describe('tintRatio', () => {
  it('is exactly 1 when the column matches the reference', () => {
    expect(tintRatio([0.4, 0.3, 0.2], [0.4, 0.3, 0.2])).toEqual([1, 1, 1]);
  });
});
