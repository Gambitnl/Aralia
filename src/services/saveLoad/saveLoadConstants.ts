/**
 * Copyright (c) 2024 Aralia RPG.
 * Licensed under the MIT License.
 *
 * @file saveLoadConstants.ts
 * Save-format constants, slot keys, checkpoint tiers, and the payload/summary
 * types shared by every other saveLoad module. This is the dependency-free
 * leaf of the group: it imports nothing from its siblings, which is what keeps
 * the core <-> slot-index pair acyclic.
 *
 * Split out of src/services/saveLoadService.ts on 2026-09-09 (board task
 * agora-907c.10, MOD-3.6). The code here is the original code, moved; the
 * old path stays a re-export barrel so no importer changed. What's preserved
 * and what changed is noted at each edited line.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 09/09/2026, 14:39:58
 * Dependents: services/saveLoad/saveLoadCore.ts, services/saveLoad/saveLoadHelpers.ts, services/saveLoad/saveSlotIndex.ts, services/saveLoad/saveStorageInit.ts, services/saveLoadService.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { GameState, NotificationType } from '../../types';

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

export type SavePreview = {
  locationName?: string;
  partyLevel?: number;
  playtimeSeconds?: number;
};

export interface StoredSavePayload {
  version: string;
  slotId: string;
  slotName: string;
  isAutoSave?: boolean;
  thumbnail?: string;
  preview?: SavePreview;
  state: GameState;
  checksum?: number;
}

export interface SaveGameOptions {
  displayName?: string;
  isAutoSave?: boolean;
  thumbnail?: string;
}

export const SAVE_GAME_VERSION = "0.1.0"; // Current version of the save format
export const DEFAULT_SAVE_SLOT = 'aralia_rpg_default_save';
export const AUTO_SAVE_SLOT = 'aralia_rpg_autosave';
export const SLOT_INDEX_KEY = 'aralia_rpg_save_slots_index';
export const SLOT_PREFIX = 'aralia_rpg_slot_';
export const SESSION_CACHE_KEY = 'aralia_rpg_slot_cache';

// Key used in localStorage to track whether saves have been migrated from
// localStorage to IndexedDB. Once set, migration won't re-run.
export const MIGRATION_FLAG_KEY = 'aralia_rpg_migrated_to_idb';

// Key for emergency saves written synchronously to localStorage during
// beforeunload when IndexedDB (which is async) can't complete in time.
export const EMERGENCY_SAVE_KEY = 'aralia_rpg_emergency_save';

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
export const CHECKPOINT_PREFIX = 'aralia_rpg_checkpoint_';

export const DEFAULT_SAVE_SLOT_KEY = DEFAULT_SAVE_SLOT;
export const AUTO_SAVE_SLOT_KEY = AUTO_SAVE_SLOT;

export interface SaveLoadResult {
  success: boolean;
  message?: string;
  data?: GameState;
  /**
   * The per-save dice counter this save wrote (agora-f821.63). Present on a
   * successful `saveGame` only. The caller dispatches it back into GameState so
   * the next save advances again instead of rewriting the same number.
   */
  diceSaveCounter?: number;
}

// Optional notifier empowers calling layers to surface status through NotificationSystem.
export type NotifyFn = (params: { message: string; type: NotificationType }) => void;
