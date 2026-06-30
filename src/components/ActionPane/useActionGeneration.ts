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
import { getSubmapTileInfo } from '../../utils/submapUtils';
import { SUBMAP_DIMENSIONS } from '../../config/mapConfig';
import { canUseDevTools } from '../../utils/permissions';
import { logger } from '../../utils/logger';
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
  subMapCoordinates,
  worldSeed
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

    // Move actions for named exits (standard non-compass moves)
    if (currentLocation.exits) {
      Object.entries(currentLocation.exits).forEach(([direction, exit]) => {
        if (!['North', 'South', 'East', 'West', 'NorthEast', 'NorthWest', 'SouthEast', 'SouthWest'].includes(direction)) {
          // Handle exit being string (legacy) or object.
          // Both branches resolve to the string target id expected by Action.
          const targetId = typeof exit === 'string' ? exit : exit.targetId;
          // Optionally verify exit is visible if it's an object
          if (typeof exit === 'string' || !exit.isHidden) {
            actions.push({ type: 'move', label: `Go ${direction}`, payload: { query: `Go ${direction}` }, targetId: targetId });
          }
        }
      });
    }

    // Check for Village/Town Entry
    // Method 1: Procedural village terrain on coordinate locations AND predefined locations
    if (subMapCoordinates && worldSeed !== undefined) {
      // Only check cardinal directions (N/E/S/W) for village entry - no diagonals
      // The offset represents where the VILLAGE is relative to the player
      // So if village is at offset {x: 1, y: 0}, player enters from the WEST
      const cardinalOffsets = [
        { x: 0, y: -1, entryDirection: 'south' },  // Village is north of player -> enter from south
        { x: 0, y: 1, entryDirection: 'north' },   // Village is south of player -> enter from north
        { x: -1, y: 0, entryDirection: 'east' },   // Village is west of player -> enter from east
        { x: 1, y: 0, entryDirection: 'west' },    // Village is east of player -> enter from west
      ];

      let adjacentToVillage = false;
      let entryDirection: string | null = null;

      for (const offset of cardinalOffsets) {
        const checkX = subMapCoordinates.x + offset.x;
        const checkY = subMapCoordinates.y + offset.y;

        // Only check within submap bounds
        if (checkX >= 0 && checkX < SUBMAP_DIMENSIONS.cols &&
          checkY >= 0 && checkY < SUBMAP_DIMENSIONS.rows) {
          const { effectiveTerrainType: checkType } = getSubmapTileInfo(
            worldSeed,
            currentLocation.mapCoordinates,
            currentLocation.biomeId,
            SUBMAP_DIMENSIONS,
            { x: checkX, y: checkY }
          );

          if (checkType === 'village_area') {
            adjacentToVillage = true;
            entryDirection = offset.entryDirection;
            break; // Use first found village direction
          }
        }
      }

      if (adjacentToVillage && entryDirection) {
        if (canUseDevTools()) logger.debug('Player is cardinally adjacent to village', { entryDirection });
        actions.push({
          type: 'ENTER_VILLAGE',
          label: 'Enter Village',
          payload: { entryDirection } // Pass entry direction for spawn positioning
        });
        actions.push({ type: 'OBSERVE_VILLAGE', label: 'Scout Village' });
      }
    }

    // Method 2: Predefined town/settlement locations
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
      gridSize: gs.mapData?.gridSize,
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
  }, [currentLocation, npcsInLocation, itemsInLocation, subMapCoordinates, worldSeed, gameContext]);

  return { generalActions };
};
