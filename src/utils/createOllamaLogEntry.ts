// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file is part of a complex dependency web.
 * 
 * Last Sync: 26/01/2026, 01:36:13
 * Dependents: useCompanionBanter.ts, useCompanionCommentary.ts
 * Imports: 1 files
 * 
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx scripts/codebase-visualizer-server.ts --sync [this-file-path]
 * See scripts/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { OllamaLogEntry } from '../types';

export function createOllamaLogEntry(entry: Omit<OllamaLogEntry, 'id'>): OllamaLogEntry {
  // TODO(2026-01-03 pass 6 Codex-CLI): Generate a consistent log ID until Ollama results include it.
  return {
    id: crypto.randomUUID(),
    ...entry
  };
}
