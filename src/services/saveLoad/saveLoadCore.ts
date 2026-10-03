/**
 * Copyright (c) 2024 Aralia RPG.
 * Licensed under the MIT License.
 *
 * @file saveLoadCore.ts
 * Save payload I/O: saveGame, loadGame, the metadata-backed existence and
 * timestamp reads, and the delete/clear paths. Load-time healing of older
 * saves (party Hit Dice pools, discovery log, player cell, atlas ground
 * address, dungeon ledger, rest tracker) stays here, next to the read it
 * guards.
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
 * Imports: 13 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { GameState, GamePhase } from '../../types';
import { buildHitPointDicePools, normalizeClassLevels } from '../../utils/character';
import { getGameDay } from '../../utils/core';
import { createEmptyHistory } from '../../utils/world';
import { SafeStorage, SafeSession } from '../../utils/core';
import { safeJSONParse } from '../../utils/core';
import { logger } from '../../utils/core';
import { simpleHash } from '../../utils/core';
import * as IDBStorage from '../indexedDBStorageService';
import {
  advanceDiceSaveCounter,
  applyCampaignDiceStream,
  getAllowSaveScum,
} from '@/config/saveScum';
import { migratePlayerCell } from '@/state/migrations/playerCellMigration';
import { countUnreadDiscoveryEntries, retainDiscoveryLogEntries } from '@/state/reducers/logReducer';
import { normalizeAtlasGroundAddress } from '@/systems/worldforge/leaf3d/atlasGroundDrilldown';
import {
  normalizeAtlasGroundPosition,
  normalizeDiscoveredHiddenSites,
} from '@/systems/worldforge/leaf3d/atlasGroundContinuity';
import { normalizeDungeonExpeditionLedger } from '@/systems/worldforge/dungeon/world/dungeonLifecycle';
import {
  AUTO_SAVE_SLOT,
  CHECKPOINT_PREFIX,
  CHECKPOINT_TIERS,
  DEFAULT_SAVE_SLOT,
  EMERGENCY_SAVE_KEY,
  SAVE_GAME_VERSION,
  SESSION_CACHE_KEY,
  SLOT_INDEX_KEY,
} from './saveLoadConstants';
import type {
  NotifyFn,
  SaveGameOptions,
  SaveLoadResult,
  StoredSavePayload,
} from './saveLoadConstants';
import {
  calculatePlaytimeSeconds,
  extractPreview,
  isUsingIndexedDB,
  normalizeLoadedDates,
  resetSessionTimer,
} from './saveLoadHelpers';
import {
  clearSlotIndexCache,
  getSaveSlots,
  removeSlotMetadata,
  resolveSlotKey,
  upsertSlotMetadata,
} from './saveSlotIndex';

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
    // agora-f821.63: every save advances the campaign's dice counter. With
    // save-scumming off, this number (mixed with worldSeed) is the base seed the
    // load path installs, so the SAME save always replays the SAME dice while two
    // saves taken from the same moment still get different streams.
    const diceSaveCounter = advanceDiceSaveCounter(gameState);
    const stateToSave: GameState = {
      ...gameState,
      saveVersion: SAVE_GAME_VERSION,
      saveTimestamp: Date.now(),
      allowSaveScum: getAllowSaveScum(gameState),
      diceSaveCounter,
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
    if (isUsingIndexedDB()) {
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
      storage: isUsingIndexedDB() ? 'IndexedDB' : 'localStorage',
      timestamp: new Date(stateToSave.saveTimestamp!).toISOString()
    });

    const result = { success: true, message: "Game saved successfully.", diceSaveCounter } as const;
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
    // Record the store that supplied this exact payload. Availability alone is
    // not enough: an IndexedDB-capable browser may still recover a legacy or
    // emergency copy from localStorage when the primary record is absent.
    let storageUsed: 'IndexedDB' | 'localStorage' = 'localStorage';
    if (isUsingIndexedDB()) {
      serializedState = await IDBStorage.getSave(storageKey);
      if (serializedState) storageUsed = 'IndexedDB';
    }
    if (!serializedState) {
      // Check localStorage as fallback (pre-migration saves, emergency saves,
      // or IndexedDB-unavailable mode).
      serializedState = SafeStorage.getItem(storageKey);
      storageUsed = 'localStorage';
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
    // Native Atlas Wave 2 uses its own additive schema version inside GameState,
    // so the global save format stays backward-compatible. Missing legacy data
    // and malformed/future address versions both become an explicit null.
    const rawAtlasGroundAddress = loadedState.atlasGroundAddress;
    loadedState.atlasGroundAddress = normalizeAtlasGroundAddress(rawAtlasGroundAddress);
    loadedState.atlasGroundPosition = loadedState.atlasGroundAddress
      ? normalizeAtlasGroundPosition(
          loadedState.atlasGroundPosition,
          loadedState.atlasGroundAddress,
        )
      : null;
    // Hidden pins use an additive schema inside the existing saved array.
    // Classic entries survive; Atlas entries with corrupt/future provenance
    // fail closed before either map surface can render them.
    loadedState.discoveredHiddenSites = normalizeDiscoveredHiddenSites(
      loadedState.discoveredHiddenSites,
    );
    // Dungeon expedition saves are keyed by the canonical entrance id. Legacy saves become an
    // empty ledger; malformed cross-key receipts are dropped rather than attaching progress to a
    // different world site. Completed receipts also heal the older ecology cleared-path list.
    loadedState.dungeonExpeditions = normalizeDungeonExpeditionLedger(
      loadedState.dungeonExpeditions,
    );
    const completedDungeonPaths = Object.values(loadedState.dungeonExpeditions)
      .filter((expedition) => expedition.completion === 'completed')
      .map((expedition) => expedition.identity.seedPath);
    loadedState.clearedDungeons = [
      ...new Set([...(loadedState.clearedDungeons ?? []), ...completedDungeonPaths]),
    ];
    if (rawAtlasGroundAddress != null && loadedState.atlasGroundAddress === null) {
      // A corrupt native-Atlas address cannot safely use the ordinary cell-centred
      // 3D fallback. Return to the cartographer; legacy saves with no address are
      // intentionally unaffected and retain their established Classic behavior.
      loadedState.worldViewMode = 'atlas';
      loadedState.mapSurface = 'worldforge';
      loadedState.playerGroundPos = null;
      loadedState.atlasGroundPosition = null;
    }
    // Ensure new rest pacing fields exist when loading older saves.
    const restTrackerSeedTime = loadedState.gameTime instanceof Date
      ? loadedState.gameTime
      : new Date(loadedState.gameTime);
    loadedState.shortRestTracker = {
      restsTakenToday: loadedState.shortRestTracker?.restsTakenToday ?? 0,
      lastRestDay: loadedState.shortRestTracker?.lastRestDay ?? getGameDay(restTrackerSeedTime),
      lastRestEndedAtMs: loadedState.shortRestTracker?.lastRestEndedAtMs ?? null,
    };
    // agora-f821.63: this is the one gate every campaign passes through on its
    // way from storage into play, so it is where the dice stream is pinned. With
    // the setting on (the default, and what every pre-setting save carries) this
    // call does nothing and the log keeps its clock seed.
    applyCampaignDiceStream(loadedState);

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
      storage: storageUsed,
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
    if (isUsingIndexedDB()) {
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
    if (isUsingIndexedDB()) {
      await IDBStorage.clearAllSaves();
    }
    
    SafeStorage.removeItem(SLOT_INDEX_KEY);
    SafeSession.removeItem(SESSION_CACHE_KEY);
    clearSlotIndexCache();
    
    logger.info("All save games cleared");
  } catch (error) {
    logger.error("Error clearing all save games", { error });
  }
}
