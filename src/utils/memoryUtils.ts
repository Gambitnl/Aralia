// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * RE-EXPORT BRIDGE / MIDDLEMAN: Forwards exports to another file.
 *
 * Last Sync: 09/06/2026, 05:08:18
 * Dependents: None (Orphan)
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @deprecated Legacy bridge kept for compatibility with older imports.
 * New callers should import from '@/utils/world/memoryUtils' so the world helper stays canonical.
 */
export * from './world/memoryUtils';
