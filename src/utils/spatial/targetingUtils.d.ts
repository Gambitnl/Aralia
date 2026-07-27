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
/**
 * @file src/utils/targetingUtils.ts
 * Utility module for handling targeting geometry, shape mapping, and coordinate calculations.
 * Extracts pure logic from useAbilitySystem hooks to keep components focused.
 */
import { Position, AreaOfEffect, CombatCharacter } from '../../types/combat';
import { AoEShape, AoEParams } from '../combat/aoeCalculations';
/**
 * Maps legacy or varying shape strings to the standard AoEShape type.
 * Ensures consistent casing and fallback behavior for shape logic.
 *
 * @param shape - The shape string from Ability data (e.g., 'circle', 'Cone', 'cube').
 * @returns The standardized AoEShape (e.g., 'Sphere').
 */
export declare const mapShapeToStandard: (shape: string) => AoEShape;
/**
 * Calculates the dynamic parameters for an Area of Effect based on caster position and target.
 * Resolves directional logic (Cones/Lines) by calculating angles between caster and target point.
 *
 * @param aoe - The static Area of Effect definition from the Ability.
 * @param center - The target tile coordinates selected by the player.
 * @param caster - (Optional) The character casting the spell, required for origin-bound shapes.
 * @returns The fully resolved AoEParams ready for tile calculation, or null if invalid.
 */
export declare const resolveAoEParams: (aoe: AreaOfEffect, center: Position, caster?: CombatCharacter) => AoEParams | null;
