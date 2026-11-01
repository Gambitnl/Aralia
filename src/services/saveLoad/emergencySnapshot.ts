/** Shared synchronous save envelope. The caller chooses the owned backup key. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 28/10/2026, 18:54:15
 * Dependents: services/combatDefeatService.ts, services/saveLoad/saveStorageInit.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { GameState } from '../../types';
import { SafeStorage, logger, simpleHash } from '../../utils/core';
import { EMERGENCY_SAVE_KEY, SAVE_GAME_VERSION } from './saveLoadConstants';
import type { StoredSavePayload } from './saveLoadConstants';
import { calculatePlaytimeSeconds, extractPreview } from './saveLoadHelpers';
import { getSaveSlots } from './saveSlotIndex';

export function writeEmergencySnapshot(gameState: GameState, target: {
  slotId: string;
  slotName: string;
  isAutoSave: boolean;
  /** Defeat uses its own slot, so a pending write cannot replace a recovery autosave. */
  backupKey?: string;
}): { succeeded: boolean; clearIfCurrent: () => void } {
  try {
    const state: GameState = {
      ...gameState,
      saveVersion: SAVE_GAME_VERSION,
      saveTimestamp: Date.now(),
      isLoading: false,
      isImageLoading: false,
      error: null,
      geminiGeneratedActions: null,
      isDevMenuVisible: false,
      isGeminiLogViewerVisible: false,
      characterSheetModal: { isOpen: false, character: null },
      notifications: [],
    };
    const previous = getSaveSlots().find(slot => slot.slotId === target.slotId);
    const payload: StoredSavePayload = {
      version: SAVE_GAME_VERSION,
      slotId: target.slotId,
      slotName: target.slotName,
      isAutoSave: target.isAutoSave,
      preview: extractPreview(state, calculatePlaytimeSeconds(previous)),
      state,
      checksum: simpleHash(JSON.stringify(state)),
    };
    const key = target.backupKey ?? EMERGENCY_SAVE_KEY;
    const serialized = JSON.stringify(payload);
    SafeStorage.setItem(key, serialized);
    return { succeeded: true, clearIfCurrent: () => {
      // Another save can replace this backup while IndexedDB is pending.
      // Clear only the exact bytes this call wrote, never a newer writer.
      if (SafeStorage.getItem(key) === serialized) SafeStorage.removeItem(key);
    } };
  } catch (error) {
    logger.error('Emergency save failed', { error });
    return { succeeded: false, clearIfCurrent: () => {} };
  }
}
