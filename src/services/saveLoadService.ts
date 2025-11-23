/**
 * @file saveLoadService.ts
 * This service handles saving and loading game state to/from Local Storage.
 */
import { GameState, GamePhase } from '../types';

const SAVE_GAME_VERSION = "0.1.0"; // Current version of the save format
const DEFAULT_SAVE_SLOT = 'aralia_rpg_default_save';

/**
 * Saves the current game state to Local Storage.
 * @param {GameState} gameState - The current game state to save.
 * @param {string} [slotName=DEFAULT_SAVE_SLOT] - The name of the save slot.
 * @returns {Promise<boolean>} True if saving was successful, false otherwise.
 */
export async function saveGame(gameState: GameState, slotName: string = DEFAULT_SAVE_SLOT): Promise<boolean> {
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
    };
    const serializedState = JSON.stringify(stateToSave);
    localStorage.setItem(slotName, serializedState);
    console.log(`Game saved to slot: ${slotName} at ${new Date(stateToSave.saveTimestamp!).toLocaleString()}`);
    return true;
  } catch (error) {
    console.error("Error saving game:", error);
    // Handle potential errors like Local Storage being full
    if (error instanceof DOMException && (error.name === 'QuotaExceededError' || error.code === 22)) {
      alert("Failed to save game: Local storage is full. Please free up space or try a different browser.");
    } else {
      alert("Failed to save game. See console for details.");
    }
    return false;
  }
}

/**
 * Loads game state from Local Storage.
 * @param {string} [slotName=DEFAULT_SAVE_SLOT] - The name of the save slot.
 * @returns {Promise<GameState | null>} The loaded game state or null if loading failed or no save exists.
 */
export async function loadGame(slotName: string = DEFAULT_SAVE_SLOT): Promise<GameState | null> {
  try {
    const serializedState = localStorage.getItem(slotName);
    if (!serializedState) {
      console.log(`No save game found in slot: ${slotName}`);
      return null;
    }
    const loadedState: GameState = JSON.parse(serializedState);

    if (loadedState.saveVersion !== SAVE_GAME_VERSION) {
      console.warn(`Save game version mismatch. Expected ${SAVE_GAME_VERSION}, found ${loadedState.saveVersion}. Load aborted.`);
      alert(`Failed to load game: Save file is from an incompatible version (v${loadedState.saveVersion}). Expected v${SAVE_GAME_VERSION}. Please start a new game.`);
      return null;
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


    console.log(`Game loaded from slot: ${slotName}, saved at ${new Date(loadedState.saveTimestamp!).toLocaleString()}`);
    return loadedState;
  } catch (error) {
    console.error("Error loading game:", error);
    alert("Failed to load game: The save data might be corrupted. See console for details.");
    return null;
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
    alert("Failed to delete save game. See console for details.");
  }
}