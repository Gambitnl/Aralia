import { OllamaLogEntry } from '../types';

export function createOllamaLogEntry(entry: Omit<OllamaLogEntry, 'id'>): OllamaLogEntry {
  // TODO(2026-01-03 pass 6 Codex-CLI): Generate a consistent log ID until Ollama results include it.
  return {
    id: crypto.randomUUID(),
    ...entry
  };
}
