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
  townFloorTop,
  quantizeTownMask,
  TOWN_FLOOR_RGB,
  TOWN_FLOOR_STRENGTH,
  TOWN_FLOOR_FEATHER_M,
  TOWN_MASK_STEPS,
} from '../volumeBubbleCore';
import {
  buildTownKeepOut,
  townClearance,
} from '@/systems/worldforge/bridge/townVegetationKeepOut';

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

/**
 * THE TOWN'S FLOOR ON THE VOLUME TOP (agora-f452).
 *
 * The sheet path has blended a town's ground toward trodden earth since
 * 2026-08-24; the volume path had not, so the town-on-LAND pane stood its burg
 * on meadow grass and the street ribbons over it had nothing to read against.
 * These pin the blend, the mask quantization the palette depends on, and the
 * end-to-end path a bubble containing a town actually takes.
 */
describe('town floor tint', () => {
  const GRASS: readonly [number, number, number] = [0.36, 0.48, 0.26];

  it('matches the sheet path\'s own constants', () => {
    /* Pinned literally, and duplicated on purpose: `volumeBubbleCore` is the
     * pure terrain layer and does not import `bridge/`. If the sheet path's
     * TOWN_FLOOR_RGB / _STRENGTH / _FEATHER_M in
     * `groundChunkLoader.sampleGroundChunk` ever move, this test is what says
     * the two paths have stopped agreeing about what a town looks like. */
    expect(Array.from(TOWN_FLOOR_RGB)).toEqual([0.42, 0.36, 0.27]);
    expect(TOWN_FLOOR_STRENGTH).toBe(0.88);
    expect(TOWN_FLOOR_FEATHER_M).toBe(26);
  });

  it('leaves the wilderness exactly as it found it', () => {
    expect(townFloorTop(GRASS, 0)).toEqual([...GRASS]);
    expect(townFloorTop(GRASS, -1)).toEqual([...GRASS]);
    // And so the ratio against any reference is still exactly 1.
    expect(tintRatio(townFloorTop(GRASS, 0), GRASS)).toEqual([1, 1, 1]);
  });

  it('blends toward trodden earth, but never all the way', () => {
    const t = townFloorTop(GRASS, 1);
    for (let i = 0; i < 3; i++) {
      expect(t[i]).toBeCloseTo(GRASS[i] + (TOWN_FLOOR_RGB[i] - GRASS[i]) * TOWN_FLOOR_STRENGTH, 12);
    }
    /* The point of the whole change, stated as a measurement: the green a
     * player saw between the houses drops, and the red rises. */
    expect(t[1]).toBeLessThan(GRASS[1]);
    expect(t[0]).toBeGreaterThan(GRASS[0]);
    // Below 1 so a town keeps a trace of the biome it stands on.
    expect(t[1]).toBeGreaterThan(TOWN_FLOOR_RGB[1]);
  });

  it('quantizes the mask onto the palette\'s step grid', () => {
    expect(quantizeTownMask(0)).toBe(0);
    expect(quantizeTownMask(1)).toBe(1);
    expect(quantizeTownMask(2)).toBe(1);
    expect(quantizeTownMask(0.5)).toBe(0.5);
    const steps = new Set<number>();
    for (let i = 0; i <= 1000; i++) steps.add(quantizeTownMask(i / 1000));
    expect(steps.size).toBeLessThanOrEqual(TOWN_MASK_STEPS + 1);
  });

  /**
   * The whole path, built the way the worker builds it: one ground stack, one
   * town ring, mask from `townClearance`, blend, ratio, bake, read back.
   *
   * The palette cap is the reason the mask is quantized at all — a continuous
   * feather hands `bakeTintField` a new entry per column, overflows 256, and
   * every overflowing column falls back to entry 0 (the reference tint), which
   * would draw a hard bright edge exactly where the feather exists to avoid one.
   */
  it('paints a town on the volume top without overflowing the palette', () => {
    const RING = 60;
    const keepOut = buildTownKeepOut(
      1,
      [
        { x: -RING, z: -RING },
        { x: RING, z: -RING },
        { x: RING, z: RING },
        { x: -RING, z: RING },
      ],
      [],
      TOWN_FLOOR_FEATHER_M,
    )!;
    const sample = (x: number, z: number): readonly [number, number, number] => {
      const mask = quantizeTownMask(1 - townClearance(x, z, [keepOut], TOWN_FLOOR_FEATHER_M));
      return tintRatio(townFloorTop(GRASS, mask), GRASS);
    };

    const origin = [-128, 0, -128] as const;
    const cell = 1;
    const n = 256;
    const f = bakeTintField(sample, origin, cell, n);
    // At most one entry per mask step, plus the reference. Never the 256 cap.
    expect(f.palette.length / 3).toBeLessThanOrEqual(TOWN_MASK_STEPS + 2);

    const at = tintFromField(f);
    const inside = at(0, 0);
    const outside = at(120, 120);
    // Wilderness is untouched: exactly the reference, so the top surface there
    // is bit-identical to a bubble built before this existed.
    expect(Array.from(outside)).toEqual([1, 1, 1]);
    // The town is browner: green falls, red rises.
    expect(inside[1]).toBeCloseTo(0.78, 2);
    expect(inside[0]).toBeGreaterThan(1);

    /* The feather is a RAMP, not a contour. Sampled straight out through the
     * ring's edge, the green ratio climbs back monotonically to 1. */
    const walk: number[] = [];
    for (let d = 0; d <= TOWN_FLOOR_FEATHER_M + 6; d += 2) walk.push(at(RING + d, 0)[1]);
    expect(walk[0]).toBeLessThan(1);
    expect(walk[walk.length - 1]).toBeCloseTo(1, 6);
    for (let i = 1; i < walk.length; i++) expect(walk[i]).toBeGreaterThanOrEqual(walk[i - 1] - 1e-6);
    // And it really does span the feather rather than snapping at the edge.
    expect(new Set(walk).size).toBeGreaterThan(4);
  });
});
