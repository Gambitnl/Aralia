/**
 * Copyright (c) 2024 Aralia RPG.
 * Licensed under the MIT License.
 *
 * @file saveLoadService.ts
 * This service handles saving and loading game state to/from Local Storage.
 * All user feedback has been routed through the global NotificationSystem (via
 * an optional callback) instead of relying on intrusive `alert()` calls.
 */
import { GameState, GamePhase, NotificationType } from '../types';
import { SafeStorage, SafeSession } from '../utils/storageUtils';
import { safeJSONParse } from '../utils/securityUtils';
import { logger } from '../utils/logger';
import { simpleHash } from '../utils/hashUtils';

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
  checksum?: number;
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
const SESSION_CACHE_KEY = 'aralia_rpg_slot_cache';

// Local in-memory cache of slot metadata to avoid repeated JSON parses and
// Local Storage scans on every call to getSaveSlots(). This improves menu
// responsiveness because the slot selector and load modal call into this
// service frequently while the player hovers between options.
let slotIndexCache: SaveSlotSummary[] | null = null;
// Handle storage change sync across tabs/contexts. This ensures that if one
// tab wipes or repopulates localStorage, every other open tab rebuilds its
// metadata cache instead of showing stale previews.
let slotIndexRefreshTimer: ReturnType<typeof setTimeout> | null = null;
let detachStorageSyncListener: (() => void) | null = null;

// Tracks when the current play session last started or resumed so we can
// measure incremental playtime in real-world seconds instead of relying on
// the in-game clock (which advances independently of player presence).
let sessionStartedAtMs = Date.now();

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
    // Persist a trimmed display name so slot labels stay consistent even if
    // upstream callers send padded values. We still default to the provided
    // slot identifier when a trimmed label would be empty so cards never show
    // a blank title.
    const slotLabel = (options?.displayName ?? slotName).trim() || slotName;
    const existingSlotSummary = getSaveSlots().find(slot => slot.slotId === storageKey);
    const playtimeSeconds = calculatePlaytimeSeconds(existingSlotSummary);
    // Calculate checksum of the state to save for integrity check
    const serializedStateForHash = JSON.stringify(stateToSave);
    const checksum = simpleHash(serializedStateForHash);

    const payload: StoredSavePayload = {
      version: SAVE_GAME_VERSION,
      slotId: storageKey,
      slotName: slotLabel,
      isAutoSave: options?.isAutoSave || storageKey === AUTO_SAVE_SLOT,
      thumbnail: options?.thumbnail,
      preview: extractPreview(stateToSave, playtimeSeconds),
      state: stateToSave,
      checksum,
    };

    const serializedPayload = JSON.stringify(payload);
    SafeStorage.setItem(storageKey, serializedPayload);
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

    // Reset the session start marker so subsequent saves only add newly accrued
    // real-world time instead of double-counting the segment we just recorded.
    resetSessionTimer(stateToSave.saveTimestamp!);

    logger.info("Game saved", {
      slotId: storageKey,
      timestamp: new Date(stateToSave.saveTimestamp!).toISOString()
    });

    const result = { success: true, message: "Game saved successfully." } as const;
    notify?.({ message: result.message, type: 'success' });
    return result;
  } catch (error) {
    logger.error("Error saving game", { error, slotName });

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
    const serializedState = SafeStorage.getItem(storageKey);
    if (!serializedState) {
      logger.info("No save game found", { slotId: storageKey });
      const result = { success: false, message: "No save game found." } as const;
      notify?.({ message: result.message, type: 'info' });
      return result;
    }

    const parsedData = safeJSONParse<StoredSavePayload | GameState>(serializedState);
    if (!parsedData) {
      logger.error("Failed to parse save game data", { slotId: storageKey });
      const failure = { success: false, message: "Save data corrupted (unreadable)." } as const;
      notify?.({ message: failure.message, type: 'error' });
      return failure;
    }

    const loadedState: GameState = (parsedData as StoredSavePayload).state || (parsedData as GameState);
    const storedChecksum = (parsedData as StoredSavePayload).checksum;

    if (storedChecksum) {
      const computedChecksum = simpleHash(JSON.stringify(loadedState));
      if (computedChecksum !== storedChecksum) {
        logger.error("Save game checksum mismatch", {
          expected: storedChecksum,
          actual: computedChecksum,
          slotId: storageKey
        });
        const failure = { success: false, message: "Save data corrupted (integrity check failed)." } as const;
        notify?.({ message: failure.message, type: 'error' });
        return failure;
      }
    }

    if (loadedState.saveVersion && loadedState.saveVersion !== SAVE_GAME_VERSION) {
      logger.warn("Save game version mismatch", {
        expected: SAVE_GAME_VERSION,
        actual: loadedState.saveVersion
      });
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
    loadedState.isOllamaLogViewerVisible = false;
    loadedState.geminiGeneratedActions = null;
    loadedState.phase = GamePhase.PLAYING; // Ensure game phase is set to playing
    loadedState.characterSheetModal = loadedState.characterSheetModal || { isOpen: false, character: null }; // Ensure it exists

    // Initialize new fields if loading an older save that might not have them
    loadedState.discoveryLog = loadedState.discoveryLog || [];
    loadedState.unreadDiscoveryCount = loadedState.unreadDiscoveryCount || 0;
    loadedState.ollamaInteractionLog = loadedState.ollamaInteractionLog || [];
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

    logger.info("Game loaded", {
      slotId: storageKey,
      timestamp: new Date(loadedState.saveTimestamp!).toISOString()
    });

    const result = { success: true, message: "Game loaded successfully.", data: loadedState } as const;
    notify?.({ message: result.message, type: 'success' });
    resetSessionTimer();
    return result;
  } catch (error) {
    logger.error("Error loading game", { error });
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
    return SafeStorage.getItem(resolveSlotKey(slotName)) !== null;
  } catch (error) {
    logger.error("Error checking save existence", { error });
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

    const serializedState = SafeStorage.getItem(resolveSlotKey(slotName));
    if (!serializedState) return null;

    const parsedData = safeJSONParse<StoredSavePayload | GameState>(serializedState);
    if (!parsedData) return null;

    const legacyState: Partial<GameState> = (parsedData as StoredSavePayload).state || (parsedData as GameState);
    return legacyState.saveTimestamp || null;
  } catch (error) {
    logger.error("Error retrieving save timestamp", { error });
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
    SafeStorage.removeItem(storageKey);
    removeSlotMetadata(storageKey);
    logger.info("Save game deleted", { slotId: storageKey });
  } catch (error) {
    logger.error("Error deleting save game", { error });
  }
}

/**
 * Retrieves metadata for all known save slots, including the auto-save slot when present.
 */
export function getSaveSlots(): SaveSlotSummary[] {
  try {
    if (slotIndexCache) {
      return [...slotIndexCache];
    }

    const fromSession = getSessionCache();
    if (fromSession) {
      slotIndexCache = fromSession;
      return [...fromSession];
    }

    const merged = buildSlotIndex();
    persistSlotIndex(merged); // This also updates the in-memory cache
    return [...merged];
  } catch (error) {
    logger.error("Error loading save slot metadata", { error });
    return mergeWithLegacySaves([]).sort((a, b) => b.lastSaved - a.lastSaved);
  }
}

/**
 * Forces a rebuild of the slot index cache. Helpful for gameplay hooks that
 * clear or repopulate Local Storage (e.g., reset-to-default flows) so UI
 * layers always read the latest metadata without needing to reload the page.
 */
export function refreshSaveSlotIndex(): SaveSlotSummary[] {
  slotIndexCache = null;
  SafeSession.removeItem(SESSION_CACHE_KEY);
  return getSaveSlots();
}

/**
 * Sets up a window storage listener so slot metadata stays in sync when other
 * tabs mutate localStorage (e.g., by clearing saves or importing backups).
 * The debounce avoids thrashing when multiple keys update in quick succession
 * during bulk operations.
 */
export function setupSlotIndexStorageSync() {
  if (typeof window === 'undefined') return; // Guard for SSR/test environments.
  if (detachStorageSyncListener) return; // Listener already registered.

  const handler = (event: StorageEvent) => {
    // Some browsers emit a null key when localStorage.clear() runs, so treat
    // that as a signal to rebuild the cache too.
    const isSlotIndex = !event.key || event.key === SLOT_INDEX_KEY;
    const isSaveKey =
      event.key === DEFAULT_SAVE_SLOT ||
      event.key === AUTO_SAVE_SLOT ||
      (!!event.key && event.key.startsWith(SLOT_PREFIX));

    if (!isSlotIndex && !isSaveKey) return;

    if (slotIndexRefreshTimer) clearTimeout(slotIndexRefreshTimer);
    slotIndexRefreshTimer = setTimeout(() => {
      // Refresh after the burst of storage changes settles so we only rebuild
      // the index once per batch of updates.
      refreshSaveSlotIndex();
      slotIndexRefreshTimer = null;
    }, 75);
  };

  window.addEventListener('storage', handler);
  detachStorageSyncListener = () => {
    window.removeEventListener('storage', handler);
    detachStorageSyncListener = null;
  };
}

/**
 * Allows tests or teardown hooks to remove the storage sync listener.
 */
export function teardownSlotIndexStorageSync() {
  detachStorageSyncListener?.();
}

// Register the sync listener immediately so any tab opening this module stays
// in lockstep with peer tabs that mutate localStorage. The guard within
// setupSlotIndexStorageSync ensures we play nicely with SSR and repeated imports.
setupSlotIndexStorageSync();

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
 * Exposed slot normalization helper so UI layers can mirror the storage key
 * calculation without duplicating prefix/auto-save rules. This keeps overwrite
 * detection consistent between the selector and the service.
 */
export function getSlotStorageKey(slotName: string, isAutoSave?: boolean): string {
  return resolveSlotKey(slotName, isAutoSave);
}

/**
 * Builds preview data (location, party level, playtime) from the latest GameState snapshot.
 */
function extractPreview(state: GameState, playtimeSeconds?: number): SavePreview {
  const partyLevels = state.party?.map(member => member.level || 1) || [];
  const averageLevel = partyLevels.length > 0 ? Math.round(partyLevels.reduce((a, b) => a + b, 0) / partyLevels.length) : undefined;
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

function calculatePlaytimeSeconds(existingSlot?: SaveSlotSummary): number {
  // Carry forward any previously recorded playtime and add the time accrued
  // since the current session began. This keeps the metric grounded in
  // real-world elapsed time instead of the in-game calendar.
  const alreadyRecorded = existingSlot?.playtimeSeconds ?? 0;
  const sessionElapsedSeconds = Math.max(0, Math.floor((Date.now() - sessionStartedAtMs) / 1000));
  return alreadyRecorded + sessionElapsedSeconds;
}

function resetSessionTimer(startTimeMs: number = Date.now()) {
  sessionStartedAtMs = startTimeMs;
}

function upsertSlotMetadata(summary: SaveSlotSummary) {
  try {
    const current = getSaveSlots().filter(slot => slot.slotId !== summary.slotId);
    const next = [...current, summary].sort((a, b) => b.lastSaved - a.lastSaved);
    persistSlotIndex(next);
  } catch (error) {
    logger.error("Error updating save slot metadata index", { error });
  }
}

function removeSlotMetadata(slotId: string) {
  try {
    const current = getSaveSlots().filter(slot => slot.slotId !== slotId);
    persistSlotIndex(current);
  } catch (error) {
    logger.error("Error removing save slot metadata", { error });
  }
}

function persistSlotIndex(next: SaveSlotSummary[]) {
  // Graceful degradation: If LocalStorage is full, we still update the in-memory cache
  // so the user sees their new save during the current session.
  try {
    SafeStorage.setItem(SLOT_INDEX_KEY, JSON.stringify(next));
  } catch (error) {
    logger.warn("Failed to persist save slot index to LocalStorage (quota exceeded?)", { error });
  }

  slotIndexCache = [...next];
  try {
    SafeSession.setItem(SESSION_CACHE_KEY, JSON.stringify(next));
  } catch (error) {
    logger.warn("Session storage is unavailable, caching disabled", { error });
  }
}

function getSessionCache(): SaveSlotSummary[] | null {
  try {
    const cached = SafeSession.getItem(SESSION_CACHE_KEY);
    return safeJSONParse<SaveSlotSummary[]>(cached || '');
  } catch (error) {
    logger.warn("Failed to read from session storage, cache ignored", { error });
    return null;
  }
}

function buildSlotIndex(): SaveSlotSummary[] {
  const storedIndex = SafeStorage.getItem(SLOT_INDEX_KEY);
  const parsedIndex: SaveSlotSummary[] = safeJSONParse<SaveSlotSummary[]>(storedIndex || '') || [];
  return mergeWithLegacySaves(parsedIndex).sort((a, b) => b.lastSaved - a.lastSaved);
}

function mergeWithLegacySaves(index: SaveSlotSummary[]): SaveSlotSummary[] {
  const merged = [...index];

  const legacyKeys = [DEFAULT_SAVE_SLOT, AUTO_SAVE_SLOT];
  const allKeys = SafeStorage.getAllKeys();

  for (const key of allKeys) {
    if (!key || (!key.startsWith(SLOT_PREFIX) && !legacyKeys.includes(key))) {
      continue;
    }

    const alreadyIndexed = merged.some(slot => slot.slotId === key);
    if (alreadyIndexed) continue;

    try {
      const raw = SafeStorage.getItem(key);
      if (!raw) continue;
      const parsed = safeJSONParse<StoredSavePayload | GameState>(raw);
      if (!parsed) continue;

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
      logger.error(`Failed to parse save slot ${key}`, { error });
    }
  }

  return merged;
}
