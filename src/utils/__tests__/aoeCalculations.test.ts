import { describe, it, expect } from 'vitest'
import { calculateAffectedTiles, AoEParams } from '../aoeCalculations'
import { Position } from '../../types/combat'

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

      // Rough bounds: area should be in a reasonable range for a radius-4 circle on grid
      expect(result.length).toBeGreaterThan(30)
      // Chebyshev radius 4 (20ft) creates a 9x9 square (81 tiles)
      expect(result.length).toBe(81)
    })

    it('should calculate sphere correctly (Chebyshev consistency)', () => {
        const params: AoEParams = {
            shape: 'Sphere',
            origin: { x: 0, y: 0 },
            size: 15 // 3 tiles radius
        };
        const tiles = calculateAffectedTiles(params);

        // Center
        expect(tiles).toContainEqual({ x: 0, y: 0 });

        // Edge (3,0) -> Distance 3 tiles = 15ft. Included.
        expect(tiles).toContainEqual({ x: 3, y: 0 });

        // Diagonal (3,3)
        // Euclidean: sqrt(9+9) = 4.24 tiles > 3 tiles. Excluded.
        // Chebyshev: max(3,3) = 3 tiles = 15ft. Included.
        expect(tiles).toContainEqual({ x: 3, y: 3 });

        // Out of range (4,0) -> 4 tiles > 3. Excluded.
        expect(tiles).not.toContainEqual({ x: 4, y: 0 });
    });
  });

  describe('Cone', () => {
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

    it('should calculate a horizontal line correctly', () => {
        const params: AoEParams = {
          shape: 'Line',
          origin: { x: 0, y: 0 },
          size: 15,
          targetPoint: { x: 3, y: 0 },
          width: 5
        };

        const tiles = calculateAffectedTiles(params);

        expect(tiles).toContainEqual({ x: 0, y: 0 });
        expect(tiles).toContainEqual({ x: 1, y: 0 });
        expect(tiles).toContainEqual({ x: 2, y: 0 });
        expect(tiles).toContainEqual({ x: 3, y: 0 });
    });
  })
})
