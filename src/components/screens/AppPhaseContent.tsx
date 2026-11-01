/** Chooses the existing screen container for each game phase. Reserved and retired phases retain their original fallback, and heavy previews remain lazy. State, actions and provider ownership stay in App. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 28/10/2026, 18:54:15
 * Dependents: App.tsx
 * Imports: 29 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React, { lazy, type Dispatch } from "react";
import { GamePhase, type Item, type Location, type NPC } from "../../types";
import type { GameState } from "../../types/state";
import type { AppAction } from "../../state/actionTypes";
import type { useAppPreferences } from "../../hooks/app/useAppPreferences";
import type { useAppCharacterEntry } from "../../hooks/app/useAppCharacterEntry";
import type { useAppAtlasRuntime } from "../../hooks/app/useAppAtlasRuntime";
import type { useAppAtlasEntry } from "../../hooks/app/useAppAtlasEntry";
import type { useAppWorldGeneration } from "../../hooks/app/useAppWorldGeneration";
import type { useAppDeveloperMenu } from "../../hooks/app/useAppDeveloperMenu";
import type { useGameInitialization } from "../../hooks/useGameInitialization";
import type { useGameActions } from "../../hooks/useGameActions";
import { createBattleEndActions } from "../../utils/combat/battleEndActions";
import { canUseDevTools, t } from "../../utils/core";
import { nextRulesEdition } from "../../config/rulesEdition";
import { applyCampaignDiceStream } from "../../config/saveScum";
import * as SaveLoadService from "../../services/saveLoadService";
import ErrorBoundary from "../ui/ErrorBoundary";
import { MainMenuScreen, CharacterCreatorScreen, BattleScreen, PlayingScreen } from "./index";

const GameOverScreen = lazy(() => import("./GameOverScreen"));
const LoadGameTransition = lazy(() =>
  import("../SaveLoad").then((module) => ({
    default: module.LoadGameTransition,
  })),
);
const NotFound = lazy(() => import("../ui/NotFound"));
const World3DDemo = lazy(() => import("../World3D/World3DDemo"));
const WebGPUProbe = lazy(() => import("../World3D/WebGPUProbe"));
const StartPointSelection = lazy(
  () => import("../Worldforge/StartPointSelection"),
);
// Spawn-on-land preview harness (?phase=spawnpreview) — lazy: pulls the ported-FMG
// generation stack like the cartographer demo, kept off the main bundle.
const SpawnPreview = lazy(() => import("../Worldforge/SpawnPreview"));
// Agent-sim motion preview (?phase=agentsim) — lazy: town/roster generation stack.
const AgentSimPreview = lazy(
  () => import("../Worldforge/AgentSimPreview"),
);
// Standalone 3D agent-walking proof (?phase=agentsim3d).
const AgentSim3DPreview = lazy(
  () => import("../Worldforge/AgentSim3DPreview"),
);
// Living-world town sim chronicle preview (?phase=livingworld).
const LivingWorldPreview = lazy(
  () => import("../Worldforge/LivingWorldPreview"),
);
// Combat Messaging Demo handles mock logging events to visualize unified messages in dev mode.
const CombatMessagingDemo = lazy(() =>
  import("../demo/CombatMessagingDemo").then((module) => ({
    default: module.CombatMessagingDemo,
  })),
);
interface AppPhaseContentProps {
  gameState: GameState; dispatch: Dispatch<AppAction>;
  preferences: ReturnType<typeof useAppPreferences>;
  characterEntry: ReturnType<typeof useAppCharacterEntry>;
  atlasRuntime: ReturnType<typeof useAppAtlasRuntime>;
  atlasEntry: ReturnType<typeof useAppAtlasEntry>;
  worldGeneration: ReturnType<typeof useAppWorldGeneration>;
  developerMenu: ReturnType<typeof useAppDeveloperMenu>;
  initialization: ReturnType<typeof useGameInitialization>;
  currentLocationData: Location; npcs: NPC[]; itemsInCurrentLocation: Item[];
  isUIInteractive: boolean;
  processAction: ReturnType<typeof useGameActions>["processAction"];
  addMessage: (text: string, sender?: "system" | "player" | "npc") => void;
  handleCombatRoundElapsed: (seconds: number) => void;
  handleOpenGlossary: (initialTermId?: string) => void;
  handleTransitionComplete: () => void;
  handleGoBackFromMainMenu: () => void;
}

export function AppPhaseContent({ gameState, dispatch, preferences, characterEntry, atlasRuntime, atlasEntry, worldGeneration, developerMenu, initialization, currentLocationData, npcs, itemsInCurrentLocation, isUIInteractive, processAction, addMessage, handleCombatRoundElapsed, handleOpenGlossary, handleTransitionComplete, handleGoBackFromMainMenu }: AppPhaseContentProps) {
  const { autoSaveEnabled, combatDifficulty, rulesEdition, allowSaveScum } = preferences;
  const { handleExitCharacterCreatorToMainMenu, pendingCharacterName, handleCharacterCreated, handleStartTownConfirmed, handleStartSelectionBack, handleClearAllSaves, handleAbandonRun } = characterEntry;
  const { setAtlasGroundDrilldown, activeAtlasGroundDrilldown, safeWorldViewMode } = atlasRuntime;
  const { handleEnterPlayingGroundFromAtlas } = atlasEntry;
  const { hasStoredSaveGame, hasActiveRunInMemory, canRegenerateWorldMap, worldGenerationLockedReason, handleOpenWorldGenerationFromMainMenu, handleNewGame } = worldGeneration;
  const { handleOpenDevMenuFromMainMenu, handleNavigateToGlossaryFromTooltip } = developerMenu;
  const { handleLoadGameFlow, handleSkipCharacterCreator } = initialization;
  let mainContent: React.ReactNode = null;
  // --- Phase-Based Rendering ---

  if (gameState.phase === GamePhase.MAIN_MENU) {
    // Render the Main Menu: New Game, Load Game, etc.
    const prevPhase: GamePhase | undefined = gameState.previousPhase;
    // Error and terminal recovery are one-way boundaries. Offering Return for
    // either phase recreates the 404/game-over screen immediately after the
    // player has explicitly returned to safety.
    const canGoBack =
      prevPhase !== undefined &&
      prevPhase !== GamePhase.MAIN_MENU &&
      prevPhase !== GamePhase.NOT_FOUND &&
      prevPhase !== GamePhase.GAME_OVER;
    mainContent = (
      <MainMenuScreen
        onNewGame={handleNewGame}
        rulesEdition={rulesEdition}
        // The main menu is outside the gameplay action pipeline (no party, no
        // location), so this setting dispatches the reducer action directly.
        onCycleRulesEdition={() => dispatch({ type: 'SET_RULES_EDITION', payload: nextRulesEdition(rulesEdition) })}
        allowSaveScum={allowSaveScum}
        onToggleSaveScum={() => {
          const next = !allowSaveScum;
          dispatch({ type: 'SET_ALLOW_SAVE_SCUM', payload: next });
          applyCampaignDiceStream({ ...gameState, allowSaveScum: next });
        }}
        onLoadGame={handleLoadGameFlow}
        // Chronicle saves the retained expedition, not the title screen. A
        // defeat or combat return cannot replace the pre-fight checkpoint.
        onSaveGame={hasActiveRunInMemory && prevPhase === GamePhase.PLAYING ? async (slotId, displayName, isAutoSave) => {
          const result = await SaveLoadService.saveGame(
            { ...gameState, phase: GamePhase.PLAYING }, slotId, undefined, { displayName, isAutoSave },
          );
          if (!result.success) throw new Error(result.message || 'The journey could not be saved.');
          if (typeof result.diceSaveCounter === 'number') {
            dispatch({ type: 'SET_DICE_SAVE_COUNTER', payload: result.diceSaveCounter });
          }
          dispatch({ type: 'ADD_NOTIFICATION', payload: { type: 'success', message: result.message || 'Journey saved.' } });
        } : undefined}
        // Arrow function wrapper prevents React's onClick event from being passed as initialTermId
        onShowCompendium={() => handleOpenGlossary()}
        hasSaveGame={hasStoredSaveGame}
        latestSaveTimestamp={SaveLoadService.getLatestSaveTimestamp()}
        isDevDummyActive={canUseDevTools()}
        onSkipCharacterCreator={handleSkipCharacterCreator}
        onClearAllSaves={handleClearAllSaves}
        hasActiveRun={hasActiveRunInMemory}
        onAbandonRun={handleAbandonRun}
        onOpenWorldGeneration={handleOpenWorldGenerationFromMainMenu}
        isWorldGenerationLocked={!canRegenerateWorldMap}
        worldGenerationLockedReason={worldGenerationLockedReason ?? undefined}
        // The main-menu Dev Menu button now reuses the same shared modal as gameplay,
        // but it preserves the current Dev Mode flag instead of force-enabling it.
        onOpenDevMenu={handleOpenDevMenuFromMainMenu}
        onGoBack={canGoBack ? handleGoBackFromMainMenu : undefined}
        canGoBack={canGoBack}
      />
    );
  } else if (gameState.phase === GamePhase.CHARACTER_CREATION) {
    // Render the Character Creator interface
    mainContent = (
      <CharacterCreatorScreen
        onCharacterCreate={(character, inventory) =>
          handleCharacterCreated(character, inventory)
        }
        onExitToMainMenu={handleExitCharacterCreatorToMainMenu}
        dispatch={dispatch}
      />
    );
  } else if (gameState.phase === GamePhase.WORLD3D_DEMO) {
    // `?phase=world3d&ground=1` remains an explicit developer reconstruction
    // harness. Player-facing Atlas descent routes through PLAYING and its exact
    // receipt; production builds must not expose this approximation shortcut.
    mainContent = canUseDevTools() ? (
      <ErrorBoundary fallbackMessage="An error occurred in the 3D Sandbox.">
        <World3DDemo />
      </ErrorBoundary>
    ) : (
      <NotFound
        onReturnToMainMenu={() =>
          dispatch({ type: "SET_GAME_PHASE", payload: GamePhase.MAIN_MENU })
        }
      />
    );
  } else if (gameState.phase === GamePhase.WEBGPU_PROBE) {
    // WebGPU render probe (?phase=webgpuprobe): the streamed ground world drawn
    // through three.js WebGPURenderer to prove the migration path.
    mainContent = (
      <ErrorBoundary fallbackMessage="An error occurred in the WebGPU Probe.">
        <WebGPUProbe />
      </ErrorBoundary>
    );
  } else if (gameState.phase === GamePhase.WORLDFORGE_DEMO) {
    // Keep the enum branch as a save-compatible fail-closed boundary. URL
    // parsing rejects every legacy spelling, and no in-app command dispatches
    // this phase; an old persisted value therefore reaches safety instead of
    // mounting the retired canvas world-map route.
    mainContent = (
      <NotFound
        onReturnToMainMenu={() =>
          dispatch({ type: "SET_GAME_PHASE", payload: GamePhase.MAIN_MENU })
        }
      />
    );
  } else if (gameState.phase === GamePhase.START_POINT_SELECTION) {
    // Start Point Selection (?phase=startselect): after character creation, the
    // player picks a TOWN in the generated world to begin in (spawn is always a
    // settlement). Confirming boots into play spawning at the chosen town.
    mainContent = (
      <ErrorBoundary fallbackMessage="An error occurred while choosing your starting point.">
        <StartPointSelection
          worldSeed={gameState.worldSeed}
          characterName={pendingCharacterName}
          onConfirm={handleStartTownConfirmed}
          onBack={handleStartSelectionBack}
        />
      </ErrorBoundary>
    );
  } else if (gameState.phase === GamePhase.SPAWN_PREVIEW) {
    // Spawn-on-land audit harness (?phase=spawnpreview): reproduces the reroll→spawn
    // marker pipeline in isolation so an ocean spawn is visible + reproducible.
    mainContent = (
      <ErrorBoundary fallbackMessage="An error occurred in the Spawn Preview.">
        <SpawnPreview />
      </ErrorBoundary>
    );
  } else if (gameState.phase === GamePhase.AGENTSIM_PREVIEW) {
    // Agent-sim motion preview (?phase=agentsim): demo burg + roster with townsfolk
    // walking the streets between home and work as the clock scrubs the day.
    mainContent = (
      <ErrorBoundary fallbackMessage="An error occurred in the Agent-Sim Preview.">
        <AgentSimPreview />
      </ErrorBoundary>
    );
  } else if (gameState.phase === GamePhase.AGENTSIM_3D_PREVIEW) {
    // Standalone 3D agent-walking proof (?phase=agentsim3d): <GroundAgents> in a
    // real R3F scene over a demo town, reachable without the Enter-3D game chain.
    mainContent = (
      <ErrorBoundary fallbackMessage="An error occurred in the Agent-Sim 3D Preview.">
        <AgentSim3DPreview />
      </ErrorBoundary>
    );
  } else if (gameState.phase === GamePhase.LIVING_WORLD_PREVIEW) {
    // Living-world town sim preview (?phase=livingworld): a demo town aged N years
    // with its Town Chronicle + current institution-holders rendered.
    mainContent = (
      <ErrorBoundary fallbackMessage="An error occurred in the Living-World Preview.">
        <LivingWorldPreview />
      </ErrorBoundary>
    );
  } else if (gameState.phase === GamePhase.COMBAT_MESSAGING_DEMO) {
    // Render the unified Combat Messaging System Demo
    mainContent = (
      <ErrorBoundary fallbackMessage="An error occurred in the Combat Messaging Demo.">
        <CombatMessagingDemo
          onExit={() =>
            dispatch({ type: "SET_GAME_PHASE", payload: GamePhase.MAIN_MENU })
          }
        />
      </ErrorBoundary>
    );
  } else if (gameState.phase === GamePhase.COMBAT) {
    // Render the full Combat View via the BattleScreen container
    mainContent = (
      <BattleScreen
        party={gameState.party}
        enemies={gameState.currentEnemies || []}
        currentLocationBiomeId={gameState.extractedBattleMap?.dungeonEncounter ? "dungeon" : currentLocationData.biomeId}
        onRoundElapsed={handleCombatRoundElapsed}
        onBattleEnd={(result, rewards, finalPartyState, finalEnemyState, outcomeReview) => {
          addMessage(
            result === "victory"
              ? "Victory! The enemies are defeated."
              : result === "flee" ? "The party retreats from battle." : "Defeat! The party has fallen.",
            "system",
          );
          // Source-authored enemy results settle before combat teardown so
          // WorldForge can still validate the exact tactical map and roster.
          // Defeat then enters GAME_OVER; victory resumes exploration.
          for (const action of createBattleEndActions(
            result,
            rewards,
            finalPartyState,
            finalEnemyState,
            gameState.extractedBattleMap?.dungeonEncounter?.encounterId,
            outcomeReview,
          ))
            dispatch(action);
        }}
      />
    );
  } else if (
    gameState.phase === GamePhase.PLAYING &&
    gameState.party.length > 0
  ) {
    // Render the Main Game Layout (Exploration Mode) via the PlayingScreen container
    mainContent = (
      <PlayingScreen
        gameState={gameState}
        currentLocation={currentLocationData}
        npcs={npcs}
        itemsInCurrentLocation={itemsInCurrentLocation}
        isUIInteractive={isUIInteractive}
        autoSaveEnabled={autoSaveEnabled}
        combatDifficulty={combatDifficulty}
        rulesEdition={rulesEdition}
        allowSaveScum={allowSaveScum}
        activeAtlasGroundDrilldown={activeAtlasGroundDrilldown}
        safeWorldViewMode={safeWorldViewMode}
        onAction={processAction}
        onNavigateToGlossary={handleNavigateToGlossaryFromTooltip}
        onEnterPlayingGroundFromAtlas={handleEnterPlayingGroundFromAtlas}
        onTransitionComplete={handleTransitionComplete}
        onAtlasRestored={() => {
          // Release only render objects. The compact address and matching meters
          // remain the authority for this earned journey while viewing its map.
          setAtlasGroundDrilldown(null);
        }}
        onTalkToNpc={(npcId) =>
          processAction({
            type: "talk",
            label: "Talk",
            payload: { targetNpcId: npcId },
            targetId: npcId,
          })
        }
      />
    );
  } else if (gameState.phase === GamePhase.GAME_OVER) {
    mainContent = <GameOverScreen gameState={gameState} title={t("app.game_over")}
      onRestore={loaded => dispatch({type: "LOAD_GAME_SUCCESS", payload: loaded})}
      onReturnToMainMenu={handleAbandonRun} />;
  } else if (
    gameState.phase === GamePhase.LOAD_TRANSITION &&
    gameState.party[0]
  ) {
    mainContent = <LoadGameTransition character={gameState.party[0]} />;
  } else if (gameState.phase === GamePhase.NOT_FOUND) {
    mainContent = (
      <NotFound
        onReturnToMainMenu={() =>
          dispatch({ type: "SET_GAME_PHASE", payload: GamePhase.MAIN_MENU })
        }
      />
    );
  }

  return mainContent;
}
