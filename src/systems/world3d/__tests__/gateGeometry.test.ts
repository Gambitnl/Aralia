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

// agora-257c (2026-10-28): faces wound once and outward; the water gate form.
describe('gate faces and water gates', () => {
  const faceNormalsAgree = (g: ReturnType<typeof buildGateMesh>): boolean => {
    for (let t = 0; t < g.indices.length; t += 3) {
      const [a, b, c] = [g.indices[t], g.indices[t + 1], g.indices[t + 2]].map((i) => i * 3);
      const p = g.positions;
      const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2];
      const vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
      const n = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
      if (n[0] * g.normals[a] + n[1] * g.normals[a + 1] + n[2] * g.normals[a + 2] <= 0) return false;
    }
    return true;
  };

  for (const form of ['twinTowers', 'tunnelBlock', 'singleTower', 'waterGate'] as const) {
    it(`winds every ${form} face once, toward its own normal`, () => {
      const d = chunkWithGate('twinTowers');
      d.gatehouses![0].form = form;
      const g = buildGateMesh(d);
      expect(faceNormalsAgree(g)).toBe(true);
      // Side faces are not lit as if they faced the sky.
      const sideNormals = Array.from({ length: g.normals.length / 3 }, (_, i) => g.normals[i * 3 + 1]).filter((y) => y === 0);
      expect(sideNormals.length).toBeGreaterThan(0);
    });
  }

  it('builds a water gate as two towers, the wall over the water and a grille', () => {
    const d = chunkWithGate('twinTowers');
    d.gatehouses![0].form = 'waterGate';
    const g = buildGateMesh(d);
    // Each box is 5 faces x 4 vertices: 2 towers + 1 wall section + at least 2 bars.
    expect(g.positions.length / 3 / 20).toBeGreaterThanOrEqual(5);
  });
});
