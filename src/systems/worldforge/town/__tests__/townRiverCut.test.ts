/**
 * This file proves the river channel is cut out of the town land (GG-561):
 * a polygon splits along a line, the pieces in the channel go, the banks
 * become polygon edges, and the bank corners across the river pair up as the
 * links a bridge may join.
 */
import { describe, it, expect } from 'vitest';
import { cutRiverChannel, distToLines, offsetPolyline, splitPolygonByPolyline } from '../townRiverCut';
import type { Pt } from '../../submap/submapEngine';

const area = (p: Pt[]): number => Math.abs(p.reduce((s, a, i) => {
  const b = p[(i + 1) % p.length];
  return s + a[0] * b[1] - b[0] * a[1];
}, 0) / 2);
const centroid = (p: Pt[]): Pt => [p.reduce((s, q) => s + q[0], 0) / p.length, p.reduce((s, q) => s + q[1], 0) / p.length];

describe('townRiverCut (GG-561)', () => {
  it('splits a square in two along a line that crosses it', () => {
    const sq: Pt[] = [[0, 0], [100, 0], [100, 100], [0, 100]];
    const parts = splitPolygonByPolyline(sq, [[-10, 40], [110, 60]]);
    expect(parts).toHaveLength(2);
    expect(parts.reduce((s, p) => s + area(p), 0)).toBeCloseTo(10000, 6);
  });

  it('leaves a polygon whole when the line misses it', () => {
    const sq: Pt[] = [[0, 0], [100, 0], [100, 100], [0, 100]];
    expect(splitPolygonByPolyline(sq, [[-10, 140], [110, 160]])).toHaveLength(1);
  });

  it('splits along a bent line, corner included', () => {
    const sq: Pt[] = [[0, 0], [100, 0], [100, 100], [0, 100]];
    const parts = splitPolygonByPolyline(sq, [[-10, 30], [50, 50], [110, 30]]);
    expect(parts).toHaveLength(2);
    expect(parts.some((p) => p.some((q) => Math.abs(q[0] - 50) < 1e-9 && Math.abs(q[1] - 50) < 1e-9))).toBe(true);
  });

  it('offsets a line to its left by the distance asked', () => {
    const off = offsetPolyline([[0, 0], [100, 0]], 10, 0);
    for (const p of off) expect(p[1]).toBeCloseTo(10, 9);
  });

  it('cuts the channel out of the wards: no piece center in the water, banks as edges', () => {
    const river: Pt[][] = [[[50, -100], [50, 300]]];
    const wards: Pt[][] = [
      [[0, 0], [100, 0], [100, 100], [0, 100]],
      [[0, 100], [100, 100], [100, 200], [0, 200]],
    ];
    const cut = cutRiverChannel(wards, river, 10, 1, 500);
    // Each ward splits into a west and an east piece; the strip x in [40, 60] goes.
    expect(cut.polys).toHaveLength(4);
    for (const p of cut.polys) {
      expect(distToLines(centroid(p), river)).toBeGreaterThan(10);
      for (const q of p) expect(Math.abs(q[0] - 50)).toBeGreaterThanOrEqual(10 - 1e-9);
    }
    expect(cut.from).toEqual([0, 0, 1, 1]);
    // The street between the two wards crossed the river: one link per side.
    expect(cut.links.length).toBeGreaterThan(0);
    for (const l of cut.links) {
      expect(Math.abs(l.a[0] - 50)).toBeCloseTo(10, 6);
      expect(Math.abs(l.b[0] - 50)).toBeCloseTo(10, 6);
      expect(Math.sign(l.a[0] - 50)).not.toBe(Math.sign(l.b[0] - 50));
    }
  });

  it('drops a piece smaller than the floor', () => {
    const river: Pt[][] = [[[95, -100], [95, 300]]];
    const cut = cutRiverChannel([[[0, 0], [100, 0], [100, 100], [0, 100]]], river, 3, 50 * 50, 500);
    // The sliver east of the river (x in [98, 100]) is under the floor.
    expect(cut.polys).toHaveLength(1);
    expect(Math.max(...cut.polys[0].map((q) => q[0]))).toBeCloseTo(92, 6);
  });
});
