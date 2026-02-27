// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:31:29
 * Dependents: utils/index.ts
 * Imports: 9 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/utils/combat/index.ts
 * Combat utilities - battle mechanics, damage, AOE, and movement calculations.
 */

export * from './combatUtils';
export * from './aoeCalculations';
export * from './movementUtils';
export * from './mechanicsUtils';
export * from './actionUtils';
export * from './physicsUtils';
export * from './actionEconomyUtils';
export * from './combatAI';
export * from './resistanceUtils';
