/** GG-536 (2026-11-01): a region river that carries its flood level from the
 * grade along its FULL course cuts the same bed wherever a ground window
 * starts. Before, each window graded the channel from its own first point
 * (the bank there, then the atlas fall), so two windows that shared a river
 * stepped at their seam. */
import { describe, expect, it } from 'vitest';
import { carveRiverBedsDownhill, type GroundPolyline } from '../groundChunkLoader';
import { GROUND_METERS_PER_CELL } from '../groundWorldAdapter';
import { heightToMeters, metersToHeight } from '@/systems/world3d/config';
import { riverChannelSection } from '../../region/riverChannel';

const COLS = 80;
const ROWS = 40;
const WIDTH_M = 12;
const SLOPE = 0.002;

/** A straight river along z = 30 m over flat ground at `groundM`, with its
 * flood level falling 0.002 m per m from 9 m at x = 0 (world x = x + offsetM). */
function window(offsetM: number, groundM: number) {
  const heights = new Array<number>(COLS * ROWS).fill(metersToHeight(groundM));
  const points = Array.from({ length: 30 }, (_, k) => ({ x: k * 4, z: 30 }));
  const river: GroundPolyline = {
    points,
    widthM: WIDTH_M,
    sourceKind: 'river',
    widthAtM: points.map(() => WIDTH_M),
    slopeAt: points.map(() => SLOPE),
    floodAtM: points.map((p) => 9 - SLOPE * (p.x + offsetM)),
  };
  carveRiverBedsDownhill([river], heights, COLS, ROWS, []);
  const bedAt = (worldX: number): number => {
    const x = worldX - offsetM;
    return heightToMeters(heights[Math.round(30 / GROUND_METERS_PER_CELL) * COLS + Math.round(x / GROUND_METERS_PER_CELL)]);
  };
  return { bedAt };
}

describe('GG-536 river bed from the full-course grade', () => {
  const depth = riverChannelSection(WIDTH_M, SLOPE).depthM;

  it('cuts the bed at the flood level less the channel depth', () => {
    const w = window(0, 10);
    for (const x of [8, 40, 80]) expect(w.bedAt(x)).toBeCloseTo(9 - SLOPE * x - depth, 1);
  });

  it('cuts the same bed at a shared point whichever window starts where, and whatever its banks', () => {
    // Window B starts 40 m downstream of window A, on ground 2 m higher: the
    // old per-window grade began at each window's own bank and stepped here.
    const a = window(0, 10);
    const b = window(40, 12);
    for (const x of [48, 64, 80]) expect(Math.abs(a.bedAt(x) - b.bedAt(x))).toBeLessThan(0.02);
  });
});
