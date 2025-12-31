import type { Position, AreaOfEffect } from '@/types'
import { getCone } from './gridAlgorithms/cone'
import { getCube } from './gridAlgorithms/cube'
import { getSphere } from './gridAlgorithms/sphere'
import { getLine } from './gridAlgorithms/line'
import { getCylinder } from './gridAlgorithms/cylinder'

/**
 * Calculates affected tiles for AoE spells
 *
 * All calculations use a square grid with 5ft tiles.
 * Distances are measured in feet.
 */
export class AoECalculator {
  /**
   * Get all tiles affected by an AoE shape
   *
   * @param center - Center point of AoE (or origin for Cone/Line)
   * @param aoe - AoE definition (shape + size)
   * @param direction - Direction vector (required for Cone/Line)
   * @returns Array of affected tile positions
   *
   * @example
   * // Fireball: 20ft radius sphere
   * const tiles = AoECalculator.getAffectedTiles(
   *   { x: 10, y: 10 },
   *   { shape: 'Sphere', size: 20 }
   * )
   *
   * @example
   * // Burning Hands: 15ft cone
   * const tiles = AoECalculator.getAffectedTiles(
   *   { x: 5, y: 5 },
   *   { shape: 'Cone', size: 15 },
   *   { x: 1, y: 0 }  // Facing east
   * )
   */
  static getAffectedTiles(
    center: Position,
    aoe: AreaOfEffect,
    direction?: Position
  ): Position[] {
    switch (aoe.shape) {
      case 'Cone':
        if (!direction) throw new Error('Cone requires direction vector')
        return getCone(center, direction, aoe.size)

      case 'Cube':
        return getCube(center, aoe.size)

      case 'Sphere':
        return getSphere(center, aoe.size)

      case 'Square':
        // Treat planar squares the same as cubes on the 2D grid.
        return getCube(center, aoe.size)

      case 'Line':
        if (!direction) throw new Error('Line requires direction vector')
        // Line requires a width in spells.ts? No, spells.ts AreaOfEffect only has size.
        // Wait, where does width come from?
        // The Line algo takes a width.
        // But spells.ts AreaOfEffect is { shape, size }.
        // I might need to assume default width or check if AreaOfEffect has width in spells.ts
        // Checking spells.ts:
        // export interface AreaOfEffect { shape: "Cone" | "Cube" | "Cylinder" | "Line" | "Sphere"; size: number; }
        // It does NOT have width.
        // The task description for getLine in AoECalculator says:
        // return getLine(center, direction, aoe.size, aoe.width ?? 5)
        // This implies aoe might have width, or it's casted/extended.
        // I will assume 5ft default width for now since the interface doesn't support it yet.
        return getLine(center, direction, aoe.size, 5)

      case 'Cylinder':
        return getCylinder(center, aoe.size)

      default: {
        // In case of exhaustiveness check failure or runtime invalid data
        // TODO(lint-intent): 'exhaustive' is declared but unused, suggesting an unfinished state/behavior hook in this block.
        // TODO(lint-intent): If the intent is still active, connect it to the nearby render/dispatch/condition so it matters.
        // TODO(lint-intent): Otherwise remove it or prefix with an underscore to record intentional unused state.
        // TODO(lint-intent): This switch case declares new bindings, implying scoped multi-step logic.
        // TODO(lint-intent): Wrap the case in braces or extract a helper to keep scope and intent clear.
        // TODO(lint-intent): If shared state is intended, lift the declarations outside the switch.
        const _exhaustive: never = aoe.shape as never;
        throw new Error(`Unknown AoE shape: ${aoe.shape}`)
      }
    }
  }

  /**
   * Get tiles affected by a Cone
   *
   * Uses 90-degree cone emanating from caster
   * Size is length from origin
   */
  static getCone(origin: Position, direction: Position, size: number): Position[] {
    return getCone(origin, direction, size)
  }

  /**
   * Get tiles affected by a Sphere
   *
   * Uses Euclidean distance: sqrt((x2-x1)² + (y2-y1)²)
   * Radius is in feet
   */
  static getSphere(center: Position, radius: number): Position[] {
    return getSphere(center, radius)
  }

  /**
   * Get tiles affected by a Cube
   *
   * Center point defines cube center, size is edge length
   */
  static getCube(center: Position, size: number): Position[] {
    return getCube(center, size)
  }

  /**
   * Get tiles affected by a Line
   *
   * Uses linear interpolation from start to end
   * Width expands perpendicular to line direction
   */
  static getLine(
    start: Position,
    direction: Position,
    length: number,
    width: number = 5
  ): Position[] {
    return getLine(start, direction, length, width)
  }

  /**
   * Get tiles affected by a Cylinder
   *
   * Circular area with vertical extent
   * Height is currently ignored (2D combat)
   */
  static getCylinder(
    center: Position,
    radius: number,
    height: number = Infinity
  ): Position[] {
    return getCylinder(center, radius, height)
  }
}
