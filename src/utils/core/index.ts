// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 * 
 * Last Sync: 26/01/2026, 01:39:03
 * Dependents: utils/index.ts
 * Imports: 10 files
 * 
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx scripts/codebase-visualizer-server.ts --sync [this-file-path]
 * See scripts/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/utils/core/index.ts
 * Core utilities - foundational functions used across the codebase.
 */

export * from './factories';
export * from './idGenerator';
export * from './timeUtils';
export * from './logger';
export * from './storageUtils';
export * from './securityUtils';
export * from './permissions';
export * from './hashUtils';
export * from './i18n';
export * from './testUtils';
