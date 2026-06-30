// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * RE-EXPORT BRIDGE / MIDDLEMAN: Forwards exports to another file.
 *
 * Last Sync: 18/06/2026, 03:31:31
 * Dependents: state/migrations/worldDataMigration.ts, utils/index.ts
 * Imports: 14 files
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
