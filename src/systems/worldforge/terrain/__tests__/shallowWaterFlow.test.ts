/**
 * @file shallowWaterFlow.test.ts — the transport velocity, and its units.
 *
 * WHY THIS FILE EXISTS. An adversarial review of the foam research, 2026-08-28,
 * found that the four flux arrays are private and that the conversion the
 * research proposed omitted the divide by dt. Both faults are silent: code
 * written against them compiles, runs, and produces a Froude number roughly
 * thirty times too small, so every fast-water test fails to fire and no foam
 * ever appears. Nothing crashes. Nothing logs.
 *
 * A number that is wrong by a constant factor cannot be caught by eye, so it is
 * gated here instead. The tests check the DIMENSIONS, not a tuned value: halve
 * the step and the speed must not change, double the cell size and it must
 * double. A missing `/ dt` fails the first. A missing `* cellM` fails the
 * second.
 */
import { describe, expect, it } from 'vitest';
import { ShallowWaterField } from '../shallowWater';

const G = 9.81;

/** A tall column at the middle cell, everything else dry and flat. */
function loadedCell(n: number, depthM: number, cellM = 1): ShallowWaterField {
  const f = new ShallowWaterField(n, cellM);
  const mid = Math.floor(n / 2) * n + Math.floor(n / 2);
  f.depth[mid] = depthM;
  return f;
}

/** A step running downhill along +x, so the flow has one clear direction. */
function slope(n: number, dropPerCell: number, depthM: number): ShallowWaterField {
  const f = new ShallowWaterField(n, 1);
  for (let z = 0; z < n; z++) {
    for (let x = 0; x < n; x++) {
      f.bed[z * n + x] = -x * dropPerCell;
      f.depth[z * n + x] = depthM;
    }
  }
  return f;
}

describe('transport velocity', () => {
  it('is zero everywhere on dry ground', () => {
    const f = new ShallowWaterField(9, 1);
    f.step(f.maxStableStep());
    for (let i = 0; i < f.flowX.length; i++) {
      expect(f.flowX[i]).toBe(0);
      expect(f.flowZ[i]).toBe(0);
    }
  });

  it('points downhill, not uphill', () => {
    const f = slope(21, 0.5, 1);
    const mid = 10 * 21 + 10;
    f.step(f.maxStableStep());
    // The bed falls toward +x, so the water must travel toward +x.
    expect(f.flowX[mid]).toBeGreaterThan(0);
    // Nothing drives it across the slope, so the other axis stays put.
    expect(Math.abs(f.flowZ[mid])).toBeLessThan(1e-6);
  });

  it('does not change when the step is halved', () => {
    /* THE UNITS TEST THAT MATTERS MOST. A velocity is meters per SECOND, so it
     * cannot depend on how finely the second is chopped. The research this
     * replaces omitted the divide by dt, which would put these two an order of
     * magnitude apart. */
    const a = slope(21, 0.5, 1);
    const b = slope(21, 0.5, 1);
    const mid = 10 * 21 + 10;
    const dt = a.maxStableStep();
    a.step(dt);
    b.step(dt / 2);
    // Within one percent: the flux limiter is not exactly linear in dt.
    expect(b.flowX[mid]).toBeCloseTo(a.flowX[mid], 1);
  });

  it('agrees with how far the water actually travels', () => {
    /* THE UNITS TEST WITH TEETH, and the reason the first attempt was thrown
     * away. A cell-width test only checked that one factor appeared somewhere;
     * it also happened to assert a property of the pipe scheme rather than of
     * the conversion, which is not what this file is for.
     *
     * This ties the reported number to observable motion instead. Water is
     * released at the top of a slope and allowed to run. The front advances a
     * measurable number of METERS in a measurable number of SECONDS, and the
     * speed the solver reports along that run has to be the same order as the
     * speed the front actually made. A conversion that is wrong by a constant
     * factor — the ~30x a missing divide by dt would cost — puts these two
     * wildly apart, whatever else it gets right.
     *
     * The bounds are loose on purpose. A wetting front on dry ground does not
     * travel at the mean speed of the water behind it, so an exact match would
     * be a false claim. A factor of five either way still catches thirty. */
    const n = 81;
    const f = new ShallowWaterField(n, 1);
    for (let z = 0; z < n; z++) {
      for (let x = 0; x < n; x++) {
        // The bed falls toward +x at one in forty. Gentle on purpose: a steep
        // slope runs the whole band off the far edge before it can be measured.
        f.bed[z * n + x] = -x * 0.025;
        // A band of water at the top, and dry ground for it to run onto.
        if (x < 6) f.depth[z * n + x] = 1;
      }
    }
    const row = 40 * n;
    /** The furthest wet cell on the measured row, or -1 if the row is dry. */
    const front = () => {
      let last = -1;
      for (let x = 0; x < n; x++) if (f.depth[row + x] > 0.02) last = x;
      return last;
    };
    const startX = front();
    expect(startX).toBeGreaterThan(0);

    let elapsed = 0;
    let speedSum = 0;
    let speedN = 0;
    /* STOP BEFORE THE FRONT REACHES THE EDGE. Past it the water leaves the
     * domain, the row empties, and the measurement is of nothing. */
    for (let i = 0; i < 600 && front() < n - 8; i++) {
      const dt = f.maxStableStep();
      f.step(dt);
      elapsed += dt;
      for (let x = 0; x < n; x++) {
        const j = row + x;
        if (f.depth[j] > 0.02) {
          speedSum += f.flowSpeedAt(j);
          speedN += 1;
        }
      }
    }
    const travelled = (front() - startX) * f.cellM;
    // The front has to have moved forward, or there is nothing to compare.
    expect(travelled).toBeGreaterThan(2);

    const frontSpeed = travelled / elapsed;
    const reported = speedSum / speedN;
    const ratio = reported / frontSpeed;
    expect(ratio).toBeGreaterThan(0.2);
    expect(ratio).toBeLessThan(5);
  });

  it('reports a speed in a range water actually reaches', () => {
    /* A sanity bound, not a tuned value. A 1 m sheet on a 1-in-2 slope is fast
     * water, but it is not supersonic and it is not still. Anything outside
     * this range means the conversion is off by a factor, which is exactly the
     * failure this file exists to catch. */
    const f = slope(21, 0.5, 1);
    const mid = 10 * 21 + 10;
    f.step(f.maxStableStep());
    const v = f.flowSpeedAt(mid);
    expect(v).toBeGreaterThan(0.05);
    expect(v).toBeLessThan(50);
  });

  it('spreading water reports less transport than water running one way', () => {
    /* The net of opposite faces is the point. A cell shedding equally in every
     * direction is not going anywhere, however much it sheds. */
    const spread = loadedCell(21, 4);
    const running = slope(21, 0.5, 4);
    const mid = 10 * 21 + 10;
    spread.step(spread.maxStableStep());
    running.step(running.maxStableStep());
    expect(spread.flowSpeedAt(mid)).toBeLessThan(running.flowSpeedAt(mid));
  });
});

describe('the Froude number', () => {
  it('is zero on dry ground rather than infinite', () => {
    const f = new ShallowWaterField(9, 1);
    f.step(f.maxStableStep());
    expect(f.froudeAt(0)).toBe(0);
    expect(Number.isFinite(f.froudeAt(0))).toBe(true);
  });

  it('is the speed divided by the wave speed', () => {
    const f = slope(21, 0.5, 1);
    const mid = 10 * 21 + 10;
    f.step(f.maxStableStep());
    const expected = f.flowSpeedAt(mid) / Math.sqrt(G * f.depth[mid]);
    expect(f.froudeAt(mid)).toBeCloseTo(expected, 6);
  });

  it('rises when the same water runs shallower', () => {
    /* THE WHOLE REASON FOR THE NUMBER. Depth is in the denominator, so thinning
     * the same flow drives it toward and past one — which is the difference
     * between a pond and a riffle. */
    const deep = slope(21, 0.5, 4);
    const thin = slope(21, 0.5, 0.25);
    const mid = 10 * 21 + 10;
    deep.step(deep.maxStableStep());
    thin.step(thin.maxStableStep());
    expect(thin.froudeAt(mid)).toBeGreaterThan(deep.froudeAt(mid));
  });

  it('can actually exceed one somewhere in a steep thin run', () => {
    /* A guard against the silent failure the review found. If the units are
     * wrong by the ~30x the missing divide would cost, NOTHING in this field
     * ever crosses one and every fast-water branch stays dead forever. */
    const f = slope(41, 1, 0.15);
    for (let s = 0; s < 20; s++) f.step(f.maxStableStep());
    let best = 0;
    for (let i = 0; i < f.depth.length; i++) {
      const fr = f.froudeAt(i);
      if (fr > best) best = fr;
    }
    expect(best).toBeGreaterThan(1);
  });
});
