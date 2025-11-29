import { describe, it, expect } from 'vitest'
import { getSphere } from '../gridAlgorithms/sphere'

describe('getSphere', () => {
  it('should return 5 tiles for 5ft radius (Center + Cardinals)', () => {
    const tiles = getSphere({ x: 5, y: 5 }, 5)
    // Center (0) + 4 neighbors (5ft away)
    expect(tiles).toHaveLength(5)
    expect(tiles).toContainEqual({ x: 5, y: 5 })
  })

  it('should return ~49 tiles for 20ft radius (Fireball)', () => {
    const tiles = getSphere({ x: 10, y: 10 }, 20)

    // 20ft radius = 4 tiles radius
    // Area = approx 49 tiles (Euclidean circle on grid)
    expect(tiles.length).toBeGreaterThanOrEqual(45)
    expect(tiles.length).toBeLessThanOrEqual(55)

    // Center should be included
    expect(tiles).toContainEqual({ x: 10, y: 10 })
  })

  it('should create circular pattern', () => {
    const tiles = getSphere({ x: 0, y: 0 }, 10)

    // All tiles should be within 10ft (2 tiles) of center
    tiles.forEach(tile => {
      const distance = Math.sqrt(tile.x * tile.x + tile.y * tile.y) * 5
      expect(distance).toBeLessThanOrEqual(10)
    })
  })
})
