/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:30:42
 * Dependents: character/index.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file src/utils/characterValidation.ts
 * Utilities for validating character data and detecting missing choices
 * that may result from AI generation or legacy saves.
 */
import { PlayerCharacter, MissingChoice } from '../../types';
export declare const validateCharacterChoices: (character: PlayerCharacter) => MissingChoice[];
