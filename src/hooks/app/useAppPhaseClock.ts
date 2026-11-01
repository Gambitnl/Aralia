/** Advances the welcome screen and exploration clock. Combat time still belongs to round callbacks; the original modal gates and timer cleanup are preserved. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 25/10/2026, 01:23:21
 * Dependents: App.tsx
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { useEffect, type Dispatch } from "react";
import type { GameState } from "../../types/state";
import type { AppAction } from "../../state/actionTypes";
import { GamePhase } from "../../types";
import { shouldPassiveGameClockRun } from "../../utils/core/timekeeperUtils";

export function useAppPhaseClock(
  gameState: GameState,
  dispatch: Dispatch<AppAction>,
  missingChoiceModal: { isOpen: boolean },
) {
  useEffect(() => {
    // This effect handles the timed transition from the welcome screen to the main game.
    if (gameState.phase === GamePhase.LOAD_TRANSITION) {
      const timer = setTimeout(() => {
        dispatch({ type: "SET_GAME_PHASE", payload: GamePhase.PLAYING });
      }, 2000); // 2-second duration for the welcome screen
      return () => clearTimeout(timer);
    }
  }, [gameState.phase, dispatch]);

  useEffect(() => {
    let timerId: number | undefined;

    // Passive time belongs to free exploration only. Combat time now advances
    // through round-completion callbacks, and blocking modals such as encounter
    // prep pause the ticker because the player is not taking world actions.
    const shouldClockRun = shouldPassiveGameClockRun({
      phase: gameState.phase,
      isLoading: gameState.isLoading,
      isImageLoading: gameState.isImageLoading,
      isCharacterSheetOpen: gameState.characterSheetModal.isOpen,
      // Atlas is a full map surface even without the ordinary map modal.
      // Reading routes pauses passive time; committed travel still charges its
      // explicit elapsed time, and returning to 3D resumes normal exploration.
      isMapVisible: gameState.isMapVisible ||
        (gameState.worldViewMode === 'atlas' && gameState.mapSurface === 'worldforge'),
      isDevMenuVisible: gameState.isDevMenuVisible,
      isGeminiLogViewerVisible: gameState.isGeminiLogViewerVisible,
      isDiscoveryLogVisible: gameState.isDiscoveryLogVisible,
      isGlossaryVisible: gameState.isGlossaryVisible,
      isEncounterModalVisible: gameState.isEncounterModalVisible,
      isNpcTestModalVisible: gameState.isNpcTestModalVisible,
      isLogbookVisible: gameState.isLogbookVisible,
      isGameGuideVisible: gameState.isGameGuideVisible,
      isInvestmentBoardVisible: gameState.isInvestmentBoardVisible,
      isMerchantModalOpen: gameState.merchantModal.isOpen,
      isMissingChoiceModalOpen: missingChoiceModal.isOpen,
      isRestModalOpen: gameState.isLongRestModalVisible || gameState.isShortRestModalVisible,
      isLodgingOfferOpen: Boolean(gameState.lodgingOffer),
    });

    if (shouldClockRun) {
      timerId = window.setInterval(() => {
        dispatch({ type: "ADVANCE_TIME", payload: { seconds: 1 } });
      }, 1000);
    }

    return () => {
      if (timerId) {
        window.clearInterval(timerId);
      }
    };
  }, [
    gameState.phase,
    gameState.isLoading,
    gameState.isImageLoading,
    gameState.characterSheetModal.isOpen,
    gameState.isMapVisible,
    gameState.worldViewMode,
    gameState.mapSurface,
    gameState.isDevMenuVisible,
    gameState.isGeminiLogViewerVisible,
    gameState.isDiscoveryLogVisible,
    gameState.isGlossaryVisible,
    gameState.isEncounterModalVisible,
    gameState.isNpcTestModalVisible,
    gameState.isLogbookVisible,
    gameState.isGameGuideVisible,
    gameState.isInvestmentBoardVisible,
    gameState.merchantModal.isOpen,
    gameState.isLongRestModalVisible,
    gameState.isShortRestModalVisible,
    gameState.lodgingOffer,
    missingChoiceModal.isOpen,
    dispatch,
  ]);

}
