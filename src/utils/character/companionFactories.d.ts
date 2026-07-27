/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:30:46
 * Dependents: character/index.ts, companionFactories.ts
 * Imports: 2 files
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
 * @file src/utils/companionFactories.ts
 * Factory functions for creating companions and related data.
 */
import { Companion, CompanionGoal, PersonalityTraits } from '../../types/companions';
export declare const createDefaultPersonality: () => PersonalityTraits;
export declare const createMockCompanion: (overrides?: Partial<Companion>) => Companion;
export declare const createMockCompanionGoal: (overrides?: Partial<CompanionGoal>) => CompanionGoal;
