import { describe, it, expect } from 'vitest';
import { calculateAffectedArea, polygonContains } from '../aoeCalculations';

// agora-79fa.2 (2026-09-13, GG-211): gridless Euclidean AoE polygons.
describe('calculateAffectedArea (gridless)', () => {
  it('Sphere: 20 ft radius is a 4-tile circle; a diagonal at 3,3 (4.24 tiles) is outside', () => {
    const poly = calculateAffectedArea({ shape: 'Sphere', origin: { x: 10, y: 10 }, size: 20 });
    expect(poly.circle).toEqual({ center: { x: 10, y: 10 }, radius: 4 });
    expect(poly.vertices).toHaveLength(32);
    expect(polygonContains(poly, { x: 14, y: 10 })).toBe(true);
    expect(polygonContains(poly, { x: 13, y: 13 })).toBe(false); // Euclidean 4.24 > 4
    expect(polygonContains(poly, { x: 12.8, y: 12.8 })).toBe(true); // 3.96 <= 4
  });

  it('Cone: 15 ft cone pointed East covers a point 2 tiles ahead and not one behind', () => {
    const poly = calculateAffectedArea({ shape: 'Cone', origin: { x: 5, y: 5 }, size: 15, direction: 90 });
    expect(poly.vertices[0]).toEqual({ x: 5, y: 5 });
    expect(poly.vertices).toHaveLength(14);
    expect(polygonContains(poly, { x: 7, y: 5 })).toBe(true);
    expect(polygonContains(poly, { x: 7.5, y: 6 })).toBe(true); // within atan(0.5) half angle
    expect(polygonContains(poly, { x: 3, y: 5 })).toBe(false);
    expect(polygonContains(poly, { x: 7, y: 7 })).toBe(false); // 45 deg off axis
  });

  // Ruling Q4 (2026-09-22): face anchor. The near face goes through the origin
  // point, is centered on it, and the square extends away from the caster.
  it('Cube: 10 ft cube, caster to the west, has its near face through the origin and extends east', () => {
    const poly = calculateAffectedArea({ shape: 'Cube', origin: { x: 2, y: 2 }, size: 10, casterPosition: { x: 0, y: 2 } });
    expect(poly.vertices).toEqual([
      { x: 2, y: 1 }, { x: 2, y: 3 }, { x: 4, y: 3 }, { x: 4, y: 1 },
    ]);
    expect(polygonContains(poly, { x: 3, y: 2 })).toBe(true);
    expect(polygonContains(poly, { x: 1.5, y: 2 })).toBe(false); // behind the near face
  });

  it('Cube: 15 ft cube, caster to the south, extends north', () => {
    const poly = calculateAffectedArea({ shape: 'Cube', origin: { x: 5, y: 5 }, size: 15, casterPosition: { x: 5, y: 9 } });
    expect(polygonContains(poly, { x: 5, y: 3 })).toBe(true);
    expect(polygonContains(poly, { x: 6.4, y: 2.5 })).toBe(true);
    expect(polygonContains(poly, { x: 5, y: 6 })).toBe(false); // on the caster side
  });

  it('Cube: throws when no direction exists', () => {
    expect(() => calculateAffectedArea({ shape: 'Cube', origin: { x: 2, y: 2 }, size: 10 })).toThrow(/Cube area needs a direction/);
  });

  it('Line: 30 ft line, 10 ft wide, to a target point is a rectangle one tile either side', () => {
    const poly = calculateAffectedArea({ shape: 'Line', origin: { x: 0, y: 0 }, size: 30, width: 10, targetPoint: { x: 6, y: 0 } });
    expect(poly.vertices).toHaveLength(4);
    expect(polygonContains(poly, { x: 3, y: 0.9 })).toBe(true);
    expect(polygonContains(poly, { x: 3, y: 1.5 })).toBe(false);
    expect(polygonContains(poly, { x: 7, y: 0 })).toBe(false);
  });

  it('Line without a target projects along the compass direction (0 = North = -y)', () => {
    const poly = calculateAffectedArea({ shape: 'Line', origin: { x: 5, y: 5 }, size: 20, direction: 0 });
    expect(polygonContains(poly, { x: 5, y: 2 })).toBe(true);
    expect(polygonContains(poly, { x: 5, y: 8 })).toBe(false);
  });
});
