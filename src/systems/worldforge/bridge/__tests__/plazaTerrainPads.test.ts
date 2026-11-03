/**
 * GG-593: a paved square on a hillside gets a gentle pad, so the props on it
 * pass the 10 degree surface gate; flat ground and the land round it keep
 * their heights.
 * GG-613: an edge that steps more than PAD_WALL_STEP_M gets a retaining wall,
 * and a street that meets a pad climbs to it at no more than PAD_RAMP_GRADE.
 * GG-614: a pad can carry its own grade limit (a churchyard).
 */
import { describe, expect, it } from 'vitest';
import {
  gradePlazaTerrainPads, retainPadEdges, PLAZA_MAX_GRADE_DEG, PAD_WALL_STEP_M, PAD_RAMP_GRADE,
} from '../plazaTerrainPads';
import { metersToHeight } from '../../../world3d/config';

const CELL = 1.524;
const COLS = 40, ROWS = 40;
const PER_M = metersToHeight(1);
const square = (x0: number, z0: number, x1: number, z1: number) =>
  ({ pointsM: [{ x: x0, z: z0 }, { x: x1, z: z0 }, { x: x1, z: z1 }, { x: x0, z: z1 }] });
/** A hillside that rises `deg` degrees along +x. */
const hill = (deg: number) => Array.from({ length: COLS * ROWS }, (_, i) =>
  (i % COLS) * CELL * Math.tan((deg * Math.PI) / 180) * PER_M + 20);
const gradeAt = (h: number[], col: number, row: number) =>
  (Math.atan((h[row * COLS + col + 1] - h[row * COLS + col]) / PER_M / CELL) * 180) / Math.PI;
const meters = (h: number[], col: number, row: number) => h[row * COLS + col] / PER_M;

describe('gradePlazaTerrainPads', () => {
  it('holds a steep square to the gentle grade and keeps its mean level', () => {
    const h = hill(15), before = h.slice();
    const [receipt] = gradePlazaTerrainPads(h, COLS, ROWS, CELL, [square(10, 10, 40, 40)]);
    expect(receipt!.naturalGradeDeg).toBeCloseTo(15, 3);
    expect(receipt!.gradeDeg).toBeCloseTo(PLAZA_MAX_GRADE_DEG, 3);
    expect(gradeAt(h, 15, 15)).toBeCloseTo(PLAZA_MAX_GRADE_DEG, 3);
    // Cut and fill balance: the pad's mean height is the ground's mean.
    const inside: number[] = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const x = c * CELL, z = r * CELL;
      if (x > 10 && x < 40 && z > 10 && z < 40) inside.push(r * COLS + c);
    }
    const mean = (a: number[]) => inside.reduce((s, i) => s + a[i], 0) / inside.length;
    expect(mean(h)).toBeCloseTo(mean(before), 6);
    // Ground two cells outside the pad is untouched.
    expect(h[15 * COLS + 30]).toBe(before[15 * COLS + 30]);
  });

  it('leaves a square that is already gentle on its own fall', () => {
    const h = hill(3), before = h.slice();
    const [receipt] = gradePlazaTerrainPads(h, COLS, ROWS, CELL, [square(10, 10, 40, 40)]);
    expect(receipt!.gradeDeg).toBeCloseTo(3, 3);
    for (let i = 0; i < h.length; i++) expect(h[i]).toBeCloseTo(before[i], 9);
  });

  it('lets the first plaza win where a second one overlaps it', () => {
    const h = hill(15);
    gradePlazaTerrainPads(h, COLS, ROWS, CELL, [square(10, 10, 30, 30)]);
    const first = h.slice();
    const h2 = hill(15);
    gradePlazaTerrainPads(h2, COLS, ROWS, CELL, [square(10, 10, 30, 30), square(20, 10, 45, 30)]);
    // A node inside the first square keeps the first square's height.
    expect(h2[12 * COLS + 15]).toBe(first[12 * COLS + 15]);
  });

  it('skips a sliver with fewer than three grid nodes, and says so in its receipt slot', () => {
    const h = hill(15), before = h.slice();
    // One receipt slot per pad, in order, so a later pass can pair them.
    expect(gradePlazaTerrainPads(h, COLS, ROWS, CELL, [square(10.1, 10.1, 10.9, 10.9)])).toEqual([undefined]);
    expect(h).toEqual(before);
  });

  it('keeps a pad\'s own grade limit (GG-614)', () => {
    const h = hill(15);
    const [receipt] = gradePlazaTerrainPads(h, COLS, ROWS, CELL, [{ ...square(10, 10, 40, 40), maxGradeDeg: 10 }]);
    expect(receipt!.gradeDeg).toBeCloseTo(10, 3);
  });
});

describe('retainPadEdges (GG-613)', () => {
  // A level pad cut into a 12 degree hillside: its high (+x) edge is cut and
  // its low edge filled by well over PAD_WALL_STEP_M.
  const setup = (streets: Array<{ points: Array<{ x: number; z: number }>; widthM: number }> = []) => {
    const h = hill(12), natural = h.slice();
    const pads = [{ ...square(15, 15, 35, 35), maxGradeDeg: 0 }];
    const receipts = gradePlazaTerrainPads(h, COLS, ROWS, CELL, pads);
    const edges = retainPadEdges(h, natural, COLS, ROWS, CELL, pads, receipts, streets);
    return { h, natural, edges, padY: receipts[0]!.plane.mean / PER_M };
  };

  it('walls an edge that steps more than the limit, from the lower ground to above the higher', () => {
    const { edges, padY } = setup();
    expect(edges.walls.length).toBeGreaterThan(0);
    expect(edges.walledM).toBeGreaterThan(0);
    for (const w of edges.walls) {
      expect(w.topY).toHaveLength(w.points.length);
      for (let i = 0; i < w.points.length; i++) {
        expect(w.topY[i] - w.baseY[i]).toBeGreaterThan(PAD_WALL_STEP_M);
        // The top stands above the pad, the base below it, or the reverse for a cut.
        expect(w.topY[i]).toBeGreaterThan(Math.min(padY, w.baseY[i]));
      }
    }
  });

  it('keeps the pad level up to a walled edge, so a piece on the edge stands on the pad', () => {
    const { h, padY } = setup();
    // The last node inside the pad on the cut (+x) side, and the one past the edge.
    const row = 16, inCol = Math.floor(35 / CELL), outCol = inCol + 1;
    expect(meters(h, inCol, row)).toBeCloseTo(padY, 6);
    expect(meters(h, outCol, row)).toBeCloseTo(padY, 6);
  });

  it('builds no wall where the step is under the limit', () => {
    const h = hill(1), natural = h.slice();
    const pads = [{ ...square(15, 15, 35, 35), maxGradeDeg: 0 }];
    const receipts = gradePlazaTerrainPads(h, COLS, ROWS, CELL, pads);
    const edges = retainPadEdges(h, natural, COLS, ROWS, CELL, pads, receipts, []);
    expect(edges.walls).toEqual([]);
  });

  it('opens the wall for a street and grades the street to the pad at no more than 1 in 8', () => {
    // A street across the slope (level ground along it) that leaves the pad's
    // +z edge near its cut side, where the pad stands well below the ground.
    const x = 33;
    const street = { points: [{ x, z: 25 }, { x, z: 60 }], widthM: 4 };
    const { h, natural, edges } = setup([street]);
    // No wall stands on the street.
    for (const w of edges.walls) for (const p of w.points) expect(Math.abs(p.x - x) > 2 + 1 || p.z < 35).toBe(true);
    expect(edges.rampedEntries).toBeGreaterThan(0);
    // Along the street, the ground climbs from the pad at 1 in 8 at most and
    // joins the natural ground.
    const col = Math.round(x / CELL);
    let prev = meters(h, col, Math.floor(35 / CELL));
    let joined = false;
    for (let r = Math.floor(35 / CELL) + 1; r < ROWS; r++) {
      const y = meters(h, col, r);
      expect(Math.abs(y - prev)).toBeLessThanOrEqual(PAD_RAMP_GRADE * CELL + 1e-9);
      prev = y;
      if (Math.abs(y - natural[r * COLS + col] / PER_M) < 1e-9) joined = true;
    }
    expect(joined).toBe(true);
  });
});
