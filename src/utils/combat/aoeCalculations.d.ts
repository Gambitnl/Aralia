/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:31:23
 * Dependents: aoeCalculations.ts, combat/index.ts, targetingUtils.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
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
import { Position } from '../../types/combat';
export type AoEShape = "Sphere" | "Cone" | "Cube" | "Line" | "Cylinder";
export interface AoEParams {
    shape: AoEShape;
    origin: Position;
    size: number;
    direction?: number;
    targetPoint?: Position;
    width?: number;
    gridSize?: number;
}
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
export declare function calculateAffectedTiles(params: AoEParams): Position[];
