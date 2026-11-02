/** Retains the exact live Atlas receipt and restores saved addresses through the canonical pipeline. Rejected addresses still heal to Atlas before a different ground fallback can mount. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 31/10/2026, 22:01:54
 * Dependents: App.tsx, components/screens/AppPhaseContent.tsx
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { useState, useMemo, useEffect } from "react";
import type { Dispatch } from "react";
import type { GameState } from "../../types/state";
import type { AppAction } from "../../state/actionTypes";
import { atlasGroundAddressFromDrilldown, type AtlasGroundDrilldown } from "../../systems/worldforge/leaf3d/atlasGroundDrilldown";
import { restoreAtlasGroundDrilldown } from "../../systems/worldforge/leaf3d/atlasGroundRestore";
import { CURRENT_TOWN_LAYOUT_REVISION, type TownLayoutStates } from "../../systems/worldforge/town/townLayoutRevision";

export function useAppAtlasRuntime(gameState: GameState, dispatch: Dispatch<AppAction>) {
  // The object-rich receipt remains transient even though Wave 2 now saves its
  // compact address. A fresh Atlas descent keeps the exact retained objects;
  // reload reconstructs equivalent objects through the canonical pipeline.
  const [atlasGroundDrilldown, setAtlasGroundDrilldown] =
    useState<AtlasGroundDrilldown | null>(null);

  // Derive a small stable cache input from the authoritative town records.
  // Gossip, wealth and daily life must not regenerate this saved terrain.
  const townLayoutsJson = JSON.stringify(Object.fromEntries(Object.entries(gameState.townSim ?? {})
    .filter(([, town]) => town.layoutRevision !== undefined)
    .map(([id, town]) => [id, {layoutRevision: town.layoutRevision}])));
  const townLayouts = useMemo(() => JSON.parse(townLayoutsJson) as TownLayoutStates, [townLayoutsJson]);
  const atlasGroundRuntime = useMemo(() => {
    // Wave 1 object identity wins during the live descent. This also avoids an
    // unnecessary regeneration between the address dispatch and 3D mounting.
    // Live cartographer receipts use current generation. A selected older
    // town instead needs revision-aware reconstruction before address checks;
    // do not retain a current receipt merely because the address is equal.
    const olderSelection = Object.values(townLayouts).some(town =>
      town.layoutRevision !== undefined && town.layoutRevision !== CURRENT_TOWN_LAYOUT_REVISION);
    if (atlasGroundDrilldown && gameState.atlasGroundAddress && !olderSelection && gameState.worldforgeTerrainRevision !== 1) {
      const transientAddress = atlasGroundAddressFromDrilldown(atlasGroundDrilldown);
      // Loading another slot can replace reducer state without remounting App.
      // Keep Wave 1 object identity only when it belongs to the active address;
      // otherwise reconstruct the newly loaded slot instead of leaking objects.
      if (
        JSON.stringify(transientAddress) ===
        JSON.stringify(gameState.atlasGroundAddress)
      ) {
        return { drilldown: atlasGroundDrilldown, rejected: false };
      }
    }

    const restored = restoreAtlasGroundDrilldown(
      gameState.atlasGroundAddress,
      gameState.worldSeed,
      townLayouts,
      gameState.worldforgeTerrainRevision,
    );
    return {
      drilldown: restored.status === "ready" ? restored.drilldown : null,
      rejected: restored.status === "rejected",
    };
  }, [atlasGroundDrilldown, gameState.atlasGroundAddress, gameState.worldSeed, gameState.worldforgeTerrainRevision, townLayouts]);

  // A structurally valid but stale address is discovered only after canonical
  // generation. Heal back to native Atlas before TransitionController can mount
  // Classic's cell-centred fallback and accidentally show a different Local.
  useEffect(() => {
    if (!atlasGroundRuntime.rejected) return;

    dispatch({ type: "SET_ATLAS_GROUND_ADDRESS", payload: null });
    dispatch({ type: "SET_PLAYER_GROUND_POS", payload: { position: null } });
    dispatch({ type: "SET_MAP_SURFACE", payload: "worldforge" });
    if (gameState.worldViewMode === "3d") {
      dispatch({ type: "SET_WORLD_VIEW_MODE", payload: "atlas" });
    }
    dispatch({
      type: "ADD_NOTIFICATION",
      payload: {
        type: "warning",
        message: "The saved Atlas location is no longer valid. Select the location again.",
      },
    });
  }, [atlasGroundRuntime.rejected, dispatch, gameState.worldViewMode]);

  const activeAtlasGroundDrilldown = atlasGroundRuntime.drilldown;
  const safeWorldViewMode =
    atlasGroundRuntime.rejected && gameState.worldViewMode === "3d"
      ? "atlas"
      : gameState.worldViewMode;

  return { setAtlasGroundDrilldown, activeAtlasGroundDrilldown, safeWorldViewMode };
}
