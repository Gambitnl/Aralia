/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 27/06/2026, 02:18:23
 * Dependents: None (Orphan)
 * Imports: 7 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/puzzles/pressurePlateSystem.ts
 * Implements mechanics for pressure plates: triggering, detection, and jamming.
 */
import { PlayerCharacter } from '../../types/character';
import type { Item } from '../../types/items';
import { PressurePlate, PressurePlateResult, PressurePlateJamResult, Trap } from './types';
/**
 * Checks if a character triggers a pressure plate by stepping on it.
 * @param character The character stepping on the plate.
 * @param plate The pressure plate.
 * @param linkedTrap Optional trap definition if the plate triggers a trap directly.
 */
export declare function checkPressurePlate(character: PlayerCharacter, plate: PressurePlate, linkedTrap?: Trap): PressurePlateResult;
/**
 * Attempts to detect a hidden pressure plate.
 * @param character The character looking.
 * @param plate The pressure plate.
 */
export declare function detectPressurePlate(character: PlayerCharacter, plate: PressurePlate): {
    detected: boolean;
    message: string;
};
/**
 * Attempts to jam (disable) a pressure plate.
 * Requires Thieves' Tools or an Investigation check (using a shim/spike).
 */
export declare function jamPressurePlate(character: PlayerCharacter, plate: PressurePlate, inventory: Array<Pick<Item, 'id'>>): PressurePlateJamResult;
/**
 * Handle plate reset logic.
 * Call this at the end of a turn or after interaction.
 */
export declare function updatePressurePlateState(plate: PressurePlate): void;
