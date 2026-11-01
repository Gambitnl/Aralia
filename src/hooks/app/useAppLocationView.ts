/** Supplies the location, visible NPC list and map tooltip from the current game state. Static places, cell-native wilderness, generated NPCs and town merchants keep their existing fallback and deduplication rules. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 28/10/2026, 19:47:46
 * Dependents: App.tsx
 * Imports: 11 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { useCallback } from "react";
import type { Location, NPC, WorldCellView } from "../../types";
import type { GameState } from "../../types/state";
import { LOCATIONS, STARTING_LOCATION_ID } from "../../data/world/locations";
import { NPCS } from "../../data/world/npcs";
import { BIOMES } from "../../data/biomes";
import { biomeIdForCell } from "../../systems/worldforge/local/biomeForCell";
import { townMerchantNpcsForCell } from "../../systems/worldforge/townsim/npcsForCell";
import { isWildernessLocationId, parseCellLocationId } from "../../utils/location/cellLocationId";
import { parseCoordinateLocationId } from "../../utils/locationUtils";
import { t, getGameDay } from "../../utils/core";
import { householdNpcAliveAt } from "../../systems/worldforge/townsim/householdNpc";

export function useAppLocationView(gameState: GameState) {
  const getCurrentLocation = useCallback((): Location => {
    const currentId = gameState.currentLocationId;
    if (LOCATIONS[currentId]) {
      const baseLocation = LOCATIONS[currentId];
      return {
        ...baseLocation,
        itemIds:
          gameState.dynamicLocationItemIds[currentId] ||
          baseLocation.itemIds ||
          [],
      };
    }

    if (isWildernessLocationId(currentId)) {
      // Cell-native (grid retirement): the wilderness location is the player's
      // atlas cell. Biome from the cell; a legacy coord_X_Y id still yields its
      // display coords, while a cell_<id> id labels by cell.
      const cellId =
        gameState.playerCell?.cellId ??
        parseCellLocationId(currentId) ??
        undefined;
      const legacyCoord = parseCoordinateLocationId(currentId);
      const biomeId =
        (cellId != null
          ? biomeIdForCell(gameState.worldSeed, cellId)
          : undefined) ?? "plains";
      const biome = BIOMES[biomeId];
      const where = legacyCoord
        ? `(${legacyCoord.x},${legacyCoord.y})`
        : `(cell ${cellId ?? "?"})`;

      return {
        id: currentId,
        name: `${biome?.name || "Unknown Biome"} sector ${where}`,
        baseDescription: `You are in the ${biome?.name || "unknown terrain"} world sector ${where}. ${biome?.description || ""}`,
        exits: {},
        itemIds: gameState.dynamicLocationItemIds[currentId] || [],
        npcIds: [],
        biomeId,
      };
    }
    const fallbackLoc = LOCATIONS[STARTING_LOCATION_ID];
    return {
      ...fallbackLoc,
      itemIds:
        gameState.dynamicLocationItemIds[STARTING_LOCATION_ID] ||
        fallbackLoc.itemIds ||
        [],
    };
  }, [
    gameState.currentLocationId,
    gameState.playerCell?.cellId,
    gameState.worldSeed,
    gameState.dynamicLocationItemIds,
  ]);

  const getCurrentNPCs = useCallback((): NPC[] => {
    const location = getCurrentLocation();
    let npcList: NPC[] = [];

    if (location?.npcIds && !isWildernessLocationId(location.id)) {
      npcList = location.npcIds
        .map((npcId) => NPCS[npcId])
        .filter(Boolean) as NPC[];
    }

    if (gameState.currentLocationActiveDynamicNpcIds) {
      const dynamicNpcs = gameState.currentLocationActiveDynamicNpcIds
        // Resolve static NPCs first, then runtime-generated ones (situational
        // opening NPCs, town-gen NPCs) so they render in the scene too.
        .map((npcId) => NPCS[npcId] || gameState.generatedNpcs?.[npcId])
        .filter(Boolean) as NPC[];
      npcList = [...npcList, ...dynamicNpcs];
    }

    // Worldforge town keepers: when the player stands in a tracked burg, merge in
    // the registered shop/tavern merchants (npc_burg_<burg>_plot_*) whose linked
    // business sits in this burg. World3DWrapper registers them into
    // generatedNpcs/worldBusinesses but nothing re-adds them to the active talk
    // list — this is the cell-native successor to the retired 2D-village triggers.
    // Bounded by the selector so a large town never floods the action pane.
    const townKeepers = townMerchantNpcsForCell({
      worldSeed: gameState.worldSeed,
      cellId: gameState.playerCell?.cellId ?? null,
      ground: gameState,
      generatedNpcs: gameState.generatedNpcs,
      worldBusinesses: gameState.worldBusinesses,
      townLife: gameState.townSim,
      day: getGameDay(gameState.gameTime),
    });
    npcList = [...npcList, ...townKeepers];

    const uniqueNpcList = npcList.reduce((acc, current) => {
      const rich = gameState.generatedNpcs?.[current.id];
      if (rich && !householdNpcAliveAt(rich, gameState.townSim, getGameDay(gameState.gameTime))) return acc;
      if (!acc.find((item) => item.id === current.id)) {
        acc.push(current);
      }
      return acc;
    }, [] as NPC[]);

    return uniqueNpcList;
  }, [
    getCurrentLocation,
    gameState.currentLocationActiveDynamicNpcIds,
    gameState.generatedNpcs,
    gameState.worldBusinesses,
    gameState.townSim,
    gameState.gameTime,
    gameState.worldSeed,
    gameState.playerCell?.cellId,
    gameState.playerGroundPos,
    gameState.atlasGroundAddress,
    gameState.entry3DAnchor,
  ]);

  // Grid retirement (agora-608b): the tooltip is formatted from a cell-native
  // `WorldCellView`. The x,y it prints are display bookkeeping (a legacy
  // coord_X_Y save keeps its coords; a cell_<id> save labels by cell id) — the
  // canonical identity on the payload is `cellId`.
  const getTileTooltipText = useCallback((worldCell: WorldCellView): string => {
    const biome = BIOMES[worldCell.biomeId];
    if (!worldCell.discovered) {
      return t("app.tooltip.undiscovered", {
        x: worldCell.x,
        y: worldCell.y,
        biome: biome?.name || t("app.tooltip.undiscovered_biome_unknown"),
      });
    }
    let tooltip = t("app.tooltip.discovered", {
      biome: biome?.name || t("app.tooltip.biome_unknown"),
      x: worldCell.x,
      y: worldCell.y,
    });

    if (worldCell.locationId && LOCATIONS[worldCell.locationId]) {
      tooltip += t("app.tooltip.location", {
        locationName: LOCATIONS[worldCell.locationId].name,
      });
    } else {
      tooltip += t("app.tooltip.dot");
    }
    if (biome?.description) {
      tooltip += t("app.tooltip.description", {
        description: biome.description,
      });
    }
    return tooltip;
  }, []);

  return { getCurrentLocation, getCurrentNPCs, getTileTooltipText };
}
