// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 * 
 * Last Sync: 21/02/2026, 02:41:14
 * Dependents: useCompanionBanter.ts, useCompanionCommentary.ts
 * Imports: 2 files
 * 
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx scripts/codebase-visualizer-server.ts --sync [this-file-path]
 * See scripts/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { OllamaLogEntry } from '../types';
import { generateId } from './core/idGenerator';

export function createOllamaLogEntry(entry: Omit<OllamaLogEntry, 'id'>): OllamaLogEntry {
  // TODO(2026-01-03 pass 6 Codex-CLI): Generate a consistent log ID until Ollama results include it.
  return {
    id: generateId(),
    ...entry
  };
}
