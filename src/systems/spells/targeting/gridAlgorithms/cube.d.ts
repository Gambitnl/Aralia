import type { Position } from '@/types';
/**
 * Calculate tiles in a cubic AoE
 *
 * @param center - Center position (or corner, depending on spell)
 * @param size - Edge length in feet
 * @returns Array of tile positions in cube
 *
 * @example
 * // 10ft cube (Thunderwave)
 * const tiles = getCube({ x: 5, y: 5 }, 10)
 * // Returns 2x2 square (4 tiles)
 */
export declare function getCube(center: Position, size: number): Position[];
