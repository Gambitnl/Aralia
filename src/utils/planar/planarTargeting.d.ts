/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:33:15
 * Dependents: planar/index.ts, planarTargeting.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file src/utils/planarTargeting.ts
 * Utilities for determining interaction rules between different planar phases.
 */
import { CombatCharacter, CombatState } from '@/types/combat';
/**
 * Gets the current planar phase of a character.
 * Defaults to the combat state's current plane (usually Material) if no active effect overrides it.
 *
 * @param character - The character to check
 * @param gameState - The current combat state
 * @returns The plane ID the character is currently "on"
 */
export declare function getCharacterPhase(character: CombatCharacter, gameState: CombatState): string;
/**
 * Checks if a character can perceive another character across planes.
 *
 * @param observer - The character looking
 * @param target - The character being looked at
 * @param gameState - The current combat state
 * @returns true if the observer can see the target
 */
export declare function canSeeTarget(observer: CombatCharacter, target: CombatCharacter, gameState: CombatState): boolean;
/**
 * Checks if a character can physically interact with (target/attack) another character.
 *
 * @param source - The character initiating interaction
 * @param target - The target character
 * @param gameState - The current combat state
 * @param damageType - Optional, if dealing force damage (which often crosses Ethereal)
 * @returns true if interaction is possible
 */
export declare function canInteract(source: CombatCharacter, target: CombatCharacter, gameState: CombatState, damageType?: string): boolean;
