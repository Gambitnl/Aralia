/**
 * @file src/utils/spatial/magicPenetration.ts
 * Utility functions for checking if magical sensors (like Detect Magic)
 * can penetrate through walls and obstacles based on material properties.
 */
import { BattleMapData, Position } from '../../types/combat.js';
import { MATERIAL_PROPERTIES, MaterialType } from '../../types/materials.js';
import { bresenhamLine } from './lineOfSight.js';

export interface PenetrationResult {
  hasLineOfEffect: boolean;
  blockingTile?: Position;
  blockedByMaterial?: MaterialType;
  accumulatedThickness?: number;
}

/**
 * Checks if a magical sensor/effect (like Detect Magic) can reach from a start position to an end position.
 * The path is traced using Bresenham's line algorithm. It accumulates the thickness of any materials encountered.
 * If the accumulated thickness of a material exceeds its magicPenetrationLimitInches, the effect is blocked.
 *
 * Examples from D&D 5e for Detect Magic:
 * - Blocked by 1 foot (12 inches) of stone
 * - Blocked by 1 foot (12 inches) of dirt
 * - Blocked by 1 foot (12 inches) of wood
 * - Blocked by 1 inch of metal
 * - Blocked by a thin sheet of lead (0.1 inches)
 */
export function checkMagicalLineOfEffect(
  start: Position,
  end: Position,
  mapData: BattleMapData
): PenetrationResult {
  const line = bresenhamLine(start.x, start.y, end.x, end.y);

  // Track normalized penetration factor along this specific line.
  // 1.0 means the magical sensor is fully blocked.
  let accumulatedPenetrationFactor = 0;
  let lastBlockedMaterial: MaterialType | undefined;
  let lastThickness = 0;

  for (const point of line) {
    // Skip the start point itself, it doesn't block its own emanation
    if (point.x === start.x && point.y === start.y) {
      continue;
    }

    const tileId = `${point.x}-${point.y}`;
    const tile = mapData.tiles.get(tileId);

    if (tile && tile.material) {
      // Reviewer requested default thickness if missing. Assume 60 inches (5ft tile) if not specified
      const tileThickness = tile.thicknessInches ?? 60;
      const materialProps = MATERIAL_PROPERTIES[tile.material];

      if (materialProps && materialProps.magicPenetrationLimitInches !== undefined) {
        if (materialProps.magicPenetrationLimitInches === 0) {
            // Instant block (like lead)
            accumulatedPenetrationFactor = 1.0;
        } else {
            accumulatedPenetrationFactor += (tileThickness / materialProps.magicPenetrationLimitInches);
        }

        lastBlockedMaterial = tile.material;
        lastThickness = tileThickness;

        if (accumulatedPenetrationFactor >= 1.0) {
          return {
            hasLineOfEffect: false,
            blockingTile: { x: point.x, y: point.y },
            blockedByMaterial: lastBlockedMaterial,
            accumulatedThickness: lastThickness
          };
        }
      }
    }
  }

  // If we reach the end without hitting a penetration limit, the magic goes through
  return {
    hasLineOfEffect: true
  };
}
