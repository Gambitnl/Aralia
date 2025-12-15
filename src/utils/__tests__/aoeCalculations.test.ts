import { describe, it, expect } from 'vitest'
import { calculateAffectedTiles } from '../aoeCalculations'

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

    it('should reach 6 tiles diagonally for a 30ft Line (Chebyshev logic)', () => {
        // In D&D 5e (played on grid often using 5-5-5 or 5-10-5), pure Chebyshev (5-5-5) means diagonal costs 5ft.
        // So 30ft = 6 squares.
        // A diagonal line of 30ft should reach {x+6, y+6} (or similar) from origin.

        const origin = { x: 10, y: 10 };
        const length = 30; // 6 tiles

        // 135 is SE (0=N, 90=E, 180=S)
        const result = calculateAffectedTiles({
            shape: 'Line',
            origin,
            size: length,
            direction: 135
        });

        // Calculate maximum Chebyshev distance from origin
        let maxDist = 0;
        result.forEach(p => {
            const dx = Math.abs(p.x - origin.x);
            const dy = Math.abs(p.y - origin.y);
            const dist = Math.max(dx, dy);
            if (dist > maxDist) maxDist = dist;
        });

        // Euclidean: 30ft (6 tiles) * cos(45) ~= 4.24 tiles -> maxDist 4
        // Chebyshev: 6 tiles diagonal -> maxDist 6
        expect(maxDist).toBe(6);
    });
  })
})
