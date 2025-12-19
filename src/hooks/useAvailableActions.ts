
import { useMemo } from 'react';
import { Location, Action, NPC, Item } from '../types';
import { SUBMAP_DIMENSIONS } from '../config/mapConfig';
import { getSubmapTileInfo } from '../utils/submapUtils';
import { canUseDevTools } from '../utils/permissions';
import { logger } from '../utils/logger';

interface UseAvailableActionsProps {
  currentLocation: Location;
  npcsInLocation: NPC[];
  itemsInLocation: Item[];
  subMapCoordinates?: { x: number; y: number };
  worldSeed?: number;
}

export function useAvailableActions({
  currentLocation,
  npcsInLocation,
  itemsInLocation,
  subMapCoordinates,
  worldSeed,
}: UseAvailableActionsProps): Action[] {
  return useMemo(() => {
    const actions: Action[] = [];

    // Populate interactions for NPCs and Items in current location
    if (!currentLocation.id.startsWith('coord_')) {
      npcsInLocation.forEach((npc) => {
        actions.push({ type: 'talk', label: `Talk to ${npc.name}`, targetId: npc.id });
      });
    }

    if (!currentLocation.id.startsWith('coord_')) {
      itemsInLocation.forEach((item) => {
        actions.push({ type: 'take_item', label: `Take ${item.name}`, targetId: item.id });
      });
    }

    // Move actions for named exits (standard non-compass moves)
    if (currentLocation.exits) {
      Object.entries(currentLocation.exits).forEach(([direction, exit]) => {
        if (!['North', 'South', 'East', 'West', 'NorthEast', 'NorthWest', 'SouthEast', 'SouthWest'].includes(direction)) {
          // Handle exit being string (legacy) or object
          const targetId = typeof exit === 'string' ? exit : exit.targetId;
          // Optionally verify exit is visible if it's an object
          if (typeof exit === 'string' || !exit.isHidden) {
            actions.push({ type: 'move', label: `Go ${direction}`, targetId: targetId });
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

    return actions;
  }, [currentLocation, npcsInLocation, itemsInLocation, subMapCoordinates, worldSeed]);
}
