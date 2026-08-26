/**
 * Copyright (c) 2024 Aralia RPG.
 * Licensed under the MIT License.
 *
 * @file saveLoadService.ts
 * Re-export barrel for the save/load service.
 *
 * The implementation was split into ./saveLoad/ on 2026-09-09 (board task
 * agora-907c.10, MOD-3.6) because this file had grown to 995 lines across
 * five unrelated concerns. This path did NOT move: it has eight named
 * dependents (App.tsx, the SaveLoad components, MainMenu, the autosave and
 * initialization hooks, handleSystemAndUi, appState) and stays the single
 * public entry point, exporting exactly the same 21 symbols it did before.
 *
 * Where the code went:
 *   ./saveLoad/saveLoadCore.ts      save/load/delete/clear payload I/O
 *   ./saveLoad/saveSlotIndex.ts     slot metadata index + cross-tab sync
 *   ./saveLoad/saveStorageInit.ts   IndexedDB bootstrap, migration, emergency save
 *   ./saveLoad/saveLoadHelpers.ts   preview/playtime/date helpers + runtime flags
 *   ./saveLoad/saveLoadConstants.ts slot keys, checkpoint tiers, shared types
 *
 * Behavior is unchanged, including the module-load side effect: importing
 * this module still registers the cross-tab storage listener, because
 * saveSlotIndex.ts calls setupSlotIndexStorageSync() at load as before.
 *
 * See src/services/saveLoad.README.md for the full service documentation.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * RE-EXPORT BRIDGE / MIDDLEMAN: Forwards exports to another file.
 *
 * Last Sync: 09/09/2026, 14:39:58
 * Dependents: App.tsx, components/SaveLoad/LoadGameModal.tsx, components/SaveLoad/SaveSlotSelector.tsx, components/layout/MainMenu.tsx, hooks/actions/handleSystemAndUi.ts, hooks/useAutoSave.ts, hooks/useGameInitialization.ts, state/appState.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

export { CHECKPOINT_TIERS, DEFAULT_SAVE_SLOT_KEY, AUTO_SAVE_SLOT_KEY } from './saveLoad/saveLoadConstants';
export type {
  CheckpointTierConfig,
  SaveLoadResult,
  SaveSlotSummary,
} from './saveLoad/saveLoadConstants';

export {
  clearAllSaves,
  deleteSaveGame,
  getLatestSaveTimestamp,
  hasSaveGame,
  loadGame,
  saveGame,
} from './saveLoad/saveLoadCore';

export {
  getSaveSlots,
  getSlotStorageKey,
  isCheckpointSlot,
  refreshSaveSlotIndex,
  setupSlotIndexStorageSync,
  teardownSlotIndexStorageSync,
} from './saveLoad/saveSlotIndex';

export { emergencySaveSync, initializeStorage } from './saveLoad/saveStorageInit';

export { isUsingIndexedDB } from './saveLoad/saveLoadHelpers';
