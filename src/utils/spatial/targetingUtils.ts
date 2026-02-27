// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:34:18
 * Dependents: spatial/index.ts, targetingUtils.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/utils/targetingUtils.ts
 * Utility module for handling targeting geometry, shape mapping, and coordinate calculations.
 * Extracts pure logic from useAbilitySystem hooks to keep components focused.
 */

import { Position, AreaOfEffect, CombatCharacter } from '../../types/combat';
import { AoEShape, AoEParams } from '../combat/aoeCalculations';
import { getAngleBetweenPositions, facingToDegrees as geometryFacingToDegrees } from './geometry';

/**
 * Maps legacy or varying shape strings to the standard AoEShape type.
 * Ensures consistent casing and fallback behavior for shape logic.
 * 
 * @param shape - The shape string from Ability data (e.g., 'circle', 'Cone', 'cube').
 * @returns The standardized AoEShape (e.g., 'Sphere').
 */
export const mapShapeToStandard = (shape: string): AoEShape => {
    switch (shape.toLowerCase()) {
        case 'circle': return 'Sphere';
        case 'cone': return 'Cone';
        case 'square':
        case 'cube': return 'Cube';
        case 'line': return 'Line';
        case 'cylinder': return 'Cylinder';
        default: return 'Sphere'; // Fallback for unknown shapes
    }
};

/**
 * Converts a standard compass direction string to degrees.
 * Used for aligning directional spells (Lines/Cones) with character facing.
 * 
 * System: 0 = North (-Y), 90 = East (+X), 180 = South (+Y), 270 = West (-X).
 * This matches standard map logic where Y increases downwards.
 * 
 * @param facing - The direction string (e.g., 'north', 'southeast').
 * @returns The angle in degrees.
 * @deprecated Use `src/utils/geometry.ts` instead.
 */
const facingToDegrees = geometryFacingToDegrees;

/**
 * Calculates the dynamic parameters for an Area of Effect based on caster position and target.
 * Resolves directional logic (Cones/Lines) by calculating angles between caster and target point.
 * 
 * @param aoe - The static Area of Effect definition from the Ability.
 * @param center - The target tile coordinates selected by the player.
 * @param caster - (Optional) The character casting the spell, required for origin-bound shapes.
 * @returns The fully resolved AoEParams ready for tile calculation, or null if invalid.
 */
export const resolveAoEParams = (
    aoe: AreaOfEffect,
    center: Position,
    caster?: CombatCharacter
): AoEParams | null => {
    const shape = mapShapeToStandard(aoe.shape);
    let direction = 0;
    let origin = center;
    let targetPoint: Position | undefined = undefined;

    // Determine direction and origin for directional shapes (Cone, Line)
    // These originate FROM the caster, aiming AT the 'center' target point.
    if (shape === 'Cone' || shape === 'Line') {
        if (caster) {
            origin = caster.position;

            // If caster and target are different, calculate angle.
            if (center.x !== origin.x || center.y !== origin.y) {
                // Use shared geometry util
                direction = getAngleBetweenPositions(origin, center);
            } else if (caster.facing) {
                // Fallback: If clicked on self, use caster's current facing.
                direction = facingToDegrees(caster.facing);
            }

            // For Lines, the click point defines the endpoint explicitly.
            if (shape === 'Line') {
                targetPoint = center;
            }
        } else {
            // Without a caster, directional shapes are ambiguous. 
            // We default to the clicked point as origin with 0 rotation.
        }
    }

    // Ensure normalized direction 0-360
    if (direction < 0) direction += 360;

    return {
        shape,
        origin,
        size: aoe.size * 5, // Convert tiles to feet (standard 5e grid rule)
        direction,
        targetPoint,
        width: 5 // Default line width
    };
};
