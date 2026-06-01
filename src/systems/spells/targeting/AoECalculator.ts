// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 31/05/2026, 22:45:56
 * Dependents: systems/spells/effects/triggerHandler.ts, systems/spells/targeting/index.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { Position, AreaOfEffect } from '@/types'
import { calculateAffectedTiles, type AoEParams, type AoEShape } from '../../../utils/combat/aoeCalculations'

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
    return calculateAffectedTiles(this.toSharedAoEParams(center, aoe, direction))
  }

  /**
   * Check whether one grid tile is inside an AoE by reusing the same tile list
   * that targeting previews and spell resolution use.
   *
   * This keeps persistent area zones from maintaining their own distance math for
   * spheres, cubes, cylinders, and squares. Directional shapes still require the
   * caller to provide a direction because cone and line geometry is not defined
   * by center + size alone.
   */
  static containsTile(
    position: Position,
    center: Position,
    aoe: AreaOfEffect,
    direction?: Position
  ): boolean {
    return this.getAffectedTiles(center, aoe, direction).some(tile => (
      tile.x === position.x && tile.y === position.y
    ))
  }

  /**
   * Get tiles affected by a Cone
   *
   * Uses the shared combat AoE utility so preview, terrain, and zone math agree.
   * Size is length from origin.
   */
  static getCone(origin: Position, direction: Position, size: number): Position[] {
    return calculateAffectedTiles({
      shape: 'Cone',
      origin,
      size,
      direction: vectorToCompassDegrees(direction)
    })
  }

  /**
   * Get tiles affected by a Sphere
   *
   * Uses the shared combat AoE utility's 5e grid distance rule.
   * Radius is in feet.
   */
  static getSphere(center: Position, radius: number): Position[] {
    return calculateAffectedTiles({ shape: 'Sphere', origin: center, size: radius })
  }

  /**
   * Get tiles affected by a Cube
   *
   * Uses the shared combat AoE utility convention where the point is the cube origin.
   */
  static getCube(center: Position, size: number): Position[] {
    return calculateAffectedTiles({ shape: 'Cube', origin: center, size })
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
    return calculateAffectedTiles({
      shape: 'Line',
      origin: start,
      size: length,
      direction: vectorToCompassDegrees(direction),
      width
    })
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
    void height
    return calculateAffectedTiles({ shape: 'Cylinder', origin: center, size: radius })
  }

  private static toSharedAoEParams(
    center: Position,
    aoe: AreaOfEffect,
    direction?: Position
  ): AoEParams {
    const shape = normalizeShapeForSharedGeometry(aoe.shape)

    if ((shape === 'Cone' || shape === 'Line') && !direction) {
      throw new Error(`${shape} requires direction vector`)
    }

    return {
      shape,
      origin: center,
      size: aoe.size,
      direction: direction ? vectorToCompassDegrees(direction) : undefined,
      width: aoe.height ?? 5
    }
  }
}

function normalizeShapeForSharedGeometry(shape: AreaOfEffect['shape']): AoEShape {
  switch (shape) {
    case 'Square':
      return 'Cube'
    case 'Sphere':
    case 'Cone':
    case 'Cube':
    case 'Line':
    case 'Cylinder':
      return shape
    default:
      throw new Error(`Unknown AoE shape: ${shape}`)
  }
}

function vectorToCompassDegrees(direction: Position): number {
  const angleRad = Math.atan2(direction.y, direction.x)
  const angleDeg = angleRad * (180 / Math.PI)
  const compassDegrees = angleDeg + 90
  return compassDegrees < 0 ? compassDegrees + 360 : compassDegrees
}
