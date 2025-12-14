/**
 * @file src/state/reducers/townReducer.ts
 * Reducer for managing town exploration state.
 * 
 * Handles player movement within towns, entering/exiting towns,
 * and managing the town viewport.
 */

import { GameState } from '../../types';
import { AppAction } from '../actionTypes';
import { TownState, TownPosition, TownDirection, TOWN_DIRECTION_VECTORS } from '../../types/town';
import { isPositionWalkable, findNearestWalkable } from '../../utils/walkabilityUtils';

/**
 * Handle town-related actions and return partial state updates
 */
export function townReducer(state: GameState, action: AppAction): Partial<GameState> {
    switch (action.type) {
        case 'ENTER_TOWN': {
            const { townMap, entryPoint, spawnPosition } = action.payload;

            // Find a valid spawn position near the provided one
            let playerPosition = spawnPosition;
            if (!isPositionWalkable(spawnPosition, townMap)) {
                const nearestWalkable = findNearestWalkable(spawnPosition, townMap);
                if (nearestWalkable) {
                    playerPosition = nearestWalkable;
                } else {
                    // Fallback to center of town
                    playerPosition = {
                        x: Math.floor(townMap.width / 2),
                        y: Math.floor(townMap.height / 2),
                    };
                }
            }

            const townState: TownState = {
                playerPosition,
                townMap,
                entryPoint,
                viewportCenter: playerPosition,
                zoomLevel: 1.0,
                playerFacing: 'south',
                isMoving: false,
            };

            return { townState };
        }

        case 'MOVE_IN_TOWN': {
            if (!state.townState) return {};

            const { direction } = action.payload;
            const { playerPosition, townMap } = state.townState;

            const delta = TOWN_DIRECTION_VECTORS[direction as TownDirection];
            if (!delta) return {};

            const newPosition: TownPosition = {
                x: playerPosition.x + delta.x,
                y: playerPosition.y + delta.y,
            };

            // Check if the new position is walkable
            // TODO: Add audio feedback (bump sound) and screen shake when player attempts to move into blocked tiles for better UX
            if (!isPositionWalkable(newPosition, townMap)) {
                // Can't move there - maybe play a bump sound?
                return {};
            }

            return {
                townState: {
                    ...state.townState,
                    playerPosition: newPosition,
                    viewportCenter: newPosition, // Camera follows player
                    playerFacing: direction as TownDirection,
                    isMoving: true,
                },
            };
        }

        case 'STOP_MOVING_IN_TOWN': {
            if (!state.townState) return {};

            return {
                townState: {
                    ...state.townState,
                    isMoving: false,
                },
            };
        }

        // TODO: Implement ZOOM_TOWN_MAP action to allow scroll wheel zoom control - zoomLevel state exists but is never modified by user input
        case 'SET_TOWN_VIEWPORT': {
            if (!state.townState) return {};

            const { center, zoom } = action.payload;

            return {
                townState: {
                    ...state.townState,
                    viewportCenter: center ?? state.townState.viewportCenter,
                    zoomLevel: zoom ?? state.townState.zoomLevel,
                },
            };
        }

        case 'EXIT_TOWN': {
            // Clear town state - App.tsx will handle phase transition
            return { townState: null };
        }

        default:
            return {};
    }
}
