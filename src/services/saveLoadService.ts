// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 20/06/2026, 01:45:37
 * Dependents: App.tsx, components/SaveLoad/LoadGameModal.tsx, components/SaveLoad/SaveSlotSelector.tsx, components/layout/MainMenu.tsx, hooks/actions/handleSystemAndUi.ts, hooks/useAutoSave.ts, hooks/useGameInitialization.ts, state/appState.ts
 * Imports: 11 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

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
import { GameState, GamePhase, NotificationType } from '../types';
import { buildHitPointDicePools, normalizeClassLevels } from '../utils/characterUtils';
import { getGameDay } from '../utils/core';
import { createEmptyHistory } from '../utils/historyUtils';
import { SafeStorage, SafeSession } from '../utils/storageUtils';
import { safeJSONParse } from '../utils/securityUtils';
import { logger } from '../utils/logger';
import { simpleHash } from '../utils/hashUtils';
import * as IDBStorage from './indexedDBStorageService';
import { migratePlayerCell } from '@/state/migrations/playerCellMigration';
import { countUnreadDiscoveryEntries, retainDiscoveryLogEntries } from '@/state/reducers/logReducer';

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
  isCheckpoint?: boolean;
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

// Key used in localStorage to track whether saves have been migrated from
// localStorage to IndexedDB. Once set, migration won't re-run.
const MIGRATION_FLAG_KEY = 'aralia_rpg_migrated_to_idb';

// Key for emergency saves written synchronously to localStorage during
// beforeunload when IndexedDB (which is async) can't complete in time.
const EMERGENCY_SAVE_KEY = 'aralia_rpg_emergency_save';

// ============================================================================
// Checkpoint Tier Configuration
// ============================================================================
// Each checkpoint periodically copies the rapid autosave to its own slot.
// This gives players multiple recovery points at different ages.
// The tiers are: 1 minute, 5 minutes, 15 minutes, 30 minutes, 1 hour.
// The rapid autosave (AUTO_SAVE_SLOT) is tier 0 and isn't listed here.
// ============================================================================

export interface CheckpointTierConfig {
  id: string;
  slotKey: string;
  intervalSeconds: number;
  displayLabel: string;
}

export const CHECKPOINT_TIERS: CheckpointTierConfig[] = [
  { id: 'checkpoint_1min',  slotKey: 'aralia_rpg_checkpoint_1min',  intervalSeconds: 60,   displayLabel: '1 Minute Checkpoint' },
  { id: 'checkpoint_5min',  slotKey: 'aralia_rpg_checkpoint_5min',  intervalSeconds: 300,  displayLabel: '5 Minute Checkpoint' },
  { id: 'checkpoint_15min', slotKey: 'aralia_rpg_checkpoint_15min', intervalSeconds: 900,  displayLabel: '15 Minute Checkpoint' },
  { id: 'checkpoint_30min', slotKey: 'aralia_rpg_checkpoint_30min', intervalSeconds: 1800, displayLabel: '30 Minute Checkpoint' },
  { id: 'checkpoint_1hr',   slotKey: 'aralia_rpg_checkpoint_1hr',   intervalSeconds: 3600, displayLabel: '1 Hour Checkpoint' },
];

// Prefix for checkpoint slot keys — used to identify them in the slot index.
const CHECKPOINT_PREFIX = 'aralia_rpg_checkpoint_';

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

// Tracks whether IndexedDB is available for save payloads. Set once during
// initialization. When false, the service falls back to localStorage-only mode.
let idbAvailable = false;
// Tracks whether the one-time localStorage→IndexedDB migration has completed.
let migrationDone = false;

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
    // Sanitization: create a clean copy where transient flags (isLoading, isError)
    // are reset. We don't want to load into a broken state.
    const stateToSave: GameState = {
      ...gameState,
      saveVersion: SAVE_GAME_VERSION,
      saveTimestamp: Date.now(),
      // Ensure transient states are not saved or are reset if needed.
      // Player-facing overlay flags (isMapVisible/isDiscoveryLogVisible) are
      // deliberately persisted as-is so resume
      // reopens the panel the player was using (resume-journey task 4).
      // Dev/debug surfaces and object-holding modals stay forced closed.
      isLoading: false,
      isImageLoading: false,
      error: null,
      geminiGeneratedActions: null,
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
    // Data Integrity: hash the serialized JSON. On load, we re-hash and compare.
    // This detects if storage was manually tampered with or corrupted.
    const serializedStateForHash = JSON.stringify(stateToSave);
    const checksum = simpleHash(serializedStateForHash);

    // Mark checkpoint slots so the UI can distinguish them from manual saves.
    const isCheckpoint = storageKey.startsWith(CHECKPOINT_PREFIX);

    const payload: StoredSavePayload = {
      version: SAVE_GAME_VERSION,
      slotId: storageKey,
      slotName: slotLabel,
      isAutoSave: options?.isAutoSave || storageKey === AUTO_SAVE_SLOT || isCheckpoint,
      thumbnail: options?.thumbnail,
      preview: extractPreview(stateToSave, playtimeSeconds),
      state: stateToSave,
      checksum,
    };

    const serializedPayload = JSON.stringify(payload);

    // Write the payload to IndexedDB if available, otherwise fall back to localStorage.
    if (idbAvailable) {
      await IDBStorage.putSave(storageKey, serializedPayload);
    } else {
      SafeStorage.setItem(storageKey, serializedPayload);
    }

    // Slot metadata always goes to localStorage for fast synchronous reads.
    // The Load/Save UI reads metadata on render and can't await IndexedDB.
    upsertSlotMetadata({
      slotId: storageKey,
      slotName: slotLabel,
      lastSaved: stateToSave.saveTimestamp!,
      isAutoSave: payload.isAutoSave,
      isCheckpoint,
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
      storage: idbAvailable ? 'IndexedDB' : 'localStorage',
      timestamp: new Date(stateToSave.saveTimestamp!).toISOString()
    });

    const result = { success: true, message: "Game saved successfully." } as const;
    notify?.({ message: result.message, type: 'success' });
    return result;
  } catch (error) {
    logger.error("Error saving game", { error, slotName });

    // Handle potential errors like storage being full
    if (error instanceof DOMException && (error.name === 'QuotaExceededError' || error.code === 22)) {
      const failure = { success: false, message: "Failed to save: Storage is full." } as const;
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

    // Try IndexedDB first, then fall back to localStorage.
    // This handles both the normal case (saves in IndexedDB) and the legacy/
    // fallback case (saves still in localStorage or emergency saves).
    let serializedState: string | null = null;
    if (idbAvailable) {
      serializedState = await IDBStorage.getSave(storageKey);
    }
    if (!serializedState) {
      // Check localStorage as fallback (pre-migration saves, emergency saves,
      // or IndexedDB-unavailable mode).
      serializedState = SafeStorage.getItem(storageKey);
    }

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
    // Player-facing overlays restore as saved (resume-journey task 4), but only
    // strict booleans survive — legacy/hand-edited saves heal to closed rather
    // than resuming into an undefined panel state.
    loadedState.isMapVisible = loadedState.isMapVisible === true;
    loadedState.isDiscoveryLogVisible = loadedState.isDiscoveryLogVisible === true;
    loadedState.isDevMenuVisible = false;
    loadedState.isGeminiLogViewerVisible = false;
    loadedState.isOllamaLogViewerVisible = false;
    loadedState.geminiGeneratedActions = null;
    // Combat runtime (turn order, initiative, battle map) is hook-local and never
    // serialized, so a save written during combat can only resume on the
    // exploration surface. We treat that save as a pre-combat checkpoint: heal the
    // phase to PLAYING and tell the player why they're back in the world.
    if (loadedState.phase === GamePhase.COMBAT || loadedState.phase === GamePhase.BATTLE_MAP_DEMO) {
      notify?.({ message: 'Resumed from pre-combat checkpoint.', type: 'info' });
    }
    loadedState.phase = GamePhase.PLAYING; // Ensure game phase is set to playing
    loadedState.characterSheetModal = loadedState.characterSheetModal || { isOpen: false, character: null }; // Ensure it exists

    // Initialize and prune the discovery log for older saves. Runtime Logbook
    // writes now cap the list, but old payloads may still carry unbounded
    // history, so loading is the safest place to heal them before play resumes.
    loadedState.discoveryLog = retainDiscoveryLogEntries(loadedState.discoveryLog || []);
    loadedState.unreadDiscoveryCount = countUnreadDiscoveryEntries(loadedState.discoveryLog);
    loadedState.ollamaInteractionLog = loadedState.ollamaInteractionLog || [];
    loadedState.notifications = []; // Reset notifications

    if (loadedState.party?.length) {
      // Normalize older saves to the Hit Dice pool model (class-level aware).
      loadedState.party = loadedState.party.map(member => {
        const classLevels = normalizeClassLevels(member);
        const normalizedMember = { ...member, classLevels };
        return {
          ...normalizedMember,
          hitPointDice: buildHitPointDicePools(normalizedMember, { classLevels, previousPools: member.hitPointDice }),
        };
      });
    }

    normalizeLoadedDates(loadedState);
    // Legacy saves may predate the world-history bootstrap payload, so keep a
    // defined empty registry in place instead of forcing a rewrite of old slots.
    loadedState.worldHistory = loadedState.worldHistory || createEmptyHistory();
    // Grid retirement: saves no longer carry the 30x20 mapData grid; the old
    // WorldData-v2 backfill is gone (the world is the atlas from worldSeed).
    // Backfill the canonical player cell (cell-native world, Stage 2) on saves
    // created before it existed. Idempotent; derives the cell from the legacy
    // currentLocationId (a `cell_<id>` id recovers it directly; anything else
    // loads with a null cell).
    migratePlayerCell(loadedState);
    // Ensure new rest pacing fields exist when loading older saves.
    const restTrackerSeedTime = loadedState.gameTime instanceof Date
      ? loadedState.gameTime
      : new Date(loadedState.gameTime);
    loadedState.shortRestTracker = {
      restsTakenToday: loadedState.shortRestTracker?.restsTakenToday ?? 0,
      lastRestDay: loadedState.shortRestTracker?.lastRestDay ?? getGameDay(restTrackerSeedTime),
      lastRestEndedAtMs: loadedState.shortRestTracker?.lastRestEndedAtMs ?? null,
    };
    upsertSlotMetadata({
      slotId: storageKey,
      slotName: (parsedData as StoredSavePayload).slotName || storageKey,
      lastSaved: loadedState.saveTimestamp || Date.now(),
      isAutoSave: (parsedData as StoredSavePayload).isAutoSave,
      isCheckpoint: storageKey.startsWith(CHECKPOINT_PREFIX),
      thumbnail: (parsedData as StoredSavePayload).thumbnail,
      locationName: (parsedData as StoredSavePayload).preview?.locationName,
      partyLevel: (parsedData as StoredSavePayload).preview?.partyLevel,
      playtimeSeconds: (parsedData as StoredSavePayload).preview?.playtimeSeconds,
    });

    logger.info("Game loaded", {
      slotId: storageKey,
      storage: idbAvailable ? 'IndexedDB' : 'localStorage',
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
    if (slotName === DEFAULT_SAVE_SLOT && slots.length > 0) return true;
    
    const storageKey = resolveSlotKey(slotName);
    return slots.some(slot => slot.slotId === storageKey);
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
    if (slots.length === 0) return null;

    if (slotName === DEFAULT_SAVE_SLOT) {
      return slots.sort((a, b) => b.lastSaved - a.lastSaved)[0]?.lastSaved ?? null;
    }

    const storageKey = resolveSlotKey(slotName);
    return slots.find(slot => slot.slotId === storageKey)?.lastSaved ?? null;
  } catch (error) {
    logger.error("Error retrieving save timestamp", { error });
    return null;
  }
}

/**
 * Deletes a save game from the specified slot.
 * @param {string} [slotName=DEFAULT_SAVE_SLOT] - The name of the save slot to delete.
 */
export async function deleteSaveGame(slotName: string = DEFAULT_SAVE_SLOT): Promise<void> {
  try {
    const storageKey = resolveSlotKey(slotName);
    // Delete from both IndexedDB and localStorage to cover all cases
    // (migrated saves, emergency saves, fallback-mode saves).
    if (idbAvailable) {
      await IDBStorage.deleteSave(storageKey);
    }
    SafeStorage.removeItem(storageKey);
    removeSlotMetadata(storageKey);
    logger.info("Save game deleted", { slotId: storageKey });
  } catch (error) {
    logger.error("Error deleting save game", { error });
  }
}

/**
 * Deletes ALL save games and clears the metadata index.
 */
export async function clearAllSaves(): Promise<void> {
  try {
    const slots = getSaveSlots();
    for (const slot of slots) {
      SafeStorage.removeItem(slot.slotId);
    }
    // Also ensure legacy slots are cleared from localStorage
    SafeStorage.removeItem(DEFAULT_SAVE_SLOT);
    SafeStorage.removeItem(AUTO_SAVE_SLOT);
    SafeStorage.removeItem(EMERGENCY_SAVE_KEY);
    // Clear checkpoint slots from localStorage too
    for (const tier of CHECKPOINT_TIERS) {
      SafeStorage.removeItem(tier.slotKey);
    }

    // Wipe all saves from IndexedDB
    if (idbAvailable) {
      await IDBStorage.clearAllSaves();
    }
    
    SafeStorage.removeItem(SLOT_INDEX_KEY);
    SafeSession.removeItem(SESSION_CACHE_KEY);
    slotIndexCache = null;
    
    logger.info("All save games cleared");
  } catch (error) {
    logger.error("Error clearing all save games", { error });
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
  idbAvailable = await IDBStorage.isAvailable();
  logger.info('Save storage initialized', { indexedDB: idbAvailable });

  if (!idbAvailable) return;

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

/**
 * Returns whether IndexedDB is being used for save storage.
 * Useful for the UI to show storage status or debug info.
 */
export function isUsingIndexedDB(): boolean {
  return idbAvailable;
}

/**
 * Returns whether a given slot key belongs to a checkpoint tier.
 */
export function isCheckpointSlot(slotId: string): boolean {
  return slotId.startsWith(CHECKPOINT_PREFIX);
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
  // Checkpoint slot keys are already fully qualified (e.g., aralia_rpg_checkpoint_1min)
  if (slotName.startsWith(CHECKPOINT_PREFIX)) return slotName;
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
  
  // RALPH: Ghost Mitigation.
  // Filter out any entries from the index that no longer have a matching
  // payload. This prevents the UI from showing "Continue" buttons for saves
  // that were manually deleted or lost.
  // When IndexedDB is active, payloads live in IDB (not localStorage), so we
  // trust the persisted metadata index as authoritative. Ghost entries will
  // naturally fail during loadGame and can be cleaned up at that point.
  const validIndex = idbAvailable
    ? parsedIndex
    : parsedIndex.filter(slot => SafeStorage.getAllKeys().includes(slot.slotId));

  return mergeWithLegacySaves(validIndex).sort((a, b) => b.lastSaved - a.lastSaved);
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
