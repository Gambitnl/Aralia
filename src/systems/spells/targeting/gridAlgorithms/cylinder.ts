import type { Position } from '@/types'
import { getSphere } from './sphere'

/**
 * Calculate tiles in a cylindrical AoE
 *
 * For 2D combat, this is identical to Sphere (ignoring height)
 *
 * @param center - Center position
 * @param radius - Radius in feet
 * @param height - Height in feet (currently unused)
 * @returns Array of tile positions in cylinder
 */
export function getCylinder(
  center: Position,
  radius: number,
  height: number = Infinity
): Position[] {
  // In 2D grid combat, cylinder = sphere
  // Height is ignored (all combat on same plane)
  return getSphere(center, radius)
}
