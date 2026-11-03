/** Keeps the existing provider order and global overlays around the chosen phase screen. Modal focus, banter visibility, loading/error recovery and lazy overlay boundaries retain their original conditions. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 25/10/2026, 01:42:47
 * Dependents: App.tsx
 * Imports: 25 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React, { Suspense, lazy, type Dispatch } from "react";
import { GamePhase, type Item, type Location, type NPC, type Notification, type PlayerCharacter } from "../../types";
import type { GameState } from "../../types/state";
import type { AppAction } from "../../state/actionTypes";
import type { useAppAmbientDialogue } from "../../hooks/app/useAppAmbientDialogue";
import type { useAppDeveloperMenu } from "../../hooks/app/useAppDeveloperMenu";
import type { useAppWorldGeneration } from "../../hooks/app/useAppWorldGeneration";
import type { useAppAtlasEntry } from "../../hooks/app/useAppAtlasEntry";
import type { useAppTravelActions } from "../../hooks/app/useAppTravelActions";
import type { useGameActions } from "../../hooks/useGameActions";
import type { useMissingChoice } from "../../hooks/useMissingChoice";
import { AppProviders } from "../providers/AppProviders";
import { DataLoaderGate } from "../providers/DataLoaderGate";
import { GameProvider } from "../../state/GameContext";
import { canUseDevTools, t } from "../../utils/core";
import { Z_INDEX } from "../../styles/zIndex";
// GG-611 (2026-11-03): the perf overlay (about 86 KB) loads on demand, so the
// first page does not carry it. It still mounts only with dev mode on, in any
// build (Remy, 2026-09-30), so production keeps the overlay behind dev mode.
const PerfOverlay = lazy(() => import("../../devtools/perf/PerfOverlayHost").then((m) => ({ default: m.PerfOverlay })));
import { LoadingSpinner } from "../ui/LoadingSpinner";
import { ConversationPanel } from "../ConversationPanel";
import { OpeningSituationGate } from "../gameEntry/OpeningSituationGate";
import { CollapsibleBanterPanel } from "../ui/CollapsibleBanterPanel";
import { BanterAttentionBanner } from "../ui/BanterAttentionBanner";
import { DiceOverlay } from "../dice/DiceOverlay";

const NotificationSystem = lazy(() =>
  import("../ui/NotificationSystem").then((module) => ({
    default: module.NotificationSystem,
  })),
);
const CompanionReaction = lazy(() =>
  import("../ui/CompanionReaction").then((module) => ({
    default: module.CompanionReaction,
  })),
);
const GameModals = lazy(() => import("./GameModals"));
interface AppShellProps {
  gameState: GameState; dispatch: Dispatch<AppAction>; mainContent: React.ReactNode;
  ambientDialogue: ReturnType<typeof useAppAmbientDialogue>;
  developerMenu: ReturnType<typeof useAppDeveloperMenu>;
  worldGeneration: ReturnType<typeof useAppWorldGeneration>;
  missingChoice: ReturnType<typeof useMissingChoice>;
  currentLocationData: Location; npcs: NPC[]; itemsInCurrentLocation: Item[]; isUIInteractive: boolean;
  processAction: ReturnType<typeof useGameActions>["processAction"];
  handleTileClick: ReturnType<typeof useAppTravelActions>["handleTileClick"];
  handleEnter3DAtCell: ReturnType<typeof useAppAtlasEntry>["handleEnter3DAtCell"];
  handleOpenGlossary: (initialTermId?: string) => void;
  handleOpenCharacterSheet: (character: PlayerCharacter) => void;
  handleCloseCharacterSheet: () => void; handleClosePartyOverlay: () => void; handleDismissMember: (id: string) => void;
}

export function AppShell({ gameState, dispatch, mainContent, ambientDialogue, developerMenu, worldGeneration, missingChoice, currentLocationData, npcs, itemsInCurrentLocation, isUIInteractive, processAction, handleTileClick, handleEnter3DAtCell, handleOpenGlossary, handleOpenCharacterSheet, handleCloseCharacterSheet, handleClosePartyOverlay, handleDismissMember }: AppShellProps) {
  const { forceBanter, isBanterActive, isWaitingForNextLine, isGenerating, generatingSpeakerName, secondsUntilNextLine, playerInterrupt, endBanter, banterHistory, isPlayerDirected, isWaitingForPlayerResponse, playerResponseDeadlineSeconds, extendPlayerResponseDeadline, extendNpcLineDelay, isBanterPaused, setIsBanterPaused, setOllamaWarningDismissed } = ambientDialogue;
  const { handleDevMenuAction, handleModelChange, handleNavigateToGlossaryFromTooltip } = developerMenu;
  const { canRegenerateWorldMap, worldGenerationLockedReason, handleRegenerateWorldMap } = worldGeneration;
  const { missingChoiceModal, setMissingChoiceModal, handleConfirmMissingChoice, handleFixMissingChoice } = missingChoice;
  const notifications = (gameState.notifications as Notification[]) || [];
  const shouldLoadGlossaryData =
    gameState.phase !== GamePhase.MAIN_MENU || gameState.isGlossaryVisible;
  const shouldLoadSpellData = gameState.phase !== GamePhase.MAIN_MENU;
  const areNotificationsSuppressed = Boolean(
    // Blocking modal surfaces should own visual focus. Keep toast state intact,
    // but do not paint the stack through translucent logbook/glossary/window
    // backdrops where it competes with the player's current task.
    gameState.isMapVisible ||
    gameState.isQuestLogVisible ||
    gameState.characterSheetModal.isOpen ||
    (gameState.isDevMenuVisible && canUseDevTools()) ||
    gameState.isPartyOverlayVisible ||
    gameState.isLogbookVisible ||
    gameState.isDiscoveryLogVisible ||
    gameState.isGlossaryVisible ||
    gameState.isGameGuideVisible ||
    gameState.isEncounterModalVisible ||
    gameState.isDiceRollerVisible ||
    gameState.isGeminiLogViewerVisible ||
    gameState.isUnifiedLogViewerVisible ||
    gameState.isNpcTestModalVisible ||
    gameState.isInvestmentBoardVisible ||
    missingChoiceModal.isOpen ||
    gameState.isLongRestModalVisible ||
    gameState.isShortRestModalVisible ||
    gameState.isNoticeBoardVisible ||
    gameState.isBroadsheetVisible ||
    gameState.isEconomyLedgerVisible ||
    gameState.isCourierPouchVisible,
  );
  const isBanterCollapsedTabSuppressed = Boolean(
    // Modal windows claim the visual focus layer. The collapsed party-chat tab
    // remains available on the normal play surface, but it should not peek out
    // around logbook/glossary/window edges while a modal is open.
    gameState.isMapVisible ||
    gameState.isQuestLogVisible ||
    gameState.characterSheetModal.isOpen ||
    (gameState.isDevMenuVisible && canUseDevTools()) ||
    gameState.isPartyOverlayVisible ||
    gameState.isLogbookVisible ||
    gameState.isDiscoveryLogVisible ||
    gameState.isGlossaryVisible ||
    gameState.isGameGuideVisible ||
    gameState.isEncounterModalVisible ||
    gameState.isDiceRollerVisible ||
    gameState.isGeminiLogViewerVisible ||
    gameState.isUnifiedLogViewerVisible ||
    gameState.isNpcTestModalVisible ||
    gameState.isInvestmentBoardVisible ||
    missingChoiceModal.isOpen ||
    gameState.isLongRestModalVisible ||
    gameState.isShortRestModalVisible ||
    gameState.isNoticeBoardVisible ||
    gameState.isBroadsheetVisible ||
    gameState.isEconomyLedgerVisible ||
    gameState.isCourierPouchVisible ||
    gameState.gameEntry?.status === "generating" ||
    gameState.gameEntry?.status === "model-unavailable",
  );

  // --- Root Render ---
  // Wraps the application in <AppProviders> for context access.
  // Renders global notifications, the computed 'mainContent', and the manager for <GameModals>.
  return (
    <AppProviders
      loadGlossaryData={shouldLoadGlossaryData}
      loadSpellData={shouldLoadSpellData}
    >
      <GameProvider state={gameState} dispatch={dispatch}>
        <div className="App min-h-screen bg-gray-900">
          {/* The same performance display the design preview uses, so a reading
            * taken in a sandbox and a reading taken in the running game are the
            * same measurement. It starts as a small fps pill; Alt+P cycles it to
            * the full panel or off.
            *
            * ONLY WITH DEV MODE ON (Remy, 2026-09-30, questionnaire q1: "not in
            * the main game, unless dev mode is enabled"). Until then it showed in
            * every development build whatever the dev-mode setting said. Dev
            * mode starts on in a dev build and off in production
            * (initialState.ts), and SET_DEV_MODE_ENABLED turns it either way. In
            * a production build the probe is installed only when this mounts, so
            * a canvas built before dev mode came on is measured only if it
            * carries a PerfProbe (World3DScene does). */}
          {gameState.isDevModeEnabled && <Suspense fallback={null}><PerfOverlay /></Suspense>}

          <Suspense fallback={null}>
            <NotificationSystem
              notifications={areNotificationsSuppressed ? [] : notifications}
              dispatch={dispatch}
            />
          </Suspense>

          {/* Global Loading Spinner */}
          {(gameState.isLoading || gameState.isImageLoading) && (
            <LoadingSpinner
              message={
                gameState.loadingMessage ||
                (gameState.isImageLoading
                  ? t("app.ui.loading.image")
                  : t("app.ui.loading.default"))
              }
            />
          )}

          {/* Global Error Message Banner */}
          {gameState.error && (
            <div
              role="alert"
              // Tailwind cannot discover an interpolated numeric class. Apply
              // the existing error layer directly so fullscreen gameplay cannot
              // hide the failure or intercept its Dismiss control.
              style={{ zIndex: Z_INDEX.ERROR_OVERLAY }}
              className="bg-red-800 text-white p-4 fixed top-0 left-0 right-0 text-center"
            >
              {t("app.ui.error.message", { message: gameState.error })}
              <button
                onClick={() => dispatch({ type: "SET_ERROR", payload: null })}
                className="ml-4 bg-red-600 px-2 py-1 rounded"
              >
                {t("app.ui.error.dismiss")}
              </button>
            </div>
          )}

          {/* Primary View */}
          <Suspense fallback={<LoadingSpinner />}>
            {gameState.phase === GamePhase.MAIN_MENU ? (
              mainContent
            ) : (
              <DataLoaderGate>{mainContent}</DataLoaderGate>
            )}
          </Suspense>

          {/* Interactive Companion Conversation Panel */}
          {gameState.phase === GamePhase.PLAYING &&
            gameState.activeConversation && (
              <ConversationPanel gameState={gameState} dispatch={dispatch} />
            )}

          {/* Opening-situation entry gate (GAME-ENTRY-SITUATION): runs the
              generator and renders the generating overlay / honest model block. */}
          {gameState.phase === GamePhase.PLAYING && (
            <OpeningSituationGate
              gameState={gameState}
              dispatch={dispatch}
              onOllamaDontShowAgain={setOllamaWarningDismissed}
            />
          )}

          {/* Modal Manager: Handles all overlays (Inventory, Map, Logs, etc.) */}
          <Suspense fallback={null}>
            <GameModals
              gameState={gameState}
              dispatch={dispatch}
              onAction={processAction}
              onTileClick={handleTileClick}
              onEnter3DAtCell={handleEnter3DAtCell}
              playerWorldPos={gameState.playerWorldPos}
              allow3DEntry={gameState.phase === GamePhase.PLAYING}
              currentLocation={currentLocationData}
              npcsInLocation={npcs}
              itemsInLocation={itemsInCurrentLocation}
              isUIInteractive={isUIInteractive}
              missingChoiceModal={missingChoiceModal}
              onCloseMissingChoice={() =>
                setMissingChoiceModal({
                  isOpen: false,
                  character: null,
                  missingChoice: null,
                })
              }
              onConfirmMissingChoice={handleConfirmMissingChoice}
              onFixMissingChoice={handleFixMissingChoice}
              handleCloseCharacterSheet={handleCloseCharacterSheet}
              handleClosePartyOverlay={handleClosePartyOverlay}
              handleDismissMember={handleDismissMember}
              handleDevMenuAction={handleDevMenuAction}
              handleModelChange={handleModelChange}
              handleNavigateToGlossaryFromTooltip={
                handleNavigateToGlossaryFromTooltip
              }
              handleOpenGlossary={handleOpenGlossary}
              handleOpenCharacterSheet={handleOpenCharacterSheet}

              onForceBanterTrigger={forceBanter}
              onClearBanterLogs={() =>
                dispatch({ type: "CLEAR_BANTER_DEBUG_LOG" })
              }
              isBanterPaused={isBanterPaused}
              toggleBanterPause={() => setIsBanterPaused((prev) => !prev)}
              canRegenerateWorldMap={canRegenerateWorldMap}
              worldGenerationLockedReason={worldGenerationLockedReason}
              onRegenerateWorldMap={handleRegenerateWorldMap}
            />
          </Suspense>

          {/* Global Companion Reactions (hidden in the main exploration interface where log is visible) */}
          {(gameState.phase !== GamePhase.PLAYING || !isUIInteractive) && (
            <Suspense fallback={null}>
              <CompanionReaction
                companions={gameState.companions}
                latestMessage={
                  gameState.messages[gameState.messages.length - 1]
                }
              />
            </Suspense>
          )}

          {/* Banter Panel */}
          {gameState.phase === GamePhase.PLAYING && (
            <CollapsibleBanterPanel
              isActive={isBanterActive}
              isWaiting={isWaitingForNextLine}
              isGenerating={isGenerating}
              generatingSpeakerName={generatingSpeakerName}
              secondsRemaining={secondsUntilNextLine}
              history={banterHistory}
              archivedBanters={gameState.archivedBanters}
              companions={gameState.companions}
              onInterrupt={playerInterrupt}
              onEndBanter={endBanter}
              isPlayerDirected={isPlayerDirected}
              isWaitingForPlayerResponse={isWaitingForPlayerResponse}
              playerResponseDeadlineSeconds={playerResponseDeadlineSeconds}
              forceExpand={isPlayerDirected && isWaitingForPlayerResponse}
              onExtendDeadline={extendPlayerResponseDeadline}
              onExtendNpcDelay={extendNpcLineDelay}
              isBanterPaused={isBanterPaused}
              onToggleBanterPause={() => setIsBanterPaused((prev) => !prev)}
              suppressCollapsedTab={isBanterCollapsedTabSuppressed}
              avoidAtlasControls={gameState.worldViewMode === "atlas" && gameState.mapSurface === "worldforge"}
            />
          )}

          {/* Attention banner — floats at bottom-centre when an NPC addresses the player */}
          {/* WHAT CHANGED: Added the BanterAttentionBanner component. */}
          {/* WHY IT CHANGED: When an NPC speaks directly to the player, it's easy to miss 
              if the chat panel is collapsed. This banner provides a high-visibility 
              "call to action" that alerts the player they need to respond before 
               the deadline expires. */}
          {gameState.phase === GamePhase.PLAYING &&
            isBanterActive &&
            isPlayerDirected &&
            isWaitingForPlayerResponse && (
              <BanterAttentionBanner
                speakerName={
                  banterHistory[banterHistory.length - 1]?.speakerName
                }
                lastLine={banterHistory[banterHistory.length - 1]?.text}
                deadlineSeconds={playerResponseDeadlineSeconds}
                onExtendDeadline={extendPlayerResponseDeadline}
                onOpenChat={() => {
                  /* forceExpand already auto-opens the panel via its useEffect;
                     nothing extra needed here. */
                }}
              />
            )}

          {/* Global Dice Roller Overlay */}
          <DiceOverlay />
        </div>
      </GameProvider>
    </AppProviders>
  );
}
