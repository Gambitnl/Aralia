/**
 * Copyright (c) 2024 Aralia RPG.
 * Licensed under the MIT License.
 *
 * @file App.tsx
 * EXECUTION FLOW SEGMENT 2: Root Application Component
 *
 * This is the root component of the Aralia RPG application, loaded by index.tsx.
 * It manages all game state, phases (menu, character creation, gameplay), and orchestrates
 * the rendering of all other components.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 25/10/2026, 01:42:47
 * Dependents: None (Orphan)
 * Imports: 34 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This is the master coordinator for the entire game UI.
 *
 * It holds the primary game state (via useReducer) and chooses which "view"
 * the player sees — whether it's the main menu, the character creator, or
 * the world map. It also manages global overlays like the dice roller and
 * notification systems.
 *
 * Called by: index.tsx (entry point)
 * Depends on: appReducer.ts for logic, useGameInitialization for boot sequence,
 * and dozens of specialized UI components.
 */

// ============================================================================
// Imports
// ============================================================================
// React hooks - useReducer for complex state management, useCallback for memoized functions,
// useEffect for side effects
import React, { useReducer, useCallback, useEffect } from "react";
import { GameMessage, Item, PlayerCharacter, GamePhase } from "./types";
import { AppPhaseContent } from "./components/screens/AppPhaseContent";
// State management - appReducer handles all state updates via actions, initialGameState provides defaults
import { appReducer } from "./state/appState";
import { initialGameState } from "./state/initialState";
// Custom hooks - encapsulate reusable logic for audio, game actions, and initialization
import { useAudio } from "./hooks/useAudio";
import { useGameActions } from "./hooks/useGameActions";
import { useGameHotkeys } from "./hooks/useGameHotkeys";
import { useGameInitialization } from "./hooks/useGameInitialization";
import { useOllamaLogBridge } from "./hooks/useOllamaLogBridge";
import { useAppDeveloperCombatFixtures } from "./hooks/app/useAppDeveloperCombatFixtures";
import { useAppLocationView } from "./hooks/app/useAppLocationView";
import { useAppTravelActions } from "./hooks/app/useAppTravelActions";
import { useAppPhaseClock } from "./hooks/app/useAppPhaseClock";
import { useAppLoadingWatchdog } from "./hooks/app/useAppLoadingWatchdog";
import { useAppDeveloperProbe } from "./hooks/app/useAppDeveloperProbe";
import { useAppAtlasRuntime } from "./hooks/app/useAppAtlasRuntime";
import { useAppAtlasEntry } from "./hooks/app/useAppAtlasEntry";
import { useAppCharacterEntry } from "./hooks/app/useAppCharacterEntry";
import { useAppWorldGeneration } from "./hooks/app/useAppWorldGeneration";
import { useAppDeveloperMenu } from "./hooks/app/useAppDeveloperMenu";
import { AppShell } from "./components/layout/AppShell";
import { useAppAmbientDialogue } from "./hooks/app/useAppAmbientDialogue";
import { useAppPreferences } from "./hooks/app/useAppPreferences";
import { useHistorySync } from "./hooks/useHistorySync";
import { isDummyAutoStartDeepLink } from "./routes";

import { useMissingChoice } from "./hooks/useMissingChoice";

// Utility functions

// Context providers - wrap the app to provide glossary and spell data to all child components

import { applyWfSpawnToMap } from "@/systems/worldforge/local/resolveSpawn";
import { wfBiomeIndexToLegacyId } from "@/systems/worldforge/local/wfBiomeToLegacy";

import { isWildernessLocationId } from "./utils/location/cellLocationId";
import { canUseDevTools } from "./utils/core";
import { validateEnv } from "./config/env";

import { applyZIndexCssVariables } from "./styles/zIndex";

import * as SaveLoadService from "./services/saveLoadService";

// Lazy load large components to reduce initial bundle size
// Grid retirement: the legacy 2D village view (TownCanvas) is retired — town
// entry is the cell-native 3D town (Enter-3D on the world map). No lazy import.
// THE RENDERER PROBE, development builds only (2026-09-29). Module scope, so it
// is installed before any 3D screen can build a renderer: it then measures
// every three.js canvas the game draws, not only the ones with a PerfProbe.
// GG-611 (2026-11-03): a dynamic import, so a production build drops the probe
// from the first page. It resolves long before a player opens a 3D screen.
if (import.meta.env.DEV) void import("./devtools/perf/rendererProbe").then((m) => m.installPerfAutoProbe());

// --- Decoupled Developer Tools Registry ---
// Some developer tools have been decoupled from the main application bundle to
// optimize production builds and prevent build-time dependencies on local-only files.
//
// Access these tools directly via their entry points:
// - Design Preview: /Aralia/misc/design.html
// - Developer Hub:  /Aralia/misc/dev_hub.html (Central landing page)
// -------------------------------------------

// ============================================================================
// Main Component
// ============================================================================

const App: React.FC = () => {
  // Validate environment variables on startup
  useEffect(() => {
    validateEnv();
  }, []);

  useEffect(() => {
    applyZIndexCssVariables();
  }, []);

  const [gameState, dispatch] = useReducer(appReducer, initialGameState);

  const atlasRuntime = useAppAtlasRuntime(gameState, dispatch);
  const { setAtlasGroundDrilldown } = atlasRuntime;

  // Mirror every Ollama task call into the in-app log viewer via the central
  // sink (see useOllamaLogBridge). One subscription covers all AI traffic.
  useOllamaLogBridge(dispatch);

  const preferences = useAppPreferences(gameState, dispatch);
  const { itemsById } = preferences;

  // 🏹 Ranger: Sync GamePhase with URL history
  useHistorySync(gameState, dispatch);

  const ambientDialogue = useAppAmbientDialogue(gameState, dispatch);

  const addMessage = useCallback(
    (text: string, sender: "system" | "player" | "npc" = "system") => {
      const newMessage: GameMessage = {
        id: Date.now() + Math.random(),
        text,
        sender,
        // Stamped with in-game time by the ADD_MESSAGE reducer; this real-world
        // value is a placeholder that the reducer overrides.
        timestamp: new Date(),
      };
      dispatch({ type: "ADD_MESSAGE", payload: newMessage });
    },
    [],
  );

  // State for Missing Choice Modal
  const missingChoice = useMissingChoice(dispatch, addMessage);
  const { missingChoiceModal } = missingChoice;

  const { playPcmAudio, cleanupAudioContext } = useAudio(addMessage);

  // Cleanup effect: This ensures that when the component unmounts (e.g., user closes the app),
  // we properly clean up the audio context to prevent memory leaks.
  // Memory leaks happen when resources like audio contexts aren't properly released,
  // causing the browser to hold onto memory that can't be used anymore.
  useEffect(() => {
    // The return function here is the "cleanup function" - React calls it when the component unmounts
    return () => {
      cleanupAudioContext();
    };
  }, [cleanupAudioContext]); // Only re-run if cleanupAudioContext function changes

  useAppLoadingWatchdog(gameState, dispatch, addMessage);

  const { getCurrentLocation, getCurrentNPCs, getTileTooltipText } =
    useAppLocationView(gameState);

  const { processAction } = useGameActions({
    gameState,
    dispatch,
    addMessage,
    playPcmAudio,
    getCurrentLocation,
    getCurrentNPCs,
    getTileTooltipText,
  });

  const initialization = useGameInitialization({ dispatch, addMessage, worldSeed: gameState.worldSeed });
  const {
    handleNewGame: initializeNewGame,
    handleSkipCharacterCreator,
    handleLoadGameFlow,
    startGame,
    handleLegacyDummyAutoStart,
  } = initialization;

  useEffect(() => {
    return () => {
      cleanupAudioContext();
    };
  }, [cleanupAudioContext]);

  useAppDeveloperProbe(gameState, dispatch);

  // Dev dummy auto-start — now OPT-IN. A brand-new player (no save) must land on
  // the Main Menu and go through New Game → character creation → start selection
  // (the real first-run experience), instead of being silently dropped into a
  // pre-built dummy party. Devs who want the fast start add ?dummy=1 (or
  // ?devstart=1). Still gated by canUseDevTools() so it can never fire in prod.
  useEffect(() => {
    if (!canUseDevTools()) return;
    if (gameState.phase !== GamePhase.MAIN_MENU) return;
    if (gameState.party.length > 0 || gameState.messages.length > 0) return;
    if (SaveLoadService.hasSaveGame()) return;

    // Guard: a REAL phase deep-link takes precedence — let useHistorySync handle
    // it instead of auto-starting the dummy party. This fixes the cold-load bounce
    // where ?phase=world3d would intermittently get overridden to MAIN_MENU →
    // PLAYING. We must ignore `?phase=main_menu`, though: history-sync reflects the
    // current MAIN_MENU phase back into the URL, and treating that as a deep-link
    // would wrongly suppress the ?dummy=1 opt-in below.
    const urlParams = new URLSearchParams(window.location.search);
    const urlPhase = urlParams.get("phase");
    if (urlPhase && urlPhase !== "main_menu") return; // real deep-link wins

    // Without the explicit opt-in flag, do nothing: the Main Menu stays up.
    if (!isDummyAutoStartDeepLink()) return;

    handleLegacyDummyAutoStart();
  }, [
    gameState.phase,
    gameState.party,
    gameState.messages.length,
    handleLegacyDummyAutoStart,
  ]);

  useAppDeveloperCombatFixtures(gameState, dispatch, addMessage, processAction);

  useAppPhaseClock(gameState, dispatch, missingChoiceModal);

  const handleCombatRoundElapsed = useCallback(
    (seconds: number) => {
      // Combat reports elapsed time in completed D&D rounds, but the world still
      // changes through the same ADVANCE_TIME action used by waiting, travel,
      // resting, crafting, and passive exploration.
      dispatch({ type: "ADVANCE_TIME", payload: { seconds } });
    },
    [dispatch],
  );

  const handleOpenGlossary = useCallback(
    (initialTermId?: string) => {
      if (initialTermId) {
        dispatch({
          type: "SET_GLOSSARY_TERM_FOR_MODAL",
          payload: initialTermId,
        });
      }
      processAction({
        type: "TOGGLE_GLOSSARY_VISIBILITY",
        label: "Toggle Glossary",
        payload: { initialTermId },
      });
    },
    [dispatch, processAction],
  );

  const characterEntry = useAppCharacterEntry(gameState, dispatch, startGame);

  const { handleTileClick } = useAppTravelActions(gameState, dispatch, addMessage);

  const atlasEntry = useAppAtlasEntry(gameState, dispatch, addMessage, setAtlasGroundDrilldown);
  const { handleEnter3DAtCell } = atlasEntry;

  const handleOpenCharacterSheet = useCallback(
    (character: PlayerCharacter) => {
      dispatch({ type: "OPEN_CHARACTER_SHEET", payload: character });
    },
    [dispatch],
  );

  const handleCloseCharacterSheet = useCallback(() => {
    dispatch({ type: "CLOSE_CHARACTER_SHEET" });
  }, [dispatch]);

  const handleClosePartyOverlay = useCallback(() => {
    dispatch({ type: "TOGGLE_PARTY_OVERLAY" });
  }, [dispatch]);

  const handleDismissMember = useCallback(
    (id: string) => {
      dispatch({ type: "DISMISS_PARTY_MEMBER", payload: { memberId: id } });
    },
    [dispatch],
  );

  const handleTransitionComplete = useCallback(() => {
    // Transition complete — player now has control in 3D world.
  }, []);

  const worldGeneration = useAppWorldGeneration(gameState, dispatch, initializeNewGame);
  const { handleNewGame } = worldGeneration;

  const developerMenu = useAppDeveloperMenu(gameState, dispatch, handleNewGame, processAction, handleLoadGameFlow, handleSkipCharacterCreator);

  // --- Main Content Rendering Logic ---
  // The 'mainContent' variable determines the primary view of the application based on the current 'gamePhase'.
  // This approach keeps the return statement clean and focused on high-level structure.
  const currentLocationData = getCurrentLocation();
  const npcs = getCurrentNPCs();
  // Resolve the items present at the current location. Named locations read their
  // authored `itemIds`; procedural coord_ tiles have none, so their items come from
  // `dynamicLocationItemIds` (populated by "Search the Area" foraging). Either way
  // the result feeds the Take buttons + take_item handler, which key off the same map.
  const itemsInCurrentLocation: Item[] = (() => {
    if (!itemsById) return [];
    const locId = currentLocationData.id;
    const ids = isWildernessLocationId(locId)
      ? (gameState.dynamicLocationItemIds[locId] ?? [])
      : (currentLocationData.itemIds ?? []);
    return ids.map((id) => itemsById[id]).filter(Boolean) as Item[];
  })();

  // Determine if the UI should be interactive based on modal/loading states.
  // This boolean is passed down to disable controls when overlays are active.
  const isUIInteractive =
    !gameState.isLoading &&
    !gameState.isImageLoading &&
    // Rest and room commitments hold the party in place while their rules run.
    !gameState.lodgingOffer &&
    !gameState.isLongRestModalVisible &&
    !gameState.isShortRestModalVisible &&
    !gameState.characterSheetModal.isOpen &&
    !gameState.isMapVisible &&
    !gameState.isDevMenuVisible &&
    !gameState.isGeminiLogViewerVisible &&
    !gameState.isDiscoveryLogVisible &&
    !gameState.isGlossaryVisible &&
    !gameState.isPartyEditorVisible &&
    !gameState.isPartyOverlayVisible &&
    !gameState.isEncounterModalVisible &&
    !gameState.isNpcTestModalVisible &&
    !gameState.isLogbookVisible &&
    !gameState.isQuestLogVisible &&
    !gameState.isGameGuideVisible &&
    !gameState.isInvestmentBoardVisible &&
    !gameState.merchantModal.isOpen &&
    !gameState.isEconomyLedgerVisible &&
    !gameState.isCourierPouchVisible &&
    !missingChoiceModal.isOpen;

  // Global exploration keyboard shortcuts (M: map, C: character, Q: quests…).
  // MUST stay below `isUIInteractive`: called above its declaration the whole
  // app threw "Cannot access 'isUIInteractive' before initialization" on every
  // render and no screen ever mounted.
  useGameHotkeys({
    gameState,
    dispatch,
    onAction: processAction,
    disabled: Boolean(gameState.isLoading || gameState.isImageLoading),
  });

  const handleGoBackFromMainMenu = useCallback(() => {
    const prevPhase: GamePhase | undefined = gameState.previousPhase;
    if (prevPhase !== undefined && prevPhase !== GamePhase.MAIN_MENU) {
      dispatch({ type: "SET_GAME_PHASE", payload: prevPhase });
    }
  }, [gameState.previousPhase, dispatch]);

  const mainContent = <AppPhaseContent
    gameState={gameState} dispatch={dispatch} preferences={preferences}
    characterEntry={characterEntry} atlasRuntime={atlasRuntime} atlasEntry={atlasEntry}
    worldGeneration={worldGeneration} developerMenu={developerMenu} initialization={initialization}
    currentLocationData={currentLocationData} npcs={npcs} itemsInCurrentLocation={itemsInCurrentLocation}
    isUIInteractive={isUIInteractive} processAction={processAction} addMessage={addMessage}
    handleCombatRoundElapsed={handleCombatRoundElapsed} handleOpenGlossary={handleOpenGlossary}
    handleTransitionComplete={handleTransitionComplete} handleGoBackFromMainMenu={handleGoBackFromMainMenu}
  />;

  return <AppShell
    gameState={gameState} dispatch={dispatch} mainContent={mainContent}
    ambientDialogue={ambientDialogue} developerMenu={developerMenu} worldGeneration={worldGeneration} missingChoice={missingChoice}
    currentLocationData={currentLocationData} npcs={npcs} itemsInCurrentLocation={itemsInCurrentLocation} isUIInteractive={isUIInteractive}
    processAction={processAction} handleTileClick={handleTileClick} handleEnter3DAtCell={handleEnter3DAtCell}
    handleOpenGlossary={handleOpenGlossary} handleOpenCharacterSheet={handleOpenCharacterSheet}
    handleCloseCharacterSheet={handleCloseCharacterSheet} handleClosePartyOverlay={handleClosePartyOverlay} handleDismissMember={handleDismissMember}
  />;
};

export default App;
