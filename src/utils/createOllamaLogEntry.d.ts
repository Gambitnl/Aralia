/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:32:09
 * Dependents: useCompanionBanter.ts, useCompanionCommentary.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import { OllamaLogEntry } from '../types';
export declare function createOllamaLogEntry(entry: Omit<OllamaLogEntry, 'id'>): OllamaLogEntry;
