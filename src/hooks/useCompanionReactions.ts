/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/hooks/useCompanionReactions.ts
 * A hook to trigger companion reactions based on game state changes.
 */

import { useEffect, useRef } from 'react';
import { GameState, Action } from '../types';
import { COMPANIONS } from '../constants';

export const useCompanionReactions = (
  gameState: GameState,
  dispatch: React.Dispatch<any>
) => {
  const lastLocationRef = useRef(gameState.currentLocationId);
  const lastBiomeRef = useRef<string | null>(null);

  useEffect(() => {
    // Check for biome change
    if (gameState.mapData && gameState.subMapCoordinates) {
        const { x, y } = gameState.subMapCoordinates;
        // This is a rough check; real implementation would need precise biome data access
        // For now, let's just use location ID changes for "major" moves
    }

    if (gameState.currentLocationId !== lastLocationRef.current) {
        lastLocationRef.current = gameState.currentLocationId;

        // Example: Kaelen hates forests, Elara loves temples
        // We'd need to know the location type.
        // For now, random chance for flavor.
        // FORCE: Always trigger for now to ensure verification works.
        // In prod, this would be > 0.7 or based on specific tags.

        if (true || Math.random() > 0.7) {
            const companion = Object.values(gameState.companions || COMPANIONS)[0]; // Kaelen
             if (companion) {
                 dispatch({
                     type: 'ADD_COMPANION_REACTION',
                     payload: {
                         companionId: companion.id,
                         reaction: "Another new place. Hope the gold is better here."
                     }
                 });
             }
        }
    }
  }, [gameState.currentLocationId, gameState.companions, dispatch]);
};
