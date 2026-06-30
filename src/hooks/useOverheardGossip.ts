/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/hooks/useOverheardGossip.ts
 * Ambient hook: while the player stands in a tracked living-world town, they
 * periodically OVERHEAR townsfolk gossiping about recent minor happenings
 * (births, courtships, festivals, who came of age, who passed) into the message
 * log.
 *
 * Mirrors the ambient pattern in useTownCrierAnnouncements:
 *  - reads live state through a ref to avoid stale closures,
 *  - schedules periodic work on a self-cleaning interval,
 *  - appends a line via the same ADD_MESSAGE dispatch (sender 'npc', a banter-
 *    typed metadata entry) so it surfaces alongside other ambient lines.
 *
 * This is the gossip-tier sibling of the crier's headline channel; a separate
 * interval keeps the two from always firing on the same tick.
 *
 * All variety comes from recency + the no-immediate-repeat picker
 * (pickOverheardGossip) — no Math.random in the selection.
 *
 * Called by: App.tsx
 */
import { useEffect, useRef } from 'react';
import { GameState, GamePhase } from '../types';
import { AppAction } from '../state/actionTypes';
import { getGameDay } from '../utils/core';
import { resolveTownForLocation } from '../systems/worldforge/townsim/chronicleForLocation';
import { pickOverheardGossip, frameOverheardGossip } from '../systems/worldforge/townsim/townNews';
import { MAP_GRID_SIZE } from '../config/mapConfig';

// ============================================================================
// Constants
// ============================================================================

/** How often the player checks whether there's fresh gossip to overhear. */
const GOSSIP_INTERVAL_MS = 75_000; // offset from the crier so they don't always coincide

// ============================================================================
// Hook
// ============================================================================

export const useOverheardGossip = (
  gameState: GameState,
  dispatch: React.Dispatch<AppAction>,
) => {
  // Live state mirror so the interval callback never reads a stale closure.
  const gameStateRef = useRef(gameState);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);

  // Id of the last gossip overheard, so the chatter doesn't repeat itself.
  const lastIdRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const overhear = () => {
      const state = gameStateRef.current;
      if (state.phase !== GamePhase.PLAYING) return;

      const town = resolveTownForLocation({
        // GRID-RETIRE: BA-2 — prefer the canonical cell.
        cellId: state.playerCell?.cellId ?? null,
        currentLocationId: state.currentLocationId,
        worldSeed: state.worldSeed,
        gridSize: MAP_GRID_SIZE,
        townSim: state.townSim,
        gameTime: state.gameTime,
      });
      if (!town) return; // not in a tracked town — nothing to overhear this tick

      const item = pickOverheardGossip(town, getGameDay(state.gameTime), lastIdRef.current);
      if (!item) return; // no gossip-tier news

      lastIdRef.current = item.id;

      dispatch({
        type: 'ADD_MESSAGE',
        payload: {
          id: Date.now() + Math.random(), // collision-resistant key (matches App.tsx addMessage)
          text: frameOverheardGossip(item),
          sender: 'npc',
          timestamp: new Date(),
          metadata: { type: 'banter' },
        },
      });
    };

    const interval = setInterval(overhear, GOSSIP_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [dispatch]);
};
