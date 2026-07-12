/**
 * @file regionRoadRibbons.test.ts
 * Verifies tier-aware 3D rural road ribbons (road-systems Task 9): route
 * polylines carry their tier tint through as colorHex, faint paths break into
 * a deterministic keep/skip patch cycle, and kind-less polylines (rivers)
 * keep their original untinted whole-ribbon behavior.
 */
import { describe, it, expect } from 'vitest';
import { regionPolylinesToGround } from '../groundChunkLoader';
import { ROAD_3D_TIERS } from '../../travel/roadTunables';

const local = { bounds: { x: 0, y: 0, width: 3000, height: 3000 } } as any;
const line = (n: number, kind?: 'highway' | 'road' | 'trail' | 'path') => ({
  centerline: Array.from({ length: n }, (_, i) => [i * 100, 500] as [number, number]),
  widthFt: kind ? ROAD_3D_TIERS[kind].widthFt : 30,
  ...(kind ? { kind } : {}),
});

describe('regionPolylinesToGround (tier ribbons)', () => {
  it('carries the tier tint through as colorHex', () => {
    const [road] = regionPolylinesToGround([line(5, 'road')], local);
    expect(road.colorHex).toBe(ROAD_3D_TIERS.road.colorHex);
    const [hwy] = regionPolylinesToGround([line(5, 'highway')], local);
    expect(hwy.colorHex).toBe(ROAD_3D_TIERS.highway.colorHex);
  });
  it('leaves kind-less polylines (rivers) untinted and whole', () => {
    const out = regionPolylinesToGround([line(30)], local);
    expect(out).toHaveLength(1);
    expect(out[0].colorHex).toBeUndefined();
  });
  it('breaks paths into a deterministic keep/skip patch cycle', () => {
    const n = 30;
    const out = regionPolylinesToGround([line(n, 'path')], local);
    expect(out.length).toBeGreaterThan(1); // broken wear-line, not one ribbon
    // Every emitted patch is a renderable polyline and total points < input
    // (the skip windows are dropped).
    const totalPts = out.reduce((s, p) => s + p.points.length, 0);
    expect(totalPts).toBeLessThan(n);
    for (const p of out) expect(p.points.length).toBeGreaterThanOrEqual(2);
    // Deterministic: same input → same patches.
    const again = regionPolylinesToGround([line(n, 'path')], local);
    expect(JSON.stringify(again)).toBe(JSON.stringify(out));
  });
  it('roads and trails stay one continuous ribbon', () => {
    expect(regionPolylinesToGround([line(30, 'road')], local)).toHaveLength(1);
    expect(regionPolylinesToGround([line(30, 'trail')], local)).toHaveLength(1);
  });
});
