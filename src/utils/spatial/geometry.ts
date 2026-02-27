// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 27/02/2026, 09:33:52
 * Dependents: aoeCalculations.ts, geometry.ts, spatial/index.ts, targetingUtils.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/utils/geometry.ts
 * Shared geometry and coordinate system utilities.
 *
 * COORDINATE SYSTEM:
 * 1. Grid Coordinates: Standard 2D grid where (x, y) = (col, row).
 *    - x increases to the East (right)
 *    - y increases to the South (down)
 *
 * 2. Compass Angles (Game Logic):
 *    - 0° = North (-y)
 *    - 90° = East (+x)
 *    - 180° = South (+y)
 *    - 270° = West (-x)
 *
 * 3. Math/Trig Angles (Internal Calculation):
 *    - 0° = East (+x)
 *    - 90° = South (+y) (inverted Y)
 *    - 180° = West (-x)
 *    - -90° = North (-y)
 */

import { Position } from '../../types/combat';

/**
 * Converts radians to degrees.
 */
export const radiansToDegrees = (radians: number): number => {
    return radians * (180 / Math.PI);
};

/**
 * Converts degrees to radians.
 */
export const degreesToRadians = (degrees: number): number => {
    return degrees * (Math.PI / 180);
};

/**
 * Normalizes an angle to the [0, 360) range.
 * Handles negative inputs and -0 correctly.
 */
export const normalizeAngle = (degrees: number): number => {
    let angle = degrees % 360;
    if (angle < 0) angle += 360;
    // Fix for -0
    if (angle === 0) angle = 0;
    return angle;
};

/**
 * Converts a Compass Angle (0=North) to a Math Angle (0=East).
 * Formula: Math = Compass - 90
 */
export const compassToMathAngle = (compassDegrees: number): number => {
    return compassDegrees - 90;
};

/**
 * Converts a Math Angle (0=East) to a Compass Angle (0=North).
 * Formula: Compass = Math + 90
 */
export const mathToCompassAngle = (mathDegrees: number): number => {
    return normalizeAngle(mathDegrees + 90);
};

/**
 * Calculates the Compass Angle (0=North) from an origin to a target position.
 */
export const getAngleBetweenPositions = (origin: Position, target: Position): number => {
    const dx = target.x - origin.x;
    const dy = target.y - origin.y;

    // Math.atan2(y, x) gives angle from +X axis (East) in radians.
    const angleRad = Math.atan2(dy, dx);
    const angleDeg = radiansToDegrees(angleRad);

    return mathToCompassAngle(angleDeg);
};

/**
 * Converts a standard compass direction string to degrees.
 */
export const facingToDegrees = (facing: string): number => {
    switch (facing.toLowerCase()) {
        case 'north': return 0;
        case 'northeast': return 45;
        case 'east': return 90;
        case 'southeast': return 135;
        case 'south': return 180;
        case 'southwest': return 225;
        case 'west': return 270;
        case 'northwest': return 315;
        default: return 0;
    }
};
