/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:35:40
 * Dependents: templeUtils.ts, world/index.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import { Temple } from '../../types/religion';
import { VillagePersonality } from '../../types';
/**
 * Procedurally generates a Temple object for a village.
 * Uses the village's personality/biome to select an appropriate deity if possible.
 */
export declare const generateVillageTemple: (villageId: string, personality: VillagePersonality, rngSeed: number) => Temple;
