// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file is part of a complex dependency web.
 * 
 * Last Sync: 26/01/2026, 01:38:14
 * Dependents: utils/index.ts
 * Imports: 9 files
 * 
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx scripts/codebase-visualizer-server.ts --sync [this-file-path]
 * See scripts/VISUALIZER_README.md for more info.
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
