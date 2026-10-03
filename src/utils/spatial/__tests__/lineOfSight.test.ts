/**
 * This file proves the grid line tracer answers the same way for targeting and visibility.
 *
 * Straight, diagonal, corner, and endpoint cases use complete map tiles so a
 * future geometry change cannot silently make the target validator and both
 * battle-map renderers disagree about Total Cover.
 *
 * Exercises: lineOfSight.ts.
 * Depends on: production combat map shapes.
 */

import { describe, it, expect } from 'vitest';
import { bresenhamLine, hasLineOfSight } from '../lineOfSight';
import { BattleMapTile, BattleMapData } from '../../../types/combat';

describe('lineOfSight', () => {
  describe('bresenhamLine', () => {
    it('calculates a horizontal line', () => {
      const line = bresenhamLine(0, 0, 3, 0);
      expect(line).toEqual([
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 3, y: 0 }
      ]);
    });

    it('calculates a vertical line', () => {
      const line = bresenhamLine(0, 0, 0, 3);
      expect(line).toEqual([
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 0, y: 2 },
        { x: 0, y: 3 }
      ]);
    });

    it('calculates a perfect diagonal line', () => {
      const line = bresenhamLine(0, 0, 3, 3);
      expect(line).toEqual([
        { x: 0, y: 0 },
        { x: 1, y: 1 },
        { x: 2, y: 2 },
        { x: 3, y: 3 }
      ]);
    });

    it('calculates a skewed line', () => {
      // (0,0) to (2,4) - slope is 2.
      // Expected: (0,0), (0,1), (1,2), (1,3), (2,4) ?
      // Let's trace Bresenham manually or rely on standard behavior.
      // dx=2, dy=4. sx=1, sy=1. err = -2.
      // 1. (0,0). err=-2. e2=-4. e2 > -4 (False). e2 < 2 (True). err+=2=0. y=1. -> (0,1) NO wait.
      // Standard Bresenham might vary slightly depending on implementation details in the loop order.
      // The implementation is:
      // points.push({0,0})
      // e2 = -4.
      // e2 > -4? No. (-4 is not > -4).
      // e2 < 2? Yes. err += 2 -> 0. y += 1 -> 1.
      // Next Loop:
      // points.push({0,1})
      // err = 0. e2 = 0.
      // e2 > -4? Yes. err -= 4 -> -4. x += 1 -> 1.
      // e2 < 2? Yes. err += 2 -> -2. y += 1 -> 2.
      // Next Loop:
      // points.push({1,2})
      // err = -2. e2 = -4.
      // e2 > -4? No.
      // e2 < 2? Yes. err += 2 -> 0. y += 1 -> 3.
      // Next Loop:
      // points.push({1,3})
      // err = 0. e2 = 0.
      // e2 > -4? Yes. err -= 4 -> -4. x += 1 -> 2.
      // e2 < 2? Yes. err += 2 -> -2. y += 1 -> 4.
      // Next Loop:
      // points.push({2,4})
      // Break condition met.

      const line = bresenhamLine(0, 0, 2, 4);
      expect(line).toEqual([
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 1, y: 2 },
        { x: 1, y: 3 },
        { x: 2, y: 4 }
      ]);
    });
  });

  describe('hasLineOfSight', () => {
    // Helper to create a minimal map
    const createMap = (blockedCoords: { x: number, y: number }[]): BattleMapData => {
      const tiles = new Map<string, BattleMapTile>();
      // Create a 5x5 grid
      for (let x = 0; x < 5; x++) {
        for (let y = 0; y < 5; y++) {
          const isBlocked = blockedCoords.some(c => c.x === x && c.y === y);
          tiles.set(`${x}-${y}`, {
            id: `${x}-${y}`,
            coordinates: { x, y },
            blocksLoS: isBlocked,
            terrain: 'grass',
            elevation: 0,
            movementCost: 1,
            blocksMovement: isBlocked,
            decoration: null,
            effects: []
          });
        }
      }
      return {
        dimensions: { width: 5, height: 5 },
        tiles,
        theme: 'forest',
        seed: 123
      };
    };

    it('returns true when path is clear', () => {
      const map = createMap([]); // No blocks
      const start = map.tiles.get('0-0')!;
      const end = map.tiles.get('4-0')!;
      expect(hasLineOfSight(start, end, map)).toBe(true);
    });

    it('returns false when path is blocked by a wall', () => {
      const map = createMap([{ x: 2, y: 0 }]); // Block in the middle
      const start = map.tiles.get('0-0')!;
      const end = map.tiles.get('4-0')!;
      expect(hasLineOfSight(start, end, map)).toBe(false);
    });

    it('returns true when obstacle is adjacent but not on line', () => {
      const map = createMap([{ x: 2, y: 1 }]); // Block slightly below
      const start = map.tiles.get('0-0')!;
      const end = map.tiles.get('4-0')!;
      expect(hasLineOfSight(start, end, map)).toBe(true);
    });

    it('ignores the occupied source tile but treats an opaque target endpoint as blocked', () => {
        const map = createMap([{ x: 0, y: 0 }, { x: 4, y: 0 }]);
        const start = map.tiles.get('0-0')!;
        const end = map.tiles.get('4-0')!;

        // The attacker may stand in an opaque source cell such as dense smoke,
        // but a target endpoint explicitly marked as Total Cover is not a legal
        // visible endpoint. This distinction protects endpoint targeting.
        expect(hasLineOfSight(start, end, map)).toBe(false);

        end.blocksLoS = false;
        expect(hasLineOfSight(start, end, map)).toBe(true);
    });

    it('returns false for diagonal blockage', () => {
        // 0,0 -> 2,2. Line passes through 1,1.
        const map = createMap([{ x: 1, y: 1 }]);
        const start = map.tiles.get('0-0')!;
        const end = map.tiles.get('2-2')!;
        expect(hasLineOfSight(start, end, map)).toBe(false);
    });

    it('returns true for adjacent tiles (no tiles in between)', () => {
        const map = createMap([]);
        const start = map.tiles.get('0-0')!;
        const end = map.tiles.get('1-0')!; // Adjacent
        // Loop runs from i=1 to length-1. Length is 2. Loop 1 to 1. i < 1 is false. Loop doesn't run.
        expect(hasLineOfSight(start, end, map)).toBe(true);
    });

    it('blocks a diagonal ray through a sealed corner but leaves a one-sided corner open', () => {
      const sealedCorner = createMap([{ x: 1, y: 0 }, { x: 0, y: 1 }]);
      const openCorner = createMap([{ x: 1, y: 0 }]);

      // Moving diagonally between two opaque orthogonal neighbours would let
      // a ray pass through the zero-width join unless both sides are checked.
      expect(hasLineOfSight(
        sealedCorner.tiles.get('0-0')!,
        sealedCorner.tiles.get('2-2')!,
        sealedCorner,
      )).toBe(false);
      expect(hasLineOfSight(
        openCorner.tiles.get('0-0')!,
        openCorner.tiles.get('2-2')!,
        openCorner,
      )).toBe(true);
    });

    it('looks over a low authored blocker but not a blocker crossing the elevated ray', () => {
      const map = createMap([{ x: 2, y: 0 }]);
      const start = map.tiles.get('0-0')!;
      const end = map.tiles.get('4-0')!;
      end.elevation = 10;

      // The ray rises from a five-foot eye line to fifteen feet. At its
      // midpoint a five-foot obstacle is below sight, while a ten-foot top
      // intersects the ray and remains Total Cover.
      map.tiles.get('2-0')!.airspace = { blockerTopFeet: 5 };
      expect(hasLineOfSight(start, end, map)).toBe(true);

      map.tiles.get('2-0')!.airspace = { blockerTopFeet: 10 };
      expect(hasLineOfSight(start, end, map)).toBe(false);
    });

    it('preserves legacy opaque walls when no finite blocker top is authored', () => {
      const map = createMap([{ x: 2, y: 0 }]);
      map.tiles.get('4-0')!.elevation = 20;

      expect(hasLineOfSight(
        map.tiles.get('0-0')!,
        map.tiles.get('4-0')!,
        map,
      )).toBe(false);
    });
  });
});
