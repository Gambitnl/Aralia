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
import { getBridgeAtlas } from '../systems/worldforge/bridge/legacySubmapBridge';
import { getCanonicalTownPersonality } from '../systems/worldforge/town/canonicalTown';

// ============================================================================
// Constants
// ============================================================================

/** How often the crier checks whether there's a fresh headline to proclaim. */
const CRIER_INTERVAL_MS = 105_000; // ~90–120s real time

/**
 * The town's own STANDING business, cried when the chronicle has no headline.
 *
 * Each settlement resolves to an authored {@link VillageIntegrationProfile} whose
 * `encounterHooks` are the errands and worries that define the place — a herder
 * losing reindeer to a tundra storm, a smith after star-iron on a volcanic field.
 * Until this wiring those hooks had one caller, the retired 2D village generator,
 * so no player ever heard one (deepdive village-generator-vs-worldforge-town.md
 * finding 7). The hook is picked by GAME DAY, not at random, so the crier repeats
 * today's business all day and moves on tomorrow — and two players on the same
 * seed hear the same town say the same thing.
 */
function pickTownHookForDay(worldSeed: number, burgId: number, gameDay: number): string | null {
  const { profile } = getCanonicalTownPersonality(getBridgeAtlas(worldSeed), worldSeed, burgId);
  const hooks = profile.encounterHooks;
  if (hooks.length === 0) return null;
  // Non-negative modulo: game day can be 0 but never negative in practice, and a
  // negative index here would silently hand back undefined.
  return hooks[((gameDay % hooks.length) + hooks.length) % hooks.length];
}

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

  // The last settlement hook cried, so a quiet town doesn't chant one line.
  const lastHookRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const proclaim = () => {
      const state = gameStateRef.current;
      if (state.phase !== GamePhase.PLAYING) return;

      const town = resolveTownForLocation({
        // GRID-RETIRE: BA-2 — prefer the canonical cell.
        cellId: state.playerCell?.cellId ?? null,
        currentLocationId: state.currentLocationId,
        worldSeed: state.worldSeed,
        townSim: state.townSim,
        gameTime: state.gameTime,
      });
      if (!town) return; // not in a tracked town — nothing to proclaim this tick

      const gameDay = getGameDay(state.gameTime);
      const item = pickCrierHeadline(town, gameDay, lastIdRef.current);

      // No headline-tier news: fall back to the settlement's own standing
      // business rather than going silent. This is the town's FLAVOR speaking —
      // the only in-game voice the authored personality profiles have.
      let text: string;
      if (item) {
        lastIdRef.current = item.id;
        text = `A town crier proclaims: "${item.text}"`;
      } else {
        const hook = pickTownHookForDay(state.worldSeed, town.burgId, gameDay);
        if (!hook || hook === lastHookRef.current) return;
        lastHookRef.current = hook;
        text = `A town crier calls out the day's business: "${hook}"`;
      }

      dispatch({
        type: 'ADD_MESSAGE',
        payload: {
          id: Date.now() + Math.random(), // collision-resistant key (matches App.tsx addMessage)
          text,
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
