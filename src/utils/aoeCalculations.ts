/**
 * @file src/utils/aoeCalculations.ts
 * Utility module for calculating Area of Effect (AoE) tiles for various spell shapes.
 */

import { Position } from '../types/combat';

export type AoEShape = "Sphere" | "Cone" | "Cube" | "Line" | "Cylinder";

export interface AoEParams {
    shape: AoEShape;
    origin: Position;
    size: number; // in feet. NOTE: For Line, this is often length, but width is handled separately or fixed.
    // For Line in D&D, size usually refers to length. Width is standard 5ft unless specified.
    // We might need a separate 'width' param or overload 'size'.
    // Based on task description: "Line -> Width 5 feet (1 tile wide). Formula: Interpolate points along line"
    direction?: number; // for cone (in degrees, 0=north, 90=east)
    targetPoint?: Position; // alternative to direction for line endpoint
    width?: number; // Optional width for line, defaults to 5
    gridSize?: number; // Grid size in feet (default 5)
}

const TILE_SIZE = 5; // feet

/**
 * Calculates the list of grid positions affected by an Area of Effect.
 * @param params Configuration for the AoE (shape, origin, size, etc.)
 * @param mapDimensions Optional map boundaries to clip results (not strictly required if logic is pure grid)
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
            // For line, we need a target point to define endpoint.
            // If targetPoint is missing, we might use direction + size to find it?
            // For now, assume targetPoint is provided or we project one.
            const target = params.targetPoint ?? projectPoint(params.origin, params.direction ?? 0, params.size);
            return getLineAoE(params.origin, target, params.width ?? 5);
        default:
            console.warn(`Unknown AoE shape: ${params.shape}`);
            return [];
    }
}

/**
 * Calculates tiles within a radius (Sphere/Circle).
 * Uses Euclidean distance (standard D&D 5e variant, often loose or "center-to-center").
 * Here we use center-to-center distance check <= radius.
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
            const distance = Math.sqrt(Math.pow(x - origin.x, 2) + Math.pow(y - origin.y, 2)) * TILE_SIZE;
            // Many VTTs give a bit of wiggle room (e.g. +0.5 tile partial coverage), but strict <= radius is safest start.
            // D&D 5e raw: if 50% of square is covered.
            // Center-to-center distance <= radius approximates 50% coverage logic roughly.
            if (distance <= radius) {
                affected.push({ x, y });
            }
        }
    }
    return affected;
}

/**
 * Calculates tiles within a Cone.
 * Standard 5e Cone: 53.13 degrees (atan(0.5) * 2 roughly?).
 * Actually 5e plays it loosely on grid: "length of cone"
 */
function getConeAoE(origin: Position, direction: number, length: number): Position[] {
    const coneAngle = 53; // degrees
    const affected: Position[] = [];
    // Scan area - length defines max reach
    const lengthInTiles = length / TILE_SIZE;
    const startX = Math.floor(origin.x - lengthInTiles);
    const endX = Math.ceil(origin.x + lengthInTiles);
    const startY = Math.floor(origin.y - lengthInTiles);
    const endY = Math.ceil(origin.y + lengthInTiles);

    for (let x = startX; x <= endX; x++) {
        for (let y = startY; y <= endY; y++) {
            const dx = x - origin.x;
            const dy = y - origin.y; // Y increases downwards usually?
            // Assuming standard cartesian for calculation, but map Y might be inverted.
            // atan2(dy, dx) works for direction logic regardless if consistent with `direction` input.

            const distance = Math.sqrt(dx * dx + dy * dy) * TILE_SIZE;

            if (distance > length) continue;
            // Origin tile is usually included or excluded? Spells originate from caster.
            // Usually caster tile is NOT target.
            if (distance < 0.1) continue;

            // Calculate angle to target
            // Note: direction 0 = North? -Y?
            // If we assume standard math: 0 = East (+X), 90 = South (+Y)
            // We need to ensure 'direction' matches this system.
            // If prompt says 0=North, that's -Y.
            // Let's assume input 'direction' is in degrees, 0 = North (-Y).
            // We need to convert our atan2 result to match this frame.

            // Math.atan2(y, x) -> 0 is +X (East), -PI/2 is -Y (North)
            // So to align: North (0 deg) -> -90 math deg.
            // Let's just use a helper or align inputs.
            // Simpler: convert (dx, dy) to polar matching the input 'direction' frame.
            // Let's trust the prompt algorithm snippet which does:
            // angle = Math.atan2(dy, dx) * (180 / Math.PI)
            // angleDiff = abs(normalize(angle - direction))
            // It implies `direction` matches atan2 output frame logic OR needs offset.
            // If we assume standard map direction: 0=N, 90=E, 180=S, 270=W
            // Math.atan2(dy, dx): (0,-1)=> -90 (N?), (1,0)=> 0 (E)
            // So N (-90) vs 0 input. Discrepancy.
            // Let's fix by converting grid angle to compass angle.

            const angleRad = Math.atan2(dy, dx);
            let angleDeg = angleRad * (180 / Math.PI);

            // Convert atan2 (-180 to 180) to Compass (0=N, 90=E, 180=S, 270=W)?
            // atan2: 0=E, 90=S, 180=W, -90=N
            // Compass: 0=N, 90=E, 180=S, 270=W
            // Map: (atan2 + 90) % 360 -> N=0, E=90, S=180, W=270

            let gridAngle = angleDeg + 90;
            // Normalize to 0-360
            if (gridAngle < 0) gridAngle += 360;
            if (gridAngle >= 360) gridAngle -= 360;

            // Now compare with direction
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
 * Cube usually originates from a face or point.
 * "You select a cube... origin is a point on a face".
 * Simplified: Axis aligned box starting at origin? Or centered?
 * "point of origin... anywhere on a face of the cubic effect"
 * Usually in VTTs, you verify if the tile center is inside the box.
 * Task Algorithm says: for x = origin.x to origin.x + size...
 * This implies Origin is Top-Left (or min-coords) corner.
 */
function getCubeAoE(origin: Position, size: number): Position[] {
    const tiles = size / TILE_SIZE;
    const affected: Position[] = [];

    // Assuming origin is Top-Left corner of the cube area
    // Need to handle if we want to center it?
    // Prompts "Algorithm" snippet iterates x from origin to origin+tiles.
    // We will stick to that implementation for now.
    // Ideally, origin + direction determines which way the cube extends,
    // but AoEParams for Cube usually doesn't have direction in VTTs effectively (snap to grid).
    // If 'direction' was passed, we could rotate, but 'Cube' implies axis-aligned usually.

    // Note: loops should go up to range.
    // If tiles=2, we want x, x+1.
    for (let x = origin.x; x < origin.x + tiles; x++) {
        for (let y = origin.y; y < origin.y + tiles; y++) {
            affected.push({ x, y });
        }
    }
    return affected;
}

/**
 * Calculates tiles along a Line.
 * Linear Interpolation (Lerp).
 */
function getLineAoE(origin: Position, target: Position, width: number): Position[] {
    const dx = target.x - origin.x;
    const dy = target.y - origin.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.ceil(distance); // 1 step per tile unit roughly
    const affected: Position[] = [];
    const visited = new Set<string>();

    for (let i = 0; i <= steps; i++) {
        const t = steps === 0 ? 0 : i / steps;
        const curX = Math.round(origin.x + t * dx);
        const curY = Math.round(origin.y + t * dy);

        // Add logic for width?
        // If width = 5ft (1 tile), simple line is fine.
        // If wider, might need perpendicular expansion.
        // Task says: "Width: 5 feet (1 tile wide)... Formula: Interpolate points along line"
        // So simple line trace is sufficient.

        const key = `${curX},${curY}`;
        if (!visited.has(key)) {
            visited.add(key);
            affected.push({ x: curX, y: curY });
        }
    }
    return affected;
}

function projectPoint(origin: Position, directionDegrees: number, distanceFeet: number): Position {
    const distTiles = distanceFeet / TILE_SIZE;
    // Convert Compass (0=N, 90=E) to Math (0=E, -90=N)?
    // Previously: GridAngle = Math + 90. So Math = GridAngle - 90.

    const mathAngleDeg = directionDegrees - 90;
    const radians = mathAngleDeg * (Math.PI / 180);

    return {
        x: origin.x + Math.cos(radians) * distTiles,
        y: origin.y + Math.sin(radians) * distTiles
    };
}
