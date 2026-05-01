// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 01/05/2026, 01:35:50
 * Dependents: App.tsx
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file decides when Aralia's passive exploration clock is allowed to tick.
 *
 * It does not own or mutate world time. App.tsx asks this helper whether the
 * one-second exploration timer should run, then the app still advances time by
 * dispatching ADVANCE_TIME into the normal worldReducer pipeline.
 *
 * Called by: App.tsx passive clock effect
 * Depends on: GamePhase so combat, menus, and exploration can be distinguished
 */
import { GamePhase } from '../../types';

// ============================================================================
// Passive Clock State
// ============================================================================
// This shape contains only the UI and phase flags that can pause passive time.
// Keeping it narrow makes the rule easy to test without creating another world
// clock or importing the entire game state into this utility.
// ============================================================================
export interface PassiveGameClockState {
  phase: GamePhase;
  isLoading: boolean;
  isImageLoading: boolean;
  isCharacterSheetOpen: boolean;
  isMapVisible: boolean;
  isSubmapVisible: boolean;
  isDevMenuVisible: boolean;
  isGeminiLogViewerVisible: boolean;
  isDiscoveryLogVisible: boolean;
  isGlossaryVisible: boolean;
  isEncounterModalVisible: boolean;
  isNpcTestModalVisible: boolean;
  isLogbookVisible: boolean;
  isGameGuideVisible: boolean;
  isMerchantModalOpen: boolean;
  isMissingChoiceModalOpen: boolean;
}

// ============================================================================
// Passive Clock Gate
// ============================================================================
// Passive time represents exploration breathing room, so it only runs while the
// player is actively in PLAYING and no blocking overlay is taking focus. Combat
// is intentionally excluded because combat reports elapsed world time in full
// six-second rounds through ADVANCE_TIME instead of the real-time ticker.
// ============================================================================
export const shouldPassiveGameClockRun = (state: PassiveGameClockState): boolean => {
  // If the player is not in the normal exploration phase, the passive clock must
  // stay stopped. This is the guard that keeps COMBAT from also receiving the
  // one-second real-time ticker.
  if (state.phase !== GamePhase.PLAYING) {
    return false;
  }

  // Encounter prep is a blocking modal: the player is deciding whether to enter
  // combat, not spending world time. Pausing here matches the same interaction
  // lock already used by App.tsx and avoids a hidden pre-combat time leak.
  return !state.isLoading &&
    !state.isImageLoading &&
    !state.isCharacterSheetOpen &&
    !state.isMapVisible &&
    !state.isSubmapVisible &&
    !state.isDevMenuVisible &&
    !state.isGeminiLogViewerVisible &&
    !state.isDiscoveryLogVisible &&
    !state.isGlossaryVisible &&
    !state.isEncounterModalVisible &&
    !state.isNpcTestModalVisible &&
    !state.isLogbookVisible &&
    !state.isGameGuideVisible &&
    !state.isMerchantModalOpen &&
    !state.isMissingChoiceModalOpen;
};
