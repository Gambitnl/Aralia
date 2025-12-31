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
  // TODO(lint-intent): 'height' is an unused parameter, which suggests a planned input for this flow.
  // TODO(lint-intent): If the contract should consume it, thread it into the decision/transform path or document why it exists.
  // TODO(lint-intent): Otherwise rename it with a leading underscore or remove it if the signature can change.
  _height: number = Infinity
): Position[] {
  // In 2D grid combat, cylinder = sphere
  // Height is ignored (all combat on same plane)
  // TODO(SPELL-OVERHAUL): Implement height checks once elevation is modeled (see docs/tasks/spell-system-overhaul/TODO.md; if this block is moved/refactored/modularized, update the TODO entry path).
  return getSphere(center, radius)
}
