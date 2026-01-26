// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 * 
 * Last Sync: 26/01/2026, 01:40:34
 * Dependents: useCompanionBanter.ts, useCompanionCommentary.ts, utils/index.ts
 * Imports: 13 files
 * 
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx scripts/codebase-visualizer-server.ts --sync [this-file-path]
 * See scripts/VISUALIZER_README.md for more info.
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
