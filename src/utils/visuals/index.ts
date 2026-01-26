// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 * 
 * Last Sync: 26/01/2026, 01:40:21
 * Dependents: utils/index.ts
 * Imports: 3 files
 * 
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx scripts/codebase-visualizer-server.ts --sync [this-file-path]
 * See scripts/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/utils/visuals/index.ts
 * Visual utilities - spell visuals, rendering helpers, and UI assets.
 */

export * from './spellVisuals';
export * from './visualUtils';
export * from './glossaryUtils';
