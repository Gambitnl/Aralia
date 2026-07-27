/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/06/2026, 02:18:22
 * Dependents: components/puzzles/LockpickingModal.tsx, systems/puzzles/pressurePlateSystem.ts
 * Imports: 6 files
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
 * @file src/systems/puzzles/lockSystem.ts
 * Implements mechanics for locking, picking, breaking, and trapping.
 */
import { PlayerCharacter } from '../../types/character';
import { Item } from '../../types/items';
import { Lock, Trap, LockpickResult, KeyUnlockResult, BreakResult, TrapDetectionResult, TrapDisarmResult } from './types';
/**
 * Checks if a character has proficiency with a specific tool.
 */
export declare function hasToolProficiency(character: PlayerCharacter, _toolId: string): boolean;
/**
 * Checks if character has the required tool in their inventory.
 */
export declare function hasTool(character: PlayerCharacter, toolId: string, inventory: Array<Pick<Item, 'id'>>): boolean;
/**
 * Attempts to pick a lock.
 * Requires Thieves' Tools.
 */
export declare function attemptLockpick(character: PlayerCharacter, lock: Lock, inventory: Item[]): LockpickResult;
/**
 * Attempts to open a lock with keys the caller already knows are available.
 *
 * Inventory, economy, and item registry ownership stays outside this puzzle
 * runtime. Callers pass only key ids, and this function owns the deterministic
 * lock/key comparison against `Lock.keyId`.
 */
export declare function attemptKeyUnlock(lock: Lock, availableKeyIds: Iterable<string>): KeyUnlockResult;
/**
 * Attempts to break a lock or door using Strength.
 */
export declare function attemptBreak(character: PlayerCharacter, lock: Lock): BreakResult;
/**
 * Attempts to detect a trap on an object.
 */
export declare function detectTrap(character: PlayerCharacter, trap: Trap): TrapDetectionResult;
/**
 * Attempts to disarm a known trap.
 */
export declare function disarmTrap(character: PlayerCharacter, trap: Trap, inventory: Item[]): TrapDisarmResult;
