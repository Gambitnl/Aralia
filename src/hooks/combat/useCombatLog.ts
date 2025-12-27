import { useState, useCallback } from 'react';
import { CombatLogEntry } from '../../types/combat';

const MAX_LOG_ENTRIES = 50;

/**
 * useCombatLog
 *
 * A custom hook to manage the state of the combat log.
 * It handles adding new entries and truncating the log to a maximum size
 * to prevent performance degradation over long encounters.
 *
 * @returns {
 *   logs: CombatLogEntry[];
 *   addLogEntry: (entry: CombatLogEntry) => void;
 *   clearLogs: () => void;
 * }
 */
export const useCombatLog = () => {
  const [logs, setLogs] = useState<CombatLogEntry[]>([]);

  const addLogEntry = useCallback((entry: CombatLogEntry) => {
    setLogs(prev => {
      // Create new array with new entry
      const newLogs = [...prev, entry];

      // Truncate if exceeding max size, keeping the most recent entries
      // CombatLog displays entries in order, so we slice from the end
      if (newLogs.length > MAX_LOG_ENTRIES) {
        return newLogs.slice(newLogs.length - MAX_LOG_ENTRIES);
      }
      return newLogs;
    });
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  return { logs, addLogEntry, clearLogs };
};
