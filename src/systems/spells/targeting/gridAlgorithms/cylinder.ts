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
  // Height is intentionally ignored in the current 2D-only implementation.
  _height: number = Infinity
): Position[] {
  // In 2D grid combat, cylinder = sphere
  // Height is ignored (all combat on same plane)
  // TODO #1035(SPELL-OVERHAUL): Implement height checks once elevation is modeled.
  // TODO(SPELL-OVERHAUL): Policy and ownership are tracked in docs/tasks/spell-system-overhaul/TRACKER.md (SSO-GEOMETRY-CYLINDER-HEIGHT-001).
  return getSphere(center, radius)
}
