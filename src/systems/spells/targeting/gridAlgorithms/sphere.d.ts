import type { Position } from '@/types';
/**
 * Calculate tiles in a spherical AoE using Euclidean distance
 *
 * Formula: distance = sqrt((x2-x1)² + (y2-y1)²)
 *
 * @param center - Center point of sphere
 * @param radius - Radius in feet
 * @returns Array of tile positions within radius
 *
 * @example
 * // 20ft radius Fireball centered at (10, 10)
 * const tiles = getSphere({ x: 10, y: 10 }, 20)
 * // Returns ~13 tiles in circular pattern
 */
export declare function getSphere(center: Position, radius: number): Position[];
