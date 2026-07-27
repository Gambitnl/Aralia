import type { Position } from '@/types';
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
export declare function getLine(start: Position, direction: Position, length: number, width?: number): Position[];
