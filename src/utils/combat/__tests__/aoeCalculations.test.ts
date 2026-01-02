import { describe, it, expect } from 'vitest'
import { calculateAffectedTiles } from '../aoeCalculations'
import { Position } from '../../../types/combat'

describe('calculateAffectedTiles', () => {
  describe('Sphere', () => {
    it('returns tiles within a 20-foot sphere', () => {
      const result = calculateAffectedTiles({
        shape: 'Sphere',
        origin: { x: 5, y: 5 },
        size: 20
      })

      const center = result.find(p => p.x === 5 && p.y === 5)
      const edge = result.find(p => p.x === 9 && p.y === 5) // 4 tiles away
      const outside = result.find(p => p.x === 10 && p.y === 5) // 5 tiles away

      expect(center).toBeDefined()
      expect(edge).toBeDefined()
      expect(outside).toBeUndefined()

      // Radius 20ft = 4 tiles
      // Chebyshev Square with radius 4 means:
      // Side length = 2*r + 1 = 9 tiles.
      // Total area = 9 * 9 = 81 tiles.
      expect(result.length).toBe(81)
    })
  })

  describe('Cone', () => {
    // Helper to find a specific tile in the results
    const hasTile = (tiles: Position[], x: number, y: number) =>
        tiles.some(t => t.x === x && t.y === y);

    it('calculates a 15-foot cone facing North (0 deg)', () => {
      const result = calculateAffectedTiles({
        shape: 'Cone',
        origin: { x: 5, y: 5 },
        size: 15,
        direction: 0
      })

      expect(result.every(p => p.y <= 5)).toBe(true)
      expect(result).toContainEqual({ x: 5, y: 4 })
      expect(result).toContainEqual({ x: 5, y: 3 })
      expect(result).not.toContainEqual({ x: 5, y: 6 })
    })

    it('calculates a 15-foot cone facing East (90 deg)', () => {
      const result = calculateAffectedTiles({
        shape: 'Cone',
        origin: { x: 5, y: 5 },
        size: 15,
        direction: 90
      })

      expect(result.every(p => p.x >= 5)).toBe(true)
      expect(result).toContainEqual({ x: 8, y: 5 })
      expect(result).not.toContainEqual({ x: 9, y: 5 })
    })

    it('calculates a 15-foot cone facing North-East (45 deg)', () => {
      // 15 ft = 3 tiles
      // Origin: (5, 5)
      // Direction: 45 degrees (NE)
      const result = calculateAffectedTiles({
        shape: 'Cone',
        origin: { x: 5, y: 5 },
        size: 15,
        direction: 45
      })

      // Expected tiles analysis:
      // (8, 2) -> 3 East, 3 North. Delta (3, -3).
      // Angle: atan2(-3, 3) = -45 deg.
      // Grid Angle: -45 + 90 = 45 deg. Exact match. Distance: 3 tiles (15ft). IN.
      expect(result).toContainEqual({ x: 8, y: 2 })

      // (6, 4) -> 1 East, 1 North. Delta (1, -1).
      // Angle: -45 deg. Grid: 45. Distance: 1 tile. IN.
      expect(result).toContainEqual({ x: 6, y: 4 })

      // (8, 5) -> 3 East, 0 North. Delta (3, 0).
      // Angle: atan2(0, 3) = 0. Grid: 90 deg.
      // Diff: |90 - 45| = 45. Max allowed: 53/2 = 26.5.
      // OUT.
      expect(result).not.toContainEqual({ x: 8, y: 5 })

      // (5, 2) -> 0 East, 3 North. Delta (0, -3).
      // Angle: atan2(-3, 0) = -90. Grid: 0.
      // Diff: |0 - 45| = 45.
      // OUT.
      expect(result).not.toContainEqual({ x: 5, y: 2 })

      // Ensure origin is excluded (handled by implementation)
      expect(result).not.toContainEqual({ x: 5, y: 5 })
    })

    it('generates a 15ft orthogonal cone (North) matching 5e Width=Distance rule', () => {
        // Origin (10, 10). North is -y.
        // Rule: Width at distance D equals D.
        // Testing specifically for the boundary tiles at distance 10ft (2 tiles).

        const tiles = calculateAffectedTiles({
            shape: 'Cone',
            origin: { x: 10, y: 10 },
            size: 15,
            direction: 0 // North
        });

        // Distance 5ft (1 tile): y=9. Width 5ft (1 tile).
        expect(hasTile(tiles, 10, 9)).toBe(true); // Center
        expect(hasTile(tiles, 9, 9)).toBe(false); // Left
        expect(hasTile(tiles, 11, 9)).toBe(false); // Right

        // Distance 10ft (2 tiles): y=8. Width 10ft (2 tiles).
        // For a cone with width equal to distance, at distance 2 tiles, width is 2 tiles.
        // However, on a discrete grid, a center tile + 1 neighbor on each side creates a width of 3 tiles.
        // The mathematical boundaries (26.5 deg) intersect the center of the adjacent tiles (at angle ~26.5 deg).
        // Center (10,8) is 0 deg offset.
        // Left (9,8) is at offset x=-1, y=2 (from origin 10,10). Angle = atan(1/2) = 26.565 deg.
        // This exactly matches the cone half-angle boundary.
        // Therefore, we include it, resulting in 3 total tiles.
        expect(hasTile(tiles, 10, 8)).toBe(true); // Center
        expect(hasTile(tiles, 9, 8)).toBe(true);  // Left Boundary
        expect(hasTile(tiles, 11, 8)).toBe(true); // Right Boundary
    });
  })

  describe('Cube', () => {
    it('calculates a 10-foot cube', () => {
      const result = calculateAffectedTiles({
        shape: 'Cube',
        origin: { x: 5, y: 5 },
        size: 10
      })

      expect(result.length).toBe(4)
      expect(result).toContainEqual({ x: 5, y: 5 })
      expect(result).toContainEqual({ x: 6, y: 5 })
      expect(result).toContainEqual({ x: 5, y: 6 })
      expect(result).toContainEqual({ x: 6, y: 6 })
    })
  })

  describe('Line', () => {
    it('calculates a 30-foot line northward', () => {
      const result = calculateAffectedTiles({
        shape: 'Line',
        origin: { x: 5, y: 10 },
        size: 30,
        direction: 0
      })

      expect(result).toContainEqual({ x: 5, y: 10 })
      expect(result).toContainEqual({ x: 5, y: 4 })
      expect(result.every(p => p.x === 5)).toBe(true)
      expect(result.length).toBeGreaterThanOrEqual(6)
    })

    it('calculates a diagonal line (45 deg)', () => {
      const result = calculateAffectedTiles({
        shape: 'Line',
        origin: { x: 0, y: 0 },
        size: 10,
        direction: 45
      })

      expect(result.length).toBeGreaterThan(0)
      expect(result.some(p => p.x > 0 && p.y < 0)).toBe(true)
    })

    it('correctly projects diagonal distance using Chebyshev (5-5-5 rule)', () => {
      // 30 feet = 6 tiles
      // Diagonal projection (45 deg, NE) should reach (6, -6)
      // Euclidean would only reach ~4.2 tiles (21 feet)
      const result = calculateAffectedTiles({
        shape: 'Line',
        origin: { x: 0, y: 0 },
        size: 30,
        direction: 45
      })

      const endPoint = result.find(p => p.x === 6 && p.y === -6)
      expect(endPoint).toBeDefined()
    })
  })
})
