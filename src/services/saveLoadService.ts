/**
 * @file saveLoadService.ts
 * This service handles saving and loading game state to/from Local Storage.
 * All user feedback has been routed through the global NotificationSystem (via
 * an optional callback) instead of relying on intrusive `alert()` calls.
 */
import { GameState, GamePhase, NotificationType } from '../types';

const SAVE_GAME_VERSION = "0.1.0"; // Current version of the save format
const DEFAULT_SAVE_SLOT = 'aralia_rpg_default_save';

export interface SaveLoadResult {
  success: boolean;
  message?: string;
  data?: GameState;
}

// Optional notifier empowers calling layers to surface status through NotificationSystem.
type NotifyFn = (params: { message: string; type: NotificationType }) => void;

/**
 * Saves the current game state to Local Storage.
 * @param {GameState} gameState - The current game state to save.
 * @param {string} [slotName=DEFAULT_SAVE_SLOT] - The name of the save slot.
 * @returns {Promise<SaveLoadResult>} Result object with success status and message.
 */
export async function saveGame(
  gameState: GameState,
  slotName: string = DEFAULT_SAVE_SLOT,
  notify?: NotifyFn,
): Promise<SaveLoadResult> {
  try {
    const stateToSave: GameState = {
      ...gameState,
      saveVersion: SAVE_GAME_VERSION,
      saveTimestamp: Date.now(),
      // Ensure transient states are not saved or are reset if needed
      isLoading: false,
      isImageLoading: false,
      error: null,
      isMapVisible: false, 
      isSubmapVisible: false,
      geminiGeneratedActions: null,
      isDiscoveryLogVisible: false, // Ensure journal is closed in saved state
      isDevMenuVisible: false,
      isGeminiLogViewerVisible: false,
      characterSheetModal: { isOpen: false, character: null },
      notifications: [], // Don't save transient notifications
    };
    const serializedState = JSON.stringify(stateToSave);
    localStorage.setItem(slotName, serializedState);
    console.log(`Game saved to slot: ${slotName} at ${new Date(stateToSave.saveTimestamp!).toLocaleString()}`);
    const result = { success: true, message: "Game saved successfully." } as const;
    notify?.({ message: result.message, type: 'success' });
    return result;
  } catch (error) {
    console.error("Error saving game:", error);
    // Handle potential errors like Local Storage being full
    if (error instanceof DOMException && (error.name === 'QuotaExceededError' || error.code === 22)) {
      const failure = { success: false, message: "Failed to save: Local storage is full." } as const;
      notify?.({ message: failure.message, type: 'error' });
      return failure;
    } else {
      const failure = { success: false, message: "Failed to save game. See console." } as const;
      notify?.({ message: failure.message, type: 'error' });
      return failure;
    }
  }
}

/**
 * Loads game state from Local Storage.
 * @param {string} [slotName=DEFAULT_SAVE_SLOT] - The name of the save slot.
 * @returns {Promise<SaveLoadResult>} Result object with success status, message, and loaded data.
 */
export async function loadGame(slotName: string = DEFAULT_SAVE_SLOT, notify?: NotifyFn): Promise<SaveLoadResult> {
  try {
    const serializedState = localStorage.getItem(slotName);
    if (!serializedState) {
      console.log(`No save game found in slot: ${slotName}`);
      const result = { success: false, message: "No save game found." } as const;
      notify?.({ message: result.message, type: 'info' });
      return result;
    }
    const loadedState: GameState = JSON.parse(serializedState);

    if (loadedState.saveVersion !== SAVE_GAME_VERSION) {
      console.warn(`Save game version mismatch. Expected ${SAVE_GAME_VERSION}, found ${loadedState.saveVersion}. Load aborted.`);
      const failure = { success: false, message: `Save file incompatible (v${loadedState.saveVersion}). Expected v${SAVE_GAME_VERSION}.` } as const;
      notify?.({ message: failure.message, type: 'warning' });
      return failure;
    }
    
    // Ensure transient states are reset for the loaded game
    loadedState.isLoading = false;
    loadedState.isImageLoading = false;
    loadedState.error = null;
    loadedState.isMapVisible = false;
    loadedState.isSubmapVisible = false;
    loadedState.isDiscoveryLogVisible = false; // Ensure journal is closed on load
    loadedState.isDevMenuVisible = false;
    loadedState.isGeminiLogViewerVisible = false;
    loadedState.geminiGeneratedActions = null;
    loadedState.phase = GamePhase.PLAYING; // Ensure game phase is set to playing
    loadedState.characterSheetModal = loadedState.characterSheetModal || { isOpen: false, character: null }; // Ensure it exists

    // Initialize new fields if loading an older save that might not have them
    loadedState.discoveryLog = loadedState.discoveryLog || [];
    loadedState.unreadDiscoveryCount = loadedState.unreadDiscoveryCount || 0;
    loadedState.notifications = []; // Reset notifications

    console.log(`Game loaded from slot: ${slotName}, saved at ${new Date(loadedState.saveTimestamp!).toLocaleString()}`);
    const result = { success: true, message: "Game loaded successfully.", data: loadedState } as const;
    notify?.({ message: result.message, type: 'success' });
    return result;
  } catch (error) {
    console.error("Error loading game:", error);
    const failure = { success: false, message: "Failed to load game. Data corrupted." } as const;
    notify?.({ message: failure.message, type: 'error' });
    return failure;
  }
}

/**
 * Checks if a save game exists in the specified slot.
 * @param {string} [slotName=DEFAULT_SAVE_SLOT] - The name of the save slot.
 * @returns {boolean} True if a save game exists, false otherwise.
 */
export function hasSaveGame(slotName: string = DEFAULT_SAVE_SLOT): boolean {
  return localStorage.getItem(slotName) !== null;
}

/**
 * Retrieves the timestamp of the last save.
 * @param {string} [slotName=DEFAULT_SAVE_SLOT] - The name of the save slot.
 * @returns {number | null} The timestamp of the last save, or null if no save or timestamp.
 */
export function getLatestSaveTimestamp(slotName: string = DEFAULT_SAVE_SLOT): number | null {
  try {
    const serializedState = localStorage.getItem(slotName);
    if (serializedState) {
      const loadedState: Partial<GameState> = JSON.parse(serializedState);
      return loadedState.saveTimestamp || null;
    }
    return null;
  } catch (error) {
    console.error("Error retrieving save timestamp:", error);
    return null;
  }
}

/**
 * Deletes a save game from the specified slot.
 * @param {string} [slotName=DEFAULT_SAVE_SLOT] - The name of the save slot to delete.
 */
export function deleteSaveGame(slotName: string = DEFAULT_SAVE_SLOT): void {
  try {
    localStorage.removeItem(slotName);
    console.log(`Save game deleted from slot: ${slotName}`);
  } catch (error) {
    console.error("Error deleting save game:", error);
  }
}
