import { describe, it, expect } from 'vitest';
import { buildRoofGeometry } from '../buildingModels';

const maxY = (g: { positions: Float32Array }) => {
  let m = -Infinity;
  for (let i = 1; i < g.positions.length; i += 3) m = Math.max(m, g.positions[i]);
  return m;
};

describe('buildRoofGeometry', () => {
  for (const form of ['gable', 'hip', 'steep', 'flat'] as const) {
    it(`${form} roof geometry is well-formed`, () => {
      const g = buildRoofGeometry(form, 8, 6, 2);
      expect(g.positions.length).toBeGreaterThan(0);
      expect(g.positions.length % 3).toBe(0);
      expect(g.normals.length).toBe(g.positions.length);
      expect(Math.max(...Array.from(g.indices))).toBeLessThan(g.positions.length / 3);
      expect(Array.from(g.positions).every(Number.isFinite)).toBe(true);
    });
  }

  it('gable peaks at the given rise; flat stays low', () => {
    expect(maxY(buildRoofGeometry('gable', 8, 6, 2))).toBeCloseTo(2, 5);
    expect(maxY(buildRoofGeometry('flat', 8, 6, 2))).toBeLessThan(1);
  });

  it('steep is taller than gable for the same rise', () => {
    expect(maxY(buildRoofGeometry('steep', 8, 6, 2))).toBeGreaterThan(maxY(buildRoofGeometry('gable', 8, 6, 2)));
  });
});
