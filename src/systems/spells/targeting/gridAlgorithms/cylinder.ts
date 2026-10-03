import type { Position } from '@/types'
import { getSphere } from './sphere'

/**
 * Calculate tiles in a cylindrical AoE
 *
 * For 2D combat, this is identical to Sphere (ignoring height)
 *
 * @param center - Center position
 * @param radius - Radius in feet
 * @param height - Height in feet. Unused until combat-elevation lands (see the note in the body).
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
  // RESOLVED 2026-09-13 (ruling, TODO Sweep Rulings sheet Q3, Remy: "implement elevation").
  // The cylinder keeps its circle footprint on the grid until tiles and combatants carry
  // elevation. The height test (0 <= z - originZ <= height) lands with the plan-map topic
  // combat-elevation, not as a stand-alone Position.z field. Tracker row
  // SSO-GEOMETRY-CYLINDER-HEIGHT-001 records the same dependency.
  return getSphere(center, radius)
}
