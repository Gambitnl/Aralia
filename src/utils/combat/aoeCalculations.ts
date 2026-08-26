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

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * CRITICAL CORE SYSTEM: Changes here ripple across the entire city.
 *
 * Last Sync: 20/09/2026, 21:00:39
 * Dependents: commands/effects/TerrainCommand.ts, components/BattleMap/GridlessAoEOutline.tsx, components/DesignPreview/steps/scenarioControls/areaEffectScenarioControls.ts, hooks/ability/targetSelection.ts, hooks/ability/useAbilityExecution.ts, hooks/actionUtils.ts, hooks/combat/useTargeting.ts, systems/spells/effects/trigger/zoneLifecycle.ts, systems/spells/mechanics/areaDamageSpellCastResolution.ts, systems/spells/targeting/AoECalculator.ts, utils/combat/index.ts, utils/spatial/targetingUtils.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { Direction, Position } from '../../types/combat';
import type { ConductivityRule } from '../../types/elemental';
import { StateTag } from '../../types/elemental';
import { compassToMathAngle, degreesToRadians, facingToVector, getAngleBetweenPositions } from '../spatial/geometry';

export type AoEShape = "Sphere" | "Cone" | "Cube" | "Line" | "Cylinder";

export interface AoEParams {
    shape: AoEShape;
    origin: Position;
    size: number; // in feet. For Line, this is length.
    direction?: number; // for cone/line/cube (in degrees, 0=North, 90=East)
    targetPoint?: Position; // alternative to direction for line endpoint
    width?: number; // Optional width for line, defaults to 5
    gridSize?: number; // Grid size in feet (default 5)
    /**
     * Cube only (ruling Q4, 2026-09-22): the caster tile. The cube extends away
     * from this tile. See resolveCubeAxis for the full order of sources.
     */
    casterPosition?: Position;
    /** Cube only: the caster facing. Used when the origin is the caster tile. */
    casterFacing?: Direction;
    /** Cube only: names for the error message when no direction is found. */
    spellName?: string;
    casterName?: string;
}

/**
 * The source data that gives a cube its direction. It is a subset of AoEParams,
 * so a caller can pass AoEParams directly.
 */
export type CubeAnchorInput = Pick<AoEParams, 'casterPosition' | 'casterFacing' | 'direction' | 'spellName' | 'casterName'>;

/** A unit step along one grid axis: the direction in which a cube extends. */
export interface CubeAxis {
    x: -1 | 0 | 1;
    y: -1 | 0 | 1;
}

/**
 * Reduce a vector to one grid axis: the axis with the larger absolute value.
 * When both values are equal (a true diagonal), use the horizontal axis.
 * Returns null for a zero vector.
 */
function dominantAxis(dx: number, dy: number): CubeAxis | null {
    if (dx === 0 && dy === 0) return null;
    if (Math.abs(dx) >= Math.abs(dy)) return { x: dx > 0 ? 1 : -1, y: 0 };
    return { x: 0, y: dy > 0 ? 1 : -1 };
}

/**
 * Find the grid axis along which a cube extends away from the caster.
 *
 * RULING Q4 (Remy, 2026-09-22): "Anchor on a face (rules)". The 5e rule puts
 * the point of origin on one face of the cube, and the cube extends away from
 * the caster. This is the ONE cube anchor in the repo. The centered cube in
 * gridAlgorithms/cube.ts is deleted (GG-202).
 *
 * Order of sources:
 * 1. casterPosition, when it is not the origin tile: the dominant axis of the
 *    vector caster -> origin. On a tie (a true diagonal), use the horizontal axis.
 * 2. direction (compass degrees): the dominant axis of that heading. A persistent
 *    zone keeps only this value, so a zone replays the same cube.
 * 3. casterFacing, when the origin is the caster tile (or no caster tile is given).
 * 4. None of these: throw. There is no default direction (no-fallback directive).
 */
export function resolveCubeAxis(origin: Position, anchor: CubeAnchorInput): CubeAxis {
    const caster = anchor.casterPosition;
    if (caster) {
        const fromCaster = dominantAxis(origin.x - caster.x, origin.y - caster.y);
        if (fromCaster) return fromCaster;
    }

    if (anchor.direction !== undefined) {
        const radians = degreesToRadians(compassToMathAngle(anchor.direction));
        // Round away float noise so that 90 degrees gives exactly (1, 0).
        const dx = Math.round(Math.cos(radians) * 1e9) / 1e9;
        const dy = Math.round(Math.sin(radians) * 1e9) / 1e9;
        const fromDirection = dominantAxis(dx, dy);
        if (fromDirection) return fromDirection;
    }

    if (anchor.casterFacing) {
        const facing = facingToVector(anchor.casterFacing);
        const fromFacing = dominantAxis(facing.x, facing.y);
        if (fromFacing) return fromFacing;
    }

    throw new Error(
        `Cube area needs a direction: spell "${anchor.spellName ?? 'unknown spell'}" by caster ` +
        `"${anchor.casterName ?? 'unknown caster'}" at origin ${origin.x},${origin.y} has no caster ` +
        `position away from the origin, no direction, and no caster facing.`
    );
}

/** Compass degrees (0 = North, 90 = East) of a cube axis. Used to store the axis on a zone. */
export function cubeAxisToCompassDegrees(axis: CubeAxis): number {
    if (axis.y === -1) return 0;
    if (axis.x === 1) return 90;
    if (axis.y === 1) return 180;
    return 270;
}

const TILE_SIZE = 5; // feet

/**
 * Calculates the list of grid positions affected by an Area of Effect.
 *
 * This is the main entry point for AoE calculations. It delegates to specific
 * shape handlers based on the `params.shape`.
 *
 * CURRENT FUNCTIONALITY:
 * - Supports 5 different AoE shapes (Sphere, Cone, Cube, Line, Cylinder)
 * - Handles directional targeting for cones and lines
 * - Converts feet measurements to grid coordinates
 * - Uses Chebyshev distance for 5e-compliant grid movement
 * - Provides flexible parameter system for different spell requirements
 *
 * IMPROVEMENT OPPORTUNITIES:
 * 1. PERFORMANCE: Shape-specific calculations could be optimized
 *    - Pre-calculate common AoE patterns for popular spells
 *    - Implement spatial partitioning for large battle maps
 *    - Add caching for static AoE calculations
 * 2. ACCURACY: Current implementation may not match all 5e edge cases
 *    - Add support for diagonal cone spreading rules
 *    - Implement more precise line width calculations
 *    - Handle overlapping AoEs from multiple sources
 * 3. EXTENSIBILITY: Limited customization options
 *    - Add support for irregular AoE shapes
 *    - Implement dynamic AoE modification (spells that change shape)
 *    - Support for AoE effects that persist over time
 * 4. MAINTAINABILITY: Switch statement becomes unwieldy with many shapes
 *    - Consider strategy pattern for shape handlers
 *    - Extract shape-specific logic into separate modules
 *    - Add comprehensive test coverage for edge cases
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
/**
 * A gridless area of effect: a closed polygon in MAP UNITS (tiles, fractional),
 * plus the exact circle for round shapes so a renderer can draw a true arc
 * instead of the 32-gon. Euclidean geometry throughout; nothing here snaps to
 * tiles. Sibling of calculateAffectedTiles (RESOLVED 2026-09-09 note, GG-211).
 */
export interface AoEPolygon {
    shape: AoEShape;
    /** Closed polygon, map units (1 = one tile = TILE_SIZE feet). First vertex is not repeated. */
    vertices: Position[];
    /** Present for Sphere/Cylinder: the exact circle the polygon approximates. */
    circle?: { center: Position; radius: number };
}

const CIRCLE_SEGMENTS = 32;
/** 5e cone: width at the far end equals the length, so the half angle is atan(0.5). */
const CONE_HALF_ANGLE_RAD = Math.atan(0.5);

/**
 * Gridless (Euclidean) sibling of calculateAffectedTiles for boards without
 * tiles: the 3D battle map highlight and any future free-move surface.
 * Same AoEParams, same compass convention (0 = North, 90 = East), same
 * face-anchored cube; returns a polygon instead of a tile list.
 *
 * - Sphere/Cylinder: circle of radius size/5 tiles around the origin.
 * - Cone: origin plus an arc of length size/5 tiles spanning 2*atan(0.5).
 * - Cube: face-anchored square. The near face goes through the origin and the
 *   square extends size/5 tiles away from the caster (resolveCubeAxis).
 * - Line: rectangle of length size (or to targetPoint) and width (default 5 ft).
 */
export function calculateAffectedArea(params: AoEParams): AoEPolygon {
    const { origin } = params;
    const sizeTiles = params.size / TILE_SIZE;
    switch (params.shape) {
        case 'Sphere':
        case 'Cylinder': {
            const vertices: Position[] = [];
            for (let i = 0; i < CIRCLE_SEGMENTS; i++) {
                const a = (i / CIRCLE_SEGMENTS) * Math.PI * 2;
                vertices.push({ x: origin.x + Math.cos(a) * sizeTiles, y: origin.y + Math.sin(a) * sizeTiles });
            }
            return { shape: params.shape, vertices, circle: { center: { ...origin }, radius: sizeTiles } };
        }
        case 'Cone': {
            const mathAngle = degreesToRadians(compassToMathAngle(params.direction ?? 0));
            const vertices: Position[] = [{ ...origin }];
            const arcSegments = 12;
            for (let i = 0; i <= arcSegments; i++) {
                const a = mathAngle - CONE_HALF_ANGLE_RAD + (i / arcSegments) * (2 * CONE_HALF_ANGLE_RAD);
                vertices.push({ x: origin.x + Math.cos(a) * sizeTiles, y: origin.y + Math.sin(a) * sizeTiles });
            }
            return { shape: 'Cone', vertices };
        }
        case 'Cube': {
            // Face anchor (ruling Q4, 2026-09-22). The near face goes through the
            // exact origin point and is sizeTiles wide, centered on it. The cube
            // extends sizeTiles away from the caster. Euclidean, no snap.
            const axis = resolveCubeAxis(origin, params);
            const perp = { x: axis.y === 0 ? 0 : 1, y: axis.x === 0 ? 0 : 1 };
            const half = sizeTiles / 2;
            const nearLeft = { x: origin.x - perp.x * half, y: origin.y - perp.y * half };
            const nearRight = { x: origin.x + perp.x * half, y: origin.y + perp.y * half };
            return {
                shape: 'Cube',
                vertices: [
                    nearLeft,
                    nearRight,
                    { x: nearRight.x + axis.x * sizeTiles, y: nearRight.y + axis.y * sizeTiles },
                    { x: nearLeft.x + axis.x * sizeTiles, y: nearLeft.y + axis.y * sizeTiles },
                ],
            };
        }
        case 'Line': {
            const target = params.targetPoint ?? projectPoint(origin, params.direction ?? 0, params.size);
            const dx = target.x - origin.x;
            const dy = target.y - origin.y;
            const len = Math.hypot(dx, dy);
            const halfWidth = (params.width ?? 5) / TILE_SIZE / 2;
            const px = len === 0 ? 0 : (-dy / len) * halfWidth;
            const py = len === 0 ? 0 : (dx / len) * halfWidth;
            return {
                shape: 'Line',
                vertices: [
                    { x: origin.x + px, y: origin.y + py },
                    { x: target.x + px, y: target.y + py },
                    { x: target.x - px, y: target.y - py },
                    { x: origin.x - px, y: origin.y - py },
                ],
            };
        }
        default:
            console.warn(`Unknown AoE shape: ${params.shape}`);
            return { shape: params.shape, vertices: [] };
    }
}

/** Point-in-polygon (even-odd) in map units; used by tests and gridless hit checks. */
export function polygonContains(poly: AoEPolygon, point: Position): boolean {
    if (poly.circle) return Math.hypot(point.x - poly.circle.center.x, point.y - poly.circle.center.y) <= poly.circle.radius + 1e-9;
    const v = poly.vertices;
    let inside = false;
    for (let i = 0, j = v.length - 1; i < v.length; j = i++) {
        const intersect = (v[i].y > point.y) !== (v[j].y > point.y)
            && point.x < ((v[j].x - v[i].x) * (point.y - v[i].y)) / (v[j].y - v[i].y) + v[i].x;
        if (intersect) inside = !inside;
    }
    return inside;
}

export function calculateAffectedTiles(params: AoEParams): Position[] {
    // RESOLVED 2026-09-13 (was TODO #1306 / GG-211): the gridless (Euclidean) sibling is
    // calculateAffectedArea above; it returns a polygon and this function keeps its
    // tile-list contract for every current consumer.
    switch (params.shape) {
        case 'Sphere':
        case 'Cylinder': // 2D projection of Cylinder is a Circle/Sphere
            return getSphereAoE(params.origin, params.size);
        case 'Cone':
            return getConeAoE(params.origin, params.direction ?? 0, params.size);
        case 'Cube':
            return getCubeAoE(params.origin, params.size, params);
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
 * Calculates tiles within a face-anchored Cube (ruling Q4, 2026-09-22).
 *
 * CHANGED 2026-09-23: this function used to put the origin at the north-west
 * corner and always extend east and south, whatever the caster did. Now the
 * near face contains the origin tile and the cube extends away from the caster
 * (resolveCubeAxis gives the axis). This is the only cube in the repo.
 *
 * - Depth: `size / 5` tiles along the axis. The origin tile is the first row.
 * - Width: `size / 5` tiles across the axis, centered on the origin tile.
 *   For an even width (10 ft, 20 ft) exact centering is not possible on a grid;
 *   the extra tile goes to the east (+x) or south (+y) side.
 *
 * Example: a 15 ft cube, caster at (0,5), origin (2,5): axis east, tiles
 * x = 2..4, y = 4..6.
 *
 * OPEN (recorded in GLOBAL_GAPS): 5e says the point of origin is not in the
 * cube unless the caster decides otherwise. Here the origin tile is in the
 * near row, as the brief for this change says. When the origin is the caster
 * tile (a self cube such as Thunderwave), the caster tile is thus in the area.
 *
 * @param origin - The point of origin tile, on the near face of the cube
 * @param size - The length of one side of the cube in feet
 * @param anchor - Caster position, direction, or caster facing (see resolveCubeAxis)
 * @returns Array of affected grid positions
 * @throws Error when no direction can be found (no-fallback directive)
 */
export function getCubeAoE(origin: Position, size: number, anchor: CubeAnchorInput): Position[] {
    const tiles = Math.floor(size / TILE_SIZE);
    const axis = resolveCubeAxis(origin, anchor);
    // The perpendicular unit points to +x or +y, so an even width puts its extra tile east or south.
    const perp = { x: axis.y === 0 ? 0 : 1, y: axis.x === 0 ? 0 : 1 };
    const widthStart = -Math.floor((tiles - 1) / 2);
    const affected: Position[] = [];

    for (let depth = 0; depth < tiles; depth++) {
        for (let across = widthStart; across < widthStart + tiles; across++) {
            affected.push({
                x: origin.x + axis.x * depth + perp.x * across,
                y: origin.y + axis.y * depth + perp.y * across,
            });
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

// =============================================================================
// CONDUCTIVITY PROPAGATION (agora-2fb1)
// =============================================================================

/**
 * ConductiveNode — the minimum a propagation needs to know about a creature.
 *
 * Deliberately NOT CombatCharacter. This module is geometry, and taking the full character
 * model would drag the combat state graph into a file that ten other systems import. A caller
 * maps its characters down to this shape in one line.
 */
export interface ConductiveNode {
    id: string;
    position: Position;
    /** The elemental states currently on this creature. */
    stateTags?: StateTag[];
}

/**
 * ConductivityHit — one creature the charge reached, and how hard it arrived.
 */
export interface ConductivityHit {
    id: string;
    position: Position;
    /** How many steps from the strike this creature is. Always 1 or more. */
    hop: number;
    /**
     * Share of the strike's damage this creature takes. The caller multiplies its own rolled
     * damage by this rather than being handed a number, so resistances, saves and criticals
     * stay where they already live.
     */
    damageFraction: number;
    /** The state the charge applies here, copied from the rule so the caller need not re-read it. */
    appliedState: StateTag;
}

export interface ConductivityParams {
    /** Where the strike landed. */
    origin: Position;
    /** Every creature that could be reached. Non-conductors are ignored, not filtered by the caller. */
    nodes: ConductiveNode[];
    /** The medium and its knobs, from types/elemental CONDUCTIVITY_RULES. */
    rule: ConductivityRule;
    /**
     * Creatures the strike already damaged directly. They still CONDUCT — a soaked creature
     * taking a lightning bolt is exactly how the charge gets into the puddle — but they never
     * appear in the result, because the direct hit already charged them for it.
     */
    alreadyDamagedIds?: string[];
}

/**
 * resolveConductivityPropagation — spreads a charge outward through a conducting medium.
 *
 * THE MECHANIC: the strike lands. Every creature carrying the conducting state within one hop
 * of the strike point takes a share of the damage and becomes a relay. Every conductor within
 * one hop of THOSE takes a smaller share, and so on until the rule runs out of hops. A dry
 * creature standing between two wet ones is not a relay and the charge does not pass through
 * it; conduction is a property of the medium, not of the line of sight.
 *
 * WHY BREADTH-FIRST: a creature reachable by two paths takes the damage of the SHORTER one,
 * once. Breadth-first search gives that for free, and it means the result never depends on the
 * order the caller happened to list its characters in.
 *
 * DETERMINISM: there is no randomness here at all. The same strike over the same puddle
 * produces the same hits in the same order every time, so a replay and a test agree.
 *
 * DISTANCE: Chebyshev, in feet, matching every other shape in this module (the 5-5-5 rule).
 *
 * @param params - Strike point, candidate creatures, the conductivity rule, and who was already hit.
 * @returns The reached creatures, ordered by hop and then by their order in `nodes`.
 */
export function resolveConductivityPropagation(params: ConductivityParams): ConductivityHit[] {
    const { origin, nodes, rule, alreadyDamagedIds = [] } = params;

    if (rule.maxHops < 1) return [];

    // Creatures the strike already damaged are marked as reached before the search starts, so
    // they cannot be billed twice, and their positions seed the frontier so they still relay.
    const reached = new Set<string>(alreadyDamagedIds);
    let frontier: Position[] = [origin];
    for (const node of nodes) {
        if (reached.has(node.id)) frontier.push(node.position);
    }

    const hits: ConductivityHit[] = [];

    for (let hop = 1; hop <= rule.maxHops; hop++) {
        const damageFraction = Math.pow(rule.damageFractionPerHop, hop);
        const nextFrontier: Position[] = [];

        // `nodes` is walked in its own order, so the result is stable regardless of how the
        // previous hop happened to fill the frontier.
        for (const node of nodes) {
            if (reached.has(node.id)) continue;
            if (!node.stateTags?.includes(rule.conductor)) continue;
            if (!frontier.some(from => chebyshevFeet(from, node.position) <= rule.hopRangeFeet)) continue;

            reached.add(node.id);
            nextFrontier.push(node.position);
            hits.push({
                id: node.id,
                position: node.position,
                hop,
                damageFraction,
                appliedState: rule.charge,
            });
        }

        // The charge died out before it ran out of hops. Nothing further can be reached.
        if (nextFrontier.length === 0) break;
        frontier = nextFrontier;
    }

    return hits;
}

/**
 * Chebyshev distance between two grid positions, in feet.
 *
 * Shares the 5-5-5 convention with getSphereAoE above: a diagonal step costs the same as a
 * cardinal one, so a puddle conducts to all eight neighbours of a square evenly.
 */
function chebyshevFeet(from: Position, to: Position): number {
    return Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y)) * TILE_SIZE;
}
