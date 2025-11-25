/**
 * @file saveLoadService.ts
 * This service handles saving and loading game state to/from Local Storage.
 * All user feedback has been routed through the global NotificationSystem (via
 * an optional callback) instead of relying on intrusive `alert()` calls.
 */
import { GameState, GamePhase, NotificationType } from '../types';

//
// Save slot configuration
// -----------------------
// The legacy system wrote a single GameState object to `DEFAULT_SAVE_SLOT`.
// To support multiple slots we now persist a metadata index alongside
// per-slot payloads. Each payload is wrapped to carry preview info so new UI
// can render slot cards without fully hydrating the GameState.

export interface SaveSlotSummary {
  slotId: string;
  slotName: string;
  lastSaved: number;
  isAutoSave?: boolean;
  thumbnail?: string;
  locationName?: string;
  partyLevel?: number;
  playtimeSeconds?: number;
}

type SavePreview = {
  locationName?: string;
  partyLevel?: number;
  playtimeSeconds?: number;
};

interface StoredSavePayload {
  version: string;
  slotId: string;
  slotName: string;
  isAutoSave?: boolean;
  thumbnail?: string;
  preview?: SavePreview;
  state: GameState;
}

interface SaveGameOptions {
  displayName?: string;
  isAutoSave?: boolean;
  thumbnail?: string;
}

const SAVE_GAME_VERSION = "0.1.0"; // Current version of the save format
const DEFAULT_SAVE_SLOT = 'aralia_rpg_default_save';
const AUTO_SAVE_SLOT = 'aralia_rpg_autosave';
const SLOT_INDEX_KEY = 'aralia_rpg_save_slots_index';
const SLOT_PREFIX = 'aralia_rpg_slot_';

export const DEFAULT_SAVE_SLOT_KEY = DEFAULT_SAVE_SLOT;
export const AUTO_SAVE_SLOT_KEY = AUTO_SAVE_SLOT;

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
  options?: SaveGameOptions,
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
    const storageKey = resolveSlotKey(slotName, options?.isAutoSave);
    const slotLabel = options?.displayName || slotName;
    const payload: StoredSavePayload = {
      version: SAVE_GAME_VERSION,
      slotId: storageKey,
      slotName: slotLabel,
      isAutoSave: options?.isAutoSave || storageKey === AUTO_SAVE_SLOT,
      thumbnail: options?.thumbnail,
      preview: extractPreview(stateToSave),
      state: stateToSave,
    };

    const serializedState = JSON.stringify(payload);
    localStorage.setItem(storageKey, serializedState);
    upsertSlotMetadata({
      slotId: storageKey,
      slotName: slotLabel,
      lastSaved: stateToSave.saveTimestamp!,
      isAutoSave: payload.isAutoSave,
      thumbnail: payload.thumbnail,
      locationName: payload.preview?.locationName,
      partyLevel: payload.preview?.partyLevel,
      playtimeSeconds: payload.preview?.playtimeSeconds,
    });

    console.log(`Game saved to slot: ${storageKey} at ${new Date(stateToSave.saveTimestamp!).toLocaleString()}`);
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
    const storageKey = resolveSlotKey(slotName);
    const serializedState = localStorage.getItem(storageKey);
    if (!serializedState) {
      console.log(`No save game found in slot: ${storageKey}`);
      const result = { success: false, message: "No save game found." } as const;
      notify?.({ message: result.message, type: 'info' });
      return result;
    }

    const parsedData = JSON.parse(serializedState);
    const loadedState: GameState = (parsedData as StoredSavePayload).state || parsedData;

    if (loadedState.saveVersion && loadedState.saveVersion !== SAVE_GAME_VERSION) {
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

    normalizeLoadedDates(loadedState);
    upsertSlotMetadata({
      slotId: storageKey,
      slotName: (parsedData as StoredSavePayload).slotName || storageKey,
      lastSaved: loadedState.saveTimestamp || Date.now(),
      isAutoSave: (parsedData as StoredSavePayload).isAutoSave,
      thumbnail: (parsedData as StoredSavePayload).thumbnail,
      locationName: (parsedData as StoredSavePayload).preview?.locationName,
      partyLevel: (parsedData as StoredSavePayload).preview?.partyLevel,
      playtimeSeconds: (parsedData as StoredSavePayload).preview?.playtimeSeconds,
    });

    console.log(`Game loaded from slot: ${storageKey}, saved at ${new Date(loadedState.saveTimestamp!).toLocaleString()}`);
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
  try {
    const slots = getSaveSlots();
    if (slots.length > 0) return true;
    return localStorage.getItem(resolveSlotKey(slotName)) !== null;
  } catch (error) {
    console.error("Error checking save existence:", error);
    return false;
  }
}

/**
 * Retrieves the timestamp of the last save.
 * @param {string} [slotName=DEFAULT_SAVE_SLOT] - The name of the save slot.
 * @returns {number | null} The timestamp of the last save, or null if no save or timestamp.
 */
export function getLatestSaveTimestamp(slotName: string = DEFAULT_SAVE_SLOT): number | null {
  try {
    const slots = getSaveSlots();
    if (slots.length > 0) {
      return slots.sort((a, b) => b.lastSaved - a.lastSaved)[0]?.lastSaved ?? null;
    }

    const serializedState = localStorage.getItem(resolveSlotKey(slotName));
    if (!serializedState) return null;

    const parsedData = JSON.parse(serializedState);
    const legacyState: Partial<GameState> = (parsedData as StoredSavePayload).state || parsedData;
    return legacyState.saveTimestamp || null;
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
    const storageKey = resolveSlotKey(slotName);
    localStorage.removeItem(storageKey);
    removeSlotMetadata(storageKey);
    console.log(`Save game deleted from slot: ${storageKey}`);
  } catch (error) {
    console.error("Error deleting save game:", error);
  }
}

/**
 * Retrieves metadata for all known save slots, including the auto-save slot when present.
 */
export function getSaveSlots(): SaveSlotSummary[] {
  try {
    const storedIndex = localStorage.getItem(SLOT_INDEX_KEY);
    const parsedIndex: SaveSlotSummary[] = storedIndex ? JSON.parse(storedIndex) : [];
    return mergeWithLegacySaves(parsedIndex).sort((a, b) => b.lastSaved - a.lastSaved);
  } catch (error) {
    console.error("Error loading save slot metadata:", error);
    return mergeWithLegacySaves([]);
  }
}

// -----------------
// Helper functions
// -----------------

/**
 * Ensures consistent localStorage keys for both legacy single-slot and new multi-slot saves.
 */
function resolveSlotKey(slotName: string, isAutoSave?: boolean): string {
  if (slotName === DEFAULT_SAVE_SLOT) return DEFAULT_SAVE_SLOT;
  if (slotName === AUTO_SAVE_SLOT || isAutoSave) return AUTO_SAVE_SLOT;
  if (slotName.startsWith(SLOT_PREFIX)) return slotName;
  return `${SLOT_PREFIX}${slotName}`;
}

/**
 * Builds preview data (location, party level, playtime) from the latest GameState snapshot.
 */
function extractPreview(state: GameState): SavePreview {
  const partyLevels = state.party?.map(member => member.level || 1) || [];
  const averageLevel = partyLevels.length > 0 ? Math.round(partyLevels.reduce((a, b) => a + b, 0) / partyLevels.length) : undefined;
  const playtimeSeconds = state.gameTime instanceof Date ? Math.max(0, Math.floor(state.gameTime.getTime() / 1000)) : undefined;
  return {
    locationName: state.currentLocationId,
    partyLevel: averageLevel,
    playtimeSeconds,
  };
}

/**
 * Normalizes date-like fields to proper Date instances after JSON parsing.
 */
function normalizeLoadedDates(loadedState: GameState) {
  if (loadedState.gameTime && !(loadedState.gameTime instanceof Date)) {
    loadedState.gameTime = new Date(loadedState.gameTime);
  }
}

function upsertSlotMetadata(summary: SaveSlotSummary) {
  try {
    const current = getSaveSlots().filter(slot => slot.slotId !== summary.slotId);
    const next = [...current, summary];
    localStorage.setItem(SLOT_INDEX_KEY, JSON.stringify(next));
  } catch (error) {
    console.error("Error updating save slot metadata index:", error);
  }
}

function removeSlotMetadata(slotId: string) {
  try {
    const current = getSaveSlots().filter(slot => slot.slotId !== slotId);
    localStorage.setItem(SLOT_INDEX_KEY, JSON.stringify(current));
  } catch (error) {
    console.error("Error removing save slot metadata:", error);
  }
}

function mergeWithLegacySaves(index: SaveSlotSummary[]): SaveSlotSummary[] {
  const merged = [...index];

  const legacyKeys = [DEFAULT_SAVE_SLOT, AUTO_SAVE_SLOT];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key || (!key.startsWith(SLOT_PREFIX) && !legacyKeys.includes(key))) {
      continue;
    }

    const alreadyIndexed = merged.some(slot => slot.slotId === key);
    if (alreadyIndexed) continue;

    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as StoredSavePayload | GameState;
      const state = (parsed as StoredSavePayload).state || (parsed as GameState);
      const preview = (parsed as StoredSavePayload).preview || extractPreview(state as GameState);
      const fallbackTimestamp = (state as GameState).saveTimestamp || Date.now();
      merged.push({
        slotId: key,
        slotName: (parsed as StoredSavePayload).slotName || key,
        isAutoSave: key === AUTO_SAVE_SLOT || (parsed as StoredSavePayload).isAutoSave,
        lastSaved: fallbackTimestamp,
        thumbnail: (parsed as StoredSavePayload).thumbnail,
        locationName: preview?.locationName,
        partyLevel: preview?.partyLevel,
        playtimeSeconds: preview?.playtimeSeconds,
      });
    } catch (error) {
      console.error(`Failed to parse save slot ${key}:`, error);
    }
  }

  return merged;
}
