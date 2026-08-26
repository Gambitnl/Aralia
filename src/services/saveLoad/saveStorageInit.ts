/**
 * Copyright (c) 2024 Aralia RPG.
 * Licensed under the MIT License.
 *
 * @file saveStorageInit.ts
 * Storage bootstrap and the safety-critical recovery paths: IndexedDB
 * availability detection, the one-time localStorage -> IndexedDB migration,
 * emergency-save recovery, and the synchronous beforeunload emergency write.
 *
 * Split out of src/services/saveLoadService.ts on 2026-09-09 (board task
 * agora-907c.10, MOD-3.6). The code here is the original code, moved; the
 * old path stays a re-export barrel so no importer changed. What's preserved
 * and what changed is noted at each edited line.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/09/2026, 14:39:58
 * Dependents: services/saveLoadService.ts
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { GameState } from '../../types';
import { SafeStorage, logger, safeJSONParse, simpleHash } from '../../utils/core';
import * as IDBStorage from '../indexedDBStorageService';
import {
  AUTO_SAVE_SLOT,
  CHECKPOINT_PREFIX,
  DEFAULT_SAVE_SLOT,
  EMERGENCY_SAVE_KEY,
  MIGRATION_FLAG_KEY,
  SAVE_GAME_VERSION,
  SLOT_PREFIX,
} from './saveLoadConstants';
import type { StoredSavePayload } from './saveLoadConstants';
import { calculatePlaytimeSeconds, extractPreview, setIndexedDbAvailable } from './saveLoadHelpers';
import { getSaveSlots } from './saveSlotIndex';

// Tracks whether the one-time localStorage→IndexedDB migration has completed.
let migrationDone = false;

// ============================================================================
// IndexedDB Initialization and Migration
// ============================================================================
// On module load, we check if IndexedDB is available and migrate any existing
// localStorage saves. This runs once per page load. If IndexedDB is not
// available, the service silently stays in localStorage-only mode.
// ============================================================================

/**
 * Initializes IndexedDB and migrates existing localStorage saves if needed.
 * Called once on app startup (from useGameInitialization or similar).
 * Safe to call multiple times — it short-circuits after the first run.
 */
export async function initializeStorage(): Promise<void> {
  // Check if IndexedDB is available in this browser environment.
  const available = await IDBStorage.isAvailable();
  setIndexedDbAvailable(available);
  logger.info('Save storage initialized', { indexedDB: available });

  if (!available) return;
  // Check if we've already migrated saves from localStorage.
  if (SafeStorage.getItem(MIGRATION_FLAG_KEY) === 'true') {
    migrationDone = true;
  }

  // Recover any emergency save that was written synchronously during a
  // previous beforeunload event. Move it into IndexedDB where it belongs.
  await recoverEmergencySave();

  // If there are localStorage saves that haven't been migrated, move them now.
  if (!migrationDone) {
    await migrateLocalStorageToIndexedDB();
  }
}

/**
 * Migrates all save payloads from localStorage to IndexedDB.
 * After successful migration, removes the payload from localStorage but
 * keeps the metadata index (which is small and used for fast sync reads).
 */
async function migrateLocalStorageToIndexedDB(): Promise<void> {
  try {
    const allKeys = SafeStorage.getAllKeys();
    // Find all localStorage keys that look like save payloads.
    const saveKeys = allKeys.filter(key =>
      key === DEFAULT_SAVE_SLOT ||
      key === AUTO_SAVE_SLOT ||
      key.startsWith(SLOT_PREFIX) ||
      key.startsWith(CHECKPOINT_PREFIX)
    );

    if (saveKeys.length === 0) {
      // No saves to migrate — mark as done and return.
      SafeStorage.trySetItem(MIGRATION_FLAG_KEY, 'true');
      migrationDone = true;
      logger.info('No localStorage saves to migrate');
      return;
    }

    let migratedCount = 0;
    for (const key of saveKeys) {
      const payload = SafeStorage.getItem(key);
      if (!payload) continue;

      // Write to IndexedDB, then remove from localStorage.
      await IDBStorage.putSave(key, payload);
      SafeStorage.removeItem(key);
      migratedCount++;
    }

    // Mark migration as complete so it doesn't re-run.
    SafeStorage.trySetItem(MIGRATION_FLAG_KEY, 'true');
    migrationDone = true;
    logger.info('Migrated saves from localStorage to IndexedDB', { count: migratedCount });
  } catch (error) {
    // If migration fails, we leave saves in localStorage. They'll still work
    // fine through the fallback path in loadGame/saveGame.
    logger.error('Failed to migrate saves to IndexedDB', { error });
  }
}

/**
 * Recovers an emergency save that was written synchronously to localStorage
 * during a beforeunload event (when IndexedDB couldn't complete in time).
 * Moves the emergency save into IndexedDB and removes it from localStorage.
 */
async function recoverEmergencySave(): Promise<void> {
  try {
    const emergencyData = SafeStorage.getItem(EMERGENCY_SAVE_KEY);
    if (!emergencyData) return;

    // The emergency save is a full StoredSavePayload JSON string.
    // Parse it just enough to get the slotId so we know where to put it.
    const parsed = safeJSONParse<{ slotId?: string }>(emergencyData);
    const slotId = parsed?.slotId || AUTO_SAVE_SLOT;

    // Write to IndexedDB and clean up localStorage.
    await IDBStorage.putSave(slotId, emergencyData);
    SafeStorage.removeItem(EMERGENCY_SAVE_KEY);
    logger.info('Recovered emergency save from localStorage', { slotId });
  } catch (error) {
    logger.error('Failed to recover emergency save', { error });
  }
}

/**
 * Writes a save synchronously to localStorage for use during beforeunload.
 * This is a best-effort fallback when IndexedDB (which is async) can't
 * complete before the browser kills the page. On next load, the emergency
 * save is moved to IndexedDB via recoverEmergencySave().
 */
export function emergencySaveSync(gameState: GameState): void {
  try {
    const stateToSave: GameState = {
      ...gameState,
      saveVersion: SAVE_GAME_VERSION,
      saveTimestamp: Date.now(),
      isLoading: false,
      isImageLoading: false,
      error: null,
      // Overlay flags persist as-is — same contract as saveGame (task 4).
      geminiGeneratedActions: null,
      isDevMenuVisible: false,
      isGeminiLogViewerVisible: false,
      characterSheetModal: { isOpen: false, character: null },
      notifications: [],
    };

    const serializedStateForHash = JSON.stringify(stateToSave);
    const checksum = simpleHash(serializedStateForHash);
    const existingSlotSummary = getSaveSlots().find(slot => slot.slotId === AUTO_SAVE_SLOT);
    const playtimeSeconds = calculatePlaytimeSeconds(existingSlotSummary);

    const payload: StoredSavePayload = {
      version: SAVE_GAME_VERSION,
      slotId: AUTO_SAVE_SLOT,
      slotName: 'Auto-Save',
      isAutoSave: true,
      preview: extractPreview(stateToSave, playtimeSeconds),
      state: stateToSave,
      checksum,
    };

    // Write synchronously to localStorage — this is the only way to guarantee
    // the write completes during beforeunload.
    SafeStorage.setItem(EMERGENCY_SAVE_KEY, JSON.stringify(payload));
  } catch (error) {
    // Best-effort — if this fails, there's nothing more we can do.
    logger.error('Emergency save failed', { error });
  }
}
