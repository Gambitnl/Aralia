/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:34:55
 * Dependents: glossaryUtils.ts, visuals/index.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
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
export declare function findGlossaryEntryAndPath(termId: string, entries: GlossaryEntry[]): {
    entry: GlossaryEntry | null;
    path: string[];
};
