import { describe, it, expect } from 'vitest'
import { AoECalculator } from '../AoECalculator'
import type { AreaOfEffect } from '@/types'

describe('AoECalculator', () => {
  describe('getAffectedTiles', () => {
    it('should handle Sphere AoE', () => {
      const tiles = AoECalculator.getAffectedTiles(
        { x: 10, y: 10 },
        { shape: 'Sphere', size: 20 } as AreaOfEffect
      )

      expect(tiles.length).toBeGreaterThan(0)
      expect(tiles).toContainEqual({ x: 10, y: 10 })
    })

    it('should handle Cone AoE with direction', () => {
      const tiles = AoECalculator.getAffectedTiles(
        { x: 5, y: 5 },
        { shape: 'Cone', size: 15 } as AreaOfEffect,
        { x: 1, y: 0 } // East
      )

      expect(tiles.length).toBeGreaterThan(0)

      // Should expand eastward
      const maxX = Math.max(...tiles.map(t => t.x))
      expect(maxX).toBeGreaterThan(5)
    })

    it('should throw error for Cone without direction', () => {
      expect(() => {
        AoECalculator.getAffectedTiles(
          { x: 5, y: 5 },
          { shape: 'Cone', size: 15 } as AreaOfEffect
        )
      }).toThrow('Cone requires direction vector')
    })

    it('should handle Cube AoE', () => {
      // 15ft cube -> 3x3 tiles = 9
      const tiles15 = AoECalculator.getAffectedTiles(
        { x: 5, y: 5 },
        { shape: 'Cube', size: 15 } as AreaOfEffect
      )
      expect(tiles15.length).toBe(9)
      expect(tiles15).toContainEqual({ x: 5, y: 5 })
      expect(tiles15).toContainEqual({ x: 4, y: 4 })
      expect(tiles15).toContainEqual({ x: 6, y: 6 })

      // 10ft cube -> 2x2 tiles = 4
      const tiles10 = AoECalculator.getAffectedTiles(
        { x: 5, y: 5 },
        { shape: 'Cube', size: 10 } as AreaOfEffect
      )
      expect(tiles10.length).toBe(4)
      expect(tiles10).toContainEqual({ x: 5, y: 5 })
    })
  })
})
