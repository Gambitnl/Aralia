/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 27/06/2026, 02:18:23
 * Dependents: None (Orphan)
 * Imports: 5 files
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
 * @file src/systems/puzzles/secretDoorSystem.ts
 * Implements mechanics for detecting and operating secret doors.
 */
import { PlayerCharacter } from '../../types/character';
import { SecretDoor, SecretDoorResult } from './types';
/**
 * Attempts to detect a secret door in the vicinity.
 * Typically called when a character actively searches (Action: Search)
 * or passively via Passive Perception (handled by DM/Engine usually, but here for active check).
 */
export declare function searchForSecretDoor(character: PlayerCharacter, door: SecretDoor): SecretDoorResult;
/**
 * Attempts to figure out how to open a detected secret door.
 * Requires an Intelligence (Investigation) check.
 */
export declare function investigateMechanism(character: PlayerCharacter, door: SecretDoor): SecretDoorResult;
/**
 * Attempts to open the secret door.
 * If the door is locked, this might fail unless unlocked.
 */
export declare function operateSecretDoor(character: PlayerCharacter, door: SecretDoor): SecretDoorResult;
