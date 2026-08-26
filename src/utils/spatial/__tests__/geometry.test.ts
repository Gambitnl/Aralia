import { describe, it, expect } from 'vitest';
import {
  radiansToDegrees,
  degreesToRadians,
  normalizeAngle,
  compassToMathAngle,
  mathToCompassAngle,
  getAngleBetweenPositions,
  facingToDegrees,
  facingToVector,
  facingFromPositions
} from '../geometry';

describe('geometry utils', () => {
  describe('conversions', () => {
    it('converts radians to degrees', () => {
      expect(radiansToDegrees(Math.PI)).toBeCloseTo(180);
      expect(radiansToDegrees(Math.PI / 2)).toBeCloseTo(90);
    });

    it('converts degrees to radians', () => {
      expect(degreesToRadians(180)).toBeCloseTo(Math.PI);
      expect(degreesToRadians(90)).toBeCloseTo(Math.PI / 2);
    });
  });

  describe('normalizeAngle', () => {
    it('keeps 0-359 unchanged', () => {
      expect(normalizeAngle(0)).toBe(0);
      expect(normalizeAngle(180)).toBe(180);
      expect(normalizeAngle(359)).toBe(359);
    });

    it('wraps negative angles', () => {
      expect(normalizeAngle(-90)).toBe(270);
      expect(normalizeAngle(-360)).toBe(0);
    });

    it('wraps overflow angles', () => {
      expect(normalizeAngle(360)).toBe(0);
      expect(normalizeAngle(450)).toBe(90);
    });
  });

  describe('compass/math mapping', () => {
    it('converts compass to math', () => {
      // North (0) -> -90
      expect(compassToMathAngle(0)).toBe(-90);
      // East (90) -> 0
      expect(compassToMathAngle(90)).toBe(0);
      // South (180) -> 90
      expect(compassToMathAngle(180)).toBe(90);
    });

    it('converts math to compass', () => {
      // -90 -> North (0)
      expect(mathToCompassAngle(-90)).toBe(0);
      // 0 -> East (90)
      expect(mathToCompassAngle(0)).toBe(90);
      // 90 -> South (180)
      expect(mathToCompassAngle(90)).toBe(180);
    });
  });

  describe('getAngleBetweenPositions', () => {
    const origin = { x: 0, y: 0 };

    it('calculates North (-y)', () => {
      expect(getAngleBetweenPositions(origin, { x: 0, y: -5 })).toBe(0);
    });

    it('calculates East (+x)', () => {
      expect(getAngleBetweenPositions(origin, { x: 5, y: 0 })).toBe(90);
    });

    it('calculates South (+y)', () => {
      expect(getAngleBetweenPositions(origin, { x: 0, y: 5 })).toBe(180);
    });

    it('calculates West (-x)', () => {
      expect(getAngleBetweenPositions(origin, { x: -5, y: 0 })).toBe(270);
    });

    it('calculates Northeast (+x, -y)', () => {
        // dx=5, dy=-5. atan2(-5, 5) = -45 deg. Math->Compass: -45 + 90 = 45.
        expect(getAngleBetweenPositions(origin, { x: 5, y: -5 })).toBe(45);
    });
  });

  describe('facingToDegrees', () => {
      it('converts cardinal directions', () => {
          expect(facingToDegrees('north')).toBe(0);
          expect(facingToDegrees('east')).toBe(90);
          expect(facingToDegrees('south')).toBe(180);
          expect(facingToDegrees('west')).toBe(270);
      });

      it('is case insensitive', () => {
          expect(facingToDegrees('North')).toBe(0);
          expect(facingToDegrees('NORTH')).toBe(0);
      });
  });
});

describe('facing helpers', () => {
  it('turns each compass facing into a grid-unit vector', () => {
    expect(facingToVector('north')).toEqual({ x: 0, y: -1 });
    expect(facingToVector('east')).toEqual({ x: 1, y: 0 });
    expect(facingToVector('south')).toEqual({ x: 0, y: 1 });
    expect(facingToVector('west')).toEqual({ x: -1, y: 0 });
    expect(facingToVector('northeast')).toEqual({ x: 1, y: -1 });
    expect(facingToVector('southwest')).toEqual({ x: -1, y: 1 });
  });

  it('reads the facing from a step between two grid positions', () => {
    const origin = { x: 5, y: 5 };
    expect(facingFromPositions(origin, { x: 5, y: 3 })).toBe('north');
    expect(facingFromPositions(origin, { x: 8, y: 5 })).toBe('east');
    expect(facingFromPositions(origin, { x: 4, y: 6 })).toBe('southwest');
    expect(facingFromPositions(origin, { x: 9, y: 1 })).toBe('northeast');
  });

  it('returns undefined for a zero step, because it has no direction', () => {
    expect(facingFromPositions({ x: 5, y: 5 }, { x: 5, y: 5 })).toBeUndefined();
  });

  it('agrees with facingToDegrees on every compass facing', () => {
    const facings = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'] as const;
    for (const facing of facings) {
      const vector = facingToVector(facing);
      const degrees = ((Math.atan2(vector.y, vector.x) * 180) / Math.PI + 90 + 360) % 360;
      expect(degrees).toBeCloseTo(facingToDegrees(facing), 6);
    }
  });
});
