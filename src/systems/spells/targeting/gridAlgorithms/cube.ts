import type { Position } from '@/types'

/**
 * Calculate tiles in a cubic AoE
 *
 * @param center - Center position (or corner, depending on spell)
 * @param size - Edge length in feet
 * @returns Array of tile positions in cube
 *
 * @example
 * // 10ft cube (Thunderwave)
 * const tiles = getCube({ x: 5, y: 5 }, 10)
 * // Returns 2x2 square (4 tiles)
 */
export function getCube(center: Position, size: number): Position[] {
  const tiles: Position[] = []
  const sizeInTiles = Math.floor(size / 5)

  // Calculate offset to center the cube on the target tile as best as possible.
  // Ideally, for odd sizes, it's perfectly centered.
  // For even sizes, it biases slightly (top-left in this implementation).
  const offset = Math.floor(sizeInTiles / 2)

  for (let dx = 0; dx < sizeInTiles; dx++) {
    for (let dy = 0; dy < sizeInTiles; dy++) {
      tiles.push({
        x: center.x - offset + dx,
        y: center.y - offset + dy
      })
    }
  }

  return tiles
}
