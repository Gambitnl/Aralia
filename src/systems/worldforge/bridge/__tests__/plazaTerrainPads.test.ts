/**
 * GG-593: a paved square on a hillside gets a gentle pad, so the props on it
 * pass the 10 degree surface gate; flat ground and the land round it keep
 * their heights.
 */
import { describe, expect, it } from 'vitest';
import { gradePlazaTerrainPads, PLAZA_MAX_GRADE_DEG } from '../plazaTerrainPads';
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

describe('gradePlazaTerrainPads', () => {
  it('holds a steep square to the gentle grade and keeps its mean level', () => {
    const h = hill(15), before = h.slice();
    const [receipt] = gradePlazaTerrainPads(h, COLS, ROWS, CELL, [square(10, 10, 40, 40)]);
    expect(receipt.naturalGradeDeg).toBeCloseTo(15, 3);
    expect(receipt.gradeDeg).toBeCloseTo(PLAZA_MAX_GRADE_DEG, 3);
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
    expect(receipt.gradeDeg).toBeCloseTo(3, 3);
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

  it('skips a sliver with fewer than three grid nodes', () => {
    const h = hill(15), before = h.slice();
    expect(gradePlazaTerrainPads(h, COLS, ROWS, CELL, [square(10.1, 10.1, 10.9, 10.9)])).toEqual([]);
    expect(h).toEqual(before);
  });
});
