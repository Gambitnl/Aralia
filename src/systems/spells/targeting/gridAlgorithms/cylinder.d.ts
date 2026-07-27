import type { Position } from '@/types';
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
export declare function getCylinder(center: Position, radius: number, _height?: number): Position[];
