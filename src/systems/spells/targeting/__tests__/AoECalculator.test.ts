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

    it('should handle a face-anchored Cube AoE in each cardinal direction', () => {
      // Ruling Q4 (2026-09-22): the direction vector is the way the cube extends
      // away from the caster. The origin tile is the center of the near row.
      const cube15 = { shape: 'Cube', size: 15 } as AreaOfEffect
      const east = AoECalculator.getAffectedTiles({ x: 5, y: 5 }, cube15, { x: 1, y: 0 })
      expect(east.length).toBe(9)
      expect(east).toContainEqual({ x: 5, y: 4 })
      expect(east).toContainEqual({ x: 7, y: 6 })
      expect(east).not.toContainEqual({ x: 4, y: 5 })

      const west = AoECalculator.getAffectedTiles({ x: 5, y: 5 }, cube15, { x: -1, y: 0 })
      expect(west).toContainEqual({ x: 3, y: 4 })
      expect(west).not.toContainEqual({ x: 6, y: 5 })

      const north = AoECalculator.getAffectedTiles({ x: 5, y: 5 }, cube15, { x: 0, y: -1 })
      expect(north).toContainEqual({ x: 4, y: 3 })
      expect(north).not.toContainEqual({ x: 5, y: 6 })

      const south = AoECalculator.getAffectedTiles({ x: 5, y: 5 }, cube15, { x: 0, y: 1 })
      expect(south).toContainEqual({ x: 6, y: 7 })
      expect(south).not.toContainEqual({ x: 5, y: 4 })

      // 10ft cube -> 2x2 tiles = 4; the extra width tile goes south for an east cube.
      const tiles10 = AoECalculator.getCube({ x: 5, y: 5 }, 10, { x: 1, y: 0 })
      expect(tiles10).toEqual(expect.arrayContaining([
        { x: 5, y: 5 }, { x: 5, y: 6 }, { x: 6, y: 5 }, { x: 6, y: 6 }
      ]))
      expect(tiles10.length).toBe(4)

      // A diagonal vector uses its dominant axis; a true diagonal uses the horizontal axis.
      expect(AoECalculator.getCube({ x: 5, y: 5 }, 15, { x: 1, y: 3 })).toEqual(south)
      expect(AoECalculator.getCube({ x: 5, y: 5 }, 15, { x: -1, y: 1 })).toEqual(west)
    })

    it('should throw for a Cube without direction', () => {
      expect(() => AoECalculator.getAffectedTiles(
        { x: 5, y: 5 },
        { shape: 'Cube', size: 15 } as AreaOfEffect
      )).toThrow('Cube requires direction vector')
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
