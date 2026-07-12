/**
 * These tests prove that architecture districts are stable spatial identities,
 * not another random style roll attached to individual houses.
 *
 * They cover settlement scaling, affine-frame invariance, civic naming, and the
 * real town-generator wiring that gives every generated plot a unique building
 * key while multiple neighboring wards repeat a district key.
 */
import { describe, expect, it } from 'vitest';
import {
  architectureDistrictCount,
  assignArchitectureDistricts,
} from '../architectureDistricts';
import { generateTownPlan } from '../townEngine';
import { rootSeedPath } from '../../seedPath';
import type { Pt } from '../../submap/submapEngine';

describe('architectureDistrictCount', () => {
  it('keeps villages coherent and grows cities to a bounded district count', () => {
    expect(architectureDistrictCount(0)).toBe(0);
    expect(architectureDistrictCount(3)).toBe(1);
    expect(architectureDistrictCount(8)).toBe(2);
    expect(architectureDistrictCount(15)).toBe(3);
    expect(architectureDistrictCount(24)).toBe(4);
    expect(architectureDistrictCount(64)).toBe(8);
    expect(architectureDistrictCount(400)).toBe(8);
  });
});

describe('assignArchitectureDistricts', () => {
  const center: Pt = [50, 50];
  const centroids: Pt[] = [
    [75, 50], [70, 65], [50, 75], [30, 65],
    [25, 50], [30, 35], [50, 25], [70, 35],
  ];
  const civics = ['plaza', undefined, undefined, undefined, undefined, undefined, 'temple', undefined] as const;
  const seedPath = rootSeedPath(417);

  it('is deterministic and invariant under town scale and translation', () => {
    const original = assignArchitectureDistricts(centroids, center, civics, seedPath);
    const transformed = assignArchitectureDistricts(
      centroids.map(([x, y]) => [x * 7 + 300, y * 7 - 120]),
      [center[0] * 7 + 300, center[1] * 7 - 120],
      civics,
      seedPath,
    );

    expect(assignArchitectureDistricts(centroids, center, civics, seedPath)).toEqual(original);
    expect(transformed).toEqual(original);
    expect(new Set(original.map((district) => district.key)).size).toBe(2);
  });

  it('uses civic anchors for readable district labels without using labels as keys', () => {
    const districts = assignArchitectureDistricts(centroids, center, civics, seedPath);
    expect(districts.some((district) => district.label === 'Market District')).toBe(true);
    expect(districts.every((district) => /^district:\d+$/.test(district.key))).toBe(true);
  });

  it('keeps every district inside one contiguous angular sector', () => {
    const districts = assignArchitectureDistricts(centroids, center, civics, seedPath);
    const sectorWidth = Math.PI * 2 / architectureDistrictCount(centroids.length);
    const keys = new Set(districts.map((district) => district.key));

    for (const key of keys) {
      const angles = centroids
        .filter((_, index) => districts[index].key === key)
        .map(([x, y]) => ((Math.atan2(y - center[1], x - center[0]) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2))
        .sort((a, b) => a - b);
      if (angles.length <= 1) continue;

      // The smallest circular arc containing the district equals a full turn
      // minus its largest empty gap. It may touch, but never exceed, one sector.
      const gaps = angles.map((angle, index) => {
        const next = angles[(index + 1) % angles.length] + (index === angles.length - 1 ? Math.PI * 2 : 0);
        return next - angle;
      });
      const containingArc = Math.PI * 2 - Math.max(...gaps);
      expect(containingArc).toBeLessThanOrEqual(sectorWidth + 1e-9);
    }
  });

  it('rejects mismatched centroid and civic inputs instead of guessing', () => {
    expect(() => assignArchitectureDistricts(centroids, center, [], seedPath))
      .toThrow(/centroids.*civic/i);
  });
});

describe('town architecture district wiring', () => {
  it('gives a city repeated spatial district keys and unique building keys', () => {
    const footprint: Pt[] = [[0, 0], [180, 0], [210, 130], [105, 210], [0, 150]];
    const plan = generateTownPlan(footprint, rootSeedPath(90210), { population: 12000 });
    const districts = plan.wards.map((ward) => ward.architectureDistrict);
    const buildingKeys = plan.plots.map((plot) => plot.architectureKey);

    expect(districts.every(Boolean)).toBe(true);
    expect(new Set(districts.map((district) => district!.key)).size).toBeGreaterThan(1);
    expect(new Set(districts.map((district) => district!.key)).size).toBeLessThan(plan.wards.length);
    expect(buildingKeys.every(Boolean)).toBe(true);
    expect(new Set(buildingKeys).size).toBe(buildingKeys.length);
  });
});
