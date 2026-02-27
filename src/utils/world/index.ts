// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:35:22
 * Dependents: useCompanionBanter.ts, useCompanionCommentary.ts, utils/index.ts
 * Imports: 13 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/utils/world/index.ts
 * World utilities - settlement generation, factions, religion, and world mechanics.
 */

export * from './settlementGeneration';
export * from './nobleHouseGenerator';
export * from './encounterUtils';
export * from './factionUtils';
export * from './religionUtils';
export * from './socialUtils';
export * from './templeUtils';
export * from './secretGenerator';
export * from './historyUtils';
export * from './provenanceUtils';
export * from './memoryUtils';
export * from './sceneUtils';
export * from './dialogueUtils';
