/** Dense rows keep usable physical lots inside their existing ward boundary. */
import { describe, expect, it } from 'vitest';
import { rootSeedPath } from '../../seedPath';
import { packWardFrontage } from '../townEngine';
import type { Pt } from '../../submap/submapEngine';

describe('character-scale street parcels', () => {
  it('retains larger source dimensions rather than collapsing to 15/20ft boxes', () => {
    const ward: Pt[] = [[0, 0], [240, 0], [240, 240], [0, 240]];
    const plots = packWardFrontage(ward, rootSeedPath(792767481), {
      plotWidth: 50, plotDepth: 45, partyWallRows: true, variety: false,
    });
    expect(plots.length).toBeGreaterThan(0);
    expect(plots.length).toBeLessThan(24);
    for (const { polygon } of plots) {
      const width = Math.hypot(polygon[1][0] - polygon[0][0], polygon[1][1] - polygon[0][1]);
      const depth = Math.hypot(polygon.at(-1)![0] - polygon[0][0], polygon.at(-1)![1] - polygon[0][1]);
      expect(width).toBeGreaterThanOrEqual(40 - 1e-8);
      expect(depth).toBeCloseTo(45);
      expect(width / 5).toBeCloseTo(Math.round(width / 5));
      for (const [x, y] of polygon) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(240);
        expect(y).toBeLessThanOrEqual(240);
      }
    }
  });
});
