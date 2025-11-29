import type { Position } from '@/types'

/**
 * Calculate tiles in a linear AoE using linear interpolation
 *
 * Recommended over Bresenham for better coverage on diagonal lines
 *
 * @param start - Starting position
 * @param direction - Direction vector (will be normalized)
 * @param length - Length in feet
 * @param width - Width in feet (default 5ft)
 * @returns Array of tile positions along line
 *
 * @example
 * // Lightning Bolt: 100ft line, 5ft wide, heading east
 * const tiles = getLine(
 *   { x: 5, y: 5 },
 *   { x: 1, y: 0 },
 *   100,
 *   5
 * )
 */
export function getLine(
  start: Position,
  direction: Position,
  length: number,
  width: number = 5
): Position[] {
  const tiles: Position[] = []
  const lengthInTiles = Math.floor(length / 5)
  const widthInTiles = Math.floor(width / 5)

  // Normalize direction vector
  const magnitude = Math.sqrt(direction.x * direction.x + direction.y * direction.y)
  const normX = direction.x / magnitude
  const normY = direction.y / magnitude

  // Perpendicular vector for width
  const perpX = -normY
  const perpY = normX

  // Iterate along line length
  for (let i = 0; i <= lengthInTiles; i++) {
    const baseX = start.x + Math.round(normX * i)
    const baseY = start.y + Math.round(normY * i)

    // Expand width perpendicular to line
    for (let w = -Math.floor(widthInTiles / 2); w <= Math.floor(widthInTiles / 2); w++) {
      const x = baseX + Math.round(perpX * w)
      const y = baseY + Math.round(perpY * w)

      // Avoid duplicates
      if (!tiles.some(t => t.x === x && t.y === y)) {
        tiles.push({ x, y })
      }
    }
  }

  return tiles
}
