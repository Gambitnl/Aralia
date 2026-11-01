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

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/10/2026, 00:28:48
 * Dependents: components/layout/GameModals.tsx
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

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
  const town = useMemo(
    () =>
      resolveTownForLocation({
        // Grid retirement: the canonical cell is the sole town source.
        cellId: gameState.playerCell?.cellId ?? null,
        ground: gameState,
        currentLocationId,
        worldSeed: gameState.worldSeed,
        townSim: gameState.townSim,
        gameTime,
      }),
    [currentLocationId, gameState.worldSeed, gameState.townSim, gameTime, gameState.playerCell?.cellId, gameState.playerGroundPos, gameState.atlasGroundAddress, gameState.entry3DAnchor],
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
  }, [currentLocationId, currentDay, town, dispatch]); // re-run on move, day tick, or town tracked/advanced; dispatch is stable
}
