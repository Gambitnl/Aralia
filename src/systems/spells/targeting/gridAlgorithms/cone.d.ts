import type { Position } from '@/types';
/**
 * Calculate tiles in a conical AoE
 *
 * Uses 90-degree cone emanating from origin
 * Expands width as it extends
 *
 * @param origin - Starting position (caster)
 * @param direction - Direction vector (will be normalized)
 * @param size - Length of cone in feet
 * @returns Array of tile positions in cone
 *
 * @example
 * // Burning Hands: 15ft cone
 * const tiles = getCone(
 *   { x: 5, y: 5 },
 *   { x: 1, y: 0 },  // Facing east
 *   15
 * )
 */
export declare function getCone(origin: Position, direction: Position, size: number): Position[];
