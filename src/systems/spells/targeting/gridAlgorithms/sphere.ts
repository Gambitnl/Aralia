import type { Position } from '@/types'

/**
 * Calculate tiles in a spherical AoE using Euclidean distance
 *
 * Formula: distance = sqrt((x2-x1)² + (y2-y1)²)
 *
 * @param center - Center point of sphere
 * @param radius - Radius in feet
 * @returns Array of tile positions within radius
 *
 * @example
 * // 20ft radius Fireball centered at (10, 10)
 * const tiles = getSphere({ x: 10, y: 10 }, 20)
 * // Returns ~13 tiles in circular pattern
 */
export function getSphere(center: Position, radius: number): Position[] {
  const tiles: Position[] = []
  const radiusInTiles = Math.floor(radius / 5) // Convert feet to tiles (5ft per tile)

  // Iterate over bounding box
  for (let dx = -radiusInTiles; dx <= radiusInTiles; dx++) {
    for (let dy = -radiusInTiles; dy <= radiusInTiles; dy++) {
      const x = center.x + dx
      const y = center.y + dy

      // Calculate Euclidean distance
      const distance = Math.sqrt(dx * dx + dy * dy) * 5 // Convert back to feet

      if (distance <= radius) {
        tiles.push({ x, y })
      }
    }
  }

  return tiles
}
