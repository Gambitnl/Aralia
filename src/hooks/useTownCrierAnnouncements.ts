/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/hooks/useTownCrierAnnouncements.ts
 * Ambient hook: while the player stands in a tracked living-world town, a town
 * crier periodically proclaims the town's most recent HEADLINE into the message
 * log.
 *
 * Mirrors the ambient pattern in useCompanionBanter:
 *  - reads live state through a ref to avoid stale closures,
 *  - schedules periodic work on a self-cleaning interval,
 *  - appends a line via the same ADD_MESSAGE dispatch (sender 'npc', a banter-
 *    typed metadata entry) so it surfaces alongside other ambient lines.
 *
 * All variety comes from recency + the no-immediate-repeat picker
 * (pickCrierHeadline) — no Math.random in the selection.
 *
 * Called by: App.tsx
 */
import { useEffect, useRef } from 'react';
import { GameState, GamePhase } from '../types';
import { AppAction } from '../state/actionTypes';
import { getGameDay } from '../utils/core';
import { resolveTownForLocation } from '../systems/worldforge/townsim/chronicleForLocation';
import { pickCrierHeadline } from '../systems/worldforge/townsim/townNews';

// ============================================================================
// Constants
// ============================================================================

/** How often the crier checks whether there's a fresh headline to proclaim. */
const CRIER_INTERVAL_MS = 105_000; // ~90–120s real time

// ============================================================================
// Hook
// ============================================================================

export const useTownCrierAnnouncements = (
  gameState: GameState,
  dispatch: React.Dispatch<AppAction>,
) => {
  // Live state mirror so the interval callback never reads a stale closure.
  const gameStateRef = useRef(gameState);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);

  // Id of the last headline proclaimed, so the crier doesn't repeat itself.
  const lastIdRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const proclaim = () => {
      const state = gameStateRef.current;
      if (state.phase !== GamePhase.PLAYING) return;

      const town = resolveTownForLocation({
        currentLocationId: state.currentLocationId,
        worldSeed: state.worldSeed,
        gridSize: state.mapData?.gridSize,
        townSim: state.townSim,
        gameTime: state.gameTime,
      });
      if (!town) return; // not in a tracked town — nothing to proclaim this tick

      const item = pickCrierHeadline(town, getGameDay(state.gameTime), lastIdRef.current);
      if (!item) return; // no headline-tier news

      lastIdRef.current = item.id;

      dispatch({
        type: 'ADD_MESSAGE',
        payload: {
          id: Date.now() + Math.random(), // collision-resistant key (matches App.tsx addMessage)
          text: `A town crier proclaims: "${item.text}"`,
          sender: 'npc',
          timestamp: new Date(),
          metadata: { type: 'banter' },
        },
      });
    };

    const interval = setInterval(proclaim, CRIER_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [dispatch]);
};
