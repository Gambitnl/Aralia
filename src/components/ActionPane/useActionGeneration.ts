// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/06/2026, 02:20:35
 * Dependents: components/ActionPane/index.tsx
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { useMemo } from 'react';
import { Action, Location, NPC, Item } from '../../types';
import { useOptionalGameState } from '../../state/GameContext';
import { resolveTownForLocation } from '../../systems/worldforge/townsim/chronicleForLocation';

interface UseActionGenerationProps {
  currentLocation: Location;
  npcsInLocation: NPC[];
  itemsInLocation: Item[];
  subMapCoordinates?: { x: number; y: number };
  worldSeed?: number;
}

export const useActionGeneration = ({
  currentLocation,
  npcsInLocation,
  itemsInLocation,
}: UseActionGenerationProps) => {
  // Optional so the hook still works when rendered outside a GameProvider (e.g.
  // isolated hook tests). When present, it lets us detect whether the player is
  // standing in a tracked living-world town and surface the notice board.
  const gameContext = useOptionalGameState();

  const generalActions = useMemo(() => {
    const actions: Action[] = [];

    // Populate interactions for NPCs and Items in current location.
    // npcsInLocation is already the authoritative resolved set (static plus
    // dynamically-placed situation/town NPCs from getCurrentNPCs), so we always
    // surface a Talk action for each — including on procedural coord_ tiles,
    // where the opening situation places its strangers. Without this a fresh
    // player can see those NPCs in the scene but has no way to talk to them.
    npcsInLocation.forEach((npc) => {
      actions.push({ type: 'talk', label: `Talk to ${npc.name}`, payload: { targetNpcId: npc.id }, targetId: npc.id });
    });

    // Take actions for items present at the location. itemsInLocation is the
    // authoritative resolved set for BOTH named locations (authored itemIds) and
    // procedural coord_ tiles (items foraged onto the tile via "Search the Area",
    // resolved from dynamicLocationItemIds in App), so we surface a Take for each
    // unconditionally — the old coord_ guard meant foraged wilderness loot could
    // never be picked up.
    itemsInLocation.forEach((item) => {
      actions.push({ type: 'take_item', label: `Take ${item.name}`, payload: { itemId: item.id }, targetId: item.id });
    });

    // Wilderness foraging: only procedural coord_ tiles (named locations use their
    // authored loot). Always offered — the handler reports "already searched" if the
    // tile was foraged before, so a single tile cannot be farmed for repeat loot.
    if (currentLocation.id.startsWith('coord_')) {
      actions.push({ type: 'SEARCH_AREA', label: 'Search the Area' });
    }

    // Grid retirement: overworld navigation is the cell-native World Map, so the
    // 30x20 named-exit "Go <dir>" moves and the submap grid-adjacency village
    // detection are removed. Village/town entry comes from the predefined-location
    // check below (Method 2) and from Enter-3D on the map.

    // Predefined town/settlement locations
    const townKeywords = ['town', 'village', 'city', 'settlement', 'hamlet'];
    const isTownLocation = townKeywords.some(keyword =>
      currentLocation.name.toLowerCase().includes(keyword) ||
      currentLocation.id.toLowerCase().includes(keyword)
    );

    if (isTownLocation && !currentLocation.id.startsWith('coord_')) {
      actions.push({ type: 'ENTER_VILLAGE', label: 'Enter Town' });
      // Add contextually appropriate actions when at a town location
      actions.push({ type: 'OBSERVE_TOWN', label: 'Scout Town' });
      actions.push({ type: 'APPROACH_TOWN', label: 'Approach Cautiously' });
    }

    currentLocation.interactableFeatures?.forEach((feature) => {
      if (feature.type === 'lock') {
        actions.push({
          type: 'OPEN_LOCKPICKING_MODAL',
          label: feature.label,
          payload: feature.lock,
        });
      }

      if (feature.type === 'puzzle') {
        actions.push({
          type: 'OPEN_PUZZLE_RUNTIME',
          label: feature.label,
          payload: feature.puzzle,
        });
      }
    });

    // Town notice board: offered only when the player is standing in a tracked
    // living-world town (resolveTownForLocation returns a town). The modal
    // computes its own news live from gameState, so no payload is attached here.
    const gs = gameContext?.state;
    if (gs && resolveTownForLocation({
      currentLocationId: gs.currentLocationId,
      worldSeed: gs.worldSeed,
      cellId: gs.playerCell?.cellId ?? null,
      townSim: gs.townSim,
      gameTime: gs.gameTime,
    })) {
      actions.push({ type: 'OPEN_NOTICE_BOARD', label: 'Read the Notice Board' });
      // The broadsheet draws from the same tracked town; offered alongside the
      // notice board. The modal computes its own news live, so no payload here.
      actions.push({ type: 'OPEN_BROADSHEET', label: 'Read the latest broadsheet' });
      // Take a physical broadsheet keepsake: the handler freezes the town's
      // current news into an inventory Book the player can read after leaving.
      actions.push({ type: 'TAKE_BROADSHEET', label: 'Take a broadsheet' });
    }

    return actions;
  }, [currentLocation, npcsInLocation, itemsInLocation, gameContext]);

  return { generalActions };
};
