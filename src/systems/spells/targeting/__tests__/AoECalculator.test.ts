import { describe, it, expect } from 'vitest'
import { AoECalculator } from '../AoECalculator'
import { calculateAffectedTiles } from '@/utils/combat/aoeCalculations'
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
      // 15ft cube -> 3x3 tiles = 9 using the shared utility's origin-based cube convention.
      const tiles15 = AoECalculator.getAffectedTiles(
        { x: 5, y: 5 },
        { shape: 'Cube', size: 15 } as AreaOfEffect
      )
      expect(tiles15.length).toBe(9)
      expect(tiles15).toContainEqual({ x: 5, y: 5 })
      expect(tiles15).toContainEqual({ x: 7, y: 7 })

      // 10ft cube -> 2x2 tiles = 4
      const tiles10 = AoECalculator.getAffectedTiles(
        { x: 5, y: 5 },
        { shape: 'Cube', size: 10 } as AreaOfEffect
      )
      expect(tiles10.length).toBe(4)
      expect(tiles10).toContainEqual({ x: 5, y: 5 })
    })

    it('should match the shared combat AoE utility for non-directional shapes', () => {
      // Persistent zone containment uses AoECalculator, while targeting and
      // terrain commands use calculateAffectedTiles directly. This guard keeps
      // the adapter honest until the older imports are migrated.
      const origin = { x: 5, y: 5 }
      const sphere = { shape: 'Sphere', size: 10 } as AreaOfEffect

      expect(AoECalculator.getAffectedTiles(origin, sphere)).toEqual(
        calculateAffectedTiles({ shape: 'Sphere', origin, size: 10 })
      )
    })

    it('should expose containment through the same affected-tile geometry', () => {
      // AreaEffectTracker uses this helper for persistent zones so it does not
      // reimplement separate sphere/cube/cylinder/square distance rules.
      const sphere = { shape: 'Sphere', size: 10 } as AreaOfEffect

      expect(AoECalculator.containsTile({ x: 5, y: 5 }, { x: 5, y: 5 }, sphere)).toBe(true)
      expect(AoECalculator.containsTile({ x: 7, y: 5 }, { x: 5, y: 5 }, sphere)).toBe(true)
      expect(AoECalculator.containsTile({ x: 9, y: 5 }, { x: 5, y: 5 }, sphere)).toBe(false)
    })
  })
})
