import { describe, it, expect } from 'vitest';
import { buildGateMesh } from '../gateGeometry';
import type { ChunkData } from '../types';

function chunkWithGate(form: 'twinTowers' | 'tunnelBlock' | 'singleTower'): ChunkData {
  const res = 4;
  return {
    cx: 0, cy: 0, resolution: res,
    heights: new Float32Array(res * res).fill(50),
    biomeIds: Array(res * res).fill('grass'),
    rivers: [], roads: [], sites: [],
    gatehouses: [{ x: 2, y: 2, angleRad: 0.3, gapHalfM: 4, form, colorHex: '#8a877f' }],
  };
}

describe('buildGateMesh', () => {
  for (const form of ['twinTowers', 'tunnelBlock', 'singleTower'] as const) {
    it(`emits well-formed geometry for ${form}`, () => {
      const g = buildGateMesh(chunkWithGate(form));
      expect(g.positions.length).toBeGreaterThan(0);
      expect(g.positions.length % 3).toBe(0);
      expect(g.normals.length).toBe(g.positions.length);
      expect(g.colors.length).toBe(g.positions.length);
      expect(Math.max(...Array.from(g.indices))).toBeLessThan(g.positions.length / 3);
      expect(Array.from(g.positions).every(Number.isFinite)).toBe(true);
    });
  }

  it('returns empty arrays when no gatehouses', () => {
    const d = chunkWithGate('twinTowers'); d.gatehouses = [];
    expect(buildGateMesh(d).positions.length).toBe(0);
  });

  it('towers rise well above their base (taller than the 3.2 m rampart)', () => {
    const g = buildGateMesh(chunkWithGate('twinTowers'));
    let minY = Infinity, maxY = -Infinity;
    for (let i = 1; i < g.positions.length; i += 3) { minY = Math.min(minY, g.positions[i]); maxY = Math.max(maxY, g.positions[i]); }
    expect(maxY - minY).toBeGreaterThan(4.5);
  });
});
