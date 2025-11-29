import type { Position } from '@/types'

/**
 * Calculate tiles in a conical AoE
 *
 * Uses 90-degree cone emanating from origin
 * Expands width as it extends
 *
 * @param origin - Starting position (caster)
 * @param direction - Direction vector (will be normalized)
 * @param size - Length of cone in feet
 * @returns Array of tile positions in cone
 *
 * @example
 * // Burning Hands: 15ft cone
 * const tiles = getCone(
 *   { x: 5, y: 5 },
 *   { x: 1, y: 0 },  // Facing east
 *   15
 * )
 */
export function getCone(
  origin: Position,
  direction: Position,
  size: number
): Position[] {
  const tiles: Position[] = []
  const lengthInTiles = Math.floor(size / 5)

  // Normalize direction
  const magnitude = Math.sqrt(direction.x * direction.x + direction.y * direction.y)
  const normX = direction.x / magnitude
  const normY = direction.y / magnitude

  // Perpendicular for width expansion
  const perpX = -normY
  const perpY = normX

  // Iterate along cone length
  for (let i = 0; i <= lengthInTiles; i++) {
    const baseX = origin.x + Math.round(normX * i)
    const baseY = origin.y + Math.round(normY * i)

    // Width grows linearly with distance (90-degree cone)
    const widthAtDistance = Math.floor(i / 2)

    for (let w = -widthAtDistance; w <= widthAtDistance; w++) {
      const x = baseX + Math.round(perpX * w)
      const y = baseY + Math.round(perpY * w)

      if (!tiles.some(t => t.x === x && t.y === y)) {
        tiles.push({ x, y })
      }
    }
  }

  return tiles
}
