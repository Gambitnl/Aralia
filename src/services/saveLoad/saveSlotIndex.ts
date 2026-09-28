/**
 * Copyright (c) 2024 Aralia RPG.
 * Licensed under the MIT License.
 *
 * @file saveSlotIndex.ts
 * The slot metadata index that the Load/Save UI reads synchronously: the
 * in-memory and sessionStorage caches, the cross-tab storage listener, slot
 * key resolution, and the legacy single-slot merge.
 * 
 * This module never imports saveLoadCore. Payload writes call into the index
 * (core -> index), never the other way around, which is the direction the
 * split packet required to keep the two acyclic.
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
 * Dependents: services/saveLoad/saveLoadCore.ts, services/saveLoad/saveStorageInit.ts, services/saveLoadService.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { GameState } from '../../types';
import { SafeSession, SafeStorage, logger, safeJSONParse } from '../../utils/core';
import {
  AUTO_SAVE_SLOT,
  CHECKPOINT_PREFIX,
  DEFAULT_SAVE_SLOT,
  SESSION_CACHE_KEY,
  SLOT_INDEX_KEY,
  SLOT_PREFIX,
} from './saveLoadConstants';
import type { SaveSlotSummary, StoredSavePayload } from './saveLoadConstants';
import { extractPreview, isUsingIndexedDB } from './saveLoadHelpers';

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

/**
 * Drops the in-memory slot cache. clearAllSaves (saveLoadCore) used to assign
 * `slotIndexCache = null` directly; the cache is module-private here, so the
 * same reset is exposed as a call. Behavior is unchanged.
 */
export function clearSlotIndexCache(): void {
  slotIndexCache = null;
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
export function resolveSlotKey(slotName: string, isAutoSave?: boolean): string {
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

export function upsertSlotMetadata(summary: SaveSlotSummary) {
  try {
    const current = getSaveSlots().filter(slot => slot.slotId !== summary.slotId);
    const next = [...current, summary].sort((a, b) => b.lastSaved - a.lastSaved);
    persistSlotIndex(next);
  } catch (error) {
    logger.error("Error updating save slot metadata index", { error });
  }
}

export function removeSlotMetadata(slotId: string) {
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
  const validIndex = isUsingIndexedDB()
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
