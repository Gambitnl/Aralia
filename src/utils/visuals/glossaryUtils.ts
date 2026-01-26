// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 * 
 * Last Sync: 26/01/2026, 01:40:19
 * Dependents: glossaryUtils.ts, visuals/index.ts
 * Imports: 1 files
 * 
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx scripts/codebase-visualizer-server.ts --sync [this-file-path]
 * See scripts/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/utils/glossaryUtils.ts
 * This file contains utility functions related to the glossary system.
 */
import { GlossaryEntry } from '../../types';

/**
 * Recursively searches an array of glossary entries (including sub-entries) for a specific term ID.
 * @param termId The ID of the glossary entry to find.
 * @param entries The array of GlossaryEntry objects to search through.
 * @returns An object containing the found entry and the path of parent IDs to reach it, or null if not found.
 */
export function findGlossaryEntryAndPath(
  termId: string,
  entries: GlossaryEntry[]
): { entry: GlossaryEntry | null; path: string[] } {
  for (const entry of entries) {
    if (entry.id === termId) {
      return { entry, path: [entry.id] };
    }
    if (entry.subEntries) {
      const foundInChildren = findGlossaryEntryAndPath(termId, entry.subEntries);
      if (foundInChildren.entry) {
        return { entry: foundInChildren.entry, path: [entry.id, ...foundInChildren.path] };
      }
    }
  }
  return { entry: null, path: [] };
}
