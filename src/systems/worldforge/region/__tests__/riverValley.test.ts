/** Towns build down to the river (Remy 2026-11-01): a river's flood level
 * never rises downstream, and the ground beside it comes down to that level
 * over a floodplain, then climbs a gentle valley side to the land. */
import { describe, expect, it } from 'vitest';
import { elevationCurveFt } from '../../local/generateLocal';
import {
  FLOODPLAIN_WIDTHS,
  normalizedFromFt,
  riverGradeFt,
  valleyCutWeight,
  valleyReachFt,
  valleyTargetFt,
  VALLEY_REACH_CAP_FT,
  VALLEY_SIDE_SLOPE,
} from '../riverValley';

describe('river grade', () => {
  it('passes through a hump at the level the river had before it (Fapolis: 7 m, 19 m, 6 m)', () => {
    const ground = [23, 30, 45, 62, 60, 40, 20];
    expect(Array.from(riverGradeFt(ground, 0))).toEqual([23, 23, 23, 23, 23, 23, 20]);
  });

  it('follows ground that already falls downstream, and never drops under the dry floor', () => {
    expect(Array.from(riverGradeFt([50, 40, 30, 20], 25))).toEqual([50, 40, 30, 25]);
  });

  it('falls at least the atlas grade over flat ground, down to the drift cap (GG-536)', () => {
    // Flat ground at 100 ft, 2 ft of fall per step, at most 5 ft under the ground.
    const grade = riverGradeFt([100, 100, 100, 100, 100], 0, [0, 2, 2, 2, 2], [5, 5, 5, 5, 5]);
    expect(Array.from(grade)).toEqual([100, 98, 96, 95, 95]);
  });

  it('holds its level through a hump deeper than the drift cap, and never rises', () => {
    // The ground climbs past the cap (ground - 5 stands above the level): the
    // level neither rises with it nor keeps cutting down into it.
    const grade = riverGradeFt([100, 120, 140, 90], 0, [0, 2, 2, 2], [5, 5, 5, 5]);
    expect(Array.from(grade)).toEqual([100, 100, 100, 90]);
  });
});

describe('valley shape', () => {
  const half = 60, core = 50, depth = 5, width = 120;
  it('is the bed in the channel core and the flood level over the floodplain', () => {
    expect(valleyTargetFt(0, 400, half, core, depth, width)).toBe(395);
    expect(valleyTargetFt(55, 400, half, core, depth, width)).toBeCloseTo(397.5, 9);
    expect(valleyTargetFt(half + FLOODPLAIN_WIDTHS * width, 400, half, core, depth, width)).toBe(400);
  });

  it('climbs the valley side at 1 in 8 past the floodplain', () => {
    const edge = half + FLOODPLAIN_WIDTHS * width;
    expect(valleyTargetFt(edge + 80, 400, half, core, depth, width)).toBeCloseTo(400 + 80 * VALLEY_SIDE_SLOPE, 9);
  });

  it('reaches until the side stands above the highest ground, and fades out when capped', () => {
    expect(valleyReachFt(400, 440, width)).toBe(FLOODPLAIN_WIDTHS * width + 40 / VALLEY_SIDE_SLOPE);
    expect(valleyReachFt(400, 4000, width)).toBe(FLOODPLAIN_WIDTHS * width + VALLEY_REACH_CAP_FT);
    expect(valleyCutWeight(100, 500, false)).toBe(1);
    expect(valleyCutWeight(500, 500, false)).toBe(0);
    expect(valleyCutWeight(200, 1000, true)).toBe(1);
    expect(valleyCutWeight(700, 1000, true)).toBeCloseTo(0.5, 9);
  });
});

describe('normalizedFromFt', () => {
  it('inverts the elevation curve in the lowlands and the high country', () => {
    for (const n of [0, 0.2, 0.203, 0.5, 0.62, 0.9]) {
      expect(normalizedFromFt(elevationCurveFt(n))).toBeCloseTo(n, 6);
    }
  });
});
