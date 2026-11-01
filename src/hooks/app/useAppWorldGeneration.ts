/** Owns menu world-generation permissions and the seed-only new-game handoff. Existing saves and active parties still lock regeneration; deep links retain their one-shot gate and phase titles retain the route registry. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 25/10/2026, 01:42:47
 * Dependents: App.tsx, components/layout/AppShell.tsx, components/screens/AppPhaseContent.tsx
 * Imports: 8 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { useCallback, useRef, useEffect } from "react";
import type { Dispatch } from "react";
import type { GameState } from "../../types/state";
import type { AppAction } from "../../state/actionTypes";
import { GamePhase } from "../../types";
import { LOCATIONS } from "../../data/world/locations";
import * as SaveLoadService from "../../services/saveLoadService";
import { generateWorldSeed } from "../../utils/random/generateWorldSeed";
import { isWorldGenDeepLink, getPhaseTitle } from "../../routes";
import type { useGameInitialization } from "../useGameInitialization";

export function useAppWorldGeneration(gameState: GameState, dispatch: Dispatch<AppAction>, initializeNewGame: ReturnType<typeof useGameInitialization>["handleNewGame"]) {
  const hasStoredSaveGame = SaveLoadService.hasSaveGame();
  const hasActiveRunInMemory = gameState.party.length > 0;
  const canRegenerateWorldMap = !hasStoredSaveGame && !hasActiveRunInMemory;
  const worldGenerationLockedReason = hasActiveRunInMemory
    ? "World generation is locked while an active game session is in memory."
    : hasStoredSaveGame
      ? "World generation is locked because save data exists. Clear saves to unlock it."
      : null;

  const buildDynamicLocationItemSnapshot = useCallback((): Record<
    string,
    string[]
  > => {
    const snapshot: Record<string, string[]> = {};
    Object.values(LOCATIONS).forEach((loc) => {
      snapshot[loc.id] = loc.itemIds ? [...loc.itemIds] : [];
    });
    return snapshot;
  }, []);

  const createWorldFromSeed = useCallback(
    (seed: number) => {
      const normalizedSeed =
        Number.isFinite(seed) && seed > 0
          ? Math.floor(seed)
          : generateWorldSeed();
      // Grid retirement: the world IS the atlas derived from the seed
      // (`getBridgeAtlas(seed)`); there is no 30x20 mapData grid to generate or
      // store. Setting the seed regenerates the map view (MapPane reads the atlas
      // from worldSeed) and re-resolves the cell-native spawn at game start.
      dispatch({ type: "SET_WORLD_SEED", payload: normalizedSeed });
      return { seed: normalizedSeed };
    },
    [dispatch],
  );

  const handleRegenerateWorldMap = useCallback(
    (requestedSeed?: number) => {
      if (!canRegenerateWorldMap) {
        dispatch({
          type: "ADD_NOTIFICATION",
          payload: {
            type: "warning",
            message:
              worldGenerationLockedReason ||
              "World generation is currently locked.",
          },
        });
        return;
      }

      const seedToUse =
        Number.isFinite(requestedSeed) && (requestedSeed ?? 0) > 0
          ? Math.floor(requestedSeed as number)
          : generateWorldSeed();
      const { seed } = createWorldFromSeed(seedToUse);
      dispatch({
        type: "ADD_NOTIFICATION",
        payload: {
          type: "success",
          message: `World regenerated with seed ${seed}.`,
        },
      });
    },
    [
      canRegenerateWorldMap,
      createWorldFromSeed,
      dispatch,
      worldGenerationLockedReason,
    ],
  );

  const handleOpenWorldGenerationFromMainMenu = useCallback(() => {
    // Grid retirement: "world generated yet?" is now "do we have a world seed?"
    // (the atlas is derived from the seed; there is no mapData grid).
    if (!(Number.isFinite(gameState.worldSeed) && gameState.worldSeed > 0)) {
      createWorldFromSeed(generateWorldSeed());
    }

    if (!gameState.isMapVisible) {
      dispatch({ type: "TOGGLE_MAP_VISIBILITY" });
    }
    if (!canRegenerateWorldMap && worldGenerationLockedReason) {
      dispatch({
        type: "ADD_NOTIFICATION",
        payload: {
          type: "warning",
          message: worldGenerationLockedReason,
        },
      });
    }
  }, [
    canRegenerateWorldMap,
    createWorldFromSeed,
    dispatch,
    gameState.isMapVisible,
    gameState.worldSeed,
    worldGenerationLockedReason,
  ]);

  // ?worldmap=1 — boot straight into the World Map (world-generation) page, the
  // same view the main-menu "World Generation" button opens. Gives that view its
  // own deep link (like ?phase=character_creation for the creator), so the world
  // map / travel preview is reachable without clicking through the menu.
  const worldMapDeepLinkRef = useRef(false);
  useEffect(() => {
    if (worldMapDeepLinkRef.current) return;
    if (gameState.phase !== GamePhase.MAIN_MENU) return;
    if (!isWorldGenDeepLink()) return;
    worldMapDeepLinkRef.current = true;
    handleOpenWorldGenerationFromMainMenu();
  }, [gameState.phase, handleOpenWorldGenerationFromMainMenu]);

  // Give each phase a descriptive browser-tab name (e.g. "Aralia — Worldforge
  // Atlas"), so tabs are distinguishable. getPhaseTitle() lives in routes.ts,
  // the same source the URL Directory reads, so titles stay consistent.
  useEffect(() => {
    document.title = getPhaseTitle(gameState.phase);
  }, [gameState.phase]);

  const handleNewGame = useCallback(() => {
    // Grid retirement: carry the previewed world by SEED (the atlas source), not a
    // mapData grid. A seed present means the World Generation menu set one up.
    if (
      canRegenerateWorldMap &&
      Number.isFinite(gameState.worldSeed) &&
      gameState.worldSeed > 0
    ) {
      dispatch({
        type: "START_NEW_GAME_SETUP",
        payload: {
          dynamicLocationItemIds: buildDynamicLocationItemSnapshot(),
          worldSeed: gameState.worldSeed,
        },
      });
      return;
    }

    initializeNewGame();
  }, [
    buildDynamicLocationItemSnapshot,
    canRegenerateWorldMap,
    dispatch,
    gameState.worldSeed,
    initializeNewGame,
  ]);

  return { hasStoredSaveGame, hasActiveRunInMemory, canRegenerateWorldMap, worldGenerationLockedReason, handleRegenerateWorldMap, handleOpenWorldGenerationFromMainMenu, handleNewGame };
}
