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
 * @param params Configuration for the AoE (shape, origin, size, etc.)
 * @returns Array of affected Positions
 */
export function calculateAffectedTiles(params: AoEParams): Position[] {
    switch (params.shape) {
        case 'Sphere':
        case 'Cylinder': // 2D projection of Cylinder is a Circle/Sphere
            return getSphereAoE(params.origin, params.size);
        case 'Cone':
            return getConeAoE(params.origin, params.direction ?? 0, params.size);
        case 'Cube':
            return getCubeAoE(params.origin, params.size);
        case 'Line':
            const target = params.targetPoint ?? projectPoint(params.origin, params.direction ?? 0, params.size);
            return getLineAoE(params.origin, target, params.width ?? 5);
        default:
            console.warn(`Unknown AoE shape: ${params.shape}`);
            return [];
    }
}

/**
 * Calculates tiles within a radius (Sphere/Circle).
 * Uses center-to-center Euclidean distance check <= radius.
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
 * @param origin - The starting point of the cone
 * @param direction - Compass direction in degrees (0=N, 90=E)
 * @param length - Length of the cone in feet
 */
function getConeAoE(origin: Position, direction: number, length: number): Position[] {
    const coneAngle = 53; // Standard 5e Cone angle (~53 degrees)
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

            // Calculate angle from origin to target tile using Math.atan2
            // atan2 returns angle in radians relative to +x axis (East)
            // Range: -PI to +PI
            const angleRad = Math.atan2(dy, dx);
            const angleDeg = angleRad * (180 / Math.PI);

            // Convert Math Angle to Compass Angle
            // Math: 0=E, 90=S, 180=W, -90=N
            // Compass: 90=E, 180=S, 270=W, 0=N
            // Formula: Compass = Math + 90
            let gridAngle = angleDeg + 90;

            // Normalize to 0-360
            if (gridAngle < 0) gridAngle += 360;
            if (gridAngle >= 360) gridAngle -= 360;

            // Check if tile angle is within cone width relative to direction
            let diff = Math.abs(gridAngle - direction);
            if (diff > 180) diff = 360 - diff;

            if (diff <= coneAngle / 2) {
                affected.push({ x, y });
            }
        }
    }
    return affected;
}

/**
 * Calculates tiles within a Cube.
 * Assumes origin is top-left corner of the cube area.
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
 * Calculates tiles along a Line using Linear Interpolation.
 */
function getLineAoE(origin: Position, target: Position, width: number): Position[] {
    const dx = target.x - origin.x;
    const dy = target.y - origin.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.ceil(distance);
    const affected: Position[] = [];
    const visited = new Set<string>();

    for (let i = 0; i <= steps; i++) {
        const t = steps === 0 ? 0 : i / steps;
        const curX = Math.round(origin.x + t * dx);
        const curY = Math.round(origin.y + t * dy);

        const key = `${curX},${curY}`;
        if (!visited.has(key)) {
            visited.add(key);
            affected.push({ x: curX, y: curY });
        }
    }
    return affected;
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
    const mathAngleDeg = directionDegrees - 90;
    const radians = mathAngleDeg * (Math.PI / 180);

    return {
        x: origin.x + Math.cos(radians) * distTiles,
        y: origin.y + Math.sin(radians) * distTiles
    };
}
