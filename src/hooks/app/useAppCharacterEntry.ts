/** Holds a finished character only while a starting town is chosen, then calls the existing game initializer. Save clearing stays awaited and abandonment still uses its reducer action. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 25/10/2026, 01:42:47
 * Dependents: App.tsx, components/screens/AppPhaseContent.tsx
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { useCallback, useRef, useState } from "react";
import type { Dispatch } from "react";
import type { GameState } from "../../types/state";
import type { AppAction } from "../../state/actionTypes";
import { GamePhase, type PlayerCharacter, type Item } from "../../types";
import type { useGameInitialization } from "../useGameInitialization";
import * as SaveLoadService from "../../services/saveLoadService";

export function useAppCharacterEntry(gameState: GameState, dispatch: Dispatch<AppAction>, startGame: ReturnType<typeof useGameInitialization>["startGame"]) {
  const handleExitCharacterCreatorToMainMenu = useCallback(() => {
    dispatch({ type: "SET_GAME_PHASE", payload: GamePhase.MAIN_MENU });
  }, [dispatch]);

  // Holds the freshly-created character + inventory while the player chooses a
  // start town (Start Point Selection), before startGame boots into play.
  const pendingNewGameRef = useRef<{
    character: PlayerCharacter;
    inventory: Item[];
  } | null>(null);

  // The pending build remains event-only in the ref. Its display name is a
  // render snapshot, updated in the same batch as the phase transition.
  const [pendingCharacterName, setPendingCharacterName] = useState<string | undefined>();

  // Character creation finished → hold the build and let the player pick where in
  // the world to begin (a town), rather than auto-dropping them at the capital.
  const handleCharacterCreated = useCallback(
    (character: PlayerCharacter, inventory: Item[]) => {
      pendingNewGameRef.current = { character, inventory };
      setPendingCharacterName(character.name);
      dispatch({
        type: "SET_GAME_PHASE",
        payload: GamePhase.START_POINT_SELECTION,
      });
    },
    [dispatch],
  );

  // Player confirmed a start town → boot into play spawning at that town.
  const handleStartTownConfirmed = useCallback(
    (town: {
      atlasCellId: number;
      name?: string;
      stateName?: string;
      x?: number;
      y?: number;
    }) => {
      const pending = pendingNewGameRef.current;
      if (!pending) {
        // No pending character (e.g. a reload landed here) — bounce to creation.
        dispatch({
          type: "SET_GAME_PHASE",
          payload: GamePhase.CHARACTER_CREATION,
        });
        return;
      }
      pendingNewGameRef.current = null;
      setPendingCharacterName(undefined);
      // Cell-native 3D entry: carry the chosen burg's POSITION so the first 3D entry
      // frames the town (cells are far larger than the Locale window). Threaded
      // through startGame → START_GAME_SUCCESS so it's set atomically with the spawn
      // (a separate dispatch would be clobbered by the reducer's state rebuild).
      startGame(pending.character, pending.inventory, gameState.worldSeed, {
        atlasCellId: town.atlasCellId,
        name: town.name,
        region: town.stateName,
        ...(town.x != null && town.y != null
          ? { centerPx: [town.x, town.y] as [number, number] }
          : {}),
      });
    },
    [dispatch, startGame, gameState.worldSeed],
  );

  // Back out of start selection to re-roll the character.
  const handleStartSelectionBack = useCallback(() => {
    pendingNewGameRef.current = null;
    setPendingCharacterName(undefined);
    dispatch({ type: "SET_GAME_PHASE", payload: GamePhase.CHARACTER_CREATION });
  }, [dispatch]);

  const handleClearAllSaves = useCallback(async () => {
    // Must be awaited: clearAllSaves only invalidates the slot-index cache after
    // the async IndexedDB wipe, so refreshing the menu before completion shows
    // the old saves and makes the wipe look like it needs two clicks.
    await SaveLoadService.clearAllSaves();
    dispatch({ type: "SET_GAME_PHASE", payload: GamePhase.MAIN_MENU });
  }, [dispatch]);

  const handleAbandonRun = useCallback(() => {
    dispatch({ type: "ABANDON_RUN" });
  }, [dispatch]);

  return { handleExitCharacterCreatorToMainMenu, pendingCharacterName, handleCharacterCreated, handleStartTownConfirmed, handleStartSelectionBack, handleClearAllSaves, handleAbandonRun };
}
