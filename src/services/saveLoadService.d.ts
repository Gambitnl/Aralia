/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 19/07/2026, 08:33:04
 * Dependents: App.tsx, components/SaveLoad/LoadGameModal.tsx, components/SaveLoad/SaveSlotSelector.tsx, components/layout/MainMenu.tsx, hooks/actions/handleSystemAndUi.ts, hooks/useAutoSave.ts, hooks/useGameInitialization.ts, state/appState.ts
 * Imports: 14 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * Copyright (c) 2024 Aralia RPG.
 * Licensed under the MIT License.
 *
 * @file saveLoadService.ts
 * This service handles saving and loading game state.
 *
 * Save payloads are stored in IndexedDB (which has 50MB-2GB+ of space) instead
 * of localStorage (which has a 5-10MB limit). This prevents quota errors as game
 * saves grow with party members, map data, message history, and AI interaction logs.
 *
 * Slot metadata (the small index of save summaries) stays in localStorage for
 * fast synchronous reads — the Load/Save UI needs this instantly without awaiting.
 *
 * If IndexedDB is unavailable (incognito mode, old browser), the service falls
 * back to localStorage-only mode so nothing breaks.
 *
 * All user feedback has been routed through the global NotificationSystem (via
 * an optional callback) instead of relying on intrusive `alert()` calls.
 */
import { GameState, NotificationType } from '../types';
export interface SaveSlotSummary {
    slotId: string;
    slotName: string;
    lastSaved: number;
    isAutoSave?: boolean;
    isCheckpoint?: boolean;
    thumbnail?: string;
    locationName?: string;
    partyLevel?: number;
    playtimeSeconds?: number;
}
interface SaveGameOptions {
    displayName?: string;
    isAutoSave?: boolean;
    thumbnail?: string;
}
export interface CheckpointTierConfig {
    id: string;
    slotKey: string;
    intervalSeconds: number;
    displayLabel: string;
}
export declare const CHECKPOINT_TIERS: CheckpointTierConfig[];
export declare const DEFAULT_SAVE_SLOT_KEY = "aralia_rpg_default_save";
export declare const AUTO_SAVE_SLOT_KEY = "aralia_rpg_autosave";
export interface SaveLoadResult {
    success: boolean;
    message?: string;
    data?: GameState;
}
type NotifyFn = (params: {
    message: string;
    type: NotificationType;
}) => void;
/**
 * Saves the current game state to Local Storage.
 * @param {GameState} gameState - The current game state to save.
 * @param {string} [slotName=DEFAULT_SAVE_SLOT] - The name of the save slot.
 * @returns {Promise<SaveLoadResult>} Result object with success status and message.
 */
export declare function saveGame(gameState: GameState, slotName?: string, notify?: NotifyFn, options?: SaveGameOptions): Promise<SaveLoadResult>;
/**
 * Loads game state from Local Storage.
 * @param {string} [slotName=DEFAULT_SAVE_SLOT] - The name of the save slot.
 * @returns {Promise<SaveLoadResult>} Result object with success status, message, and loaded data.
 */
export declare function loadGame(slotName?: string, notify?: NotifyFn): Promise<SaveLoadResult>;
/**
 * Checks if a save game exists in the specified slot.
 * @param {string} [slotName=DEFAULT_SAVE_SLOT] - The name of the save slot.
 * @returns {boolean} True if a save game exists, false otherwise.
 */
export declare function hasSaveGame(slotName?: string): boolean;
/**
 * Retrieves the timestamp of the last save.
 * @param {string} [slotName=DEFAULT_SAVE_SLOT] - The name of the save slot.
 * @returns {number | null} The timestamp of the last save, or null if no save or timestamp.
 */
export declare function getLatestSaveTimestamp(slotName?: string): number | null;
/**
 * Deletes a save game from the specified slot.
 * @param {string} [slotName=DEFAULT_SAVE_SLOT] - The name of the save slot to delete.
 */
export declare function deleteSaveGame(slotName?: string): Promise<void>;
/**
 * Deletes ALL save games and clears the metadata index.
 */
export declare function clearAllSaves(): Promise<void>;
/**
 * Retrieves metadata for all known save slots, including the auto-save slot when present.
 */
export declare function getSaveSlots(): SaveSlotSummary[];
/**
 * Forces a rebuild of the slot index cache. Helpful for gameplay hooks that
 * clear or repopulate Local Storage (e.g., reset-to-default flows) so UI
 * layers always read the latest metadata without needing to reload the page.
 */
export declare function refreshSaveSlotIndex(): SaveSlotSummary[];
/**
 * Sets up a window storage listener so slot metadata stays in sync when other
 * tabs mutate localStorage (e.g., by clearing saves or importing backups).
 * The debounce avoids thrashing when multiple keys update in quick succession
 * during bulk operations.
 */
export declare function setupSlotIndexStorageSync(): void;
/**
 * Allows tests or teardown hooks to remove the storage sync listener.
 */
export declare function teardownSlotIndexStorageSync(): void;
/**
 * Initializes IndexedDB and migrates existing localStorage saves if needed.
 * Called once on app startup (from useGameInitialization or similar).
 * Safe to call multiple times — it short-circuits after the first run.
 */
export declare function initializeStorage(): Promise<void>;
/**
 * Writes a save synchronously to localStorage for use during beforeunload.
 * This is a best-effort fallback when IndexedDB (which is async) can't
 * complete before the browser kills the page. On next load, the emergency
 * save is moved to IndexedDB via recoverEmergencySave().
 */
export declare function emergencySaveSync(gameState: GameState): void;
/**
 * Returns whether IndexedDB is being used for save storage.
 * Useful for the UI to show storage status or debug info.
 */
export declare function isUsingIndexedDB(): boolean;
/**
 * Returns whether a given slot key belongs to a checkpoint tier.
 */
export declare function isCheckpointSlot(slotId: string): boolean;
/**
 * Exposed slot normalization helper so UI layers can mirror the storage key
 * calculation without duplicating prefix/auto-save rules. This keeps overwrite
 * detection consistent between the selector and the service.
 */
export declare function getSlotStorageKey(slotName: string, isAutoSave?: boolean): string;
export {};
