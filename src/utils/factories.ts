// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file is part of a complex dependency web.
 * 
 * Last Sync: 26/01/2026, 01:36:19
 * Dependents: None (Orphan)
 * Imports: 1 files
 * 
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx scripts/codebase-visualizer-server.ts --sync [this-file-path]
 * See scripts/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @deprecated Import from '@/utils/core' or '@/utils/core/factories' instead.
 * This file will be removed in a future version.
 *
 * Example migration:
 *   Old: import { createMockSpell } from '@/utils/factories'
 *   New: import { createMockSpell } from '@/utils/core'
 */
export * from './core/factories';
