/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:31:35
 * Dependents: combat/index.ts, pathfinding.ts, physicsUtils.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * Copyright (c) 2024 Aralia RPG.
 * Licensed under the MIT License.
 *
 * @file src/utils/physicsUtils.ts
 * Physical rule calculations for the game world.
 * Implements mechanics for movement, falling, and object interactions based on D&D 5e rules.
 */
import { DiceRoll } from '../../types/dice';
import { Position } from '../../types/combat';
export type ObjectSize = 'tiny' | 'small' | 'medium' | 'large' | 'huge' | 'gargantuan';
export type ObjectMaterial = 'cloth' | 'paper' | 'rope' | 'crystal' | 'glass' | 'ice' | 'wood' | 'bone' | 'stone' | 'iron' | 'steel' | 'mithral' | 'adamantine';
export type LightLevel = 'bright' | 'dim' | 'darkness';
/**
 * Configuration for calculating movement costs based on physical conditions.
 */
export interface MovementConfig {
    /** Whether the terrain is difficult (e.g. rubble, swamp). Adds 1ft cost per ft. */
    isDifficultTerrain?: boolean;
    /** Whether the character is climbing. Adds 1ft cost per ft (unless has climb speed). */
    isClimbing?: boolean;
    /** Whether the character is swimming. Adds 1ft cost per ft (unless has swim speed). */
    isSwimming?: boolean;
    /** Whether the character is crawling (prone). Adds 1ft cost per ft. */
    isCrawling?: boolean;
    /** Whether the character has a native climbing speed (negates climbing penalty). */
    hasClimbSpeed?: boolean;
    /** Whether the character has a native swimming speed (negates swimming penalty). */
    hasSwimSpeed?: boolean;
    /** Whether the character ignores difficult terrain (e.g. Ranger, racial trait). */
    ignoreDifficultTerrain?: boolean;
}
/**
 * Gets the Armor Class (AC) of an object based on its material.
 * D&D 5e DMG pg 246.
 *
 * @param material - The material the object is made of.
 * @returns The Armor Class.
 */
export declare function getObjectAC(material: ObjectMaterial): number;
/**
 * Gets the Hit Points (HP) formula for an object based on size and fragility.
 * D&D 5e DMG pg 247.
 *
 * @param size - The size of the object (Tiny to Large+).
 * @param isFragile - Whether the object is fragile (e.g. glass) or resilient (e.g. wood/stone).
 * @returns A DiceRoll representing the object's HP formula.
 */
export declare function getObjectHP(size: ObjectSize, isFragile?: boolean): DiceRoll;
/**
 * Calculates falling damage per PHB 2024.
 * 1d6 bludgeoning damage for every 10 feet fallen, to a maximum of 20d6.
 * The creature lands prone unless they avoid taking damage.
 *
 * @param distanceFeet - The distance fallen in feet.
 * @returns A DiceRoll object representing the damage to roll (e.g., { dice: 3, sides: 6 }).
 */
export declare function calculateFallDamage(distanceFeet: number): DiceRoll;
/**
 * Calculates the jump distance for a character based on Strength and movement type.
 *
 * @param strengthScore - The character's Strength score (1-30).
 * @param type - 'long' for Long Jump, 'high' for High Jump.
 * @param standing - Whether the jump is a standing jump (no 10ft run-up).
 * @returns The distance/height in feet.
 */
export declare function calculateJumpDistance(strengthScore: number, type: 'long' | 'high', standing?: boolean): number;
/**
 * Calculates the carrying capacity and encumbrance thresholds.
 *
 * @param strengthScore - The character's Strength score.
 * @param sizeMultiplier - Multiplier for creature size (Tiny=0.5, Med=1, Large=2, Huge=4, Garg=8).
 * @returns Object containing capacity in pounds.
 */
export declare function calculateCarryingCapacity(strengthScore: number, sizeMultiplier?: number): {
    carryingCapacity: number;
    pushDragLift: number;
};
/**
 * Calculates how long a creature can hold its breath.
 * PHB 2014/2024: 1 + Constitution Modifier minutes (minimum 30 seconds).
 *
 * @param conMod - The creature's Constitution modifier.
 * @returns The duration in minutes.
 */
export declare function calculateBreathDuration(conMod: number): number;
/**
 * Calculates how long a creature can survive after running out of breath (choking).
 * PHB 2014/2024: Equal to Constitution modifier rounds (minimum 1 round).
 * At the start of its next turn after these rounds, it drops to 0 HP.
 *
 * @param conMod - The creature's Constitution modifier.
 * @returns The duration in rounds (6 seconds each).
 */
export declare function calculateSuffocationRounds(conMod: number): number;
/**
 * Calculates throwing distance based on Strength.
 * D&D 5e simplified: STR * 10 feet, weight penalty after 5 lbs.
 *
 * @param strength - Character's Strength score (1-30).
 * @param objectWeight - Weight in pounds.
 * @returns Distance in feet.
 */
export declare function calculateThrowDistance(strength: number, objectWeight: number): number;
/**
 * Calculates the modified movement cost for a given distance based on terrain and movement mode.
 * D&D 5e Rules (PHB Ch 8):
 * - Difficult Terrain: +1 ft per ft.
 * - Climbing/Swimming/Crawling: +1 ft per ft (unless creature has speed).
 * - Costs are additive: Climbing in Difficult Terrain = 1 (base) + 1 (climb) + 1 (terrain) = 3 ft cost per 1 ft moved.
 *
 * @param distance - The base distance to move (e.g. 5 feet).
 * @param config - The movement configuration (terrain, mode, speeds).
 * @returns The total movement cost in feet.
 */
export declare function applyMovementCostModifiers(distance: number, config: MovementConfig): number;
/**
 * Calculates the Chebyshev distance between two grid positions (5-5-5 rule).
 * In D&D 5e grid rules, diagonal movement costs the same as cardinal movement (unless using variant rules).
 * This means distance is effectively `max(dx, dy) * 5`.
 *
 * @param a - First position.
 * @param b - Second position.
 * @returns Distance in feet (assuming 5ft grid).
 */
export declare function calculateChebyshevDistance(a: Position, b: Position): number;
/**
 * Calculates the light level at a specific target position relative to a light source.
 * D&D 5e Rules (PHB p. 183):
 * - Bright light: Within the defined bright radius.
 * - Dim light: Between the bright radius and the end of the dim radius.
 * - Darkness: Beyond the dim radius.
 *
 * @param target - The position to check for illumination.
 * @param sourceOrigin - The origin of the light source.
 * @param brightRadius - The radius of bright light in feet.
 * @param dimRadius - The *additional* radius of dim light beyond bright light (e.g., Torch: 20 bright, 20 dim).
 * @returns 'bright', 'dim', or 'darkness'.
 */
export declare function calculateLightLevel(target: Position, sourceOrigin: Position, brightRadius: number, dimRadius: number): LightLevel;
/**
 * Determines the effective light level at a position given multiple light sources.
 * - Bright light overrides Dim light and Darkness.
 * - Dim light overrides Darkness.
 *
 * @param target - The position to check.
 * @param sources - A list of light sources with their resolved positions.
 * @returns The highest level of illumination present.
 */
export declare function getCombinedLightLevel(target: Position, sources: {
    position: Position;
    brightRadius: number;
    dimRadius: number;
}[]): LightLevel;
/**
 * Calculates penalties for Exhaustion levels based on D&D 2024 Rules.
 * Rules:
 * - Levels 1-6.
 * - d20 Tests (Checks, Attacks, Saves): -2 per level.
 * - Speed: -5 feet per level.
 * - Level 6: Death.
 *
 * @param level - The current exhaustion level (0-6).
 * @returns Object with penalties and status.
 */
export declare function calculateExhaustionEffects(level: number): {
    d20Penalty: number;
    speedPenalty: number;
    isDead: boolean;
};
