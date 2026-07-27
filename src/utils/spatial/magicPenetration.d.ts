/**
 * @file src/utils/spatial/magicPenetration.ts
 * Utility functions for checking if magical sensors (like Detect Magic)
 * can penetrate through walls and obstacles based on material properties.
 */
import { BattleMapData, Position } from '../../types/combat.js';
import { MaterialType } from '../../types/materials.js';
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
export declare function checkMagicalLineOfEffect(start: Position, end: Position, mapData: BattleMapData): PenetrationResult;
