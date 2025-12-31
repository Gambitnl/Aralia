/**
 * @file src/utils/aoeCalculations.ts
 * Utility module for calculating Area of Effect (AoE) tiles for various spell shapes.
 *
 * COORDINATE SYSTEM NOTES:
 * 1. Grid Coordinates: Standard 2D grid where (x, y) = (col, row).
 *    - x increases to the East (right)
 *    - y increases to the South (down)
 *
 * 2. Compass Angles (Input):
 *    - 0° = North (-y)
 *    - 90° = East (+x)
 *    - 180° = South (+y)
 *    - 270° = West (-x)
 *
 * 3. Math/Trig Angles (Internal):
 *    - 0° = East (+x)
 *    - 90° = South (+y)  (Because y is inverted relative to standard Cartesian)
 *    - 180° = West (-x)
 *    - -90° = North (-y)
 *
 * CONVERSION:
 * MathAngle = CompassAngle - 90°
 * CompassAngle = MathAngle + 90°
 */

import { Position } from '../types/combat';
// TODO(lint-intent): 'normalizeAngle' is imported but unused; it hints at a helper/type the module was meant to use.
// TODO(lint-intent): If the planned feature is still relevant, wire it into the data flow or typing in this file.
// TODO(lint-intent): Otherwise drop the import to keep the module surface intentional.
import { compassToMathAngle, degreesToRadians, normalizeAngle as _normalizeAngle, getAngleBetweenPositions } from './geometry';

export type AoEShape = "Sphere" | "Cone" | "Cube" | "Line" | "Cylinder";

export interface AoEParams {
    shape: AoEShape;
    origin: Position;
    size: number; // in feet. For Line, this is length.
    direction?: number; // for cone/line (in degrees, 0=North, 90=East)
    targetPoint?: Position; // alternative to direction for line endpoint
    width?: number; // Optional width for line, defaults to 5
    gridSize?: number; // Grid size in feet (default 5)
}

const TILE_SIZE = 5; // feet

/**
 * Calculates the list of grid positions affected by an Area of Effect.
 *
 * This is the main entry point for AoE calculations. It delegates to specific
 * shape handlers based on the `params.shape`.
 *
 * @param params - Configuration object for the AoE
 * @param params.shape - The shape of the area (Sphere, Cone, Cube, Line, Cylinder)
 * @param params.origin - The center or starting point of the AoE on the grid
 * @param params.size - The primary size dimension in feet (Radius for Sphere/Cylinder, Length for Cone/Line, Side for Cube)
 * @param params.direction - (Optional) Direction in degrees for Cones and Lines (0=North, 90=East)
 * @param params.targetPoint - (Optional) Specific target point for Lines (overrides direction)
 * @param params.width - (Optional) Width of the line in feet (default: 5)
 * @returns Array of grid positions (x, y) that are within the area of effect
 *
 * @example
 * // Calculate a 20ft Fireball (Sphere) centered at (10, 10)
 * const affected = calculateAffectedTiles({
 *   shape: 'Sphere',
 *   origin: { x: 10, y: 10 },
 *   size: 20
 * });
 *
 * @example
 * // Calculate a 15ft Cone of Cold directed East
 * const affected = calculateAffectedTiles({
 *   shape: 'Cone',
 *   origin: { x: 10, y: 10 },
 *   size: 15,
 *   direction: 90
 * });
 */
export function calculateAffectedTiles(params: AoEParams): Position[] {
    // TODO: Future: Support gridless (Euclidean) AoE for non-tile maps by returning a polygon instead of tile list.
    switch (params.shape) {
        case 'Sphere':
        case 'Cylinder': // 2D projection of Cylinder is a Circle/Sphere
            return getSphereAoE(params.origin, params.size);
        case 'Cone':
            return getConeAoE(params.origin, params.direction ?? 0, params.size);
        case 'Cube':
            return getCubeAoE(params.origin, params.size);
        case 'Line': {
            const target = params.targetPoint ?? projectPoint(params.origin, params.direction ?? 0, params.size);
            return getLineAoE(params.origin, target, params.width ?? 5);
        }
        default:
            console.warn(`Unknown AoE shape: ${params.shape}`);
            return [];
    }
}

/**
 * Calculates tiles within a radius for a Sphere/Circle AoE.
 *
 * Uses Chebyshev distance (5-5-5 rule) instead of Euclidean distance to align
 * with the grid movement system. This results in a square area of effect on
 * the grid, ensuring that diagonals cost the same as cardinals (1-1-1).
 *
 * @param origin - The center point of the sphere
 * @param radius - The radius in feet
 * @returns Array of affected grid positions
 */
function getSphereAoE(origin: Position, radius: number): Position[] {
    const affected: Position[] = [];
    const radiusInTiles = radius / TILE_SIZE;

    // Bounding box optimization
    const startX = Math.floor(origin.x - radiusInTiles);
    const endX = Math.ceil(origin.x + radiusInTiles);
    const startY = Math.floor(origin.y - radiusInTiles);
    const endY = Math.ceil(origin.y + radiusInTiles);

    for (let x = startX; x <= endX; x++) {
        for (let y = startY; y <= endY; y++) {
            // Use Chebyshev distance (5-5-5 rule) to align with grid movement
            const dx = Math.abs(x - origin.x);
            const dy = Math.abs(y - origin.y);
            const distance = Math.max(dx, dy) * TILE_SIZE;

            if (distance <= radius) {
                affected.push({ x, y });
            }
        }
    }
    return affected;
}

/**
 * Calculates tiles within a Cone using grid coordinates.
 *
 * Updates to align with 5e Grid Rules (XGE/DMG):
 * "A cone's width at a given point along its length is equal to that point's distance from the point of origin."
 * Mathematically, this corresponds to an isosceles triangle where Base = Height,
 * implying a half-angle of arctan(0.5) ≈ 26.565°. Total angle ≈ 53.13°.
 *
 * The implementation uses a derived constant to represent this angle mathematically,
 * with a small epsilon to account for floating-point precision when checking boundaries.
 *
 * @param origin - The starting point of the cone
 * @param direction - Compass direction in degrees (0=N, 90=E)
 * @param length - Length of the cone in feet
 * @returns Array of affected grid positions
 */
function getConeAoE(origin: Position, direction: number, length: number): Position[] {
    // 5e Rule: Width = Distance.
    // tan(theta/2) = (Width/2) / Distance = 0.5
    // theta/2 = arctan(0.5) ≈ 26.56505... degrees
    const HALF_ANGLE_RAD = Math.atan(0.5);
    const FULL_ANGLE_DEG = (HALF_ANGLE_RAD * 2) * (180 / Math.PI); // ~53.1301... degrees

    // Add small epsilon for floating point inclusion on exact boundaries
    const CONE_ANGLE = FULL_ANGLE_DEG + 0.1;

    const affected: Position[] = [];
    const lengthInTiles = length / TILE_SIZE;

    // Scan area
    const startX = Math.floor(origin.x - lengthInTiles);
    const endX = Math.ceil(origin.x + lengthInTiles);
    const startY = Math.floor(origin.y - lengthInTiles);
    const endY = Math.ceil(origin.y + lengthInTiles);

    for (let x = startX; x <= endX; x++) {
        for (let y = startY; y <= endY; y++) {
            const dx = x - origin.x;
            const dy = y - origin.y;
            // Use Chebyshev distance (5-5-5 rule) to align with grid movement
            const distance = Math.max(Math.abs(dx), Math.abs(dy)) * TILE_SIZE;

            if (distance > length) continue;
            // Exclude origin tile
            if (distance < 0.1) continue;

            const gridAngle = getAngleBetweenPositions(origin, { x, y });

            // Check if tile angle is within cone width relative to direction
            let diff = Math.abs(gridAngle - direction);
            if (diff > 180) diff = 360 - diff;

            if (diff <= CONE_ANGLE / 2) {
                affected.push({ x, y });
            }
        }
    }
    return affected;
}

/**
 * Calculates tiles within a Cube.
 *
 * @param origin - The top-left corner (north-west) of the cube area
 * @param size - The length of one side of the cube in feet
 * @returns Array of affected grid positions
 */
function getCubeAoE(origin: Position, size: number): Position[] {
    const tiles = size / TILE_SIZE;
    const affected: Position[] = [];

    for (let x = origin.x; x < origin.x + tiles; x++) {
        for (let y = origin.y; y < origin.y + tiles; y++) {
            affected.push({ x, y });
        }
    }
    return affected;
}

/**
 * Calculates tiles along a Line using a distance-from-segment check.
 *
 * Supports arbitrary widths (e.g., 5ft, 10ft, 15ft). The line acts as a
 * capsule (rounded ends) or rotated rectangle depending on interpretation,
 * but here we use Euclidean distance from the center segment (Capsule-like)
 * which aligns well with standard grid coverage rules: if the tile center
 * is within Radius of the segment, it's covered.
 *
 * @param origin - The starting position of the line
 * @param target - The ending position of the line
 * @param width - The width of the line in feet. Default 5.
 * @returns Array of affected grid positions
 */
function getLineAoE(origin: Position, target: Position, width: number): Position[] {
    const affected: Position[] = [];
    const radius = width / 2;
    // Small epsilon to handle floating point errors on exact boundaries (e.g., 5ft dist for 10ft width)
    const EPSILON = 0.001;
    const effectiveRadius = radius + EPSILON;
    const tilesWide = width / TILE_SIZE;
    const hasEvenTileWidth = Number.isInteger(tilesWide) && (tilesWide % 2 === 0);

    // For even widths (10ft, 20ft, ...), shift the line center by half a tile
    // along the perpendicular so the covered rows/columns stay symmetric and
    // we don't over-count a middle tile on each side.
    const dx = target.x - origin.x;
    const dy = target.y - origin.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    const perpUnit = length === 0 ? { x: 0, y: 0 } : { x: -(dy / length), y: dx / length };
    const halfTileOffset = hasEvenTileWidth ? 0.5 : 0;
    const offsetVec = { x: perpUnit.x * halfTileOffset, y: perpUnit.y * halfTileOffset };
    const shiftedOrigin = { x: origin.x + offsetVec.x, y: origin.y + offsetVec.y };
    const shiftedTarget = { x: target.x + offsetVec.x, y: target.y + offsetVec.y };

    // Convert radius to tiles for bounding box
    const radiusInTiles = Math.ceil(radius / TILE_SIZE);

    // Determine bounding box
    const minX = Math.floor(Math.min(origin.x, target.x) - radiusInTiles);
    const maxX = Math.ceil(Math.max(origin.x, target.x) + radiusInTiles);
    const minY = Math.floor(Math.min(origin.y, target.y) - radiusInTiles);
    const maxY = Math.ceil(Math.max(origin.y, target.y) + radiusInTiles);

    for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
            const distance = pointLineSegmentDistance(
                x, y,
                shiftedOrigin.x, shiftedOrigin.y,
                shiftedTarget.x, shiftedTarget.y
            );

            // Distance is in tiles. Convert to feet for comparison.
            const distanceFeet = distance * TILE_SIZE;

            if (distanceFeet <= effectiveRadius) {
                affected.push({ x, y });
            }
        }
    }
    return affected;
}

/**
 * Calculates the shortest distance from a point to a line segment.
 * @param px - Point x
 * @param py - Point y
 * @param x1 - Segment start x
 * @param y1 - Segment start y
 * @param x2 - Segment end x
 * @param y2 - Segment end y
 * @returns Distance in same units as inputs (tiles)
 */
function pointLineSegmentDistance(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
    if (l2 === 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2); // Segment is a point

    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t)); // Clamp t to segment

    const projectionX = x1 + t * (x2 - x1);
    const projectionY = y1 + t * (y2 - y1);

    return Math.sqrt((px - projectionX) ** 2 + (py - projectionY) ** 2);
}

/**
 * Projects a point from the origin at a specified compass direction and distance.
 * @param origin - The starting position
 * @param directionDegrees - Compass direction (0°=N, 90°=E, 180°=S, 270°=W)
 * @param distanceFeet - Distance to project in feet
 * @returns The projected position on the grid
 */
function projectPoint(origin: Position, directionDegrees: number, distanceFeet: number): Position {
    const distTiles = distanceFeet / TILE_SIZE;

    // Convert Compass Angle to Math Angle for trig functions
    // Compass: 0=N, 90=E
    // Math (screen coords): -90=N, 0=E
    // Formula: Math = Compass - 90
    const mathAngleDeg = compassToMathAngle(directionDegrees);
    const radians = degreesToRadians(mathAngleDeg);

    // Calculate normalized direction vector
    const dx = Math.cos(radians);
    const dy = Math.sin(radians);

    // Chebyshev Scale Factor:
    // In Chebyshev geometry (5-5-5 rule), movement along the diagonal costs the same as cardinal.
    // We want the resulting point (x,y) to have a Chebyshev distance of distTiles from origin.
    // Chebyshev Distance = max(|x|, |y|) = scale * max(|dx|, |dy|)
    // Therefore: scale = distTiles / max(|dx|, |dy|)
    // This stretches diagonals so 30ft diagonal = 6 tiles displacement on BOTH axes.
    const maxComponent = Math.max(Math.abs(dx), Math.abs(dy));
    const scale = maxComponent > 0 ? distTiles / maxComponent : 0;

    return {
        x: origin.x + dx * scale,
        y: origin.y + dy * scale
    };
}
