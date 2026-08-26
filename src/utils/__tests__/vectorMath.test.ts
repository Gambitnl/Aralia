import { describe, it, expect } from 'vitest';
import {
  addVector2D,
  subtractVector2D,
  scaleVector2D,
  dotProduct2D,
  crossProduct2D,
  magnitude2D,
  magnitudeSquared2D,
  normalizeVector2D,
  distance2D,
  manhattanDistance2D,
  chebyshevDistance2D,
  lerpVector2D,
  rotateVector2D,
  clampVector2D,
  areVectorsEqual2D,
  addVector3D,
  subtractVector3D,
  scaleVector3D,
  dotProduct3D,
  crossProduct3D,
  magnitude3D,
  magnitudeSquared3D,
  normalizeVector3D,
  distance3D,
  lerpVector3D,
  areVectorsEqual3D,
} from '../spatial/vectorMath';

/**
 * This test suite verifies 2D and 3D vector arithmetic and distance functions.
 *
 * Vector math is used throughout combat grid targeting, 3D world navigation,
 * spell trajectory calculations, and movement pathing.
 *
 * Covers: utils/spatial/vectorMath.ts
 * Tests: Vector additions, subtractions, scaling, dot products, cross products,
 * magnitudes, normalization, distance heuristics, lerp, and rotations.
 */

// ============================================================================
// 2D Vector Operation Tests
// ============================================================================
// Verifies 2D grid coordinates, distance metrics, and 2D rotation math.
// ============================================================================

describe('VectorMath - 2D Vector Operations', () => {
  it('should add, subtract, and scale 2D vectors', () => {
    const a = { x: 3, y: 4 };
    const b = { x: 1, y: 2 };

    expect(addVector2D(a, b)).toEqual({ x: 4, y: 6 });
    expect(subtractVector2D(a, b)).toEqual({ x: 2, y: 2 });
    expect(scaleVector2D(a, 2)).toEqual({ x: 6, y: 8 });
  });

  it('should calculate dot product and 2D cross product', () => {
    const a = { x: 1, y: 0 };
    const b = { x: 0, y: 1 };

    // Perpendicular vectors have 0 dot product
    expect(dotProduct2D(a, b)).toBe(0);

    // Parallel vectors dot product = |a||b|
    expect(dotProduct2D({ x: 2, y: 0 }, { x: 3, y: 0 })).toBe(6);

    // 2D cross product of (1,0) x (0,1) = 1
    expect(crossProduct2D(a, b)).toBe(1);
    expect(crossProduct2D(b, a)).toBe(-1);
  });

  it('should calculate magnitude and squared magnitude', () => {
    const v = { x: 3, y: 4 };
    expect(magnitudeSquared2D(v)).toBe(25);
    expect(magnitude2D(v)).toBe(5);
  });

  it('should normalize vectors and handle zero vectors safely', () => {
    const v = { x: 0, y: 10 };
    const normalized = normalizeVector2D(v);
    expect(normalized.x).toBe(0);
    expect(normalized.y).toBe(1);

    const zero = { x: 0, y: 0 };
    expect(normalizeVector2D(zero)).toEqual({ x: 0, y: 0 });
  });

  it('should calculate Euclidean, Manhattan, and Chebyshev distances', () => {
    const p1 = { x: 0, y: 0 };
    const p2 = { x: 3, y: 4 };

    // Euclidean: sqrt(3^2 + 4^2) = 5
    expect(distance2D(p1, p2)).toBe(5);

    // Manhattan (taxicab): 3 + 4 = 7
    expect(manhattanDistance2D(p1, p2)).toBe(7);

    // Chebyshev (diagonal/king moves): max(3, 4) = 4
    expect(chebyshevDistance2D(p1, p2)).toBe(4);
  });

  it('should linearly interpolate between two 2D points', () => {
    const start = { x: 0, y: 0 };
    const end = { x: 10, y: 20 };

    expect(lerpVector2D(start, end, 0)).toEqual({ x: 0, y: 0 });
    expect(lerpVector2D(start, end, 0.5)).toEqual({ x: 5, y: 10 });
    expect(lerpVector2D(start, end, 1)).toEqual({ x: 10, y: 20 });
  });

  it('should rotate a 2D vector by an angle in radians', () => {
    const v = { x: 1, y: 0 };
    // Rotate 90 degrees (Math.PI / 2) -> should point to (0, 1)
    const rotated = rotateVector2D(v, Math.PI / 2);
    expect(areVectorsEqual2D(rotated, { x: 0, y: 1 })).toBe(true);
  });

  it('should clamp vector coordinates within min and max bounds', () => {
    const v = { x: 15, y: -5 };
    const min = { x: 0, y: 0 };
    const max = { x: 10, y: 10 };

    expect(clampVector2D(v, min, max)).toEqual({ x: 10, y: 0 });
  });
});

// ============================================================================
// 3D Vector Operation Tests
// ============================================================================
// Verifies 3D coordinates, 3D cross products, and 3D distances.
// ============================================================================

describe('VectorMath - 3D Vector Operations', () => {
  it('should add, subtract, and scale 3D vectors', () => {
    const a = { x: 1, y: 2, z: 3 };
    const b = { x: 4, y: 5, z: 6 };

    expect(addVector3D(a, b)).toEqual({ x: 5, y: 7, z: 9 });
    expect(subtractVector3D(b, a)).toEqual({ x: 3, y: 3, z: 3 });
    expect(scaleVector3D(a, 3)).toEqual({ x: 3, y: 6, z: 9 });
  });

  it('should calculate 3D dot product and 3D cross product', () => {
    const unitX = { x: 1, y: 0, z: 0 };
    const unitY = { x: 0, y: 1, z: 0 };

    expect(dotProduct3D(unitX, unitY)).toBe(0);

    // Cross product: X × Y = Z
    const cross = crossProduct3D(unitX, unitY);
    expect(cross).toEqual({ x: 0, y: 0, z: 1 });
  });

  it('should calculate 3D magnitude, normalization, and distance', () => {
    const v = { x: 2, y: 3, z: 6 }; // 4 + 9 + 36 = 49 -> sqrt(49) = 7
    expect(magnitudeSquared3D(v)).toBe(49);
    expect(magnitude3D(v)).toBe(7);

    const norm = normalizeVector3D(v);
    expect(areVectorsEqual3D(norm, { x: 2 / 7, y: 3 / 7, z: 6 / 7 })).toBe(true);

    const p1 = { x: 1, y: 1, z: 1 };
    const p2 = { x: 3, y: 4, z: 7 }; // dx=2, dy=3, dz=6 -> dist = 7
    expect(distance3D(p1, p2)).toBe(7);
  });

  it('should linearly interpolate in 3D space', () => {
    const a = { x: 0, y: 10, z: 20 };
    const b = { x: 10, y: 30, z: 40 };

    expect(lerpVector3D(a, b, 0.5)).toEqual({ x: 5, y: 20, z: 30 });
  });
});
