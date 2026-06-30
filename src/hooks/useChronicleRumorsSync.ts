/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/hooks/useChronicleRumorsSync.ts
 * Bridges the living-world town chronicle into the tavern-gossip RUMOR system.
 *
 * While the player stands in a tracked town, that town's SUBSTANTIAL recent news
 * (notice + headline tiers — gossip-tier is the ambient-overheard channel, not
 * buyable rumors) becomes WorldRumors that the existing TavernGossipSystem
 * already surfaces for purchase via `activeRumors`.
 *
 * Idempotency: keyed on [currentLocationId, gameDay] so it re-runs when the
 * player moves or a day ticks over. The converter emits stable ids and the
 * ADD_RUMORS reducer dedups by id, so repeated fires never duplicate rumors —
 * no extra guard is needed beyond an early return when there's no news.
 *
 * No fallback/try-catch (no-fallback directive): resolveTownForLocation returns
 * undefined when the player isn't in a tracked town (a legitimate no-op), and
 * any underlying error surfaces honestly.
 *
 * Mirrors the seed-keyed idempotent pattern in useKnownPortsSync.
 */
import { useEffect, useMemo } from 'react';
import type { Dispatch } from 'react';
import { GameState } from '../types';
import { AppAction } from '../state/actionTypes';
import { getGameDay } from '../utils/core';
import { resolveTownForLocation } from '../systems/worldforge/townsim/chronicleForLocation';
import { selectTownNews } from '../systems/worldforge/townsim/townNews';
import { chronicleNewsToRumors } from '../utils/world/chronicleNewsToRumors';

export function useChronicleRumorsSync(
  gameState: GameState,
  dispatch: Dispatch<AppAction>,
): void {
  const { currentLocationId, gameTime } = gameState;
  const currentDay = getGameDay(gameTime);

  // Resolved in render so the effect can depend on the town itself: this makes
  // rumors sync as soon as the town becomes TRACKED (registration lands after a
  // separate dispatch) — not only on the next move/day — and again whenever the
  // daily loop advances the town (new town ref → new chronicle to mine).
  const cols = gameState.mapData?.gridSize.cols;
  const rows = gameState.mapData?.gridSize.rows;
  // Memoized so getTownTilesForGrid (which clones its array) isn't re-run every render.
  const town = useMemo(
    () =>
      cols !== undefined && rows !== undefined
        ? resolveTownForLocation({
            currentLocationId,
            worldSeed: gameState.worldSeed,
            gridSize: { cols, rows },
            townSim: gameState.townSim,
            gameTime,
          })
        : undefined,
    [currentLocationId, gameState.worldSeed, cols, rows, gameState.townSim, gameTime],
  );

  useEffect(() => {
    if (!town) return; // not standing in a tracked town

    // Substantial news only: notice + headline tiers. Gossip-tier is the
    // ambient-overheard channel (useOverheardGossip), not buyable rumors.
    const news = selectTownNews(town, currentDay, { minProminence: 'notice', max: 12 });
    if (news.length === 0) return;

    const rumors = chronicleNewsToRumors(news, currentDay, currentLocationId);
    if (rumors.length === 0) return;

    dispatch({ type: 'ADD_RUMORS', payload: { rumors } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLocationId, currentDay, town]); // re-run on move, day tick, or town tracked/advanced
}
