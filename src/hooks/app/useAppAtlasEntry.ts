/** Commits initial 3D entry, explicit current-position return and reviewed Atlas journeys.
 * Inspection cannot discard a live body; exact artifacts stay transient and only
 * compact addresses enter saves. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 28/10/2026, 11:26:14
 * Dependents: App.tsx, components/layout/AppShell.tsx, components/screens/AppPhaseContent.tsx
 * Imports: 10 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { useCallback, type SetStateAction } from "react";
import type { Dispatch } from "react";
import type { GameState } from "../../types/state";
import type { AppAction } from "../../state/actionTypes";
import { GamePhase, type WorldCellView } from "../../types";
import { atlasGroundAddressFromDrilldown, type AtlasGroundDrilldown } from "../../systems/worldforge/leaf3d/atlasGroundDrilldown";
import { burgIdForCell } from "../../systems/worldforge/townsim/chronicleForLocation";
import { determineActiveDynamicNpcsForLocation } from "@/utils/spatial";
import { LOCATIONS } from "../../data/world/locations";
import { makeCellLocationId } from "../../utils/location/cellLocationId";

import { useAppTravelActions } from "./useAppTravelActions";
import { prepareLocalJourneyBattlefield, quoteLocalGroundJourney, type LocalJourneyQuote } from "../../systems/worldforge/travel/localGroundJourney";

export function useAppAtlasEntry(
  gameState: GameState, dispatch: Dispatch<AppAction>,
  addMessage: (text: string, sender?: "system" | "player" | "npc") => void,
  setAtlasGroundDrilldown: Dispatch<SetStateAction<AtlasGroundDrilldown | null>>,
) {
  const { handleTileClick } = useAppTravelActions(gameState, dispatch, addMessage);
  /**
   * Atlas "Enter 3D" mode: place the player in the streamed world at the clicked cell.
   */
  const handleEnter3DAtCell = useCallback(
    (
      _x: number,
      _y: number,
      cell: WorldCellView,
      anchor?: import("../../types/state").Entry3DAnchor,
      resumeCurrentPosition = false,
    ) => {
      if (!cell.discovered) {
        addMessage(
          "You cannot enter the 3D world in undiscovered areas.",
          "system",
        );
        return;
      }

      // An inspected cell is not a paid arrival. Reuse normal world travel for
      // another cell, and the reviewed native Local journey for another focus.
      // Returning the reason also lets the open map show it beside its controls.
      const targetCellId = anchor?.cellId ?? cell.cellId;
      if (gameState.phase === GamePhase.PLAYING && gameState.playerCell?.cellId != null &&
          targetCellId !== gameState.playerCell.cellId) {
        const reason = 'Travel to that area on the world map before entering 3D.';
        addMessage(reason, 'system');
        return reason;
      }

      // Returning from the map resumes the accepted body, including its height
      // and native Local lineage. Only explicit My Location resumes that body;
      // inspection focus cannot reset it or replace an unmounted Local receipt.
      if (resumeCurrentPosition && anchor &&
        anchor.cellId === gameState.playerCell?.cellId &&
        gameState.currentLocationId === makeCellLocationId(anchor.cellId) &&
        gameState.playerGroundPos &&
        (!gameState.atlasGroundAddress || (
          gameState.atlasGroundAddress.worldSeed === gameState.worldSeed &&
          gameState.atlasGroundAddress.atlasCellId === anchor.cellId))) {
        dispatch({ type: "SET_WORLD_VIEW_MODE", payload: "3d" });
        if (gameState.isMapVisible) dispatch({ type: "TOGGLE_MAP_VISIBILITY" });
        addMessage("Returning to your position in the 3D world.", "system");
        return;
      }

      if (gameState.phase === GamePhase.PLAYING &&
          (gameState.playerGroundPos || gameState.atlasGroundAddress)) {
        const reason = 'Your position is unchanged. Use 3D at My Location to return, or open Atlas explorer to review a journey.';
        addMessage(reason, 'system');
        return reason;
      }

      // First ground entry after a real arrival, or pre-game inspection, keeps
      // its existing setup. A playing body/receipt cannot reach this reset path.
      // 3D entry is an atomic location transition, not just a render hint. A
      // selected explored cell must become the canonical playerCell/location too,
      // otherwise saves, NPC context and hidden discoveries describe the old cell
      // while the loader renders the new one.
      if (anchor) {
        const targetLocationId = makeCellLocationId(anchor.cellId);
        if (
          gameState.playerCell?.cellId !== anchor.cellId ||
          gameState.currentLocationId !== targetLocationId
        ) {
          dispatch({
            type: "MOVE_PLAYER",
            payload: {
              newLocationId: targetLocationId,
              activeDynamicNpcIds: determineActiveDynamicNpcsForLocation(
                targetLocationId,
                LOCATIONS,
              ),
              destinationCell: { cellId: anchor.cellId, anchor },
            },
          });
        } else {
          dispatch({ type: "SET_ENTRY_3D_ANCHOR", payload: anchor });
        }
        // Locale meters belong to the old cell; the destination ground session
        // will establish a fresh local position after it loads.
        dispatch({
          type: "SET_PLAYER_GROUND_POS",
          payload: { position: null },
        });
        // Living-world sim: if the entered cell holds a town, start tracking its
        // history. Resolved straight from the cell — no grid tile lookup.
        const burgId = burgIdForCell(gameState.worldSeed ?? 0, anchor.cellId);
        if (burgId !== undefined) {
          dispatch({ type: "TOWNSIM_REGISTER_BURG", payload: { burgId } });
        }
      }
      // The legacy continent position is vestigial, but keep its compatibility
      // value at the origin while the cell-native anchor frames the ground world.
      // Classic entry supersedes any earlier native-Atlas return receipt.
      setAtlasGroundDrilldown(null);
      dispatch({ type: "SET_ATLAS_GROUND_ADDRESS", payload: null });
      dispatch({ type: "SET_PLAYER_WORLD_POS", payload: { x: 0, y: 0, z: 0 } });
      dispatch({ type: "SET_WORLD_VIEW_MODE", payload: "3d" });
      if (gameState.isMapVisible) {
        dispatch({ type: "TOGGLE_MAP_VISIBILITY" });
      }

      addMessage("Entering the 3D world.", "system");
    },
    [
      addMessage,
      dispatch,
      setAtlasGroundDrilldown,
      gameState.currentLocationId,
      gameState.phase,
      gameState.isMapVisible,
      gameState.playerCell?.cellId,
      gameState.worldSeed,
      gameState.playerGroundPos,
      gameState.atlasGroundAddress,
    ],
  );

  /**
   * Enter PLAYING ground from the native Atlas using its exact retained artifacts.
   *
   * This mirrors the established Classic-map state transition (player cell,
   * ground reset, view mode, interactions) while retaining the richer Atlas
   * receipt for World3DWrapper and stores only its compact Wave 2 address.
   */
  const handleEnterPlayingGroundFromAtlas = useCallback(
    (drilldown: AtlasGroundDrilldown, reviewed?: LocalJourneyQuote) => {
      // The cartographer may inspect any Local, but live presence changes only
      // after a reviewed journey from the accepted body through source terrain.
      let quote: LocalJourneyQuote;
      try { quote = quoteLocalGroundJourney(gameState, drilldown); }
      catch (error) { addMessage(error instanceof Error ? error.message : 'This journey is unavailable.', 'system'); return; }
      if (!reviewed || quote.key !== reviewed.key || !quote.allowed) {
        addMessage(quote.refusal ?? 'The journey changed. Review the route again before setting out.', 'system');
        return;
      }
      const accepted = handleTileClick(0, 0, { cellId: drilldown.atlasCellId, x: 0, y: 0, biomeId: quote.biomeId, discovered: true, isPlayerCurrent: true }, quote.meta, { preserveMapVisibility: true, prepareEncounter: () => prepareLocalJourneyBattlefield(drilldown, gameState, quote.totalSeconds) });
      if (!accepted) return;
      const targetLocationId = makeCellLocationId(drilldown.atlasCellId);
      const anchor = { cellId: drilldown.atlasCellId };

      // The selected Atlas cell becomes canonical game presence before the 3D
      // scene mounts, so NPCs, travel, discovery, and combat all see one place.
      if (
        gameState.playerCell?.cellId !== drilldown.atlasCellId ||
        gameState.currentLocationId !== targetLocationId
      ) {
        dispatch({
          type: "MOVE_PLAYER",
          payload: {
            newLocationId: targetLocationId,
            activeDynamicNpcIds: determineActiveDynamicNpcsForLocation(
              targetLocationId,
              LOCATIONS,
            ),
            destinationCell: { cellId: drilldown.atlasCellId, anchor },
          },
        });
      } else {
        dispatch({ type: "SET_ENTRY_3D_ANCHOR", payload: anchor });
      }

      // A fresh Atlas descent starts at the selected focus, not stale meters
      // from a previous Local. The receipt is assigned before switching modes
      // so TransitionController mounts PLAYING with the exact source available.
      dispatch({ type: "SET_PLAYER_GROUND_POS", payload: { position: null } });
      setAtlasGroundDrilldown(drilldown);
      dispatch({
        type: "SET_ATLAS_GROUND_ADDRESS",
        payload: atlasGroundAddressFromDrilldown(drilldown),
      });

      // Register the exact retained town when present; wilderness and site
      // entries keep the existing cell-derived fallback behavior.
      const burgId =
        drilldown.local.townPlan?.burgId ??
        burgIdForCell(drilldown.worldSeed, drilldown.atlasCellId);
      if (burgId !== undefined) {
        dispatch({ type: "TOWNSIM_REGISTER_BURG", payload: { burgId } });
      }

      dispatch({ type: "SET_PLAYER_WORLD_POS", payload: { x: 0, y: 0, z: 0 } });
      dispatch({ type: "SET_WORLD_VIEW_MODE", payload: "3d" });
      if (gameState.isMapVisible) {
        dispatch({ type: "TOGGLE_MAP_VISIBILITY" });
      }
      addMessage(`You reach ${drilldown.focus.label} on foot.`, "system");
    },
    [
      addMessage,
      dispatch,
      setAtlasGroundDrilldown,
      gameState.currentLocationId,
      gameState.isMapVisible,
      gameState,
      handleTileClick,
    ],
  );

  return { handleEnter3DAtCell, handleEnterPlayingGroundFromAtlas };
}
