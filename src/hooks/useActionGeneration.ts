import { useMemo } from 'react';
import { Action, Location, NPC, Item } from '../types';
import { SUBMAP_DIMENSIONS } from '../config/mapConfig';
import { getAdjacentVillageEntry } from '../utils/submapUtils';
import { canUseDevTools } from '../utils/permissions';
import { logger } from '../utils/logger';

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
    worldSeed,
}: UseActionGenerationProps) => {
    return useMemo(() => {
        const actions: Action[] = [];

        // 1. NPC Interactions
        if (!currentLocation.id.startsWith('coord_')) {
            npcsInLocation.forEach((npc) => {
                actions.push({ type: 'talk', label: `Talk to ${npc.name}`, targetId: npc.id });
            });
        }

        // 2. Item Interactions
        if (!currentLocation.id.startsWith('coord_')) {
            itemsInLocation.forEach((item) => {
                actions.push({ type: 'take_item', label: `Take ${item.name}`, targetId: item.id });
            });
        }

        // 3. Named Exits (Standard Moves)
        if (currentLocation.exits) {
            Object.entries(currentLocation.exits).forEach(([direction, exit]) => {
                if (!['North', 'South', 'East', 'West', 'NorthEast', 'NorthWest', 'SouthEast', 'SouthWest'].includes(direction)) {
                    const targetId = typeof exit === 'string' ? exit : exit.targetId;
                    if (typeof exit === 'string' || !exit.isHidden) {
                        actions.push({ type: 'move', label: `Go ${direction}`, targetId: targetId });
                    }
                }
            });
        }

        // 4. Procedural Village Entry (Method 1)
        if (subMapCoordinates && worldSeed !== undefined) {
            const entryDirection = getAdjacentVillageEntry(
                worldSeed,
                currentLocation.mapCoordinates,
                currentLocation.biomeId,
                SUBMAP_DIMENSIONS,
                subMapCoordinates
            );

            if (entryDirection) {
                if (canUseDevTools()) logger.debug('Player is cardinally adjacent to village', { entryDirection });
                actions.push({
                    type: 'ENTER_VILLAGE',
                    label: 'Enter Village',
                    payload: { entryDirection }
                });
                actions.push({ type: 'OBSERVE_VILLAGE', label: 'Scout Village' });
            }
        }

        // 5. Predefined Town Entry (Method 2)
        const townKeywords = ['town', 'village', 'city', 'settlement', 'hamlet'];
        const isTownLocation = townKeywords.some(keyword =>
            currentLocation.name.toLowerCase().includes(keyword) ||
            currentLocation.id.toLowerCase().includes(keyword)
        );

        if (isTownLocation && !currentLocation.id.startsWith('coord_')) {
            actions.push({ type: 'ENTER_VILLAGE', label: 'Enter Town' });
            actions.push({ type: 'OBSERVE_TOWN', label: 'Scout Town' });
            actions.push({ type: 'APPROACH_TOWN', label: 'Approach Cautiously' });
        }

        return actions;
    }, [currentLocation, npcsInLocation, itemsInLocation, subMapCoordinates, worldSeed]);
};
