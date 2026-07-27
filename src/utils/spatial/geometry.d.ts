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
export declare const radiansToDegrees: (radians: number) => number;
/**
 * Converts degrees to radians.
 */
export declare const degreesToRadians: (degrees: number) => number;
/**
 * Normalizes an angle to the [0, 360) range.
 * Handles negative inputs and -0 correctly.
 */
export declare const normalizeAngle: (degrees: number) => number;
/**
 * Converts a Compass Angle (0=North) to a Math Angle (0=East).
 * Formula: Math = Compass - 90
 */
export declare const compassToMathAngle: (compassDegrees: number) => number;
/**
 * Converts a Math Angle (0=East) to a Compass Angle (0=North).
 * Formula: Compass = Math + 90
 */
export declare const mathToCompassAngle: (mathDegrees: number) => number;
/**
 * Calculates the Compass Angle (0=North) from an origin to a target position.
 */
export declare const getAngleBetweenPositions: (origin: Position, target: Position) => number;
/**
 * Converts a standard compass direction string to degrees.
 */
export declare const facingToDegrees: (facing: string) => number;
