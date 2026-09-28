/**
 * Copyright (c) 2024 Aralia RPG.
 * Licensed under the MIT License.
 *
 * @file saveLoadHelpers.ts
 * Preview extraction, date normalization, playtime accounting, and the two
 * pieces of module-local runtime state that outlived the single-file layout:
 * the session-start marker and the IndexedDB availability flag.
 *
 * WHY the IndexedDB flag lives here and not in saveStorageInit.ts: it is set
 * by initializeStorage (saveStorageInit) but read by BOTH saveLoadCore and
 * saveSlotIndex.buildSlotIndex, while saveStorageInit itself needs
 * saveSlotIndex.getSaveSlots for the emergency save. Holding the flag in this
 * leaf module keeps that triangle acyclic instead of creating the
 * core <-> slot-index import cycle the split packet warned about.
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
 * Dependents: services/saveLoad/saveLoadCore.ts, services/saveLoad/saveSlotIndex.ts, services/saveLoad/saveStorageInit.ts, services/saveLoadService.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { GameState } from '../../types';
import type { SavePreview, SaveSlotSummary } from './saveLoadConstants';

// Tracks whether IndexedDB is available for save payloads. Set once during
// initialization. When false, the service falls back to localStorage-only mode.
let idbAvailable = false;

// Tracks when the current play session last started or resumed so we can
// measure incremental playtime in real-world seconds instead of relying on
// the in-game clock (which advances independently of player presence).
let sessionStartedAtMs = Date.now();

/**
 * Returns whether IndexedDB is being used for save storage.
 * Useful for the UI to show storage status or debug info.
 */
export function isUsingIndexedDB(): boolean {
  return idbAvailable;
}

/**
 * Records whether IndexedDB is usable for save payloads. Only
 * saveStorageInit.initializeStorage calls this; it exists because the flag
 * moved into this module (see the file header) and can no longer be assigned
 * across module boundaries.
 */
export function setIndexedDbAvailable(available: boolean): void {
  idbAvailable = available;
}

/**
 * Builds preview data (location, party level, playtime) from the latest GameState snapshot.
 */
export function extractPreview(state: GameState, playtimeSeconds?: number): SavePreview {
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
export function normalizeLoadedDates(loadedState: GameState) {
  if (loadedState.gameTime && !(loadedState.gameTime instanceof Date)) {
    loadedState.gameTime = new Date(loadedState.gameTime);
  }
}

export function calculatePlaytimeSeconds(existingSlot?: SaveSlotSummary): number {
  // Carry forward any previously recorded playtime and add the time accrued
  // since the current session began. This keeps the metric grounded in
  // real-world elapsed time instead of the in-game calendar.
  const alreadyRecorded = existingSlot?.playtimeSeconds ?? 0;
  const sessionElapsedSeconds = Math.max(0, Math.floor((Date.now() - sessionStartedAtMs) / 1000));
  return alreadyRecorded + sessionElapsedSeconds;
}

export function resetSessionTimer(startTimeMs: number = Date.now()) {
  sessionStartedAtMs = startTimeMs;
}
