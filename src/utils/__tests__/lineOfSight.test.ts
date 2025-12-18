import { describe, it, expect } from 'vitest';
import { bresenhamLine, hasLineOfSight } from '../lineOfSight';
import { BattleMapTile, BattleMapData } from '../../types/combat';

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

    it('returns true if start or end tile is blocking (e.g. shooting from cover)', () => {
        // Technically hasLineOfSight excludes start and end from the check loop
        // If I am standing IN a fog cloud (blocks LoS), I can see out?
        // 5e rules say heavily obscured blocks vision.
        // But the code explicitly skips start and end.
        // Let's verify this behavior.
        const map = createMap([{ x: 0, y: 0 }, { x: 4, y: 0 }]);
        const start = map.tiles.get('0-0')!;
        const end = map.tiles.get('4-0')!;
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
  });
});
