// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/06/2026, 07:03:36
 * Dependents: components/Combat/CombatView.tsx
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file useCombatLog.ts
 * Keeps the simple combat log as a bounded in-memory buffer, and now mirrors
 * that buffer into localStorage so an active encounter can survive a reload.
 *
 * The persistence scope is caller-provided because this hook does not know how
 * a combat session should be identified. CombatView supplies an encounter key
 * so the same fight can be restored without forcing unrelated fights to share
 * one global log bucket.
 */
import { useState, useCallback, useEffect } from 'react';
import { CombatLogEntry } from '../../types/combat';
import { SafeStorage } from '../../utils/core/storageUtils';
import { safeJSONParse } from '../../utils/core/securityUtils';

const MAX_LOG_ENTRIES = 50;
const DEFAULT_STORAGE_KEY = 'aralia_combat_log_history';

interface UseCombatLogOptions {
  /**
   * Optional storage namespace for the combat log.
   * When omitted, the hook falls back to a shared default key.
   */
  storageKey?: string;
}

interface CombatLogState {
  storageKey: string;
  logs: CombatLogEntry[];
}

const COMBAT_LOG_TYPES = new Set<CombatLogEntry['type']>([
  'action',
  'damage',
  'heal',
  'status',
  'turn_start',
  'turn_end',
]);

const isCombatLogEntry = (value: unknown): value is CombatLogEntry => {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Partial<CombatLogEntry>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.timestamp === 'number' &&
    typeof candidate.message === 'string' &&
    typeof candidate.type === 'string' &&
    COMBAT_LOG_TYPES.has(candidate.type as CombatLogEntry['type'])
  );
};

const clampCombatLogEntries = (entries: CombatLogEntry[]): CombatLogEntry[] => {
  if (entries.length <= MAX_LOG_ENTRIES) {
    return entries;
  }

  return entries.slice(entries.length - MAX_LOG_ENTRIES);
};

const loadPersistedLogEntries = (storageKey: string): CombatLogEntry[] => {
  const raw = SafeStorage.getItem(storageKey);
  const parsed = safeJSONParse<unknown>(raw || '');

  if (!Array.isArray(parsed)) {
    return [];
  }

  return clampCombatLogEntries(parsed.filter(isCombatLogEntry));
};

const persistLogEntries = (storageKey: string, entries: CombatLogEntry[]) => {
  if (entries.length === 0) {
    SafeStorage.removeItem(storageKey);
    return;
  }

  try {
    SafeStorage.setItem(storageKey, JSON.stringify(entries));
  } catch {
    // Storage can be unavailable or full; in that case we keep the live log
    // working and simply lose the persistence layer for this session.
  }
};

/**
 * useCombatLog
 *
 * A custom hook to manage the state of the combat log.
 * It handles adding new entries and truncating the log to a maximum size
 * to prevent performance degradation over long encounters. The current log is
 * also mirrored to localStorage so a refresh can restore the same encounter's
 * history when CombatView passes the same storage key back in.
 *
 * @returns {
 *   logs: CombatLogEntry[];
 *   addLogEntry: (entry: CombatLogEntry) => void;
 *   clearLogs: () => void;
 * }
 */
export const useCombatLog = ({ storageKey = DEFAULT_STORAGE_KEY }: UseCombatLogOptions = {}) => {
  const [logState, setLogState] = useState<CombatLogState>(() => ({
    storageKey,
    logs: loadPersistedLogEntries(storageKey)
  }));

  useEffect(() => {
    setLogState({
      storageKey,
      logs: loadPersistedLogEntries(storageKey)
    });
  }, [storageKey]);

  useEffect(() => {
    if (logState.storageKey !== storageKey) {
      return;
    }

    persistLogEntries(storageKey, logState.logs);
  }, [logState, storageKey]);

  const addLogEntry = useCallback((entry: CombatLogEntry) => {
    setLogState(prev => {
      // Create new array with new entry
      const newLogs = clampCombatLogEntries([...prev.logs, entry]);

      // Truncate if exceeding max size, keeping the most recent entries
      // CombatLog displays entries in order, so we slice from the end
      return {
        storageKey: prev.storageKey,
        logs: newLogs
      };
    });
  }, []);

  const clearLogs = useCallback(() => {
    setLogState({
      storageKey,
      logs: []
    });
    SafeStorage.removeItem(storageKey);
  }, [storageKey]);

  return { logs: logState.logs, addLogEntry, clearLogs };
};
